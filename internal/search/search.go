// Package search implementa indexação e busca global de conteúdo (M4).
package search

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"log/slog"
	"os"
	"path/filepath"
	"strings"

	"github.com/ferna/axisdoc/internal/store"
	"github.com/ferna/axisdoc/internal/tool"
	"github.com/ferna/axisdoc/internal/tool/pdftools"
)

// Service indexa textos de arquivos (.txt, .md, .pdf e OCR futuro).
type Service struct {
	repo *store.SearchRepo
}

// NewService cria o serviço de busca.
func NewService(repo *store.SearchRepo) *Service {
	return &Service{repo: repo}
}

// docID gera ID estável por caminho.
func docID(path string) string {
	sum := sha256.Sum256([]byte(path))
	return hex.EncodeToString(sum[:8])
}

// IndexFiles indexa os arquivos dados (texto plano ou PDF).
func (s *Service) IndexFiles(ctx context.Context, paths []string, report func(pct float64)) (int, error) {
	indexed := 0
	for i, p := range paths {
		if err := ctx.Err(); err != nil {
			return indexed, err
		}
		st, err := os.Stat(p)
		if err != nil {
			continue
		}
		if st.IsDir() {
			n, err := s.indexDir(ctx, p, report)
			if err != nil {
				return indexed, err
			}
			indexed += n
			continue
		}
		if s.indexFile(ctx, p) {
			indexed++
		}
		if report != nil {
			report(float64(i+1) / float64(len(paths)) * 100)
		}
	}
	return indexed, nil
}

func (s *Service) indexDir(ctx context.Context, dir string, report func(pct float64)) (int, error) {
	indexed := 0
	err := filepath.WalkDir(dir, func(path string, d os.DirEntry, err error) error {
		if err != nil {
			return nil
		}
		if err := ctx.Err(); err != nil {
			return err
		}
		if d.IsDir() {
			return nil
		}
		if s.indexFile(ctx, path) {
			indexed++
		}
		return nil
	})
	return indexed, err
}

// indexFile indexa um arquivo se o formato for suportado.
func (s *Service) indexFile(ctx context.Context, path string) bool {
	ext := strings.ToLower(filepath.Ext(path))
	var content string
	switch ext {
	case ".txt", ".md", ".csv", ".json", ".yaml", ".yml", ".toml", ".log":
		data, err := os.ReadFile(path)
		if err != nil {
			return false
		}
		content = string(data)
	case ".pdf":
		text, err := pdftools.ExtractTextFile(path)
		if err != nil {
			slog.Debug("search: pdf sem texto", "path", path, "err", err)
			return false
		}
		content = text
	default:
		return false
	}
	if strings.TrimSpace(content) == "" {
		return false
	}
	id := docID(path)
	err := s.repo.Index(ctx, store.SearchDoc{
		DocID:   id,
		Path:    path,
		Title:   filepath.Base(path),
		Content: content,
	})
	if err != nil {
		slog.Error("search: indexar", "path", path, "err", err)
		return false
	}
	return true
}

// Query busca no índice.
func (s *Service) Query(ctx context.Context, q string, limit int) ([]store.SearchHit, error) {
	return s.repo.Query(ctx, q, limit)
}

// Count documentos indexados.
func (s *Service) Count(ctx context.Context) (int, error) {
	return s.repo.Count(ctx)
}

// --- Ferramenta "indexar para busca" (aparece na UI) ---

// IndexTool indexa arquivos no índice de busca.
type IndexTool struct {
	Svc *Service
}

func NewIndexTool(svc *Service) *IndexTool { return &IndexTool{Svc: svc} }

func (t *IndexTool) ID() string          { return "search.index" }
func (t *IndexTool) Category() string    { return "search" }
func (t *IndexTool) Title() string       { return "tool.searchindex.title" }
func (t *IndexTool) Description() string { return "tool.searchindex.desc" }
func (t *IndexTool) Icon() string        { return "database" }
func (t *IndexTool) Params() []tool.Param {
	return []tool.Param{
		{Key: "recursive", Label: "param.search.recursive.label", Type: tool.ParamBool, Default: false},
	}
}

func (t *IndexTool) Steps() []tool.Step { return []tool.Step{indexStep{t}} }

type indexStep struct{ t *IndexTool }

func (s indexStep) Name() string { return "step.search.index" }

func (s indexStep) Run(ctx context.Context, in tool.Input, report func(pct float64)) (tool.Output, error) {
	paths := in.Paths
	if tool.ParamBoolValue(in, "recursive", false) {
		// expande diretórios
		var expanded []string
		for _, p := range in.Paths {
			if st, err := os.Stat(p); err == nil && st.IsDir() {
				_ = filepath.WalkDir(p, func(path string, d os.DirEntry, err error) error {
					if err == nil && !d.IsDir() {
						expanded = append(expanded, path)
					}
					return nil
				})
			} else {
				expanded = append(expanded, p)
			}
		}
		paths = expanded
	}
	n, err := s.t.Svc.IndexFiles(ctx, paths, report)
	if err != nil {
		return tool.Output{}, err
	}
	return tool.Output{Message: fmt.Sprintf("%d documento(s) indexado(s)", n)}, nil
}

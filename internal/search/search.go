// Package search implementa indexação e busca global de conteúdo (M4).
package search

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"log/slog"
	"os"
	"path/filepath"
	"strings"

	"github.com/ferna/axisdoc/internal/store"
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

package main

import (
	"bytes"
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"image/png"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/pdfcpu/pdfcpu/pkg/api"
	"github.com/skip2/go-qrcode"

	"github.com/ferna/axisdoc/internal/output"
	"github.com/ferna/axisdoc/internal/pipeline"
	"github.com/ferna/axisdoc/internal/search"
	"github.com/ferna/axisdoc/internal/store"
	"github.com/ferna/axisdoc/internal/tool"
	"github.com/ferna/axisdoc/internal/tool/datafiles"
	"github.com/ferna/axisdoc/internal/tool/pdftools"
	"github.com/ferna/axisdoc/internal/tool/texttools"
	"github.com/ferna/axisdoc/internal/watcher"
)

// Fallbacks pré-startup: o Wails faz Bind dos serviços no NewApp, antes do
// startup() abrir o SQLite. Esses fallbacks em memória evitam nil pointer e
// são substituídos pelos reais no startup().
func newSearchServiceFallback() *SearchService {
	st, err := store.Open(":memory:")
	if err != nil {
		return &SearchService{}
	}
	return &SearchService{repo: st.Search(), svc: search.NewService(st.Search())}
}

func newPipelineRepoFallback() *pipeline.Repo {
	st, err := store.Open(":memory:")
	if err != nil {
		return nil
	}
	return pipeline.NewRepo(st.Settings())
}

func newPipelineRunnerFallback(reg *tool.Registry) *pipeline.Runner {
	return pipeline.NewRunner(reg)
}

func newWatchServiceFallback() *WatchService {
	return &WatchService{}
}

// SearchService expõe a busca global ao frontend.
type SearchService struct {
	repo *store.SearchRepo
	svc  *search.Service
}

// Query busca no índice global. Nunca retorna null.
func (s *SearchService) Query(q string, limit int) ([]store.SearchHit, error) {
	if s.repo == nil {
		return []store.SearchHit{}, nil
	}
	hits, err := s.repo.Query(context.Background(), q, limit)
	if err != nil {
		return nil, err
	}
	if hits == nil {
		return []store.SearchHit{}, nil
	}
	return hits, nil
}

// Count documentos indexados.
func (s *SearchService) Count() (int, error) {
	if s.repo == nil {
		return 0, nil
	}
	return s.repo.Count(context.Background())
}

// IndexFiles indexa arquivos diretamente (fora da fila de jobs).
func (s *SearchService) IndexFiles(paths []string) (int, error) {
	if s.svc == nil {
		return 0, fmt.Errorf("busca indisponível")
	}
	return s.svc.IndexFiles(context.Background(), paths, nil)
}

// PipelineService expõe macros ao frontend.
type PipelineService struct {
	repo   *pipeline.Repo
	runner *pipeline.Runner
}

// Save grava uma macro.
func (s *PipelineService) Save(p pipeline.Pipeline) error {
	if s.repo == nil {
		return fmt.Errorf("macros indisponíveis")
	}
	return s.repo.Save(context.Background(), p)
}

// List lista macros salvas. Nunca retorna null (frontend faz .map direto).
func (s *PipelineService) List() ([]pipeline.Pipeline, error) {
	if s.repo == nil {
		return []pipeline.Pipeline{}, nil
	}
	list, err := s.repo.List(context.Background())
	if err != nil {
		return nil, err
	}
	if list == nil {
		return []pipeline.Pipeline{}, nil
	}
	return list, nil
}

// Delete remove uma macro.
func (s *PipelineService) Delete(id string) error {
	if s.repo == nil {
		return fmt.Errorf("macros indisponíveis")
	}
	return s.repo.Delete(context.Background(), id)
}

// Run executa uma macro sobre os arquivos.
func (s *PipelineService) Run(p pipeline.Pipeline, paths []string) (*pipeline.RunResult, error) {
	if s.runner == nil {
		return nil, fmt.Errorf("macros indisponíveis")
	}
	return s.runner.Run(context.Background(), p, paths)
}

// WatchService expõe watch folders ao frontend.
type WatchService struct {
	runner  *pipeline.Runner
	watcher *watcher.Watcher
}

func (s *WatchService) init(runner *pipeline.Runner) {
	s.runner = runner
	w, err := watcher.New(runner)
	if err != nil {
		return
	}
	s.watcher = w
	ctx := context.Background()
	go func() { _ = w.Run(ctx) }()
}

func (s *WatchService) stop() {
	if s.watcher != nil {
		s.watcher.Close()
	}
}

// AddRule adiciona uma regra de watch folder.
func (s *WatchService) AddRule(folder, pattern string, p pipeline.Pipeline) error {
	if s.watcher == nil {
		return context.Canceled
	}
	return s.watcher.AddRule(watcher.Rule{ID: p.ID, Folder: folder, Pattern: pattern, Pipeline: p})
}

// ListRules lista as regras ativas.
func (s *WatchService) ListRules() []watchRuleOut {
	if s.watcher == nil {
		return []watchRuleOut{}
	}
	rules := s.watcher.ListRules()
	out := make([]watchRuleOut, 0, len(rules))
	for _, r := range rules {
		out = append(out, watchRuleOut{ID: r.ID, Folder: r.Folder, Pattern: r.Pattern, Pipeline: r.Pipeline})
	}
	return out
}

// RemoveRule remove uma regra.
func (s *WatchService) RemoveRule(id string) error {
	if s.watcher == nil {
		return context.Canceled
	}
	return s.watcher.RemoveRule(id)
}

type watchRuleOut struct {
	ID       string            `json:"id"`
	Folder   string            `json:"folder"`
	Pattern  string            `json:"pattern"`
	Pipeline pipeline.Pipeline `json:"pipeline"`
}

// ---- Preview seguro de arquivos (tokens) ----

// PreviewRef associa um token opaco a um arquivo para a UI pré-visualizar.
type PreviewRef struct {
	Token string `json:"token"`
	Name  string `json:"name"`
	Path  string `json:"path"`
}

const previewTTL = time.Hour

type previewEntry struct {
	path    string
	expires time.Time
}

// previewRegistry guarda tokens de preview em memória com TTL.
var previewRegistry = struct {
	sync.Mutex
	entries map[string]previewEntry
}{entries: map[string]previewEntry{}}

func newPreviewToken() string {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		return fmt.Sprintf("%d", time.Now().UnixNano())
	}
	return hex.EncodeToString(b)
}

func previewLookup(token string) (string, bool) {
	previewRegistry.Lock()
	defer previewRegistry.Unlock()
	e, ok := previewRegistry.entries[token]
	if !ok || time.Now().After(e.expires) {
		delete(previewRegistry.entries, token)
		return "", false
	}
	return e.path, true
}

// previewHandler serve arquivos por token: GET /preview/{token}
func previewHandler() http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		token := strings.TrimPrefix(r.URL.Path, "/preview/")
		// rejeita qualquer coisa fora do formato de token
		if token == "" || strings.ContainsAny(token, "/\\?#%") {
			http.NotFound(w, r)
			return
		}
		if len(token) > 64 {
			http.NotFound(w, r)
			return
		}
		path, ok := previewLookup(token)
		if !ok {
			http.NotFound(w, r)
			return
		}
		http.ServeFile(w, r, path)
	})
}

// RegisterPreviewFiles registra arquivos para preview e retorna tokens opacos.
func (s *SystemService) RegisterPreviewFiles(paths []string) []PreviewRef {
	out := make([]PreviewRef, 0, len(paths))
	previewRegistry.Lock()
	defer previewRegistry.Unlock()
	for _, p := range paths {
		if st, err := os.Stat(p); err != nil || st.IsDir() {
			continue
		}
		token := newPreviewToken()
		previewRegistry.entries[token] = previewEntry{path: p, expires: time.Now().Add(previewTTL)}
		out = append(out, PreviewRef{Token: token, Name: filepath.Base(p), Path: p})
	}
	return out
}

// PreviewText lê as primeiras linhas de um arquivo de texto (para preview).
func (s *SystemService) PreviewText(path string, maxLines int) (string, error) {
	if maxLines <= 0 {
		maxLines = 50
	}
	if maxLines > 500 {
		maxLines = 500
	}
	data, err := os.ReadFile(path)
	if err != nil {
		return "", fmt.Errorf("preview: %w", err)
	}
	lines := strings.Split(string(data), "\n")
	if len(lines) > maxLines {
		lines = append(lines[:maxLines], fmt.Sprintf("… (%d linhas a mais)", len(lines)-maxLines))
	}
	return strings.Join(lines, "\n"), nil
}

// PreviewSummary descreve um arquivo estruturado para a UI (tabela ou PDF).
type PreviewSummary struct {
	Kind   string     `json:"kind"` // "table" | "pdf"
	Rows   int        `json:"rows"`
	Cols   int        `json:"cols"`
	Sample [][]string `json:"sample"`
	Pages  int        `json:"pages"`
	Title  string     `json:"title"`
}

// PreviewSummary retorna cabeçalho + primeiras linhas de planilhas/CSV
// ou metadados de PDF (páginas + título).
func (s *SystemService) PreviewSummary(token string) (PreviewSummary, error) {
	path, ok := previewLookup(token)
	if !ok {
		return PreviewSummary{}, fmt.Errorf("preview expirado")
	}
	ext := strings.ToLower(filepath.Ext(path))
	switch ext {
	case ".csv", ".xlsx", ".xlsm":
		return summarizeTable(path)
	case ".pdf":
		return summarizePDF(path)
	default:
		return PreviewSummary{}, fmt.Errorf("sem resumo para %s", ext)
	}
}

func summarizeTable(path string) (PreviewSummary, error) {
	rows, err := datafiles.ReadTabular(path)
	if err != nil {
		return PreviewSummary{}, err
	}
	cols := 0
	for _, r := range rows {
		if len(r) > cols {
			cols = len(r)
		}
	}
	sample := rows
	if len(sample) > 6 {
		sample = sample[:6]
	}
	return PreviewSummary{Kind: "table", Rows: len(rows), Cols: cols, Sample: sample}, nil
}

func summarizePDF(path string) (PreviewSummary, error) {
	text, err := pdftools.ExtractTextFile(path)
	if err != nil || strings.TrimSpace(text) == "" {
		// PDFs escaneados/sem texto: informa só metadados
	}
	f, err := os.Open(path)
	if err != nil {
		return PreviewSummary{}, err
	}
	defer f.Close()
	info, err := api.PDFInfo(f, filepath.Base(path), nil, false, nil)
	if err != nil {
		return PreviewSummary{}, err
	}
	return PreviewSummary{Kind: "pdf", Pages: info.PageCount}, nil
}

// PreviewFor gera preview em memória (base64 PNG) para tools geradoras
// (QR/barcode) sem gravar arquivo — o job real grava.
func (s *SystemService) PreviewFor(toolID string, params map[string]any) (string, error) {
	return previewForTool(toolID, params)
}

func previewForTool(toolID string, params map[string]any) (string, error) {
	switch toolID {
	case "text.qrcode":
		text, _ := params["text"].(string)
		if strings.TrimSpace(text) == "" {
			return "", fmt.Errorf("texto vazio")
		}
		size := paramFloat(params, "size", 256)
		pngBytes, err := qrcode.Encode(text, qrcode.Medium, int(size))
		if err != nil {
			return "", err
		}
		return base64.StdEncoding.EncodeToString(pngBytes), nil
	case "text.barcode":
		text, _ := params["text"].(string)
		if strings.TrimSpace(text) == "" {
			return "", fmt.Errorf("texto vazio")
		}
		bc, err := texttools.MakeBarcode(params)
		if err != nil {
			return "", err
		}
		var buf bytes.Buffer
		if err := png.Encode(&buf, bc); err != nil {
			return "", err
		}
		return base64.StdEncoding.EncodeToString(buf.Bytes()), nil
	default:
		return "", fmt.Errorf("preview não suportado para %s", toolID)
	}
}

// PreviewTransform aplica a transformação da tool sobre UM arquivo e retorna
// base64 (sem gravar). Mantido para compatibilidade (chamadas legadas sem
// página): equivale a PreviewRender com page=0. Prefira PreviewRender.
func (s *SystemService) PreviewTransform(toolID, path string, params map[string]any) (string, error) {
	return s.PreviewRender(toolID, path, params, 0)
}

// previewRenderCache guarda previews já calculados por hash(tool+path+params+page).
// O hash inclui mtime+tamanho do arquivo, então edição externa invalida sozinha.
var previewRenderCache = struct {
	sync.Mutex
	entries map[string]previewCacheEntry
}{entries: map[string]previewCacheEntry{}}

type previewCacheEntry struct {
	b64     string
	expires time.Time
}

const previewRenderTTL = 10 * time.Minute

func previewRenderKey(toolID, path string, params map[string]any, page int) (string, error) {
	st, err := os.Stat(path)
	if err != nil {
		return "", err
	}
	canonical, err := json.Marshal(map[string]any{
		"tool": toolID, "path": path, "params": params, "page": page,
		"mtime": st.ModTime().UnixNano(), "size": st.Size(),
	})
	if err != nil {
		return "", err
	}
	sum := sha256.Sum256(canonical)
	return hex.EncodeToString(sum[:]), nil
}

// PreviewRender aplica a tool sobre o PDF de entrada e retorna a página
// renderizada (base64 PNG) — preview ANTES de executar. Não grava nada:
// roda a tool num temp e apaga. Cache por hash evita recomputar a cada tecla.
func (s *SystemService) PreviewRender(toolID, path string, params map[string]any, page int) (string, error) {
	key, err := previewRenderKey(toolID, path, params, page)
	if err != nil {
		return "", err
	}
	previewRenderCache.Lock()
	if e, ok := previewRenderCache.entries[key]; ok && time.Now().Before(e.expires) {
		b64 := e.b64
		previewRenderCache.Unlock()
		return b64, nil
	}
	previewRenderCache.Unlock()

	b64, err := previewRenderUncached(toolID, path, params, page)
	if err != nil {
		return "", err
	}
	previewRenderCache.Lock()
	previewRenderCache.entries[key] = previewCacheEntry{b64: b64, expires: time.Now().Add(previewRenderTTL)}
	// poda simples para não crescer sem limite
	if len(previewRenderCache.entries) > 64 {
		for k, e := range previewRenderCache.entries {
			if time.Now().After(e.expires) {
				delete(previewRenderCache.entries, k)
			}
		}
	}
	previewRenderCache.Unlock()
	return b64, nil
}

func previewRenderUncached(toolID, path string, params map[string]any, page int) (string, error) {
	t, err := toolByID(toolID)
	if err != nil {
		return "", err
	}
	out, err := t.Steps()[0].Run(context.Background(), tool.Input{Paths: []string{path}, Params: params}, nil)
	if err != nil {
		return "", err
	}
	if len(out.Paths) == 0 {
		return "", fmt.Errorf("sem saída")
	}
	defer os.Remove(out.Paths[0])
	raw, err := previewBytesPage(out.Paths[0], page)
	if err != nil {
		return "", err
	}
	return base64.StdEncoding.EncodeToString(raw), nil
}

// previewBytesPage lê o arquivo de saída; se for PDF, rasteriza a página pedida.
func previewBytesPage(path string, page int) ([]byte, error) {
	if !strings.EqualFold(filepath.Ext(path), ".pdf") {
		return os.ReadFile(path)
	}
	return renderPDFPage(path, page, 600)
}

// toolByID resolve a tool no registry global (mesmo usado pelo app/CLI).
func toolByID(id string) (tool.Tool, error) {
	return NewRegistry().Get(id)
}

func paramFloat(params map[string]any, key string, def float64) float64 {
	switch v := params[key].(type) {
	case float64:
		return v
	case int:
		return float64(v)
	}
	return def
}
func (s *SystemService) SaveRenderedPage(outputDir, baseName string, page int, ext, dataB64 string) (string, error) {
	if outputDir == "" {
		return "", fmt.Errorf("pasta de destino vazia")
	}
	switch ext {
	case "png", "jpg":
	default:
		return "", fmt.Errorf("formato inválido: %s", ext)
	}
	raw, err := base64.StdEncoding.DecodeString(dataB64)
	if err != nil {
		return "", fmt.Errorf("base64 inválido: %w", err)
	}
	dest := output.NextAvailablePath(filepath.Join(outputDir, fmt.Sprintf("%s_p%02d.%s", baseName, page, ext)))
	if err := output.WriteFile(dest, raw); err != nil {
		return "", err
	}
	return dest, nil
}

package main

import (
	"context"
	"fmt"
	"log/slog"
	"os"
	"path/filepath"

	"github.com/ferna/axisdoc/internal/cli"
	"github.com/ferna/axisdoc/internal/jobs"
	"github.com/ferna/axisdoc/internal/ocr"
	"github.com/ferna/axisdoc/internal/pipeline"
	"github.com/ferna/axisdoc/internal/runtimei"
	"github.com/ferna/axisdoc/internal/search"
	"github.com/ferna/axisdoc/internal/store"
	"github.com/ferna/axisdoc/internal/tool"
	"github.com/ferna/axisdoc/internal/tool/datafiles"
	"github.com/ferna/axisdoc/internal/tool/datafiles2"
	"github.com/ferna/axisdoc/internal/tool/hashfile"
	"github.com/ferna/axisdoc/internal/tool/imgtools"
	"github.com/ferna/axisdoc/internal/tool/imgtools2"
	"github.com/ferna/axisdoc/internal/tool/pdftools"
	"github.com/ferna/axisdoc/internal/tool/pdftools2"
	"github.com/ferna/axisdoc/internal/tool/pdftools3"
	"github.com/ferna/axisdoc/internal/tool/texttools"
	"github.com/ferna/axisdoc/internal/tool/texttools2"
	"github.com/ferna/axisdoc/internal/update"
	wruntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

// App expõe os métodos ao frontend via bindings Wails.
type App struct {
	ctx         context.Context
	store       *store.Store
	registry    *tool.Registry
	manager     *jobs.Manager
	toolSvc     *ToolService
	jobSvc      *JobService
	sysSvc      *SystemService
	searchSvc   *SearchService
	pipelineSvc *PipelineService
	watchSvc    *WatchService
	pdfEditSvc  *PdfEditService
}

// NewApp cria a aplicação com todos os serviços registrados.
func NewApp() *App {
	reg := NewRegistry()

	searchSvc := newSearchServiceFallback()
	return &App{
		registry:    reg,
		toolSvc:     &ToolService{reg: reg},
		jobSvc:      &JobService{},
		sysSvc:      &SystemService{},
		searchSvc:   searchSvc,
		pipelineSvc: &PipelineService{},
		watchSvc:    newWatchServiceFallback(),
		pdfEditSvc:  &PdfEditService{},
	}
}

// NewRegistry monta o registry completo de ferramentas.
// Extraído de NewApp para permitir testes de contrato do catálogo sem Wails.
func NewRegistry() *tool.Registry {
	reg := tool.NewRegistry()
	renameTool := texttools.NewBatchRename()
	for _, t := range []tool.Tool{
		hashfile.New(),
		pdftools.NewPDFInfo(),
		pdftools.NewMergePDF(),
		pdftools.NewSplitPDF(),
		pdftools.NewRotatePDF(),
		pdftools.NewWatermarkPDF(),
		pdftools.NewCompressPDF(),
		pdftools.NewExtractTextPDF(),
		pdftools2.NewExtractImages(),
		pdftools2.NewExtractPages(),
		pdftools2.NewRemovePages(),
		pdftools2.NewExtractFonts(),
		pdftools2.NewExtractAttachments(),
		pdftools2.NewExtractMetadata(),
		pdftools2.NewPermissions(),
		pdftools2.NewComparePDFs(),
		pdftools2.NewAddAttachments(),
		pdftools2.NewImagesToPDF(),
		pdftools2.NewCreatePDF(),
		pdftools2.NewNUp(),
		pdftools3.NewRearrange(),
		pdftools3.NewProtect(),
		pdftools3.NewUnlock(),
		pdftools3.NewOverlay(),
		pdftools3.NewPageNumbers(),
		imgtools.NewConvertImage(),
		imgtools.NewResizeImage(),
		imgtools.NewWatermarkImage(),
		imgtools2.NewCrop(),
		imgtools2.NewTransform(),
		imgtools2.NewFilters(),
		imgtools2.NewIconGen(),
		imgtools2.NewGIFExtract(),
		imgtools2.NewGIFBuild(),
		imgtools2.NewWatermarkPos(),
		imgtools2.NewPalette(),
		datafiles.NewTabularConvert(),
		datafiles.NewSpreadsheetCompare(),
		datafiles.NewStructConvert(),
		datafiles.NewJSONFormat(),
		datafiles.NewTableToJSON(),
		datafiles2.NewCSVToSQL(),
		datafiles2.NewSQLToCSV(),
		datafiles2.NewJSONToTable(),
		texttools.NewTextDiff(),
		renameTool,
		texttools.NewTextStats(),
		texttools.NewQRCode(),
		texttools.NewBarcodeTool(),
		texttools2.NewLorem(),
		texttools2.NewBaseConvert(),
		texttools2.NewEpoch(),
		texttools2.NewUUID(),
		texttools2.NewSlug(),
		texttools2.NewColumnize(),
		texttools2.NewEscape(),
	} {
		if err := reg.Register(t); err != nil {
			slog.Error("registrar ferramenta", "id", t.ID(), "err", err)
		}
	}

	// OCR: registra a tool apenas se o tesseract estiver disponível
	if ocr.Available(ocr.DefaultConfig()) {
		if err := reg.Register(ocr.NewOCRTool(ocr.DefaultConfig())); err != nil {
			slog.Error("registrar ocr", "err", err)
		}
	}

	return reg
}

// startup é chamado pelo Wails ao iniciar.
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx

	dbPath := filepath.Join(dataDir(), "axisdoc.sqlite3")
	if err := os.MkdirAll(filepath.Dir(dbPath), 0o755); err != nil {
		slog.Error("criar diretório de dados", "err", err)
	}
	st, err := store.Open(dbPath)
	if err != nil {
		// sem panic: cai para banco em memória para o app continuar abrindo
		slog.Error("abrir banco, usando memória", "err", err)
		if st, err = store.Open(":memory:"); err != nil {
			slog.Error("banco em memória indisponível", "err", err)
			return
		}
	}
	a.store = st
	_ = st.Jobs().ResetRunning(ctx)

	wailsEmitter := &wailsEmitter{ctx: ctx}
	wailsDialogs := &wailsDialogs{ctx: ctx}
	a.manager = jobs.NewManager(a.registry, st.Jobs(), wailsEmitter, 2)
	a.jobSvc.manager = a.manager
	a.jobSvc.ctx = ctx
	a.jobSvc.repo = st.Jobs()
	a.sysSvc.ctx = ctx
	a.sysSvc.dialogs = wailsDialogs
	a.sysSvc.emitter = wailsEmitter

	searchSvc := search.NewService(st.Search())
	// registra a tool de indexação que usa o serviço
	if err := a.registry.Register(search.NewIndexTool(searchSvc)); err != nil {
		slog.Error("registrar search.index", "err", err)
	}
	a.searchSvc = &SearchService{repo: st.Search(), svc: searchSvc}

	pipelineRepo := pipeline.NewRepo(st.Settings())
	pipelineRunner := pipeline.NewRunner(a.registry)
	a.pipelineSvc.repo = pipelineRepo
	a.pipelineSvc.runner = pipelineRunner
	a.watchSvc.init(pipelineRunner)
}

// shutdown é chamado ao fechar o app.
func (a *App) shutdown(ctx context.Context) {
	if a.watchSvc != nil {
		a.watchSvc.stop()
	}
	if a.store != nil {
		_ = a.store.Close()
	}
}

// dataDir retorna o diretório de dados por SO.
// Modo portable (--portable): grava ao lado do executável.
func dataDir() string {
	if v := os.Getenv("AXISDOC_DATA_DIR"); v != "" {
		return v // testes e modo portable via env
	}
	for _, arg := range os.Args {
		if arg == "--portable" {
			exe, err := os.Executable()
			if err == nil {
				return filepath.Dir(exe)
			}
		}
	}
	base, err := os.UserConfigDir()
	if err != nil {
		base = "."
	}
	return filepath.Join(base, "axisdoc")
}

// runCLI tenta executar em modo CLI. Retorna true se consumiu os args.
func runCLI() bool {
	if len(os.Args) < 2 {
		return false
	}
	// registry mínimo para o CLI (sem store)
	reg := tool.NewRegistry()
	for _, t := range []tool.Tool{
		hashfile.New(),
		pdftools.NewPDFInfo(),
		pdftools.NewMergePDF(),
		pdftools.NewSplitPDF(),
		pdftools.NewRotatePDF(),
		pdftools.NewWatermarkPDF(),
		pdftools.NewCompressPDF(),
		pdftools.NewExtractTextPDF(),
		pdftools2.NewExtractImages(),
		pdftools2.NewExtractPages(),
		pdftools2.NewRemovePages(),
		pdftools2.NewExtractFonts(),
		pdftools2.NewExtractAttachments(),
		pdftools2.NewExtractMetadata(),
		pdftools2.NewPermissions(),
		pdftools2.NewComparePDFs(),
		pdftools2.NewAddAttachments(),
		pdftools2.NewImagesToPDF(),
		pdftools2.NewCreatePDF(),
		pdftools2.NewNUp(),
		pdftools3.NewRearrange(),
		pdftools3.NewProtect(),
		pdftools3.NewUnlock(),
		pdftools3.NewOverlay(),
		pdftools3.NewPageNumbers(),
		imgtools.NewConvertImage(),
		imgtools.NewResizeImage(),
		imgtools.NewWatermarkImage(),
		imgtools2.NewCrop(),
		imgtools2.NewTransform(),
		imgtools2.NewFilters(),
		imgtools2.NewIconGen(),
		imgtools2.NewGIFExtract(),
		imgtools2.NewGIFBuild(),
		imgtools2.NewWatermarkPos(),
		imgtools2.NewPalette(),
		datafiles.NewTabularConvert(),
		datafiles.NewSpreadsheetCompare(),
		datafiles.NewStructConvert(),
		datafiles.NewJSONFormat(),
		datafiles.NewTableToJSON(),
		datafiles2.NewCSVToSQL(),
		datafiles2.NewSQLToCSV(),
		datafiles2.NewJSONToTable(),
		texttools.NewTextDiff(),
		texttools.NewBatchRename(),
		texttools.NewTextStats(),
		texttools.NewQRCode(),
		texttools.NewBarcodeTool(),
		texttools2.NewLorem(),
		texttools2.NewBaseConvert(),
		texttools2.NewEpoch(),
		texttools2.NewUUID(),
		texttools2.NewSlug(),
		texttools2.NewColumnize(),
		texttools2.NewEscape(),
	} {
		_ = reg.Register(t)
	}
	ok, res, err := cli.Run(os.Args[1:], reg, dataDir())
	if !ok {
		return false
	}
	if err != nil {
		fmt.Fprintln(os.Stderr, "erro:", err)
		os.Exit(1)
	}
	if res != nil && res.Message != "" && res.Message != "ok" {
		fmt.Println(res.Message)
	}
	return true
}

// wailsEmitter adapta o runtime do Wails à interface runtimei.Emitter.
type wailsEmitter struct{ ctx context.Context }

func (e *wailsEmitter) Emit(event string, data any) {
	wruntime.EventsEmit(e.ctx, event, data)
}

// wailsDialogs adapta diálogos do Wails.
type wailsDialogs struct{ ctx context.Context }

func (d *wailsDialogs) OpenFiles() ([]string, error) {
	return wruntime.OpenMultipleFilesDialog(d.ctx, wruntime.OpenDialogOptions{
		Title: "Selecionar arquivos",
	})
}

func (d *wailsDialogs) OpenFolder() (string, error) {
	return wruntime.OpenDirectoryDialog(d.ctx, wruntime.OpenDialogOptions{
		Title: "Selecionar pasta",
	})
}

func (d *wailsDialogs) SaveFile(defaultName string) (string, error) {
	return wruntime.SaveFileDialog(d.ctx, wruntime.SaveDialogOptions{
		Title:           "Salvar arquivo",
		DefaultFilename: defaultName,
	})
}

var _ runtimei.Dialogs = (*wailsDialogs)(nil)
var _ runtimei.Emitter = (*wailsEmitter)(nil)

// ToolService expõe o registry ao frontend.
type ToolService struct{ reg *tool.Registry }

// ToolInfo é o metadado de ferramenta enviado ao frontend.
type ToolInfo struct {
	ID        string       `json:"id"`
	Category  string       `json:"category"`
	TitleKey  string       `json:"titleKey"`
	DescKey   string       `json:"descKey"`
	Icon      string       `json:"icon"`
	StepNames []string     `json:"stepNames"`
	Params    []tool.Param `json:"params"`
}

// ListTools lista as ferramentas registradas. Nunca retorna null;
// Params nil vira [] para o frontend iterar sem guard.
func (s *ToolService) ListTools() []ToolInfo {
	tools := s.reg.List()
	out := make([]ToolInfo, 0, len(tools))
	for _, t := range tools {
		steps := t.Steps()
		names := make([]string, 0, len(steps))
		for _, st := range steps {
			names = append(names, st.Name())
		}
		params := t.Params()
		if params == nil {
			params = []tool.Param{}
		}
		out = append(out, ToolInfo{
			ID: t.ID(), Category: t.Category(), TitleKey: t.Title(),
			DescKey: t.Description(), Icon: t.Icon(), StepNames: names,
			Params: params,
		})
	}
	return out
}

// JobService expõe a fila de jobs ao frontend.
type JobService struct {
	ctx     context.Context
	manager *jobs.Manager
	repo    *store.JobRepo
}

// Enqueue cria um job.
func (s *JobService) Enqueue(toolID string, input map[string]any) (*store.Job, error) {
	return s.manager.Enqueue(s.ctx, toolID, input)
}

// Cancel cancela um job.
func (s *JobService) Cancel(id string) error {
	return s.manager.Cancel(id)
}

// ListJobs lista jobs recentes. Nunca retorna null.
func (s *JobService) ListJobs(limit int) ([]*store.Job, error) {
	list, err := s.repo.List(s.ctx, limit)
	if err != nil {
		return nil, err
	}
	if list == nil {
		return []*store.Job{}, nil
	}
	return list, nil
}

// DeleteJob remove um job do histórico.
func (s *JobService) DeleteJob(id string) error {
	return s.repo.Delete(s.ctx, id)
}

// ClearHistory limpa todo o histórico de jobs.
func (s *JobService) ClearHistory() error {
	return s.repo.ClearHistory(s.ctx)
}

// SystemService expõe diálogos e utilidades de sistema.
type SystemService struct {
	ctx     context.Context
	dialogs runtimei.Dialogs
	emitter runtimei.Emitter
}

// PickFiles abre o seletor de arquivos.
func (s *SystemService) PickFiles() ([]string, error) {
	return s.dialogs.OpenFiles()
}

// PickFolder abre o seletor de pastas.
func (s *SystemService) PickFolder() (string, error) {
	return s.dialogs.OpenFolder()
}

// SavePath abre o diálogo de salvar e retorna o caminho.
func (s *SystemService) SavePath(defaultName string) (string, error) {
	return s.dialogs.SaveFile(defaultName)
}

// OpenPath abre um arquivo com o programa padrão do SO.
func (s *SystemService) OpenPath(path string) error {
	return openPathSys(path)
}

// RevealInFolder abre o gerenciador de arquivos destacando o arquivo.
func (s *SystemService) RevealInFolder(path string) error {
	return revealSys(path)
}

// Version retorna a versão do app.
func (s *SystemService) Version() string { return "0.2.0" }

// Ping verifica comunicação com o backend (usado em smoke tests).
func (s *SystemService) Ping() string { return "pong" }

// CheckUpdate consulta o GitHub Releases (sem telemetria; falha de rede é silenciosa).
func (s *SystemService) CheckUpdate() (bool, string, error) {
	c := update.NewChecker("ferna", "axisdoc", "0.2.0")
	rel, err := c.Latest(context.Background())
	if err != nil {
		return false, "", nil // offline: ignora silenciosamente
	}
	if c.HasNew(rel) {
		return true, rel.TagName, nil
	}
	return false, "", nil
}

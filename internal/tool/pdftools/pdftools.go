// Package pdftools implementa as ferramentas de manipulação de PDF (pdfcpu).
package pdftools

import (
	"bytes"
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/ledongthuc/pdf"
	"github.com/pdfcpu/pdfcpu/pkg/api"
	"github.com/pdfcpu/pdfcpu/pkg/pdfcpu/model"
	"github.com/pdfcpu/pdfcpu/pkg/pdfcpu/types"

	"github.com/ferna/axisdoc/internal/output"
	"github.com/ferna/axisdoc/internal/tool"
)

// base compartilha metadados das ferramentas de PDF.
type base struct {
	id, cat, title, desc, icon string
}

func (b base) ID() string          { return b.id }
func (b base) Category() string    { return b.cat }
func (b base) Title() string       { return b.title }
func (b base) Description() string { return b.desc }
func (b base) Icon() string        { return b.icon }

// stepAdapter adapta uma função para tool.Step.
type stepAdapter struct {
	name  string
	runFn func(ctx context.Context, in tool.Input, report func(pct float64)) (tool.Output, error)
}

func (s stepAdapter) Name() string { return s.name }
func (s stepAdapter) Run(ctx context.Context, in tool.Input, report func(pct float64)) (tool.Output, error) {
	return s.runFn(ctx, in, report)
}

func newStep(name string, fn func(ctx context.Context, in tool.Input, report func(pct float64)) (tool.Output, error)) tool.Step {
	return stepAdapter{name: name, runFn: fn}
}

func tempWork() (string, func(), error) {
	dir, err := output.TempDir()
	return dir, func() { os.RemoveAll(dir) }, err
}

func fileStem(p string) string {
	baseName := filepath.Base(p)
	if i := strings.LastIndexByte(baseName, '.'); i > 0 {
		return baseName[:i]
	}
	return baseName
}

// PDFInfo retorna metadados de um PDF.
type PDFInfo struct{ base }

func NewPDFInfo() *PDFInfo {
	return &PDFInfo{base{"pdf.info", "pdf", "tool.pdfinfo.title", "tool.pdfinfo.desc", "file-info"}}
}

func (t *PDFInfo) Params() []tool.Param { return nil }

func (t *PDFInfo) Steps() []tool.Step {
	return []tool.Step{newStep("step.pdf.info", t.run)}
}

func (t *PDFInfo) run(_ context.Context, in tool.Input, _ func(pct float64)) (tool.Output, error) {
	if len(in.Paths) == 0 {
		return tool.Output{}, fmt.Errorf("pdf.info: nenhum arquivo")
	}
	var sb strings.Builder
	for _, p := range in.Paths {
		f, err := os.Open(p)
		if err != nil {
			fmt.Fprintf(&sb, "ERRO %s: %v\n", filepath.Base(p), err)
			continue
		}
		info, err := api.PDFInfo(f, filepath.Base(p), nil, false, nil)
		f.Close()
		if err != nil {
			fmt.Fprintf(&sb, "ERRO %s: %v\n", filepath.Base(p), err)
			continue
		}
		fmt.Fprintf(&sb, "%s\n  páginas: %d | versão: %s | criptografado: %v\n",
			filepath.Base(p), info.PageCount, info.Version, info.Encrypted)
	}
	return tool.Output{Message: strings.TrimRight(sb.String(), "\n")}, nil
}

// MergePDF junta vários PDFs em um.
type MergePDF struct{ base }

func NewMergePDF() *MergePDF {
	return &MergePDF{base{"pdf.merge", "pdf", "tool.pdfmerge.title", "tool.pdfmerge.desc", "file-plus-2"}}
}

func (t *MergePDF) Params() []tool.Param {
	return []tool.Param{
		{Key: "outputPath", Label: "param.outputPath.label", Type: tool.ParamOutput, Default: "merged.pdf",
			Hint: "param.pdfmerge.output.hint"},
	}
}

func (t *MergePDF) Steps() []tool.Step {
	return []tool.Step{newStep("step.pdf.merge", t.run)}
}

func (t *MergePDF) run(_ context.Context, in tool.Input, _ func(pct float64)) (tool.Output, error) {
	if len(in.Paths) < 2 {
		return tool.Output{}, fmt.Errorf("pdf.merge: selecione ao menos 2 PDFs")
	}
	dest := tool.ParamString(in, "outputPath", "")
	if dest == "" {
		dest = filepath.Join(tool.OutputDir(in), "merged.pdf")
	}
	dest = output.NextAvailablePath(dest)
	if err := api.MergeCreateFile(in.Paths, dest, false, nil); err != nil {
		return tool.Output{}, fmt.Errorf("pdf.merge: %w", err)
	}
	return tool.Output{
		Paths:   []string{dest},
		Message: fmt.Sprintf("mesclados %d PDFs em %s", len(in.Paths), filepath.Base(dest)),
	}, nil
}

// SplitPDF divide um PDF em blocos de páginas.
type SplitPDF struct{ base }

func NewSplitPDF() *SplitPDF {
	return &SplitPDF{base{"pdf.split", "pdf", "tool.pdfsplit.title", "tool.pdfsplit.desc", "scissors"}}
}

func (t *SplitPDF) Params() []tool.Param {
	return []tool.Param{
		{Key: "mode", Label: "param.pdf.splitmode.label", Type: tool.ParamSelect,
			Options: []string{"pages", "everyN"}, Default: "everyN", Widget: tool.WidgetSegmented},
		{Key: "n", Label: "param.pdf.n.label", Type: tool.ParamNumber, Default: 1, Min: 1, Max: 1000,
			VisibleIf: &tool.VisibleIf{Key: "mode", Equals: "everyN"}},
	}
}

func (t *SplitPDF) Steps() []tool.Step {
	return []tool.Step{newStep("step.pdf.split", t.run)}
}

func (t *SplitPDF) run(_ context.Context, in tool.Input, report func(pct float64)) (tool.Output, error) {
	if len(in.Paths) == 0 {
		return tool.Output{}, fmt.Errorf("pdf.split: nenhum arquivo")
	}
	mode := tool.ParamString(in, "mode", "everyN")
	n := int(tool.ParamFloat(in, "n", 1))
	if n < 1 {
		n = 1
	}
	span := n
	if mode == "pages" {
		span = 1
	}
	var outs []string
	for i, p := range in.Paths {
		work, cleanup, err := tempWork()
		if err != nil {
			return tool.Output{}, err
		}
		tmpOut := filepath.Join(work, "out")
		if err := os.MkdirAll(tmpOut, 0o755); err != nil {
			cleanup()
			return tool.Output{}, err
		}
		if err := api.SplitFile(p, tmpOut, span, nil); err != nil {
			cleanup()
			return tool.Output{}, fmt.Errorf("pdf.split: %w", err)
		}
		finalDir := filepath.Join(tool.OutputDir(in), fmt.Sprintf("%s_%s", fileStem(p), splitDirSuffix(mode, n)))
		if err := os.MkdirAll(finalDir, 0o755); err != nil {
			cleanup()
			return tool.Output{}, err
		}
		entries, err := os.ReadDir(tmpOut)
		if err != nil {
			cleanup()
			return tool.Output{}, fmt.Errorf("pdf.split: %w", err)
		}
		for _, e := range entries {
			dest := output.NextAvailablePath(filepath.Join(finalDir, e.Name()))
			if err := output.CopyFile(filepath.Join(tmpOut, e.Name()), dest); err != nil {
				cleanup()
				return tool.Output{}, err
			}
			outs = append(outs, dest)
		}
		cleanup()
		if report != nil {
			report(float64(i+1) / float64(len(in.Paths)) * 100)
		}
	}
	return tool.Output{Paths: outs, Message: fmt.Sprintf("%d arquivo(s) gerado(s)", len(outs))}, nil
}

func splitDirSuffix(mode string, n int) string {
	if mode == "everyN" && n > 1 {
		return fmt.Sprintf("cada%d", n)
	}
	return "paginas"
}

// RotatePDF gira páginas de um PDF.
type RotatePDF struct{ base }

func NewRotatePDF() *RotatePDF {
	return &RotatePDF{base{"pdf.rotate", "pdf", "tool.pdfrotate.title", "tool.pdfrotate.desc", "rotate-cw"}}
}

func (t *RotatePDF) Params() []tool.Param {
	return []tool.Param{
		{Key: "angle", Label: "param.pdf.angle.label", Type: tool.ParamSelect, Options: []string{"90", "180", "270"}, Default: "90",
			Widget: tool.WidgetSegmented},
	}
}

func (t *RotatePDF) Steps() []tool.Step {
	return []tool.Step{newStep("step.pdf.rotate", t.run)}
}

func (t *RotatePDF) run(_ context.Context, in tool.Input, _ func(pct float64)) (tool.Output, error) {
	if len(in.Paths) == 0 {
		return tool.Output{}, fmt.Errorf("pdf.rotate: nenhum arquivo")
	}
	angle := int(tool.ParamFloat(in, "angle", 90))
	var outs []string
	for _, p := range in.Paths {
		dest := output.NextAvailablePath(filepath.Join(tool.OutputDir(in), fmt.Sprintf("%s_rot%d.pdf", fileStem(p), angle)))
		if err := api.RotateFile(p, dest, angle, nil, nil); err != nil {
			return tool.Output{}, fmt.Errorf("pdf.rotate: %w", err)
		}
		outs = append(outs, dest)
	}
	return tool.Output{Paths: outs, Message: fmt.Sprintf("%d arquivo(s) girado(s) %d°", len(outs), angle)}, nil
}

// WatermarkPDF aplica marca d'água de texto.
type WatermarkPDF struct{ base }

func NewWatermarkPDF() *WatermarkPDF {
	return &WatermarkPDF{base{"pdf.watermark", "pdf", "tool.pdfwm.title", "tool.pdfwm.desc", "stamp"}}
}

func (t *WatermarkPDF) Params() []tool.Param {
	return []tool.Param{
		{Key: "text", Label: "param.pdf.text.label", Type: tool.ParamText, Required: true, Default: "CONFIDENCIAL",
			Placeholder: "param.pdfwm.placeholder"},
		{Key: "fontSize", Label: "param.pdf.fontsize.label", Type: tool.ParamNumber, Default: 48, Min: 6, Max: 200,
			Widget: tool.WidgetSlider},
	}
}

func (t *WatermarkPDF) Steps() []tool.Step {
	return []tool.Step{newStep("step.pdf.watermark", t.run)}
}

func (t *WatermarkPDF) run(_ context.Context, in tool.Input, _ func(pct float64)) (tool.Output, error) {
	if len(in.Paths) == 0 {
		return tool.Output{}, fmt.Errorf("pdf.watermark: nenhum arquivo")
	}
	text := tool.ParamString(in, "text", "CONFIDENCIAL")
	fontSize := int(tool.ParamFloat(in, "fontSize", 48))
	desc := "rot:45, opacity:0.3, pos:c"
	wm, err := api.TextWatermark(text, desc, true, false, types.POINTS)
	if err != nil {
		return tool.Output{}, fmt.Errorf("pdf.watermark: %w", err)
	}
	wm.FontSize = fontSize
	var outs []string
	for _, p := range in.Paths {
		dest := output.NextAvailablePath(filepath.Join(tool.OutputDir(in), fmt.Sprintf("%s_wm.pdf", fileStem(p))))
		if err := api.AddWatermarksFile(p, dest, nil, wm, nil); err != nil {
			return tool.Output{}, fmt.Errorf("pdf.watermark: %w", err)
		}
		outs = append(outs, dest)
	}
	return tool.Output{Paths: outs, Message: fmt.Sprintf("marca d'água aplicada em %d arquivo(s)", len(outs))}, nil
}

// CompressPDF otimiza/comprime um PDF.
type CompressPDF struct{ base }

func NewCompressPDF() *CompressPDF {
	return &CompressPDF{base{"pdf.compress", "pdf", "tool.pdfcompress.title", "tool.pdfcompress.desc", "minimize-2"}}
}

func (t *CompressPDF) Params() []tool.Param {
	return []tool.Param{
		{Key: "level", Label: "param.pdf.compress.label", Type: tool.ParamSelect,
			Options: []string{"balanced", "max"}, Default: "balanced",
			Widget: tool.WidgetSegmented, Hint: "param.pdf.compress.hint"},
	}
}

func (t *CompressPDF) Steps() []tool.Step {
	return []tool.Step{newStep("step.pdf.compress", t.run)}
}

func (t *CompressPDF) run(_ context.Context, in tool.Input, _ func(pct float64)) (tool.Output, error) {
	if len(in.Paths) == 0 {
		return tool.Output{}, fmt.Errorf("pdf.compress: nenhum arquivo")
	}
	var outs []string
	var sb strings.Builder
	for _, p := range in.Paths {
		dest := output.NextAvailablePath(filepath.Join(tool.OutputDir(in), fmt.Sprintf("%s_compact.pdf", fileStem(p))))
		before := fileSize(p)
		conf := model.NewDefaultConfiguration()
		if tool.ParamString(in, "level", "balanced") == "max" {
			// modo máximo: validação relaxada foca em tamanho
			conf.ValidationMode = model.ValidationRelaxed
		}
		if err := api.OptimizeFile(p, dest, conf); err != nil {
			return tool.Output{}, fmt.Errorf("pdf.compress: %w", err)
		}
		after := fileSize(dest)
		outs = append(outs, dest)
		fmt.Fprintf(&sb, "%s: %s → %s\n", filepath.Base(p), humanSize(before), humanSize(after))
	}
	return tool.Output{Paths: outs, Message: strings.TrimRight(sb.String(), "\n")}, nil
}

// ExtractTextPDF extrai texto de um PDF.
type ExtractTextPDF struct{ base }

func NewExtractTextPDF() *ExtractTextPDF {
	return &ExtractTextPDF{base{"pdf.extracttext", "pdf", "tool.pdfextract.title", "tool.pdfextract.desc", "file-text"}}
}

func (t *ExtractTextPDF) Params() []tool.Param { return nil }

func (t *ExtractTextPDF) Steps() []tool.Step {
	return []tool.Step{newStep("step.pdf.extracttext", t.run)}
}

func (t *ExtractTextPDF) run(_ context.Context, in tool.Input, _ func(pct float64)) (tool.Output, error) {
	if len(in.Paths) == 0 {
		return tool.Output{}, fmt.Errorf("pdf.extracttext: nenhum arquivo")
	}
	var sb strings.Builder
	for _, p := range in.Paths {
		text, err := extractPDFText(p)
		if err != nil {
			fmt.Fprintf(&sb, "ERRO %s: %v\n", filepath.Base(p), err)
			continue
		}
		fmt.Fprintf(&sb, "=== %s ===\n%s\n", filepath.Base(p), text)
	}
	return tool.Output{Message: strings.TrimRight(sb.String(), "\n")}, nil
}

// ExtractTextFile extrai o texto de um arquivo PDF (exportado para busca M4).
func ExtractTextFile(path string) (string, error) {
	return extractPDFText(path)
}

func extractPDFText(path string) (string, error) {
	f, r, err := pdf.Open(path)
	if err != nil {
		return "", err
	}
	defer f.Close()
	var sb strings.Builder
	total := r.NumPage()
	for i := 1; i <= total; i++ {
		page := r.Page(i)
		if page.V.IsNull() {
			continue
		}
		content := page.Content()
		for _, txt := range content.Text {
			sb.WriteString(txt.S)
		}
		sb.WriteString("\n")
	}
	return strings.TrimSpace(sb.String()), nil
}

func fileSize(p string) int64 {
	st, err := os.Stat(p)
	if err != nil {
		return 0
	}
	return st.Size()
}

func humanSize(b int64) string {
	const kb, mb = 1 << 10, 1 << 20
	switch {
	case b >= mb:
		return fmt.Sprintf("%.1f MB", float64(b)/mb)
	case b >= kb:
		return fmt.Sprintf("%.1f KB", float64(b)/kb)
	default:
		return fmt.Sprintf("%d B", b)
	}
}

// bytesReader helper mantido para futuras features de memória.
var _ = bytes.NewReader

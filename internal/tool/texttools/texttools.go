// Package texttools implementa diff, batch rename, contagem de texto e QR/barcode.
package texttools

import (
	"bytes"
	"context"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"

	"github.com/boombuler/barcode"
	"github.com/boombuler/barcode/code128"
	"github.com/boombuler/barcode/ean"
	"github.com/sergi/go-diff/diffmatchpatch"
	"github.com/skip2/go-qrcode"

	"github.com/ferna/axisdoc/internal/output"
	"github.com/ferna/axisdoc/internal/store"
	"github.com/ferna/axisdoc/internal/tool"
)

func fileStem(p string) string {
	baseName := filepath.Base(p)
	if i := strings.LastIndexByte(baseName, '.'); i > 0 {
		return baseName[:i]
	}
	return baseName
}

type base struct {
	id, cat, title, desc, icon string
}

func (b base) ID() string          { return b.id }
func (b base) Category() string    { return b.cat }
func (b base) Title() string       { return b.title }
func (b base) Description() string { return b.desc }
func (b base) Icon() string        { return b.icon }

type stepFunc struct {
	name  string
	runFn func(ctx context.Context, in tool.Input, report func(pct float64)) (tool.Output, error)
}

func (s stepFunc) Name() string { return s.name }
func (s stepFunc) Run(ctx context.Context, in tool.Input, report func(pct float64)) (tool.Output, error) {
	return s.runFn(ctx, in, report)
}

// TextDiff compara dois arquivos de texto.
type TextDiff struct{ base }

func NewTextDiff() *TextDiff {
	return &TextDiff{base{"text.diff", "text", "tool.diff.title", "tool.diff.desc", "git-compare"}}
}

func (t *TextDiff) Params() []tool.Param { return nil }

func (t *TextDiff) Steps() []tool.Step {
	return []tool.Step{stepFunc{"step.text.diff", t.run}}
}

func (t *TextDiff) run(_ context.Context, in tool.Input, _ func(pct float64)) (tool.Output, error) {
	if len(in.Paths) != 2 {
		return tool.Output{}, fmt.Errorf("textdiff: selecione exatamente 2 arquivos")
	}
	a, err := os.ReadFile(in.Paths[0])
	if err != nil {
		return tool.Output{}, err
	}
	b, err := os.ReadFile(in.Paths[1])
	if err != nil {
		return tool.Output{}, err
	}
	dmp := diffmatchpatch.New()
	// diffs por linha
	chars1, chars2, lines := dmp.DiffLinesToChars(string(a), string(b))
	diffs := dmp.DiffMain(chars1, chars2, false)
	diffs = dmp.DiffCharsToLines(diffs, lines)

	var sb strings.Builder
	ins, del := 0, 0
	for _, d := range diffs {
		switch d.Type {
		case diffmatchpatch.DiffInsert:
			ins++
			fmt.Fprintf(&sb, "+ %s", truncateLines(d.Text, 5))
		case diffmatchpatch.DiffDelete:
			del++
			fmt.Fprintf(&sb, "- %s", truncateLines(d.Text, 5))
		}
	}
	if ins == 0 && del == 0 {
		return tool.Output{Message: "arquivos idênticos"}, nil
	}
	return tool.Output{
		Message: fmt.Sprintf("%s vs %s: +%d/-%d blocos\n%s",
			filepath.Base(in.Paths[0]), filepath.Base(in.Paths[1]), ins, del, sb.String()),
	}, nil
}

func truncateLines(text string, max int) string {
	lines := strings.Split(strings.TrimRight(text, "\n"), "\n")
	if len(lines) > max {
		lines = append(lines[:max], fmt.Sprintf("... (+%d linhas)", len(lines)-max))
	}
	var sb strings.Builder
	for _, l := range lines {
		if len(l) > 100 {
			l = l[:100] + "…"
		}
		sb.WriteString(l + "\n")
	}
	return sb.String()
}

// BatchRename renomeia arquivos em lote com regex, com backup para undo.
type BatchRename struct {
	base
	Backups *store.BackupRepo
}

func NewBatchRename() *BatchRename {
	return &BatchRename{base: base{"text.rename", "text", "tool.rename.title", "tool.rename.desc", "pencil"}}
}

// SetBackups injeta o repositório de backups (para undo).
func (t *BatchRename) SetBackups(b *store.BackupRepo) *BatchRename {
	t.Backups = b
	return t
}

func (t *BatchRename) Params() []tool.Param {
	return []tool.Param{
		{Key: "pattern", Label: "param.text.pattern.label", Type: tool.ParamText, Required: true, Default: "(.*)"},
		{Key: "replacement", Label: "param.text.replacement.label", Type: tool.ParamText, Required: true, Default: "$1"},
		{Key: "undo", Label: "param.text.undo.label", Type: tool.ParamBool, Default: false},
	}
}

func (t *BatchRename) Steps() []tool.Step {
	return []tool.Step{stepFunc{"step.text.rename", t.run}}
}

type renameOp struct{ from, to string }

func (t *BatchRename) run(_ context.Context, in tool.Input, report func(pct float64)) (tool.Output, error) {
	pattern := tool.ParamString(in, "pattern", "")
	replacement := tool.ParamString(in, "replacement", "")
	undo := tool.ParamBoolValue(in, "undo", false)
	if len(in.Paths) == 0 {
		return tool.Output{}, fmt.Errorf("batchrename: nenhum arquivo")
	}
	if undo {
		return t.undo(in.Paths, report)
	}
	if pattern == "" {
		return tool.Output{}, fmt.Errorf("batchrename: pattern obrigatório")
	}
	re, err := regexp.Compile(pattern)
	if err != nil {
		return tool.Output{}, fmt.Errorf("batchrename: regex inválida: %w", err)
	}

	ops := make([]renameOp, 0, len(in.Paths))
	for _, p := range in.Paths {
		dir := filepath.Dir(p)
		name := filepath.Base(p)
		ext := filepath.Ext(name)
		stem := strings.TrimSuffix(name, ext)
		newName := re.ReplaceAllString(stem, replacement) + ext
		if newName != name && newName != "" && !strings.ContainsAny(newName, `/\`) {
			ops = append(ops, renameOp{from: p, to: filepath.Join(dir, newName)})
		}
	}

	var sb strings.Builder
	applied := 0
	for i, op := range ops {
		if _, err := os.Stat(op.to); err == nil {
			fmt.Fprintf(&sb, "PULADO (existe destino): %s\n", op.to)
			continue
		}
		if t.Backups != nil {
			_ = t.Backups.SaveFile(context.Background(), "rename", op.from)
		}
		if err := os.Rename(op.from, op.to); err != nil {
			fmt.Fprintf(&sb, "ERRO %s: %v\n", op.from, err)
			continue
		}
		applied++
		fmt.Fprintf(&sb, "%s → %s\n", filepath.Base(op.from), filepath.Base(op.to))
		if report != nil {
			report(float64(i+1) / float64(len(ops)) * 100)
		}
	}
	return tool.Output{
		Message: fmt.Sprintf("%d renomeado(s)\n%s", applied, sb.String()),
	}, nil
}

// undo restaura os nomes a partir do último backup por caminho.
func (t *BatchRename) undo(paths []string, report func(pct float64)) (tool.Output, error) {
	if t.Backups == nil {
		return tool.Output{}, fmt.Errorf("batchrename: backup indisponível no modo CLI")
	}
	var sb strings.Builder
	applied := 0
	for i, p := range paths {
		if err := t.Backups.Restore(context.Background(), p); err != nil {
			fmt.Fprintf(&sb, "ERRO %s: %v\n", p, err)
			continue
		}
		applied++
		if report != nil {
			report(float64(i+1) / float64(len(paths)) * 100)
		}
	}
	return tool.Output{Message: fmt.Sprintf("%d restaurado(s)", applied)}, nil
}

// TextStats conta linhas, palavras e caracteres.
type TextStats struct{ base }

func NewTextStats() *TextStats {
	return &TextStats{base{"text.stats", "text", "tool.stats.title", "tool.stats.desc", "list"}}
}

func (t *TextStats) Params() []tool.Param { return nil }

func (t *TextStats) Steps() []tool.Step {
	return []tool.Step{stepFunc{"step.text.stats", t.run}}
}

func (t *TextStats) run(_ context.Context, in tool.Input, _ func(pct float64)) (tool.Output, error) {
	if len(in.Paths) == 0 {
		return tool.Output{}, fmt.Errorf("textstats: nenhum arquivo")
	}
	var sb strings.Builder
	for _, p := range in.Paths {
		data, err := os.ReadFile(p)
		if err != nil {
			fmt.Fprintf(&sb, "ERRO %s: %v\n", p, err)
			continue
		}
		lines := bytes.Count(data, []byte("\n"))
		if len(data) > 0 && data[len(data)-1] != '\n' {
			lines++
		}
		words := len(strings.Fields(string(data)))
		fmt.Fprintf(&sb, "%s: %d linhas, %d palavras, %d caracteres\n", filepath.Base(p), lines, words, len(data))
	}
	return tool.Output{Message: strings.TrimRight(sb.String(), "\n")}, nil
}

// QRCode gera QR code a partir de texto.
type QRCode struct{ base }

func NewQRCode() *QRCode {
	return &QRCode{base{"text.qrcode", "text", "tool.qrcode.title", "tool.qrcode.desc", "qr-code"}}
}

func (t *QRCode) Params() []tool.Param {
	return []tool.Param{
		{Key: "text", Label: "param.pdf.text.label", Type: tool.ParamTextarea, Required: true,
			Placeholder: "param.qrcode.placeholder", Hint: "param.qrcode.hint"},
		{Key: "size", Label: "param.img.qrsize.label", Type: tool.ParamNumber, Default: 256, Min: 64, Max: 2000,
			Widget: tool.WidgetSlider},
	}
}

func (t *QRCode) Steps() []tool.Step {
	return []tool.Step{stepFunc{"step.text.qrcode", t.run}}
}

func (t *QRCode) run(_ context.Context, in tool.Input, _ func(pct float64)) (tool.Output, error) {
	text := tool.ParamString(in, "text", "")
	if text == "" {
		return tool.Output{}, fmt.Errorf("qrcode: texto obrigatório")
	}
	size := int(tool.ParamFloat(in, "size", 256))
	pngBytes, err := qrcode.Encode(text, qrcode.Medium, size)
	if err != nil {
		return tool.Output{}, fmt.Errorf("qrcode: %w", err)
	}
	dest := output.NextAvailablePath(filepath.Join(destDir(in), "qrcode.png"))
	if err := output.WriteFile(dest, pngBytes); err != nil {
		return tool.Output{}, err
	}
	return tool.Output{Paths: []string{dest}, Message: "QR code gerado: " + dest}, nil
}

func destDir(in tool.Input) string {
	return tool.OutputDir(in)
}

// Barcode gera código de barras CODE-128 ou EAN-13.
type BarcodeTool struct{ base }

func NewBarcodeTool() *BarcodeTool {
	return &BarcodeTool{base{"text.barcode", "text", "tool.barcode.title", "tool.barcode.desc", "scan-barcode"}}
}

func (t *BarcodeTool) Params() []tool.Param {
	return []tool.Param{
		{Key: "text", Label: "param.pdf.text.label", Type: tool.ParamTextarea, Required: true,
			Placeholder: "param.barcode.placeholder", Hint: "param.barcode.hint"},
		{Key: "kind", Label: "param.text.barkind.label", Type: tool.ParamSelect,
			Options: []string{"code128", "ean13"}, Default: "code128", Widget: tool.WidgetSegmented},
		{Key: "width", Label: "param.img.width.label", Type: tool.ParamNumber, Default: 400, Min: 50, Max: 4000,
			Widget: tool.WidgetSlider},
		{Key: "height", Label: "param.img.height.label", Type: tool.ParamNumber, Default: 100, Min: 20, Max: 1000,
			Widget: tool.WidgetSlider},
	}
}

func (t *BarcodeTool) Steps() []tool.Step {
	return []tool.Step{stepFunc{"step.text.barcode", t.run}}
}

func (t *BarcodeTool) run(_ context.Context, in tool.Input, _ func(pct float64)) (tool.Output, error) {
	text := tool.ParamString(in, "text", "")
	if text == "" {
		return tool.Output{}, fmt.Errorf("barcode: texto obrigatório")
	}
	bc, err := MakeBarcode(in.Params)
	if err != nil {
		return tool.Output{}, fmt.Errorf("barcode: %w", err)
	}
	dest := output.NextAvailablePath(filepath.Join(destDir(in), fmt.Sprintf("barcode_%s.png", text)))
	if err := output.WriteImagePNG(dest, bc); err != nil {
		return tool.Output{}, err
	}
	return tool.Output{Paths: []string{dest}, Message: "código de barras gerado: " + dest}, nil
}

// MakeBarcode monta e escala o código de barras a partir dos params
// (exportado para preview no frontend sem gravar arquivo).
func MakeBarcode(params map[string]any) (barcode.Barcode, error) {
	text, _ := params["text"].(string)
	kind, _ := params["kind"].(string)
	if kind == "" {
		kind = "code128"
	}
	w := numberParam(params, "width", 400)
	h := numberParam(params, "height", 100)

	var bc barcode.Barcode
	var err error
	switch kind {
	case "ean13":
		bc, err = ean.Encode(text)
	default:
		bc, err = code128.Encode(text)
	}
	if err != nil {
		return nil, err
	}
	return barcode.Scale(bc, w, h)
}

func numberParam(params map[string]any, key string, def int) int {
	switch v := params[key].(type) {
	case float64:
		return int(v)
	case int:
		return v
	}
	return def
}

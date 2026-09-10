// Package pdftools3 implementa a terceira leva de ferramentas de PDF (FASE B).
// Reordenar páginas (Collect com qualquer ordem/duplicatas), proteger e
// desbloquear com senha (AES), sobreposição de PDF e numeração de páginas.
package pdftools3

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/pdfcpu/pdfcpu/pkg/api"
	"github.com/pdfcpu/pdfcpu/pkg/pdfcpu/model"
	"github.com/pdfcpu/pdfcpu/pkg/pdfcpu/types"

	"github.com/ferna/axisdoc/internal/output"
	"github.com/ferna/axisdoc/internal/tool"
)

// base compartilha metadados.
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

func fileStem(p string) string {
	b := filepath.Base(p)
	if i := strings.LastIndexByte(b, '.'); i > 0 {
		return b[:i]
	}
	return b
}

func outputDirParam() tool.Param {
	return tool.Param{Key: "outputDir", Label: "param.outputDir.label", Type: tool.ParamFolder}
}

// ---- 1. Reorganizar páginas ----

type Rearrange struct{ base }

func NewRearrange() *Rearrange {
	return &Rearrange{base{"pdf.rearrange", "pdf", "tool.pdfrearrange.title", "tool.pdfrearrange.desc", "list-ordered"}}
}

func (t *Rearrange) Params() []tool.Param {
	return []tool.Param{
		{Key: "order", Label: "param.pdf.order.label", Type: tool.ParamText, Required: true, Default: "",
			Placeholder: "param.pdf.order.placeholder", Hint: "param.pdf.order.hint"},
	}
}

func (t *Rearrange) Steps() []tool.Step {
	return []tool.Step{stepFunc{"step.pdf.rearrange", t.run}}
}

// parseOrder converte "3,1,2" ou "3,1-2" em seleção pdfcpu (qualquer ordem, duplicatas ok).
// Exportado para o PdfEditService (editor visual).
func ParseOrder(spec string) ([]string, error) {
	return parseOrder(spec)
}

func parseOrder(spec string) ([]string, error) {
	tokens := strings.Split(strings.TrimSpace(spec), ",")
	if len(tokens) == 0 {
		return nil, fmt.Errorf("ordem vazia")
	}
	var out []string
	for _, tok := range tokens {
		tok = strings.TrimSpace(tok)
		if tok == "" {
			return nil, fmt.Errorf("token vazio na ordem")
		}
		if !isPageSpec(tok) {
			return nil, fmt.Errorf("token inválido %q (use números ou ranges, ex.: 3,1-2)", tok)
		}
		out = append(out, tok)
	}
	return out, nil
}

func isPageSpec(tok string) bool {
	for _, r := range tok {
		if (r < '0' || r > '9') && r != '-' {
			return false
		}
	}
	return true
}

func (t *Rearrange) run(_ context.Context, in tool.Input, _ func(pct float64)) (tool.Output, error) {
	if len(in.Paths) == 0 {
		return tool.Output{}, fmt.Errorf("pdf.rearrange: nenhum arquivo")
	}
	sel, err := parseOrder(tool.ParamString(in, "order", ""))
	if err != nil {
		return tool.Output{}, fmt.Errorf("pdf.rearrange: %w", err)
	}
	var outs []string
	for _, p := range in.Paths {
		dest := output.NextAvailablePath(filepath.Join(tool.OutputDir(in), fmt.Sprintf("%s_ordem.pdf", fileStem(p))))
		if err := api.CollectFile(p, dest, sel, nil); err != nil {
			return tool.Output{}, fmt.Errorf("pdf.rearrange: %w", err)
		}
		outs = append(outs, dest)
	}
	return tool.Output{Paths: outs, Message: fmt.Sprintf("páginas reordenadas em %d arquivo(s)", len(outs))}, nil
}

// ---- 2. Proteger com senha ----

type Protect struct{ base }

func NewProtect() *Protect {
	return &Protect{base{"pdf.protect", "pdf", "tool.pdfprotect.title", "tool.pdfprotect.desc", "lock"}}
}

func (t *Protect) Params() []tool.Param {
	return []tool.Param{
		{Key: "userPassword", Label: "param.pdf.userpw.label", Type: tool.ParamPassword, Required: true, Default: "",
			Hint: "param.pdf.userpw.hint"},
		{Key: "ownerPassword", Label: "param.pdf.ownerpw.label", Type: tool.ParamPassword, Default: "",
			Placeholder: "param.pdf.ownerpw.placeholder"},
		{Key: "keyLength", Label: "param.pdf.keylen.label", Type: tool.ParamSelect,
			Options: []string{"40", "128", "256"}, Default: "256", Widget: tool.WidgetSegmented},
	}
}

func (t *Protect) Steps() []tool.Step {
	return []tool.Step{stepFunc{"step.pdf.protect", t.run}}
}

func keyLen(s string) int {
	switch s {
	case "40":
		return 40
	case "128":
		return 128
	default:
		return 256
	}
}

func (t *Protect) run(_ context.Context, in tool.Input, _ func(pct float64)) (tool.Output, error) {
	if len(in.Paths) == 0 {
		return tool.Output{}, fmt.Errorf("pdf.protect: nenhum arquivo")
	}
	userPW := tool.ParamString(in, "userPassword", "")
	if userPW == "" {
		return tool.Output{}, fmt.Errorf("pdf.protect: senha do usuário obrigatória")
	}
	ownerPW := tool.ParamString(in, "ownerPassword", userPW)
	var outs []string
	for _, p := range in.Paths {
		dest := output.NextAvailablePath(filepath.Join(tool.OutputDir(in), fmt.Sprintf("%s_protegido.pdf", fileStem(p))))
		conf := model.NewAESConfiguration(userPW, ownerPW, keyLen(tool.ParamString(in, "keyLength", "256")))
		if err := api.EncryptFile(p, dest, conf); err != nil {
			return tool.Output{}, fmt.Errorf("pdf.protect: %w", err)
		}
		outs = append(outs, dest)
	}
	return tool.Output{Paths: outs, Message: fmt.Sprintf("%d arquivo(s) protegido(s) com AES", len(outs))}, nil
}

// ---- 3. Desbloquear ----

type Unlock struct{ base }

func NewUnlock() *Unlock {
	return &Unlock{base{"pdf.unlock", "pdf", "tool.pdfunlock.title", "tool.pdfunlock.desc", "lock-open"}}
}

func (t *Unlock) Params() []tool.Param {
	return []tool.Param{
		{Key: "password", Label: "param.pdf.password.label", Type: tool.ParamPassword, Required: true, Default: ""},
	}
}

func (t *Unlock) Steps() []tool.Step {
	return []tool.Step{stepFunc{"step.pdf.unlock", t.run}}
}

func (t *Unlock) run(_ context.Context, in tool.Input, _ func(pct float64)) (tool.Output, error) {
	if len(in.Paths) == 0 {
		return tool.Output{}, fmt.Errorf("pdf.unlock: nenhum arquivo")
	}
	pw := tool.ParamString(in, "password", "")
	if pw == "" {
		return tool.Output{}, fmt.Errorf("pdf.unlock: informe a senha")
	}
	var outs []string
	for _, p := range in.Paths {
		dest := output.NextAvailablePath(filepath.Join(tool.OutputDir(in), fmt.Sprintf("%s_desbloqueado.pdf", fileStem(p))))
		conf := model.NewDefaultConfiguration()
		conf.UserPW = pw
		conf.OwnerPW = pw
		if err := api.DecryptFile(p, dest, conf); err != nil {
			return tool.Output{}, fmt.Errorf("pdf.unlock: senha incorreta ou PDF inválido: %w", err)
		}
		outs = append(outs, dest)
	}
	return tool.Output{Paths: outs, Message: fmt.Sprintf("%d arquivo(s) desbloqueado(s)", len(outs))}, nil
}

// ---- 4. Sobreposição (PDF sobre PDF) ----

type Overlay struct{ base }

func NewOverlay() *Overlay {
	return &Overlay{base{"pdf.overlay", "pdf", "tool.pdfoverlay.title", "tool.pdfoverlay.desc", "layers"}}
}

func (t *Overlay) Params() []tool.Param {
	return []tool.Param{
		{Key: "overlay", Label: "param.pdf.overlay.label", Type: tool.ParamFile, Required: true,
			Accept: []string{".pdf"}, Hint: "param.pdf.overlay.hint"},
		{Key: "onTop", Label: "param.pdf.ontop.label", Type: tool.ParamBool, Default: true,
			Widget: tool.WidgetSwitch},
	}
}

func (t *Overlay) Steps() []tool.Step {
	return []tool.Step{stepFunc{"step.pdf.overlay", t.run}}
}

func (t *Overlay) run(_ context.Context, in tool.Input, _ func(pct float64)) (tool.Output, error) {
	if len(in.Paths) == 0 {
		return tool.Output{}, fmt.Errorf("pdf.overlay: nenhum arquivo")
	}
	overlayPath := tool.ParamString(in, "overlay", "")
	if overlayPath == "" {
		return tool.Output{}, fmt.Errorf("pdf.overlay: informe o PDF de sobreposição")
	}
	if _, err := os.Stat(overlayPath); err != nil {
		return tool.Output{}, fmt.Errorf("pdf.overlay: sobreposição não encontrada: %w", err)
	}
	onTop := tool.ParamBoolValue(in, "onTop", true)
	wm, err := api.PDFWatermark(overlayPath, "pos:c, scale:1.0 rel", onTop, false, types.POINTS)
	if err != nil {
		return tool.Output{}, fmt.Errorf("pdf.overlay: %w", err)
	}
	var outs []string
	for _, p := range in.Paths {
		if p == overlayPath {
			continue
		}
		dest := output.NextAvailablePath(filepath.Join(tool.OutputDir(in), fmt.Sprintf("%s_overlay.pdf", fileStem(p))))
		if err := api.AddWatermarksFile(p, dest, nil, wm, nil); err != nil {
			return tool.Output{}, fmt.Errorf("pdf.overlay: %w", err)
		}
		outs = append(outs, dest)
	}
	if len(outs) == 0 {
		return tool.Output{}, fmt.Errorf("pdf.overlay: nenhum PDF base (selecione além da sobreposição)")
	}
	return tool.Output{Paths: outs, Message: fmt.Sprintf("sobreposição aplicada em %d arquivo(s)", len(outs))}, nil
}

// ---- 5. Numerar páginas ----

type PageNumbers struct{ base }

func NewPageNumbers() *PageNumbers {
	return &PageNumbers{base{"pdf.pagenumbers", "pdf", "tool.pdfpagenumbers.title", "tool.pdfpagenumbers.desc", "list-ordered"}}
}

func (t *PageNumbers) Params() []tool.Param {
	return []tool.Param{
		{Key: "start", Label: "param.pdf.numstart.label", Type: tool.ParamNumber, Default: 1, Min: 1, Max: 100000,
			Hint: "param.pdf.numstart.hint"},
		{Key: "position", Label: "param.img.position.label", Type: tool.ParamSelect,
			Options: []string{"bottomCenter", "bottomRight", "bottomLeft", "topCenter"}, Default: "bottomCenter",
			Widget: tool.WidgetSegmented},
		{Key: "fontSize", Label: "param.pdf.fontsize.label", Type: tool.ParamNumber, Default: 10, Min: 6, Max: 48,
			Widget: tool.WidgetSlider},
	}
}

func (t *PageNumbers) Steps() []tool.Step {
	return []tool.Step{stepFunc{"step.pdf.pagenumbers", t.run}}
}

// posValue mapeia posição para âncora pdfcpu.
func posValue(pos string) string {
	switch pos {
	case "topCenter":
		return "tc"
	case "bottomRight":
		return "br"
	case "bottomLeft":
		return "bl"
	default:
		return "bc"
	}
}

func (t *PageNumbers) run(_ context.Context, in tool.Input, _ func(pct float64)) (tool.Output, error) {
	if len(in.Paths) == 0 {
		return tool.Output{}, fmt.Errorf("pdf.pagenumbers: nenhum arquivo")
	}
	start := int(tool.ParamFloat(in, "start", 1))
	if start < 1 {
		start = 1
	}
	fontSize := int(tool.ParamFloat(in, "fontSize", 10))
	desc := fmt.Sprintf("position:%s, scalefactor:1.0 abs, font:Helvetica, points:%d", posValue(tool.ParamString(in, "position", "bottomCenter")), fontSize)
	var outs []string
	for _, p := range in.Paths {
		count := pageCount(p)
		if count <= 0 {
			return tool.Output{}, fmt.Errorf("pdf.pagenumbers: não foi possível ler %s", filepath.Base(p))
		}
		if err := applyPageNumbers(p, count, start, desc, fontSize, tool.OutputDir(in)); err != nil {
			return tool.Output{}, err
		}
		outs = append(outs, lastApplied)
	}
	return tool.Output{Paths: outs, Message: fmt.Sprintf("numeração aplicada em %d arquivo(s)", len(outs))}, nil
}

// lastApplied guarda o destino da última aplicação (fluxo single-thread por job).
var lastApplied string

// applyPageNumbers carimba o número puro da página (estilo livro: "1", "2", ...),
// começando em start. Sem rotação, sem opacidade — só o número, pequeno e discreto.
func applyPageNumbers(p string, count, start int, desc string, fontSize int, outDir string) error {
	current := p
	var first string
	for i := 1; i <= count; i++ {
		text := fmt.Sprintf("%d", start+i-1)
		wm, err := api.TextWatermark(text, desc, true, false, types.POINTS)
		if err != nil {
			return fmt.Errorf("pdf.pagenumbers: %w", err)
		}
		wm.FontSize = fontSize
		dest := output.NextAvailablePath(filepath.Join(outDir, fmt.Sprintf("%s_pag.pdf", fileStem(p))))
		if i == count {
			dest = output.NextAvailablePath(filepath.Join(outDir, fmt.Sprintf("%s_numerado.pdf", fileStem(p))))
		}
		if err := api.AddWatermarksFile(current, dest, []string{fmt.Sprintf("%d", i)}, wm, nil); err != nil {
			return fmt.Errorf("pdf.pagenumbers: %w", err)
		}
		if i == 1 {
			first = dest
		}
		current = dest
		if i < count {
			defer os.Remove(dest)
		}
	}
	_ = first
	lastApplied = current
	return nil
}

func pageCount(path string) int {
	f, err := os.Open(path)
	if err != nil {
		return 0
	}
	defer f.Close()
	info, err := api.PDFInfo(f, filepath.Base(path), nil, false, nil)
	if err != nil {
		return 0
	}
	return info.PageCount
}

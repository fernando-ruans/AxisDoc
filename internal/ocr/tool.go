// OCRTool é a ferramenta de OCR registrada no app (usa ImageToText).
package ocr

import (
	"context"
	"fmt"
	"path/filepath"
	"strings"

	"github.com/ferna/axisdoc/internal/tool"
)

// OCRTool roda OCR sobre imagens via tesseract.
type OCRTool struct{ cfg Config }

// NewOCRTool cria a ferramenta de OCR.
func NewOCRTool(cfg Config) *OCRTool { return &OCRTool{cfg: cfg} }

func (t *OCRTool) ID() string          { return "ocr.image" }
func (t *OCRTool) Category() string    { return "ocr" }
func (t *OCRTool) Title() string       { return "tool.ocr.title" }
func (t *OCRTool) Description() string { return "tool.ocr.desc" }
func (t *OCRTool) Icon() string        { return "scan-text" }

func (t *OCRTool) Params() []tool.Param {
	return []tool.Param{
		{Key: "lang", Label: "param.ocr.lang.label", Type: tool.ParamSelect,
			Options: []string{"por+eng", "por", "eng"}, Default: "por+eng"},
	}
}

func (t *OCRTool) Steps() []tool.Step { return []tool.Step{ocrStep{t}} }

type ocrStep struct{ t *OCRTool }

func (s ocrStep) Name() string { return "step.ocr" }

func (s ocrStep) Run(ctx context.Context, in tool.Input, report func(pct float64)) (tool.Output, error) {
	var sb strings.Builder
	count := 0
	for i, p := range in.Paths {
		if err := ctx.Err(); err != nil {
			return tool.Output{}, err
		}
		if !IsSupportedImage(p) {
			continue
		}
		cfg := s.t.cfg
		if lang, ok := in.Params["lang"].(string); ok && lang != "" {
			cfg.Lang = lang
		}
		text, err := ImageToText(ctx, p, cfg)
		if err != nil {
			fmt.Fprintf(&sb, "ERRO %s: %v\n", filepath.Base(p), err)
			continue
		}
		count++
		fmt.Fprintf(&sb, "=== %s ===\n%s\n", filepath.Base(p), text)
		if report != nil {
			report(float64(i+1) / float64(len(in.Paths)) * 100)
		}
	}
	if count == 0 {
		return tool.Output{Message: "nenhuma imagem processada"}, nil
	}
	return tool.Output{Message: strings.TrimRight(sb.String(), "\n")}, nil
}

// Package imgtools implementa ferramentas de imagem em lote.
package imgtools

import (
	"context"
	"fmt"
	"image"
	"image/color"
	"image/draw"
	"image/gif"
	"image/jpeg"
	"image/png"
	"os"
	"path/filepath"
	"strings"

	"golang.org/x/image/bmp"
	"golang.org/x/image/tiff"

	"github.com/disintegration/imaging"

	"github.com/ferna/axisdoc/internal/output"
	"github.com/ferna/axisdoc/internal/tool"
)

// Formats são os formatos de saída suportados.
var Formats = []string{"jpg", "png", "gif", "bmp", "tiff"}

func fileStem(p string) string {
	baseName := filepath.Base(p)
	if i := strings.LastIndexByte(baseName, '.'); i > 0 {
		return baseName[:i]
	}
	return baseName
}

// encodeImage grava img no formato pedido.
func encodeImage(img image.Image, dest string, quality int) error {
	f, err := os.Create(dest)
	if err != nil {
		return fmt.Errorf("img: criar %s: %w", dest, err)
	}
	defer f.Close()
	switch strings.ToLower(filepath.Ext(dest)) {
	case ".png":
		return png.Encode(f, img)
	case ".jpg", ".jpeg":
		return jpeg.Encode(f, img, &jpeg.Options{Quality: quality})
	case ".gif":
		return gif.Encode(f, img, nil)
	case ".bmp":
		return bmp.Encode(f, img)
	case ".tiff":
		return tiff.Encode(f, img, nil)
	default:
		return fmt.Errorf("img: formato não suportado: %s", filepath.Ext(dest))
	}
}

// decodeImage decodifica qualquer formato suportado.
func decodeImage(path string) (image.Image, error) {
	img, err := imaging.Open(path, imaging.AutoOrientation(true))
	if err != nil {
		return nil, fmt.Errorf("img: abrir %s: %w", path, err)
	}
	return img, nil
}

// base compartilha metadados.
type base struct {
	id, cat, title, desc, icon string
}

func (b base) ID() string          { return b.id }
func (b base) Category() string    { return b.cat }
func (b base) Title() string       { return b.title }
func (b base) Description() string { return b.desc }
func (b base) Icon() string        { return b.icon }

// stepFunc adapta função para tool.Step.
type stepFunc struct {
	name  string
	runFn func(ctx context.Context, in tool.Input, report func(pct float64)) (tool.Output, error)
}

func (s stepFunc) Name() string { return s.name }
func (s stepFunc) Run(ctx context.Context, in tool.Input, report func(pct float64)) (tool.Output, error) {
	return s.runFn(ctx, in, report)
}

func simpleStep(name string, fn func(ctx context.Context, in tool.Input, report func(pct float64)) (tool.Output, error)) tool.Step {
	return stepFunc{name: name, runFn: fn}
}

// ConvertImage converte formatos de imagem em lote.
type ConvertImage struct{ base }

func NewConvertImage() *ConvertImage {
	return &ConvertImage{base{"img.convert", "image", "tool.imgconvert.title", "tool.imgconvert.desc", "repeat"}}
}

func (t *ConvertImage) Params() []tool.Param {
	return []tool.Param{
		{Key: "format", Label: "param.img.format.label", Type: tool.ParamSelect, Options: Formats, Default: "png", Required: true},
		{Key: "quality", Label: "param.img.quality.label", Type: tool.ParamNumber, Default: 85, Min: 1, Max: 100},
		{Key: "outputDir", Label: "param.outputDir.label", Type: tool.ParamFolder},
	}
}

func (t *ConvertImage) Steps() []tool.Step {
	return []tool.Step{simpleStep("step.img.convert", t.run)}
}

func (t *ConvertImage) run(ctx context.Context, in tool.Input, report func(pct float64)) (tool.Output, error) {
	return batchProcess(ctx, in, report, func(p string) (string, error) {
		format := tool.ParamString(in, "format", "png")
		quality := int(tool.ParamFloat(in, "quality", 85))
		img, err := decodeImage(p)
		if err != nil {
			return "", err
		}
		dest := output.NextAvailablePath(filepath.Join(tool.OutputDir(in), fmt.Sprintf("%s.%s", fileStem(p), format)))
		if err := encodeImage(img, dest, quality); err != nil {
			return "", err
		}
		return dest, nil
	})
}

// ResizeImage redimensiona imagens em lote.
type ResizeImage struct{ base }

func NewResizeImage() *ResizeImage {
	return &ResizeImage{base{"img.resize", "image", "tool.imgresize.title", "tool.imgresize.desc", "scaling"}}
}

func (t *ResizeImage) Params() []tool.Param {
	return []tool.Param{
		{Key: "width", Label: "param.img.width.label", Type: tool.ParamNumber, Default: 800, Min: 1, Max: 20000},
		{Key: "height", Label: "param.img.height.label", Type: tool.ParamNumber, Default: 0, Min: 0, Max: 20000},
		{Key: "keepAspect", Label: "param.img.keepaspect.label", Type: tool.ParamBool, Default: true},
		{Key: "outputDir", Label: "param.outputDir.label", Type: tool.ParamFolder},
	}
}

func (t *ResizeImage) Steps() []tool.Step {
	return []tool.Step{simpleStep("step.img.resize", t.run)}
}

func (t *ResizeImage) run(ctx context.Context, in tool.Input, report func(pct float64)) (tool.Output, error) {
	return batchProcess(ctx, in, report, func(p string) (string, error) {
		w := int(tool.ParamFloat(in, "width", 800))
		h := int(tool.ParamFloat(in, "height", 0))
		keep := tool.ParamBoolValue(in, "keepAspect", true)
		img, err := decodeImage(p)
		if err != nil {
			return "", err
		}
		var resized image.Image
		if keep {
			resized = imaging.Fit(img, w, orDefault(h, 100000), imaging.Lanczos)
		} else {
			resized = imaging.Resize(img, w, h, imaging.Lanczos)
		}
		dest := output.NextAvailablePath(filepath.Join(tool.OutputDir(in), fmt.Sprintf("%s_%dx%d%s", fileStem(p), w, resized.Bounds().Dy(), filepath.Ext(p))))
		if err := encodeImage(resized, dest, 90); err != nil {
			return "", err
		}
		return dest, nil
	})
}

func orDefault(v, def int) int {
	if v == 0 {
		return def
	}
	return v
}

// WatermarkImage aplica marca d'água de texto em lote.
type WatermarkImage struct{ base }

func NewWatermarkImage() *WatermarkImage {
	return &WatermarkImage{base{"img.watermark", "image", "tool.imgwm.title", "tool.imgwm.desc", "stamp"}}
}

func (t *WatermarkImage) Params() []tool.Param {
	return []tool.Param{
		{Key: "text", Label: "param.pdf.text.label", Type: tool.ParamText, Required: true, Default: "© AxisDoc"},
		{Key: "opacity", Label: "param.img.opacity.label", Type: tool.ParamNumber, Default: 0.3, Min: 0.05, Max: 1},
		{Key: "outputDir", Label: "param.outputDir.label", Type: tool.ParamFolder},
	}
}

func (t *WatermarkImage) Steps() []tool.Step {
	return []tool.Step{simpleStep("step.img.watermark", t.run)}
}

func (t *WatermarkImage) run(ctx context.Context, in tool.Input, report func(pct float64)) (tool.Output, error) {
	return batchProcess(ctx, in, report, func(p string) (string, error) {
		text := tool.ParamString(in, "text", "© AxisDoc")
		opacity := tool.ParamFloat(in, "opacity", 0.3)
		img, err := decodeImage(p)
		if err != nil {
			return "", err
		}
		marked := drawTextWatermark(img, text, opacity)
		dest := output.NextAvailablePath(filepath.Join(tool.OutputDir(in), fmt.Sprintf("%s_wm%s", fileStem(p), filepath.Ext(p))))
		if err := encodeImage(marked, dest, 90); err != nil {
			return "", err
		}
		return dest, nil
	})
}

// batchProcess aplica fn em cada arquivo com progresso e cancelamento.
func batchProcess(ctx context.Context, in tool.Input, report func(pct float64), fn func(p string) (string, error)) (tool.Output, error) {
	if len(in.Paths) == 0 {
		return tool.Output{}, fmt.Errorf("img: nenhum arquivo")
	}
	var outs []string
	var sb strings.Builder
	for i, p := range in.Paths {
		if err := ctx.Err(); err != nil {
			return tool.Output{}, err
		}
		dest, err := fn(p)
		if err != nil {
			fmt.Fprintf(&sb, "ERRO %s: %v\n", filepath.Base(p), err)
		} else {
			outs = append(outs, dest)
		}
		if report != nil {
			report(float64(i+1) / float64(len(in.Paths)) * 100)
		}
	}
	if len(outs) > 0 {
		fmt.Fprintf(&sb, "%d arquivo(s) processado(s)", len(outs))
	}
	return tool.Output{Paths: outs, Message: strings.TrimRight(sb.String(), "\n")}, nil
}

var (
	_             = draw.Draw // mantém import
	_ color.Color = color.RGBA{}
)

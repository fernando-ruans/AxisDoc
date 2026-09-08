package imgtools

import (
	"context"
	"image"
	"image/color"
	"image/png"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/ferna/axisdoc/internal/tool"
)

// createTestImage gera uma imagem PNG de teste.
func createTestImage(t *testing.T, path string, w, h int) {
	t.Helper()
	img := image.NewRGBA(image.Rect(0, 0, w, h))
	for y := 0; y < h; y++ {
		for x := 0; x < w; x++ {
			img.Set(x, y, colorFor(x, y))
		}
	}
	f, err := os.Create(path)
	if err != nil {
		t.Fatal(err)
	}
	defer f.Close()
	if err := png.Encode(f, img); err != nil {
		t.Fatal(err)
	}
}

func colorFor(x, y int) color.RGBA {
	return color.RGBA{R: uint8(x % 256), G: uint8(y % 256), B: 128, A: 255}
}

func runTool(t *testing.T, tool tool.Tool, in tool.Input) (tool.Output, error) {
	t.Helper()
	steps := tool.Steps()
	return steps[0].Run(context.Background(), in, nil)
}

func TestConvertImage(t *testing.T) {
	dir := t.TempDir()
	p := filepath.Join(dir, "img.png")
	createTestImage(t, p, 100, 80)

	out, err := runTool(t, NewConvertImage(), tool.Input{
		Paths:  []string{p},
		Params: map[string]any{"format": "jpg", "quality": 85.0},
	})
	if err != nil {
		t.Fatal(err)
	}
	if len(out.Paths) != 1 {
		t.Fatalf("esperado 1 saída, obtido %d", len(out.Paths))
	}
	if filepath.Ext(out.Paths[0]) != ".jpg" {
		t.Fatalf("extensão errada: %s", out.Paths[0])
	}
}

func TestResizeImage(t *testing.T) {
	dir := t.TempDir()
	p := filepath.Join(dir, "img.png")
	createTestImage(t, p, 200, 100)

	out, err := runTool(t, NewResizeImage(), tool.Input{
		Paths:  []string{p},
		Params: map[string]any{"width": 100.0, "height": 0.0, "keepAspect": true},
	})
	if err != nil {
		t.Fatal(err)
	}
	if len(out.Paths) != 1 {
		t.Fatalf("esperado 1 saída, obtido %d", len(out.Paths))
	}
	// verifica dimensões: mantém proporção → 100x50
	f, err := os.Open(out.Paths[0])
	if err != nil {
		t.Fatal(err)
	}
	defer f.Close()
	img, _, err := image.DecodeConfig(f)
	if err != nil {
		t.Fatal(err)
	}
	if img.Width != 100 || img.Height != 50 {
		t.Fatalf("esperado 100x50, obtido %dx%d", img.Width, img.Height)
	}
}

func TestWatermarkImage(t *testing.T) {
	dir := t.TempDir()
	p := filepath.Join(dir, "img.png")
	createTestImage(t, p, 300, 200)

	out, err := runTool(t, NewWatermarkImage(), tool.Input{
		Paths:  []string{p},
		Params: map[string]any{"text": "TESTE", "opacity": 0.5},
	})
	if err != nil {
		t.Fatal(err)
	}
	if len(out.Paths) != 1 {
		t.Fatalf("esperado 1 saída, obtido %d", len(out.Paths))
	}
	if !strings.Contains(out.Paths[0], "_wm") {
		t.Fatalf("nome sem sufixo wm: %s", out.Paths[0])
	}
}

func TestImageValidation(t *testing.T) {
	if _, err := runTool(t, NewConvertImage(), tool.Input{}); err == nil {
		t.Fatal("convert sem arquivos deveria falhar")
	}
	// arquivo inválido
	bad := filepath.Join(t.TempDir(), "bad.png")
	os.WriteFile(bad, []byte("não é imagem"), 0o644)
	out, err := runTool(t, NewConvertImage(), tool.Input{
		Paths:  []string{bad},
		Params: map[string]any{"format": "png"},
	})
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(out.Message, "ERRO") {
		t.Fatal("deveria reportar erro por arquivo")
	}
}

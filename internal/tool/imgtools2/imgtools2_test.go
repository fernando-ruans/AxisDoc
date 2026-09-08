package imgtools2

import (
	"context"
	"image"
	"image/png"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/ferna/axisdoc/internal/tool"
)

func writePNG(t *testing.T, path string, w, h int) {
	t.Helper()
	img := image.NewRGBA(image.Rect(0, 0, w, h))
	for y := 0; y < h; y++ {
		for x := 0; x < w; x++ {
			img.Set(x, y, testColor(x, y))
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

func testColor(x, y int) testRGBA {
	return testRGBA{R: uint8(x % 256), G: uint8(y % 256), B: 128, A: 255}
}

type testRGBA struct {
	R, G, B, A uint8
}

func (c testRGBA) RGBA() (uint32, uint32, uint32, uint32) {
	r := uint32(c.R)
	r |= r << 8
	g := uint32(c.G)
	g |= g << 8
	b := uint32(c.B)
	b |= b << 8
	a := uint32(c.A)
	a |= a << 8
	return r, g, b, a
}

func runOne(t *testing.T, tl tool.Tool, in tool.Input) tool.Output {
	t.Helper()
	out, err := tl.Steps()[0].Run(context.Background(), in, nil)
	if err != nil {
		t.Fatalf("%s: %v", tl.ID(), err)
	}
	return out
}

func TestCrop(t *testing.T) {
	dir := t.TempDir()
	p := filepath.Join(dir, "img.png")
	writePNG(t, p, 200, 120)
	out := runOne(t, NewCrop(), tool.Input{
		Paths:  []string{p},
		Params: map[string]any{"x": 10.0, "y": 10.0, "w": 100.0, "h": 60.0, "anchor": "topLeft"},
	})
	if len(out.Paths) != 1 {
		t.Fatalf("esperado 1 saída, obtido %d", len(out.Paths))
	}
	f, _ := os.Open(out.Paths[0])
	defer f.Close()
	cfg, _, err := image.DecodeConfig(f)
	if err != nil {
		t.Fatal(err)
	}
	if cfg.Width != 100 || cfg.Height != 60 {
		t.Fatalf("esperado 100x60, obtido %dx%d", cfg.Width, cfg.Height)
	}
	// coordenada fora da imagem falha (erro por arquivo, não fatal)
	out = runOne(t, NewCrop(), tool.Input{
		Paths:  []string{p},
		Params: map[string]any{"x": 500.0, "y": 500.0, "w": 10.0, "h": 10.0, "anchor": "topLeft"},
	})
	if !strings.Contains(out.Message, "ERRO") {
		t.Fatalf("fora da imagem deveria reportar erro: %s", out.Message)
	}
	if _, err := NewCrop().Steps()[0].Run(context.Background(), tool.Input{}, nil); err == nil {
		t.Fatal("sem arquivos deveria falhar")
	}
}

func TestTransform(t *testing.T) {
	dir := t.TempDir()
	p := filepath.Join(dir, "img.png")
	writePNG(t, p, 200, 100)
	for _, op := range []string{"rotate90", "rotate180", "rotate270", "flipH", "flipV"} {
		out := runOne(t, NewTransform(), tool.Input{
			Paths:  []string{p},
			Params: map[string]any{"op": op},
		})
		if len(out.Paths) != 1 {
			t.Fatalf("%s: esperado 1 saída", op)
		}
	}
	// rotate90 inverte dimensões
	out := runOne(t, NewTransform(), tool.Input{
		Paths:  []string{p},
		Params: map[string]any{"op": "rotate90"},
	})
	f, _ := os.Open(out.Paths[0])
	defer f.Close()
	cfg, _, _ := image.DecodeConfig(f)
	if cfg.Width != 100 || cfg.Height != 200 {
		t.Fatalf("rotate90 deveria inverter: %dx%d", cfg.Width, cfg.Height)
	}
}

func TestFilters(t *testing.T) {
	dir := t.TempDir()
	p := filepath.Join(dir, "img.png")
	writePNG(t, p, 64, 64)
	for _, f := range []string{"grayscale", "invert", "blur", "sharpen", "sepia", "contrast", "brightness"} {
		out := runOne(t, NewFilters(), tool.Input{
			Paths:  []string{p},
			Params: map[string]any{"filter": f, "strength": 5.0},
		})
		if len(out.Paths) != 1 {
			t.Fatalf("%s: esperado 1 saída", f)
		}
	}
}

func TestIconGen(t *testing.T) {
	dir := t.TempDir()
	p := filepath.Join(dir, "img.png")
	writePNG(t, p, 256, 256)
	out := runOne(t, NewIconGen(), tool.Input{
		Paths:  []string{p},
		Params: map[string]any{"outputPath": filepath.Join(dir, "favicon.ico")},
	})
	if len(out.Paths) != 1 {
		t.Fatalf("esperado 1 ICO, obtido %d", len(out.Paths))
	}
	st, err := os.Stat(out.Paths[0])
	if err != nil || st.Size() < 100 {
		t.Fatal("ICO vazio")
	}
	// magic: primeiros 4 bytes 00 00 01 00
	f, _ := os.Open(out.Paths[0])
	defer f.Close()
	magic := make([]byte, 4)
	f.Read(magic)
	if magic[0] != 0 || magic[1] != 0 || magic[2] != 1 || magic[3] != 0 {
		t.Fatalf("magic ICO inválido: %v", magic)
	}
	if _, err := NewIconGen().Steps()[0].Run(context.Background(), tool.Input{}, nil); err == nil {
		t.Fatal("sem arquivos deveria falhar")
	}
}

func TestGIFExtractAndBuild(t *testing.T) {
	dir := t.TempDir()
	a := filepath.Join(dir, "a.png")
	b := filepath.Join(dir, "b.png")
	writePNG(t, a, 64, 64)
	writePNG(t, b, 64, 64)
	out := runOne(t, NewGIFBuild(), tool.Input{
		Paths:  []string{a, b},
		Params: map[string]any{"delay": 100.0, "outputPath": filepath.Join(dir, "anim.gif")},
	})
	if len(out.Paths) != 1 {
		t.Fatalf("esperado 1 GIF, obtido %d", len(out.Paths))
	}
	// extrai frames
	out = runOne(t, NewGIFExtract(), tool.Input{Paths: []string{out.Paths[0]}})
	if len(out.Paths) != 2 {
		t.Fatalf("esperado 2 frames, obtido %d", len(out.Paths))
	}
	// validações
	if _, err := NewGIFBuild().Steps()[0].Run(context.Background(), tool.Input{Paths: []string{a}}, nil); err == nil {
		t.Fatal("1 PNG deveria falhar")
	}
	if _, err := NewGIFExtract().Steps()[0].Run(context.Background(), tool.Input{}, nil); err == nil {
		t.Fatal("sem arquivos deveria falhar")
	}
}

func TestWatermarkPos(t *testing.T) {
	dir := t.TempDir()
	p := filepath.Join(dir, "img.png")
	wm := filepath.Join(dir, "logo.png")
	writePNG(t, p, 400, 300)
	writePNG(t, wm, 80, 40)
	for _, pos := range []string{"topLeft", "topRight", "center", "bottomLeft", "bottomRight"} {
		out := runOne(t, NewWatermarkPos(), tool.Input{
			Paths:  []string{p},
			Params: map[string]any{"image": wm, "position": pos, "scale": 20.0, "margin": 20.0},
		})
		if len(out.Paths) != 1 {
			t.Fatalf("%s: esperado 1 saída", pos)
		}
	}
	if _, err := NewWatermarkPos().Steps()[0].Run(context.Background(), tool.Input{Paths: []string{p}}, nil); err == nil {
		t.Fatal("sem marca d'água deveria falhar")
	}
}

func TestPalette(t *testing.T) {
	dir := t.TempDir()
	p := filepath.Join(dir, "img.png")
	writePNG(t, p, 64, 64)
	out := runOne(t, NewPalette(), tool.Input{Paths: []string{p}})
	if !strings.Contains(out.Message, "cores:") || !strings.Contains(out.Message, "#") {
		t.Fatalf("paleta inesperada: %s", out.Message)
	}
	if _, err := NewPalette().Steps()[0].Run(context.Background(), tool.Input{}, nil); err == nil {
		t.Fatal("sem arquivos deveria falhar")
	}
}

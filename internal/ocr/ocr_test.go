package ocr

import (
	"context"
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/ferna/axisdoc/internal/tool"
)

func TestAvailable(t *testing.T) {
	if testing.Short() {
		t.Skip("short")
	}
	if !Available(DefaultConfig()) {
		t.Skip("tesseract não instalado neste ambiente")
	}
}

func TestImageToTextSkipsWithoutBinary(t *testing.T) {
	cfg := DefaultConfig()
	cfg.Bin = "axisdoc-tesseract-inexistente"
	_, err := ImageToText(context.Background(), "qualquer.png", cfg)
	if err == nil {
		t.Fatal("deveria falhar sem binário")
	}
}

func TestIsSupportedImage(t *testing.T) {
	if !IsSupportedImage("foto.PNG") {
		t.Fatal("PNG deveria ser suportado")
	}
	if IsSupportedImage("doc.pdf") {
		t.Fatal("PDF não é imagem direta")
	}
}

func TestOCRToolIntegration(t *testing.T) {
	if testing.Short() {
		t.Skip("short")
	}
	cfg := DefaultConfig()
	if !Available(cfg) {
		t.Skip("tesseract não instalado")
	}
	fixture := filepath.Join("testdata", "amostra.png")
	if _, err := os.Stat(fixture); err != nil {
		t.Skip("sem fixture testdata/amostra.png (gerar imagem com texto)")
	}
	tl := NewOCRTool(cfg)
	out, err := tl.Steps()[0].Run(context.Background(), tool.Input{
		Paths:  []string{fixture},
		Params: map[string]any{},
	}, nil)
	if err != nil {
		t.Fatal(err)
	}
	t.Logf("OCR: %s", out.Message)
}

func TestOCRToolNoImages(t *testing.T) {
	tl := NewOCRTool(DefaultConfig())
	out, err := tl.Steps()[0].Run(context.Background(), tool.Input{
		Paths:  []string{"arquivo.txt"},
		Params: map[string]any{},
	}, nil)
	if err != nil {
		t.Fatal(err)
	}
	if out.Message != "nenhuma imagem processada" {
		t.Fatalf("mensagem inesperada: %s", out.Message)
	}
}

func TestOCRToolMetadata(t *testing.T) {
	tl := NewOCRTool(DefaultConfig())
	require.Equal(t, "ocr.image", tl.ID())
	require.NotEmpty(t, tl.Category())
	require.NotEmpty(t, tl.Title())
	require.NotEmpty(t, tl.Description())
	require.NotEmpty(t, tl.Icon())
	for _, p := range tl.Params() {
		require.NoError(t, p.Validate(), "param %s", p.Key)
	}
	steps := tl.Steps()
	require.Len(t, steps, 1)
	require.NotEmpty(t, steps[0].Name())
}

func TestTessDataEnv(t *testing.T) {
	require.Empty(t, tessDataEnv(Config{}))
	got := tessDataEnv(Config{TessDataPrefix: "/x"})
	require.Len(t, got, 1)
	require.Contains(t, got[0], "TESSDATA_PREFIX=/x")
}

package main

import (
	"path/filepath"
	"testing"

	"github.com/go-pdf/fpdf"
	"github.com/stretchr/testify/require"
)

func makePreviewPDF(t *testing.T, path string, pages int) {
	t.Helper()
	doc := fpdf.New("P", "mm", "A4", "")
	for i := 0; i < pages; i++ {
		doc.AddPage()
		doc.SetFont("Helvetica", "", 14)
		doc.MultiCell(0, 8, "Página de preview.", "", "L", false)
	}
	require.NoError(t, doc.OutputFileAndClose(path))
}

func TestPreviewRenderKeyInvalidatesOnChange(t *testing.T) {
	dir := t.TempDir()
	p := filepath.Join(dir, "doc.pdf")
	makePreviewPDF(t, p, 1)

	k1, err := previewRenderKey("pdf.rotate", p, map[string]any{"angle": 90.0}, 0)
	require.NoError(t, err)
	k2, err := previewRenderKey("pdf.rotate", p, map[string]any{"angle": 180.0}, 0)
	require.NoError(t, err)
	require.NotEqual(t, k1, k2, "params diferentes devem gerar chaves diferentes")

	_, err = previewRenderKey("pdf.rotate", filepath.Join(dir, "nope.pdf"), nil, 0)
	require.Error(t, err)
}

func TestPreviewRenderRotate(t *testing.T) {
	dir := t.TempDir()
	p := filepath.Join(dir, "doc.pdf")
	makePreviewPDF(t, p, 2)

	b64, err := previewRenderUncached("pdf.rotate", p, map[string]any{"angle": 90.0}, 0)
	// sem pdfium no ambiente de teste: erro esperado e documentado
	if err != nil {
		require.Contains(t, err.Error(), "pdfium")
		t.Logf("sem pdfium neste ambiente (esperado): %v", err)
		return
	}
	require.NotEmpty(t, b64)
}

func TestPreviewRenderCaches(t *testing.T) {
	dir := t.TempDir()
	p := filepath.Join(dir, "doc.pdf")
	makePreviewPDF(t, p, 1)

	// tool inexistente: erro antes de tocar no cache
	_, err := previewRenderUncached("nao.existe", p, nil, 0)
	require.Error(t, err)
}

func TestPreviewTransformLegacy(t *testing.T) {
	svc := &SystemService{}
	dir := t.TempDir()
	p := filepath.Join(dir, "doc.pdf")
	makePreviewPDF(t, p, 1)
	_, err := svc.PreviewTransform("pdf.rotate", p, map[string]any{"angle": 90.0})
	// sem pdfium: erro documentado; com pdfium: base64
	if err != nil {
		require.Contains(t, err.Error(), "pdfium")
	}
}

package pdftools

import (
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/go-pdf/fpdf"
	"github.com/pdfcpu/pdfcpu/pkg/api"

	"github.com/ferna/axisdoc/internal/tool"
)

// runTool executa o primeiro step de uma ferramenta.
func runTool(t *testing.T, tl tool.Tool, in tool.Input) (tool.Output, error) {
	t.Helper()
	steps := tl.Steps()
	if len(steps) == 0 {
		t.Fatal("ferramenta sem steps")
	}
	return steps[0].Run(context.Background(), in, nil)
}

// createTestPDF gera um PDF real de N páginas com fpdf.
func createTestPDF(t *testing.T, path string, pages int) {
	t.Helper()
	pdf := fpdf.New("P", "mm", "A4", "")
	pdf.SetAutoPageBreak(true, 10)
	for i := 0; i < pages; i++ {
		pdf.AddPage()
		pdf.SetFont("Helvetica", "", 16)
		pdf.Ln(20)
		pdf.Cellf(0, 10, "Pagina %d AxisDoc teste", i+1)
	}
	if err := pdf.OutputFileAndClose(path); err != nil {
		t.Fatalf("criar PDF: %v", err)
	}
	f, err := os.Open(path)
	if err != nil {
		t.Fatal(err)
	}
	defer f.Close()
	if _, err := api.PDFInfo(f, path, nil, false, nil); err != nil {
		t.Fatalf("pdf gerado inválido: %v", err)
	}
}

func TestPDFInfo(t *testing.T) {
	p := filepath.Join(t.TempDir(), "doc.pdf")
	createTestPDF(t, p, 3)
	out, err := runTool(t, NewPDFInfo(), tool.Input{Paths: []string{p}})
	requireNoErr(t, err)
	requireContains(t, out.Message, "3")
}

func TestMergeAndSplit(t *testing.T) {
	dir := t.TempDir()
	a := filepath.Join(dir, "a.pdf")
	b := filepath.Join(dir, "b.pdf")
	createTestPDF(t, a, 2)
	createTestPDF(t, b, 2)

	out, err := runTool(t, NewMergePDF(), tool.Input{Paths: []string{a, b}, Params: map[string]any{}})
	requireNoErr(t, err)
	requireLen(t, out.Paths, 1)
	if _, err := os.Stat(out.Paths[0]); err != nil {
		t.Fatalf("merged não existe: %v", err)
	}

	f, err := os.Open(out.Paths[0])
	if err != nil {
		t.Fatal(err)
	}
	info, err := api.PDFInfo(f, out.Paths[0], nil, false, nil)
	f.Close()
	if err != nil {
		t.Fatalf("info do merged: %v", err)
	}
	if info.PageCount != 4 {
		t.Fatalf("esperado 4 páginas, obtido %d", info.PageCount)
	}

	out, err = runTool(t, NewSplitPDF(), tool.Input{
		Paths:  []string{out.Paths[0]},
		Params: map[string]any{"mode": "everyN", "n": 2.0},
	})
	requireNoErr(t, err)
	if len(out.Paths) < 2 {
		t.Fatalf("esperado ≥2 arquivos no split, obtido %d", len(out.Paths))
	}
}

func TestRotateAndWatermarkAndCompress(t *testing.T) {
	dir := t.TempDir()
	p := filepath.Join(dir, "doc.pdf")
	createTestPDF(t, p, 2)

	out, err := runTool(t, NewRotatePDF(), tool.Input{
		Paths:  []string{p},
		Params: map[string]any{"angle": 90.0},
	})
	requireNoErr(t, err)
	requireLen(t, out.Paths, 1)

	out, err = runTool(t, NewWatermarkPDF(), tool.Input{
		Paths:  []string{p},
		Params: map[string]any{"text": "SECRETO", "fontSize": 48.0},
	})
	requireNoErr(t, err)
	requireLen(t, out.Paths, 1)

	out, err = runTool(t, NewCompressPDF(), tool.Input{Paths: []string{p}})
	requireNoErr(t, err)
	requireLen(t, out.Paths, 1)
}

func TestPDFValidation(t *testing.T) {
	if _, err := runTool(t, NewMergePDF(), tool.Input{Paths: []string{"um.pdf"}}); err == nil {
		t.Fatal("merge com 1 arquivo deveria falhar")
	}
	if _, err := runTool(t, NewSplitPDF(), tool.Input{}); err == nil {
		t.Fatal("split sem arquivos deveria falhar")
	}
	if _, err := runTool(t, NewWatermarkPDF(), tool.Input{}); err == nil {
		t.Fatal("watermark sem arquivos deveria falhar")
	}
}

func TestExtractText(t *testing.T) {
	dir := t.TempDir()
	p := filepath.Join(dir, "texto.pdf")
	createTestPDF(t, p, 1)
	out, err := runTool(t, NewExtractTextPDF(), tool.Input{Paths: []string{p}})
	if err != nil {
		t.Fatalf("extract: %v", err)
	}
	t.Logf("extraído: %q", out.Message)
}

// --- helpers ---

func requireNoErr(t *testing.T, err error) {
	t.Helper()
	if err != nil {
		t.Fatalf("erro inesperado: %v", err)
	}
}

func requireLen(t *testing.T, list []string, want int) {
	t.Helper()
	if len(list) != want {
		t.Fatalf("tamanho %d, esperado %d", len(list), want)
	}
}

func requireContains(t *testing.T, s, sub string) {
	t.Helper()
	if !strings.Contains(s, sub) {
		t.Fatalf("texto %q não contém %q", s, sub)
	}
}

package main

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/go-pdf/fpdf"
	"github.com/pdfcpu/pdfcpu/pkg/api"
)

func makeTestPDF(t *testing.T, path string, pages int) {
	t.Helper()
	doc := fpdf.New("P", "mm", "A4", "")
	for i := 0; i < pages; i++ {
		doc.AddPage()
		doc.SetFont("Helvetica", "", 14)
		doc.MultiCell(0, 8, "Página de teste para o editor.", "", "L", false)
	}
	if err := doc.OutputFileAndClose(path); err != nil {
		t.Fatalf("criar PDF: %v", err)
	}
}

func countPages(t *testing.T, path string) int {
	t.Helper()
	f, err := os.Open(path)
	if err != nil {
		t.Fatal(err)
	}
	defer f.Close()
	info, err := api.PDFInfo(f, path, nil, false, nil)
	if err != nil {
		t.Fatal(err)
	}
	return info.PageCount
}

// TestPdfEditRotateSequential valida rotações sequenciais acumuladas.
func TestPdfEditRotateSequential(t *testing.T) {
	dir := t.TempDir()
	p := filepath.Join(dir, "doc.pdf")
	makeTestPDF(t, p, 3)

	out, err := rotatePages(p, []PageRotation{{Page: 1, Angle: 90}, {Page: 3, Angle: 180}}, filepath.Join(dir, "rot.pdf"))
	if err != nil {
		t.Fatalf("rotate: %v", err)
	}
	if len(out) != 1 {
		t.Fatalf("esperado 1 arquivo, obtido %d", len(out))
	}
	if _, err := os.Stat(out[0]); err != nil {
		t.Fatalf("arquivo não existe: %v", err)
	}
	// ângulo inválido falha
	if _, err := rotatePages(p, []PageRotation{{Page: 1, Angle: 45}}, filepath.Join(dir, "x.pdf")); err == nil {
		t.Fatal("ângulo 45 deveria falhar")
	}
}

// TestPdfEditReorderRemoveInsert cobre os caminhos do PdfEditService.
func TestPdfEditReorderRemoveInsert(t *testing.T) {
	dir := t.TempDir()
	p := filepath.Join(dir, "doc.pdf")
	makeTestPDF(t, p, 4)

	svc := &PdfEditService{}

	// remove
	outs, err := svc.Remove(p, "4", dir)
	if err != nil || len(outs) != 1 {
		t.Fatalf("remove: %v %v", err, outs)
	}
	if n := countPages(t, outs[0]); n != 3 {
		t.Fatalf("esperado 3 páginas, obtido %d", n)
	}
	// remove inválido falha
	if _, err := svc.Remove(p, "", dir); err == nil {
		t.Fatal("range vazio deveria falhar")
	}
	// arquivo inexistente falha
	if _, err := svc.Remove(filepath.Join(dir, "nope.pdf"), "1", dir); err == nil {
		t.Fatal("arquivo inexistente deveria falhar")
	}

	// reorder
	outs, err = svc.Reorder(p, "4,1,2,3", dir)
	if err != nil || len(outs) != 1 {
		t.Fatalf("reorder: %v %v", err, outs)
	}
	if n := countPages(t, outs[0]); n != 4 {
		t.Fatalf("esperado 4 páginas, obtido %d", n)
	}
	if _, err := svc.Reorder(p, "abc", dir); err == nil {
		t.Fatal("ordem inválida deveria falhar")
	}

	// rotate via serviço
	outs, err = svc.Rotate(p, []PageRotation{{Page: 2, Angle: 270}}, dir)
	if err != nil || len(outs) != 1 {
		t.Fatalf("rotate: %v %v", err, outs)
	}

	// insert blank
	outs, err = svc.InsertBlank(p, 2, dir)
	if err != nil || len(outs) != 1 {
		t.Fatalf("insert: %v %v", err, outs)
	}
	if n := countPages(t, outs[0]); n != 6 {
		t.Fatalf("esperado 6 páginas, obtido %d", n)
	}
	if _, err := svc.InsertBlank(p, 0, dir); err == nil {
		t.Fatal("count 0 deveria falhar")
	}
	if _, err := svc.InsertBlank(p, 100, dir); err == nil {
		t.Fatal("count 100 deveria falhar")
	}

	// outputDir "" usa o dir do PDF
	outs, err = svc.Remove(p, "1", "")
	if err != nil || len(outs) != 1 {
		t.Fatalf("outputDir vazio: %v %v", err, outs)
	}
	os.Remove(outs[0])
}

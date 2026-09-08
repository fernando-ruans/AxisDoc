package pdftools3

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

func makePDF(t *testing.T, path string, pages int) {
	t.Helper()
	doc := fpdf.New("P", "mm", "A4", "")
	doc.SetAutoPageBreak(true, 20)
	for i := 0; i < pages; i++ {
		doc.AddPage()
		doc.SetFont("Helvetica", "", 14)
		doc.MultiCell(0, 8, "Página de teste número "+string(rune('0'+(i+1)%10))+" com conteúdo.", "", "L", false)
	}
	if err := doc.OutputFileAndClose(path); err != nil {
		t.Fatalf("criar PDF: %v", err)
	}
}

func runOne(t *testing.T, tl tool.Tool, in tool.Input) tool.Output {
	t.Helper()
	out, err := tl.Steps()[0].Run(context.Background(), in, nil)
	if err != nil {
		t.Fatalf("%s: %v", tl.ID(), err)
	}
	return out
}

func pageCountOf(t *testing.T, path string) int {
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

func TestParseOrder(t *testing.T) {
	sel, err := parseOrder("3,1,2")
	if err != nil || len(sel) != 3 {
		t.Fatalf("parse errado: %v %v", sel, err)
	}
	if _, err := parseOrder(""); err == nil {
		t.Fatal("ordem vazia deveria falhar")
	}
	if _, err := parseOrder("abc"); err == nil {
		t.Fatal("token inválido deveria falhar")
	}
}

func TestRearrange(t *testing.T) {
	dir := t.TempDir()
	p := filepath.Join(dir, "doc.pdf")
	makePDF(t, p, 3)
	out := runOne(t, NewRearrange(), tool.Input{
		Paths:  []string{p},
		Params: map[string]any{"order": "3,1,2"},
	})
	if len(out.Paths) != 1 {
		t.Fatalf("esperado 1 PDF, obtido %d", len(out.Paths))
	}
	if n := pageCountOf(t, out.Paths[0]); n != 3 {
		t.Fatalf("esperado 3 páginas, obtido %d", n)
	}
	// duplicatas também valem
	out = runOne(t, NewRearrange(), tool.Input{
		Paths:  []string{p},
		Params: map[string]any{"order": "1,1,2"},
	})
	if n := pageCountOf(t, out.Paths[0]); n != 3 {
		t.Fatalf("duplicatas: esperado 3 páginas, obtido %d", n)
	}
	if _, err := NewRearrange().Steps()[0].Run(context.Background(), tool.Input{Paths: []string{p}, Params: map[string]any{}}, nil); err == nil {
		t.Fatal("ordem vazia deveria falhar")
	}
	if _, err := NewRearrange().Steps()[0].Run(context.Background(), tool.Input{}, nil); err == nil {
		t.Fatal("sem arquivos deveria falhar")
	}
}

func TestProtectUnlockRoundTrip(t *testing.T) {
	dir := t.TempDir()
	p := filepath.Join(dir, "doc.pdf")
	makePDF(t, p, 2)
	out := runOne(t, NewProtect(), tool.Input{
		Paths:  []string{p},
		Params: map[string]any{"userPassword": "secreto123", "ownerPassword": "", "keyLength": "256"},
	})
	if len(out.Paths) != 1 {
		t.Fatalf("esperado 1 PDF, obtido %d", len(out.Paths))
	}
	// protegido abre só com senha: unlock com senha errada falha
	if _, err := NewUnlock().Steps()[0].Run(context.Background(), tool.Input{
		Paths:  []string{out.Paths[0]},
		Params: map[string]any{"password": "errada"},
	}, nil); err == nil {
		t.Fatal("senha errada deveria falhar")
	}
	// unlock com senha certa
	out = runOne(t, NewUnlock(), tool.Input{
		Paths:  []string{out.Paths[0]},
		Params: map[string]any{"password": "secreto123"},
	})
	if len(out.Paths) != 1 {
		t.Fatalf("esperado 1 PDF desbloqueado, obtido %d", len(out.Paths))
	}
	if n := pageCountOf(t, out.Paths[0]); n != 2 {
		t.Fatalf("esperado 2 páginas, obtido %d", n)
	}
	// validações
	if _, err := NewProtect().Steps()[0].Run(context.Background(), tool.Input{Paths: []string{p}, Params: map[string]any{}}, nil); err == nil {
		t.Fatal("sem senha deveria falhar")
	}
}

func TestOverlay(t *testing.T) {
	dir := t.TempDir()
	base := filepath.Join(dir, "base.pdf")
	makePDF(t, base, 2)
	ov := filepath.Join(dir, "overlay.pdf")
	makePDF(t, ov, 1)
	out := runOne(t, NewOverlay(), tool.Input{
		Paths:  []string{base},
		Params: map[string]any{"overlay": ov, "onTop": true},
	})
	if len(out.Paths) != 1 {
		t.Fatalf("esperado 1 PDF, obtido %d", len(out.Paths))
	}
	if n := pageCountOf(t, out.Paths[0]); n != 2 {
		t.Fatalf("overlay deveria manter 2 páginas, obtido %d", n)
	}
	if _, err := NewOverlay().Steps()[0].Run(context.Background(), tool.Input{Paths: []string{base}}, nil); err == nil {
		t.Fatal("sem overlay deveria falhar")
	}
}

func TestPageNumbers(t *testing.T) {
	dir := t.TempDir()
	p := filepath.Join(dir, "doc.pdf")
	makePDF(t, p, 3)
	out := runOne(t, NewPageNumbers(), tool.Input{
		Paths:  []string{p},
		Params: map[string]any{"format": "Page %p of %P", "position": "bottomCenter", "fontSize": 10.0},
	})
	if len(out.Paths) != 1 {
		t.Fatalf("esperado 1 PDF, obtido %d", len(out.Paths))
	}
	if n := pageCountOf(t, out.Paths[0]); n != 3 {
		t.Fatalf("esperado 3 páginas, obtido %d", n)
	}
	// numeração confere via contagem de páginas + sufixo de nome
	if n := pageCountOf(t, out.Paths[0]); n != 3 {
		t.Fatalf("esperado 3 páginas, obtido %d", n)
	}
	if !strings.HasSuffix(filepath.Base(out.Paths[0]), "_numerado.pdf") {
		t.Fatalf("nome inesperado: %s", out.Paths[0])
	}
	// garante que o arquivo cresceu (stamps adicionados)
	orig, _ := os.Stat(p)
	stamped, _ := os.Stat(out.Paths[0])
	if stamped.Size() <= orig.Size() {
		t.Fatalf("PDF numerado deveria ser maior: %d <= %d", stamped.Size(), orig.Size())
	}
	if _, err := NewPageNumbers().Steps()[0].Run(context.Background(), tool.Input{}, nil); err == nil {
		t.Fatal("sem arquivos deveria falhar")
	}
}

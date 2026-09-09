package pdftools2

import (
	"context"
	"image"
	"image/color"
	"image/png"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/go-pdf/fpdf"

	"github.com/ferna/axisdoc/internal/tool"
)

// makePDF gera um PDF real com fpdf para os testes.
func makePDF(t *testing.T, path string, pages int) {
	t.Helper()
	doc := fpdf.New("P", "mm", "A4", "")
	doc.SetAutoPageBreak(true, 20)
	for i := 0; i < pages; i++ {
		doc.AddPage()
		doc.SetFont("Helvetica", "", 14)
		doc.MultiCell(0, 8, "Página de teste número "+itoa(i+1)+" com conteúdo suficiente para extração.", "", "L", false)
	}
	if err := doc.OutputFileAndClose(path); err != nil {
		t.Fatalf("criar PDF: %v", err)
	}
}

func itoa(n int) string { return strings.TrimSpace(strings.ReplaceAll(strings.Repeat(" ", 0)+itoa2(n), " ", "")) }

func itoa2(n int) string {
	if n == 0 {
		return "0"
	}
	var b [16]byte
	i := len(b)
	for n > 0 {
		i--
		b[i] = byte('0' + n%10)
		n /= 10
	}
	return string(b[i:])
}

// makePDFWithImage gera um PDF com uma imagem embutida (via fpdf + arquivo PNG).
func makePDFWithImage(t *testing.T, path, imgPath string) {
	t.Helper()
	doc := fpdf.New("P", "mm", "A4", "")
	doc.AddPage()
	doc.SetFont("Helvetica", "", 14)
	doc.MultiCell(0, 8, "PDF com imagem embutida para teste de extração.", "", "L", false)
	doc.Image(imgPath, 10, 40, 100, 0, false, "", 0, "")
	if err := doc.OutputFileAndClose(path); err != nil {
		t.Fatalf("criar PDF com imagem: %v", err)
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

// runOneRaw retorna o erro em vez de falhar (para debug direcionado).
func runOneRaw(t *testing.T, tl tool.Tool, in tool.Input) (tool.Output, error) {
	t.Helper()
	return tl.Steps()[0].Run(context.Background(), in, nil)
}

func TestExtractImagesRoundTrip(t *testing.T) {
	dir := t.TempDir()
	// PDF com imagem real embutida via fpdf (PNG gerado em disco).
	img := filepath.Join(dir, "foto.png")
	writePNG1x1(t, img)
	p := filepath.Join(dir, "doc.pdf")
	makePDFWithImage(t, p, img)
	out := runOne(t, NewExtractImages(), tool.Input{Paths: []string{p}})
	if len(out.Paths) == 0 {
		t.Fatalf("esperado ≥1 imagem, obtido: %s", out.Message)
	}
	for _, f := range out.Paths {
		if st, err := os.Stat(f); err != nil || st.Size() == 0 {
			t.Fatalf("imagem extraída inválida: %s (%v)", f, err)
		}
	}

	// PDF só de texto: mensagem clara, sem falha e sem paths
	p2 := filepath.Join(dir, "texto.pdf")
	makePDF(t, p2, 1)
	out = runOne(t, NewExtractImages(), tool.Input{Paths: []string{p2}})
	if len(out.Paths) != 0 || !strings.Contains(out.Message, "nenhuma imagem") {
		t.Fatalf("texto puro deveria reportar ausência: %+v", out)
	}
}

func TestExtractPagesAndRemove(t *testing.T) {
	dir := t.TempDir()
	p := filepath.Join(dir, "doc.pdf")
	makePDF(t, p, 4)

	out, _ := runOneRaw(t, NewExtractPages(), tool.Input{
		Paths:  []string{p},
		Params: map[string]any{"pages": "1-2"},
	})
	if len(out.Paths) != 1 {
		entries, _ := os.ReadDir(filepath.Dir(p))
		var names []string
		for _, e := range entries {
			names = append(names, e.Name())
		}
		t.Fatalf("esperado 1 PDF extraído, obtido %d (%v); dir=%v", len(out.Paths), out.Paths, names)
	}

	out = runOne(t, NewRemovePages(), tool.Input{
		Paths:  []string{p},
		Params: map[string]any{"pages": "1"},
	})
	if len(out.Paths) != 1 {
		t.Fatalf("esperado 1 PDF, obtido %d", len(out.Paths))
	}

	// validação: range vazio falha
	if _, err := NewExtractPages().Steps()[0].Run(context.Background(), tool.Input{Paths: []string{p}}, nil); err == nil {
		t.Fatal("extract sem pages deveria falhar")
	}
	if _, err := NewRemovePages().Steps()[0].Run(context.Background(), tool.Input{}, nil); err == nil {
		t.Fatal("remove sem arquivos deveria falhar")
	}
}

func TestExtractFontsAndMetadata(t *testing.T) {
	dir := t.TempDir()
	p := filepath.Join(dir, "doc.pdf")
	makePDF(t, p, 2)

	out := runOne(t, NewExtractFonts(), tool.Input{Paths: []string{p}})
	t.Logf("fontes: %s", out.Message)

	out = runOne(t, NewExtractMetadata(), tool.Input{Paths: []string{p}})
	if out.Message == "" {
		t.Fatal("metadados vazios")
	}
}

func TestExtractAttachmentsEmpty(t *testing.T) {
	dir := t.TempDir()
	p := filepath.Join(dir, "doc.pdf")
	makePDF(t, p, 1)
	out := runOne(t, NewExtractAttachments(), tool.Input{Paths: []string{p}})
	if !strings.Contains(out.Message, "nenhum anexo") {
		t.Fatalf("esperado 'nenhum anexo', obtido: %s", out.Message)
	}
}

func TestAddAttachmentsRoundTrip(t *testing.T) {
	dir := t.TempDir()
	p := filepath.Join(dir, "doc.pdf")
	makePDF(t, p, 1)
	att := filepath.Join(dir, "nota.txt")
	if err := os.WriteFile(att, []byte("anexo de teste"), 0o644); err != nil {
		t.Fatal(err)
	}
	out := runOne(t, NewAddAttachments(), tool.Input{
		Paths:  []string{p},
		Params: map[string]any{"files": att},
	})
	if len(out.Paths) != 1 {
		t.Fatalf("esperado 1 PDF com anexo, obtido %d", len(out.Paths))
	}
	// agora extrai e confere (nome preservado, com sufixo de colisão aceito)
	outRaw, extractErr := runOneRaw(t, NewExtractAttachments(), tool.Input{Paths: []string{out.Paths[0]}})
	if extractErr != nil {
		t.Fatalf("extract: %v", extractErr)
	}
	if len(outRaw.Paths) != 1 {
		t.Fatalf("esperado 1 anexo, obtido %v", outRaw.Paths)
	}
	if filepath.Base(outRaw.Paths[0]) != "nota.txt" && filepath.Base(outRaw.Paths[0]) != "nota (2).txt" {
		t.Fatalf("nome inesperado: %v", outRaw.Paths)
	}
	out = outRaw
	data, err := os.ReadFile(out.Paths[0])
	if err != nil || string(data) != "anexo de teste" {
		t.Fatalf("conteúdo do anexo divergente: %v %q", err, string(data))
	}
}

func TestPermissionsList(t *testing.T) {
	dir := t.TempDir()
	p := filepath.Join(dir, "doc.pdf")
	makePDF(t, p, 2)
	out := runOne(t, NewPermissions(), tool.Input{Paths: []string{p}})
	if out.Message == "" {
		t.Fatal("permissões vazias")
	}
	t.Logf("perms: %s", out.Message)
}

func TestComparePDFsDiff(t *testing.T) {
	dir := t.TempDir()
	p := filepath.Join(dir, "doc.pdf")
	makePDF(t, p, 2)

	q := filepath.Join(dir, "doc2.pdf")
	makePDF(t, q, 2)
	out := runOne(t, NewComparePDFs(), tool.Input{Paths: []string{p, q}})
	if !strings.Contains(out.Message, "mesmo texto") {
		t.Fatalf("PDFs iguais deveriam ter o mesmo texto: %s", out.Message)
	}
	if _, err := NewComparePDFs().Steps()[0].Run(context.Background(), tool.Input{Paths: []string{p}}, nil); err == nil {
		t.Fatal("diff com 1 arquivo deveria falhar")
	}
}

func TestImagesToPDFAndCreateAndNUp(t *testing.T) {
	dir := t.TempDir()
	// gera PNG real via codificação mínima (1x1 vermelho)
	img := filepath.Join(dir, "q.png")
	writePNG1x1(t, img)

	out := runOne(t, NewImagesToPDF(), tool.Input{Paths: []string{img}})
	if len(out.Paths) != 1 {
		t.Fatalf("esperado 1 PDF, obtido %d", len(out.Paths))
	}

	out = runOne(t, NewCreatePDF(), tool.Input{Params: map[string]any{
		"title": "Relatório", "body": "Primeiro parágrafo.\n\nSegundo parágrafo.", "pages": 1.0,
		"outputPath": filepath.Join(dir, "novo.pdf"),
	}})
	if len(out.Paths) != 1 {
		t.Fatalf("esperado 1 PDF criado, obtido %d", len(out.Paths))
	}

	out = runOne(t, NewNUp(), tool.Input{
		Paths:  []string{out.Paths[0]},
		Params: map[string]any{"n": 2.0},
	})
	if len(out.Paths) != 1 {
		t.Fatalf("esperado 1 PDF n-up, obtido %d", len(out.Paths))
	}

	if _, err := NewCreatePDF().Steps()[0].Run(context.Background(), tool.Input{Params: map[string]any{}}, nil); err == nil {
		t.Fatal("create vazio deveria falhar")
	}
	if _, err := NewImagesToPDF().Steps()[0].Run(context.Background(), tool.Input{}, nil); err == nil {
		t.Fatal("fromimages sem arquivos deveria falhar")
	}
}

func writePNG1x1(t *testing.T, path string) {
	t.Helper()
	// PNG 1x1 vermelho gerado via stdlib (CRC válido)
	img := image.NewRGBA(image.Rect(0, 0, 1, 1))
	img.Set(0, 0, color.RGBA{R: 255, A: 255})
	f, err := os.Create(path)
	if err != nil {
		t.Fatal(err)
	}
	defer f.Close()
	if err := png.Encode(f, img); err != nil {
		t.Fatal(err)
	}
}

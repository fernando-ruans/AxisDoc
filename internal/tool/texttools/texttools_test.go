package texttools

import (
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/ferna/axisdoc/internal/tool"
)

func write(t *testing.T, name, content string) string {
	t.Helper()
	p := filepath.Join(t.TempDir(), name)
	if err := os.WriteFile(p, []byte(content), 0o644); err != nil {
		t.Fatal(err)
	}
	return p
}

func run(t *testing.T, tl tool.Tool, in tool.Input) tool.Output {
	t.Helper()
	out, err := tl.Steps()[0].Run(context.Background(), in, nil)
	if err != nil {
		t.Fatal(err)
	}
	return out
}

func TestTextDiff(t *testing.T) {
	a := write(t, "a.txt", "linha1\nlinha2\nlinha3\n")
	b := write(t, "b.txt", "linha1\nmudou\nlinha3\nlinha4\n")
	out := run(t, NewTextDiff(), tool.Input{Paths: []string{a, b}})
	if !strings.Contains(out.Message, "+") || !strings.Contains(out.Message, "-") {
		t.Fatalf("diff sem marcas: %s", out.Message)
	}
	// idênticos
	out = run(t, NewTextDiff(), tool.Input{Paths: []string{a, a}})
	if !strings.Contains(out.Message, "idênticos") {
		t.Fatalf("esperado idênticos: %s", out.Message)
	}
	// validação
	if _, err := NewTextDiff().Steps()[0].Run(context.Background(), tool.Input{Paths: []string{"um"}}, nil); err == nil {
		t.Fatal("diff com 1 arquivo deveria falhar")
	}
}

func TestTextStats(t *testing.T) {
	p := write(t, "texto.txt", "olá mundo\nsegunda linha\n")
	out := run(t, NewTextStats(), tool.Input{Paths: []string{p}})
	if !strings.Contains(out.Message, "2 linhas") || !strings.Contains(out.Message, "4 palavras") {
		t.Fatalf("stats erradas: %s", out.Message)
	}
}

func TestBatchRename(t *testing.T) {
	dir := t.TempDir()
	p1 := filepath.Join(dir, "nota 1.txt")
	p2 := filepath.Join(dir, "nota 2.txt")
	os.WriteFile(p1, []byte("1"), 0o644)
	os.WriteFile(p2, []byte("2"), 0o644)

	out := run(t, NewBatchRename(), tool.Input{
		Paths:  []string{p1, p2},
		Params: map[string]any{"pattern": "\\s+", "replacement": "_"},
	})
	if !strings.Contains(out.Message, "2 renomeado(s)") {
		t.Fatalf("esperado 2 renomeados: %s", out.Message)
	}
	if _, err := os.Stat(filepath.Join(dir, "nota_1.txt")); err != nil {
		t.Fatal("arquivo renomeado não existe")
	}
	if _, err := os.Stat(p1); err == nil {
		t.Fatal("arquivo original ainda existe")
	}
}

func TestBatchRenameValidation(t *testing.T) {
	if _, err := NewBatchRename().Steps()[0].Run(context.Background(), tool.Input{}, nil); err == nil {
		t.Fatal("sem arquivos deveria falhar")
	}
	if _, err := NewBatchRename().Steps()[0].Run(context.Background(), tool.Input{
		Paths:  []string{"x.txt"},
		Params: map[string]any{"pattern": "[invalid"},
	}, nil); err == nil {
		t.Fatal("regex inválida deveria falhar")
	}
}

func TestQRCode(t *testing.T) {
	dir := t.TempDir()
	out := run(t, NewQRCode(), tool.Input{
		Paths:  []string{dir},
		Params: map[string]any{"text": "https://axisdoc.local", "size": 256.0},
	})
	if len(out.Paths) != 1 {
		t.Fatal("QR não gerado")
	}
	st, err := os.Stat(out.Paths[0])
	if err != nil || st.Size() == 0 {
		t.Fatal("QR vazio")
	}
	// validação: texto vazio
	if _, err := NewQRCode().Steps()[0].Run(context.Background(), tool.Input{Params: map[string]any{}}, nil); err == nil {
		t.Fatal("texto vazio deveria falhar")
	}
}

func TestBarcode(t *testing.T) {
	dir := t.TempDir()
	out := run(t, NewBarcodeTool(), tool.Input{
		Paths:  []string{dir},
		Params: map[string]any{"text": "AxisDoc-2026", "kind": "code128", "width": 400.0, "height": 100.0},
	})
	if len(out.Paths) != 1 {
		t.Fatal("barcode não gerado")
	}
	st, err := os.Stat(out.Paths[0])
	if err != nil || st.Size() == 0 {
		t.Fatal("barcode vazio")
	}
	// ean13 inválido deve falhar
	if _, err := NewBarcodeTool().Steps()[0].Run(context.Background(), tool.Input{
		Paths:  []string{dir},
		Params: map[string]any{"text": "123", "kind": "ean13"},
	}, nil); err == nil {
		t.Fatal("EAN-13 inválido deveria falhar")
	}
}

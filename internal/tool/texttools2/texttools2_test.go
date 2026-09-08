package texttools2

import (
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/ferna/axisdoc/internal/tool"
)

func runOne(t *testing.T, tl tool.Tool, in tool.Input) tool.Output {
	t.Helper()
	out, err := tl.Steps()[0].Run(context.Background(), in, nil)
	if err != nil {
		t.Fatalf("%s: %v", tl.ID(), err)
	}
	return out
}

func TestLorem(t *testing.T) {
	out := runOne(t, NewLorem(), tool.Input{Params: map[string]any{"paragraphs": 2.0, "wordsPerParagraph": 10.0}})
	if len(out.Paths) != 1 {
		t.Fatalf("esperado 1 arquivo, obtido %d", len(out.Paths))
	}
	data, _ := os.ReadFile(out.Paths[0])
	paras := strings.Split(strings.TrimSpace(string(data)), "\n\n")
	if len(paras) != 2 {
		t.Fatalf("esperado 2 parágrafos, obtido %d", len(paras))
	}
	if !strings.HasSuffix(strings.TrimSpace(string(data)), ".") {
		t.Fatal("deveria terminar com ponto")
	}
}

func TestBaseConvert(t *testing.T) {
	out := runOne(t, NewBaseConvert(), tool.Input{Params: map[string]any{"value": "255", "from": "10", "to": "16"}})
	if out.Message != "255 (base 10) = ff (base 16)" {
		t.Fatalf("conversão errada: %s", out.Message)
	}
	out = runOne(t, NewBaseConvert(), tool.Input{Params: map[string]any{"value": "ff", "from": "16", "to": "2"}})
	if out.Message != "ff (base 16) = 11111111 (base 2)" {
		t.Fatalf("conversão errada: %s", out.Message)
	}
	if _, err := NewBaseConvert().Steps()[0].Run(context.Background(), tool.Input{Params: map[string]any{"value": "zz", "from": "10", "to": "16"}}, nil); err == nil {
		t.Fatal("valor inválido deveria falhar")
	}
	if _, err := NewBaseConvert().Steps()[0].Run(context.Background(), tool.Input{Params: map[string]any{}}, nil); err == nil {
		t.Fatal("valor vazio deveria falhar")
	}
}

func TestEpoch(t *testing.T) {
	out := runOne(t, NewEpoch(), tool.Input{Params: map[string]any{"mode": "now"}})
	if !strings.Contains(out.Message, "epoch:") {
		t.Fatalf("now sem epoch: %s", out.Message)
	}
	out = runOne(t, NewEpoch(), tool.Input{Params: map[string]any{"mode": "toDate", "value": "0"}})
	if !strings.Contains(out.Message, "1970-01-01") {
		t.Fatalf("epoch 0 deveria ser 1970: %s", out.Message)
	}
	out = runOne(t, NewEpoch(), tool.Input{Params: map[string]any{"mode": "toEpoch", "value": "2026-01-01"}})
	if !strings.Contains(out.Message, "epoch:") {
		t.Fatalf("toEpoch sem epoch: %s", out.Message)
	}
	if _, err := NewEpoch().Steps()[0].Run(context.Background(), tool.Input{Params: map[string]any{"mode": "toDate", "value": "abc"}}, nil); err == nil {
		t.Fatal("epoch inválido deveria falhar")
	}
	if _, err := NewEpoch().Steps()[0].Run(context.Background(), tool.Input{Params: map[string]any{"mode": "toEpoch", "value": "ontem de manhã"}}, nil); err == nil {
		t.Fatal("data inválida deveria falhar")
	}
}

func TestUUID(t *testing.T) {
	out := runOne(t, NewUUID(), tool.Input{Params: map[string]any{"count": 3.0, "version": "v4"}})
	lines := strings.Split(strings.TrimSpace(out.Message), "\n")
	if len(lines) != 3 {
		t.Fatalf("esperado 3 UUIDs, obtido %d", len(lines))
	}
	for _, l := range lines {
		if len(l) != 36 {
			t.Fatalf("UUID inválido: %q", l)
		}
	}
	out = runOne(t, NewUUID(), tool.Input{Params: map[string]any{"count": 1.0, "version": "v7"}})
	if len(strings.TrimSpace(out.Message)) != 36 {
		t.Fatalf("UUID v7 inválido: %q", out.Message)
	}
}

func TestSlug(t *testing.T) {
	out := runOne(t, NewSlug(), tool.Input{Params: map[string]any{"text": "Olá, Mundo! Programação em Go", "separator": "-"}})
	if out.Message != "ola-mundo-programacao-em-go" {
		t.Fatalf("slug errado: %q", out.Message)
	}
	out = runOne(t, NewSlug(), tool.Input{Params: map[string]any{"text": "a b", "separator": "_"}})
	if out.Message != "a_b" {
		t.Fatalf("slug com _ errado: %q", out.Message)
	}
	if _, err := NewSlug().Steps()[0].Run(context.Background(), tool.Input{Params: map[string]any{}}, nil); err == nil {
		t.Fatal("texto vazio deveria falhar")
	}
}

func TestColumnize(t *testing.T) {
	p := filepath.Join(t.TempDir(), "lista.txt")
	os.WriteFile(p, []byte("nome|idade|cidade\nAna|30|São Paulo\nBruno|25|Rio\n"), 0o644)
	out := runOne(t, NewColumnize(), tool.Input{Paths: []string{p}, Params: map[string]any{"delimiter": "|", "padding": 2.0}})
	lines := strings.Split(out.Message, "\n")
	// todas as linhas de dados alinhadas: mesma posição do segundo campo
	if len(lines) < 4 {
		t.Fatalf("linhas insuficientes: %s", out.Message)
	}
	pos := func(s string) int { return strings.Index(s, "|") }
	_ = pos
	// verifica alinhamento: "30" e "25" começam na mesma coluna
	idx1 := strings.Index(lines[2], "30")
	idx2 := strings.Index(lines[3], "25")
	if idx1 != idx2 || idx1 < 0 {
		t.Fatalf("colunas desalinhadas:\n%s", out.Message)
	}
	if _, err := NewColumnize().Steps()[0].Run(context.Background(), tool.Input{}, nil); err == nil {
		t.Fatal("sem arquivos deveria falhar")
	}
}

func TestEscape(t *testing.T) {
	out := runOne(t, NewEscape(), tool.Input{Params: map[string]any{"kind": "htmlEscape", "text": "<b>oi & tchau</b>"}})
	if out.Message != "&lt;b&gt;oi &amp; tchau&lt;/b&gt;" {
		t.Fatalf("escape errado: %q", out.Message)
	}
	out = runOne(t, NewEscape(), tool.Input{Params: map[string]any{"kind": "htmlUnescape", "text": "&lt;b&gt;"}})
	if out.Message != "<b>" {
		t.Fatalf("unescape errado: %q", out.Message)
	}
	out = runOne(t, NewEscape(), tool.Input{Params: map[string]any{"kind": "urlEncode", "text": "a b/c?"}})
	if out.Message != "a+b%2Fc%3F" {
		t.Fatalf("url encode errado: %q", out.Message)
	}
	out = runOne(t, NewEscape(), tool.Input{Params: map[string]any{"kind": "urlDecode", "text": "a+b%2Fc"}})
	if out.Message != "a b/c" {
		t.Fatalf("url decode errado: %q", out.Message)
	}
	// via arquivo
	p := filepath.Join(t.TempDir(), "t.txt")
	os.WriteFile(p, []byte("<x>"), 0o644)
	out = runOne(t, NewEscape(), tool.Input{Paths: []string{p}, Params: map[string]any{"kind": "htmlEscape"}})
	if out.Message != "&lt;x&gt;" {
		t.Fatalf("via arquivo errado: %q", out.Message)
	}
	if _, err := NewEscape().Steps()[0].Run(context.Background(), tool.Input{Params: map[string]any{"kind": "htmlEscape"}}, nil); err == nil {
		t.Fatal("texto vazio deveria falhar")
	}
}

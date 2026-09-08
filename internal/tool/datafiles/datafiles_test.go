package datafiles

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

func TestTabularConvertCSVtoXLSXAndBack(t *testing.T) {
	csvPath := write(t, "dados.csv", "nome,idade\nAna,30\nBruno,25\n")
	out := run(t, NewTabularConvert(), tool.Input{
		Paths:  []string{csvPath},
		Params: map[string]any{"format": "xlsx"},
	})
	if len(out.Paths) != 1 {
		t.Fatalf("esperado 1 arquivo, obtido %d", len(out.Paths))
	}
	// volta para CSV
	out = run(t, NewTabularConvert(), tool.Input{
		Paths:  []string{out.Paths[0]},
		Params: map[string]any{"format": "csv"},
	})
	if len(out.Paths) != 1 {
		t.Fatalf("esperado 1 arquivo, obtido %d", len(out.Paths))
	}
	data, err := os.ReadFile(out.Paths[0])
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(data), "Ana,30") || !strings.Contains(string(data), "Bruno,25") {
		t.Fatalf("round-trip perdeu dados: %q", string(data))
	}
}

func TestSpreadsheetCompare(t *testing.T) {
	a := write(t, "a.csv", "nome,idade\nAna,30\nBruno,25\n")
	b := write(t, "b.csv", "nome,idade\nAna,31\nBruno,25\n")
	out := run(t, NewSpreadsheetCompare(), tool.Input{Paths: []string{a, b}})
	if !strings.Contains(out.Message, "1 diferen") {
		t.Fatalf("esperado 1 diferença, obtido: %s", out.Message)
	}
	// idênticas
	out = run(t, NewSpreadsheetCompare(), tool.Input{Paths: []string{a, a}})
	if !strings.Contains(out.Message, "idênticas") {
		t.Fatalf("esperado idênticas: %s", out.Message)
	}
}

func TestStructConvertJSONYAMLTOML(t *testing.T) {
	j := write(t, "conf.json", `{"nome":"axisdoc","versao":2,"tags":["a","b"]}`)
	// json → yaml
	out := run(t, NewStructConvert(), tool.Input{
		Paths:  []string{j},
		Params: map[string]any{"format": "yaml"},
	})
	if len(out.Paths) != 1 {
		t.Fatal("yaml não gerado")
	}
	// yaml → toml
	out = run(t, NewStructConvert(), tool.Input{
		Paths:  []string{out.Paths[0]},
		Params: map[string]any{"format": "toml"},
	})
	if len(out.Paths) != 1 {
		t.Fatal("toml não gerado")
	}
	data, _ := os.ReadFile(out.Paths[0])
	if !strings.Contains(string(data), "nome") {
		t.Fatalf("toml sem dados: %q", string(data))
	}
	// toml → json (fecha o ciclo)
	out = run(t, NewStructConvert(), tool.Input{
		Paths:  []string{out.Paths[0]},
		Params: map[string]any{"format": "json"},
	})
	data, _ = os.ReadFile(out.Paths[0])
	if !strings.Contains(string(data), "axisdoc") {
		t.Fatalf("json sem dados: %q", string(data))
	}
}

func TestJSONFormat(t *testing.T) {
	valid := write(t, "ok.json", `{"b":2,"a":1}`)
	invalid := write(t, "bad.json", `{inválido}`)
	out := run(t, NewJSONFormat(), tool.Input{Paths: []string{valid, invalid}, Params: map[string]any{"mode": "format"}})
	if !strings.Contains(out.Message, "JSON válido") || !strings.Contains(out.Message, "INVÁLIDO") {
		t.Fatalf("mensagens erradas: %s", out.Message)
	}
}

func TestTableToJSON(t *testing.T) {
	csvPath := write(t, "p.csv", "nome,idade\nAna,30\nBruno,25\n")
	out := run(t, NewTableToJSON(), tool.Input{Paths: []string{csvPath}})
	if len(out.Paths) != 1 {
		t.Fatal("json não gerado")
	}
	data, _ := os.ReadFile(out.Paths[0])
	if !strings.Contains(string(data), `"nome": "Ana"`) && !strings.Contains(string(data), `"nome":"Ana"`) {
		t.Fatalf("json inesperado: %q", string(data))
	}
}

func TestTabularValidation(t *testing.T) {
	if _, err := NewTabularConvert().Steps()[0].Run(context.Background(), tool.Input{}, nil); err == nil {
		t.Fatal("sem arquivos deveria falhar")
	}
	if _, err := NewSpreadsheetCompare().Steps()[0].Run(context.Background(), tool.Input{Paths: []string{"um"}}, nil); err == nil {
		t.Fatal("diff com 1 arquivo deveria falhar")
	}
}

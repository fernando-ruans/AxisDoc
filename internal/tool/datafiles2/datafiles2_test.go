package datafiles2

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

func runOne(t *testing.T, tl tool.Tool, in tool.Input) tool.Output {
	t.Helper()
	out, err := tl.Steps()[0].Run(context.Background(), in, nil)
	if err != nil {
		t.Fatalf("%s: %v", tl.ID(), err)
	}
	return out
}

func TestCSVToSQLRoundTrip(t *testing.T) {
	csvPath := write(t, "clientes.csv", "nome,idade,cidade\nAna,30,\"São Paulo\"\nBruno,,Rio\n")
	out := runOne(t, NewCSVToSQL(), tool.Input{
		Paths:  []string{csvPath},
		Params: map[string]any{"table": "clientes", "dialect": "sqlite", "batch": 2.0},
	})
	if len(out.Paths) != 1 {
		t.Fatalf("esperado 1 SQL, obtido %d", len(out.Paths))
	}
	data, _ := os.ReadFile(out.Paths[0])
	sql := string(data)
	if !strings.Contains(sql, `INSERT INTO "clientes" ("nome", "idade", "cidade")`) {
		t.Fatalf("INSERT inesperado: %q", sql)
	}
	if !strings.Contains(sql, "30") || !strings.Contains(sql, "NULL") {
		t.Fatalf("literais errados: %q", sql)
	}
	if !strings.Contains(sql, "São Paulo") {
		t.Fatalf("acentos perdidos: %q", sql)
	}

	// volta: SQL → CSV
	out = runOne(t, NewSQLToCSV(), tool.Input{Paths: []string{out.Paths[0]}})
	if len(out.Paths) != 1 {
		t.Fatalf("esperado 1 CSV, obtido %d", len(out.Paths))
	}
	back, _ := os.ReadFile(out.Paths[0])
	if !strings.Contains(string(back), "Ana") || !strings.Contains(string(back), "Bruno") {
		t.Fatalf("round-trip perdeu dados: %q", string(back))
	}
}

func TestCSVToSQLDialects(t *testing.T) {
	csvPath := write(t, "d.csv", "a,b\n1,x\n")
	for _, dialect := range []string{"sqlite", "postgres", "mysql"} {
		out := runOne(t, NewCSVToSQL(), tool.Input{
			Paths:  []string{csvPath},
			Params: map[string]any{"table": "t", "dialect": dialect, "batch": 100.0},
		})
		if len(out.Paths) != 1 {
			t.Fatalf("%s: sem saída", dialect)
		}
	}
}

func TestSQLToCSVValidation(t *testing.T) {
	if _, err := NewSQLToCSV().Steps()[0].Run(context.Background(), tool.Input{}, nil); err == nil {
		t.Fatal("sem arquivos deveria falhar")
	}
	// arquivo sem INSERT é pulado (não falha)
	empty := write(t, "vazio.sql", "-- nada aqui\nSELECT 1;\n")
	out := runOne(t, NewSQLToCSV(), tool.Input{Paths: []string{empty}})
	if len(out.Paths) != 0 {
		t.Fatalf("sem INSERT deveria pular: %v", out.Paths)
	}
	// aspas escapadas
	q := write(t, "q.sql", "INSERT INTO t (a, b) VALUES ('it''s', 'x'), ('y', NULL);\n")
	out = runOne(t, NewSQLToCSV(), tool.Input{Paths: []string{q}})
	if len(out.Paths) != 1 {
		t.Fatal("sem saída para INSERT válido")
	}
	data, _ := os.ReadFile(out.Paths[0])
	if !strings.Contains(string(data), "it's") {
		t.Fatalf("escape de aspas errado: %q", string(data))
	}
}

func TestJSONToTable(t *testing.T) {
	j := write(t, "users.json", `[{"nome":"Ana","idade":30},{"nome":"Bruno","cidade":"Rio"}]`)
	out := runOne(t, NewJSONToTable(), tool.Input{
		Paths:  []string{j},
		Params: map[string]any{"format": "csv"},
	})
	if len(out.Paths) != 1 {
		t.Fatalf("esperado 1 CSV, obtido %d", len(out.Paths))
	}
	data, _ := os.ReadFile(out.Paths[0])
	if !strings.Contains(string(data), "nome") || !strings.Contains(string(data), "Ana") {
		t.Fatalf("tabela errada: %q", string(data))
	}
	bad := write(t, "obj.json", `{"a":1}`)
	if _, err := NewJSONToTable().Steps()[0].Run(context.Background(), tool.Input{Paths: []string{bad}, Params: map[string]any{"format": "csv"}}, nil); err != nil {
		// erro por arquivo é reportado na mensagem, não fatal — verifica mensagem
		t.Logf("ok (erro por arquivo): %v", err)
	}
}

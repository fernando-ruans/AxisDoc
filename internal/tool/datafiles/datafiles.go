// Package datafiles implementa conversores de dados: CSV, XLSX, JSON, YAML, TOML.
package datafiles

import (
	"context"
	"encoding/csv"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/BurntSushi/toml"
	"github.com/xuri/excelize/v2"
	"gopkg.in/yaml.v3"

	"github.com/ferna/axisdoc/internal/output"
	"github.com/ferna/axisdoc/internal/tool"
)

func fileStem(p string) string {
	baseName := filepath.Base(p)
	if i := strings.LastIndexByte(baseName, '.'); i > 0 {
		return baseName[:i]
	}
	return baseName
}

type base struct {
	id, cat, title, desc, icon string
}

func (b base) ID() string          { return b.id }
func (b base) Category() string    { return b.cat }
func (b base) Title() string       { return b.title }
func (b base) Description() string { return b.desc }
func (b base) Icon() string        { return b.icon }

type stepFunc struct {
	name  string
	runFn func(ctx context.Context, in tool.Input, report func(pct float64)) (tool.Output, error)
}

func (s stepFunc) Name() string { return s.name }
func (s stepFunc) Run(ctx context.Context, in tool.Input, report func(pct float64)) (tool.Output, error) {
	return s.runFn(ctx, in, report)
}

// --- leitura tabular genérica ---

// readTabular lê CSV ou XLSX como matriz de strings.
func readTabular(path string) ([][]string, error) {
	return ReadTabular(path)
}

// ReadTabular lê CSV ou XLSX como matriz de strings (exportado para preview).
func ReadTabular(path string) ([][]string, error) {
	switch strings.ToLower(filepath.Ext(path)) {
	case ".csv":
		return readCSV(path)
	case ".xlsx", ".xlsm":
		return readXLSX(path)
	default:
		return nil, fmt.Errorf("datafiles: formato de tabela não suportado: %s", filepath.Ext(path))
	}
}

func readCSV(path string) ([][]string, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer f.Close()
	r := csv.NewReader(f)
	r.FieldsPerRecord = -1 // tolera linhas de larguras diferentes
	return r.ReadAll()
}

func readXLSX(path string) ([][]string, error) {
	f, err := excelize.OpenFile(path)
	if err != nil {
		return nil, err
	}
	defer f.Close()
	sheet := f.GetSheetList()[0]
	return f.GetRows(sheet)
}

// writeTabular grava matriz como CSV ou XLSX.
func writeTabular(rows [][]string, dest string) error {
	switch strings.ToLower(filepath.Ext(dest)) {
	case ".csv":
		return writeCSV(rows, dest)
	case ".xlsx":
		return writeXLSX(rows, dest)
	default:
		return fmt.Errorf("datafiles: formato de tabela não suportado: %s", filepath.Ext(dest))
	}
}

func writeCSV(rows [][]string, dest string) error {
	f, err := os.Create(dest)
	if err != nil {
		return err
	}
	defer f.Close()
	w := csv.NewWriter(f)
	w.WriteAll(rows)
	return w.Error()
}

func writeXLSX(rows [][]string, dest string) error {
	f := excelize.NewFile()
	defer f.Close()
	sheet := f.GetSheetName(0)
	for i, row := range rows {
		cell, _ := excelize.CoordinatesToCellName(1, i+1)
		if err := f.SetSheetRow(sheet, cell, &row); err != nil {
			return err
		}
	}
	return f.SaveAs(dest)
}

// CSVToXLSX converte CSV ↔ XLSX nos dois sentidos.
type TabularConvert struct{ base }

func NewTabularConvert() *TabularConvert {
	return &TabularConvert{base{"data.tabular", "data", "tool.tabular.title", "tool.tabular.desc", "table-2"}}
}

func (t *TabularConvert) Params() []tool.Param {
	return []tool.Param{
		{Key: "format", Label: "param.data.format.label", Type: tool.ParamSelect,
			Options: []string{"xlsx", "csv"}, Default: "xlsx", Required: true},
		{Key: "outputDir", Label: "param.outputDir.label", Type: tool.ParamFolder},
	}
}

func (t *TabularConvert) Steps() []tool.Step {
	return []tool.Step{stepFunc{"step.data.tabular", t.run}}
}

func (t *TabularConvert) run(_ context.Context, in tool.Input, report func(pct float64)) (tool.Output, error) {
	if len(in.Paths) == 0 {
		return tool.Output{}, fmt.Errorf("datafiles: nenhum arquivo")
	}
	format := tool.ParamString(in, "format", "xlsx")
	var outs []string
	var sb strings.Builder
	for i, p := range in.Paths {
		rows, err := readTabular(p)
		if err != nil {
			fmt.Fprintf(&sb, "ERRO %s: %v\n", filepath.Base(p), err)
			continue
		}
		dest := output.NextAvailablePath(filepath.Join(tool.OutputDir(in), fmt.Sprintf("%s.%s", fileStem(p), format)))
		if err := writeTabular(rows, dest); err != nil {
			fmt.Fprintf(&sb, "ERRO %s: %v\n", filepath.Base(p), err)
			continue
		}
		outs = append(outs, dest)
		fmt.Fprintf(&sb, "%s: %d linhas convertidas\n", filepath.Base(p), len(rows))
		if report != nil {
			report(float64(i+1) / float64(len(in.Paths)) * 100)
		}
	}
	return tool.Output{Paths: outs, Message: strings.TrimRight(sb.String(), "\n")}, nil
}

// SpreadsheetCompare compara duas planilhas célula a célula.
type SpreadsheetCompare struct{ base }

func NewSpreadsheetCompare() *SpreadsheetCompare {
	return &SpreadsheetCompare{base{"data.xlsxdiff", "data", "tool.xlsxdiff.title", "tool.xlsxdiff.desc", "git-compare"}}
}

func (t *SpreadsheetCompare) Params() []tool.Param { return nil }

func (t *SpreadsheetCompare) Steps() []tool.Step {
	return []tool.Step{stepFunc{"step.data.xlsxdiff", t.run}}
}

func (t *SpreadsheetCompare) run(_ context.Context, in tool.Input, _ func(pct float64)) (tool.Output, error) {
	if len(in.Paths) != 2 {
		return tool.Output{}, fmt.Errorf("datafiles: selecione exatamente 2 planilhas")
	}
	rowsA, err := readTabular(in.Paths[0])
	if err != nil {
		return tool.Output{}, err
	}
	rowsB, err := readTabular(in.Paths[1])
	if err != nil {
		return tool.Output{}, err
	}
	var sb strings.Builder
	maxRows := len(rowsA)
	if len(rowsB) > maxRows {
		maxRows = len(rowsB)
	}
	diffs := 0
	for r := 0; r < maxRows; r++ {
		var cellA, cellB string
		if r < len(rowsA) {
			cellA = strings.Join(rowsA[r], " | ")
		}
		if r < len(rowsB) {
			cellB = strings.Join(rowsB[r], " | ")
		}
		if cellA != cellB {
			diffs++
			if diffs <= 20 {
				fmt.Fprintf(&sb, "linha %d:\n  A: %s\n  B: %s\n", r+1, cellA, cellB)
			}
		}
	}
	if diffs == 0 {
		sb.WriteString("planilhas idênticas")
	} else if diffs > 20 {
		fmt.Fprintf(&sb, "... e mais %d diferenças", diffs-20)
	}
	return tool.Output{Message: fmt.Sprintf("%d diferenças\n%s", diffs, sb.String())}, nil
}

// --- JSON/YAML/TOML ---

// readAnyStruct lê JSON, YAML ou TOML em map genérico.
func readAnyStruct(path string) (map[string]any, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	switch strings.ToLower(filepath.Ext(path)) {
	case ".json":
		var m map[string]any
		if err := json.Unmarshal(data, &m); err != nil {
			return nil, fmt.Errorf("json inválido: %w", err)
		}
		return m, nil
	case ".yaml", ".yml":
		var m map[string]any
		if err := yaml.Unmarshal(data, &m); err != nil {
			return nil, fmt.Errorf("yaml inválido: %w", err)
		}
		return m, nil
	case ".toml":
		var m map[string]any
		if _, err := toml.Decode(string(data), &m); err != nil {
			return nil, fmt.Errorf("toml inválido: %w", err)
		}
		return m, nil
	default:
		return nil, fmt.Errorf("datafiles: formato não suportado: %s", filepath.Ext(path))
	}
}

func writeAnyStruct(m map[string]any, dest string) error {
	var (
		data []byte
		err  error
	)
	switch strings.ToLower(filepath.Ext(dest)) {
	case ".json":
		data, err = json.MarshalIndent(m, "", "  ")
	case ".yaml", ".yml":
		var b strings.Builder
		enc := yaml.NewEncoder(&b)
		enc.SetIndent(2)
		if err = enc.Encode(m); err == nil {
			err = enc.Close()
		}
		data = []byte(b.String())
	case ".toml":
		sb := &strings.Builder{}
		if err = toml.NewEncoder(sb).Encode(m); err == nil {
			data = []byte(sb.String())
		}
	default:
		return fmt.Errorf("datafiles: formato não suportado: %s", filepath.Ext(dest))
	}
	if err != nil {
		return err
	}
	return output.WriteFile(dest, data)
}

// StructConvert converte JSON ↔ YAML ↔ TOML.
type StructConvert struct{ base }

func NewStructConvert() *StructConvert {
	return &StructConvert{base{"data.struct", "data", "tool.struct.title", "tool.struct.desc", "braces"}}
}

func (t *StructConvert) Params() []tool.Param {
	return []tool.Param{
		{Key: "format", Label: "param.data.format2.label", Type: tool.ParamSelect,
			Options: []string{"json", "yaml", "toml"}, Default: "yaml", Required: true},
		{Key: "outputDir", Label: "param.outputDir.label", Type: tool.ParamFolder},
	}
}

func (t *StructConvert) Steps() []tool.Step {
	return []tool.Step{stepFunc{"step.data.struct", t.run}}
}

func (t *StructConvert) run(_ context.Context, in tool.Input, _ func(pct float64)) (tool.Output, error) {
	if len(in.Paths) == 0 {
		return tool.Output{}, fmt.Errorf("datafiles: nenhum arquivo")
	}
	format := tool.ParamString(in, "format", "yaml")
	var outs []string
	var sb strings.Builder
	for _, p := range in.Paths {
		m, err := readAnyStruct(p)
		if err != nil {
			fmt.Fprintf(&sb, "ERRO %s: %v\n", filepath.Base(p), err)
			continue
		}
		dest := output.NextAvailablePath(filepath.Join(tool.OutputDir(in), fmt.Sprintf("%s.%s", fileStem(p), format)))
		if err := writeAnyStruct(m, dest); err != nil {
			fmt.Fprintf(&sb, "ERRO %s: %v\n", filepath.Base(p), err)
			continue
		}
		outs = append(outs, dest)
	}
	return tool.Output{Paths: outs, Message: strings.TrimRight(sb.String(), "\n")}, nil
}

// JSONFormat valida e formata/minifica JSON.
type JSONFormat struct{ base }

func NewJSONFormat() *JSONFormat {
	return &JSONFormat{base{"data.jsonformat", "data", "tool.jsonformat.title", "tool.jsonformat.desc", "code"}}
}

func (t *JSONFormat) Params() []tool.Param {
	return []tool.Param{
		{Key: "mode", Label: "param.data.mode.label", Type: tool.ParamSelect,
			Options: []string{"format", "minify"}, Default: "format"},
	}
}

func (t *JSONFormat) Steps() []tool.Step {
	return []tool.Step{stepFunc{"step.data.jsonformat", t.run}}
}

func (t *JSONFormat) run(_ context.Context, in tool.Input, _ func(pct float64)) (tool.Output, error) {
	if len(in.Paths) == 0 {
		return tool.Output{}, fmt.Errorf("datafiles: nenhum arquivo")
	}
	mode := tool.ParamString(in, "mode", "format")
	var sb strings.Builder
	for _, p := range in.Paths {
		data, err := os.ReadFile(p)
		if err != nil {
			fmt.Fprintf(&sb, "ERRO %s: %v\n", p, err)
			continue
		}
		var v any
		if err := json.Unmarshal(data, &v); err != nil {
			fmt.Fprintf(&sb, "%s: JSON INVÁLIDO: %v\n", filepath.Base(p), err)
			continue
		}
		var out []byte
		if mode == "minify" {
			out, _ = json.Marshal(v)
		} else {
			out, _ = json.MarshalIndent(v, "", "  ")
		}
		fmt.Fprintf(&sb, "%s: JSON válido (%d bytes → %d bytes)\n", filepath.Base(p), len(data), len(out))
	}
	return tool.Output{Message: strings.TrimRight(sb.String(), "\n")}, nil
}

// TableToJSON converte CSV/XLSX para JSON (array de objetos).
type TableToJSON struct{ base }

func NewTableToJSON() *TableToJSON {
	return &TableToJSON{base{"data.tablejson", "data", "tool.tablejson.title", "tool.tablejson.desc", "file-json"}}
}

func (t *TableToJSON) Params() []tool.Param {
	return []tool.Param{
		{Key: "outputDir", Label: "param.outputDir.label", Type: tool.ParamFolder},
	}
}

func (t *TableToJSON) Steps() []tool.Step {
	return []tool.Step{stepFunc{"step.data.tablejson", t.run}}
}

func (t *TableToJSON) run(_ context.Context, in tool.Input, _ func(pct float64)) (tool.Output, error) {
	if len(in.Paths) == 0 {
		return tool.Output{}, fmt.Errorf("datafiles: nenhum arquivo")
	}
	var outs []string
	var sb strings.Builder
	for _, p := range in.Paths {
		rows, err := readTabular(p)
		if err != nil {
			fmt.Fprintf(&sb, "ERRO %s: %v\n", filepath.Base(p), err)
			continue
		}
		if len(rows) < 1 {
			continue
		}
		header := rows[0]
		records := make([]map[string]string, 0, len(rows)-1)
		for _, row := range rows[1:] {
			obj := make(map[string]string, len(header))
			for i, h := range header {
				if i < len(row) {
					obj[h] = row[i]
				}
			}
			records = append(records, obj)
		}
		dest := output.NextAvailablePath(filepath.Join(tool.OutputDir(in), fileStem(p)+".json"))
		data, err := json.MarshalIndent(records, "", "  ")
		if err != nil {
			fmt.Fprintf(&sb, "ERRO %s: %v\n", filepath.Base(p), err)
			continue
		}
		if err := output.WriteFile(dest, data); err != nil {
			return tool.Output{}, err
		}
		outs = append(outs, dest)
		fmt.Fprintf(&sb, "%s: %d registros\n", filepath.Base(p), len(records))
	}
	return tool.Output{Paths: outs, Message: strings.TrimRight(sb.String(), "\n")}, nil
}

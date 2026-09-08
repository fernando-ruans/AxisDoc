// Package datafiles2 implementa a segunda leva de ferramentas de dados (FASE D).
// CSV↔SQL, JSON→tabela — reusa a infra tabular de datafiles.
package datafiles2

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/ferna/axisdoc/internal/output"
	"github.com/ferna/axisdoc/internal/tool"
	"github.com/ferna/axisdoc/internal/tool/datafiles"
)

// base compartilha metadados.
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

func fileStem(p string) string {
	b := filepath.Base(p)
	if i := strings.LastIndexByte(b, '.'); i > 0 {
		return b[:i]
	}
	return b
}

// ---- 1. CSV/Tabela → SQL INSERTs ----

type CSVToSQL struct{ base }

func NewCSVToSQL() *CSVToSQL {
	return &CSVToSQL{base{"data.csv2sql", "data", "tool.csv2sql.title", "tool.csv2sql.desc", "database-zap"}}
}

func (t *CSVToSQL) Params() []tool.Param {
	return []tool.Param{
		{Key: "table", Label: "param.data.table.label", Type: tool.ParamText, Required: true, Default: "dados"},
		{Key: "dialect", Label: "param.data.dialect.label", Type: tool.ParamSelect,
			Options: []string{"sqlite", "postgres", "mysql"}, Default: "sqlite"},
		{Key: "batch", Label: "param.data.batch.label", Type: tool.ParamNumber, Default: 100, Min: 1, Max: 10000},
	}
}

func (t *CSVToSQL) Steps() []tool.Step {
	return []tool.Step{stepFunc{"step.data.csv2sql", t.run}}
}

func (t *CSVToSQL) run(_ context.Context, in tool.Input, _ func(pct float64)) (tool.Output, error) {
	if len(in.Paths) == 0 {
		return tool.Output{}, fmt.Errorf("data.csv2sql: nenhum arquivo")
	}
	table := tool.ParamString(in, "table", "dados")
	dialect := tool.ParamString(in, "dialect", "sqlite")
	batch := int(tool.ParamFloat(in, "batch", 100))
	if batch < 1 {
		batch = 100
	}
	var outs []string
	var sb strings.Builder
	for _, p := range in.Paths {
		rows, err := datafiles.ReadTabular(p)
		if err != nil {
			fmt.Fprintf(&sb, "ERRO %s: %v\n", filepath.Base(p), err)
			continue
		}
		if len(rows) < 1 {
			fmt.Fprintf(&sb, "PULADO %s: tabela vazia\n", filepath.Base(p))
			continue
		}
		dest := output.NextAvailablePath(filepath.Join(tool.OutputDir(in), fileStem(p)+".sql"))
		sql := generateInserts(table, dialect, rows, batch)
		if err := output.WriteFile(dest, []byte(sql)); err != nil {
			return tool.Output{}, err
		}
		outs = append(outs, dest)
		fmt.Fprintf(&sb, "%s: %d linhas → SQL\n", filepath.Base(p), len(rows)-1)
	}
	return tool.Output{Paths: outs, Message: strings.TrimRight(sb.String(), "\n")}, nil
}

// generateInserts cria INSERTs em lote com detecção de número vs string.
func generateInserts(table, dialect string, rows [][]string, batch int) string {
	var sb strings.Builder
	header := sanitizeCols(rows[0], dialect)
	isNum := make([]bool, len(header))
	for j, h := range header {
		_ = h
		isNum[j] = columnIsNumeric(rows, j)
	}
	idTable := quoteIdent(table, dialect)
	cols := make([]string, len(header))
	for j, h := range header {
		cols[j] = quoteIdent(h, dialect)
	}
	for i := 1; i < len(rows); i += batch {
		end := i + batch
		if end > len(rows) {
			end = len(rows)
		}
		sb.WriteString("INSERT INTO " + idTable + " (" + strings.Join(cols, ", ") + ") VALUES\n")
		for r := i; r < end; r++ {
			sb.WriteString("  (")
			vals := make([]string, len(header))
			for j := range header {
				v := ""
				if j < len(rows[r]) {
					v = rows[r][j]
				}
				vals[j] = sqlLiteral(v, isNum[j], dialect)
			}
			sb.WriteString(strings.Join(vals, ", "))
			if r+1 < end {
				sb.WriteString("),\n")
			} else {
				sb.WriteString(");\n")
			}
		}
	}
	return sb.String()
}

func sanitizeCols(cols []string, _ string) []string {
	out := make([]string, len(cols))
	for i, c := range cols {
		c = strings.TrimSpace(c)
		if c == "" {
			c = fmt.Sprintf("col%d", i+1)
		}
		out[i] = c
	}
	return out
}

func columnIsNumeric(rows [][]string, col int) bool {
	seen := 0
	for i := 1; i < len(rows); i++ {
		if col >= len(rows[i]) {
			continue
		}
		v := strings.TrimSpace(rows[i][col])
		if v == "" {
			continue
		}
		seen++
		if _, err := strconv.ParseFloat(v, 64); err != nil {
			return false
		}
	}
	return seen > 0
}

func quoteIdent(name, dialect string) string {
	switch dialect {
	case "mysql":
		return "`" + strings.ReplaceAll(name, "`", "``") + "`"
	case "postgres":
		return `"` + strings.ReplaceAll(name, `"`, `""`) + `"`
	default: // sqlite
		return `"` + strings.ReplaceAll(name, `"`, `""`) + `"`
	}
}

func sqlLiteral(v string, numeric bool, dialect string) string {
	v = strings.TrimSpace(v)
	if v == "" {
		return "NULL"
	}
	if numeric {
		return v
	}
	switch dialect {
	case "mysql":
		return "'" + strings.ReplaceAll(strings.ReplaceAll(v, `\`, `\\`), "'", `\'`) + "'"
	default:
		return "'" + strings.ReplaceAll(v, "'", "''") + "'"
	}
}

// ---- 2. SQL → CSV ----

type SQLToCSV struct{ base }

func NewSQLToCSV() *SQLToCSV {
	return &SQLToCSV{base{"data.sql2csv", "data", "tool.sql2csv.title", "tool.sql2csv.desc", "file-spreadsheet"}}
}

func (t *SQLToCSV) Params() []tool.Param { return nil }

func (t *SQLToCSV) Steps() []tool.Step {
	return []tool.Step{stepFunc{"step.data.sql2csv", t.run}}
}

func (t *SQLToCSV) run(_ context.Context, in tool.Input, _ func(pct float64)) (tool.Output, error) {
	if len(in.Paths) == 0 {
		return tool.Output{}, fmt.Errorf("data.sql2csv: nenhum arquivo")
	}
	var outs []string
	var sb strings.Builder
	for _, p := range in.Paths {
		data, err := os.ReadFile(p)
		if err != nil {
			fmt.Fprintf(&sb, "ERRO %s: %v\n", filepath.Base(p), err)
			continue
		}
		rows, err := parseInsertValues(string(data))
		if err != nil {
			fmt.Fprintf(&sb, "ERRO %s: %v\n", filepath.Base(p), err)
			continue
		}
		if len(rows) == 0 {
			fmt.Fprintf(&sb, "PULADO %s: nenhum INSERT encontrado\n", filepath.Base(p))
			continue
		}
		dest := output.NextAvailablePath(filepath.Join(tool.OutputDir(in), fileStem(p)+".csv"))
		if err := datafiles.WriteTabular(rows, dest); err != nil {
			return tool.Output{}, err
		}
		outs = append(outs, dest)
		fmt.Fprintf(&sb, "%s: %d linhas\n", filepath.Base(p), len(rows))
	}
	return tool.Output{Paths: outs, Message: strings.TrimRight(sb.String(), "\n")}, nil
}

// parseInsertValues extrai linhas de VALUES de dumps INSERT simples.
func parseInsertValues(sql string) ([][]string, error) {
	var header []string
	var rows [][]string
	for _, stmt := range splitStatements(sql) {
		upper := strings.ToUpper(strings.TrimSpace(stmt))
		if !strings.HasPrefix(upper, "INSERT") {
			continue
		}
		cols, vals, err := parseInsert(stmt)
		if err != nil {
			continue // ignora statements que não entende
		}
		if header == nil {
			header = cols
			rows = append(rows, cols)
		}
		for _, v := range vals {
			row := make([]string, len(header))
			copy(row, v)
			rows = append(rows, row)
		}
	}
	return rows, nil
}

func splitStatements(sql string) []string {
	var out []string
	var cur strings.Builder
	inStr := false
	quote := byte(0)
	for i := 0; i < len(sql); i++ {
		c := sql[i]
		if inStr {
			cur.WriteByte(c)
			if c == quote {
				if i+1 < len(sql) && sql[i+1] == quote {
					cur.WriteByte(sql[i+1])
					i++
				} else {
					inStr = false
				}
			}
			continue
		}
		if c == '\'' || c == '"' || c == '`' {
			inStr = true
			quote = c
			cur.WriteByte(c)
			continue
		}
		if c == ';' {
			out = append(out, cur.String())
			cur.Reset()
			continue
		}
		cur.WriteByte(c)
	}
	if strings.TrimSpace(cur.String()) != "" {
		out = append(out, cur.String())
	}
	return out
}

// parseInsert extrai colunas e linhas de VALUES de um INSERT simples.
func parseInsert(stmt string) ([]string, [][]string, error) {
	upper := strings.ToUpper(stmt)
	idx := strings.Index(upper, "VALUES")
	if idx < 0 {
		return nil, nil, fmt.Errorf("sem VALUES")
	}
	head := stmt[:idx]
	lp := strings.Index(head, "(")
	rp := strings.LastIndex(head, ")")
	if lp < 0 || rp < 0 || rp < lp {
		return nil, nil, fmt.Errorf("sem colunas")
	}
	var cols []string
	for _, c := range strings.Split(head[lp+1:rp], ",") {
		c = strings.TrimSpace(c)
		c = strings.Trim(c, `"'`+"`")
		cols = append(cols, c)
	}
	valsPart := strings.TrimSpace(stmt[idx+len("VALUES"):])
	var rows [][]string
	for len(valsPart) > 0 {
		valsPart = strings.TrimSpace(valsPart)
		if !strings.HasPrefix(valsPart, "(") {
			break
		}
		depth := 0
		inStr := false
		quote := byte(0)
		end := -1
		for i := 0; i < len(valsPart); i++ {
			c := valsPart[i]
			if inStr {
				if c == quote {
					if i+1 < len(valsPart) && valsPart[i+1] == quote {
						i++
					} else {
						inStr = false
					}
				}
				continue
			}
			switch c {
			case '\'', '"':
				inStr = true
				quote = c
			case '(':
				depth++
			case ')':
				depth--
				if depth == 0 {
					end = i
				}
			}
			if end >= 0 {
				break
			}
		}
		if end < 0 {
			break
		}
		row := splitCSVRespectingQuotes(valsPart[1:end])
		rows = append(rows, row)
		valsPart = strings.TrimSpace(valsPart[end+1:])
		valsPart = strings.TrimPrefix(valsPart, ",")
	}
	return cols, rows, nil
}

func splitCSVRespectingQuotes(s string) []string {
	var out []string
	var cur strings.Builder
	inStr := false
	quote := byte(0)
	for i := 0; i < len(s); i++ {
		c := s[i]
		if inStr {
			if c == quote {
				if i+1 < len(s) && s[i+1] == quote {
					cur.WriteByte(c)
					i++
				} else {
					inStr = false
				}
				continue
			}
			cur.WriteByte(c)
			continue
		}
		if c == '\'' || c == '"' {
			inStr = true
			quote = c
			continue
		}
		if c == ',' {
			out = append(out, strings.TrimSpace(cur.String()))
			cur.Reset()
			continue
		}
		cur.WriteByte(c)
	}
	out = append(out, strings.TrimSpace(cur.String()))
	for i, v := range out {
		if strings.EqualFold(v, "NULL") {
			out[i] = ""
		}
	}
	return out
}

// ---- 3. JSON → tabela (XLSX/CSV) ----

type JSONToTable struct{ base }

func NewJSONToTable() *JSONToTable {
	return &JSONToTable{base{"data.json2table", "data", "tool.json2table.title", "tool.json2table.desc", "table"}}
}

func (t *JSONToTable) Params() []tool.Param {
	return []tool.Param{
		{Key: "format", Label: "param.data.format.label", Type: tool.ParamSelect,
			Options: []string{"xlsx", "csv"}, Default: "xlsx", Required: true},
	}
}

func (t *JSONToTable) Steps() []tool.Step {
	return []tool.Step{stepFunc{"step.data.json2table", t.run}}
}

func (t *JSONToTable) run(_ context.Context, in tool.Input, _ func(pct float64)) (tool.Output, error) {
	if len(in.Paths) == 0 {
		return tool.Output{}, fmt.Errorf("data.json2table: nenhum arquivo")
	}
	format := tool.ParamString(in, "format", "xlsx")
	var outs []string
	var sb strings.Builder
	for _, p := range in.Paths {
		rows, err := datafiles.ReadAnyArray(p)
		if err != nil {
			fmt.Fprintf(&sb, "ERRO %s: %v\n", filepath.Base(p), err)
			continue
		}
		table := datafiles.ArrayToTable(rows)
		dest := output.NextAvailablePath(filepath.Join(tool.OutputDir(in), fmt.Sprintf("%s.%s", fileStem(p), format)))
		if err := datafiles.WriteTabular(table, dest); err != nil {
			return tool.Output{}, err
		}
		outs = append(outs, dest)
		fmt.Fprintf(&sb, "%s: %d registros\n", filepath.Base(p), len(rows))
	}
	return tool.Output{Paths: outs, Message: strings.TrimRight(sb.String(), "\n")}, nil
}

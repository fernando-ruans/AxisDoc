// Package texttools2 implementa a segunda leva de ferramentas de texto (FASE D).
// Geradores e conversores puros (sem arquivos de entrada na maioria).
package texttools2

import (
	"context"
	"fmt"
	"html"
	"math/rand"
	"net/url"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"
	"unicode"

	"github.com/google/uuid"
	"golang.org/x/text/runes"
	"golang.org/x/text/transform"
	"golang.org/x/text/unicode/norm"

	"github.com/ferna/axisdoc/internal/output"
	"github.com/ferna/axisdoc/internal/tool"
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

func outputDirParam() tool.Param {
	return tool.Param{Key: "outputDir", Label: "param.outputDir.label", Type: tool.ParamFolder}
}

// ---- 1. Lorem ipsum ----

var loremWords = []string{
	"lorem", "ipsum", "dolor", "sit", "amet", "consectetur", "adipiscing", "elit",
	"sed", "do", "eiusmod", "tempor", "incididunt", "ut", "labore", "et", "dolore",
	"magna", "aliqua", "enim", "ad", "minim", "veniam", "quis", "nostrud",
	"exercitation", "ullamco", "laboris", "nisi", "aliquip", "ex", "ea", "commodo",
	"consequat", "duis", "aute", "irure", "in", "reprehenderit", "voluptate",
	"velit", "esse", "cillum", "fugiat", "nulla", "pariatur", "excepteur", "sint",
	"occaecat", "cupidatat", "non", "proident", "sunt", "culpa", "qui", "officia",
	"deserunt", "mollit", "anim", "id", "est", "laborum",
}

type Lorem struct{ base }

func NewLorem() *Lorem {
	return &Lorem{base{"text.lorem", "text", "tool.lorem.title", "tool.lorem.desc", "align-left"}}
}

func (t *Lorem) Params() []tool.Param {
	return []tool.Param{
		{Key: "paragraphs", Label: "param.text.paragraphs.label", Type: tool.ParamNumber, Default: 3, Min: 1, Max: 100},
		{Key: "wordsPerParagraph", Label: "param.text.words.label", Type: tool.ParamNumber, Default: 60, Min: 5, Max: 500},
		outputDirParam(),
	}
}

func (t *Lorem) Steps() []tool.Step {
	return []tool.Step{stepFunc{"step.text.lorem", t.run}}
}

func (t *Lorem) run(_ context.Context, in tool.Input, _ func(pct float64)) (tool.Output, error) {
	n := int(tool.ParamFloat(in, "paragraphs", 3))
	w := int(tool.ParamFloat(in, "wordsPerParagraph", 60))
	if n < 1 {
		n = 1
	}
	if w < 1 {
		w = 60
	}
	var sb strings.Builder
	rng := rand.New(rand.NewSource(time.Now().UnixNano()))
	for p := 0; p < n; p++ {
		for i := 0; i < w; i++ {
			if i > 0 {
				sb.WriteByte(' ')
			}
			word := loremWords[rng.Intn(len(loremWords))]
			if i == 0 {
				word = strings.ToUpper(word[:1]) + word[1:]
			}
			sb.WriteString(word)
			if i == w-1 {
				sb.WriteByte('.')
			} else if rng.Intn(12) == 0 {
				sb.WriteString(",")
			}
		}
		sb.WriteString("\n\n")
	}
	dest := output.NextAvailablePath(filepath.Join(tool.OutputDir(in), "lorem.txt"))
	if err := output.WriteFile(dest, []byte(strings.TrimSpace(sb.String()))); err != nil {
		return tool.Output{}, err
	}
	return tool.Output{Paths: []string{dest}, Message: fmt.Sprintf("%d parágrafo(s) gerados", n)}, nil
}

// ---- 2. Conversor de base numérica ----

type BaseConvert struct{ base }

func NewBaseConvert() *BaseConvert {
	return &BaseConvert{base{"text.baseconvert", "text", "tool.baseconvert.title", "tool.baseconvert.desc", "binary"}}
}

func (t *BaseConvert) Params() []tool.Param {
	return []tool.Param{
		{Key: "value", Label: "param.text.value.label", Type: tool.ParamText, Required: true, Default: ""},
		{Key: "from", Label: "param.text.frombase.label", Type: tool.ParamSelect,
			Options: []string{"10", "16", "8", "2", "36"}, Default: "10"},
		{Key: "to", Label: "param.text.tobase.label", Type: tool.ParamSelect,
			Options: []string{"10", "16", "8", "2", "36"}, Default: "16"},
	}
}

func (t *BaseConvert) Steps() []tool.Step {
	return []tool.Step{stepFunc{"step.text.baseconvert", t.run}}
}

func (t *BaseConvert) run(_ context.Context, in tool.Input, _ func(pct float64)) (tool.Output, error) {
	raw := strings.TrimSpace(tool.ParamString(in, "value", ""))
	if raw == "" {
		return tool.Output{}, fmt.Errorf("text.baseconvert: informe o valor")
	}
	from, _ := strconv.Atoi(tool.ParamString(in, "from", "10"))
	to, _ := strconv.Atoi(tool.ParamString(in, "to", "16"))
	num, err := strconv.ParseInt(raw, from, 64)
	if err != nil {
		return tool.Output{}, fmt.Errorf("text.baseconvert: valor inválido na base %d: %w", from, err)
	}
	msg := fmt.Sprintf("%s (base %d) = %s (base %d)", raw, from, strconv.FormatInt(num, to), to)
	return tool.Output{Message: msg}, nil
}

// ---- 3. Timestamp/epoch ----

type Epoch struct{ base }

func NewEpoch() *Epoch {
	return &Epoch{base{"text.epoch", "text", "tool.epoch.title", "tool.epoch.desc", "clock"}}
}

func (t *Epoch) Params() []tool.Param {
	return []tool.Param{
		{Key: "mode", Label: "param.data.mode.label", Type: tool.ParamSelect,
			Options: []string{"now", "toDate", "toEpoch"}, Default: "now"},
		{Key: "value", Label: "param.text.value.label", Type: tool.ParamText, Default: ""},
	}
}

func (t *Epoch) Steps() []tool.Step {
	return []tool.Step{stepFunc{"step.text.epoch", t.run}}
}

func (t *Epoch) run(_ context.Context, in tool.Input, _ func(pct float64)) (tool.Output, error) {
	mode := tool.ParamString(in, "mode", "now")
	val := strings.TrimSpace(tool.ParamString(in, "value", ""))
	switch mode {
	case "now":
		now := time.Now()
		return tool.Output{Message: fmt.Sprintf("agora:\n  epoch: %d\n  UTC: %s\n  local: %s",
			now.Unix(), now.UTC().Format(time.RFC3339), now.Format(time.RFC3339))}, nil
	case "toDate":
		sec, err := strconv.ParseInt(val, 10, 64)
		if err != nil {
			return tool.Output{}, fmt.Errorf("text.epoch: epoch inválido: %w", err)
		}
		tm := time.Unix(sec, 0)
		return tool.Output{Message: fmt.Sprintf("%d:\n  UTC: %s\n  local: %s",
			sec, tm.UTC().Format(time.RFC3339), tm.Format(time.RFC3339))}, nil
	case "toEpoch":
		tm, err := parseDateTime(val)
		if err != nil {
			return tool.Output{}, fmt.Errorf("text.epoch: data inválida (use ISO, ex.: 2026-09-08T11:00:00): %w", err)
		}
		return tool.Output{Message: fmt.Sprintf("%s:\n  epoch: %d\n  UTC: %s", val, tm.Unix(), tm.UTC().Format(time.RFC3339))}, nil
	default:
		return tool.Output{}, fmt.Errorf("text.epoch: modo inválido")
	}
}

func parseDateTime(s string) (time.Time, error) {
	formats := []string{time.RFC3339, "2006-01-02T15:04:05", "2006-01-02 15:04:05", "2006-01-02", "02/01/2006 15:04:05", "02/01/2006"}
	for _, f := range formats {
		if tm, err := time.ParseInLocation(f, s, time.Local); err == nil {
			return tm, nil
		}
	}
	return time.Time{}, fmt.Errorf("formato não reconhecido")
}

// ---- 4. UUID ----

type UUID struct{ base }

func NewUUID() *UUID {
	return &UUID{base{"text.uuid", "text", "tool.uuid.title", "tool.uuid.desc", "fingerprint"}}
}

func (t *UUID) Params() []tool.Param {
	return []tool.Param{
		{Key: "count", Label: "param.text.count.label", Type: tool.ParamNumber, Default: 1, Min: 1, Max: 1000},
		{Key: "version", Label: "param.text.uuidver.label", Type: tool.ParamSelect,
			Options: []string{"v4", "v7"}, Default: "v4"},
	}
}

func (t *UUID) Steps() []tool.Step {
	return []tool.Step{stepFunc{"step.text.uuid", t.run}}
}

func (t *UUID) run(_ context.Context, in tool.Input, _ func(pct float64)) (tool.Output, error) {
	n := int(tool.ParamFloat(in, "count", 1))
	if n < 1 {
		n = 1
	}
	if n > 1000 {
		n = 1000
	}
	ver := tool.ParamString(in, "version", "v4")
	var sb strings.Builder
	for i := 0; i < n; i++ {
		var id uuid.UUID
		var err error
		if ver == "v7" {
			id, err = uuid.NewV7()
		} else {
			id, err = uuid.NewRandom()
		}
		if err != nil {
			return tool.Output{}, fmt.Errorf("text.uuid: %w", err)
		}
		sb.WriteString(id.String() + "\n")
	}
	return tool.Output{Message: strings.TrimRight(sb.String(), "\n")}, nil
}

// ---- 5. Slugify ----

type Slug struct{ base }

func NewSlug() *Slug {
	return &Slug{base{"text.slug", "text", "tool.slug.title", "tool.slug.desc", "link"}}
}

func (t *Slug) Params() []tool.Param {
	return []tool.Param{
		{Key: "text", Label: "param.pdf.text.label", Type: tool.ParamText, Required: true, Default: ""},
		{Key: "separator", Label: "param.text.separator.label", Type: tool.ParamSelect,
			Options: []string{"-", "_"}, Default: "-"},
	}
}

func (t *Slug) Steps() []tool.Step {
	return []tool.Step{stepFunc{"step.text.slug", t.run}}
}

func (t *Slug) run(_ context.Context, in tool.Input, _ func(pct float64)) (tool.Output, error) {
	text := tool.ParamString(in, "text", "")
	if text == "" {
		return tool.Output{}, fmt.Errorf("text.slug: informe o texto")
	}
	sep := tool.ParamString(in, "separator", "-")
	// remove diacríticos via NFD + filtro Mn
	t2 := transform.Chain(norm.NFD, runes.Remove(runes.In(unicode.Mn)), norm.NFC)
	ascii, _, err := transform.String(t2, text)
	if err != nil {
		ascii = text
	}
	ascii = strings.ToLower(ascii)
	var sb strings.Builder
	prevSep := false
	for _, r := range ascii {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') {
			sb.WriteRune(r)
			prevSep = false
		} else if !prevSep {
			sb.WriteString(sep)
			prevSep = true
		}
	}
	return tool.Output{Message: strings.Trim(sb.String(), sep)}, nil
}

// ---- 6. Colunas de texto ----

type Columnize struct{ base }

func NewColumnize() *Columnize {
	return &Columnize{base{"text.columnize", "text", "tool.columnize.title", "tool.columnize.desc", "columns-3"}}
}

func (t *Columnize) Params() []tool.Param {
	return []tool.Param{
		{Key: "delimiter", Label: "param.text.delimiter.label", Type: tool.ParamText, Default: "|"},
		{Key: "padding", Label: "param.text.padding.label", Type: tool.ParamNumber, Default: 2, Min: 1, Max: 20},
	}
}

func (t *Columnize) Steps() []tool.Step {
	return []tool.Step{stepFunc{"step.text.columnize", t.run}}
}

func (t *Columnize) run(_ context.Context, in tool.Input, _ func(pct float64)) (tool.Output, error) {
	if len(in.Paths) == 0 {
		return tool.Output{}, fmt.Errorf("text.columnize: nenhum arquivo")
	}
	delim := tool.ParamString(in, "delimiter", "|")
	if delim == "" {
		delim = "|"
	}
	pad := int(tool.ParamFloat(in, "padding", 2))
	var sb strings.Builder
	for _, p := range in.Paths {
		data, err := os.ReadFile(p)
		if err != nil {
			fmt.Fprintf(&sb, "ERRO %s: %v\n", filepath.Base(p), err)
			continue
		}
		lines := strings.Split(strings.TrimRight(string(data), "\n"), "\n")
		split := make([][]string, 0, len(lines))
		widths := []int{}
		for _, l := range lines {
			cols := strings.Split(l, delim)
			for i := range cols {
				cols[i] = strings.TrimSpace(cols[i])
			}
			split = append(split, cols)
			for i, c := range cols {
				for len(widths) <= i {
					widths = append(widths, 0)
				}
				if len(c) > widths[i] {
					widths[i] = len(c)
				}
			}
		}
		fmt.Fprintf(&sb, "=== %s ===\n", filepath.Base(p))
		for _, cols := range split {
			for i, c := range cols {
				sb.WriteString(c)
				if i+1 < len(cols) {
					sb.WriteString(strings.Repeat(" ", widths[i]-len(c)+pad))
				}
			}
			sb.WriteString("\n")
		}
	}
	return tool.Output{Message: strings.TrimRight(sb.String(), "\n")}, nil
}

// ---- 7. Escape HTML/XML/URL ----

type Escape struct{ base }

func NewEscape() *Escape {
	return &Escape{base{"text.escape", "text", "tool.escape.title", "tool.escape.desc", "code-2"}}
}

func (t *Escape) Params() []tool.Param {
	return []tool.Param{
		{Key: "kind", Label: "param.text.escapekind.label", Type: tool.ParamSelect,
			Options: []string{"htmlEscape", "htmlUnescape", "urlEncode", "urlDecode", "queryEscape"}, Default: "htmlEscape"},
		{Key: "text", Label: "param.pdf.text.label", Type: tool.ParamText, Default: ""},
	}
}

func (t *Escape) Steps() []tool.Step {
	return []tool.Step{stepFunc{"step.text.escape", t.run}}
}

func (t *Escape) run(_ context.Context, in tool.Input, _ func(pct float64)) (tool.Output, error) {
	text := tool.ParamString(in, "text", "")
	if text == "" && len(in.Paths) > 0 {
		data, err := os.ReadFile(in.Paths[0])
		if err != nil {
			return tool.Output{}, err
		}
		text = string(data)
	}
	if text == "" {
		return tool.Output{}, fmt.Errorf("text.escape: informe o texto ou um arquivo")
	}
	kind := tool.ParamString(in, "kind", "htmlEscape")
	var out string
	var err error
	switch kind {
	case "htmlEscape":
		out = html.EscapeString(text)
	case "htmlUnescape":
		out = html.UnescapeString(text)
	case "urlEncode":
		out = url.QueryEscape(text)
	case "urlDecode":
		out, err = url.QueryUnescape(text)
	case "queryEscape":
		out = url.PathEscape(text)
	default:
		return tool.Output{}, fmt.Errorf("text.escape: tipo inválido")
	}
	if err != nil {
		return tool.Output{}, fmt.Errorf("text.escape: %w", err)
	}
	return tool.Output{Message: out}, nil
}

// Package cli implementa o modo linha de comando do AxisDoc.
// Uso: axisdoc <toolID> [--param valor ...] <arquivos...>
//
//	axisdoc tools            (lista ferramentas)
//	axisdoc run <pipelineID> <arquivos...>
package cli

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/ferna/axisdoc/internal/pipeline"
	"github.com/ferna/axisdoc/internal/store"
	"github.com/ferna/axisdoc/internal/tool"
)

// Result do comando CLI.
type Result struct {
	Message string
	Paths   []string
}

// Run executa o modo CLI. Retorna true se os args pertencem ao CLI.
func Run(args []string, reg *tool.Registry, dataDir string) (bool, *Result, error) {
	if len(args) == 0 {
		return false, nil, nil
	}
	switch args[0] {
	case "tools":
		listTools(reg)
		return true, &Result{Message: "ok"}, nil
	case "run":
		if len(args) < 3 {
			fmt.Fprintln(os.Stderr, "uso: axisdoc run <pipelineID> <arquivos...>")
			return true, nil, fmt.Errorf("args insuficientes")
		}
		res, err := runPipeline(args[1], args[2:], reg, dataDir)
		return true, res, err
	default:
		if !strings.Contains(args[0], ".") {
			return false, nil, nil // não é toolID nem comando: deixa o app abrir
		}
		res, err := runTool(args[0], args[1:], reg)
		return true, res, err
	}
}

func listTools(reg *tool.Registry) {
	fmt.Println("Ferramentas disponíveis:")
	for _, t := range reg.List() {
		fmt.Printf("  %-28s %s\n", t.ID(), t.Title())
	}
}

func runTool(id string, args []string, reg *tool.Registry) (*Result, error) {
	t, err := reg.Get(id)
	if err != nil {
		return nil, err
	}
	paths, params := parseArgs(args, t)
	input := tool.Input{Paths: paths, Params: params}
	var msgs []string
	var allPaths []string
	ctx := context.Background()
	for _, s := range t.Steps() {
		out, err := s.Run(ctx, input, nil)
		if err != nil {
			return nil, fmt.Errorf("%s: %w", s.Name(), err)
		}
		if out.Message != "" {
			msgs = append(msgs, out.Message)
		}
		allPaths = append(allPaths, out.Paths...)
	}
	return &Result{Message: strings.Join(msgs, "\n"), Paths: allPaths}, nil
}

func runPipeline(id string, args []string, reg *tool.Registry, dataDir string) (*Result, error) {
	if err := os.MkdirAll(dataDir, 0o755); err != nil {
		return nil, err
	}
	st, err := store.Open(filepath.Join(dataDir, "axisdoc.sqlite3"))
	if err != nil {
		return nil, err
	}
	defer st.Close()
	repo := pipeline.NewRepo(st.Settings())
	list, err := repo.List(context.Background())
	if err != nil {
		return nil, err
	}
	var found *pipeline.Pipeline
	for i := range list {
		if list[i].ID == id {
			found = &list[i]
			break
		}
	}
	if found == nil {
		return nil, fmt.Errorf("pipeline %q não encontrado", id)
	}
	runner := pipeline.NewRunner(reg)
	res, err := runner.Run(context.Background(), *found, args)
	if err != nil {
		return nil, err
	}
	return &Result{Message: res.Message, Paths: res.Paths}, nil
}

// parseArgs separa paths de params (--key value).
func parseArgs(args []string, t tool.Tool) ([]string, map[string]any) {
	known := map[string]tool.Param{}
	for _, p := range t.Params() {
		known[p.Key] = p
	}
	var paths []string
	params := map[string]any{}
	for i := 0; i < len(args); i++ {
		arg := args[i]
		if !strings.HasPrefix(arg, "--") {
			paths = append(paths, arg)
			continue
		}
		key := strings.TrimPrefix(arg, "--")
		p, ok := known[key]
		if !ok || i+1 >= len(args) {
			continue
		}
		val := args[i+1]
		i++
		switch p.Type {
		case tool.ParamNumber:
			f, _ := strconv.ParseFloat(val, 64)
			params[key] = f
		case tool.ParamBool:
			b, _ := strconv.ParseBool(val)
			params[key] = b
		default:
			params[key] = val
		}
	}
	return paths, params
}

package pipeline

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"

	"github.com/ferna/axisdoc/internal/store"
	"github.com/ferna/axisdoc/internal/tool"
)

// Pipeline é uma macro salva: sequência ordenada de ferramentas.
type Pipeline struct {
	ID    string         `json:"id"`
	Name  string         `json:"name"`
	Steps []PipelineStep `json:"steps"`
}

// PipelineStep é um passo: ferramenta + params.
type PipelineStep struct {
	ToolID string         `json:"toolId"`
	Params map[string]any `json:"params"`
}

// Repo persiste pipelines no SQLite via settings.
type Repo struct {
	repo *store.SettingRepo
}

// NewRepo cria o repositório.
func NewRepo(settings *store.SettingRepo) *Repo {
	return &Repo{repo: settings}
}

func (r *Repo) Save(ctx context.Context, p Pipeline) error {
	data, err := json.Marshal(p)
	if err != nil {
		return err
	}
	if err := r.repo.Set(ctx, "pipeline:"+p.ID, string(data)); err != nil {
		return err
	}
	return r.RegisterID(ctx, p.ID)
}

func (r *Repo) Delete(ctx context.Context, id string) error {
	if err := r.repo.Set(ctx, "pipeline:"+id, ""); err != nil {
		return err
	}
	// remove o ID da lista (evita fantasmas no List)
	raw, _ := r.repo.Get(ctx, "pipelines")
	var ids []string
	if raw != "" {
		_ = json.Unmarshal([]byte(raw), &ids)
	}
	kept := ids[:0]
	for _, x := range ids {
		if x != id {
			kept = append(kept, x)
		}
	}
	data, _ := json.Marshal(kept)
	return r.repo.Set(ctx, "pipelines", string(data))
}

func (r *Repo) List(ctx context.Context) ([]Pipeline, error) {
	raw, err := r.repo.Get(ctx, "pipelines")
	if err != nil {
		return nil, err
	}
	var ids []string
	if raw != "" {
		if err := json.Unmarshal([]byte(raw), &ids); err != nil {
			return nil, err
		}
	}
	out := []Pipeline{}
	for _, id := range ids {
		data, err := r.repo.Get(ctx, "pipeline:"+id)
		if err != nil || data == "" {
			continue
		}
		var p Pipeline
		if err := json.Unmarshal([]byte(data), &p); err == nil {
			out = append(out, p)
		}
	}
	return out, nil
}

func (r *Repo) RegisterID(ctx context.Context, id string) error {
	raw, _ := r.repo.Get(ctx, "pipelines")
	var ids []string
	if raw != "" {
		_ = json.Unmarshal([]byte(raw), &ids)
	}
	for _, x := range ids {
		if x == id {
			return nil
		}
	}
	ids = append(ids, id)
	data, _ := json.Marshal(ids)
	return r.repo.Set(ctx, "pipelines", string(data))
}

// RunResult é o resultado de uma execução de pipeline.
type RunResult struct {
	Paths   []string `json:"paths"`
	Message string   `json:"message"`
}

// Runner executa pipelines encadeando saídas.
type Runner struct {
	reg *tool.Registry
}

// NewRunner cria o executor.
func NewRunner(reg *tool.Registry) *Runner {
	return &Runner{reg: reg}
}

// Run executa o pipeline: output de um step alimenta o próximo.
func (r *Runner) Run(ctx context.Context, p Pipeline, paths []string) (*RunResult, error) {
	current := paths
	var msgs []string
	allPaths := []string{}
	for i, step := range p.Steps {
		if err := ctx.Err(); err != nil {
			return nil, err
		}
		t, err := r.reg.Get(step.ToolID)
		if err != nil {
			return nil, fmt.Errorf("pipeline %q step %d: %w", p.Name, i+1, err)
		}
		slog.Info("pipeline: executando", "pipeline", p.Name, "step", i+1, "tool", step.ToolID)
		var stepOut tool.Output
		for _, s := range t.Steps() {
			out, err := s.Run(ctx, tool.Input{Paths: current, Params: step.Params}, nil)
			if err != nil {
				return nil, fmt.Errorf("pipeline %q step %d (%s): %w", p.Name, i+1, s.Name(), err)
			}
			stepOut = out
			if len(out.Paths) > 0 {
				current = out.Paths
			}
		}
		allPaths = append(allPaths, stepOut.Paths...)
		if stepOut.Message != "" {
			msgs = append(msgs, fmt.Sprintf("[%s] %s", step.ToolID, stepOut.Message))
		}
	}
	return &RunResult{
		Paths:   allPaths,
		Message: joinMessages(msgs),
	}, nil
}

func joinMessages(msgs []string) string {
	out := ""
	for i, m := range msgs {
		if i > 0 {
			out += "\n"
		}
		out += m
	}
	return out
}

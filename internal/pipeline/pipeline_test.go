package pipeline

import (
	"context"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/ferna/axisdoc/internal/store"
	"github.com/ferna/axisdoc/internal/tool"
)

// fakeTool registra steps que "produzem" arquivos fake.
type fakeTool struct {
	id    string
	paths []string
}

func (f *fakeTool) ID() string           { return f.id }
func (f *fakeTool) Category() string     { return "test" }
func (f *fakeTool) Title() string        { return "t" }
func (f *fakeTool) Description() string  { return "d" }
func (f *fakeTool) Icon() string         { return "box" }
func (f *fakeTool) Params() []tool.Param { return nil }
func (f *fakeTool) Steps() []tool.Step {
	return []tool.Step{outStep{id: f.id, paths: f.paths}}
}

type outStep struct {
	id    string
	paths []string
}

func (o outStep) Name() string { return "step." + o.id }
func (o outStep) Run(ctx context.Context, in tool.Input, report func(pct float64)) (tool.Output, error) {
	// outputs fixos, simulando arquivos gerados
	return tool.Output{Paths: o.paths, Message: "ok " + o.id}, nil
}

type failTool struct{ id string }

func (f *failTool) ID() string           { return f.id }
func (f *failTool) Category() string     { return "test" }
func (f *failTool) Title() string        { return "t" }
func (f *failTool) Description() string  { return "d" }
func (f *failTool) Icon() string         { return "box" }
func (f *failTool) Params() []tool.Param { return nil }
func (f *failTool) Steps() []tool.Step {
	return []tool.Step{failStep{id: f.id}}
}

type failStep struct{ id string }

func (s failStep) Name() string { return "step.fail." + s.id }
func (s failStep) Run(ctx context.Context, in tool.Input, report func(pct float64)) (tool.Output, error) {
	return tool.Output{}, errBoom
}

var errBoom = &boomErr{}

type boomErr struct{}

func (*boomErr) Error() string { return "boom" }

func setupRegistry(t *testing.T) *tool.Registry {
	t.Helper()
	reg := tool.NewRegistry()
	require.NoError(t, reg.Register(&fakeTool{id: "t1", paths: []string{"out1.txt"}}))
	require.NoError(t, reg.Register(&fakeTool{id: "t2", paths: []string{"out2.txt", "out3.txt"}}))
	require.NoError(t, reg.Register(&failTool{id: "bad"}))
	return reg
}

func setupRepo(t *testing.T) *Repo {
	t.Helper()
	st, err := store.Open(filepath.Join(t.TempDir(), "db.sqlite3"))
	require.NoError(t, err)
	t.Cleanup(func() { st.Close() })
	return NewRepo(st.Settings())
}

func TestPipelineRunChain(t *testing.T) {
	reg := setupRegistry(t)
	runner := NewRunner(reg)
	p := Pipeline{
		ID:   "p1",
		Name: "teste",
		Steps: []PipelineStep{
			{ToolID: "t1"},
			{ToolID: "t2"},
		},
	}
	res, err := runner.Run(context.Background(), p, []string{"in.txt"})
	require.NoError(t, err)
	// allPaths acumula saídas de todos os steps
	require.Equal(t, []string{"out1.txt", "out2.txt", "out3.txt"}, res.Paths)
	require.Contains(t, res.Message, "[t1]")
	require.Contains(t, res.Message, "[t2]")
}

func TestPipelineFailureStops(t *testing.T) {
	reg := setupRegistry(t)
	runner := NewRunner(reg)
	p := Pipeline{
		ID:   "p2",
		Name: "falha",
		Steps: []PipelineStep{
			{ToolID: "bad"},
			{ToolID: "t1"},
		},
	}
	_, err := runner.Run(context.Background(), p, nil)
	require.Error(t, err)
	require.Contains(t, err.Error(), "boom")
}

func TestPipelineUnknownTool(t *testing.T) {
	reg := setupRegistry(t)
	runner := NewRunner(reg)
	p := Pipeline{ID: "p3", Name: "x", Steps: []PipelineStep{{ToolID: "nao.existe"}}}
	_, err := runner.Run(context.Background(), p, nil)
	require.ErrorContains(t, err, "não encontrada")
}

func TestPipelineRepoRoundTrip(t *testing.T) {
	repo := setupRepo(t)
	ctx := context.Background()
	p := Pipeline{
		ID:    "macro1",
		Name:  "Minha Macro",
		Steps: []PipelineStep{{ToolID: "pdf.merge", Params: map[string]any{"k": "v"}}},
	}
	require.NoError(t, repo.Save(ctx, p))
	list, err := repo.List(ctx)
	require.NoError(t, err)
	require.Len(t, list, 1)
	require.Equal(t, "macro1", list[0].ID)
	require.Equal(t, "Minha Macro", list[0].Name)
	require.Equal(t, "v", list[0].Steps[0].Params["k"])

	require.NoError(t, repo.Delete(ctx, "macro1"))
	list, _ = repo.List(ctx)
	require.Empty(t, list)
}

func TestPipelineContextCancel(t *testing.T) {
	reg := setupRegistry(t)
	runner := NewRunner(reg)
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	p := Pipeline{ID: "p4", Name: "c", Steps: []PipelineStep{{ToolID: "t1"}}}
	_, err := runner.Run(ctx, p, nil)
	require.ErrorIs(t, err, context.Canceled)
}

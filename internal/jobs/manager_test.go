package jobs

import (
	"context"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/ferna/axisdoc/internal/store"
	"github.com/ferna/axisdoc/internal/tool"
)

// fakeEmitter captura eventos emitidos.
type fakeEmitter struct {
	mu     sync.Mutex
	events []event
}

type event struct {
	name string
	data any
}

func (f *fakeEmitter) Emit(name string, data any) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.events = append(f.events, event{name, data})
}

func (f *fakeEmitter) of(name string) []event {
	f.mu.Lock()
	defer f.mu.Unlock()
	var out []event
	for _, e := range f.events {
		if e.name == name {
			out = append(out, e)
		}
	}
	return out
}

// fakeTool com steps configuráveis.
type scriptedTool struct {
	id    string
	steps []tool.Step
}

func (s *scriptedTool) ID() string           { return s.id }
func (s *scriptedTool) Category() string     { return "test" }
func (s *scriptedTool) Title() string        { return "t.title" }
func (s *scriptedTool) Description() string  { return "t.desc" }
func (s *scriptedTool) Icon() string         { return "box" }
func (s *scriptedTool) Params() []tool.Param { return nil }
func (s *scriptedTool) Steps() []tool.Step   { return s.steps }

type okStep struct{ name string }

func (o okStep) Name() string { return o.name }
func (o okStep) Run(ctx context.Context, in tool.Input, report func(float64)) (tool.Output, error) {
	if report != nil {
		report(100)
	}
	return tool.Output{Paths: []string{"out.bin"}, Message: "feito"}, nil
}

type slowStep struct{ delay time.Duration }

func (s slowStep) Name() string { return "step.slow" }
func (s slowStep) Run(ctx context.Context, in tool.Input, report func(float64)) (tool.Output, error) {
	select {
	case <-ctx.Done():
		return tool.Output{}, ctx.Err()
	case <-time.After(s.delay):
		return tool.Output{}, nil
	}
}

type failStep struct{}

func (failStep) Name() string { return "step.fail" }
func (failStep) Run(ctx context.Context, in tool.Input, report func(float64)) (tool.Output, error) {
	return tool.Output{}, errBoom
}

var errBoom = &boomError{}

type boomError struct{}

func (*boomError) Error() string { return "boom" }

func setupEnv(t *testing.T, steps ...tool.Step) (*Manager, *store.Store, *fakeEmitter, *tool.Registry) {
	t.Helper()
	st, err := store.Open(t.TempDir() + "/test.db")
	require.NoError(t, err)
	t.Cleanup(func() { st.Close() })

	em := &fakeEmitter{}
	reg := tool.NewRegistry()
	require.NoError(t, reg.Register(&scriptedTool{id: "test.tool", steps: steps}))
	mgr := NewManager(reg, st.Jobs(), em, 2)
	return mgr, st, em, reg
}

func waitForStatus(t *testing.T, repo *store.JobRepo, id, status string) *store.Job {
	t.Helper()
	deadline := time.Now().Add(5 * time.Second)
	for time.Now().Before(deadline) {
		j, err := repo.Get(context.Background(), id)
		if err == nil && j.Status == status {
			return j
		}
		time.Sleep(10 * time.Millisecond)
	}
	t.Fatalf("job %s não chegou ao status %s a tempo", id, status)
	return nil
}

func TestJobSuccess(t *testing.T) {
	mgr, st, em, _ := setupEnv(t, okStep{"s1"}, okStep{"s2"})
	j, err := mgr.Enqueue(context.Background(), "test.tool", map[string]any{"paths": []string{"x"}})
	require.NoError(t, err)

	done := waitForStatus(t, st.Jobs(), j.ID, store.StatusDone)
	require.InDelta(t, 100, done.Progress, 0.001)
	require.Equal(t, "feito\nfeito", done.Output["message"]) // 2 steps
	require.Equal(t, []any{"out.bin", "out.bin"}, done.Output["paths"])

	require.NotEmpty(t, em.of(store2Event(EventStarted)))
	require.NotEmpty(t, em.of(store2Event(EventDone)))
	require.NotEmpty(t, em.of(store2Event(EventProgress)))
}

func TestJobFailure(t *testing.T) {
	mgr, st, _, _ := setupEnv(t, okStep{"s1"}, failStep{})
	j, err := mgr.Enqueue(context.Background(), "test.tool", nil)
	require.NoError(t, err)

	done := waitForStatus(t, st.Jobs(), j.ID, store.StatusFailed)
	require.Contains(t, done.Error, "boom")
	require.Equal(t, store.StatusFailed, done.Status)
}

func TestJobCancel(t *testing.T) {
	mgr, st, _, _ := setupEnv(t, slowStep{2 * time.Second})
	j, err := mgr.Enqueue(context.Background(), "test.tool", nil)
	require.NoError(t, err)

	// espera começar
	deadline := time.Now().Add(3 * time.Second)
	for time.Now().Before(deadline) {
		jj, _ := st.Jobs().Get(context.Background(), j.ID)
		if jj != nil && jj.Status == store.StatusRunning {
			break
		}
		time.Sleep(5 * time.Millisecond)
	}
	require.Eventually(t, func() bool {
		return mgr.Cancel(j.ID) == nil
	}, 3*time.Second, 10*time.Millisecond)

	done := waitForStatus(t, st.Jobs(), j.ID, store.StatusCanceled)
	require.Equal(t, store.StatusCanceled, done.Status)
}

func TestJobUnknownTool(t *testing.T) {
	mgr, _, _, _ := setupEnv(t, okStep{"s0"})
	_, err := mgr.Enqueue(context.Background(), "nao.existe", nil)
	require.Error(t, err)
}

func TestInputConversion(t *testing.T) {
	j := &store.Job{Input: map[string]any{
		"paths":  []any{"a.txt", "b.txt"},
		"params": map[string]any{"algorithm": "sha256"},
	}}
	in := inputFrom(j)
	require.Equal(t, []string{"a.txt", "b.txt"}, in.Paths)
	require.Equal(t, "sha256", in.Params["algorithm"])
}

func TestJobCancelBeforeStart(t *testing.T) {
	// manager com 1 worker ocupado: cancela o segundo antes de começar
	em := &fakeEmitter{}
	reg := tool.NewRegistry()
	require.NoError(t, reg.Register(&scriptedTool{id: "slow", steps: []tool.Step{slowStep{delay: 2 * time.Second}}}))
	st, err := store.Open(t.TempDir() + "/test.db")
	require.NoError(t, err)
	t.Cleanup(func() { st.Close() })
	mgr := NewManager(reg, st.Jobs(), em, 1)

	j1, err := mgr.Enqueue(context.Background(), "slow", nil)
	require.NoError(t, err)
	j2, err := mgr.Enqueue(context.Background(), "slow", nil)
	require.NoError(t, err)

	// espera o primeiro começar, depois cancela o segundo (ainda na fila)
	waitForStatus(t, st.Jobs(), j1.ID, store.StatusRunning)
	require.NoError(t, mgr.Cancel(j2.ID))

	done := waitForStatus(t, st.Jobs(), j2.ID, store.StatusCanceled)
	require.Equal(t, store.StatusCanceled, done.Status)

	// primeiro segue até terminar
	waitForStatus(t, st.Jobs(), j1.ID, store.StatusDone)
}

func TestJobCancelUnknown(t *testing.T) {
	mgr, _, _, _ := setupEnv(t, okStep{"s0"})
	require.ErrorIs(t, mgr.Cancel("inexistente"), store.ErrNotFound)
}

func TestJobFailWithoutRepo(t *testing.T) {
	// manager com repo apontando para store fechado: fail() não deve travar
	st, err := store.Open(t.TempDir() + "/test.db")
	require.NoError(t, err)
	em := &fakeEmitter{}
	reg := tool.NewRegistry()
	mgr := NewManager(reg, st.Jobs(), em, 2)
	require.NoError(t, st.Close())
	_, err = mgr.Enqueue(context.Background(), "nao.existe", nil)
	require.Error(t, err) // tool desconhecida falha antes do repo
	done := em.of(EventDone)
	require.Empty(t, done)
}

// store2Event evita colisão de nome com store.Status* no teste.
func store2Event(name string) string { return name }

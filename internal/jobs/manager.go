// Package jobs gerencia a fila de execução de ferramentas:
// workers, progresso, cancelamento e persistência.
package jobs

import (
	"context"
	"log/slog"
	"sync"

	"github.com/ferna/axisdoc/internal/runtimei"
	"github.com/ferna/axisdoc/internal/store"
	"github.com/ferna/axisdoc/internal/tool"
)

// Eventos emitidos ao frontend.
const (
	EventQueued   = "job:queued"
	EventStarted  = "job:started"
	EventProgress = "job:progress"
	EventDone     = "job:done"
)

// Manager executa jobs com concorrência limitada.
type Manager struct {
	reg     *tool.Registry
	repo    *store.JobRepo
	emit    runtimei.Emitter
	log     *slog.Logger
	sem     chan struct{}
	mu      sync.Mutex
	cancels map[string]context.CancelFunc
}

// NewManager cria o gerenciador. maxWorkers define quantos jobs rodam em paralelo.
func NewManager(reg *tool.Registry, repo *store.JobRepo, emit runtimei.Emitter, maxWorkers int) *Manager {
	if maxWorkers <= 0 {
		maxWorkers = 2
	}
	return &Manager{
		reg:     reg,
		repo:    repo,
		emit:    emit,
		log:     slog.Default(),
		sem:     make(chan struct{}, maxWorkers),
		cancels: make(map[string]context.CancelFunc),
	}
}

// Enqueue cria e agenda um job para a ferramenta dada.
func (m *Manager) Enqueue(ctx context.Context, toolID string, input map[string]any) (*store.Job, error) {
	if _, err := m.reg.Get(toolID); err != nil {
		return nil, err
	}
	j := &store.Job{
		ID:     newID(),
		ToolID: toolID,
		Status: store.StatusQueued,
		Input:  input,
	}
	if err := m.repo.Insert(ctx, j); err != nil {
		return nil, err
	}
	m.emit.Emit(EventQueued, j)

	// registra o cancelamento antes de despachar o worker
	jobCtx, cancel := context.WithCancel(context.Background())
	m.mu.Lock()
	m.cancels[j.ID] = cancel
	m.mu.Unlock()

	go m.run(jobCtx, j)
	return j, nil
}

// Cancel cancela um job em execução ou na fila.
func (m *Manager) Cancel(id string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	cancel, ok := m.cancels[id]
	if !ok {
		return store.ErrNotFound
	}
	cancel()
	return nil
}

// run executa o job em um worker.
func (m *Manager) run(ctx context.Context, j *store.Job) {
	m.sem <- struct{}{}
	defer func() { <-m.sem }()

	// job cancelado antes de começar: marca canceled e retorna
	if ctx.Err() != nil {
		_ = m.repo.Finish(context.Background(), j.ID, store.StatusCanceled, nil, "cancelado")
		m.emit.Emit(EventDone, donePayload(j.ID, store.StatusCanceled, nil))
		return
	}

	m.mu.Lock()
	cancel, ok := m.cancels[j.ID]
	m.mu.Unlock()
	if ok {
		defer cancel()
	}
	defer func() {
		m.mu.Lock()
		delete(m.cancels, j.ID)
		m.mu.Unlock()
	}()

	if err := m.repo.MarkRunning(ctx, j.ID); err != nil {
		m.log.Error("jobs: marcar início", "id", j.ID, "err", err)
	}

	t, err := m.reg.Get(j.ToolID)
	if err != nil {
		m.fail(j.ID, err)
		return
	}
	steps := t.Steps()
	m.emit.Emit(EventStarted, map[string]any{"id": j.ID, "toolId": j.ToolID, "steps": len(steps)})

	stepShare := 100 / float64(len(steps))
	var out tool.Output
	for i, s := range steps {
		base := float64(i) * stepShare
		err := func() error {
			stepCtx, stepCancel := context.WithCancel(ctx)
			defer stepCancel()
			o, err := s.Run(stepCtx, inputFrom(j), func(pct float64) {
				total := base + pct/100*stepShare
				_ = m.repo.UpdateProgress(ctx, j.ID, total)
				m.emit.Emit(EventProgress, map[string]any{"id": j.ID, "progress": total})
			})
			if err != nil {
				return err
			}
			out = mergeOutput(out, o)
			return nil
		}()
		if err != nil {
			switch {
			case ctx.Err() != nil:
				// ctx cancelado: gravar status terminal com contexto novo
				_ = m.repo.Finish(context.Background(), j.ID, store.StatusCanceled, nil, "cancelado")
				m.emit.Emit(EventDone, donePayload(j.ID, store.StatusCanceled, nil))
			default:
				_ = m.repo.Finish(context.Background(), j.ID, store.StatusFailed, nil, err.Error())
				m.emit.Emit(EventDone, donePayload(j.ID, store.StatusFailed, map[string]any{"error": err.Error()}))
			}
			return
		}
	}

	outMap := map[string]any{
		"paths":   out.Paths,
		"message": out.Message,
	}
	if err := m.repo.Finish(context.Background(), j.ID, store.StatusDone, outMap, ""); err != nil {
		m.log.Error("jobs: persistir fim", "id", j.ID, "err", err)
	}
	m.emit.Emit(EventDone, donePayload(j.ID, store.StatusDone, outMap))
}

func (m *Manager) fail(id string, err error) {
	_ = m.repo.Finish(context.Background(), id, store.StatusFailed, nil, err.Error())
	m.emit.Emit(EventDone, donePayload(id, store.StatusFailed, map[string]any{"error": err.Error()}))
}

// inputFrom converte o JSON persistido em tool.Input.
func inputFrom(j *store.Job) tool.Input {
	in := tool.Input{Params: map[string]any{}}
	if j.Input != nil {
		if raw, ok := j.Input["paths"].([]any); ok {
			for _, p := range raw {
				if s, ok := p.(string); ok {
					in.Paths = append(in.Paths, s)
				}
			}
		}
		if params, ok := j.Input["params"].(map[string]any); ok {
			in.Params = params
		}
	}
	return in
}

func mergeOutput(acc, next tool.Output) tool.Output {
	acc.Paths = append(acc.Paths, next.Paths...)
	if next.Message != "" {
		if acc.Message != "" {
			acc.Message += "\n"
		}
		acc.Message += next.Message
	}
	return acc
}

func donePayload(id, status string, out map[string]any) map[string]any {
	return map[string]any{"id": id, "status": status, "output": out}
}

func newID() string {
	return generateID()
}

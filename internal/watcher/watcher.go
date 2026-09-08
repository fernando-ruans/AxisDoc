// Package watcher observa pastas e dispara pipelines quando arquivos surgem.
package watcher

import (
	"context"
	"log/slog"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/fsnotify/fsnotify"

	"github.com/ferna/axisdoc/internal/pipeline"
)

// Rule é uma regra de watch folder.
type Rule struct {
	ID       string            `json:"id"`
	Folder   string            `json:"folder"`
	Pattern  string            `json:"pattern"` // extensão, ex: ".pdf" ("" = tudo)
	Pipeline pipeline.Pipeline `json:"pipeline"`
}

// Watcher gerencia regras de watch folders.
type Watcher struct {
	fs     *fsnotify.Watcher
	runner *pipeline.Runner
	rules  []Rule
	mu     sync.Mutex
	// debounce por arquivo
	pending map[string]time.Time
}

// New cria o watcher.
func New(runner *pipeline.Runner) (*Watcher, error) {
	fs, err := fsnotify.NewWatcher()
	if err != nil {
		return nil, err
	}
	return &Watcher{fs: fs, runner: runner, pending: map[string]time.Time{}}, nil
}

// AddRule adiciona uma regra e começa a observar a pasta.
func (w *Watcher) AddRule(r Rule) error {
	if st, err := os.Stat(r.Folder); err != nil || !st.IsDir() {
		return err
	}
	w.mu.Lock()
	w.rules = append(w.rules, r)
	w.mu.Unlock()
	return w.fs.Add(r.Folder)
}

// Clear remove todas as regras (recomeça do zero).
func (w *Watcher) Clear() {
	w.mu.Lock()
	w.rules = nil
	w.mu.Unlock()
}

// ListRules retorna cópia das regras ativas.
func (w *Watcher) ListRules() []Rule {
	w.mu.Lock()
	defer w.mu.Unlock()
	return append([]Rule(nil), w.rules...)
}

// RemoveRule remove uma regra por ID.
func (w *Watcher) RemoveRule(id string) error {
	w.mu.Lock()
	defer w.mu.Unlock()
	for i, r := range w.rules {
		if r.ID == id {
			w.rules = append(w.rules[:i], w.rules[i+1:]...)
			return nil
		}
	}
	return errRuleNotFound(id)
}

// Run bloqueia processando eventos até o contexto ser cancelado.
func (w *Watcher) Run(ctx context.Context) error {
	ticker := time.NewTicker(500 * time.Millisecond)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case ev, ok := <-w.fs.Events:
			if !ok {
				return nil
			}
			if ev.Op&(fsnotify.Create|fsnotify.Write) != 0 && !strings.HasSuffix(ev.Name, ".axisdoc-tmp") {
				w.mark(ev.Name)
			}
		case err, ok := <-w.fs.Errors:
			if !ok {
				return nil
			}
			slog.Error("watcher", "err", err)
		case <-ticker.C:
			w.flushStable(ctx)
		}
	}
}

// marca o horário da última modificação (debounce simples).
func (w *Watcher) mark(path string) {
	w.mu.Lock()
	w.pending[path] = time.Now()
	w.mu.Unlock()
}

// flushStable dispara pipelines para arquivos estáveis há ≥1s.
func (w *Watcher) flushStable(ctx context.Context) {
	w.mu.Lock()
	var ready []string
	for path, t := range w.pending {
		if time.Since(t) >= time.Second {
			ready = append(ready, path)
			delete(w.pending, path)
		}
	}
	w.mu.Unlock()
	for _, path := range ready {
		w.handle(ctx, path)
	}
}

func (w *Watcher) handle(ctx context.Context, path string) {
	w.mu.Lock()
	rules := append([]Rule(nil), w.rules...)
	w.mu.Unlock()
	for _, r := range rules {
		if r.Pattern != "" && !strings.EqualFold(filepath.Ext(path), r.Pattern) {
			continue
		}
		slog.Info("watcher: disparando pipeline", "file", path, "pipeline", r.Pipeline.Name)
		if _, err := w.runner.Run(ctx, r.Pipeline, []string{path}); err != nil {
			slog.Error("watcher: pipeline falhou", "file", path, "err", err)
		}
	}
}

// Close encerra o watcher.
func (w *Watcher) Close() { _ = w.fs.Close() }

func errRuleNotFound(id string) error {
	return errNotFound{id: id}
}

type errNotFound struct{ id string }

func (e errNotFound) Error() string { return "watcher: regra não encontrada: " + e.id }

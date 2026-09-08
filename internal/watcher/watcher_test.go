// Package watcher implementa watch folders.
package watcher

import (
	"context"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/ferna/axisdoc/internal/pipeline"
	"github.com/ferna/axisdoc/internal/store"
	"github.com/ferna/axisdoc/internal/tool"
)

// makeRunner cria runner com tool fake que registra chamadas em arquivo.
func makeRunner(t *testing.T, logFile string) *pipeline.Runner {
	t.Helper()
	reg := tool.NewRegistry()
	tool := &loggingTool{logFile: logFile}
	require.NoError(t, reg.Register(tool))
	return pipeline.NewRunner(reg)
}

type loggingTool struct{ logFile string }

func (l *loggingTool) ID() string           { return "test.log" }
func (l *loggingTool) Category() string     { return "test" }
func (l *loggingTool) Title() string        { return "t" }
func (l *loggingTool) Description() string  { return "d" }
func (l *loggingTool) Icon() string         { return "box" }
func (l *loggingTool) Params() []tool.Param { return nil }
func (l *loggingTool) Steps() []tool.Step   { return []tool.Step{logStep{l}} }

type logStep struct{ t *loggingTool }

func (s logStep) Name() string { return "step.log" }
func (s logStep) Run(ctx context.Context, in tool.Input, report func(pct float64)) (tool.Output, error) {
	f, err := os.OpenFile(s.t.logFile, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0o644)
	if err != nil {
		return tool.Output{}, err
	}
	defer f.Close()
	for _, p := range in.Paths {
		f.WriteString(p + "\n")
	}
	return tool.Output{Message: "logged"}, nil
}

func TestWatcherTriggersPipeline(t *testing.T) {
	dir := t.TempDir()
	logFile := filepath.Join(t.TempDir(), "calls.log")

	st, err := store.Open(filepath.Join(t.TempDir(), "db.sqlite3"))
	require.NoError(t, err)
	defer st.Close()

	w, err := New(makeRunner(t, logFile))
	require.NoError(t, err)
	defer w.Close()

	p := pipeline.Pipeline{ID: "w1", Name: "watch-test", Steps: []pipeline.PipelineStep{{ToolID: "test.log"}}}
	require.NoError(t, w.AddRule(Rule{ID: "r1", Folder: dir, Pattern: ".txt", Pipeline: p}))

	ctx, cancel := context.WithCancel(context.Background())
	go func() { _ = w.Run(ctx) }()

	// cria arquivo que casa com o pattern
	prod := filepath.Join(dir, "novo.txt")
	require.NoError(t, os.WriteFile(prod, []byte("conteudo"), 0o644))

	// espera processar (debounce 1s + margem)
	require.Eventually(t, func() bool {
		data, err := os.ReadFile(logFile)
		return err == nil && len(data) > 0
	}, 6*time.Second, 200*time.Millisecond)

	cancel()
}

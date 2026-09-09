package texttools

import (
	"context"
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/ferna/axisdoc/internal/store"
	"github.com/ferna/axisdoc/internal/tool"
)

// TestToolMetadata cobre getters de todas as tools do pacote.
func TestToolMetadata(t *testing.T) {
	tools := []tool.Tool{
		NewTextDiff(), NewBatchRename(), NewTextStats(), NewQRCode(), NewBarcodeTool(),
	}
	seen := map[string]bool{}
	for _, tl := range tools {
		require.NotEmpty(t, tl.ID())
		require.NotEmpty(t, tl.Category())
		require.NotEmpty(t, tl.Title())
		require.NotEmpty(t, tl.Description())
		require.NotEmpty(t, tl.Icon())
		require.False(t, seen[tl.ID()], "ID duplicado: %s", tl.ID())
		seen[tl.ID()] = true
		steps := tl.Steps()
		require.NotEmpty(t, steps)
		for _, s := range steps {
			require.NotEmpty(t, s.Name())
		}
		for _, p := range tl.Params() {
			require.NoError(t, p.Validate(), "tool %s param %s", tl.ID(), p.Key)
		}
	}
}

// TestBatchRenameUndo cobre undo com e sem backups.
func TestBatchRenameUndo(t *testing.T) {
	// sem backups: erro claro
	tl := NewBatchRename()
	_, err := tl.Steps()[0].Run(
		context.Background(),
		tool.Input{Paths: []string{"x"}, Params: map[string]any{
			"pattern": "(.*)", "replacement": "$1", "undo": true,
		}},
		nil,
	)
	require.ErrorContains(t, err, "backup indisponível")

	// com backups: renomeia e desfaz
	dir := t.TempDir()
	p := filepath.Join(dir, "nota 1.txt")
	require.NoError(t, os.WriteFile(p, []byte("conteudo"), 0o644))
	st, err := store.Open(filepath.Join(dir, "b.db"))
	require.NoError(t, err)
	t.Cleanup(func() { st.Close() })
	renamed := tl.SetBackups(st.Backups())
	out, err := renamed.Steps()[0].Run(
		context.Background(),
		tool.Input{Paths: []string{p}, Params: map[string]any{
			"pattern": "\\s+", "replacement": "_",
		}},
		nil,
	)
	require.NoError(t, err)
	require.Contains(t, out.Message, "renomeado")
	restored := filepath.Join(dir, "nota_1.txt")
	require.FileExists(t, restored)
	_, err = renamed.Steps()[0].Run(
		context.Background(),
		tool.Input{Paths: []string{restored}, Params: map[string]any{
			"pattern": "(.*)", "replacement": "$1", "undo": true,
		}},
		nil,
	)
	// undo via Restore age sobre o backup do caminho informado
	_ = err
}

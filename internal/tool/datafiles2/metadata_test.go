package datafiles2

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/ferna/axisdoc/internal/tool"
)

// TestToolMetadata cobre getters de todas as tools do pacote.
func TestToolMetadata(t *testing.T) {
	tools := []tool.Tool{
		NewCSVToSQL(), NewSQLToCSV(), NewJSONToTable(),
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

package hashfile

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/ferna/axisdoc/internal/tool"
)

// TestToolMetadata cobre getters da tool.
func TestToolMetadata(t *testing.T) {
	var tl tool.Tool = New()
	require.Equal(t, "security.hashfile", tl.ID())
	require.NotEmpty(t, tl.Category())
	require.NotEmpty(t, tl.Title())
	require.NotEmpty(t, tl.Description())
	require.NotEmpty(t, tl.Icon())
	steps := tl.Steps()
	require.NotEmpty(t, steps)
	for _, s := range steps {
		require.NotEmpty(t, s.Name())
	}
}

// TestParamValidate cobre Validate + helpers de params.
func TestParamValidate(t *testing.T) {
	// types válidos com defaults corretos
	for _, p := range New().Params() {
		require.NoError(t, p.Validate(), "param %s", p.Key)
	}
	// defaults errados por type
	bad := []tool.Param{
		{Key: "s", Label: "l", Type: tool.ParamSelect, Options: []string{"a"}, Default: 1},
		{Key: "n", Label: "l", Type: tool.ParamNumber, Default: true},
		{Key: "b", Label: "l", Type: tool.ParamBool, Default: 1},
		{Key: "t", Label: "l", Type: tool.ParamText, Default: 1},
	}
	for _, p := range bad {
		require.Error(t, p.Validate(), "param %s", p.Key)
	}
	// select sem default é válido
	require.NoError(t, tool.Param{Key: "so", Label: "l", Type: tool.ParamSelect, Options: []string{"a"}}.Validate())
	// select sem options é inválido
	require.Error(t, tool.Param{Key: "sx", Label: "l", Type: tool.ParamSelect}.Validate())
}

// TestParamHelpers cobre ParamString/Bool/Float/OutputDir em todos os ramos.
func TestParamHelpers(t *testing.T) {
	in := tool.Input{Params: map[string]any{
		"s": "v", "i": 3, "f": 2.5, "b": true, "dir": "/tmp/x", "num": "42.5", "bad": "xx",
	}}
	require.Equal(t, "v", tool.ParamString(in, "s", "d"))
	require.Equal(t, "d", tool.ParamString(in, "missing", "d"))
	require.Equal(t, "d", tool.ParamString(in, "i", "d"))
	require.True(t, tool.ParamBoolValue(in, "b", false))
	require.False(t, tool.ParamBoolValue(in, "missing", false))
	require.False(t, tool.ParamBoolValue(in, "s", false))
	require.InDelta(t, 3.0, tool.ParamFloat(in, "i", 0), 0.001)
	require.InDelta(t, 2.5, tool.ParamFloat(in, "f", 0), 0.001)
	require.InDelta(t, 42.5, tool.ParamFloat(in, "num", 0), 0.001)
	require.InDelta(t, 7.0, tool.ParamFloat(in, "bad", 7), 0.001)
	require.InDelta(t, 7.0, tool.ParamFloat(in, "missing", 7), 0.001)
	require.Equal(t, "/tmp/x", tool.OutputDir(tool.Input{Params: map[string]any{"outputDir": "/tmp/x"}}))
	require.Equal(t, ".", tool.OutputDir(tool.Input{}))
	require.NotEqual(t, ".", tool.OutputDir(tool.Input{Paths: []string{"/a/b/f.txt"}}))
}

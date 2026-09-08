package cli

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/ferna/axisdoc/internal/tool"
)

type echoTool struct{}

func (e *echoTool) ID() string          { return "test.echo" }
func (e *echoTool) Category() string    { return "test" }
func (e *echoTool) Title() string       { return "echo" }
func (e *echoTool) Description() string { return "echo tool" }
func (e *echoTool) Icon() string        { return "box" }
func (e *echoTool) Params() []tool.Param {
	return []tool.Param{
		{Key: "n", Label: "n", Type: tool.ParamNumber},
		{Key: "flag", Label: "flag", Type: tool.ParamBool},
		{Key: "name", Label: "name", Type: tool.ParamText},
	}
}
func (e *echoTool) Steps() []tool.Step {
	return []tool.Step{echoStep{}}
}

type echoStep struct{}

func (echoStep) Name() string { return "step.echo" }
func (echoStep) Run(_ context.Context, in tool.Input, report func(pct float64)) (tool.Output, error) {
	return tool.Output{}, nil
}

func TestParseArgs(t *testing.T) {
	tl := &echoTool{}
	paths, params := parseArgs([]string{
		"a.txt", "--n", "5", "--flag", "true", "--name", "x", "b.txt",
	}, tl)
	require.Equal(t, []string{"a.txt", "b.txt"}, paths)
	require.InDelta(t, 5.0, params["n"], 0.001)
	require.Equal(t, true, params["flag"])
	require.Equal(t, "x", params["name"])
}

func TestRunToolCLI(t *testing.T) {
	reg := tool.NewRegistry()
	require.NoError(t, reg.Register(&echoTool{}))
	ok, res, err := Run([]string{"test.echo", "--n", "2", "f.txt"}, reg, t.TempDir())
	require.NoError(t, err)
	require.True(t, ok)
	require.NotNil(t, res)
}

func TestRunToolsList(t *testing.T) {
	reg := tool.NewRegistry()
	require.NoError(t, reg.Register(&echoTool{}))
	ok, _, err := Run([]string{"tools"}, reg, t.TempDir())
	require.NoError(t, err)
	require.True(t, ok)
}

func TestNonToolArgsPassthrough(t *testing.T) {
	reg := tool.NewRegistry()
	ok, _, err := Run([]string{"--alguma-flag"}, reg, t.TempDir())
	require.NoError(t, err)
	require.False(t, ok) // deixa o app desktop abrir
}

func TestRunPipelineMissing(t *testing.T) {
	reg := tool.NewRegistry()
	ok, _, err := Run([]string{"run", "nao-existe", "a.txt"}, reg, t.TempDir())
	require.True(t, ok)
	require.Error(t, err)
}

package tool

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/require"
)

type fakeTool struct {
	id, cat, title, desc, icon string
	steps                      []Step
	params                     []Param
}

func (f *fakeTool) ID() string          { return f.id }
func (f *fakeTool) Category() string    { return f.cat }
func (f *fakeTool) Title() string       { return f.title }
func (f *fakeTool) Description() string { return f.desc }
func (f *fakeTool) Icon() string        { return f.icon }
func (f *fakeTool) Params() []Param     { return f.params }
func (f *fakeTool) Steps() []Step       { return f.steps }

// validTool monta uma tool que passa em todas as validações do Register.
func validTool(id string) *fakeTool {
	return &fakeTool{
		id: id, cat: "c", title: "t.title", desc: "t.desc", icon: "box",
		steps: []Step{okStep{}},
	}
}

func TestRegistryRegisterAndList(t *testing.T) {
	r := NewRegistry()
	b := validTool("b.cat")
	b.cat = "cat2"
	require.NoError(t, r.Register(b))
	a := validTool("a.cat")
	a.cat = "cat1"
	require.NoError(t, r.Register(a))

	list := r.List()
	require.Len(t, list, 2)
	require.Equal(t, "a.cat", list[0].ID()) // ordenado por categoria
	require.Equal(t, []string{"cat1", "cat2"}, r.Categories())
}

func TestRegistryDuplicateID(t *testing.T) {
	r := NewRegistry()
	require.NoError(t, r.Register(validTool("x")))
	err := r.Register(validTool("x"))
	require.Error(t, err)
	require.Contains(t, err.Error(), "duplicado")
}

func TestRegistryNilAndEmptyID(t *testing.T) {
	r := NewRegistry()
	require.Error(t, r.Register(nil))
	require.Error(t, r.Register(&fakeTool{id: ""}))
}

func TestRegistryContractValidation(t *testing.T) {
	cases := map[string]func(*fakeTool){
		"title vazio":     func(f *fakeTool) { f.title = "" },
		"desc vazia":      func(f *fakeTool) { f.desc = "" },
		"icon vazio":      func(f *fakeTool) { f.icon = "" },
		"sem steps":       func(f *fakeTool) { f.steps = nil },
		"key vazia":       func(f *fakeTool) { f.params = []Param{{Key: "", Label: "l", Type: ParamText}} },
		"label vazio":     func(f *fakeTool) { f.params = []Param{{Key: "k", Label: "", Type: ParamText}} },
		"type invalido":   func(f *fakeTool) { f.params = []Param{{Key: "k", Label: "l", Type: "selec"}} },
		"select sem opts": func(f *fakeTool) { f.params = []Param{{Key: "k", Label: "l", Type: ParamSelect}} },
		"dup key": func(f *fakeTool) {
			f.params = []Param{
				{Key: "k", Label: "l", Type: ParamText},
				{Key: "k", Label: "l2", Type: ParamText},
			}
		},
		"default fora de options": func(f *fakeTool) {
			f.params = []Param{{Key: "k", Label: "l", Type: ParamSelect, Options: []string{"a"}, Default: "b"}}
		},
		"default number invalido": func(f *fakeTool) {
			f.params = []Param{{Key: "k", Label: "l", Type: ParamNumber, Default: "x"}}
		},
		"default bool invalido": func(f *fakeTool) {
			f.params = []Param{{Key: "k", Label: "l", Type: ParamBool, Default: "x"}}
		},
		"default text invalido": func(f *fakeTool) {
			f.params = []Param{{Key: "k", Label: "l", Type: ParamText, Default: 1}}
		},
		"default select nao-string": func(f *fakeTool) {
			f.params = []Param{{Key: "k", Label: "l", Type: ParamSelect, Options: []string{"a"}, Default: 1}}
		},
		"max menor que min": func(f *fakeTool) {
			f.params = []Param{{Key: "k", Label: "l", Type: ParamNumber, Min: 10, Max: 1}}
		},
		"file sem accept": func(f *fakeTool) {
			f.params = []Param{{Key: "k", Label: "l", Type: ParamFile}}
		},
		"slider sem number": func(f *fakeTool) {
			f.params = []Param{{Key: "k", Label: "l", Type: ParamText, Widget: WidgetSlider}}
		},
		"slider sem max>min": func(f *fakeTool) {
			f.params = []Param{{Key: "k", Label: "l", Type: ParamNumber, Widget: WidgetSlider, Min: 5, Max: 5}}
		},
		"segmented sem select": func(f *fakeTool) {
			f.params = []Param{{Key: "k", Label: "l", Type: ParamBool, Widget: WidgetSegmented}}
		},
		"switch sem bool": func(f *fakeTool) {
			f.params = []Param{{Key: "k", Label: "l", Type: ParamText, Widget: WidgetSwitch}}
		},
		"widget inválido": func(f *fakeTool) {
			f.params = []Param{{Key: "k", Label: "l", Type: ParamText, Widget: "dial"}}
		},
		"visibleIf sem key": func(f *fakeTool) {
			f.params = []Param{{Key: "k", Label: "l", Type: ParamText, VisibleIf: &VisibleIf{}}}
		},
	}
	for name, mutate := range cases {
		t.Run(name, func(t *testing.T) {
			r := NewRegistry()
			f := validTool("t")
			mutate(f)
			require.Error(t, r.Register(f), "deveria rejeitar: %s", name)
		})
	}
}

func TestRegistryAcceptsNewFields(t *testing.T) {
	r := NewRegistry()
	f := validTool("ok")
	f.params = []Param{
		{Key: "a", Label: "l", Type: ParamNumber, Default: 1, Min: 0, Max: 10, Widget: WidgetSlider, Hint: "h", Placeholder: "p"},
		{Key: "b", Label: "l", Type: ParamFile, Accept: []string{".pdf"}},
		{Key: "c", Label: "l", Type: ParamTextarea},
		{Key: "d", Label: "l", Type: ParamBool, Widget: WidgetSwitch, VisibleIf: &VisibleIf{Key: "b", Equals: true}},
	}
	require.NoError(t, r.Register(f))
}

func TestRegistryGet(t *testing.T) {
	r := NewRegistry()
	tool := validTool("abc")
	require.NoError(t, r.Register(tool))
	got, err := r.Get("abc")
	require.NoError(t, err)
	require.Same(t, tool, got)

	_, err = r.Get("nope")
	require.Error(t, err)
}

type okStep struct{}

func (okStep) Name() string { return "step.ok" }
func (okStep) Run(ctx context.Context, in Input, report func(pct float64)) (Output, error) {
	return Output{Message: "ok"}, nil
}

func TestToolDefaults(t *testing.T) {
	ft := &fakeTool{id: "t", steps: []Step{okStep{}}}
	require.Equal(t, []Step{okStep{}}, ft.Steps())
	_ = errors.New // keep import
}

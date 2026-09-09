package search

import (
	"context"
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/ferna/axisdoc/internal/store"
	"github.com/ferna/axisdoc/internal/tool"
)

func setup(t *testing.T) (*Service, context.Context) {
	t.Helper()
	st, err := store.Open(filepath.Join(t.TempDir(), "db.sqlite3"))
	require.NoError(t, err)
	t.Cleanup(func() { st.Close() })
	return NewService(st.Search()), context.Background()
}

func TestFTS5Available(t *testing.T) {
	svc, ctx := setup(t)
	require.NoError(t, svc.repo.Index(ctx, store.SearchDoc{
		DocID: "d1", Path: "/tmp/contrato.txt", Title: "contrato.txt",
		Content: "contrato de prestação de serviços entre as partes",
	}))
	require.NoError(t, svc.repo.Index(ctx, store.SearchDoc{
		DocID: "d2", Path: "/tmp/nota.txt", Title: "nota.txt",
		Content: "reunião agendada para segunda-feira",
	}))
	hits, err := svc.Query(ctx, "serviços", 10)
	require.NoError(t, err)
	require.Len(t, hits, 1)
	require.Equal(t, "d1", hits[0].DocID)
	require.NotEmpty(t, hits[0].Snippet)
}

func TestSearchIndexToolMetadata(t *testing.T) {
	svc, _ := setup(t)
	tl := NewIndexTool(svc)
	require.Equal(t, "search.index", tl.ID())
	require.NotEmpty(t, tl.Category())
	require.NotEmpty(t, tl.Title())
	require.NotEmpty(t, tl.Description())
	require.NotEmpty(t, tl.Icon())
	for _, p := range tl.Params() {
		require.NoError(t, p.Validate(), "param %s", p.Key)
	}
	steps := tl.Steps()
	require.Len(t, steps, 1)
	require.NotEmpty(t, steps[0].Name())
}

func TestSearchRemoveAndCount(t *testing.T) {
	svc, ctx := setup(t)
	require.NoError(t, svc.repo.Index(ctx, store.SearchDoc{
		DocID: "d1", Path: "/a.txt", Title: "a", Content: "conteúdo único xyz",
	}))
	n, err := svc.Count(ctx)
	require.NoError(t, err)
	require.Equal(t, 1, n)
	require.NoError(t, svc.repo.Remove(ctx, "d1"))
	n, _ = svc.Count(ctx)
	require.Equal(t, 0, n)
	hits, err := svc.Query(ctx, "único", 10)
	require.NoError(t, err)
	require.Empty(t, hits)
}

func TestSearchIndexToolRecursive(t *testing.T) {
	svc, ctx := setup(t)
	dir := t.TempDir()
	sub := filepath.Join(dir, "sub")
	require.NoError(t, os.MkdirAll(sub, 0o755))
	require.NoError(t, os.WriteFile(filepath.Join(sub, "dentro.txt"), []byte("texto profundo"), 0o644))
	tl := NewIndexTool(svc)
	out, err := tl.Steps()[0].Run(ctx, tool.Input{
		Paths:  []string{dir},
		Params: map[string]any{"recursive": true},
	}, nil)
	require.NoError(t, err)
	require.Contains(t, out.Message, "1 documento")
	hits, err := svc.Query(ctx, "profundo", 10)
	require.NoError(t, err)
	require.Len(t, hits, 1)
}

func TestSearchDiacriticsInsensitive(t *testing.T) {
	svc, ctx := setup(t)
	require.NoError(t, svc.repo.Index(ctx, store.SearchDoc{
		DocID: "d1", Path: "/x.txt", Title: "x", Content: "documentação do sistema",
	}))
	// busca sem acento encontra (remove_diacritics 2)
	hits, err := svc.Query(ctx, "documentacao", 10)
	require.NoError(t, err)
	require.Len(t, hits, 1)
}

func TestIndexAndQueryRoundTrip(t *testing.T) {
	svc, ctx := setup(t)
	dir := t.TempDir()
	p := filepath.Join(dir, "relatorio.txt")
	require.NoError(t, os.WriteFile(p, []byte("resultado trimestral com lucro recorde"), 0o644))

	n, err := svc.IndexFiles(ctx, []string{dir}, nil)
	require.NoError(t, err)
	require.Equal(t, 1, n)

	hits, err := svc.Query(ctx, "lucro", 10)
	require.NoError(t, err)
	require.Len(t, hits, 1)
	require.Equal(t, p, hits[0].Path)

	// reindexar não duplica
	n, err = svc.IndexFiles(ctx, []string{p}, nil)
	require.NoError(t, err)
	require.Equal(t, 1, n)
	hits, _ = svc.Query(ctx, "lucro", 10)
	require.Len(t, hits, 1)

	// formato não suportado é ignorado
	other := filepath.Join(dir, "imagem.png")
	require.NoError(t, os.WriteFile(other, []byte{0, 1, 2}, 0o644))
	n, err = svc.IndexFiles(ctx, []string{other}, nil)
	require.NoError(t, err)
	require.Equal(t, 0, n)
}

func TestIndexToolRun(t *testing.T) {
	svc, ctx := setup(t)
	dir := t.TempDir()
	require.NoError(t, os.WriteFile(filepath.Join(dir, "doc.md"), []byte("plano de ação 2026"), 0o644))

	tl := NewIndexTool(svc)
	in := tool.Input{Paths: []string{dir}, Params: map[string]any{"recursive": false}}
	out, err := tl.Steps()[0].Run(ctx, in, nil)
	require.NoError(t, err)
	require.Contains(t, out.Message, "indexado")
}

func TestCountAndEmptyQuery(t *testing.T) {
	svc, ctx := setup(t)
	n, err := svc.Count(ctx)
	require.NoError(t, err)
	require.Equal(t, 0, n)
	hits, err := svc.Query(ctx, "  ", 10)
	require.NoError(t, err)
	require.Empty(t, hits)
}

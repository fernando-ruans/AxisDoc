package search

import (
	"context"
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/ferna/axisdoc/internal/store"
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

func TestCountAndEmptyQuery(t *testing.T) {
	svc, ctx := setup(t)
	n, err := svc.Count(ctx)
	require.NoError(t, err)
	require.Equal(t, 0, n)
	hits, err := svc.Query(ctx, "  ", 10)
	require.NoError(t, err)
	require.Empty(t, hits)
}

func TestQueryPrefixAndOperators(t *testing.T) {
	svc, ctx := setup(t)
	require.NoError(t, svc.repo.Index(ctx, store.SearchDoc{
		DocID: "d1", Path: "/a.txt", Title: "a", Content: "conversor jsonformat instalado",
	}))
	// prefixo: "json" acha "jsonformat"
	hits, err := svc.Query(ctx, "json", 10)
	require.NoError(t, err)
	require.Len(t, hits, 1)
	// operadores FTS5 digitados não quebram a busca (AND implícito entre termos)
	hits, err = svc.Query(ctx, `json instalado`, 10)
	require.NoError(t, err)
	require.Len(t, hits, 1)
	// só operadores → vazio, sem erro
	hits, err = svc.Query(ctx, `" * ^`, 10)
	require.NoError(t, err)
	require.Empty(t, hits)
}

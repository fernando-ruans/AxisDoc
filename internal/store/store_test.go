package store

import (
	"context"
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/require"
)

func openTest(t *testing.T) *Store {
	t.Helper()
	s, err := Open(filepath.Join(t.TempDir(), "test.db"))
	require.NoError(t, err)
	t.Cleanup(func() { s.Close() })
	return s
}

func TestMigrationsIdempotent(t *testing.T) {
	dir := t.TempDir()
	dbPath := filepath.Join(dir, "m.db")
	s1, err := Open(dbPath)
	require.NoError(t, err)
	require.NoError(t, s1.Close())

	// reabrir não deve falhar nem duplicar schema
	s2, err := Open(dbPath)
	require.NoError(t, err)
	defer s2.Close()

	var v int
	require.NoError(t, s2.db.QueryRow(`PRAGMA user_version`).Scan(&v))
	require.GreaterOrEqual(t, v, 1)
}

func TestSettingsRoundTrip(t *testing.T) {
	s := openTest(t)
	ctx := context.Background()
	repo := s.Jobs()

	j := &Job{ID: "job1", ToolID: "security.hashfile", Status: StatusQueued,
		Input: map[string]any{"paths": []string{"a.txt"}}}
	require.NoError(t, repo.Insert(ctx, j))

	got, err := repo.Get(ctx, "job1")
	require.NoError(t, err)
	require.Equal(t, "job1", got.ID)
	require.Equal(t, StatusQueued, got.Status)
	require.Equal(t, []any{"a.txt"}, got.Input["paths"])
	require.False(t, got.CreatedAt.IsZero())

	require.NoError(t, repo.UpdateProgress(ctx, "job1", 42.5))
	got, _ = repo.Get(ctx, "job1")
	require.InDelta(t, 42.5, got.Progress, 0.001)

	out := map[string]any{"paths": []string{"out.txt"}, "message": "ok"}
	require.NoError(t, repo.Finish(ctx, "job1", StatusDone, out, ""))
	got, _ = repo.Get(ctx, "job1")
	require.Equal(t, StatusDone, got.Status)
	require.InDelta(t, 100, got.Progress, 0.001)
	require.Equal(t, "ok", got.Output["message"])
}

func TestJobDeleteAndClear(t *testing.T) {
	s := openTest(t)
	ctx := context.Background()
	repo := s.Jobs()

	mk := func(id string) *Job {
		return &Job{ID: id, ToolID: "t", Status: StatusDone, Input: map[string]any{}}
	}
	require.NoError(t, repo.Insert(ctx, mk("j1")))
	require.NoError(t, repo.Insert(ctx, mk("j2")))

	require.NoError(t, repo.Delete(ctx, "j1"))
	_, err := repo.Get(ctx, "j1")
	require.ErrorIs(t, err, ErrNotFound)
	got, err := repo.Get(ctx, "j2")
	require.NoError(t, err)
	require.Equal(t, "j2", got.ID)

	require.ErrorIs(t, repo.Delete(ctx, "inexistente"), ErrNotFound)

	require.NoError(t, repo.ClearHistory(ctx))
	list, err := repo.List(ctx, 10)
	require.NoError(t, err)
	require.Empty(t, list)
}

func TestJobNotFound(t *testing.T) {
	s := openTest(t)
	_, err := s.Jobs().Get(context.Background(), "nope")
	require.ErrorIs(t, err, ErrNotFound)
	require.ErrorIs(t, s.Jobs().UpdateProgress(context.Background(), "nope", 1), ErrNotFound)
	require.ErrorIs(t, s.Jobs().Finish(context.Background(), "nope", StatusDone, nil, ""), ErrNotFound)
}

func TestJobListOrder(t *testing.T) {
	s := openTest(t)
	ctx := context.Background()
	repo := s.Jobs()
	for _, id := range []string{"j1", "j2", "j3"} {
		require.NoError(t, repo.Insert(ctx, &Job{ID: id, ToolID: "t", Status: StatusQueued}))
	}
	list, err := repo.List(ctx, 10)
	require.NoError(t, err)
	require.Len(t, list, 3)
}

func TestResetRunning(t *testing.T) {
	s := openTest(t)
	ctx := context.Background()
	repo := s.Jobs()
	require.NoError(t, repo.Insert(ctx, &Job{ID: "orphan", ToolID: "t", Status: StatusRunning}))
	require.NoError(t, repo.Insert(ctx, &Job{ID: "done", ToolID: "t", Status: StatusDone}))

	require.NoError(t, repo.ResetRunning(ctx))

	got, _ := repo.Get(ctx, "orphan")
	require.Equal(t, StatusFailed, got.Status)
	require.NotEmpty(t, got.Error)
	got, _ = repo.Get(ctx, "done")
	require.Equal(t, StatusDone, got.Status)
}

func TestSettingsRoundTripReal(t *testing.T) {
	s := openTest(t)
	ctx := context.Background()
	r := s.Settings()

	v, err := r.Get(ctx, "theme")
	require.NoError(t, err)
	require.Empty(t, v) // não existe

	require.NoError(t, r.Set(ctx, "theme", "dark"))
	v, _ = r.Get(ctx, "theme")
	require.Equal(t, "dark", v)

	require.NoError(t, r.Set(ctx, "theme", "light")) // upsert
	v, _ = r.Get(ctx, "theme")
	require.Equal(t, "light", v)
}

func TestBackupSaveAndRestore(t *testing.T) {
	s := openTest(t)
	ctx := context.Background()
	dir := t.TempDir()
	p := filepath.Join(dir, "arquivo.txt")

	// arquivo inexistente → backup vazio; restore remove o arquivo criado depois
	require.NoError(t, s.Backups().SaveFile(ctx, "job1", p))
	require.NoError(t, os.WriteFile(p, []byte("novo"), 0o644))
	require.NoError(t, s.Backups().Restore(ctx, p))
	_, err := os.Stat(p)
	require.True(t, os.IsNotExist(err))

	// arquivo existente → backup com conteúdo
	require.NoError(t, os.WriteFile(p, []byte("original"), 0o644))
	require.NoError(t, s.Backups().SaveFile(ctx, "job1", p))
	require.NoError(t, os.WriteFile(p, []byte("sobrescrito"), 0o644))
	require.NoError(t, s.Backups().Restore(ctx, p))
	data, err := os.ReadFile(p)
	require.NoError(t, err)
	require.Equal(t, "original", string(data))
}

package hashfile

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/ferna/axisdoc/internal/tool"
)

func writeFixture(t *testing.T, name, content string) string {
	t.Helper()
	p := filepath.Join(t.TempDir(), name)
	require.NoError(t, os.WriteFile(p, []byte(content), 0o644))
	return p
}

func TestHashFileSHA256(t *testing.T) {
	p := writeFixture(t, "a.txt", "hello axisdoc")
	want := sha256.Sum256([]byte("hello axisdoc"))

	var lastPct float64
	out, err := New().Run(context.Background(), tool.Input{
		Paths:  []string{p},
		Params: map[string]any{"algorithm": SHA256},
	}, func(pct float64) { lastPct = pct })

	require.NoError(t, err)
	require.Equal(t, hex.EncodeToString(want[:]), firstHash(t, out.Message))
	require.InDelta(t, 100, lastPct, 0.01)
}

func TestHashFileAlgorithms(t *testing.T) {
	p := writeFixture(t, "b.txt", "abc")
	tests := map[string]string{
		SHA256: "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
		SHA1:   "a9993e364706816aba3e25717850c26c9cd0d89d",
		MD5:    "900150983cd24fb0d6963f7d28e17f72",
	}
	for algo, want := range tests {
		t.Run(algo, func(t *testing.T) {
			out, err := New().Run(context.Background(), tool.Input{
				Paths:  []string{p},
				Params: map[string]any{"algorithm": algo},
			}, nil)
			require.NoError(t, err)
			require.Contains(t, out.Message, want)
		})
	}
}

func TestHashFileCRC32(t *testing.T) {
	p := writeFixture(t, "c.txt", "123456789")
	out, err := New().Run(context.Background(), tool.Input{
		Paths:  []string{p},
		Params: map[string]any{"algorithm": CRC32},
	}, nil)
	require.NoError(t, err)
	require.Contains(t, out.Message, "e3069283") // CRC-32 Castagnoli de "123456789"
}

func TestHashFileInvalidAlgorithm(t *testing.T) {
	p := writeFixture(t, "d.txt", "x")
	_, err := New().Run(context.Background(), tool.Input{
		Paths:  []string{p},
		Params: map[string]any{"algorithm": "rot13"},
	}, nil)
	require.ErrorContains(t, err, "algoritmo inválido")
}

func TestHashFileNoPaths(t *testing.T) {
	_, err := New().Run(context.Background(), tool.Input{Params: map[string]any{}}, nil)
	require.ErrorContains(t, err, "nenhum arquivo")
}

func TestHashFileMissingFile(t *testing.T) {
	missing := filepath.Join(t.TempDir(), "nao-existe.txt")
	out, err := New().Run(context.Background(), tool.Input{Paths: []string{missing}}, nil)
	require.NoError(t, err) // erro por-arquivo, não fatal
	require.Contains(t, out.Message, "ERRO")
}

func TestHashFileDirectory(t *testing.T) {
	out, err := New().Run(context.Background(), tool.Input{Paths: []string{t.TempDir()}}, nil)
	require.NoError(t, err)
	require.Contains(t, out.Message, "ERRO")
}

func TestHashFileOutputToFile(t *testing.T) {
	p := writeFixture(t, "e.txt", "conteudo")
	dest := filepath.Join(t.TempDir(), "hashes.txt")
	_, err := New().Run(context.Background(), tool.Input{
		Paths:  []string{p},
		Params: map[string]any{"algorithm": SHA256, "outputPath": dest},
	}, nil)
	require.NoError(t, err)
	data, err := os.ReadFile(dest)
	require.NoError(t, err)
	require.NotEmpty(t, data)
}

func TestHashFileCancel(t *testing.T) {
	p := writeFixture(t, "f.txt", "x")
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	_, err := New().Run(ctx, tool.Input{Paths: []string{p}}, nil)
	require.ErrorIs(t, err, context.Canceled)
}

func TestHashFileMetadata(t *testing.T) {
	h := New()
	require.Equal(t, "security.hashfile", h.ID())
	require.Equal(t, "security", h.Category())
	require.NotEmpty(t, h.Title())
	require.NotEmpty(t, h.Description())
	require.Len(t, h.Steps(), 1)
}

// firstHash extrai o primeiro hash (antes de "  caminho") da mensagem.
func firstHash(t *testing.T, msg string) string {
	t.Helper()
	require.NotEmpty(t, msg)
	line := msg
	for i, r := range msg {
		_ = r
		_ = i
		break
	}
	// formato: "<hash>  <caminho>"
	for i := 0; i < len(line); i++ {
		if line[i] == ' ' {
			return line[:i]
		}
	}
	return line
}

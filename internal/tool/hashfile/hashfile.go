// Package hashfile implementa a ferramenta "hash de arquivos".
package hashfile

import (
	"bufio"
	"context"
	"crypto/md5"
	"crypto/sha1"
	"crypto/sha256"
	"crypto/sha512"
	"encoding/hex"
	"fmt"
	"hash"
	"hash/crc32"
	"io"
	"os"
	"strings"

	"github.com/ferna/axisdoc/internal/tool"
)

// Algoritmos suportados.
const (
	SHA256 = "sha256"
	SHA512 = "sha512"
	SHA1   = "sha1"
	MD5    = "md5"
	CRC32  = "crc32"
)

// Algorithms lista os algoritmos válidos.
var Algorithms = []string{SHA256, SHA512, SHA1, MD5, CRC32}

// HashFile calcula hashes de um conjunto de arquivos.
type HashFile struct{}

// New cria a ferramenta.
func New() *HashFile { return &HashFile{} }

// ID implementa tool.Tool.
func (h *HashFile) ID() string { return "security.hashfile" }

// Category implementa tool.Tool.
func (h *HashFile) Category() string { return "security" }

// Title implementa tool.Tool.
func (h *HashFile) Title() string { return "tool.hashfile.title" }

// Description implementa tool.Tool.
func (h *HashFile) Description() string { return "tool.hashfile.desc" }

// Icon implementa tool.Tool.
func (h *HashFile) Icon() string { return "fingerprint" }

// Params implementa tool.Tool.
func (h *HashFile) Params() []tool.Param {
	return []tool.Param{
		{Key: "algorithm", Label: "param.algorithm.label", Type: tool.ParamSelect, Options: Algorithms, Default: SHA256, Required: true},
		{Key: "outputPath", Label: "param.outputPath.label", Type: tool.ParamOutput},
	}
}

// Steps implementa tool.Tool.
func (h *HashFile) Steps() []tool.Step { return []tool.Step{h} }

// Name implementa tool.Step.
func (h *HashFile) Name() string { return "step.hashfile.compute" }

// Result é uma linha de saída: arquivo + hash.
type Result struct {
	Path  string `json:"path"`
	Hash  string `json:"hash"`
	Size  int64  `json:"size"`
	Error string `json:"error,omitempty"`
}

// Run implementa tool.Step.
func (h *HashFile) Run(ctx context.Context, in tool.Input, report func(pct float64)) (tool.Output, error) {
	algo, _ := in.Params["algorithm"].(string)
	if algo == "" {
		algo = SHA256
	}
	newHash, err := newHasher(algo)
	if err != nil {
		return tool.Output{}, err
	}

	if len(in.Paths) == 0 {
		return tool.Output{}, fmt.Errorf("hashfile: nenhum arquivo informado")
	}

	results := make([]Result, 0, len(in.Paths))
	var sb strings.Builder
	for i, p := range in.Paths {
		if err := ctx.Err(); err != nil {
			return tool.Output{}, err
		}
		res := hashOne(p, newHash)
		results = append(results, res)
		if res.Error == "" {
			fmt.Fprintf(&sb, "%s  %s\n", res.Hash, res.Path)
		} else {
			fmt.Fprintf(&sb, "ERRO %s: %s\n", res.Path, res.Error)
		}
		if report != nil {
			report(float64(i+1) / float64(len(in.Paths)) * 100)
		}
	}

	out := tool.Output{Message: strings.TrimRight(sb.String(), "\n")}
	// Se um arquivo de saída foi pedido, escreve os resultados.
	if dest, ok := in.Params["outputPath"].(string); ok && dest != "" {
		if err := writeResults(dest, sb.String()); err != nil {
			return tool.Output{}, fmt.Errorf("hashfile: gravar saída: %w", err)
		}
		out.Paths = []string{dest}
	}
	return out, nil
}

func hashOne(path string, newHash func() hash.Hash) Result {
	res := Result{Path: path}
	f, err := os.Open(path)
	if err != nil {
		res.Error = err.Error()
		return res
	}
	defer f.Close()
	st, err := f.Stat()
	if err != nil {
		res.Error = err.Error()
		return res
	}
	res.Size = st.Size()
	if st.IsDir() {
		res.Error = "é um diretório"
		return res
	}
	digest := newHash()
	if _, err := io.Copy(digest, bufio.NewReaderSize(f, 1<<20)); err != nil {
		res.Error = err.Error()
		return res
	}
	res.Hash = encode(digest)
	return res
}

func newHasher(algo string) (func() hash.Hash, error) {
	switch strings.ToLower(algo) {
	case SHA256:
		return func() hash.Hash { return sha256.New() }, nil
	case SHA512:
		return func() hash.Hash { return sha512.New() }, nil
	case SHA1:
		return func() hash.Hash { return sha1.New() }, nil
	case MD5:
		return func() hash.Hash { return md5.New() }, nil
	case CRC32:
		return func() hash.Hash { return &crc32Writer{} }, nil
	default:
		return nil, fmt.Errorf("hashfile: algoritmo inválido %q", algo)
	}
}

// crc32Writer adapta hash.Hash32-like para a interface hash.Hash.
type crc32Writer struct{ v uint32 }

func (w *crc32Writer) Write(p []byte) (int, error) {
	w.v = crc32.Update(w.v, crc32.MakeTable(crc32.Castagnoli), p)
	return len(p), nil
}

func (w *crc32Writer) Sum(b []byte) []byte {
	out := make([]byte, 4)
	out[0] = byte(w.v >> 24)
	out[1] = byte(w.v >> 16)
	out[2] = byte(w.v >> 8)
	out[3] = byte(w.v)
	return append(b, out...)
}

func (w *crc32Writer) Reset() { w.v = 0 }

func (w *crc32Writer) Size() int      { return 4 }
func (w *crc32Writer) BlockSize() int { return 64 }

func encode(digest hash.Hash) string {
	// CRC32 usa Castagnoli; hex no formato little-endian padrão da ferramenta.
	if _, ok := digest.(*crc32Writer); ok {
		sum := digest.Sum(nil)
		// converte big-endian para o formato decimal padrão do crc32
		v := uint32(sum[0])<<24 | uint32(sum[1])<<16 | uint32(sum[2])<<8 | uint32(sum[3])
		return fmt.Sprintf("%08x", v)
	}
	return hex.EncodeToString(digest.Sum(nil))
}

func writeResults(dest, content string) error {
	return os.WriteFile(dest, []byte(content), 0o644)
}

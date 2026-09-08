// Package output centraliza escrita segura de arquivos gerados:
// grava em temp e move ao destino somente no sucesso.
package output

import (
	"fmt"
	"image"
	"image/png"
	"io"
	"os"
	"path/filepath"
)

// TempDir cria um diretório temporário para os artefatos de um job.
func TempDir() (string, error) {
	return os.MkdirTemp("", "axisdoc-job-*")
}

// WriteFile grava content em dest com segurança: escreve em .tmp e renomeia.
func WriteFile(dest string, content []byte) error {
	if err := os.MkdirAll(filepath.Dir(dest), 0o755); err != nil {
		return fmt.Errorf("output: criar diretório: %w", err)
	}
	tmp := dest + ".axisdoc-tmp"
	if err := os.WriteFile(tmp, content, 0o644); err != nil {
		return fmt.Errorf("output: gravar temp: %w", err)
	}
	if err := os.Rename(tmp, dest); err != nil {
		os.Remove(tmp)
		return fmt.Errorf("output: mover para destino: %w", err)
	}
	return nil
}

// WriteImagePNG grava uma image.Image como PNG de forma atômica (temp + rename).
func WriteImagePNG(dest string, img image.Image) error {
	if err := os.MkdirAll(filepath.Dir(dest), 0o755); err != nil {
		return fmt.Errorf("output: criar diretório: %w", err)
	}
	tmp := dest + ".axisdoc-tmp"
	f, err := os.Create(tmp)
	if err != nil {
		return fmt.Errorf("output: criar %s: %w", dest, err)
	}
	if err := png.Encode(f, img); err != nil {
		f.Close()
		os.Remove(tmp)
		return fmt.Errorf("output: codificar PNG: %w", err)
	}
	if err := f.Close(); err != nil {
		os.Remove(tmp)
		return fmt.Errorf("output: fechar temp: %w", err)
	}
	if err := os.Rename(tmp, dest); err != nil {
		os.Remove(tmp)
		return fmt.Errorf("output: mover para destino: %w", err)
	}
	return nil
}

// CopyFile copia src para dest (cria diretórios).
func CopyFile(src, dest string) error {
	if err := os.MkdirAll(filepath.Dir(dest), 0o755); err != nil {
		return fmt.Errorf("output: criar diretório: %w", err)
	}
	in, err := os.Open(src)
	if err != nil {
		return fmt.Errorf("output: abrir %s: %w", src, err)
	}
	defer in.Close()
	out, err := os.Create(dest)
	if err != nil {
		return fmt.Errorf("output: criar %s: %w", dest, err)
	}
	defer out.Close()
	if _, err := io.Copy(out, in); err != nil {
		return fmt.Errorf("output: copiar: %w", err)
	}
	return nil
}

// NextAvailablePath retorna dest, ou dest (2).ext, (3).ext... se existir.
func NextAvailablePath(dest string) string {
	if _, err := os.Stat(dest); os.IsNotExist(err) {
		return dest
	}
	ext := filepath.Ext(dest)
	base := dest[:len(dest)-len(ext)]
	for i := 2; ; i++ {
		p := fmt.Sprintf("%s (%d)%s", base, i, ext)
		if _, err := os.Stat(p); os.IsNotExist(err) {
			return p
		}
	}
}

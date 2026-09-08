// Package ocr implementa OCR via tesseract (binário local, sem API externa).
// O binário pode estar no PATH (AXISDOC_TESSERACT) ou em tessdata embutida.
package ocr

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"
)

// Config da execução do tesseract.
type Config struct {
	// Bin é o caminho do executável tesseract (default: "tesseract" no PATH).
	Bin string
	// Lang é o idioma(s) do traineddata, ex: "por", "eng", "por+eng".
	Lang string
	// TessDataPrefix aponta para o diretório de traineddata (opcional).
	TessDataPrefix string
	// Timeout por arquivo.
	Timeout time.Duration
}

// DefaultConfig cria a config padrão.
func DefaultConfig() Config {
	return Config{
		Bin:     "tesseract",
		Lang:    "por+eng",
		Timeout: 2 * time.Minute,
	}
}

// Available verifica se o tesseract está acessível no ambiente.
func Available(cfg Config) bool {
	bin := cfg.Bin
	if bin == "tesseract" {
		if v := os.Getenv("AXISDOC_TESSERACT"); v != "" {
			bin = v
		}
	}
	cmd := exec.Command(bin, "--version")
	cmd.Env = append(os.Environ(), tessDataEnv(cfg)...)
	return cmd.Run() == nil
}

func tessDataEnv(cfg Config) []string {
	if cfg.TessDataPrefix != "" {
		return []string{"TESSDATA_PREFIX=" + cfg.TessDataPrefix}
	}
	return nil
}

// ImageToText roda OCR sobre uma imagem e retorna o texto extraído.
func ImageToText(ctx context.Context, imagePath string, cfg Config) (string, error) {
	if _, err := os.Stat(imagePath); err != nil {
		return "", fmt.Errorf("ocr: %w", err)
	}
	bin := cfg.Bin
	if bin == "tesseract" {
		if v := os.Getenv("AXISDOC_TESSERACT"); v != "" {
			bin = v
		}
	}
	lang := cfg.Lang
	if lang == "" {
		lang = "eng"
	}
	timeout := cfg.Timeout
	if timeout <= 0 {
		timeout = 2 * time.Minute
	}
	cctx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	cmd := exec.CommandContext(cctx, bin, imagePath, "stdout", "-l", lang)
	cmd.Env = append(os.Environ(), tessDataEnv(cfg)...)
	out, err := cmd.Output()
	if err != nil {
		return "", fmt.Errorf("ocr: tesseract: %w", err)
	}
	return strings.TrimSpace(string(out)), nil
}

// SupportedImageExtensions lista extensões que o tesseract aceita.
var SupportedImageExtensions = []string{".png", ".jpg", ".jpeg", ".tif", ".tiff", ".bmp", ".webp"}

// IsSupportedImage verifica a extensão.
func IsSupportedImage(path string) bool {
	ext := strings.ToLower(filepath.Ext(path))
	for _, e := range SupportedImageExtensions {
		if ext == e {
			return true
		}
	}
	return false
}

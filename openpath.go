package main

import (
	"fmt"
	"os"
	"path/filepath"
)

// openPathSys abre um arquivo/pasta com o programa padrão do SO.
func openPathSys(path string) error {
	if path == "" {
		return fmt.Errorf("caminho vazio")
	}
	if _, err := os.Stat(path); err != nil {
		return fmt.Errorf("arquivo não encontrado: %s", path)
	}
	return openExternal(path)
}

// revealSys abre o explorador de arquivos destacando o arquivo.
func revealSys(path string) error {
	if path == "" {
		return fmt.Errorf("caminho vazio")
	}
	abs, err := filepath.Abs(path)
	if err != nil {
		abs = path
	}
	return revealExternal(abs)
}

package main

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/go-pdf/fpdf"
	"github.com/pdfcpu/pdfcpu/pkg/api"

	"github.com/ferna/axisdoc/internal/output"
	"github.com/ferna/axisdoc/internal/tool"
	"github.com/ferna/axisdoc/internal/tool/pdftools3"
)

// PdfEditService expõe operações de edição de PDF ao editor visual.
type PdfEditService struct{}

// Remove remove páginas (range "1,3-5") e retorna o novo arquivo.
func (s *PdfEditService) Remove(pdfPath, pages, outputDir string) ([]string, error) {
	dest, err := editDest2(pdfPath, outputDir, "edit")
	if err != nil {
		return nil, err
	}
	return removePages(pdfPath, pages, dest)
}

// Reorder reordena páginas ("3,1,2") e retorna o novo arquivo.
func (s *PdfEditService) Reorder(pdfPath, order, outputDir string) ([]string, error) {
	dest, err := editDest2(pdfPath, outputDir, "ordem")
	if err != nil {
		return nil, err
	}
	return reorderPages(pdfPath, order, dest)
}

// Rotate gira páginas específicas e retorna o novo arquivo.
func (s *PdfEditService) Rotate(pdfPath string, rots []PageRotation, outputDir string) ([]string, error) {
	dest, err := editDest2(pdfPath, outputDir, "girado")
	if err != nil {
		return nil, err
	}
	return rotatePages(pdfPath, rots, dest)
}

// InsertBlank anexa N páginas em branco no fim e retorna o novo arquivo.
func (s *PdfEditService) InsertBlank(pdfPath string, count int, outputDir string) ([]string, error) {
	dest, err := editDest2(pdfPath, outputDir, "edit")
	if err != nil {
		return nil, err
	}
	return insertBlank(pdfPath, count, dest)
}

// PageRotation descreve rotação de uma página (1-based).
type PageRotation struct {
	Page  int `json:"page"`
	Angle int `json:"angle"`
}

func editDest2(pdfPath, outputDir, suffix string) (string, error) {
	if _, err := os.Stat(pdfPath); err != nil {
		return "", fmt.Errorf("pdf não encontrado: %w", err)
	}
	if outputDir == "" {
		outputDir = filepath.Dir(pdfPath)
	}
	stem := strings.TrimSuffix(filepath.Base(pdfPath), filepath.Ext(pdfPath))
	return output.NextAvailablePath(filepath.Join(outputDir, stem+"_"+suffix+".pdf")), nil
}

func reorderPages(pdfPath, order, dest string) ([]string, error) {
	sel, err := pdftools3.ParseOrder(order)
	if err != nil {
		return nil, err
	}
	if err := api.CollectFile(pdfPath, dest, sel, nil); err != nil {
		return nil, fmt.Errorf("reordenar: %w", err)
	}
	return []string{dest}, nil
}

func removePages(pdfPath, pages, dest string) ([]string, error) {
	tokens := strings.Split(strings.TrimSpace(pages), ",")
	var sel []string
	for _, tok := range tokens {
		tok = strings.TrimSpace(tok)
		if tok == "" {
			return nil, fmt.Errorf("token vazio")
		}
		sel = append(sel, tok)
	}
	if len(sel) == 0 {
		return nil, fmt.Errorf("nenhuma página informada")
	}
	if err := api.RemovePagesFile(pdfPath, dest, sel, nil); err != nil {
		return nil, fmt.Errorf("remover: %w", err)
	}
	return []string{dest}, nil
}

func rotatePages(pdfPath string, rots []PageRotation, dest string) ([]string, error) {
	current := pdfPath
	// temps de todas as rotações intermediárias (limpos no fim)
	var temps []string
	defer func() {
		for _, t := range temps {
			os.RemoveAll(t)
		}
	}()
	mkTemp := func() (string, error) {
		tmp, err := output.TempDir()
		if err != nil {
			return "", err
		}
		temps = append(temps, tmp)
		return filepath.Join(tmp, "rot.pdf"), nil
	}
	for _, r := range rots {
		if r.Angle%90 != 0 {
			return nil, fmt.Errorf("ângulo deve ser múltiplo de 90")
		}
		inter, err := mkTemp()
		if err != nil {
			return nil, err
		}
		sel := []string{fmt.Sprintf("%d", r.Page)}
		if err := api.RotateFile(current, inter, r.Angle%360, sel, nil); err != nil {
			return nil, fmt.Errorf("girar página %d: %w", r.Page, err)
		}
		data, err := os.ReadFile(inter)
		if err != nil {
			return nil, err
		}
		// move para o destino progressivo
		if r == rots[len(rots)-1] {
			if err := output.WriteFile(dest, data); err != nil {
				return nil, err
			}
			current = dest
			continue
		}
		next, err := mkTemp()
		if err != nil {
			return nil, err
		}
		if err := output.WriteFile(next, data); err != nil {
			return nil, err
		}
		current = next
	}
	return []string{current}, nil
}

func insertBlank(pdfPath string, count int, dest string) ([]string, error) {
	if count < 1 {
		return nil, fmt.Errorf("quantidade inválida")
	}
	if count > 50 {
		return nil, fmt.Errorf("máximo 50 páginas por vez")
	}
	doc := fpdf.New("P", "mm", "A4", "")
	for i := 0; i < count; i++ {
		doc.AddPage()
	}
	tmp, err := output.TempDir()
	if err != nil {
		return nil, err
	}
	defer os.RemoveAll(tmp)
	blank := filepath.Join(tmp, "blank.pdf")
	if err := doc.OutputFileAndClose(blank); err != nil {
		return nil, err
	}
	if err := api.MergeCreateFile([]string{pdfPath, blank}, dest, false, nil); err != nil {
		return nil, fmt.Errorf("anexar páginas: %w", err)
	}
	return []string{dest}, nil
}

// garante uso de tool (mantém import do contrato)
var _ = tool.ParamPassword

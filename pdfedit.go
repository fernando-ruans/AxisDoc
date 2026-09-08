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
	for _, r := range rots {
		if r.Angle%90 != 0 {
			return nil, fmt.Errorf("ângulo deve ser múltiplo de 90")
		}
		tmp, err := output.TempDir()
		if err != nil {
			return nil, err
		}
		inter := filepath.Join(tmp, "rot.pdf")
		sel := []string{fmt.Sprintf("%d", r.Page)}
		if err := api.RotateFile(current, inter, r.Angle%360, sel, nil); err != nil {
			os.RemoveAll(tmp)
			return nil, fmt.Errorf("girar página %d: %w", r.Page, err)
		}
		// move para o destino progressivo
		final := dest
		if r != rots[len(rots)-1] {
			tmp2, err := output.TempDir()
			if err != nil {
				os.RemoveAll(tmp)
				return nil, err
			}
			final = filepath.Join(tmp2, "rot.pdf")
			defer os.RemoveAll(tmp2)
		}
		data, err := os.ReadFile(inter)
		os.RemoveAll(tmp)
		if err != nil {
			return nil, err
		}
		if err := output.WriteFile(final, data); err != nil {
			return nil, err
		}
		current = final
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

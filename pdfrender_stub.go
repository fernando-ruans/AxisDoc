//go:build !pdfium

package main

import "fmt"

// renderPDFPage sem pdfium: rasterização de PDF exige a lib nativa do sistema
// (build com -tags pdfium + CGO + pkg-config pdfium). Sem ela, o live preview
// de tools com saída PDF fica indisponível — o resultado continua visível
// após Executar via preview de arquivo (PDF.js no FilePreview).
func renderPDFPage(path string, page int, maxWidth int) ([]byte, error) {
	return nil, fmt.Errorf("preview de PDF indisponível neste build (sem pdfium): %s", path)
}

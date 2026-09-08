// Package pdftools2 implementa a segunda leva de ferramentas de PDF (fase A).
// Usa pdfcpu v0.15 (extração, páginas, permissões, anexos, import, N-up) e
// fpdf (criação) + ledongthuc/pdf (comparação de texto).
package pdftools2

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/go-pdf/fpdf"
	"github.com/pdfcpu/pdfcpu/pkg/api"
	"github.com/sergi/go-diff/diffmatchpatch"

	"github.com/ferna/axisdoc/internal/output"
	"github.com/ferna/axisdoc/internal/tool"
	"github.com/ferna/axisdoc/internal/tool/pdftools"
)

// base compartilha metadados das ferramentas.
type base struct {
	id, cat, title, desc, icon string
}

func (b base) ID() string          { return b.id }
func (b base) Category() string    { return b.cat }
func (b base) Title() string       { return b.title }
func (b base) Description() string { return b.desc }
func (b base) Icon() string        { return b.icon }

type stepFunc struct {
	name  string
	runFn func(ctx context.Context, in tool.Input, report func(pct float64)) (tool.Output, error)
}

func (s stepFunc) Name() string { return s.name }
func (s stepFunc) Run(ctx context.Context, in tool.Input, report func(pct float64)) (tool.Output, error) {
	return s.runFn(ctx, in, report)
}

func fileStem(p string) string {
	b := filepath.Base(p)
	if i := strings.LastIndexByte(b, '.'); i > 0 {
		return b[:i]
	}
	return b
}

func outputDirParam() tool.Param {
	return tool.Param{Key: "outputDir", Label: "param.outputDir.label", Type: tool.ParamFolder}
}

func pagesParam() tool.Param {
	return tool.Param{Key: "pages", Label: "param.pdf.pages.label", Type: tool.ParamText, Default: ""}
}

// selectedPages converte "" em nil (todas) ou mantém o range pdfcpu ("1-3,5").
func selectedPages(in tool.Input) []string {
	s := strings.TrimSpace(tool.ParamString(in, "pages", ""))
	if s == "" {
		return nil
	}
	return []string{s}
}

// extractOnePageFile extrai N páginas de um PDF via CollectFile (mesma engine
// do SplitFile, que escreve direto no destino — evita digest com staged file).
func extractPagesToDir(p string, pages []string, outDir string) error {
	out := filepath.Join(outDir, fileStem(p)+"_paginas.pdf")
	return api.CollectFile(p, out, pages, nil)
}

// extractImagesToDir extrai imagens via API com Reader.
func extractImagesToDir(p string, pages []string, outDir string) error {
	f, err := os.Open(p)
	if err != nil {
		return err
	}
	defer f.Close()
	fnBase := strings.TrimSuffix(filepath.Base(p), filepath.Ext(p))
	return api.ExtractImages(f, pages, api.WriteImageToDisk(outDir, fnBase), nil)
}

// extractFontsToDir extrai fontes via API com Reader.
func extractFontsToDir(p string, pages []string, outDir string) error {
	f, err := os.Open(p)
	if err != nil {
		return err
	}
	defer f.Close()
	fnBase := strings.TrimSuffix(filepath.Base(p), filepath.Ext(p))
	return api.ExtractFonts(f, pages, api.WriteFontToDisk(outDir, fnBase), nil)
}

// extractMetadataToFile extrai metadados via API com Reader.
func extractMetadataToFile(p string, outDir string) error {
	f, err := os.Open(p)
	if err != nil {
		return err
	}
	defer f.Close()
	fnBase := strings.TrimSuffix(filepath.Base(p), filepath.Ext(p))
	return api.ExtractMetadata(f, api.WriteMetadataToDisk(outDir, fnBase), nil)
}

// extractAttachmentsToDir extrai anexos sem staging quebrado:
// usa ExtractAttachments (File, que escreve via CopyFile dentro do pdfcpu)
// em workdir limpa, pois o input do teste vive no MESMO dir do destino final
// e o copyOut copia do work para o destino — nunca lê o destino como input.
func extractAttachmentsToDir(p string, outDir string) error {
	f, err := os.Open(p)
	if err != nil {
		return err
	}
	defer f.Close()
	return api.ExtractAttachments(f, outDir, nil, nil)
}

// collectFiles lista arquivos finais sob dir, excluindo extensões de entrada
// (algumas APIs File do pdfcpu copiam o input .pdf para o outDir durante o processo).
func collectFiles(dir string, excludeExts ...string) ([]string, error) {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return nil, err
	}
	excluded := map[string]bool{".tmp": true}
	for _, e := range excludeExts {
		excluded[strings.ToLower(e)] = true
	}
	var outs []string
	for _, e := range entries {
		if e.IsDir() {
			continue
		}
		if strings.Contains(e.Name(), ".tmp-") {
			continue
		}
		if excluded[strings.ToLower(filepath.Ext(e.Name()))] {
			continue
		}
		full := filepath.Join(dir, e.Name())
		if st, err := os.Stat(full); err != nil || st.IsDir() {
			continue
		}
		outs = append(outs, full)
	}
	return outs, nil
}

// copyOut copia os extraídos para a pasta de destino com nomes únicos.
func copyOut(files []string, in tool.Input) ([]string, error) {
	var outs []string
	for _, f := range files {
		name := strings.TrimSuffix(filepath.Base(f), filepath.Ext(f))
		dest := output.NextAvailablePath(filepath.Join(tool.OutputDir(in), name+filepath.Ext(f)))
		if err := output.CopyFile(f, dest); err != nil {
			return nil, err
		}
		outs = append(outs, dest)
	}
	return outs, nil
}

// ---- 1. Extrair imagens ----

type ExtractImages struct{ base }

func NewExtractImages() *ExtractImages {
	return &ExtractImages{base{"pdf.extractimages", "pdf", "tool.pdfextractimages.title", "tool.pdfextractimages.desc", "image"}}
}

func (t *ExtractImages) Params() []tool.Param { return []tool.Param{pagesParam(), outputDirParam()} }

func (t *ExtractImages) Steps() []tool.Step {
	return []tool.Step{stepFunc{"step.pdf.extractimages", t.run}}
}

func (t *ExtractImages) run(_ context.Context, in tool.Input, report func(pct float64)) (tool.Output, error) {
	if len(in.Paths) == 0 {
		return tool.Output{}, fmt.Errorf("pdf.extractimages: nenhum arquivo")
	}
	var outs []string
	for _, p := range in.Paths {
		work, err := output.TempDir()
		if err != nil {
			return tool.Output{}, err
		}
		if err := extractImagesToDir(p, selectedPages(in), work); err != nil {
			os.RemoveAll(work)
			return tool.Output{}, fmt.Errorf("pdf.extractimages: %w", err)
		}
		files, err := collectFiles(work)
		os.RemoveAll(work)
		if err != nil {
			return tool.Output{}, err
		}
		moved, err := copyOut(files, in)
		if err != nil {
			return tool.Output{}, err
		}
		outs = append(outs, moved...)
	}
	return tool.Output{Paths: outs, Message: fmt.Sprintf("%d imagem(ns) extraída(s)", len(outs))}, nil
}

// ---- 2. Extrair páginas ----

type ExtractPages struct{ base }

func NewExtractPages() *ExtractPages {
	return &ExtractPages{base{"pdf.extractpages", "pdf", "tool.pdfextractpages.title", "tool.pdfextractpages.desc", "file-output"}}
}

func (t *ExtractPages) Params() []tool.Param {
	return []tool.Param{
		{Key: "pages", Label: "param.pdf.pages.label", Type: tool.ParamText, Required: true, Default: ""},
		outputDirParam(),
	}
}

func (t *ExtractPages) Steps() []tool.Step {
	return []tool.Step{stepFunc{"step.pdf.extractpages", t.run}}
}

func (t *ExtractPages) run(_ context.Context, in tool.Input, report func(pct float64)) (tool.Output, error) {
	if len(in.Paths) == 0 {
		return tool.Output{}, fmt.Errorf("pdf.extractpages: nenhum arquivo")
	}
	pages := selectedPages(in)
	if pages == nil {
		return tool.Output{}, fmt.Errorf("pdf.extractpages: informe as páginas (ex.: 1-3,5)")
	}
	var outs []string
	for _, p := range in.Paths {
		work, err := output.TempDir()
		if err != nil {
			return tool.Output{}, err
		}
		dest := filepath.Join(work, fileStem(p)+"_paginas.pdf")
		if err := api.CollectFile(p, dest, pages, nil); err != nil {
			os.RemoveAll(work)
			return tool.Output{}, fmt.Errorf("pdf.extractpages: %w", err)
		}
		moved, err := copyOut([]string{dest}, in)
		os.RemoveAll(work)
		if err != nil {
			return tool.Output{}, err
		}
		outs = append(outs, moved...)
	}
	return tool.Output{Paths: outs, Message: fmt.Sprintf("%d página(s) extraída(s)", len(outs))}, nil
}

// ---- 3. Remover páginas ----

type RemovePages struct{ base }

func NewRemovePages() *RemovePages {
	return &RemovePages{base{"pdf.removepages", "pdf", "tool.pdfremovepages.title", "tool.pdfremovepages.desc", "file-x"}}
}

func (t *RemovePages) Params() []tool.Param {
	return []tool.Param{
		{Key: "pages", Label: "param.pdf.pages.label", Type: tool.ParamText, Required: true, Default: ""},
		outputDirParam(),
	}
}

func (t *RemovePages) Steps() []tool.Step {
	return []tool.Step{stepFunc{"step.pdf.removepages", t.run}}
}

func (t *RemovePages) run(_ context.Context, in tool.Input, _ func(pct float64)) (tool.Output, error) {
	if len(in.Paths) == 0 {
		return tool.Output{}, fmt.Errorf("pdf.removepages: nenhum arquivo")
	}
	pages := selectedPages(in)
	if pages == nil {
		return tool.Output{}, fmt.Errorf("pdf.removepages: informe as páginas (ex.: 1-3,5)")
	}
	var outs []string
	for _, p := range in.Paths {
		dest := output.NextAvailablePath(filepath.Join(tool.OutputDir(in), fmt.Sprintf("%s_sem%s.pdf", fileStem(p), strings.ReplaceAll(pages[0], ",", "-"))))
		if err := api.RemovePagesFile(p, dest, pages, nil); err != nil {
			return tool.Output{}, fmt.Errorf("pdf.removepages: %w", err)
		}
		outs = append(outs, dest)
	}
	return tool.Output{Paths: outs, Message: fmt.Sprintf("páginas removidas em %d arquivo(s)", len(outs))}, nil
}

// ---- 4. Extrair fontes ----

type ExtractFonts struct{ base }

func NewExtractFonts() *ExtractFonts {
	return &ExtractFonts{base{"pdf.extractfonts", "pdf", "tool.pdfextractfonts.title", "tool.pdfextractfonts.desc", "type"}}
}

func (t *ExtractFonts) Params() []tool.Param { return []tool.Param{pagesParam(), outputDirParam()} }

func (t *ExtractFonts) Steps() []tool.Step {
	return []tool.Step{stepFunc{"step.pdf.extractfonts", t.run}}
}

func (t *ExtractFonts) run(_ context.Context, in tool.Input, _ func(pct float64)) (tool.Output, error) {
	if len(in.Paths) == 0 {
		return tool.Output{}, fmt.Errorf("pdf.extractfonts: nenhum arquivo")
	}
	var outs []string
	for _, p := range in.Paths {
		work, err := output.TempDir()
		if err != nil {
			return tool.Output{}, err
		}
		if err := extractFontsToDir(p, selectedPages(in), work); err != nil {
			os.RemoveAll(work)
			return tool.Output{}, fmt.Errorf("pdf.extractfonts: %w", err)
		}
		files, err := collectFiles(work)
		os.RemoveAll(work)
		if err != nil {
			return tool.Output{}, err
		}
		moved, err := copyOut(files, in)
		if err != nil {
			return tool.Output{}, err
		}
		outs = append(outs, moved...)
	}
	return tool.Output{Paths: outs, Message: fmt.Sprintf("%d fonte(s) extraída(s)", len(outs))}, nil
}

// ---- 5. Extrair anexos ----

type ExtractAttachments struct{ base }

func NewExtractAttachments() *ExtractAttachments {
	return &ExtractAttachments{base{"pdf.extractattachments", "pdf", "tool.pdfextractattachments.title", "tool.pdfextractattachments.desc", "paperclip"}}
}

func (t *ExtractAttachments) Params() []tool.Param { return []tool.Param{outputDirParam()} }

func (t *ExtractAttachments) Steps() []tool.Step {
	return []tool.Step{stepFunc{"step.pdf.extractattachments", t.run}}
}

func (t *ExtractAttachments) run(_ context.Context, in tool.Input, _ func(pct float64)) (tool.Output, error) {
	if len(in.Paths) == 0 {
		return tool.Output{}, fmt.Errorf("pdf.extractattachments: nenhum arquivo")
	}
	var outs []string
	for _, p := range in.Paths {
		work, err := output.TempDir()
		if err != nil {
			return tool.Output{}, err
		}
		if err := extractAttachmentsToDir(p, work); err != nil {
			os.RemoveAll(work)
			// sem anexos não é erro: pdfcpu retorna erro de "no attachments"
			if strings.Contains(err.Error(), "no attachments") || strings.Contains(err.Error(), "no EmbeddedFiles") {
				continue
			}
			return tool.Output{}, fmt.Errorf("pdf.extractattachments: %w", err)
		}
		// o workdir é limpo APÓS o copyOut porque o pdfcpu copia o input PDF
		// para o outDir (reserva de saída) junto dos anexos extraídos
		files, err := collectFiles(work, ".pdf")
		if err != nil {
			os.RemoveAll(work)
			return tool.Output{}, err
		}
		moved, err := copyOut(files, in)
		os.RemoveAll(work)
		if err != nil {
			return tool.Output{}, err
		}
		outs = append(outs, moved...)
	}
	if len(outs) == 0 {
		return tool.Output{Message: "nenhum anexo encontrado"}, nil
	}
	return tool.Output{Paths: outs, Message: fmt.Sprintf("%d anexo(s) extraído(s)", len(outs))}, nil
}

// ---- 6. Extrair metadados ----

type ExtractMetadata struct{ base }

func NewExtractMetadata() *ExtractMetadata {
	return &ExtractMetadata{base{"pdf.extractmetadata", "pdf", "tool.pdfextractmetadata.title", "tool.pdfextractmetadata.desc", "info"}}
}

func (t *ExtractMetadata) Params() []tool.Param { return nil }

func (t *ExtractMetadata) Steps() []tool.Step {
	return []tool.Step{stepFunc{"step.pdf.extractmetadata", t.run}}
}

func (t *ExtractMetadata) run(_ context.Context, in tool.Input, _ func(pct float64)) (tool.Output, error) {
	if len(in.Paths) == 0 {
		return tool.Output{}, fmt.Errorf("pdf.extractmetadata: nenhum arquivo")
	}
	var sb strings.Builder
	for _, p := range in.Paths {
		work, err := output.TempDir()
		if err != nil {
			return tool.Output{}, err
		}
		if err := extractMetadataToFile(p, work); err != nil {
			os.RemoveAll(work)
			fmt.Fprintf(&sb, "ERRO %s: %v\n", filepath.Base(p), err)
			continue
		}
		files, err := collectFiles(work)
		if err != nil || len(files) == 0 {
			os.RemoveAll(work)
			fmt.Fprintf(&sb, "ERRO %s: sem metadados\n", filepath.Base(p))
			continue
		}
		data, err := os.ReadFile(files[0])
		os.RemoveAll(work)
		if err != nil {
			fmt.Fprintf(&sb, "ERRO %s: %v\n", filepath.Base(p), err)
			continue
		}
		fmt.Fprintf(&sb, "=== %s ===\n%s\n", filepath.Base(p), strings.TrimSpace(string(data)))
	}
	return tool.Output{Message: strings.TrimRight(sb.String(), "\n")}, nil
}

// ---- 7. Permissões (somente leitura/listagem; alterar exige PDF criptografado) ----

type Permissions struct{ base }

func NewPermissions() *Permissions {
	return &Permissions{base{"pdf.permissions", "pdf", "tool.pdfpermissions.title", "tool.pdfpermissions.desc", "lock"}}
}

func (t *Permissions) Params() []tool.Param { return nil }

func (t *Permissions) Steps() []tool.Step {
	return []tool.Step{stepFunc{"step.pdf.permissions", t.run}}
}

func (t *Permissions) run(_ context.Context, in tool.Input, _ func(pct float64)) (tool.Output, error) {
	if len(in.Paths) == 0 {
		return tool.Output{}, fmt.Errorf("pdf.permissions: nenhum arquivo")
	}
	var sb strings.Builder
	for _, p := range in.Paths {
		f, err := os.Open(p)
		if err != nil {
			fmt.Fprintf(&sb, "ERRO %s: %v\n", filepath.Base(p), err)
			continue
		}
		list, err := api.PermissionsList(f, nil)
		f.Close()
		if err != nil {
			fmt.Fprintf(&sb, "ERRO %s: %v\n", filepath.Base(p), err)
			continue
		}
		if len(list) == 0 {
			fmt.Fprintf(&sb, "%s: sem restrições\n", filepath.Base(p))
			continue
		}
		fmt.Fprintf(&sb, "%s:\n  %s\n", filepath.Base(p), strings.Join(list, "\n  "))
	}
	return tool.Output{Message: strings.TrimRight(sb.String(), "\n")}, nil
}

// ---- 8. Comparar PDFs ----

type ComparePDFs struct{ base }

func NewComparePDFs() *ComparePDFs {
	return &ComparePDFs{base{"pdf.diff", "pdf", "tool.pdfdiff.title", "tool.pdfdiff.desc", "git-compare"}}
}

func (t *ComparePDFs) Params() []tool.Param { return nil }

func (t *ComparePDFs) Steps() []tool.Step {
	return []tool.Step{stepFunc{"step.pdf.diff", t.run}}
}

func (t *ComparePDFs) run(_ context.Context, in tool.Input, _ func(pct float64)) (tool.Output, error) {
	if len(in.Paths) != 2 {
		return tool.Output{}, fmt.Errorf("pdf.diff: selecione exatamente 2 PDFs")
	}
	a, err := pdftools.ExtractTextFile(in.Paths[0])
	if err != nil {
		return tool.Output{}, fmt.Errorf("pdf.diff: %w", err)
	}
	b, err := pdftools.ExtractTextFile(in.Paths[1])
	if err != nil {
		return tool.Output{}, fmt.Errorf("pdf.diff: %w", err)
	}
	dmp := diffmatchpatch.New()
	c1, c2, lines := dmp.DiffLinesToChars(a, b)
	diffs := dmp.DiffMain(c1, c2, false)
	diffs = dmp.DiffCharsToLines(diffs, lines)
	var sb strings.Builder
	ins, del := 0, 0
	for _, d := range diffs {
		switch d.Type {
		case diffmatchpatch.DiffInsert:
			ins++
			fmt.Fprintf(&sb, "+ %s", truncateLines(d.Text, 5))
		case diffmatchpatch.DiffDelete:
			del++
			fmt.Fprintf(&sb, "- %s", truncateLines(d.Text, 5))
		}
	}
	if ins == 0 && del == 0 {
		return tool.Output{Message: "PDFs com o mesmo texto"}, nil
	}
	return tool.Output{Message: fmt.Sprintf("%s vs %s: +%d/-%d blocos\n%s",
		filepath.Base(in.Paths[0]), filepath.Base(in.Paths[1]), ins, del, sb.String())}, nil
}

func truncateLines(text string, max int) string {
	lines := strings.Split(strings.TrimRight(text, "\n"), "\n")
	if len(lines) > max {
		lines = append(lines[:max], fmt.Sprintf("... (+%d linhas)", len(lines)-max))
	}
	var sb strings.Builder
	for _, l := range lines {
		if len(l) > 100 {
			l = l[:100] + "…"
		}
		sb.WriteString(l + "\n")
	}
	return sb.String()
}

// ---- 9. Adicionar anexos ----

type AddAttachments struct{ base }

func NewAddAttachments() *AddAttachments {
	return &AddAttachments{base{"pdf.addattachments", "pdf", "tool.pdfaddattachments.title", "tool.pdfaddattachments.desc", "paperclip"}}
}

func (t *AddAttachments) Params() []tool.Param {
	return []tool.Param{
		{Key: "files", Label: "param.pdf.attachfiles.label", Type: tool.ParamText, Required: true, Default: ""},
		outputDirParam(),
	}
}

func (t *AddAttachments) Steps() []tool.Step {
	return []tool.Step{stepFunc{"step.pdf.addattachments", t.run}}
}

func (t *AddAttachments) run(_ context.Context, in tool.Input, _ func(pct float64)) (tool.Output, error) {
	if len(in.Paths) == 0 {
		return tool.Output{}, fmt.Errorf("pdf.addattachments: nenhum PDF")
	}
	filesRaw := tool.ParamString(in, "files", "")
	var files []string
	for _, f := range strings.Split(filesRaw, "\n") {
		f = strings.TrimSpace(f)
		if f != "" {
			files = append(files, f)
		}
	}
	// arquivos anexados também podem vir da seleção (não-PDFs)
	for _, p := range in.Paths[1:] {
		if !strings.EqualFold(filepath.Ext(p), ".pdf") {
			files = append(files, p)
		}
	}
	if len(files) == 0 {
		return tool.Output{}, fmt.Errorf("pdf.addattachments: informe os arquivos a anexar (um por linha)")
	}
	var outs []string
	for _, p := range in.Paths {
		if !strings.EqualFold(filepath.Ext(p), ".pdf") {
			continue
		}
		dest := output.NextAvailablePath(filepath.Join(tool.OutputDir(in), fmt.Sprintf("%s_anexos.pdf", fileStem(p))))
		if err := api.AddAttachmentsFile(p, dest, files, false, nil); err != nil {
			return tool.Output{}, fmt.Errorf("pdf.addattachments: %w", err)
		}
		outs = append(outs, dest)
	}
	if len(outs) == 0 {
		return tool.Output{}, fmt.Errorf("pdf.addattachments: nenhum PDF selecionado")
	}
	return tool.Output{Paths: outs, Message: fmt.Sprintf("%d anexo(s) em %d PDF(s)", len(files), len(outs))}, nil
}

// ---- 10. Imagens → PDF ----

type ImagesToPDF struct{ base }

func NewImagesToPDF() *ImagesToPDF {
	return &ImagesToPDF{base{"pdf.fromimages", "pdf", "tool.pdffromimages.title", "tool.pdffromimages.desc", "images"}}
}

func (t *ImagesToPDF) Params() []tool.Param {
	return []tool.Param{
		{Key: "outputPath", Label: "param.outputPath.label", Type: tool.ParamOutput, Default: "imagens.pdf"},
		{Key: "outputDir", Label: "param.outputDir.label", Type: tool.ParamFolder},
	}
}

func (t *ImagesToPDF) Steps() []tool.Step {
	return []tool.Step{stepFunc{"step.pdf.fromimages", t.run}}
}

func (t *ImagesToPDF) run(_ context.Context, in tool.Input, _ func(pct float64)) (tool.Output, error) {
	if len(in.Paths) == 0 {
		return tool.Output{}, fmt.Errorf("pdf.fromimages: nenhuma imagem")
	}
	dest := tool.ParamString(in, "outputPath", "")
	if dest == "" {
		dest = filepath.Join(tool.OutputDir(in), "imagens.pdf")
	}
	dest = output.NextAvailablePath(dest)
	if err := api.ImportImagesFile(in.Paths, dest, nil, nil); err != nil {
		return tool.Output{}, fmt.Errorf("pdf.fromimages: %w", err)
	}
	return tool.Output{Paths: []string{dest}, Message: fmt.Sprintf("%d imagem(ns) em %s", len(in.Paths), filepath.Base(dest))}, nil
}

// ---- 11. Criar PDF ----

type CreatePDF struct{ base }

func NewCreatePDF() *CreatePDF {
	return &CreatePDF{base{"pdf.create", "pdf", "tool.pdfcreate.title", "tool.pdfcreate.desc", "file-plus"}}
}

func (t *CreatePDF) Params() []tool.Param {
	return []tool.Param{
		{Key: "title", Label: "param.pdf.doctitle.label", Type: tool.ParamText, Required: true, Default: ""},
		{Key: "body", Label: "param.pdf.docbody.label", Type: tool.ParamText, Required: true, Default: ""},
		{Key: "pages", Label: "param.pdf.blankpages.label", Type: tool.ParamNumber, Default: 0, Min: 0, Max: 50},
		{Key: "outputPath", Label: "param.outputPath.label", Type: tool.ParamOutput, Default: "novo.pdf"},
	}
}

func (t *CreatePDF) Steps() []tool.Step {
	return []tool.Step{stepFunc{"step.pdf.create", t.run}}
}

func (t *CreatePDF) run(_ context.Context, in tool.Input, _ func(pct float64)) (tool.Output, error) {
	title := tool.ParamString(in, "title", "")
	body := tool.ParamString(in, "body", "")
	blank := int(tool.ParamFloat(in, "pages", 0))
	if title == "" && body == "" && blank == 0 {
		return tool.Output{}, fmt.Errorf("pdf.create: informe título/texto ou páginas em branco")
	}
	dest := tool.ParamString(in, "outputPath", "")
	if dest == "" {
		dest = filepath.Join(tool.OutputDir(in), "novo.pdf")
	}
	dest = output.NextAvailablePath(dest)

	doc := fpdf.New("P", "mm", "A4", "")
	doc.SetAutoPageBreak(true, 20)
	footer := func() {
		doc.SetY(-15)
		doc.SetFont("Helvetica", "I", 8)
		doc.CellFormat(0, 10, fmt.Sprintf("Página %d", doc.PageNo()), "", 0, "C", false, 0, "")
	}
	doc.SetFooterFunc(footer)
	if title != "" || body != "" {
		doc.AddPage()
		if title != "" {
			doc.SetFont("Helvetica", "B", 20)
			doc.MultiCell(0, 10, title, "", "L", false)
			doc.Ln(4)
		}
		if body != "" {
			doc.SetFont("Helvetica", "", 12)
			for _, para := range strings.Split(body, "\n\n") {
				doc.MultiCell(0, 6, strings.TrimSpace(para), "", "L", false)
				doc.Ln(3)
			}
		}
	}
	for i := 0; i < blank; i++ {
		doc.AddPage()
	}
	if err := doc.OutputFileAndClose(dest); err != nil {
		return tool.Output{}, fmt.Errorf("pdf.create: %w", err)
	}
	return tool.Output{Paths: []string{dest}, Message: "PDF criado: " + filepath.Base(dest)}, nil
}

// ---- 12. N-up ----

type NUp struct{ base }

func NewNUp() *NUp {
	return &NUp{base{"pdf.nup", "pdf", "tool.pdfnup.title", "tool.pdfnup.desc", "layout-grid"}}
}

func (t *NUp) Params() []tool.Param {
	return []tool.Param{
		{Key: "n", Label: "param.pdf.nup.label", Type: tool.ParamSelect,
			Options: []string{"2", "4", "8"}, Default: "2"},
		outputDirParam(),
	}
}

func (t *NUp) Steps() []tool.Step {
	return []tool.Step{stepFunc{"step.pdf.nup", t.run}}
}

func (t *NUp) run(_ context.Context, in tool.Input, _ func(pct float64)) (tool.Output, error) {
	if len(in.Paths) == 0 {
		return tool.Output{}, fmt.Errorf("pdf.nup: nenhum arquivo")
	}
	n := int(tool.ParamFloat(in, "n", 2))
	var outs []string
	for _, p := range in.Paths {
		dest := output.NextAvailablePath(filepath.Join(tool.OutputDir(in), fmt.Sprintf("%s_%dup.pdf", fileStem(p), n)))
		nup, err := api.PDFNUpConfig(n, "", nil)
		if err != nil {
			return tool.Output{}, fmt.Errorf("pdf.nup: %w", err)
		}
		if err := api.NUpFile([]string{p}, dest, nil, nup, nil); err != nil {
			return tool.Output{}, fmt.Errorf("pdf.nup: %w", err)
		}
		outs = append(outs, dest)
	}
	return tool.Output{Paths: outs, Message: fmt.Sprintf("N-up %d aplicado em %d arquivo(s)", n, len(outs))}, nil
}

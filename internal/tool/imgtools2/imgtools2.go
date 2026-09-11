// Package imgtools2 implementa a segunda leva de ferramentas de imagem (FASE C).
// Crop, transformações, filtros, ICO, GIF, paleta e marca d'água posicional.
package imgtools2

import (
	"bytes"
	"context"
	"encoding/binary"
	"fmt"
	"image"
	"image/color"
	"image/gif"
	"image/png"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"github.com/disintegration/imaging"

	"github.com/ferna/axisdoc/internal/output"
	"github.com/ferna/axisdoc/internal/tool"
)

// base compartilha metadados.
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

func openImage(path string) (image.Image, error) {
	return imaging.Open(path, imaging.AutoOrientation(true))
}

func encodeByExt(img image.Image, dest string, quality int) error {
	f, err := os.Create(dest)
	if err != nil {
		return err
	}
	defer f.Close()
	return imaging.Encode(f, img, imagingFormatByExt(dest), imaging.JPEGQuality(quality))
}

func imagingFormatByExt(dest string) imaging.Format {
	switch strings.ToLower(filepath.Ext(dest)) {
	case ".jpg", ".jpeg":
		return imaging.JPEG
	case ".png":
		return imaging.PNG
	case ".gif":
		return imaging.GIF
	case ".bmp":
		return imaging.BMP
	case ".tiff":
		return imaging.TIFF
	default:
		return imaging.PNG
	}
}

func batch(ctx context.Context, in tool.Input, report func(pct float64), fn func(p string) (string, error)) (tool.Output, error) {
	if len(in.Paths) == 0 {
		return tool.Output{}, fmt.Errorf("img2: nenhum arquivo")
	}
	var outs []string
	var sb strings.Builder
	for i, p := range in.Paths {
		if err := ctx.Err(); err != nil {
			return tool.Output{}, err
		}
		dest, err := fn(p)
		if err != nil {
			fmt.Fprintf(&sb, "ERRO %s: %v\n", filepath.Base(p), err)
		} else {
			outs = append(outs, dest)
		}
		if report != nil {
			report(float64(i+1) / float64(len(in.Paths)) * 100)
		}
	}
	if len(outs) > 0 {
		fmt.Fprintf(&sb, "%d arquivo(s) processado(s)", len(outs))
	}
	return tool.Output{Paths: outs, Message: strings.TrimRight(sb.String(), "\n")}, nil
}

// ---- 1. Crop ----

type Crop struct{ base }

func NewCrop() *Crop {
	return &Crop{base{"img.crop", "image", "tool.imgcrop.title", "tool.imgcrop.desc", "crop"}}
}

func (t *Crop) Params() []tool.Param {
	return []tool.Param{
		{Key: "ratio", Label: "param.img.ratio.label", Type: tool.ParamSelect,
			Options: []string{"free", "1:1", "4:3", "16:9"}, Default: "free", Widget: tool.WidgetSegmented,
			Hint: "param.img.ratio.hint"},
		{Key: "x", Label: "param.img.x.label", Type: tool.ParamNumber, Default: 0, Min: 0,
			Hint: "param.img.coords.hint"},
		{Key: "y", Label: "param.img.y.label", Type: tool.ParamNumber, Default: 0, Min: 0},
		{Key: "w", Label: "param.img.width.label", Type: tool.ParamNumber, Default: 100, Min: 1},
		{Key: "h", Label: "param.img.height.label", Type: tool.ParamNumber, Default: 100, Min: 1},
	}
}

func (t *Crop) Steps() []tool.Step {
	return []tool.Step{stepFunc{"step.img2.crop", t.run}}
}

func anchorFrom(s string) imaging.Anchor {
	switch s {
	case "center":
		return imaging.Center
	case "topRight":
		return imaging.TopRight
	case "bottomLeft":
		return imaging.BottomLeft
	case "bottomRight":
		return imaging.BottomRight
	default:
		return imaging.TopLeft
	}
}

func (t *Crop) run(ctx context.Context, in tool.Input, report func(pct float64)) (tool.Output, error) {
	w := int(tool.ParamFloat(in, "w", 100))
	h := int(tool.ParamFloat(in, "h", 100))
	ratio := tool.ParamString(in, "ratio", "free")
	return batch(ctx, in, report, func(p string) (string, error) {
		img, err := openImage(p)
		if err != nil {
			return "", err
		}
		x := int(tool.ParamFloat(in, "x", 0))
		y := int(tool.ParamFloat(in, "y", 0))
		b := img.Bounds()
		if x > b.Dx() || y > b.Dy() {
			return "", fmt.Errorf("coordenada fora da imagem")
		}
		if ratio != "free" {
			// proporção trava h a partir de w
			var rw, rh float64 = 1, 1
			fmt.Sscanf(ratio, "%g:%g", &rw, &rh)
			if rw > 0 && rh > 0 {
				h = int(float64(w) * rh / rw)
			}
		}
		rect := image.Rect(b.Min.X+x, b.Min.Y+y, b.Min.X+x+w, b.Min.Y+y+h)
		rect = b.Intersect(rect)
		if rect.Dx() <= 0 || rect.Dy() <= 0 {
			return "", fmt.Errorf("área de recorte vazia")
		}
		cropped := imaging.Crop(img, rect)
		dest := output.NextAvailablePath(filepath.Join(tool.OutputDir(in), fmt.Sprintf("%s_crop%s", fileStem(p), filepath.Ext(p))))
		if err := encodeByExt(cropped, dest, 90); err != nil {
			return "", err
		}
		return dest, nil
	})
}

// ---- 2. Transform (rotate/flip) ----

type Transform struct{ base }

func NewTransform() *Transform {
	return &Transform{base{"img.transform", "image", "tool.imgtransform.title", "tool.imgtransform.desc", "flip-horizontal"}}
}

func (t *Transform) Params() []tool.Param {
	return []tool.Param{
		{Key: "op", Label: "param.img.transform.label", Type: tool.ParamSelect,
			Options: []string{"rotate90", "rotate180", "rotate270", "flipH", "flipV"}, Default: "rotate90",
			Widget: tool.WidgetCards},
	}
}

func (t *Transform) Steps() []tool.Step {
	return []tool.Step{stepFunc{"step.img2.transform", t.run}}
}

func (t *Transform) run(ctx context.Context, in tool.Input, report func(pct float64)) (tool.Output, error) {
	op := tool.ParamString(in, "op", "rotate90")
	return batch(ctx, in, report, func(p string) (string, error) {
		img, err := openImage(p)
		if err != nil {
			return "", err
		}
		var out image.Image
		suffix := ""
		switch op {
		case "rotate180":
			out = imaging.Rotate180(img)
			suffix = "_rot180"
		case "rotate270":
			out = imaging.Rotate270(img)
			suffix = "_rot270"
		case "flipH":
			out = imaging.FlipH(img)
			suffix = "_flipH"
		case "flipV":
			out = imaging.FlipV(img)
			suffix = "_flipV"
		default:
			out = imaging.Rotate90(img)
			suffix = "_rot90"
		}
		dest := output.NextAvailablePath(filepath.Join(tool.OutputDir(in), fileStem(p)+suffix+filepath.Ext(p)))
		if err := encodeByExt(out, dest, 90); err != nil {
			return "", err
		}
		return dest, nil
	})
}

// ---- 3. Filtros ----

type Filters struct{ base }

func NewFilters() *Filters {
	return &Filters{base{"img.filters", "image", "tool.imgfilters.title", "tool.imgfilters.desc", "wand"}}
}

func (t *Filters) Params() []tool.Param {
	return []tool.Param{
		{Key: "filter", Label: "param.img.filter.label", Type: tool.ParamSelect,
			Options: []string{"grayscale", "invert", "blur", "sharpen", "sepia", "contrast", "brightness"},
			Default: "grayscale", Widget: tool.WidgetCards},
		{Key: "strength", Label: "param.img.strength.label", Type: tool.ParamNumber, Default: 5, Min: 0, Max: 10,
			Widget: tool.WidgetSlider, Hint: "param.img.strength.hint"},
	}
}

func (t *Filters) Steps() []tool.Step {
	return []tool.Step{stepFunc{"step.img2.filters", t.run}}
}

func sepia(img image.Image) image.Image {
	b := img.Bounds()
	dst := imaging.Clone(img)
	for y := b.Min.Y; y < b.Max.Y; y++ {
		for x := b.Min.X; x < b.Max.X; x++ {
			r32, g32, b32, a32 := img.At(x, y).RGBA()
			r := float64(r32 >> 8)
			g := float64(g32 >> 8)
			bl := float64(b32 >> 8)
			nr := 0.393*r + 0.769*g + 0.189*bl
			ng := 0.349*r + 0.686*g + 0.168*bl
			nb := 0.272*r + 0.534*g + 0.131*bl
			dst.Set(x, y, color.NRGBA{
				R: clampByte(nr), G: clampByte(ng), B: clampByte(nb), A: uint8(a32 >> 8),
			})
		}
	}
	return dst
}

func clampByte(v float64) uint8 {
	if v > 255 {
		return 255
	}
	if v < 0 {
		return 0
	}
	return uint8(v)
}

func (t *Filters) run(ctx context.Context, in tool.Input, report func(pct float64)) (tool.Output, error) {
	filter := tool.ParamString(in, "filter", "grayscale")
	strength := tool.ParamFloat(in, "strength", 5)
	return batch(ctx, in, report, func(p string) (string, error) {
		img, err := openImage(p)
		if err != nil {
			return "", err
		}
		var out image.Image
		suffix := filter
		switch filter {
		case "invert":
			out = imaging.Invert(img)
		case "blur":
			out = imaging.Blur(img, strength/5)
		case "sharpen":
			out = imaging.Sharpen(img, strength)
		case "contrast":
			out = imaging.AdjustContrast(img, (strength-5)*10)
		case "brightness":
			out = imaging.AdjustBrightness(img, (strength-5)*10)
		case "sepia":
			out = sepia(img)
		default:
			out = imaging.Grayscale(img)
		}
		dest := output.NextAvailablePath(filepath.Join(tool.OutputDir(in), fmt.Sprintf("%s_%s%s", fileStem(p), suffix, filepath.Ext(p))))
		if err := encodeByExt(out, dest, 90); err != nil {
			return "", err
		}
		return dest, nil
	})
}

// ---- 4. ICO generator ----

type IconGen struct{ base }

func NewIconGen() *IconGen {
	return &IconGen{base{"img.icon", "image", "tool.imgicon.title", "tool.imgicon.desc", "shapes"}}
}

func (t *IconGen) Params() []tool.Param {
	return []tool.Param{
		{Key: "outputPath", Label: "param.outputPath.label", Type: tool.ParamOutput, Default: "icon.ico"},
	}
}

func (t *IconGen) Steps() []tool.Step {
	return []tool.Step{stepFunc{"step.img2.icon", t.run}}
}

func (t *IconGen) run(_ context.Context, in tool.Input, _ func(pct float64)) (tool.Output, error) {
	if len(in.Paths) == 0 {
		return tool.Output{}, fmt.Errorf("img.icon: nenhuma imagem")
	}
	src, err := openImage(in.Paths[0])
	if err != nil {
		return tool.Output{}, fmt.Errorf("img.icon: %w", err)
	}
	dest := tool.ParamString(in, "outputPath", "")
	if dest == "" {
		dest = fileStem(in.Paths[0]) + ".ico"
	}
	if filepath.Dir(dest) == "." {
		dest = filepath.Join(tool.OutputDir(in), dest)
	}
	dest = output.NextAvailablePath(dest)
	if err := writeICO(dest, src); err != nil {
		return tool.Output{}, fmt.Errorf("img.icon: %w", err)
	}
	return tool.Output{Paths: []string{dest}, Message: "ICO gerado: " + filepath.Base(dest)}, nil
}

type icoDirEntry struct {
	Width  uint8
	Height uint8
	_      uint8
	_      uint16
	Planes uint16
	BitCnt uint16
	Size   uint32
	Offset uint32
}

func writeICO(path string, src image.Image) error {
	sizes := []int{16, 24, 32, 48, 64, 128, 256}
	blobs := make([][]byte, 0, len(sizes))
	for _, s := range sizes {
		r := imaging.Resize(src, s, s, imaging.Lanczos)
		var buf bytes.Buffer
		if err := png.Encode(&buf, r); err != nil {
			return err
		}
		blobs = append(blobs, buf.Bytes())
	}
	f, err := os.Create(path)
	if err != nil {
		return err
	}
	defer f.Close()
	if err := binary.Write(f, binary.LittleEndian, uint16(0)); err != nil {
		return err
	}
	if err := binary.Write(f, binary.LittleEndian, uint16(1)); err != nil {
		return err
	}
	if err := binary.Write(f, binary.LittleEndian, uint16(len(blobs))); err != nil {
		return err
	}
	offset := uint32(6 + 16*len(blobs))
	for i, b := range blobs {
		s := sizes[i]
		w := uint8(s)
		if s >= 256 {
			w = 0
		}
		e := icoDirEntry{Width: w, Height: w, Planes: 1, BitCnt: 32, Size: uint32(len(b)), Offset: offset}
		if err := binary.Write(f, binary.LittleEndian, e); err != nil {
			return err
		}
		offset += uint32(len(b))
	}
	for _, b := range blobs {
		if _, err := f.Write(b); err != nil {
			return err
		}
	}
	return nil
}

// ---- 5. GIF: extrair frames ----

type GIFExtract struct{ base }

func NewGIFExtract() *GIFExtract {
	return &GIFExtract{base{"img.gifextract", "image", "tool.gifextract.title", "tool.gifextract.desc", "film"}}
}

func (t *GIFExtract) Params() []tool.Param {
	return []tool.Param{outputDirParam()}
}

func (t *GIFExtract) Steps() []tool.Step {
	return []tool.Step{stepFunc{"step.img2.gifextract", t.run}}
}

func (t *GIFExtract) run(_ context.Context, in tool.Input, report func(pct float64)) (tool.Output, error) {
	if len(in.Paths) == 0 {
		return tool.Output{}, fmt.Errorf("img.gifextract: nenhum arquivo")
	}
	var outs []string
	for i, p := range in.Paths {
		if !strings.EqualFold(filepath.Ext(p), ".gif") {
			continue
		}
		f, err := os.Open(p)
		if err != nil {
			return tool.Output{}, fmt.Errorf("img.gifextract: %w", err)
		}
		g, err := gif.DecodeAll(f)
		f.Close()
		if err != nil {
			return tool.Output{}, fmt.Errorf("img.gifextract: %w", err)
		}
		frameDir := filepath.Join(tool.OutputDir(in), fileStem(p)+"_frames")
		if err := os.MkdirAll(frameDir, 0o755); err != nil {
			return tool.Output{}, err
		}
		for n, frame := range g.Image {
			dest := filepath.Join(frameDir, fmt.Sprintf("frame_%03d.png", n+1))
			if err := output.WriteImagePNG(dest, frame); err != nil {
				return tool.Output{}, err
			}
			outs = append(outs, dest)
		}
		if report != nil {
			report(float64(i+1) / float64(len(in.Paths)) * 100)
		}
	}
	if len(outs) == 0 {
		return tool.Output{}, fmt.Errorf("img.gifextract: nenhum GIF selecionado")
	}
	return tool.Output{Paths: outs, Message: fmt.Sprintf("%d frame(s) extraído(s)", len(outs))}, nil
}

// ---- 6. GIF: montar a partir de PNGs ----

type GIFBuild struct{ base }

func NewGIFBuild() *GIFBuild {
	return &GIFBuild{base{"img.gifbuild", "image", "tool.gifbuild.title", "tool.gifbuild.desc", "film"}}
}

func (t *GIFBuild) Params() []tool.Param {
	return []tool.Param{
		{Key: "delay", Label: "param.gif.delay.label", Type: tool.ParamNumber, Default: 100, Min: 20, Max: 5000,
			Widget: tool.WidgetSlider},
		{Key: "outputPath", Label: "param.outputPath.label", Type: tool.ParamOutput, Default: "animacao.gif"},
	}
}

func (t *GIFBuild) Steps() []tool.Step {
	return []tool.Step{stepFunc{"step.img2.gifbuild", t.run}}
}

func (t *GIFBuild) run(_ context.Context, in tool.Input, _ func(pct float64)) (tool.Output, error) {
	pngs := make([]string, 0, len(in.Paths))
	for _, p := range in.Paths {
		if strings.EqualFold(filepath.Ext(p), ".png") {
			pngs = append(pngs, p)
		}
	}
	if len(pngs) < 2 {
		return tool.Output{}, fmt.Errorf("img.gifbuild: selecione ao menos 2 PNGs (em ordem)")
	}
	delay := int(tool.ParamFloat(in, "delay", 100))
	dest := tool.ParamString(in, "outputPath", "")
	if dest == "" {
		dest = "animacao.gif"
	}
	if filepath.Dir(dest) == "." {
		dest = filepath.Join(tool.OutputDir(in), dest)
	}
	dest = output.NextAvailablePath(dest)

	first, err := openImage(pngs[0])
	if err != nil {
		return tool.Output{}, fmt.Errorf("img.gifbuild: %w", err)
	}
	w := first.Bounds().Dx()
	h := first.Bounds().Dy()
	outGif := &gif.GIF{
		LoopCount: 0,
		Delay:     make([]int, len(pngs)),
		Config: image.Config{
			Width:  w,
			Height: h,
		},
	}
	for i, p := range pngs {
		img, err := openImage(p)
		if err != nil {
			return tool.Output{}, fmt.Errorf("img.gifbuild: %w", err)
		}
		resized := imaging.Fit(img, w, h, imaging.Lanczos)
		rb := resized.Bounds()
		paletted := image.NewPaletted(image.Rect(0, 0, w, h), palette256(resized))
		for y := 0; y < h; y++ {
			for x := 0; x < w; x++ {
				if x < rb.Dx() && y < rb.Dy() {
					paletted.Set(x, y, resized.At(rb.Min.X+x, rb.Min.Y+y))
				}
			}
		}
		outGif.Image = append(outGif.Image, paletted)
		outGif.Delay[i] = delay / 10
	}
	f, err := os.Create(dest)
	if err != nil {
		return tool.Output{}, fmt.Errorf("img.gifbuild: %w", err)
	}
	defer f.Close()
	if err := gif.EncodeAll(f, outGif); err != nil {
		return tool.Output{}, fmt.Errorf("img.gifbuild: %w", err)
	}
	return tool.Output{Paths: []string{dest}, Message: fmt.Sprintf("GIF com %d quadros", len(pngs))}, nil
}

func transparentBlack() color.NRGBA { return color.NRGBA{A: 0} }

func palette256(img image.Image) color.Palette {
	return paletteFromImage(img)
}

// ---- 7. Marca d'água posicional ----
// NOTA: fundida na tool img.watermark (kind=image). Mantida aqui como alias
// legado para macros salvas antigas; delega para o mesmo comportamento.
type WatermarkPos struct{ base }

func NewWatermarkPos() *WatermarkPos {
	return &WatermarkPos{base{"img.watermarkpos", "image", "tool.imgwmpos.title", "tool.imgwmpos.desc", "stamp"}}
}

func (t *WatermarkPos) Params() []tool.Param {
	return []tool.Param{
		{Key: "image", Label: "param.img.wmimage.label", Type: tool.ParamFile, Required: true,
			Accept: []string{".png", ".jpg", ".jpeg"}},
		{Key: "position", Label: "param.img.position.label", Type: tool.ParamSelect,
			Options: []string{"topLeft", "topRight", "center", "bottomLeft", "bottomRight"},
			Default: "bottomRight", Widget: tool.WidgetSegmented},
		{Key: "scale", Label: "param.img.wmscale.label", Type: tool.ParamNumber, Default: 20, Min: 5, Max: 90,
			Widget: tool.WidgetSlider},
	}
}

func (t *WatermarkPos) Steps() []tool.Step {
	return []tool.Step{stepFunc{"step.img2.watermarkpos", t.run}}
}

func anchorForWM(s string) imaging.Anchor {
	switch s {
	case "topRight":
		return imaging.TopRight
	case "center":
		return imaging.Center
	case "bottomLeft":
		return imaging.BottomLeft
	case "bottomRight":
		return imaging.BottomRight
	default:
		return imaging.TopLeft
	}
}

func (t *WatermarkPos) run(ctx context.Context, in tool.Input, report func(pct float64)) (tool.Output, error) {
	wmPath := tool.ParamString(in, "image", "")
	if wmPath == "" {
		return tool.Output{}, fmt.Errorf("img.watermarkpos: informe a imagem de marca d'água")
	}
	wm, err := openImage(wmPath)
	if err != nil {
		return tool.Output{}, fmt.Errorf("img.watermarkpos: %w", err)
	}
	position := tool.ParamString(in, "position", "bottomRight")
	scale := tool.ParamFloat(in, "scale", 20)
	const margin = 20
	return batch(ctx, in, report, func(p string) (string, error) {
		img, err := openImage(p)
		if err != nil {
			return "", err
		}
		b := img.Bounds()
		target := int(float64(b.Dx()) * scale / 100)
		scaled := imaging.Resize(wm, target, 0, imaging.Lanczos)
		var pos image.Point
		switch anchorForWM(position) {
		case imaging.TopRight:
			pos = image.Pt(b.Dx()-scaled.Bounds().Dx()-margin, margin)
		case imaging.Center:
			pos = image.Pt((b.Dx()-scaled.Bounds().Dx())/2, (b.Dy()-scaled.Bounds().Dy())/2)
		case imaging.BottomLeft:
			pos = image.Pt(margin, b.Dy()-scaled.Bounds().Dy()-margin)
		case imaging.BottomRight:
			pos = image.Pt(b.Dx()-scaled.Bounds().Dx()-margin, b.Dy()-scaled.Bounds().Dy()-margin)
		default:
			pos = image.Pt(margin, margin)
		}
		composed := imaging.Paste(imaging.Clone(img), scaled, pos)
		dest := output.NextAvailablePath(filepath.Join(tool.OutputDir(in), fmt.Sprintf("%s_wm%s", fileStem(p), filepath.Ext(p))))
		if err := encodeByExt(composed, dest, 92); err != nil {
			return "", err
		}
		return dest, nil
	})
}

// ---- 8. Paleta de cores ----

type Palette struct{ base }

func NewPalette() *Palette {
	return &Palette{base{"img.palette", "image", "tool.imgpalette.title", "tool.imgpalette.desc", "palette"}}
}

func (t *Palette) Params() []tool.Param { return nil }

func (t *Palette) Steps() []tool.Step {
	return []tool.Step{stepFunc{"step.img2.palette", t.run}}
}

func (t *Palette) run(_ context.Context, in tool.Input, _ func(pct float64)) (tool.Output, error) {
	if len(in.Paths) == 0 {
		return tool.Output{}, fmt.Errorf("img.palette: nenhuma imagem")
	}
	img, err := openImage(in.Paths[0])
	if err != nil {
		return tool.Output{}, fmt.Errorf("img.palette: %w", err)
	}
	pal := palette256(img)
	var colors []string
	for _, c := range pal {
		r32, g32, b32, _ := c.RGBA()
		colors = append(colors, fmt.Sprintf("#%02x%02x%02x", r32>>8, g32>>8, b32>>8))
	}
	return tool.Output{Message: fmt.Sprintf("%d cores: %s", len(colors), strings.Join(colors, ", "))}, nil
}

func paletteFromImage(img image.Image) color.Palette {
	// quantização simples: bucket de 5 bits por canal, mais frequentes
	counts := map[uint32]int{}
	b := img.Bounds()
	step := 1
	if b.Dx()*b.Dy() > 200000 {
		step = 4
	}
	for y := b.Min.Y; y < b.Max.Y; y += step {
		for x := b.Min.X; x < b.Max.X; x += step {
			c := img.At(x, y)
			r, g, bl, _ := c.RGBA()
			key := uint32((r>>11)<<10 | (g>>11)<<5 | (bl >> 11))
			counts[key]++
		}
	}
	type kv struct {
		k uint32
		n int
	}
	var list []kv
	for k, n := range counts {
		list = append(list, kv{k, n})
	}
	sort.Slice(list, func(i, j int) bool { return list[i].n > list[j].n })
	pal := color.Palette{}
	for i, kvv := range list {
		if i >= 256 {
			break
		}
		r := uint8((kvv.k >> 10 & 0x1f) << 3)
		g := uint8((kvv.k >> 5 & 0x1f) << 3)
		b := uint8((kvv.k & 0x1f) << 3)
		pal = append(pal, color.RGBA{R: r | r>>5, G: g | g>>5, B: b | b>>5, A: 255})
	}
	return pal
}

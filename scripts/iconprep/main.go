// Command iconprep gera os ícones de build a partir da logo oficial.
// Uso: go run ./scripts/iconprep
// Saídas:
//   build/appicon.png            (512x512 + fundo escuro, usado pelo Wails)
//   build/windows/icon.ico       (multi-resolução 16..256, usado no exe/instalador)
//   frontend/public/logo.png     (cabeçalho do app)
package main

import (
	"fmt"
	"image"
	"image/color"
	"image/draw"
	"image/png"
	"os"
	"path/filepath"

	"github.com/disintegration/imaging"
)

const logoSrc = "logo.png"

func must(err error, ctx string) {
	if err != nil {
		fmt.Fprintf(os.Stderr, "iconprep: %s: %v\n", ctx, err)
		os.Exit(1)
	}
}

func main() {
	src, err := imaging.Open(logoSrc, imaging.AutoOrientation(true))
	must(err, "abrir logo.png")
	fmt.Printf("logo: %dx%d\n", src.Bounds().Dx(), src.Bounds().Dy())

	// 1. Cabeçalho do app: recorta o símbolo (metade superior) e redimensiona p/ 64px.
	symbol := cropSymbol(src)
	header := imaging.Resize(symbol, 64, 0, imaging.Lanczos)
	must(writePNG("frontend/public/logo.png", header), "logo do cabeçalho")
	fmt.Println("ok: frontend/public/logo.png")

	// 2. Ícone do app: símbolo centralizado sobre fundo escuro arredondado, 512x512.
	appIcon := composeAppIcon(symbol)
	must(writePNG("build/appicon.png", appIcon), "appicon.png")
	fmt.Println("ok: build/appicon.png")

	// 3. ICO multi-resolução.
	must(writeICO("build/windows/icon.ico", appIcon), "icon.ico")
	fmt.Println("ok: build/windows/icon.ico")
}

// cropSymbol recorta o "A" (parte superior da logo, acima da marca textual).
func cropSymbol(src image.Image) image.Image {
	b := src.Bounds()
	// símbolo ocupa ~0%..68% da altura (marca "axisdoc" começa ~70%)
	cut := image.Rect(b.Min.X, b.Min.Y, b.Max.X, b.Min.Y+b.Dy()*68/100)
	sub, ok := src.(interface {
		SubImage(r image.Rectangle) image.Image
	})
	if !ok {
		return src
	}
	cropped := imaging.Clone(sub.SubImage(cut))
	// adiciona respiro de 6% ao redor para não colar nas bordas
	padX := cropped.Bounds().Dx() * 6 / 100
	padY := cropped.Bounds().Dy() * 6 / 100
	return imaging.Paste(
		image.NewNRGBA(image.Rect(0, 0, cropped.Bounds().Dx()+2*padX, cropped.Bounds().Dy()+2*padY)),
		cropped, image.Pt(padX, padY),
	)
}

// composeAppIcon centraliza o símbolo em fundo escuro 512x512.
func composeAppIcon(symbol image.Image) image.Image {
	const size = 512
	bg := image.NewRGBA(image.Rect(0, 0, size, size))
	draw.Draw(bg, bg.Bounds(), &image.Uniform{C: color.RGBA{R: 0x0B, G: 0x0E, B: 0x1A, A: 0xFF}}, image.Point{}, draw.Src)
	// símbolo ocupando ~72% da largura
	target := size * 74 / 100
	s := imaging.Resize(symbol, target, 0, imaging.Lanczos)
	off := image.Pt((size-s.Bounds().Dx())/2, (size-s.Bounds().Dy())/2-8)
	draw.Draw(bg, s.Bounds().Add(off), s, image.Point{}, draw.Over)
	return bg
}

func writePNG(path string, img image.Image) error {
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}
	f, err := os.Create(path)
	if err != nil {
		return err
	}
	defer f.Close()
	return png.Encode(f, img)
}

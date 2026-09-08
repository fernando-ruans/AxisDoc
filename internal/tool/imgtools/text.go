package imgtools

import (
	"image"
	"image/color"
	"image/draw"

	"golang.org/x/image/font"
	"golang.org/x/image/font/basicfont"
	"golang.org/x/image/math/fixed"
)

// drawTextWatermark desenha texto repetido em diagonal sobre a imagem.
func drawTextWatermark(img image.Image, text string, opacity float64) image.Image {
	b := img.Bounds()
	dst := image.NewNRGBA(image.Rect(0, 0, b.Dx(), b.Dy()))
	draw.Draw(dst, dst.Bounds(), img, b.Min, draw.Src)

	textWidth := fixed.I(basicfont.Face7x13.Advance) * fixed.I(len(text))
	d := &font.Drawer{
		Dst:  dst,
		Src:  image.NewUniform(color.RGBA{R: 255, G: 255, B: 255, A: uint8(255 * opacity)}),
		Face: basicfont.Face7x13,
	}
	span := textWidth.Ceil() + 60
	for y := 0; y < b.Dy(); y += 80 {
		for x := 0; x < b.Dx(); x += span {
			d.Dot = fixed.P(x, y)
			d.DrawString(text)
		}
	}
	return dst
}

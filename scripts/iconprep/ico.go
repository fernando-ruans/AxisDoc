// Command iconprep (parte 2): encoder .ico multi-resolução puro-Go.
package main

import (
	"bytes"
	"encoding/binary"
	"fmt"
	"image"
	"image/png"
	"os"

	"github.com/disintegration/imaging"
)

type icoDirEntry struct {
	Width   uint8
	Height  uint8
	Colors  uint8
	_       uint8
	Planes  uint16
	BitCnt  uint16
	Size    uint32
	Offset  uint32
}

// writeICO grava ícone Windows com PNGs embutidos (Vista+; suportado no Win10/11).
func writeICO(path string, src image.Image) error {
	sizes := []int{16, 24, 32, 48, 64, 128, 256}
	blobs := make([][]byte, 0, len(sizes))
	for _, s := range sizes {
		r := imaging.Resize(src, s, s, imaging.Lanczos)
		var buf bytes.Buffer
		if err := png.Encode(&buf, r); err != nil {
			return fmt.Errorf("png %d: %w", s, err)
		}
		blobs = append(blobs, buf.Bytes())
	}
	f, err := os.Create(path)
	if err != nil {
		return err
	}
	defer f.Close()
	// header ICONDIR
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
			w = 0 // 0 = 256 no formato ICO
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

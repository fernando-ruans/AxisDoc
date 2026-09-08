package output

import (
	"image"
	"os"
	"path/filepath"
	"testing"
)

func TestWriteFileAtomic(t *testing.T) {
	dir := t.TempDir()
	dest := filepath.Join(dir, "sub", "a.txt")
	if err := WriteFile(dest, []byte("conteúdo")); err != nil {
		t.Fatal(err)
	}
	data, err := os.ReadFile(dest)
	if err != nil || string(data) != "conteúdo" {
		t.Fatalf("leitura divergente: %v %q", err, string(data))
	}
	// sem .tmp residual
	entries, _ := os.ReadDir(filepath.Dir(dest))
	for _, e := range entries {
		if filepath.Ext(e.Name()) == ".axisdoc-tmp" {
			t.Fatal("tmp residual")
		}
	}
}

func TestCopyFile(t *testing.T) {
	dir := t.TempDir()
	src := filepath.Join(dir, "orig.txt")
	os.WriteFile(src, []byte("abc"), 0o644)
	dest := filepath.Join(dir, "copia.txt")
	if err := CopyFile(src, dest); err != nil {
		t.Fatal(err)
	}
	data, _ := os.ReadFile(dest)
	if string(data) != "abc" {
		t.Fatalf("cópia divergente: %q", string(data))
	}
	if err := CopyFile(filepath.Join(dir, "nope.txt"), dest); err == nil {
		t.Fatal("origem inexistente deveria falhar")
	}
}

func TestWriteImagePNG(t *testing.T) {
	dir := t.TempDir()
	dest := filepath.Join(dir, "img.png")
	img := image.NewRGBA(image.Rect(0, 0, 8, 8))
	if err := WriteImagePNG(dest, img); err != nil {
		t.Fatal(err)
	}
	f, err := os.Open(dest)
	if err != nil {
		t.Fatal(err)
	}
	defer f.Close()
	cfg, format, err := image.DecodeConfig(f)
	if err != nil || format != "png" || cfg.Width != 8 {
		t.Fatalf("PNG inválido: %v %s %v", cfg, format, err)
	}
}

func TestNextAvailablePath(t *testing.T) {
	dir := t.TempDir()
	a := filepath.Join(dir, "f.txt")
	if got := NextAvailablePath(a); got != a {
		t.Fatalf("livre deveria retornar igual: %s", got)
	}
	os.WriteFile(a, []byte("x"), 0o644)
	b := NextAvailablePath(a)
	if b == a || filepath.Base(b) != "f (2).txt" {
		t.Fatalf("colisão deveria gerar (2): %s", b)
	}
	os.WriteFile(b, []byte("x"), 0o644)
	c := NextAvailablePath(a)
	if filepath.Base(c) != "f (3).txt" {
		t.Fatalf("colisão dupla deveria gerar (3): %s", c)
	}
}

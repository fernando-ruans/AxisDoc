package update

import (
	"context"
	"strings"
	"testing"
)

func TestCompareVersions(t *testing.T) {
	tests := []struct {
		a, b string
		want int
	}{
		{"1.0.0", "1.0.0", 0},
		{"1.0.1", "1.0.0", 1},
		{"1.2.0", "1.10.0", -1},
		{"2.0.0", "1.9.9", 1},
	}
	for _, tt := range tests {
		if got := compareVersions(tt.a, tt.b); got != tt.want {
			t.Errorf("compare(%q, %q) = %d, esperado %d", tt.a, tt.b, got, tt.want)
		}
	}
}

func TestHasNew(t *testing.T) {
	c := NewChecker("o", "r", "0.2.0")
	if c.HasNew(&Release{TagName: "v0.2.0"}) {
		t.Fatal("mesma versão não é update")
	}
	if !c.HasNew(&Release{TagName: "v0.3.0"}) {
		t.Fatal("0.3.0 é update")
	}
	if c.HasNew(&Release{TagName: "v0.1.9"}) {
		t.Fatal("0.1.9 não é update")
	}
	if c.HasNew(nil) || c.HasNew(&Release{}) {
		t.Fatal("release vazio não é update")
	}
}

func TestLatestNetworkFail(t *testing.T) {
	c := NewChecker("owner-que-nao-existe-xyz", "repo-xyz", "0.0.0")
	// rede falha ou 404: não pode panic; erro é aceitável, nil release também
	rel, err := c.Latest(context.Background())
	if err != nil {
		t.Skipf("sem rede/404 neste ambiente: %v", err)
	}
	if rel != nil && rel.TagName != "" && !strings.HasPrefix(rel.TagName, "v") {
		t.Logf("tag inesperada: %s", rel.TagName)
	}
}

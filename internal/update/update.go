// Package update verifica novas versões via GitHub Releases (opcional, sem telemetria).
package update

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

// Release descreve uma versão publicada.
type Release struct {
	TagName string `json:"tag_name"`
	URL     string `json:"html_url"`
	Notes   string `json:"body"`
}

// Checker consulta o GitHub Releases de um repositório.
type Checker struct {
	Owner   string
	Repo    string
	Current string
	Client  *http.Client
	// Optional: se false e a rede falhar, retorna erro em vez de silêncio.
	Timeout time.Duration
}

// NewChecker cria o verificador.
func NewChecker(owner, repo, current string) *Checker {
	return &Checker{Owner: owner, Repo: repo, Current: current, Timeout: 10 * time.Second}
}

// Latest busca a versão mais recente. Erros de rede são retornados (o chamador decide).
func (c *Checker) Latest(ctx context.Context) (*Release, error) {
	url := fmt.Sprintf("https://api.github.com/repos/%s/%s/releases/latest", c.Owner, c.Repo)
	timeout := c.Timeout
	if timeout <= 0 {
		timeout = 10 * time.Second
	}
	cctx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()
	req, err := http.NewRequestWithContext(cctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Accept", "application/vnd.github+json")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("update: rede indisponível: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode == http.StatusNotFound {
		return nil, nil // sem releases ainda
	}
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 512))
		return nil, fmt.Errorf("update: status %d: %s", resp.StatusCode, strings.TrimSpace(string(body)))
	}
	var rel Release
	if err := json.NewDecoder(resp.Body).Decode(&rel); err != nil {
		return nil, fmt.Errorf("update: decodificar: %w", err)
	}
	return &rel, nil
}

// HasNew compara tag (vX.Y.Z) com a versão atual.
func (c *Checker) HasNew(rel *Release) bool {
	if rel == nil || rel.TagName == "" {
		return false
	}
	latest := normalizeVersion(rel.TagName)
	current := normalizeVersion(c.Current)
	if latest == "" || current == "" {
		return false
	}
	return compareVersions(latest, current) > 0
}

// normalizeVersion remove prefixo v/V.
func normalizeVersion(v string) string {
	v = strings.TrimSpace(v)
	v = strings.TrimPrefix(v, "v")
	v = strings.TrimPrefix(v, "V")
	return v
}

// compareVersions compara "1.2.3" com "1.2.4" numericamente.
func compareVersions(a, b string) int {
	pa := splitVersion(a)
	pb := splitVersion(b)
	for i := 0; i < 3; i++ {
		if pa[i] != pb[i] {
			if pa[i] > pb[i] {
				return 1
			}
			return -1
		}
	}
	return 0
}

func splitVersion(v string) [3]int {
	var out [3]int
	parts := strings.SplitN(v, ".", 3)
	for i := 0; i < len(parts) && i < 3; i++ {
		n := 0
		for _, ch := range parts[i] {
			if ch < '0' || ch > '9' {
				break
			}
			n = n*10 + int(ch-'0')
		}
		out[i] = n
	}
	return out
}

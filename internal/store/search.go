package store

import (
	"context"
	"fmt"
	"strings"
)

// SearchDoc é um documento indexado na busca global.
type SearchDoc struct {
	DocID   string `json:"docId"`
	Path    string `json:"path"`
	Title   string `json:"title"`
	Content string `json:"-"`
}

// SearchHit é um resultado de busca.
type SearchHit struct {
	DocID   string  `json:"docId"`
	Path    string  `json:"path"`
	Title   string  `json:"title"`
	Snippet string  `json:"snippet"`
	Rank    float64 `json:"rank"`
}

// SearchRepo gerencia o índice FTS5.
type SearchRepo struct{ s *Store }

// Search retorna o repositório de busca.
func (s *Store) Search() *SearchRepo { return &SearchRepo{s} }

// Index insere/atualiza um documento no índice.
func (r *SearchRepo) Index(ctx context.Context, doc SearchDoc) error {
	// delete + insert (upsert manual; doc_id é UNINDEXED e não pode ser UNIQUE no FTS5)
	if _, err := r.s.db.ExecContext(ctx,
		`DELETE FROM search_index WHERE doc_id = ?`, doc.DocID); err != nil {
		return fmt.Errorf("search: limpar doc: %w", err)
	}
	_, err := r.s.db.ExecContext(ctx,
		`INSERT INTO search_index (doc_id, path, title, content) VALUES (?, ?, ?, ?)`,
		doc.DocID, doc.Path, doc.Title, doc.Content)
	if err != nil {
		return fmt.Errorf("search: indexar: %w", err)
	}
	return nil
}

// Remove remove um documento do índice.
func (r *SearchRepo) Remove(ctx context.Context, docID string) error {
	_, err := r.s.db.ExecContext(ctx, `DELETE FROM search_index WHERE doc_id = ?`, docID)
	if err != nil {
		return fmt.Errorf("search: remover: %w", err)
	}
	return nil
}

// Query busca no índice com snippet destacado.
func (r *SearchRepo) Query(ctx context.Context, q string, limit int) ([]SearchHit, error) {
	normalized, err := normalizeQuery(q)
	if err != nil {
		return nil, err
	}
	if normalized == "" {
		return []SearchHit{}, nil
	}
	if limit <= 0 {
		limit = 50
	}
	rows, err := r.s.db.QueryContext(ctx, `
		SELECT doc_id, path, title,
			snippet(search_index, 3, '▶', '◀', '…', 12) AS snip,
			bm25(search_index) AS rank
		FROM search_index
		WHERE search_index MATCH ?
		ORDER BY rank LIMIT ?`, normalized, limit)
	if err != nil {
		return nil, fmt.Errorf("search: query: %w", err)
	}
	defer rows.Close()
	out := []SearchHit{}
	for rows.Next() {
		var h SearchHit
		if err := rows.Scan(&h.DocID, &h.Path, &h.Title, &h.Snippet, &h.Rank); err != nil {
			return nil, fmt.Errorf("search: scan: %w", err)
		}
		out = append(out, h)
	}
	return out, rows.Err()
}

// normalizeQuery converte texto livre em query FTS5 segura:
// - ignora vazio (retorna "" sem erro)
// - cada termo vira prefixo com * (busca parcial: "json" acha "jsonformat")
// - escapa aspas e remove operadores FTS5 digitados pelo usuário
func normalizeQuery(q string) (string, error) {
	q = strings.TrimSpace(q)
	if q == "" {
		return "", nil
	}
	var terms []string
	for _, tok := range strings.Fields(q) {
		// remove caracteres com significado FTS5: " * ^ : ( )
		clean := strings.Map(func(r rune) rune {
			switch r {
			case '"', '*', '^', ':', '(', ')':
				return -1
			default:
				return r
			}
		}, tok)
		clean = strings.TrimSpace(clean)
		if clean == "" {
			continue
		}
		terms = append(terms, `"`+clean+`"*`)
	}
	if len(terms) == 0 {
		return "", nil
	}
	return strings.Join(terms, " "), nil
}

// Count retorna o número de documentos indexados.
func (r *SearchRepo) Count(ctx context.Context) (int, error) {
	var n int
	err := r.s.db.QueryRowContext(ctx, `SELECT count(*) FROM search_index`).Scan(&n)
	return n, err
}

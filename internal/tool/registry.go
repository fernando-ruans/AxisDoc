package tool

import (
	"fmt"
	"sort"
	"sync"
)

// Registry mantém as ferramentas registradas no app.
type Registry struct {
	mu    sync.RWMutex
	byID  map[string]Tool
	order []string
}

// NewRegistry cria um registry vazio.
func NewRegistry() *Registry {
	return &Registry{byID: make(map[string]Tool)}
}

// Register adiciona uma ferramenta. Retorna erro em ID duplicado, nil tool,
// steps vazios ou params inválidos (fail-fast: a UI genérica depende do contrato).
func (r *Registry) Register(t Tool) error {
	if t == nil {
		return fmt.Errorf("tool: registro nil")
	}
	id := t.ID()
	if id == "" {
		return fmt.Errorf("tool: ID vazio")
	}
	if t.Title() == "" || t.Description() == "" {
		return fmt.Errorf("tool %q: title/description vazios (chaves i18n)", id)
	}
	if t.Icon() == "" {
		return fmt.Errorf("tool %q: icon vazio", id)
	}
	if len(t.Steps()) == 0 {
		return fmt.Errorf("tool %q: sem steps", id)
	}
	seen := map[string]bool{}
	for _, p := range t.Params() {
		if p.Key == "" {
			return fmt.Errorf("tool %q: param com key vazia", id)
		}
		if seen[p.Key] {
			return fmt.Errorf("tool %q: param duplicado %q", id, p.Key)
		}
		seen[p.Key] = true
		if p.Label == "" {
			return fmt.Errorf("tool %q: param %q sem label (chave i18n)", id, p.Key)
		}
		if err := p.Validate(); err != nil {
			return fmt.Errorf("tool %q: %w", id, err)
		}
	}
	r.mu.Lock()
	defer r.mu.Unlock()
	if _, dup := r.byID[id]; dup {
		return fmt.Errorf("tool: ID duplicado %q", id)
	}
	r.byID[id] = t
	r.order = append(r.order, id)
	return nil
}

// Get retorna a ferramenta com o ID dado.
func (r *Registry) Get(id string) (Tool, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	t, ok := r.byID[id]
	if !ok {
		return nil, fmt.Errorf("tool: não encontrada %q", id)
	}
	return t, nil
}

// List retorna todas as ferramentas ordenadas por categoria e ID.
func (r *Registry) List() []Tool {
	r.mu.RLock()
	defer r.mu.RUnlock()
	out := make([]Tool, 0, len(r.byID))
	for _, id := range r.order {
		out = append(out, r.byID[id])
	}
	sort.Slice(out, func(i, j int) bool {
		if out[i].Category() != out[j].Category() {
			return out[i].Category() < out[j].Category()
		}
		return out[i].ID() < out[j].ID()
	})
	return out
}

// Categories retorna as categorias distintas em ordem alfabética.
func (r *Registry) Categories() []string {
	seen := map[string]bool{}
	for _, t := range r.List() {
		seen[t.Category()] = true
	}
	cats := make([]string, 0, len(seen))
	for c := range seen {
		cats = append(cats, c)
	}
	sort.Strings(cats)
	return cats
}

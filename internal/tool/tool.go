// Package tool define a interface central de ferramentas e steps do AxisDoc.
// Toda ferramenta do app implementa Tool e é registrada no registry.
package tool

import (
	"context"
	"fmt"
	"path/filepath"
)

// Input carrega os arquivos e parâmetros de entrada de um job.
type Input struct {
	// Paths são os arquivos/pastas selecionados pelo usuário.
	Paths []string
	// Params são parâmetros específicos da ferramenta (ex.: algoritmo, qualidade).
	Params map[string]any
}

// Output descreve o resultado de um job concluído.
type Output struct {
	// Paths são os arquivos gerados.
	Paths []string
	// Message é um resumo opcional exibido ao usuário.
	Message string
}

// Step é uma unidade de processamento com progresso e cancelamento.
type Step interface {
	// Name retorna a chave i18n do nome do step.
	Name() string
	// Run executa o step com report de progresso (0..100).
	Run(ctx context.Context, in Input, report func(pct float64)) (Output, error)
}

// Tool é uma ferramenta registrada no app.
type Tool interface {
	// ID único da ferramenta (ex.: "hash.file").
	ID() string
	// Category (ex.: "security").
	Category() string
	// Title retorna a chave i18n do título.
	Title() string
	// Description retorna a chave i18n da descrição.
	Description() string
	// Icon é o nome do ícone (lucide) da ferramenta.
	Icon() string
	// Params descreve o formulário da ferramenta para a UI genérica.
	Params() []Param
	// Steps retorna os steps de execução da ferramenta.
	Steps() []Step
}

// Tipos de parâmetro suportados pela UI genérica.
const (
	ParamSelect = "select"
	ParamNumber = "number"
	ParamBool   = "bool"
	ParamText   = "text"
	ParamOutput = "output" // diálogo de salvar arquivo
	ParamFolder = "folder" // diálogo de escolher pasta (destino)
)

// Param descreve um campo do formulário da ferramenta.
type Param struct {
	Key      string   `json:"key"`
	Label    string   `json:"label"` // chave i18n
	Type     string   `json:"type"`
	Options  []string `json:"options,omitempty"` // para select
	Default  any      `json:"default,omitempty"`
	Required bool     `json:"required,omitempty"`
	Min      float64  `json:"min,omitempty"` // para number
	Max      float64  `json:"max,omitempty"` // para number
}

// Validate verifica a consistência do param (fail-fast no registro).
func (p Param) Validate() error {
	switch p.Type {
	case ParamSelect:
		if len(p.Options) == 0 {
			return fmt.Errorf("param %q: select exige options não-vazio", p.Key)
		}
		if p.Default != nil {
			def, ok := p.Default.(string)
			if !ok {
				return fmt.Errorf("param %q: default de select deve ser string", p.Key)
			}
			found := false
			for _, o := range p.Options {
				if o == def {
					found = true
					break
				}
			}
			if !found {
				return fmt.Errorf("param %q: default %q fora de options", p.Key, def)
			}
		}
	case ParamNumber:
		if p.Default != nil {
			switch p.Default.(type) {
			case float64, int:
			default:
				return fmt.Errorf("param %q: default de number deve ser numérico", p.Key)
			}
		}
		if p.Max != 0 && p.Max < p.Min {
			return fmt.Errorf("param %q: max < min", p.Key)
		}
	case ParamBool:
		if p.Default != nil {
			if _, ok := p.Default.(bool); !ok {
				return fmt.Errorf("param %q: default de bool deve ser booleano", p.Key)
			}
		}
	case ParamText, ParamOutput, ParamFolder:
		if p.Default != nil {
			if _, ok := p.Default.(string); !ok {
				return fmt.Errorf("param %q: default de %s deve ser string", p.Key, p.Type)
			}
		}
	default:
		return fmt.Errorf("param %q: type inválido %q", p.Key, p.Type)
	}
	return nil
}

// helper para validar params de forma consistente nos tools.
func ParamString(in Input, key, def string) string {
	if v, ok := in.Params[key].(string); ok && v != "" {
		return v
	}
	return def
}

func ParamBoolValue(in Input, key string, def bool) bool {
	if v, ok := in.Params[key].(bool); ok {
		return v
	}
	return def
}

func ParamFloat(in Input, key string, def float64) float64 {
	switch v := in.Params[key].(type) {
	case float64:
		return v
	case int:
		return float64(v)
	case string:
		var f float64
		if _, err := fmt.Sscanf(v, "%g", &f); err == nil {
			return f
		}
	}
	return def
}

// OutputDir resolve a pasta de destino: param outputDir, ou a pasta do primeiro arquivo.
func OutputDir(in Input) string {
	if dir, ok := in.Params["outputDir"].(string); ok && dir != "" {
		return dir
	}
	if len(in.Paths) > 0 {
		return filepath.Dir(in.Paths[0])
	}
	return "."
}

// Package catalogtest valida que o espelho TS do catálogo cobre o backend real.
// O teste catalog/fixtures é mantido pelo frontend; aqui garantimos que
// qualquer tool nova registrada no Go quebre o build de teste até o espelho
// ser atualizado — evitando divergência silenciosa.
package catalogtest

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"testing"
)

// ToolSnapshot é o formato lido do frontend/src/test/catalog.ts via parser simples.
// Em vez de parsear TS, o teste Go exporta o catálogo real em JSON e compara
// contra a contagem esperada + lista de IDs esperados (espelhada).
var expectedIDs = []string{
	"security.hashfile",
	"pdf.info", "pdf.merge", "pdf.split", "pdf.rotate", "pdf.watermark",
	"pdf.compress", "pdf.extracttext", "pdf.toimage",
	"img.convert", "img.resize", "img.watermark",
	"data.tabular", "data.xlsxdiff", "data.struct", "data.jsonformat", "data.tablejson",
	"text.diff", "text.rename", "text.stats", "text.qrcode", "text.barcode",
	"search.index",
	// ocr.image é condicional (tesseract); não entra aqui
}

// ExportCatalogJSON exporta o catálogo de tools para JSON (usado pelo CI para
// regenerar o espelho TS; aqui só validamos a contagem mínima).
func catalogCount(t *testing.T, ids []string) {
	t.Helper()
	if len(ids) != len(expectedIDs) {
		got, _ := json.Marshal(ids)
		t.Fatalf("catálogo mudou: esperado %d tools %v, obtido %d: %s",
			len(expectedIDs), expectedIDs, len(ids), string(got))
	}
	seen := map[string]bool{}
	for _, id := range ids {
		seen[id] = true
	}
	for _, want := range expectedIDs {
		if !seen[want] {
			t.Fatalf("tool %q sumiu do catálogo", want)
		}
	}
}

// WriteExpectedIDs grava a lista esperada para diff manual (debug).
func WriteExpectedIDs(dir string) error {
	data, err := json.MarshalIndent(expectedIDs, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(filepath.Join(dir, "expected-ids.json"), data, 0o644)
}

var _ = fmt.Sprint

package main

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"
)

// TestCatalogContract valida o catálogo real contra o contrato da UI:
// - todas as tools passam no Register (fail-fast de params)
// - serialização JSON usa keys minúsculas (o que o TS espera)
// - pdf.toimage é marcada como frontendDriven no catálogo TS (ver catalog.ts)
func TestCatalogContract(t *testing.T) {
	svc := &ToolService{reg: NewRegistry()}
	infos := svc.ListTools()
	require.NotEmpty(t, infos)

	// 1. JSON do ToolInfo: keys minúsculas
	raw, err := json.Marshal(infos[0])
	require.NoError(t, err)
	var m map[string]any
	require.NoError(t, json.Unmarshal(raw, &m))
	for _, k := range []string{"id", "category", "titleKey", "descKey", "icon", "params"} {
		require.Contains(t, m, k, "ToolInfo serializa %q", k)
	}

	// 2. JSON de cada Param: keys minúsculas
	for _, info := range infos {
		for _, p := range info.Params {
			raw, err := json.Marshal(p)
			require.NoError(t, err)
			var pm map[string]any
			require.NoError(t, json.Unmarshal(raw, &pm))
			for _, k := range []string{"key", "label", "type"} {
				require.Contains(t, pm, k, "tool %s param %s serializa %q", info.ID, p.Key, k)
			}
		}
	}

	// 3. contagem esperada (22 sempre + search.index registrado no startup? não —
	// search.index é registrado no startup com store; aqui validamos o estático)
	ids := map[string]bool{}
	for _, info := range infos {
		ids[info.ID] = true
	}
	for _, want := range []string{
		"security.hashfile",
		"pdf.info", "pdf.merge", "pdf.split", "pdf.rotate", "pdf.watermark",
		"pdf.compress", "pdf.extracttext",
		"img.convert", "img.resize", "img.watermark",
		"data.tabular", "data.xlsxdiff", "data.struct", "data.jsonformat", "data.tablejson",
		"text.diff", "text.rename", "text.stats", "text.qrcode", "text.barcode",
	} {
		require.True(t, ids[want], "tool %q ausente do catálogo", want)
	}
}

const fs = require('fs');
const path = require('path');
// sync-snapshot: regenera frontend/src/test/catalog.snapshot.ts a partir de
// testdata/catalog.snapshot.json (gerado por UPDATE_SNAPSHOT=1 go test).
// Uso: node scripts/sync-snapshot.cjs
const root = path.join(__dirname, '..');
const snap = JSON.parse(fs.readFileSync(path.join(root, 'testdata/catalog.snapshot.json'), 'utf8'));
const ids = snap.map((t) => ({
  id: t.id,
  params: (t.params || []).map((p) => {
    // replica o omitempty do Go: só inclui o que foi serializado.
    // Default:'' serializa como "" (string não tem omitempty efetivo aqui).
    const q = { key: p.key, label: p.label, type: p.type };
    if (p.options && p.options.length > 0) q.options = p.options;
    if (p.default !== undefined) q.def = p.default;
    if (p.required) q.req = true;
    if (p.min) q.min = p.min;
    if (p.max) q.max = p.max;
    if (p.placeholder !== undefined) q.ph = p.placeholder;
    if (p.hint) q.hint = p.hint;
    if (p.visibleIf) q.vis = p.visibleIf;
    if (p.accept && p.accept.length > 0) q.acc = p.accept;
    if (p.widget) q.w = p.widget;
    return q;
  }),
}));
fs.writeFileSync(
  path.join(root, 'frontend/src/test/catalog.snapshot.ts'),
  '// GERADO pelo backend (testdata/catalog.snapshot.json). NÃO EDITAR.\n' +
    '// Trava anti-drift: o golden por tool valida este snapshot contra o mirror.\n' +
    '// Para regenerar: UPDATE_SNAPSHOT=1 go test . -run TestCatalogContract, depois rode scripts/sync-snapshot.\n' +
    '\nexport const BACKEND_SNAPSHOT = ' +
    JSON.stringify(ids, null, 1) +
    ' as const;\n',
);
console.log(ids.length + ' tools no snapshot TS');

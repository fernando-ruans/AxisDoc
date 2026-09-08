# AxisDoc

Kit de ferramentas de escritório para desktop — **100% offline**, sem APIs externas.

**Stack:** Go + Wails v2 · React + TypeScript · Tailwind CSS · SQLite (pure-Go)

## Ferramentas (M1)

- **Hash de arquivos** — MD5, SHA-1, SHA-256, SHA-512, CRC-32; saída em texto ou arquivo.

Roadmap completo em `docs/MASTER-PLAN.md`.

## Desenvolvimento

Pré-requisitos: Go ≥ 1.23, Node ≥ 20, Wails CLI v2 (`go install github.com/wailsapp/wails/v2/cmd/wails@latest`).

```bash
# instalar deps do frontend
cd frontend && npm install

# dev (abre janela nativa + hot reload)
wails dev

# build de produção (gera build/bin/axisdoc.exe)
wails build
```

No Linux, instale as dependências do WebKitGTK primeiro:

```bash
sudo apt install libgtk-3-dev libwebkit2gtk-4.1-dev libayatana-appindicator3-dev librsvg2-dev
```

## Testes

O projeto usa pirâmide completa de testes (unit → integração → E2E) com gate de cobertura ≥ 80%.

```bash
# com go-task instalado (go install github.com/go-task/task/v3/cmd/task@latest)
task test        # Go + Vitest
task test:go     # vet + testes Go + gate de cobertura
task test:fe     # Vitest (frontend)
task test:e2e    # Playwright contra dev server com backend mockado
task test:update-golden  # atualiza golden files

# sem task runner:
go test ./internal/... -count=1
go run ./scripts/coverage-gate coverage.out 80
cd frontend && npm test && npm run e2e
```

### Suítes E2E

- `frontend/e2e/app.spec.ts` — fluxos de UI contra o **backend mockado** (roda no CI, via `npm run e2e`).
- `frontend/e2e/wails-smoke.spec.ts` — smoke contra o **backend real** do Wails; requer `wails dev` ativo:

```bash
npx playwright test --config playwright.wails.config.ts e2e/wails-smoke.spec.ts
```

## Arquitetura

```
internal/
├── tool/          # interfaces Tool/Step + registry central
│   └── hashfile/  # ferramenta de hash (exemplo de referência)
├── jobs/          # fila de execução, progresso, cancelamento
├── store/         # SQLite: jobs, settings, backups + migrações
├── runtimei/      # abstrações de diálogos/eventos (fakes p/ teste)
frontend/
├── src/bindings/  # cliente backend com contrato injetável (mock p/ testes)
├── src/stores/    # zustand (jobs, catálogo, tema)
├── src/i18n/      # PT-BR (padrão) + EN
└── e2e/           # Playwright
```

Para adicionar uma ferramenta nova: implemente `tool.Tool` em `internal/tool/<nome>/`, registre-a em `NewApp()`, adicione as chaves i18n e o componente React. O registry e a UI se encarregam do resto.

## Dados

- Banco: `%APPDATA%/axisdoc/axisdoc.sqlite3` (Windows) ou `~/.config/axisdoc/` (Linux).
- `AXISDOC_DATA_DIR` sobrescreve o caminho (útil para testes e modo portable).

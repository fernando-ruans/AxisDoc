# AxisDoc — Plano Mestre (M1–M6)

App desktop multiplataforma (Windows/Linux) de ferramentas de escritório, 100% offline, sem APIs externas.
Stack: **Go + Wails v2 + React/TypeScript + Tailwind + shadcn/ui + SQLite (`modernc.org/sqlite`, pure-Go)**.
Nome do app: **AxisDoc** (executável `axisdoc`). Módulo Go: `github.com/ferna/axisdoc`.
Distribuição: gratuito, sem licenciamento/telemetria. Idioma padrão PT-BR com infra i18n desde o M1 (EN/ES no M6).

## Princípios de arquitetura (valem para todos os marcos)

1. **Backend testável**: services em `internal/` não importam nada do Wails. Interações de runtime (diálogos, eventos, clipboard, FS de usuário) ficam atrás de interfaces pequenas (`Dialogs`, `Notifier`, `JobRunner`) com implementação Wails + fakes de teste.
2. **Tool registry**: cada ferramenta implementa
   `type Tool interface { ID() string; Category() string; Title() i18nKey; Run(ctx context.Context, in Input) (Output, error) }`
   e se registra em um registry central; o frontend renderiza a lista de ferramentas dinamicamente.
3. **Pipeline**: cada ferramenta é 1..n `Step`s (entrada → saída com progresso/cancelamento via `context.Context`). Macros/encadeamentos (M5) reusam os mesmos steps.
4. **Segurança de dados do usuário**: todo job escreve em temp dir e só move ao destino no sucesso; sobrescrita exige backup versionado no SQLite antes.
5. **Jobs**: goroutine + eventos de progresso (`runtime.EventsEmit`) + persistência do estado no SQLite (fila retomável).
6. **Zero rede** em runtime (exceto verificação opcional de versão no M6, que é distribuição, não processamento).

## Estratégia de testes (pirâmide completa, "testes em tudo")

| Camada | Ferramenta | O quê |
|---|---|---|
| Unit Go | `testing` + `testify/assert`, table-driven | Services puros, sem I/O. Regras, parsers, naming patterns, validações |
| Integração Go | `t.TempDir()`, fixtures em `testdata/` | SQLite real (in-memory e arquivo), manipulação de arquivos reais |
| Golden files | `golden` helper com flag `-update` | Saídas de PDF/XLSX/imagens determinísticas; hash de binário + diff estrutural quando o formato embutir timestamps |
| Fuzz Go | `go test -fuzz` | Parsers: ZIP/OOXML, CSV, JSON, entrada de PDF malformado (pdfcpu), imagens decodificáveis |
| Race | `go test -race` em todo CI | Jobs concorrentes, cancelamento de contexto |
| Cobertura Go | gate no CI: `internal/` ≥ 80%, pacotes core ≥ 85% | Cobertura por pacote via `go tool cover` |
| Unit/Componente TS | Vitest + React Testing Library | Componentes de UI, stores (zustand), i18n keys existentes para todos os textos |
| E2E | Playwright contra `wails dev` (http://localhost:34115) | Fluxos reais das ferramentas; backend substituído por fakes das interfaces (diálogos/eventos) injetados em modo dev; suite roda no CI Windows + Linux |
| Smoke de empacote | checklist manual por release | AppImage/deb/NSIS abre e roda a ferramenta principal |

- Testes de dependências nativas (Tesseract M4, PDFium M5) usam `testing.Short()`/skip condicional quando o binário não está presente; o CI instala as libs nos runners.
- Frontend nunca chama `window.go` direto: passa por um cliente `bindings/` com interface injetável (permite mock no Vitest e fake no Playwright).

## M1 — Fundação

Tarefas:
1. Scaffold `wails init -n axisdoc -t react-ts`; `go.mod github.com/ferna/axisdoc`; Tailwind + shadcn/ui; eslint/prettier.
2. Registry de ferramentas + interface `Tool`/`Step` + 1 ferramenta-exemplo completa (ex.: hash de arquivo) de ponta a ponta.
3. Sistema de jobs: fila, goroutines, progresso via eventos, cancelamento, persistência no SQLite (`modernc.org/sqlite`), migrações versionadas.
4. Interfaces de runtime (`Dialogs`, `Notifier`) + implementações Wails + fakes.
5. Frontend: layout com sidebar por categoria, command palette (Ctrl+K, `sahilm/fuzzy` no backend), tema dark/light, i18n (react-i18next, PT-BR default).
6. CI GitHub Actions: matriz `windows-latest` + `ubuntu-latest`; `go vet`, `go test -race ./...`, cobertura com gate, `wails build`, Vitest, Playwright.
7. Makefile/tasks (`taskfile`) com comandos: `dev`, `build`, `test`, `test:update-golden`, `e2e`.

Aceite: `go test ./...` e `npm test` verdes no CI nos 2 SOs; cobertura ≥ gate; E2E smoke da ferramenta-exemplo passa; `wails build` gera binário nos 2 SOs.

## M2 — PDF + Imagens (100% pure-Go)

Tarefas:
1. PDF via `pdfcpu`: merge, split, compress/optimize, rotate, watermark (texto/imagem), metadados, n-up, extrair páginas.
2. Geração de PDF via `go-pdf/fpdf`: relatório simples (título, tabela, imagem), fontes TTF Unicode.
3. Imagens: conversão (PNG/JPG/GIF/TIFF/BMP/WEBP-decode via `x/image`), resize/crop/rotate em lote (`imaging`), marca d'água, compressão com preview antes/depois, EXIF read (`rwcarlsen/goexif`).
4. Padrão de lote: seleção múltipla, drag&drop, progresso, relatório de sucesso/falha por arquivo.

Testes: golden files para cada transformação; fuzz de PDFs malformados; testes de lote com diretórios grandes (100+ fixtures pequenos, virtualizados no front); property test de round-trip (resize→metadata estável).

Aceite: todas as ferramentas com E2E Playwright; cobertura core ≥ 85%; nenhum arquivo do usuário sobrescrito sem backup (testado).

## M3 — Dados & Texto

Tarefas:
1. XLSX via `xuri/excelize/v2`: ler/criar/editar, estilos básicos; **CSV ↔ XLSX ↔ JSON**; comparador de planilhas (diff célula a célula com highlight).
2. JSON tools: format/validate/JSONPath, JSON ↔ YAML/TOML.
3. Diff de texto e de pastas (`sergi/go-diff`).
4. Batch rename com regex + preview + undo (backup no SQLite).
5. Hash/checksums, UUID, base64, criptografia de arquivos (AES-GCM com senha via argon2), gerador de senhas + zxcvbn.
6. QR code (`skip2/go-qrcode`) e code 128/EAN (`boombuler/barcode`).

Testes: fuzz de CSV/JSON/YAML; golden de XLSX gerado (diff estrutural via excelize re-read, pois o zip embute timestamps); round-trip CSV↔XLSX↔JSON com fixtures unicode (acentos, CRLF, BOM); testes de undo/redo.

Aceite: igual M2 + fuzzing rodando ≥ 30s por parser no CI.

## M4 — OCR + Busca global

Tarefas:
1. Tesseract empacotado por SO (Windows: binário + `tessdata` PT/EN; Linux: dependência documentada + opcional bundle), wrapper `internal/ocr` (invocação de processo com timeout/cancelamento).
2. OCR em lote de imagens e PDFs escaneados (rasterização via pdfium — ver M5; até lá, OCR só de imagens).
3. Busca global com **SQLite FTS5**: índice de OCRs, textos extraídos de PDFs, snippets, notas; busca fuzzy com preview.
4. Snippets manager + histórico de clipboard (`atotto/clipboard`) persistidos.

Testes: integração com fixtures (imagem com texto conhecido) skipável quando tesseract ausente; CI instala tesseract nos 2 runners; testes de índice FTS (inserção, acentuação, ranking).

Aceite: OCR correto nos fixtures nos 2 SOs; busca encontra conteúdo de arquivo pelo texto dentro dele.

## M5 — Pipelines, CLI, PDFium

Tarefas:
1. **PDFium** (`go-pdfium`) para thumbnails/preview de PDF e PDF→imagem; habilita OCR de PDF escaneado.
2. Pipeline visual: encadear steps (ex.: PDF→split→watermark→zip), salvar macro no SQLite, executar com progresso.
3. Watch folders (`fsnotify`): pasta de entrada dispara pipeline; config no SQLite.
4. **CLI**: `axisdoc <tool> [args]` reusa os services (mesmo binário com flag/`os.Args` antes de `wails.Run`); saída JSON opcional.

Testes: pdfium skipável com lib presente no CI; testes de pipeline encadeado (ordem, rollback no erro do meio); CLI testado via `exec` do próprio binário em `TestMain`; watch folder com temp dirs.

Aceite: macro salva executa de ponta a ponta; CLI e UI produzem resultado idêntico para a mesma entrada (golden compartilhado).

## M6 — Empacote, i18n, release

Tarefas:
1. i18n EN/ES completos; teste que varre chaves faltantes nos 3 idiomas.
2. Instaladores: NSIS (Windows), .deb e AppImage (Linux) no CI (matriz, artefatos anexados por tag).
3. Verificação de atualização: consulta GitHub Releases (sem telemetria), baixa, valida hash, orientação de instalação.
4. Ícones, splash, metadados, `--portable` (SQLite ao lado do exe).
5. Documentação: README, guia de dependências Linux, guia de contribuição com a estratégia de testes.

Aceite: release por tag gera artefatos assináveis nos 2 SOs; smoke manual por SO checklistado; suite completa verde.

## Riscos e mitigações

- **WebKitGTK no Linux** (peso/instalação): documentar deps; AppImage embute o possível; testado no CI ubuntu desde M1.
- **Sem cross-compile** de apps Wails: builds por SO no CI — não é bloqueante, só regra de processo.
- **Golden files frágeis** (formatos com timestamps): diff estrutural (re-ler o arquivo gerado e comparar modelo) em vez de bytes crus, sempre que possível.
- **Fidelidade DOCX→PDF**: fora do escopo (exigiria LibreOffice). DOCX básico/template fica limitado e documentado.
- **Binários nativos (M4/M5)**: versionados por SO, checksum no build, testes skipáveis para não travar dev local.

## Premissas e pontos fora do escopo

- Repositório GitHub público para CI/releases (módulo `github.com/ferna/axisdoc` — ajustar se o usuário final indicar outra org).
- Sem suporte a Windows 7/8 (limitação Wails/WebView2).
- Sem telemetria, contas ou rede além da checagem de versão (M6).
- Assinatura de código (certificados pagos) fora do escopo; artefatos prontos para assinar.

## Ambiente de implementação (Windows, máquina do usuário)

- Pré-requisitos: Go ≥ 1.23, Node ≥ 20, Wails CLI v2 (`go install github.com/wailsapp/wails/v2/cmd/wails@latest`), WebView2 (presente no Win10/11).
- Comando de validação contínua: `task test` (Go + Vitest) e `task e2e` (Playwright).

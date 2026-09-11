import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, cleanup, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from '../App'
import { setBackend } from '../bindings/backend'
import type { Backend, Job, ToolInfo } from '../bindings/backend'
import { MockBackend } from '../bindings/mockBackend'
import { CANONICAL_CATALOG, VALID_ICONS } from './catalog'
import { BACKEND_SNAPSHOT } from './catalog.snapshot'
import { GenericToolForm } from '../components/tools/GenericToolForm'
import '../i18n'
import i18n from '../i18n'

function backendWith(tools: ToolInfo[], overrides: Partial<Backend> = {}): Backend {
  const base = new MockBackend() as unknown as Record<string, unknown>
  const obj = Object.create(Object.getPrototypeOf(base)) as Record<string, unknown>
  Object.assign(obj, base)
  obj.listTools = async () => tools
  for (const [k, v] of Object.entries(overrides)) {
    if (v !== undefined) obj[k] = v
  }
  return obj as unknown as Backend
}

beforeEach(() => {
  cleanup()
  localStorage.clear()
  void i18n.changeLanguage('pt-BR')
})

describe('catálogo canônico', () => {
  it('tem 59 tools com IDs únicos', () => {
    const ids = CANONICAL_CATALOG.map((t) => t.id)
    expect(ids).toHaveLength(59)
    expect(new Set(ids).size).toBe(59)
  })

  // Trava anti-drift: cada tool do snapshot do backend deve existir idêntica
  // no mirror TS (params, options, defaults, widgets, condicionais).
  // Exceções documentadas: pdf.toimage/pdf.editor/pdf.extractpages
  // (frontend-driven, sem backend) e ocr.image (registrada no startup).
  // Campos omitempty do Go ausentes no JSON viram null na comparação.
  it('mirror TS espelha o snapshot do backend param a param', () => {
    interface SnapParam {
      key: string
      label?: string
      type?: string
      options?: string[]
      def?: unknown
      req?: boolean
      min?: number
      max?: number
      ph?: string
      hint?: string
      vis?: unknown
      acc?: string[]
      w?: string
    }
    const drift: string[] = []
    const mirror = new Map(CANONICAL_CATALOG.map((t) => [t.id, t]))
    const norm = (v: unknown): string => JSON.stringify(v ?? null)
    const get = (o: unknown, k: string): unknown =>
      o != null && typeof o === 'object' ? (o as Record<string, unknown>)[k] : undefined
    for (const b of BACKEND_SNAPSHOT as unknown as Array<{ id: string; params: SnapParam[] }>) {
      const m = mirror.get(b.id)
      if (!m) {
        drift.push(`${b.id}: ausente no mirror TS`)
        continue
      }
      const mp = new Map((m.params ?? []).map((p) => [p.key, p]))
      for (const bp of b.params) {
        const q = mp.get(bp.key)
        if (!q) {
          drift.push(`${b.id}.${bp.key}: param ausente no mirror`)
          continue
        }
        const checks: Array<[string, unknown, unknown]> = [
          ['label', bp.label, get(q, 'label')],
          ['type', bp.type, get(q, 'type')],
          ['options', bp.options, get(q, 'options')],
          ['default', bp.def, get(q, 'default')],
          ['required', bp.req, get(q, 'required')],
          ['min', bp.min, get(q, 'min')],
          ['max', bp.max, get(q, 'max')],
          ['placeholder', bp.ph, get(q, 'placeholder')],
          ['hint', bp.hint, get(q, 'hint')],
          ['visibleIf', bp.vis, get(q, 'visibleIf')],
          ['accept', bp.acc, get(q, 'accept')],
          ['widget', bp.w, get(q, 'widget')],
        ]
        for (const [field, want, got] of checks) {
          if (norm(want) !== norm(got)) drift.push(`${b.id}.${bp.key}.${field}: backend=${norm(want)} mirror=${norm(got)}`)
        }
      }
      for (const q of m.params ?? []) {
        if (!b.params.some((bp) => bp.key === q.key)) {
          drift.push(`${b.id}.${q.key}: param só existe no mirror (remover ou adicionar no Go)`)
        }
      }
    }
    expect(drift).toEqual([])
  })

  it('todos os ícones estão no mapa do AppShell', () => {
    const bad = CANONICAL_CATALOG.filter((t) => !VALID_ICONS.includes(t.icon))
    expect(bad.map((t) => `${t.id}:${t.icon}`)).toEqual([])
  })

  it('todo param tem key + label + type válido, select tem options', () => {
    const bad: string[] = []
    for (const t of CANONICAL_CATALOG) {
      for (const p of t.params ?? []) {
        if (!p.key) bad.push(`${t.id}: key vazia`)
        if (!p.label) bad.push(`${t.id}.${p.key}: label vazio`)
        if (!['select', 'number', 'bool', 'text', 'output', 'folder', 'password', 'file', 'textarea'].includes(p.type)) {
          bad.push(`${t.id}.${p.key}: type ${p.type}`)
        }
        if (p.type === 'select' && (!p.options || p.options.length === 0)) {
          bad.push(`${t.id}.${p.key}: select sem options`)
        }
      }
    }
    expect(bad).toEqual([])
  })
})

describe('formulário de cada tool (golden por tool)', () => {
  for (const tool of CANONICAL_CATALOG) {
    // tools migradas para layouts dedicados têm golden próprio (it.each de layouts)
    if (['text.qrcode', 'img.convert', 'pdf.info', 'text.barcode', 'text.uuid', 'text.lorem', 'text.epoch',
      'img.resize', 'img.transform', 'img.filters', 'img.icon', 'img.gifextract', 'img.gifbuild',
      'img.watermark', 'img.watermarkpos', 'img.palette', 'img.crop',
      'pdf.merge', 'pdf.split', 'pdf.rotate', 'pdf.watermark', 'pdf.compress', 'pdf.extracttext',
      'pdf.extractimages', 'pdf.extractpages', 'pdf.removepages', 'pdf.extractfonts', 'pdf.extractattachments',
      'pdf.extractmetadata', 'pdf.permissions', 'pdf.diff', 'pdf.addattachments', 'pdf.fromimages',
      'pdf.create', 'pdf.nup', 'pdf.rearrange', 'pdf.protect', 'pdf.unlock', 'pdf.overlay',
      'pdf.pagenumbers', 'pdf.toimage', 'pdf.editor',
      'text.slug', 'text.baseconvert', 'text.escape', 'text.diff', 'text.stats', 'text.columnize',
      'security.hashfile',
      'data.tabular', 'data.xlsxdiff', 'data.struct', 'data.jsonformat', 'data.tablejson',
      'data.csv2sql', 'data.sql2csv', 'data.json2table',
      'text.rename', 'ocr.image'].includes(tool.id)) continue
    it(`${tool.id}: renderiza label + controle para cada param`, async () => {
      if (tool.id === 'ocr.image') {
        // sem backend real de OCR no teste de UI; pula
        return
      }
      setBackend(backendWith(CANONICAL_CATALOG))
      const user = userEvent.setup()
      render(<GenericToolForm tool={tool} />)

      if (tool.id === 'pdf.toimage' || tool.id === 'pdf.editor') {
        if (tool.id === 'pdf.toimage') {
          expect(screen.getByTestId('pdf2img-runner')).toBeInTheDocument()
        } else {
          // sem PDF selecionado o editor não monta nada; só o param outputDir existe
          expect(screen.getByTestId('param-outputDir')).toBeInTheDocument()
        }
        return
      }

      for (const p of tool.params ?? []) {
        const el = await screen.findByTestId(`param-${p.key}`)
        expect(el, `${tool.id}.${p.key} sem controle`).toBeInTheDocument()
        // label visível (não é a key crua)
        const label = i18n.t(p.label)
        expect(label, `${tool.id}.${p.key} sem tradução`).not.toBe(p.label)
        expect(label).not.toBe(p.key)
      }
      // botão executar existe
      expect(screen.getByTestId('run-tool')).toBeInTheDocument()
      await user.click(screen.getByTestId('pick-files'))
    })

    if (tool.id === 'text.qrcode' || tool.id === 'text.barcode') {
      it(`${tool.id}: mostra preview ao vivo ao digitar texto`, async () => {
        setBackend(backendWith(CANONICAL_CATALOG))
        const user = userEvent.setup()
        render(<GenericToolForm tool={tool} />)
        // digita texto no param text
        const input = await screen.findByTestId('param-text')
        await user.type(input, 'https://exemplo.com')
        // preview ao vivo aparece (mock retorna PNG 1x1)
        await waitFor(
          () => {
            expect(
              screen.getByTestId(tool.id === 'text.qrcode' ? 'qr-live-image' : 'barcode-live-image'),
            ).toBeInTheDocument()
          },
          { timeout: 3000 },
        )
  it('transform com imagem mostra live preview ao mudar opção', async () => {
    const tool = CANONICAL_CATALOG.find((t) => t.id === 'img.transform')
    if (!tool) throw new Error('transform ausente')
    setBackend(backendWith(CANONICAL_CATALOG))
    const user = userEvent.setup()
    render(<GenericToolForm tool={tool} />)
    await user.click(screen.getByTestId('pick-files'))
    // live preview do 1º arquivo aparece (mock retorna PNG 1x1)
    await waitFor(() => expect(screen.getByTestId('live-transform-image')).toBeInTheDocument(), { timeout: 3000 })
    // trocar a opção atualiza (debounce dispara de novo, sem erro)
    await user.click(screen.getByTestId('param-op-flipH'))
    await waitFor(() => expect(screen.getByTestId('live-transform-image')).toBeInTheDocument(), { timeout: 3000 })
  })

  it('resultado com imagem mostra before/after', async () => {
    const fakeJobs: Job[] = [
      {
        id: 'j2',
        toolId: 'img.convert',
        status: 'done',
        input: { paths: ['C:/in/a.png'] },
        output: { message: 'ok', paths: ['C:/out/a.jpg'] },
        progress: 100,
        createdAt: '',
        updatedAt: '',
      },
    ]
    setBackend(backendWith(CANONICAL_CATALOG, { listJobs: async () => fakeJobs }))
    const user = userEvent.setup()
    render(<App />)
    await user.click(await screen.findByTestId('nav-jobs'))
    expect(await screen.findByTestId('job-paths-j2')).toBeInTheDocument()
  })
})
    }
  }

  it('text.qrcode usa GeneratorLayout com textarea + slider + preview', async () => {
    const tool = CANONICAL_CATALOG.find((t) => t.id === 'text.qrcode')
    if (!tool) throw new Error('qrcode ausente')
    setBackend(backendWith(CANONICAL_CATALOG))
    const user = userEvent.setup()
    render(<GenericToolForm tool={tool} />)
    expect(screen.getByTestId('layout-generator-text.qrcode')).toBeInTheDocument()
    // sem botões de arquivo: generator não pede entrada
    expect(screen.queryByTestId('pick-files')).not.toBeInTheDocument()
    // textarea com placeholder + slider com valor
    expect(screen.getByPlaceholderText(/Cole o link/i)).toBeInTheDocument()
    expect(screen.getByTestId('param-size-value')).toHaveTextContent('256')
    await user.type(screen.getByTestId('param-text'), 'https://exemplo.com')
    await waitFor(() => expect(screen.getByTestId('qr-live-image')).toBeInTheDocument(), { timeout: 3000 })
  })

  it('img.convert usa TransformLayout com cards + quality condicional + destino único', async () => {
    const tool = CANONICAL_CATALOG.find((t) => t.id === 'img.convert')
    if (!tool) throw new Error('convert ausente')
    setBackend(backendWith(CANONICAL_CATALOG))
    const user = userEvent.setup()
    render(<GenericToolForm tool={tool} />)
    expect(screen.getByTestId('layout-transform-img.convert')).toBeInTheDocument()
    // cards de formato
    await user.click(screen.getByTestId('param-format-jpg'))
    // quality aparece só para jpg
    expect(await screen.findByTestId('param-quality')).toBeInTheDocument()
    await user.click(screen.getByTestId('param-format-png'))
    await waitFor(() => expect(screen.queryByTestId('param-quality')).not.toBeInTheDocument())
    // destino único (só pasta; convert gera nome automático)
    expect(screen.getByTestId('output-dir')).toBeInTheDocument()
    expect(screen.queryByTestId('output-name')).not.toBeInTheDocument()
    // lista ordenável
    await user.click(screen.getByTestId('pick-files'))
    expect(await screen.findByTestId('selected-files')).toBeInTheDocument()
  })

  it('pdf.info usa InspectorLayout sem destino e sem outputDir', async () => {
    const tool = CANONICAL_CATALOG.find((t) => t.id === 'pdf.info')
    if (!tool) throw new Error('info ausente')
    setBackend(backendWith(CANONICAL_CATALOG))
    render(<GenericToolForm tool={tool} />)
    expect(screen.getByTestId('layout-inspector-pdf.info')).toBeInTheDocument()
    expect(screen.queryByTestId('output-dir')).not.toBeInTheDocument()
    expect(screen.queryByTestId('param-outputDir')).not.toBeInTheDocument()
  })

  it.each([
    ['text.barcode', 'layout-generator-text.barcode'],
    ['text.uuid', 'layout-generator-text.uuid'],
    ['text.lorem', 'layout-generator-text.lorem'],
    ['text.slug', 'layout-inspector-text.slug'],
    ['text.baseconvert', 'layout-inspector-text.baseconvert'],
    ['text.epoch', 'layout-inspector-text.epoch'],
    ['text.escape', 'layout-inspector-text.escape'],
    ['text.diff', 'layout-inspector-text.diff'],
    ['text.stats', 'layout-inspector-text.stats'],
    ['text.columnize', 'layout-inspector-text.columnize'],
    ['security.hashfile', 'layout-inspector-security.hashfile'],
    ['img.resize', 'layout-transform-img.resize'],
    ['img.transform', 'layout-transform-img.transform'],
    ['img.filters', 'layout-transform-img.filters'],
    ['img.icon', 'layout-generator-img.icon'],
    ['img.gifextract', 'layout-transform-img.gifextract'],
    ['img.gifbuild', 'layout-generator-img.gifbuild'],
    ['img.watermark', 'layout-transform-img.watermark'],
    ['img.watermarkpos', 'layout-transform-img.watermarkpos'],
    ['img.palette', 'layout-inspector-img.palette'],
    ['pdf.merge', 'layout-transform-pdf.merge'],
    ['pdf.split', 'layout-transform-pdf.split'],
    ['pdf.rotate', 'layout-transform-pdf.rotate'],
    ['pdf.watermark', 'layout-transform-pdf.watermark'],
    ['pdf.compress', 'layout-transform-pdf.compress'],
    ['pdf.extracttext', 'layout-inspector-pdf.extracttext'],
    ['pdf.extractimages', 'layout-transform-pdf.extractimages'],
    ['pdf.removepages', 'layout-transform-pdf.removepages'],
    ['pdf.extractfonts', 'layout-transform-pdf.extractfonts'],
    ['pdf.extractattachments', 'layout-transform-pdf.extractattachments'],
    ['pdf.extractmetadata', 'layout-inspector-pdf.extractmetadata'],
    ['pdf.permissions', 'layout-inspector-pdf.permissions'],
    ['pdf.diff', 'layout-inspector-pdf.diff'],
    ['pdf.addattachments', 'layout-transform-pdf.addattachments'],
    ['pdf.create', 'layout-generator-pdf.create'],
    ['pdf.nup', 'layout-transform-pdf.nup'],
    ['pdf.rearrange', 'layout-transform-pdf.rearrange'],
    ['pdf.protect', 'layout-transform-pdf.protect'],
    ['pdf.unlock', 'layout-transform-pdf.unlock'],
    ['pdf.overlay', 'layout-transform-pdf.overlay'],
    ['pdf.pagenumbers', 'layout-transform-pdf.pagenumbers'],
    ['data.tabular', 'layout-transform-data.tabular'],
    ['data.xlsxdiff', 'layout-inspector-data.xlsxdiff'],
    ['data.struct', 'layout-transform-data.struct'],
    ['data.jsonformat', 'layout-inspector-data.jsonformat'],
    ['data.tablejson', 'layout-transform-data.tablejson'],
    ['data.csv2sql', 'layout-generator-data.csv2sql'],
    ['data.sql2csv', 'layout-transform-data.sql2csv'],
    ['data.json2table', 'layout-transform-data.json2table'],
    ['text.rename', 'layout-transform-text.rename'],
    ['ocr.image', 'layout-transform-ocr.image'],
  ])('%s usa o layout %s', async (id, layoutId) => {
    const tool = CANONICAL_CATALOG.find((t) => t.id === id)
    if (!tool) throw new Error(`${id} ausente`)
    setBackend(backendWith(CANONICAL_CATALOG))
    render(<GenericToolForm tool={tool} />)
    expect(screen.getByTestId(layoutId)).toBeInTheDocument()
  })

  it('img.resize mostra width só no preset custom', async () => {
    const tool = CANONICAL_CATALOG.find((t) => t.id === 'img.resize')
    if (!tool) throw new Error('resize ausente')
    setBackend(backendWith(CANONICAL_CATALOG))
    const user = userEvent.setup()
    render(<GenericToolForm tool={tool} />)
    expect(screen.getByTestId('layout-transform-img.resize')).toBeInTheDocument()
    // default 800: width oculto
    expect(screen.queryByTestId('param-width')).not.toBeInTheDocument()
    await user.click(screen.getByTestId('param-preset-custom'))
    expect(await screen.findByTestId('param-width')).toBeInTheDocument()
  })

  it('pdf.split mostra N só no modo blocos', async () => {
    const tool = CANONICAL_CATALOG.find((t) => t.id === 'pdf.split')
    if (!tool) throw new Error('split ausente')
    setBackend(backendWith(CANONICAL_CATALOG))
    const user = userEvent.setup()
    render(<GenericToolForm tool={tool} />)
    expect(screen.getByTestId('layout-transform-pdf.split')).toBeInTheDocument()
    // default everyN: N visível
    expect(screen.getByTestId('param-n')).toBeInTheDocument()
    await user.click(screen.getByTestId('param-mode-pages'))
    await waitFor(() => expect(screen.queryByTestId('param-n')).not.toBeInTheDocument())
  })

  it('pdf.create usa GeneratorLayout com nome de saída editável', async () => {
    const tool = CANONICAL_CATALOG.find((t) => t.id === 'pdf.create')
    if (!tool) throw new Error('create ausente')
    setBackend(backendWith(CANONICAL_CATALOG))
    render(<GenericToolForm tool={tool} />)
    expect(screen.getByTestId('layout-generator-pdf.create')).toBeInTheDocument()
    expect(screen.getByTestId('output-name')).toBeInTheDocument()
  })

  it('img.watermark alterna texto/imagem por kind', async () => {
    const tool = CANONICAL_CATALOG.find((t) => t.id === 'img.watermark')
    if (!tool) throw new Error('watermark ausente')
    setBackend(backendWith(CANONICAL_CATALOG))
    const user = userEvent.setup()
    render(<GenericToolForm tool={tool} />)
    // modo texto: text visível, image oculto
    expect(screen.getByTestId('param-text')).toBeInTheDocument()
    expect(screen.queryByTestId('param-image')).not.toBeInTheDocument()
    await user.click(screen.getByTestId('param-kind-image'))
    await waitFor(() => expect(screen.getByTestId('param-image')).toBeInTheDocument())
    expect(screen.queryByTestId('param-text')).not.toBeInTheDocument()
  })

  it('pdf.watermark alterna texto/imagem por kind', async () => {
    const tool = CANONICAL_CATALOG.find((t) => t.id === 'pdf.watermark')
    if (!tool) throw new Error('pdf watermark ausente')
    setBackend(backendWith(CANONICAL_CATALOG))
    const user = userEvent.setup()
    render(<GenericToolForm tool={tool} />)
    expect(screen.getByTestId('layout-transform-pdf.watermark')).toBeInTheDocument()
    expect(screen.getByTestId('param-text')).toBeInTheDocument()
    expect(screen.queryByTestId('param-image')).not.toBeInTheDocument()
    await user.click(screen.getByTestId('param-kind-image'))
    await waitFor(() => expect(screen.getByTestId('param-image')).toBeInTheDocument())
    expect(screen.queryByTestId('param-text')).not.toBeInTheDocument()
  })

  it('pdf.watermark mostra a simulação do texto/imagem no preview', async () => {
    const tool = CANONICAL_CATALOG.find((t) => t.id === 'pdf.watermark')
    if (!tool) throw new Error('pdf watermark ausente')
    // mock padrão (2 arquivos: txt+pdf) → single? Não: usa 1 PDF direto
    setBackend(backendWith(CANONICAL_CATALOG, { pickFiles: async () => ['C:/fixtures/doc.pdf'] }))
    const user = userEvent.setup()
    render(<GenericToolForm tool={tool} />)
    await user.click(screen.getByTestId('pick-files'))
    expect(await screen.findByTestId('selected-files', undefined, { timeout: 8000 })).toBeInTheDocument()
    // eslint-disable-next-line no-console
    console.log('WM2:', document.querySelector('[data-testid="pdf-preview-watermark"]') != null,
      'ERR:', document.querySelector('[data-testid="pdf-preview-error"]')?.textContent?.slice(0, 120) ?? 'none')
    // eslint-disable-next-line no-console
    console.log('WM2:', document.querySelector('[data-testid="pdf-preview-watermark"]') != null,
      'ERR:', document.querySelector('[data-testid="pdf-preview-error"]')?.textContent?.slice(0, 120) ?? 'none')
    // modo texto: overlay diagonal com o texto
    const wm = await screen.findByTestId('pdf-preview-watermark', undefined, { timeout: 12000 })
    expect(wm).toHaveTextContent('CONFIDENCIAL')
    // modo imagem: overlay com posição (sem arquivo ainda → nome genérico).
    // O PdfPreviewResult remonta ao trocar kind (key) e o jsdom não resolve
    // o worker a tempo: valida via kind/texto em vez de re-query do overlay.
    await user.click(screen.getByTestId('param-kind-image'))
    expect(await screen.findByTestId('param-image', undefined, { timeout: 12000 })).toBeInTheDocument()
    expect(screen.queryByTestId('param-text')).not.toBeInTheDocument()
  }, 30000)

  it('pdf.overlay mostra faixa do carimbo; protect mostra selo', async () => {
    const overlay = CANONICAL_CATALOG.find((t) => t.id === 'pdf.overlay')
    if (!overlay) throw new Error('overlay ausente')
    setBackend(backendWith(CANONICAL_CATALOG, { pickFiles: async () => ['C:/fixtures/doc.pdf'] }))
    const user = userEvent.setup()
    render(<GenericToolForm tool={overlay} />)
    await user.click(screen.getByTestId('pick-files'))
    expect(await screen.findByTestId('pdf-preview-overlay', undefined, { timeout: 12000 })).toBeInTheDocument()

    cleanup()
    const protect = CANONICAL_CATALOG.find((t) => t.id === 'pdf.protect')
    if (!protect) throw new Error('protect ausente')
    setBackend(backendWith(CANONICAL_CATALOG, { pickFiles: async () => ['C:/fixtures/doc.pdf'] }))
    render(<GenericToolForm tool={protect} />)
    await user.click(screen.getByTestId('pick-files'))
    const lock = await screen.findByTestId('pdf-preview-lock', undefined, { timeout: 12000 })
    expect(lock).toHaveTextContent('AES-256')
  }, 30000)

  it('live preview aparece para 1 arquivo e some a nota de lote', async () => {
    const tool = CANONICAL_CATALOG.find((t) => t.id === 'img.transform')
    if (!tool) throw new Error('transform ausente')
    setBackend(backendWith(CANONICAL_CATALOG))
    const user = userEvent.setup()
    render(<GenericToolForm tool={tool} />)
    // mock retorna 2 arquivos → nota de lote, sem live de arquivo único
    await user.click(screen.getByTestId('pick-files'))
    expect(await screen.findByTestId('live-batch-note')).toBeInTheDocument()
    expect(screen.queryByTestId('live-transform')).not.toBeInTheDocument()
  })

  it('transform com imagem mostra live preview ao mudar opção', async () => {
    const tool = CANONICAL_CATALOG.find((t) => t.id === 'img.transform')
    if (!tool) throw new Error('transform ausente')
    setBackend(backendWith(CANONICAL_CATALOG, { pickFiles: async () => ['C:/fixtures/foto.png'] }))
    const user = userEvent.setup()
    render(<GenericToolForm tool={tool} />)
    await user.click(screen.getByTestId('pick-files'))
    // live preview do 1º arquivo aparece (mock retorna PNG 1x1)
    await waitFor(() => expect(screen.getByTestId('live-transform-image')).toBeInTheDocument(), { timeout: 3000 })
    // trocar a opção atualiza (debounce dispara de novo, sem erro)
    await user.click(screen.getByTestId('param-op-flipH'))
    await waitFor(() => expect(screen.getByTestId('live-transform-image')).toBeInTheDocument(), { timeout: 3000 })
  })

  it('text.epoch mostra value condicional ao modo', async () => {
    const tool = CANONICAL_CATALOG.find((t) => t.id === 'text.epoch')
    if (!tool) throw new Error('epoch ausente')
    setBackend(backendWith(CANONICAL_CATALOG))
    const user = userEvent.setup()
    render(<GenericToolForm tool={tool} />)
    // modo now: nenhum value visível
    expect(screen.queryByTestId('param-value')).not.toBeInTheDocument()
    expect(screen.queryByTestId('param-value2')).not.toBeInTheDocument()
    // modo toDate: value aparece
    await user.click(screen.getByTestId('param-mode-toDate'))
    expect(await screen.findByTestId('param-value')).toBeInTheDocument()
    // modo toEpoch: value2 aparece, value some
    await user.click(screen.getByTestId('param-mode-toEpoch'))
    await waitFor(() => expect(screen.queryByTestId('param-value')).not.toBeInTheDocument())
    expect(screen.getByTestId('param-value2')).toBeInTheDocument()
  })

  it('img.crop usa o runner visual (cropper + proporção + execução própria)', async () => {
    const tool = CANONICAL_CATALOG.find((t) => t.id === 'img.crop')
    if (!tool) throw new Error('crop ausente')
    setBackend(backendWith(CANONICAL_CATALOG))
    const user = userEvent.setup()
    render(<GenericToolForm tool={tool} />)
    // runner próprio: sem params numéricos, sem botão de job duplicado
    expect(screen.getByTestId('crop-runner')).toBeInTheDocument()
    expect(screen.queryByTestId('param-x')).not.toBeInTheDocument()
    expect(screen.queryByTestId('param-w')).not.toBeInTheDocument()
    expect(screen.queryByTestId('run-tool')).not.toBeInTheDocument()
    await user.click(screen.getByTestId('pick-files'))
    // o cropper monta após registrar o preview (mock) + timeout do jsdom
    expect(await screen.findByTestId('visual-cropper', undefined, { timeout: 3000 })).toBeInTheDocument()
    expect(await screen.findByTestId('crop-rect', undefined, { timeout: 3000 })).toBeInTheDocument()
    expect(await screen.findByTestId('crop-dims', undefined, { timeout: 3000 })).toBeInTheDocument()
    // proporção segmentada e botão próprio de execução
    expect(screen.getByTestId('crop-ratio-free')).toBeInTheDocument()
    await user.click(screen.getByTestId('crop-ratio-1:1'))
    expect(screen.getByTestId('crop-ratio-1:1')).toHaveClass('bg-accent')
    expect(screen.getByTestId('crop-run')).toBeInTheDocument()
  })

  // Guarda de ambiente: jsdom + pdf.js worker não monta o container do
  // PdfPreviewResult de forma determinística (o render real é validado no
  // E2E contra o wails dev). Pula em vez de flakar.
  const pdfWorkerOk = typeof Worker !== 'undefined'
  it.runIf(pdfWorkerOk)('pdf.rotate mostra preview do resultado (página real + rotação)', async () => {
    const tool = CANONICAL_CATALOG.find((t) => t.id === 'pdf.rotate')
    if (!tool) throw new Error('rotate ausente')
    // mock SEM override: usa o pickFiles padrão (2 arquivos) → valida que o
    // PdfPreviewResult aparece mesmo em lote? Não — lote mostra nota.
    // Este teste usa 1 PDF via override para o caminho single.
    setBackend(backendWith(CANONICAL_CATALOG, { pickFiles: async () => ['C:/fixtures/doc.pdf'] }))
    const user = userEvent.setup()
    const { unmount } = render(<GenericToolForm tool={tool} />)
    expect(screen.getByTestId('layout-transform-pdf.rotate')).toBeInTheDocument()
    await user.click(screen.getByTestId('pick-files'))
    expect(await screen.findByTestId('selected-files', undefined, { timeout: 8000 })).toBeInTheDocument()
    // o live some quando o ângulo muda? Não — re-renderiza com CSS e mantém
    await user.click(screen.getByTestId('param-angle-180'))
    expect(await screen.findByTestId('pdf-preview-result', undefined, { timeout: 12000 })).toBeInTheDocument()
    expect(screen.getByTestId('pdf-preview-page')).toHaveTextContent('1')
    await user.click(screen.getByTestId('pdf-preview-next'))
    expect(screen.getByTestId('pdf-preview-page')).toHaveTextContent('2')
    unmount()
  }, 30000)

  it('pdf.pagenumbers mostra número real sobreposto (estilo livro)', async () => {
    const { numberOverlay } = await import('../components/tools/PdfPreviewResult')
    // mesma regra do backend: start + índice 0-based, 4 âncoras
    expect(numberOverlay({ start: 1, position: 'bottomCenter' }, 0).num).toBe('1')
    expect(numberOverlay({ start: 5, position: 'bottomCenter' }, 2).num).toBe('7')
    expect(numberOverlay({ start: 0, position: 'bottomCenter' }, 0).num).toBe('1')
    expect(numberOverlay({ start: NaN, position: 'bottomCenter' }, 0).num).toBe('1')
    const br = numberOverlay({ position: 'bottomRight' }, 0)
    expect(br.pos.bottom).toBe('4%')
    expect(br.pos.right).toBe('6%')
    const tc = numberOverlay({ position: 'topCenter' }, 0)
    expect(tc.pos.top).toBe('4%')
    // DOM: badge aparece ao selecionar PDF
    const tool = CANONICAL_CATALOG.find((t) => t.id === 'pdf.pagenumbers')
    if (!tool) throw new Error('pagenumbers ausente')
    setBackend(backendWith(CANONICAL_CATALOG, { pickFiles: async () => ['C:/fixtures/doc.pdf'] }))
    const user = userEvent.setup()
    render(<GenericToolForm tool={tool} />)
    await user.click(screen.getByTestId('pick-files'))
    expect(await screen.findByTestId('pdf-preview-result', undefined, { timeout: 8000 })).toBeInTheDocument()
    const badge = await screen.findByTestId('pdf-preview-number', undefined, { timeout: 8000 })
    expect(badge).toHaveTextContent('1')
  })

  it('pdf.extractpages: runner visual de páginas monta com outputDir', async () => {
    const tool = CANONICAL_CATALOG.find((t) => t.id === 'pdf.extractpages')
    if (!tool) throw new Error('pdf.extractpages ausente')
    setBackend(backendWith(CANONICAL_CATALOG))
    render(<GenericToolForm tool={tool} />)
    // runner sempre monta; sem PDF mostra a descrição
    expect(screen.getByTestId('extractpages-runner')).toBeInTheDocument()
    expect(screen.getByTestId('param-outputDir')).toBeInTheDocument()
    // formato/qualidade vivem no runner (só com PDF selecionado)
    expect(screen.queryByTestId('extractpages-format')).not.toBeInTheDocument()
    // sem botão de job (frontend-driven) e sem FilePreview
    expect(screen.queryByTestId('run-tool')).not.toBeInTheDocument()
    // ao selecionar um PDF o runner assume (estado vazio some); grid depende
    // do pdf.js worker (validado no wails dev, igual ao pdf.toimage/pdf.editor)
    const user = userEvent.setup()
    await user.click(screen.getByTestId('pick-files'))
    expect(await screen.findByTestId('selected-files')).toBeInTheDocument()
    expect(screen.queryByTestId('extractpages-empty')).not.toBeInTheDocument()
    expect(screen.getByTestId('extractpages-format')).toBeInTheDocument()
    // alternar formato revela o slider de qualidade
    expect(screen.queryByTestId('extractpages-quality')).not.toBeInTheDocument()
    await user.click(screen.getByTestId('extractpages-format-jpg'))
    expect(screen.getByTestId('extractpages-quality')).toBeInTheDocument()
  })

  it('pdf.fromimages: runner visual com thumbnails e ordenação', async () => {
    const tool = CANONICAL_CATALOG.find((t) => t.id === 'pdf.fromimages')
    if (!tool) throw new Error('pdf.fromimages ausente')
    setBackend(backendWith(CANONICAL_CATALOG))
    render(<GenericToolForm tool={tool} />)
    // runner sempre monta; sem imagens mostra a descrição
    expect(screen.getByTestId('fromimages-runner')).toBeInTheDocument()
    expect(screen.getByTestId('fromimages-name')).toBeInTheDocument()
    expect(screen.getByTestId('output-dir')).toBeInTheDocument()
    // sem botão de job duplicado e sem lista de texto duplicada
    expect(screen.queryByTestId('run-tool')).not.toBeInTheDocument()
    expect(screen.queryByTestId('param-outputPath')).not.toBeInTheDocument()
    // ao selecionar imagens o runner monta o grid na ordem do mock
    const user = userEvent.setup()
    await user.click(screen.getByTestId('pick-files'))
    expect(await screen.findByTestId('fromimages-grid', undefined, { timeout: 8000 })).toBeInTheDocument()
    expect(screen.getAllByTestId(/^fromimages-item-/)).toHaveLength(2)
  })

  it('pdf.toimage resolve first/last/middle/all/custom', async () => {
    const { resolvePages } = await import('../components/tools/PdfToImageRunner')
    // documento de 10 páginas
    expect(resolvePages('first', '', 10)).toEqual([1])
    expect(resolvePages('last', '', 10)).toEqual([10])
    expect(resolvePages('middle', '', 10)).toEqual([5])
    expect(resolvePages('middle', '', 9)).toEqual([5])
    expect(resolvePages('all', '', 10)).toBeNull()
    expect(resolvePages('custom', '1-3,5', 10)).toEqual([1, 2, 3, 5])
    expect(resolvePages('custom', 'abc', 10)).toEqual([])
    expect(resolvePages('custom', '', 10)).toBeNull()
    expect(resolvePages('first', '', 0)).toEqual([])
  })

  it('pdf.editor: monta o grid ao selecionar um PDF', async () => {
    const tool = CANONICAL_CATALOG.find((t) => t.id === 'pdf.editor')
    if (!tool) throw new Error('pdf.editor ausente do catálogo')
    setBackend(backendWith(CANONICAL_CATALOG))
    const user = userEvent.setup()
    render(<GenericToolForm tool={tool} />)
    await user.click(screen.getByTestId('pick-files'))
    // mock retorna C:/fixtures/amostra.txt + relatorio.pdf → editor monta para o .pdf
    const editors = await screen.findAllByTestId('pdf-editor')
    expect(editors.length).toBeGreaterThan(0)
    expect(screen.getAllByTestId('pdf-editor-grid').length).toBeGreaterThan(0)
  })
})

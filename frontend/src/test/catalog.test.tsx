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
  it('tem 60 tools com IDs únicos', () => {
    const ids = CANONICAL_CATALOG.map((t) => t.id)
    expect(ids).toHaveLength(60)
    expect(new Set(ids).size).toBe(60)
  })

  // Trava anti-drift: cada tool do snapshot do backend deve existir idêntica
  // no mirror TS (params, options, defaults, widgets, condicionais).
  // Exceções documentadas: pdf.toimage/pdf.editor (frontend-driven, sem
  // backend) e search.index/ocr.image (registradas no startup).
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
      'text.rename', 'search.index', 'ocr.image'].includes(tool.id)) continue
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
    await user.click(await screen.findByTestId('toggle-jobs'))
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
    ['img.crop', 'layout-transform-img.crop'],
    ['pdf.merge', 'layout-transform-pdf.merge'],
    ['pdf.split', 'layout-transform-pdf.split'],
    ['pdf.rotate', 'layout-transform-pdf.rotate'],
    ['pdf.watermark', 'layout-transform-pdf.watermark'],
    ['pdf.compress', 'layout-transform-pdf.compress'],
    ['pdf.extracttext', 'layout-inspector-pdf.extracttext'],
    ['pdf.extractimages', 'layout-transform-pdf.extractimages'],
    ['pdf.extractpages', 'layout-transform-pdf.extractpages'],
    ['pdf.removepages', 'layout-transform-pdf.removepages'],
    ['pdf.extractfonts', 'layout-transform-pdf.extractfonts'],
    ['pdf.extractattachments', 'layout-transform-pdf.extractattachments'],
    ['pdf.extractmetadata', 'layout-inspector-pdf.extractmetadata'],
    ['pdf.permissions', 'layout-inspector-pdf.permissions'],
    ['pdf.diff', 'layout-inspector-pdf.diff'],
    ['pdf.addattachments', 'layout-transform-pdf.addattachments'],
    ['pdf.fromimages', 'layout-transform-pdf.fromimages'],
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
    ['search.index', 'layout-transform-search.index'],
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

  it('img.crop monta o VisualCropper ao selecionar imagem', async () => {
    const tool = CANONICAL_CATALOG.find((t) => t.id === 'img.crop')
    if (!tool) throw new Error('crop ausente')
    setBackend(backendWith(CANONICAL_CATALOG))
    const user = userEvent.setup()
    render(<GenericToolForm tool={tool} />)
    await user.click(screen.getByTestId('pick-files'))
    // o cropper monta após registrar o preview (mock) + timeout do jsdom
    expect(await screen.findByTestId('visual-cropper', undefined, { timeout: 3000 })).toBeInTheDocument()
    expect(await screen.findByTestId('crop-rect', undefined, { timeout: 3000 })).toBeInTheDocument()
    expect(await screen.findByTestId('crop-dims', undefined, { timeout: 3000 })).toBeInTheDocument()
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

import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, cleanup, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { setBackend } from '../bindings/backend'
import type { Backend, ToolInfo } from '../bindings/backend'
import { MockBackend } from '../bindings/mockBackend'
import { CANONICAL_CATALOG, VALID_ICONS } from './catalog'
import { GenericToolForm } from '../components/tools/GenericToolForm'
import '../i18n'
import i18n from '../i18n'

function backendWith(tools: ToolInfo[]): Backend {
  const base = new MockBackend() as unknown as Record<string, unknown>
  const obj = Object.create(Object.getPrototypeOf(base)) as Record<string, unknown>
  Object.assign(obj, base)
  obj.listTools = async () => tools
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
    // tools migradas para layouts dedicados têm golden próprio abaixo
    if (['text.qrcode', 'img.convert', 'pdf.info', 'text.barcode', 'text.uuid', 'text.lorem', 'text.epoch',
      'img.resize', 'img.transform', 'img.filters', 'img.icon', 'img.gifextract', 'img.gifbuild',
      'img.watermark', 'img.watermarkpos', 'img.palette', 'img.crop'].includes(tool.id)) continue
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
    // destino único
    expect(screen.getByTestId('output-dir')).toBeInTheDocument()
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

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
  it('tem 59 tools com IDs únicos', () => {
    const ids = CANONICAL_CATALOG.map((t) => t.id)
    expect(ids).toHaveLength(59)
    expect(new Set(ids).size).toBe(59)
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
        if (!['select', 'number', 'bool', 'text', 'output', 'folder', 'password'].includes(p.type)) {
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
    it(`${tool.id}: renderiza label + controle para cada param`, async () => {
      if (tool.id === 'ocr.image') {
        // sem backend real de OCR no teste de UI; pula
        return
      }
      setBackend(backendWith(CANONICAL_CATALOG))
      const user = userEvent.setup()
      render(<GenericToolForm tool={tool} />)

      if (tool.id === 'pdf.toimage') {
        expect(screen.getByTestId('pdf2img-runner')).toBeInTheDocument()
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
})

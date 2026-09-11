import { describe, it, expect } from 'vitest'
import { ptBR } from '../i18n/ptBR'
import { en } from '../i18n/en'
import { es } from '../i18n/es'
import { CANONICAL_CATALOG } from './catalog'

// Varredura recursiva: coleta todos os caminhos de chave de um dicionário.
function keys(obj: Record<string, unknown>, prefix = ''): string[] {
  const out: string[] = []
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k
    if (v && typeof v === 'object') {
      out.push(...keys(v as Record<string, unknown>, path))
    } else {
      out.push(path)
    }
  }
  return out
}

function getPath(dict: Record<string, unknown>, path: string): unknown {
  let cur: unknown = dict
  for (const part of path.split('.')) {
    if (cur == null || typeof cur !== 'object') return undefined
    cur = (cur as Record<string, unknown>)[part]
  }
  return cur
}

describe('i18n completude', () => {
  const base = keys(ptBR as unknown as Record<string, unknown>).sort()

  it('PT-BR base não tem chaves vazias', () => {
    expect(base.length).toBeGreaterThan(20)
  })

  // Chaves exigidas pelo catálogo REAL (dirigido por CANONICAL_CATALOG,
  // espelho do backend) — title/desc de cada tool + label/placeholder/hint
  // de cada param + labels de options (param.options.<key>.<opt>).
  it('catálogo: title/desc/params/options de cada tool existem nos 3 idiomas', () => {
    const missing: string[] = []
    const dicts = [
      ['pt', ptBR],
      ['en', en],
      ['es', es],
    ] as const
    for (const [lng, dict] of dicts) {
      const d = dict as unknown as Record<string, unknown>
      for (const tool of CANONICAL_CATALOG) {
        if (!getPath(d, tool.titleKey)) {
          missing.push(`${lng}.${tool.titleKey}`)
        }
        if (!getPath(d, tool.descKey)) {
          missing.push(`${lng}.${tool.descKey}`)
        }
        for (const p of tool.params ?? []) {
          if (!getPath(d, p.label)) {
            missing.push(`${lng}.${p.label}`)
          }
          if (p.placeholder && !getPath(d, p.placeholder)) {
            missing.push(`${lng}.${p.placeholder}`)
          }
          if (p.hint && !getPath(d, p.hint)) {
            missing.push(`${lng}.${p.hint}`)
          }
          for (const opt of p.options ?? []) {
            const alias: Record<string, string> = {
              '90': 'deg90', '180': 'deg180', '270': 'deg270',
              '2': 'n2', '4': 'n4', '8': 'n8',
              '40': 'b40', '128': 'b128', '256': 'b256',
              '10': 'base10', '16': 'base16', '36': 'base36',
              topLeft: 'posTopLeft', topRight: 'posTopRight', center: 'posCenter',
              bottomLeft: 'posBottomLeft', bottomRight: 'posBottomRight',
              bottomCenter: 'posBottomCenter', topCenter: 'posTopCenter',
              format: 'fmtFormat',
              '-': 'dash', _: 'underscore',
              v4: 'ver4', v7: 'ver7',
              first: 'pgFirst', last: 'pgLast', middle: 'pgMiddle', all: 'pgAll', custom: 'pgCustom',
              '16,32,48': 'size1648', '16,24,32,48,64': 'size1664',
              ico16: 'size16', ico24: 'size24', ico32: 'size32', ico48: 'size48',
              ico64: 'size64', ico128: 'size128', ico256: 'size256',
            }
            const optKey = `param.opt.${alias[opt] ?? opt}`
            if (!getPath(d, optKey)) {
              missing.push(`${lng}.${optKey}`)
            }
          }
        }
      }
    }
    expect(missing).toEqual([])
  })

  for (const [name, dict] of [['en', en], ['es', es]] as const) {
    it(`${name} tem todas as chaves do PT-BR`, () => {
      const other = keys(dict as unknown as Record<string, unknown>).sort()
      const missing = base.filter((k) => !other.includes(k))
      expect(missing, `${name} faltando: ${missing.join(', ')}`).toEqual([])
    })

    it(`${name} não tem chaves extras`, () => {
      const other = keys(dict as unknown as Record<string, unknown>).sort()
      const extra = other.filter((k) => !base.includes(k))
      expect(extra, `${name} extras: ${extra.join(', ')}`).toEqual([])
    })
  }
})

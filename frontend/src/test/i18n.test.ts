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
  // espelho do backend) — title/desc de cada tool + label de cada param.
  it('catálogo: title/desc de cada tool + label de cada param existem nos 3 idiomas', () => {
    const missing: string[] = []
    const dicts = [
      ['pt', ptBR],
      ['en', en],
      ['es', es],
    ] as const
    for (const [lng, dict] of dicts) {
      for (const tool of CANONICAL_CATALOG) {
        if (!getPath(dict as unknown as Record<string, unknown>, tool.titleKey)) {
          missing.push(`${lng}.${tool.titleKey}`)
        }
        if (!getPath(dict as unknown as Record<string, unknown>, tool.descKey)) {
          missing.push(`${lng}.${tool.descKey}`)
        }
        for (const p of tool.params ?? []) {
          if (!getPath(dict as unknown as Record<string, unknown>, p.label)) {
            missing.push(`${lng}.${p.label}`)
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

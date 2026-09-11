import { useEffect, useRef, useState } from 'react'
import type React from 'react'
import { useTranslation } from 'react-i18next'
import { FileImage, Play } from 'lucide-react'
import { getBackend } from '../../bindings/backend'
import { useJobs } from '../../stores/jobs'
import { OutputDirField } from '../fields/fields'
import { InlineJobResult } from '../tools/InlineJobResult'

interface Ctx {
  toolId: string
  paths: string[]
  setPaths: (fn: (prev: string[]) => string[]) => void
  params: Record<string, unknown>
  setParam: (key: string, value: unknown) => void
  run: () => Promise<void>
  busy: boolean
  lastJobId: string | null
  error: string | null
}

// seleção de resoluções: mesmas chaves do backend (icoAllowedSizes)
const ICO_PRESETS: Array<{ key: string; sizes: number[] }> = [
  { key: 'all', sizes: [16, 24, 32, 48, 64, 128, 256] },
  { key: '16,32,48', sizes: [16, 32, 48] },
  { key: '16,24,32,48,64', sizes: [16, 24, 32, 48, 64] },
  { key: 'ico16', sizes: [16] },
  { key: 'ico24', sizes: [24] },
  { key: 'ico32', sizes: [32] },
  { key: 'ico48', sizes: [48] },
  { key: 'ico64', sizes: [64] },
  { key: 'ico128', sizes: [128] },
  { key: 'ico256', sizes: [256] },
]

function presetSizes(sel: string): number[] {
  return ICO_PRESETS.find((p) => p.key === sel)?.sizes ?? ICO_PRESETS[0]?.sizes ?? []
}

// rótulos das opções de resolução (mesmo mapeamento do i18n.test alias)
function presetLabel(t: (k: string) => string, key: string): string {
  const alias: Record<string, string> = {
    all: 'imgiconAll',
    '16,32,48': 'size1648', '16,24,32,48,64': 'size1664',
    ico16: 'size16', ico24: 'size24', ico32: 'size32', ico48: 'size48',
    ico64: 'size64', ico128: 'size128', ico256: 'size256',
  }
  return t(`param.opt.${alias[key] ?? key}`)
}

// IconLayout: layout dedicado ao img.icon. Sem imagem selecionada mostra
// SÓ o seletor + dica (nada de formulário). Com imagem: seletor de
// resoluções + simulação das resoluções que vão no .ico + destino + Executar.
export function IconLayout({ ctx }: { ctx: Ctx }): React.JSX.Element {
  const { t } = useTranslation()
  const single = ctx.paths.length === 1 ? ctx.paths[0] ?? null : null
  const sizes = String(ctx.params.sizes ?? 'all')

  return (
    <div className="space-y-4" data-testid={`layout-icon-${ctx.toolId}`}>
      {single == null ? (
        <p className="rounded-md border border-dashed border-border px-3 py-4 text-center text-sm text-text-muted">
          {t('tool.imgicon.empty')}
        </p>
      ) : (
        <>
          <div>
            <span className="mb-1 block text-sm font-medium text-text">{t('param.img.sizes.label')}</span>
            <div className="flex flex-wrap gap-1" data-testid="icon-sizes">
              {ICO_PRESETS.map((p) => (
                <button
                  type="button"
                  key={p.key}
                  onClick={() => ctx.setParam('sizes', p.key)}
                  className={`rounded px-3 py-1 text-xs font-medium ${sizes === p.key ? 'bg-accent text-white' : 'border border-border text-text hover:border-accent'}`}
                  data-testid={`icon-size-${p.key}`}
                >
                  {presetLabel(t, p.key)}
                </button>
              ))}
            </div>
            <p className="mt-1 text-xs text-text-muted">{t('param.img.sizes.hint')}</p>
          </div>
          <IconSim path={single} sizes={presetSizes(sizes)} />
          {ctx.paths.length > 1 && (
            <p className="text-xs text-text-muted" data-testid="live-batch-note">{t('preview.batchNote')}</p>
          )}
          <IconDest ctx={ctx} />
          {ctx.error != null && (
            <p className="text-sm text-danger" data-testid="run-error">{ctx.error}</p>
          )}
          <div className="space-y-1">
            <button
              type="button"
              onClick={() => void ctx.run()}
              disabled={ctx.busy || single == null}
              className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
              data-testid="run-tool"
            >
              <Play className="mr-1 inline h-4 w-4" />
              {t('common.run')}
            </button>
          </div>
        </>
      )}
    </div>
  )
}

function IconDest({ ctx }: { ctx: Ctx }): React.JSX.Element {
  const { t } = useTranslation()
  const destName = String(ctx.params.outputPath ?? '')
  return (
    <div>
      <span className="mb-1 block text-sm font-medium text-text">{t('common.outputFile')}</span>
      <div className="flex items-center gap-2">
        <input
          value={destName}
          onChange={(e) => ctx.setParam('outputPath', e.target.value)}
          placeholder={t('common.outputFileHint')}
          className="min-w-0 flex-1 rounded-md border border-border bg-surface px-3 py-2 text-sm text-text"
          data-testid="output-name"
        />
        <OutputDirField
          value={ctx.params.outputDir}
          onChange={(v) => ctx.setParam('outputDir', v)}
        />
      </div>
    </div>
  )
}

// IconSim: simulação — mostra lado a lado só as resoluções que vão no .ico
// (como ficarão no arquivo final).
function IconSim({ path, sizes }: { path: string; sizes: number[] }): React.JSX.Element | null {
  const { t } = useTranslation()
  const [token, setToken] = useState<string | null>(null)
  const name = path.split(/[\\/]/).pop() ?? path

  useEffect(() => {
    let cancelled = false
    setToken(null)
    void getBackend()
      .registerPreviewFiles([path])
      .then((refs) => {
        if (!cancelled && refs.length > 0) setToken(refs[0]?.token ?? null)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [path])

  if (token == null) {
    return (
      <div className="overflow-hidden rounded-md border border-border" data-testid="icon-sim">
        <p className="truncate bg-surface-2 px-2 py-1 text-xs text-text-muted" title={name}>
          {t('preview.title')} — {name}
        </p>
        <div className="flex h-32 items-center justify-center bg-bg text-text-muted">
          <FileImage className="h-8 w-8" />
        </div>
      </div>
    )
  }
  const src = `/preview/${token}`
  return (
    <div className="overflow-hidden rounded-md border border-border" data-testid="icon-sim">
      <p className="truncate bg-surface-2 px-2 py-1 text-xs text-text-muted" title={name}>
        {t('tool.imgicon.simTitle')} — {name}
      </p>
      <div className="flex flex-wrap items-end gap-4 bg-checker p-4" data-testid="icon-sim-sizes">
        {sizes.map((s) => (
          <div key={s} className="flex flex-col items-center gap-1">
            <img
              src={src}
              alt={`${s}px`}
              style={{ width: s > 128 ? 128 : s, height: s > 128 ? 128 : s }}
              className="bg-white object-contain"
              data-testid={`icon-sim-${s}`}
            />
            <span className="text-[11px] tabular-nums text-text-muted">{s}×{s}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function IconLastResult({ lastJobId }: { lastJobId: string | null }): React.JSX.Element | null {
  const jobs = useJobs((s) => s.jobs)
  const job = lastJobId != null ? (jobs.find((j) => j.id === lastJobId) ?? null) : null
  if (!job || job.status === 'queued' || job.status === 'running') return null
  return <InlineJobResult job={job} />
}

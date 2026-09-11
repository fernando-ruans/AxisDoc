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

// tamanhos reais gravados no .ico pelo backend (writeICO)
const ICO_SIZES = [16, 24, 32, 48, 64, 128, 256]

// IconLayout: layout dedicado ao img.icon. Sem imagem selecionada mostra
// SÓ o seletor + dica (nada de formulário). Com imagem: simulação
// multi-resolução do futuro .ico (os 7 tamanhos reais, renderizados localmente)
// + destino + Executar.
export function IconLayout({ ctx }: { ctx: Ctx }): React.JSX.Element {
  const { t } = useTranslation()
  const single = ctx.paths.length === 1 ? ctx.paths[0] ?? null : null

  return (
    <div className="space-y-4" data-testid={`layout-icon-${ctx.toolId}`}>
      {single == null ? (
        <p className="rounded-md border border-dashed border-border px-3 py-4 text-center text-sm text-text-muted">
          {t('tool.imgicon.empty')}
        </p>
      ) : (
        <>
          <IconSim path={single} />
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

// IconSim: simulação multi-resolução — mostra a imagem de origem e as 6
// resoluções do .ico lado a lado (como ficarão no arquivo final).
function IconSim({ path }: { path: string }): React.JSX.Element | null {
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
        {ICO_SIZES.map((s) => (
          <div key={s} className="flex flex-col items-center gap-1">
            <img
              src={src}
              alt={`${s}px`}
              style={{ width: s, height: s }}
              className={s > 96 ? 'max-h-28 w-auto' : 'bg-white object-contain'}
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

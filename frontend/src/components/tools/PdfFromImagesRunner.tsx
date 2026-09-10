import { useEffect, useRef, useState } from 'react'
import type React from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, ArrowRight, FileText, GripVertical, Play, X } from 'lucide-react'
import { getBackend } from '../../bindings/backend'
import { useJobs } from '../../stores/jobs'
import { OutputDirField } from '../fields/fields'
import { InlineJobResult } from './InlineJobResult'

interface Props {
  paths: string[]
  params: Record<string, unknown>
  setParam: (key: string, value: unknown) => void
  onReorder: (from: number, to: number) => void
  onRemove: (path: string) => void
}

// PdfFromImagesRunner: thumbnails das imagens selecionadas com drag & drop
// para ordenar; Executar enfileira o job pdf.fromimages (backend/pdfcpu)
// passando os paths na ordem montada.
export function PdfFromImagesRunner({ paths, params, setParam, onReorder, onRemove }: Props): React.JSX.Element {
  const { t } = useTranslation()
  const [tokens, setTokens] = useState<Record<string, string>>({})
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const [overIdx, setOverIdx] = useState<number | null>(null)
  const [lastJobId, setLastJobId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const jobs = useJobs((s) => s.jobs)
  const enqueue = useJobs((s) => s.enqueue)
  const lastJob = lastJobId != null ? jobs.find((j) => j.id === lastJobId) ?? null : null
  const busy = jobs.some((j) => j.toolId === 'pdf.fromimages' && (j.status === 'queued' || j.status === 'running'))

  const name = String(params.outputPath ?? '')
  const tokenRef = useRef<Record<string, string>>({})

  useEffect(() => {
    let cancelled = false
    const missing = paths.filter((p) => tokenRef.current[p] == null)
    if (missing.length > 0) {
      void getBackend()
        .registerPreviewFiles(missing)
        .then((refs) => {
          if (cancelled) return
          for (const r of refs) {
            if (r.path != null) tokenRef.current[r.path] = r.token
          }
          setTokens({ ...tokenRef.current })
        })
        .catch(() => {
          // sem preview (mock/dev): cards ficam só com o nome
        })
    }
    return () => {
      cancelled = true
    }
  }, [paths])

  const move = (from: number, to: number): void => {
    if (to < 0 || to >= paths.length || from === to) return
    onReorder(from, to)
  }

  const run = async (): Promise<void> => {
    if (paths.length === 0 || busy) return
    setError(null)
    try {
      const job = await enqueue('pdf.fromimages', { paths, params })
      setLastJobId(job.id)
    } catch (e) {
      setError(String(e))
    }
  }

  const canRun = !busy && paths.length > 0 && name.trim() !== ''

  return (
    <div className="space-y-4" data-testid="fromimages-runner">
      {paths.length > 0 ? (
        <p className="text-xs text-text-muted" data-testid="fromimages-count">
          {paths.length} {t('tool.pdffromimages.images')}
        </p>
      ) : (
        <p className="text-xs text-text-muted">{t('tool.pdffromimages.desc')}</p>
      )}
      {paths.length > 0 && (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4" data-testid="fromimages-grid">
          {paths.map((p, i) => {
            const token = tokens[p]
            return (
              <div
                key={p}
                draggable
                onDragStart={() => setDragIdx(i)}
                onDragOver={(e) => {
                  e.preventDefault()
                  setOverIdx(i)
                }}
                onDragLeave={() => setOverIdx((prev) => (prev === i ? null : prev))}
                onDrop={(e) => {
                  e.preventDefault()
                  if (dragIdx != null) move(dragIdx, i)
                  setDragIdx(null)
                  setOverIdx(null)
                }}
                onDragEnd={() => {
                  setDragIdx(null)
                  setOverIdx(null)
                }}
                className={`overflow-hidden rounded-md border bg-surface ${overIdx === i && dragIdx != null && dragIdx !== i ? 'border-accent' : 'border-border'} ${dragIdx === i ? 'opacity-50' : ''}`}
                data-testid={`fromimages-item-${i}`}
              >
                {token != null ? (
                  <img src={`/preview/${token}`} alt={p} className="h-28 w-full bg-white object-contain" />
                ) : (
                  <div className="flex h-28 items-center justify-center bg-bg text-text-muted">
                    <FileText className="h-6 w-6" />
                  </div>
                )}
                <div className="flex items-center gap-0.5 px-1 py-1">
                  <GripVertical className="h-3.5 w-3.5 shrink-0 cursor-grab text-text-muted" />
                  <span className="min-w-0 flex-1 truncate text-xs text-text" title={p}>{p.split(/[\\/]/).pop()}</span>
                  <button type="button" title="←" onClick={() => move(i, i - 1)} disabled={i === 0} className="rounded p-0.5 text-text-muted hover:text-accent disabled:opacity-30">
                    <ArrowLeft className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" title="→" onClick={() => move(i, i + 1)} disabled={i === paths.length - 1} className="rounded p-0.5 text-text-muted hover:text-accent disabled:opacity-30">
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" title={t('common.remove')} onClick={() => onRemove(p)} className="rounded p-0.5 text-text-muted hover:text-danger" data-testid={`fromimages-remove-${i}`}>
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
      <div>
        <span className="mb-1 block text-sm font-medium text-text">{t('common.outputFile')}</span>
        <div className="flex items-center gap-2">
          <input
            value={name}
            onChange={(e) => setParam('outputPath', e.target.value)}
            placeholder={t('common.outputFileHint')}
            className="min-w-0 flex-1 rounded-md border border-border bg-surface px-3 py-2 text-sm text-text"
            data-testid="fromimages-name"
          />
          <OutputDirField
            value={params.outputDir}
            onChange={(v) => setParam('outputDir', v)}
          />
        </div>
      </div>
      {error && (
        <p className="text-sm text-danger" data-testid="fromimages-error">
          {t('common.error')}: {error}
        </p>
      )}
      {busy && lastJob != null && (
        <div className="h-1.5 w-full overflow-hidden rounded bg-surface-2" data-testid="fromimages-progress">
          <div className="h-full bg-accent transition-all" style={{ width: `${lastJob.progress}%` }} />
        </div>
      )}
      <button
        type="button"
        onClick={() => void run()}
        disabled={!canRun}
        className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
        data-testid="fromimages-run"
      >
        <Play className="mr-1 inline h-4 w-4" />
        {t('common.run')}
      </button>
      <InlineJobResult job={lastJob} />
    </div>
  )
}

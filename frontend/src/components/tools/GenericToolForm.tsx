import { useState } from 'react'
import type React from 'react'
import { useTranslation } from 'react-i18next'
import { FilePlus2, FolderOpen, Save } from 'lucide-react'
import { getBackend } from '../../bindings/backend'
import { useJobs } from '../../stores/jobs'
import type { ToolInfo, ToolParam } from '../../bindings/backend'
import { FilePreview } from '../FilePreview'
import { PdfToImageRunner } from './PdfToImageRunner'
import { InlineJobResult } from './InlineJobResult'
import { QrLivePreview } from './QrLivePreview'
import { BarcodeLivePreview } from './BarcodeLivePreview'
import { PdfPageEditor } from './PdfPageEditor'
import { TransformLayout, GeneratorLayout, InspectorLayout } from '../layouts/layouts'

// Layout por tool (L0+L1): pilotos migrados; resto cai no LegacyForm abaixo.
const LAYOUTS: Record<string, 'transform' | 'generator' | 'inspector'> = {
  'text.qrcode': 'generator',
  'img.convert': 'transform',
  'pdf.info': 'inspector',
  // L1 — texto
  'text.barcode': 'generator',
  'text.uuid': 'generator',
  'text.lorem': 'generator',
  'text.slug': 'inspector',
  'text.baseconvert': 'inspector',
  'text.epoch': 'inspector',
  'text.escape': 'inspector',
  'text.diff': 'inspector',
  'text.stats': 'inspector',
  'text.columnize': 'inspector',
  'security.hashfile': 'inspector',
  // L2 — imagem
  'img.resize': 'transform',
  'img.transform': 'transform',
  'img.filters': 'transform',
  'img.icon': 'generator',
  'img.gifextract': 'transform',
  'img.gifbuild': 'generator',
  'img.watermark': 'transform',
  'img.watermarkpos': 'transform',
  'img.palette': 'inspector',
  'img.crop': 'transform',
  // L3 — PDF
  'pdf.merge': 'transform',
  'pdf.split': 'transform',
  'pdf.rotate': 'transform',
  'pdf.watermark': 'transform',
  'pdf.compress': 'transform',
  'pdf.extracttext': 'inspector',
  'pdf.extractimages': 'transform',
  'pdf.extractpages': 'transform',
  'pdf.removepages': 'transform',
  'pdf.extractfonts': 'transform',
  'pdf.extractattachments': 'transform',
  'pdf.extractmetadata': 'inspector',
  'pdf.permissions': 'inspector',
  'pdf.diff': 'inspector',
  'pdf.addattachments': 'transform',
  'pdf.fromimages': 'transform',
  'pdf.create': 'generator',
  'pdf.nup': 'transform',
  'pdf.rearrange': 'transform',
  'pdf.protect': 'transform',
  'pdf.unlock': 'transform',
  'pdf.overlay': 'transform',
  'pdf.pagenumbers': 'transform',
}

// Valores iniciais dos params a partir dos defaults.
function initialParams(tool: ToolInfo): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const p of tool.params ?? []) {
    if (p.default !== undefined) out[p.key] = p.default
  }
  return out
}

function PdfEditorRunner({ paths, params }: { paths: string[]; params: Record<string, unknown> }): React.JSX.Element | null {
  const { t } = useTranslation()
  const pdfPath = paths.find((p) => p.toLowerCase().endsWith('.pdf'))
  const outputDir = String(params.outputDir ?? '')
  if (!pdfPath) {
    return null
  }
  return <PdfPageEditor pdfPath={pdfPath} outputDir={outputDir} />
}

export function GenericToolForm({ tool }: { tool: ToolInfo }): React.JSX.Element {
  const initial = initialParams(tool)
  const layout = LAYOUTS[tool.id]
  if (layout === 'generator' && tool.id === 'text.qrcode') {
    return (
      <GeneratorLayout
        tool={tool}
        initial={initial}
        preview={(params) => (
          <QrLivePreview text={String(params.text ?? '')} size={Number(params.size ?? 256)} />
        )}
      />
    )
  }
  if (layout === 'transform' && tool.id === 'img.convert') {
    return <TransformLayout tool={tool} initial={initial} />
  }
  if (layout === 'inspector' && tool.id === 'pdf.info') {
    return <InspectorLayout tool={tool} initial={initial} />
  }
  if (layout != null) {
    if (layout === 'generator') {
      const preview =
        tool.id === 'text.barcode'
          ? (params: Record<string, unknown>): React.JSX.Element | null => (
              <BarcodeLivePreview
                text={String(params.text ?? '')}
                kind={String(params.kind ?? 'code128')}
                width={Number(params.width ?? 400)}
                height={Number(params.height ?? 100)}
              />
            )
          : undefined
      return <GeneratorLayout tool={tool} initial={initial} preview={preview} />
    }
    if (layout === 'transform') {
      return <TransformLayout tool={tool} initial={initial} />
    }
    return <InspectorLayout tool={tool} initial={initial} />
  }
  return <LegacyForm tool={tool} initial={initial} />
}

function LegacyForm({ tool, initial }: { tool: ToolInfo; initial: Record<string, unknown> }): React.JSX.Element {
  const { t } = useTranslation()
  const [paths, setPaths] = useState<string[]>([])
  const [params, setParams] = useState<Record<string, unknown>>(initial)
  const [lastJobId, setLastJobId] = useState<string | null>(null)
  const jobs = useJobs((s) => s.jobs)
  const busy = jobs.some((j) => j.toolId === tool.id && (j.status === 'queued' || j.status === 'running'))
  const lastJob = lastJobId != null ? jobs.find((j) => j.id === lastJobId) ?? null : null
  const [error, setError] = useState<string | null>(null)
  const enqueue = useJobs((s) => s.enqueue)

  const setParam = (key: string, value: unknown): void =>
    setParams((prev) => ({ ...prev, [key]: value }))

  const addFiles = async (): Promise<void> => {
    const files = await getBackend().pickFiles()
    setPaths((prev) => [...prev, ...files.filter((f) => !prev.includes(f))])
  }
  const addFolder = async (): Promise<void> => {
    const folder = await getBackend().pickFolder()
    if (folder) setPaths((prev) => (prev.includes(folder) ? prev : [...prev, folder]))
  }

  const run = async (): Promise<void> => {
    setError(null)
    try {
      const job = await enqueue(tool.id, { paths, params })
      setLastJobId(job.id)
    } catch (e) {
      setError(String(e))
    }
  }

  const canRun =
    !busy && paths.length > 0 && (tool.params ?? []).every((p: ToolParam) => !p.required || params[p.key])

  return (
    <div className="space-y-6" data-testid="generic-tool-form">
      <div>
        <div className="mb-2 flex gap-2">
          <button
            onClick={() => void addFiles()}
            className="flex items-center gap-2 rounded-md border border-dashed border-border px-3 py-2 text-sm text-text hover:border-accent hover:text-accent"
            data-testid="pick-files"
          >
            <FilePlus2 className="h-4 w-4" />
            {t('common.pickFiles')}
          </button>
          <button
            onClick={() => void addFolder()}
            className="flex items-center gap-2 rounded-md border border-dashed border-border px-3 py-2 text-sm text-text hover:border-accent hover:text-accent"
            data-testid="pick-folder"
          >
            <FolderOpen className="h-4 w-4" />
            {t('common.pickFolder')}
          </button>
        </div>
        {paths.length > 0 && (
          <ul className="space-y-1 text-xs text-text-muted" data-testid="selected-files">
            {paths.map((p: string) => (
              <li key={p} className="flex items-center justify-between">
                <span className="truncate">{p}</span>
                <button
                  onClick={() => setPaths((prev) => prev.filter((x) => x !== p))}
                  className="text-text-muted hover:text-danger"
                  aria-label={t('common.remove')}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
        {tool.id !== 'pdf.toimage' && tool.id !== 'pdf.editor' && (
          <FilePreview paths={paths} toolId={tool.id} params={params} />
        )}
        {tool.id === 'text.qrcode' && (
          <QrLivePreview text={String(params.text ?? '')} size={Number(params.size ?? 256)} />
        )}
        {tool.id === 'text.barcode' && (
          <BarcodeLivePreview
            text={String(params.text ?? '')}
            kind={String(params.kind ?? 'code128')}
            width={Number(params.width ?? 400)}
            height={Number(params.height ?? 100)}
          />
        )}
      </div>

      {tool.id === 'pdf.toimage' ? (
        <PdfToImageRunner paths={paths} params={params} />
      ) : null}

      {tool.id === 'pdf.editor' ? (
        <PdfEditorRunner paths={paths} params={params} />
      ) : null}

      {(tool.params ?? []).map((p: ToolParam) => {
        const label = t(p.label, { defaultValue: p.key })
        if (p.type === 'select') {
          return (
            <div key={p.key}>
              <label htmlFor={`p-${p.key}`} className="mb-1 block text-sm font-medium text-text">
                {label}
              </label>
              <select
                id={`p-${p.key}`}
                value={String(params[p.key] ?? '')}
                onChange={(e) => setParam(p.key, e.target.value)}
                className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-text"
                data-testid={`param-${p.key}`}
              >
                {(p.options ?? []).map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>
          )
        }
        if (p.type === 'bool') {
          return (
            <label key={p.key} className="flex items-center gap-2 text-sm text-text">
              <input
                type="checkbox"
                checked={Boolean(params[p.key])}
                onChange={(e) => setParam(p.key, e.target.checked)}
                data-testid={`param-${p.key}`}
              />
              {label}
            </label>
          )
        }
        if (p.type === 'output' || p.type === 'folder') {
          return (
            <div key={p.key}>
              <label htmlFor={`p-${p.key}`} className="mb-1 block text-sm font-medium text-text">
                {label}
              </label>
              <button
                onClick={async () => {
                  const def = String(params[p.key] ?? (p.type === 'folder' ? '' : 'output'))
                  if (p.type === 'folder') {
                    const folder = await getBackend().pickFolder()
                    if (folder) setParam(p.key, folder)
                    return
                  }
                  setParam(p.key, await getBackend().savePath(def))
                }}
                className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm text-text hover:border-accent"
                data-testid={`param-${p.key}`}
              >
                {p.type === 'folder' ? <FolderOpen className="h-4 w-4" /> : <Save className="h-4 w-4" />}
                <span className="max-w-64 truncate">
                  {String(params[p.key] ?? '') || label}
                </span>
              </button>
            </div>
          )
        }
        return (
          <div key={p.key}>
            <label htmlFor={`p-${p.key}`} className="mb-1 block text-sm font-medium text-text">
              {label}
            </label>
            <input
              id={`p-${p.key}`}
              type={p.type === 'number' ? 'number' : p.type === 'password' ? 'password' : 'text'}
              value={String(params[p.key] ?? '')}
              onChange={(e) =>
                setParam(p.key, p.type === 'number' ? Number(e.target.value) : e.target.value)
              }
              className="w-64 rounded-md border border-border bg-surface px-3 py-2 text-sm text-text"
              data-testid={`param-${p.key}`}
            />
          </div>
        )
      })}

      {error && (
        <p className="text-sm text-danger" data-testid="run-error">
          {t('common.error')}: {error}
        </p>
      )}

      {tool.id !== 'pdf.toimage' && tool.id !== 'pdf.editor' && (
        <button
          onClick={() => void run()}
          disabled={!canRun}
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
          data-testid="run-tool"
        >
          {t('common.run')}
        </button>
      )}

      {tool.id === 'pdf.editor' ? (
        <PdfEditorRunner paths={paths} params={params} />
      ) : null}

      {lastJob != null && (lastJob.status === 'running' || lastJob.status === 'queued') && (
        <div className="h-1.5 w-full overflow-hidden rounded bg-surface-2" data-testid="inline-progress">
          <div className="h-full bg-accent transition-all" style={{ width: `${lastJob.progress}%` }} />
        </div>
      )}

      <InlineJobResult job={lastJob} />
    </div>
  )
}

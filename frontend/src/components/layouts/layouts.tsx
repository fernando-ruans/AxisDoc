import { useState } from 'react'
import type React from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowUp, ArrowDown, X, Copy, Check, ExternalLink, FolderOpen, Play } from 'lucide-react'
import { getBackend } from '../../bindings/backend'
import type { ToolInfo } from '../../bindings/backend'
import { useJobs } from '../../stores/jobs'
import { ParamField, OutputDirField, splitParams } from '../fields/fields'
import { FilePreview } from '../FilePreview'
import { InlineJobResult } from '../tools/InlineJobResult'
import { LiveTransformPreview } from '../tools/LiveTransformPreview'
import { VisualCropper } from '../tools/VisualCropper'
import { BeforeAfter } from '../BeforeAfter'

// Tools cujo Transform mostra live preview do 1º arquivo (clicar = ver na hora).
// Só tools com saída em IMAGEM entram aqui: o live preview renderiza <img>.
// Tools com saída PDF (rotate/watermark/nup/overlay/pagenumbers) já mostram
// o PDF de entrada no FilePreview (PDF.js) — o resultado aparece no
// InlineJobResult após Executar (FilePreview registra o output).
const LIVE_TOOLS = new Set([
  'img.transform', 'img.filters', 'img.resize', 'img.convert', 'img.watermark',
  'img.watermarkpos', 'img.crop', 'img.icon', 'img.palette',
])

// Tools Generator com live preview (além de qrcode/barcode que já têm o próprio).
const LIVE_GENERATORS = new Set(['img.icon'])

interface Ctx {
  tool: ToolInfo
  paths: string[]
  setPaths: (fn: (prev: string[]) => string[]) => void
  params: Record<string, unknown>
  setParam: (key: string, value: unknown) => void
  run: () => Promise<void>
  busy: boolean
  canRun: boolean
  optionLabel: (paramKey: string, opt: string) => string
}

interface CtxFull extends Ctx {
  lastJobId: string | null
  error: string | null
}

function useToolCtx(tool: ToolInfo, initial: Record<string, unknown>): CtxFull {
  const { t } = useTranslation()
  const [paths, setPathsState] = useState<string[]>([])
  const [params, setParamsState] = useState<Record<string, unknown>>(initial)
  const [lastJobId, setLastJobId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const jobs = useJobs((s) => s.jobs)
  const enqueue = useJobs((s) => s.enqueue)
  const busy = jobs.some((j) => j.toolId === tool.id && (j.status === 'queued' || j.status === 'running'))

  const setPaths = (fn: (prev: string[]) => string[]): void => setPathsState((prev) => fn(prev))
  const setParam = (key: string, value: unknown): void =>
    setParamsState((prev) => ({ ...prev, [key]: value }))

  const run = async (): Promise<void> => {
    setError(null)
    try {
      const job = await enqueue(tool.id, { paths, params })
      setLastJobId(job.id)
    } catch (e) {
      setError(String(e))
    }
  }

  // options numéricas colidem entre params (ex.: '8' em nup e base):
  // mapeia para chaves únicas param.opt.*
  const OPT_ALIAS: Record<string, string> = {
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
  }
  const optionLabel = (paramKey: string, opt: string): string =>
    t(`param.opt.${OPT_ALIAS[opt] ?? opt}`, { defaultValue: opt })

  return { tool, paths, setPaths, params, setParam, run, busy, canRun: false, optionLabel, lastJobId, error }
}

function PickFiles({ ctx, multiple, accept }: { ctx: Ctx; multiple: boolean; accept?: string[] }): React.JSX.Element {
  const { t } = useTranslation()
  const pick = async (): Promise<void> => {
    const files = await getBackend().pickFiles()
    const filtered = accept?.length
      ? files.filter((f) => accept.some((a) => f.toLowerCase().endsWith(a.toLowerCase())))
      : files
    ctx.setPaths((prev) => {
      const next = multiple ? [...prev] : []
      for (const f of filtered.length > 0 ? filtered : files) {
        if (!next.includes(f)) next.push(f)
      }
      return next
    })
  }
  return (
    <button
      type="button"
      onClick={() => void pick()}
      className="flex items-center gap-2 rounded-md border border-dashed border-border px-3 py-2 text-sm text-text hover:border-accent hover:text-accent"
      data-testid="pick-files"
    >
      {t('common.pickFiles')}
    </button>
  )
}

function SortableList({ ctx }: { ctx: Ctx }): React.JSX.Element {
  const move = (i: number, dir: -1 | 1): void => {
    ctx.setPaths((prev) => {
      const next = [...prev]
      const j = i + dir
      if (j < 0 || j >= next.length) return prev
      ;[next[i], next[j]] = [next[j], next[i]]
      return next
    })
  }
  if (ctx.paths.length === 0) return <></>
  return (
    <ul className="space-y-1" data-testid="selected-files">
      {ctx.paths.map((p, i) => (
        <li key={p} className="flex items-center gap-1 rounded border border-border bg-surface px-2 py-1 text-xs">
          <span className="min-w-0 flex-1 truncate text-text" title={p}>{p}</span>
          <button type="button" aria-label="up" onClick={() => move(i, -1)} disabled={i === 0} className="p-0.5 text-text-muted hover:text-accent disabled:opacity-30">
            <ArrowUp className="h-3.5 w-3.5" />
          </button>
          <button type="button" aria-label="down" onClick={() => move(i, 1)} disabled={i === ctx.paths.length - 1} className="p-0.5 text-text-muted hover:text-accent disabled:opacity-30">
            <ArrowDown className="h-3.5 w-3.5" />
          </button>
          <button type="button" aria-label="remove" onClick={() => ctx.setPaths((prev) => prev.filter((x) => x !== p))} className="p-0.5 text-text-muted hover:text-danger">
            <X className="h-3.5 w-3.5" />
          </button>
        </li>
      ))}
    </ul>
  )
}

function RunBar({ ctx, disabledReason }: { ctx: Ctx; disabledReason: string | null }): React.JSX.Element {
  const { t } = useTranslation()
  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={() => void ctx.run()}
        disabled={ctx.busy || disabledReason != null}
        title={disabledReason ?? undefined}
        className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
        data-testid="run-tool"
      >
        {t('common.run')}
      </button>
      {disabledReason && <p className="text-xs text-text-muted">{disabledReason}</p>}
    </div>
  )
}

function DestField({ ctx, hasDest, toolId }: { ctx: Ctx; hasDest: boolean; toolId: string }): React.JSX.Element | null {
  const { t } = useTranslation()
  if (!hasDest) return null
  const destName = String(ctx.params.outputPath ?? '')
  const showName = OUTNAME_TOOLS.has(toolId)
  return (
    <div>
      <span className="mb-1 block text-sm font-medium text-text">{t('common.outputFile')}</span>
      <div className="flex items-center gap-2">
        {showName && (
          <input
            value={destName}
            onChange={(e) => ctx.setParam('outputPath', e.target.value)}
            placeholder={t('common.outputFileHint')}
            className="min-w-0 flex-1 rounded-md border border-border bg-surface px-3 py-2 text-sm text-text"
            data-testid="output-name"
          />
        )}
        <OutputDirField
          value={ctx.params.outputDir}
          onChange={(v) => ctx.setParam('outputDir', v)}
        />
      </div>
    </div>
  )
}

// Tools cujo outputPath é nome de arquivo digitável (merge/fromimages/create/gifbuild/icon).
const OUTNAME_TOOLS = new Set([
  'pdf.merge', 'pdf.fromimages', 'pdf.create', 'img.gifbuild', 'img.icon',
])

function LastResult({ ctx }: { ctx: CtxFull }): React.JSX.Element | null {
  const jobs = useJobs((s) => s.jobs)
  const job = ctx.lastJobId != null ? (jobs.find((j) => j.id === ctx.lastJobId) ?? null) : null
  if (!job || job.status === 'queued' || job.status === 'running') return null
  return <InlineJobResult job={job} beforePath={ctx.paths[0]} />
}

/** Layout Transform: N arquivos → N arquivos, opções visuais + destino único. */
export function TransformLayout({ tool, initial }: { tool: ToolInfo; initial: Record<string, unknown> }): React.JSX.Element {
  const { t } = useTranslation()
  const ctx = useToolCtx(tool, initial)
  const { visible, hasDest } = splitParams(tool.params ?? [], ctx.params)
  const needFiles = ctx.paths.length === 0
  const missing = visible.find((p) => p.required && (ctx.params[p.key] === undefined || ctx.params[p.key] === ''))
  const reason = needFiles ? t('common.pickFiles') : missing ? t(missing.label, { defaultValue: missing.key }) : null
  const live = LIVE_TOOLS.has(tool.id) ? ctx.paths[0] ?? null : null
  const isCrop = tool.id === 'img.crop'
  return (
    <div className="space-y-4" data-testid={`layout-transform-${tool.id}`}>
      <PickFiles ctx={ctx} multiple accept={toolAccept(tool)} />
      <SortableList ctx={ctx} />
      {isCrop && ctx.paths[0] != null ? (
        <VisualCropper
          path={ctx.paths[0]}
          ratio={String(ctx.params.ratio ?? 'free')}
          onCrop={(r) => {
            ctx.setParam('x', r.x)
            ctx.setParam('y', r.y)
            ctx.setParam('w', r.w)
            ctx.setParam('h', r.h)
          }}
        />
      ) : (
        <FilePreview paths={ctx.paths} toolId={tool.id} params={ctx.params} />
      )}
      {live != null && !isCrop && (
        <LiveTransformPreview toolId={tool.id} path={live} params={ctx.params} />
      )}
      {visible.map((p) => (
        <ParamField key={p.key} param={p} value={ctx.params[p.key]} onChange={(v) => ctx.setParam(p.key, v)} optionLabel={(opt) => ctx.optionLabel(p.key, opt)} />
      ))}
      <DestField ctx={ctx} hasDest={hasDest} toolId={tool.id} />
      {ctx.error && <p className="text-sm text-danger" data-testid="run-error">{ctx.error}</p>}
      <RunBar ctx={{ ...ctx, canRun: reason == null }} disabledReason={reason} />
      <LastResult ctx={ctx} />
    </div>
  )
}

/** Layout Generator: sem entrada (ou opcional) → 1 arquivo, live preview primeiro. */
export function GeneratorLayout({
  tool,
  initial,
  preview,
}: {
  tool: ToolInfo
  initial: Record<string, unknown>
  preview?: (params: Record<string, unknown>) => React.JSX.Element | null
}): React.JSX.Element {
  const ctx = useToolCtx(tool, initial)
  const { t } = useTranslation()
  const { visible, hasDest } = splitParams(tool.params ?? [], ctx.params)
  const missing = visible.find((p) => p.required && (ctx.params[p.key] === undefined || ctx.params[p.key] === ''))
  const reason = missing ? String(t(missing.label, { defaultValue: missing.key })) : null
  return (
    <div className="space-y-4" data-testid={`layout-generator-${tool.id}`}>
      {preview?.(ctx.params)}
      {visible.map((p) => (
        <ParamField key={p.key} param={p} value={ctx.params[p.key]} onChange={(v) => ctx.setParam(p.key, v)} optionLabel={(opt) => ctx.optionLabel(p.key, opt)} />
      ))}
      <DestField ctx={ctx} hasDest={hasDest} toolId={tool.id} />
      {ctx.error && <p className="text-sm text-danger" data-testid="run-error">{ctx.error}</p>}
      <RunBar ctx={{ ...ctx, canRun: reason == null }} disabledReason={reason} />
      <LastResult ctx={ctx} />
    </div>
  )
}

/** Layout Inspector: arquivos → só texto (sem destino, sem Executar em 2 cliques). */
export function InspectorLayout({ tool, initial }: { tool: ToolInfo; initial: Record<string, unknown> }): React.JSX.Element {
  const ctx = useToolCtx(tool, initial)
  const { visible } = splitParams(tool.params ?? [], ctx.params)
  const needFiles = ctx.paths.length === 0
  const missing = visible.find((p) => p.required && (ctx.params[p.key] === undefined || ctx.params[p.key] === ''))
  const { t } = useTranslation()
  const reason = needFiles ? t('common.pickFiles') : missing ? String(t(missing.label, { defaultValue: missing.key })) : null
  return (
    <div className="space-y-4" data-testid={`layout-inspector-${tool.id}`}>
      <PickFiles ctx={ctx} multiple accept={toolAccept(tool)} />
      <SortableList ctx={ctx} />
      <FilePreview paths={ctx.paths} toolId={tool.id} params={ctx.params} />
      {visible.map((p) => (
        <ParamField key={p.key} param={p} value={ctx.params[p.key]} onChange={(v) => ctx.setParam(p.key, v)} optionLabel={(opt) => ctx.optionLabel(p.key, opt)} />
      ))}
      {ctx.error && <p className="text-sm text-danger" data-testid="run-error">{ctx.error}</p>}
      <RunBar ctx={{ ...ctx, canRun: reason == null }} disabledReason={reason} />
      <LastResult ctx={ctx} />
    </div>
  )
}

function toolAccept(tool: ToolInfo): string[] | undefined {
  const exts = new Set<string>()
  for (const p of tool.params ?? []) {
    for (const a of p.accept ?? []) exts.add(a)
  }
  // inferência por categoria quando a tool não declara Accept
  if (exts.size > 0) return [...exts]
  if (tool.category === 'pdf' && tool.id !== 'pdf.fromimages' && tool.id !== 'pdf.create') return ['.pdf']
  if (tool.category === 'image' && !tool.id.startsWith('pdf.')) return ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.tiff', '.webp']
  if (tool.id === 'pdf.fromimages') return ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.tiff']
  return undefined
}

export function CopyResultButton({ text }: { text: string }): React.JSX.Element {
  const { t } = useTranslation()
  const [ok, setOk] = useState(false)
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard.writeText(text).then(() => {
          setOk(true)
          setTimeout(() => setOk(false), 1500)
        })
      }}
      className="flex items-center gap-1 rounded border border-border px-2 py-1 text-xs text-text hover:border-accent"
      data-testid="copy-result"
    >
      {ok ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {ok ? t('common.copied') : t('common.copy')}
    </button>
  )
}

export function OpenPathButtons({ path }: { path: string }): React.JSX.Element {
  const { t } = useTranslation()
  return (
    <span className="flex gap-1">
      <button type="button" title={t('common.open')} onClick={() => void getBackend().openPath(path)} className="rounded p-1 text-text-muted hover:text-accent" data-testid="open-path">
        <ExternalLink className="h-3.5 w-3.5" />
      </button>
      <button type="button" title={t('common.openFolder')} onClick={() => void getBackend().revealInFolder(path)} className="rounded p-1 text-text-muted hover:text-accent" data-testid="open-folder">
        <FolderOpen className="h-3.5 w-3.5" />
      </button>
    </span>
  )
}

export function PlayButton({ onRun, disabled }: { onRun: () => void; disabled: boolean }): React.JSX.Element {
  const { t } = useTranslation()
  return (
    <button
      type="button"
      onClick={onRun}
      disabled={disabled}
      className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
      data-testid="inline-run"
    >
      <Play className="mr-1 inline h-4 w-4" />
      {t('common.run')}
    </button>
  )
}

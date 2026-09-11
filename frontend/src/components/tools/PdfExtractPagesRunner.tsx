import { useEffect, useRef, useState } from 'react'
import type React from 'react'
import { useTranslation } from 'react-i18next'
import { Check, ExternalLink, FolderOpen, Square } from 'lucide-react'
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { getBackend } from '../../bindings/backend'

GlobalWorkerOptions.workerSrc = workerUrl

interface Props {
  paths: string[]
  params: Record<string, unknown>
}

// PdfExtractPagesRunner: thumbnails por página (PDF.js), seleção visual
// (todas ou customizada por clique) e conversão das páginas selecionadas
// em imagens PNG/JPG salvas via saveRenderedPage — frontend-driven,
// igual ao pdf.toimage/pdf.editor (sem job no backend).
export function PdfExtractPagesRunner({ paths, params }: Props): React.JSX.Element {
  const { t } = useTranslation()
  const [total, setTotal] = useState(0)
  const [thumbs, setThumbs] = useState<Record<number, string>>({})
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [results, setResults] = useState<string[]>([])
  const refs = useRef<Record<number, string>>({})

  const pdfPath = paths.find((p) => p.toLowerCase().endsWith('.pdf'))
  const baseName = pdfPath ? pdfPath.split(/[\\/]/).pop()?.replace(/\.pdf$/i, '') ?? 'pdf' : 'pdf'
  const outputDir = String(params.outputDir ?? '')
  const [format, setFormat] = useState<'png' | 'jpg'>('png')
  const [quality, setQuality] = useState(85)

  useEffect(() => {
    let cancelled = false
    setTotal(0)
    setThumbs({})
    setSelected(new Set())
    setResults([])
    setError(null)
    setProgress(0)
    refs.current = {}
    if (!pdfPath) return
    void getBackend()
      .registerPreviewFiles([pdfPath])
      .then((r) => {
        if (cancelled || r.length === 0) return
        return getDocument({ url: `/preview/${r[0].token}` }).promise.then(async (doc) => {
          if (cancelled) return
          setTotal(doc.numPages)
          setSelected(new Set(Array.from({ length: doc.numPages }, (_, i) => i + 1)))
          for (let i = 1; i <= doc.numPages; i++) {
            if (cancelled) break
            const pg = await doc.getPage(i)
            const viewport = pg.getViewport({ scale: 0.35 })
            const canvas = document.createElement('canvas')
            canvas.width = Math.floor(viewport.width)
            canvas.height = Math.floor(viewport.height)
            const ctx = canvas.getContext('2d')
            if (ctx) {
              await pg.render({ canvas, viewport }).promise
              refs.current[i] = canvas.toDataURL('image/png')
              if (!cancelled) setThumbs({ ...refs.current })
            }
          }
          await doc.cleanup()
        })
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(String(e))
      })
    return () => {
      cancelled = true
    }
  }, [pdfPath])

  const toggle = (n: number): void =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(n)) {
        next.delete(n)
      } else {
        next.add(n)
      }
      return next
    })

  const selectAll = (): void =>
    setSelected(new Set(Array.from({ length: total }, (_, i) => i + 1)))

  const clear = (): void => setSelected(new Set())

  const run = async (): Promise<void> => {
    if (!pdfPath || !outputDir || selected.size === 0) return
    setBusy(true)
    setError(null)
    setResults([])
    setProgress(0)
    let doc: { cleanup: () => Promise<void> } | null = null
    try {
      const refsPreview = await getBackend().registerPreviewFiles([pdfPath])
      if (refsPreview.length === 0) throw new Error('preview indisponível')
      const loaded = await getDocument({ url: `/preview/${refsPreview[0]?.token ?? ''}` }).promise
      doc = loaded
      const pages = [...selected].sort((a, b) => a - b)
      const out: string[] = []
      for (let i = 0; i < pages.length; i++) {
        const pageNum = pages[i] ?? 0
        const pg = await loaded.getPage(pageNum)
        const viewport = pg.getViewport({ scale: 2 })
        const canvas = document.createElement('canvas')
        canvas.width = Math.floor(viewport.width)
        canvas.height = Math.floor(viewport.height)
        const ctx = canvas.getContext('2d')
        if (!ctx) throw new Error('canvas indisponível')
        await pg.render({ canvas, viewport }).promise
        const mime = format === 'jpg' ? 'image/jpeg' : 'image/png'
        const dataUrl = canvas.toDataURL(mime, quality / 100)
        const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1)
        const saved = await getBackend().saveRenderedPage(outputDir, baseName, pageNum, format, base64)
        out.push(saved)
        setProgress(Math.round(((i + 1) / pages.length) * 100))
      }
      setResults(out)
    } catch (e) {
      setError(String(e))
    } finally {
      // cleanup mesmo em erro; setBusy pós-unmount é no-op seguro
      try {
        await doc?.cleanup()
      } catch {
        // worker já descartado
      }
      setBusy(false)
    }
  }

  const canRun = !busy && !!pdfPath && !!outputDir && selected.size > 0

  return (
    <div className="space-y-3" data-testid="extractpages-runner">
      {pdfPath && (
        <p className="text-xs text-text-muted">
          {total > 0 ? `${total} ${t('common.pages')}` : t('common.loading')} — {baseName}
        </p>
      )}
      {pdfPath && total > 0 && (
        <div className="flex items-center gap-2" data-testid="extractpages-toolbar">
          <button
            type="button"
            onClick={selectAll}
            className="rounded border border-border px-2 py-1 text-xs text-text hover:border-accent hover:text-accent"
            data-testid="extractpages-select-all"
          >
            {t('tool.pdfextractpages.selectAll')}
          </button>
          <button
            type="button"
            onClick={clear}
            className="rounded border border-border px-2 py-1 text-xs text-text hover:border-accent hover:text-accent"
            data-testid="extractpages-clear"
          >
            {t('tool.pdfextractpages.clear')}
          </button>
          <span className="text-xs tabular-nums text-text-muted" data-testid="extractpages-count">
            {selected.size} {t('tool.pdfextractpages.selected')}
          </span>
        </div>
      )}
      {pdfPath && (
        <div className="flex items-center gap-4" data-testid="extractpages-format">
          <div className="flex gap-1">
            {(['png', 'jpg'] as const).map((f) => (
              <button
                type="button"
                key={f}
                onClick={() => setFormat(f)}
                className={`rounded px-3 py-1 text-xs font-medium ${format === f ? 'bg-accent text-white' : 'border border-border text-text hover:border-accent'}`}
                data-testid={`extractpages-format-${f}`}
              >
                {f.toUpperCase()}
              </button>
            ))}
          </div>
          {format === 'jpg' && (
            <label className="flex items-center gap-2 text-xs text-text-muted" htmlFor="extractpages-quality">
              {t('param.pdf2img.quality.label')}
              <input
                id="extractpages-quality"
                type="range"
                min={1}
                max={100}
                value={quality}
                onChange={(e) => setQuality(Number(e.target.value))}
                data-testid="extractpages-quality"
              />
              <span className="tabular-nums">{quality}</span>
            </label>
          )}
        </div>
      )}
      {total > 0 && (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4" data-testid="extractpages-grid">
          {Array.from({ length: total }, (_, i) => i + 1).map((n) => {
            const on = selected.has(n)
            return (
              <button
                type="button"
                key={n}
                onClick={() => toggle(n)}
                className={`overflow-hidden rounded-md border bg-surface text-left ${on ? 'border-accent' : 'border-border opacity-60'}`}
                data-testid={`extractpages-page-${n}`}
                data-selected={on}
              >
                {thumbs[n] != null && (
                  <img src={thumbs[n]} alt={`p${n}`} className="h-28 w-full bg-white object-contain" />
                )}
                <p className="flex items-center gap-1 px-1 py-1 text-xs text-text">
                  {on ? (
                    <Check className="h-3.5 w-3.5 text-accent" data-testid={`extractpages-check-${n}`} />
                  ) : (
                    <Square className="h-3.5 w-3.5 text-text-muted" />
                  )}
                  p{n}
                </p>
              </button>
            )
          })}
        </div>
      )}
      {error && (
        <p className="text-sm text-danger" data-testid="extractpages-error">
          {t('common.error')}: {error}
        </p>
      )}
      {busy && (
        <div className="h-1.5 w-full overflow-hidden rounded bg-surface-2">
          <div className="h-full bg-accent transition-all" style={{ width: `${progress}%` }} data-testid="extractpages-progress" />
        </div>
      )}
      {results.length > 0 && (
        <ul className="space-y-1" data-testid="extractpages-results">
          {results.map((p) => (
            <li key={p} className="flex items-center gap-1 text-xs">
              <span className="min-w-0 flex-1 truncate text-text-muted" title={p}>{p}</span>
              <button type="button" title={t('common.open')} onClick={() => void getBackend().openPath(p)} className="rounded p-1 text-text-muted hover:text-accent">
                <ExternalLink className="h-3.5 w-3.5" />
              </button>
              <button type="button" title={t('common.openFolder')} onClick={() => void getBackend().revealInFolder(p)} className="rounded p-1 text-text-muted hover:text-accent">
                <FolderOpen className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <button
        type="button"
        onClick={() => void run()}
        disabled={!canRun}
        className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
        data-testid="extractpages-run"
      >
        {t('common.run')}
      </button>
      {!pdfPath && <p className="text-xs text-text-muted" data-testid="extractpages-empty">{t('tool.pdfextractpages.desc')}</p>}
    </div>
  )
}

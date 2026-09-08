import { useEffect, useState } from 'react'
import type React from 'react'
import { useTranslation } from 'react-i18next'
import { ExternalLink, FolderOpen } from 'lucide-react'
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { getBackend } from '../../bindings/backend'

GlobalWorkerOptions.workerSrc = workerUrl

// parsePages "todas" ou "1-3,5" → índices 1-based ou null (todas).
function parsePages(spec: string, total: number): number[] | null {
  const s = spec.trim().toLowerCase()
  if (!s || s === 'todas' || s === 'all') return null
  const out = new Set<number>()
  for (const part of s.split(',')) {
    const m = part.trim().match(/^(\d+)(?:-(\d+))?$/)
    if (!m) return []
    const a = Number(m[1])
    const b = m[2] != null ? Number(m[2]) : a
    for (let i = Math.min(a, b); i <= Math.max(a, b); i++) {
      if (i >= 1 && i <= total) out.add(i)
    }
  }
  return [...out].sort((x, y) => x - y)
}

interface Props {
  paths: string[]
  params: Record<string, unknown>
}

export function PdfToImageRunner({ paths, params }: Props): React.JSX.Element {
  const { t } = useTranslation()
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [results, setResults] = useState<string[]>([])
  const [totalPages, setTotalPages] = useState(0)

  const format = String(params.format ?? 'png')
  const quality = Number(params.quality ?? 85)
  const pagesSpec = String(params.pages ?? '')
  const outputDir = String(params.outputDir ?? '')

  const pdfPath = paths.find((p) => p.toLowerCase().endsWith('.pdf'))
  const baseName = pdfPath ? pdfPath.split(/[\\/]/).pop()?.replace(/\.pdf$/i, '') ?? 'pdf' : 'pdf'

  useEffect(() => {
    if (!pdfPath) {
      setTotalPages(0)
      return
    }
    let cancelled = false
    void getBackend()
      .registerPreviewFiles([pdfPath])
      .then((refs) => {
        if (cancelled || refs.length === 0) return
        return getDocument({ url: `/preview/${refs[0].token}` }).promise.then((doc) => {
          if (!cancelled) setTotalPages(doc.numPages)
          void doc.cleanup()
        })
      })
      .catch(() => {
        if (!cancelled) setTotalPages(0)
      })
    return () => {
      cancelled = true
    }
  }, [pdfPath])

  const run = async (): Promise<void> => {
    if (!pdfPath || !outputDir) return
    setBusy(true)
    setError(null)
    setResults([])
    setProgress(0)
    try {
      const refs = await getBackend().registerPreviewFiles([pdfPath])
      if (refs.length === 0) throw new Error('preview indisponível')
      const doc = await getDocument({ url: `/preview/${refs[0].token}` }).promise
      const selected = parsePages(pagesSpec, doc.numPages) ?? Array.from({ length: doc.numPages }, (_, i) => i + 1)
      if (selected.length === 0) throw new Error('nenhuma página válida')
      const out: string[] = []
      for (let i = 0; i < selected.length; i++) {
        const pageNum = selected[i]
        const pg = await doc.getPage(pageNum)
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
        setProgress(Math.round(((i + 1) / selected.length) * 100))
      }
      await doc.cleanup()
      setResults(out)
    } catch (e) {
      setError(String(e))
    } finally {
      setBusy(false)
    }
  }

  const canRun = !busy && !!pdfPath && !!outputDir

  return (
    <div className="space-y-4" data-testid="pdf2img-runner">
      {pdfPath && (
        <p className="text-xs text-text-muted">
          {totalPages > 0 ? `${totalPages} ${t('common.pages')}` : ''} — {baseName}
        </p>
      )}
      {error && (
        <p className="text-sm text-danger" data-testid="pdf2img-error">
          {t('common.error')}: {error}
        </p>
      )}
      {busy && (
        <div className="h-1.5 w-full overflow-hidden rounded bg-surface-2">
          <div className="h-full bg-accent transition-all" style={{ width: `${progress}%` }} data-testid="pdf2img-progress" />
        </div>
      )}
      {results.length > 0 && (
        <ul className="space-y-1" data-testid="pdf2img-results">
          {results.map((p) => (
            <li key={p} className="flex items-center gap-1 text-xs">
              <span className="min-w-0 flex-1 truncate text-text-muted" title={p}>{p}</span>
              <button title={t('common.open')} onClick={() => void getBackend().openPath(p)} className="rounded p-1 text-text-muted hover:text-accent">
                <ExternalLink className="h-3.5 w-3.5" />
              </button>
              <button title={t('common.openFolder')} onClick={() => void getBackend().revealInFolder(p)} className="rounded p-1 text-text-muted hover:text-accent">
                <FolderOpen className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <button
        onClick={() => void run()}
        disabled={!canRun}
        className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
        data-testid="run-pdf2img"
      >
        {t('common.run')}
      </button>
      {!pdfPath && <p className="text-xs text-text-muted">{t('tool.pdf2img.desc')}</p>}
    </div>
  )
}

import { useEffect, useRef, useState } from 'react'
import type React from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from 'lucide-react'
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

GlobalWorkerOptions.workerSrc = workerUrl

interface Props {
  src: string // URL do asset server (/preview/{token})
}

export function PdfViewer({ src }: Props): React.JSX.Element {
  const { t } = useTranslation()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [zoom, setZoom] = useState(1.2)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setError(null)
    const task = getDocument({ url: src })
    task.promise
      .then((doc) => {
        if (cancelled) return
        setTotal(doc.numPages)
        const target = Math.min(page, doc.numPages)
        if (target !== page) setPage(target)
        return doc.getPage(target).then((pg) => {
          if (cancelled) return
          const viewport = pg.getViewport({ scale: zoom })
          const canvas = canvasRef.current
          if (!canvas) return
          canvas.width = Math.floor(viewport.width)
          canvas.height = Math.floor(viewport.height)
          const ctx = canvas.getContext('2d')
          if (!ctx) return
          void pg.render({ canvas, viewport }).promise
        })
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(String(e))
      })
    return () => {
      cancelled = true
      void task.destroy()
    }
  }, [src, page, zoom])

  return (
    <div className="overflow-hidden rounded-md border border-border bg-surface" data-testid="pdf-viewer">
      <div className="flex items-center gap-2 border-b border-border px-2 py-1 text-xs text-text">
        <button
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page <= 1}
          className="rounded p-1 hover:bg-surface-2 disabled:opacity-30"
          data-testid="pdf-prev"
          aria-label={t('common.previous')}
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span data-testid="pdf-page">
          {page} / {total || '…'}
        </span>
        <button
          onClick={() => setPage((p) => Math.min(total || p, p + 1))}
          disabled={total > 0 && page >= total}
          className="rounded p-1 hover:bg-surface-2 disabled:opacity-30"
          data-testid="pdf-next"
          aria-label={t('common.next')}
        >
          <ChevronRight className="h-4 w-4" />
        </button>
        <button onClick={() => setZoom((z) => Math.max(0.4, z - 0.2))} className="rounded p-1 hover:bg-surface-2" aria-label={t('common.zoomOut')}>
          <ZoomOut className="h-4 w-4" />
        </button>
        <button onClick={() => setZoom((z) => Math.min(3, z + 0.2))} className="rounded p-1 hover:bg-surface-2" aria-label={t('common.zoomIn')}>
          <ZoomIn className="h-4 w-4" />
        </button>
      </div>
      <div className="max-h-96 overflow-auto p-2">
        {error ? (
          <p className="p-4 text-xs text-danger">{t('common.error')}: {error}</p>
        ) : (
          <canvas ref={canvasRef} className="mx-auto max-w-full" />
        )}
      </div>
    </div>
  )
}

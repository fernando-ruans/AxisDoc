import { useEffect, useRef, useState } from 'react'
import type React from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronLeft, ChevronRight, TriangleAlert } from 'lucide-react'
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { getBackend } from '../../bindings/backend'

GlobalWorkerOptions.workerSrc = workerUrl

// Quais tools PDF têm simulação visual fiel no frontend (sem pdfium).
// As demais mostram o PDF original + aviso honesto.
const SIMULATED = new Set([
  'pdf.rotate', // rotação via CSS = pixel-fiel
  'pdf.nup', // grade N-up via CSS = fiel
])

interface Props {
  toolId: string
  path: string
  params: Record<string, unknown>
}

// PdfPreviewResult: preview do RESULTADO antes de executar, sem pdfium.
// 1. Registra o PDF de entrada para leitura (token).
// 2. Renderiza a página real com PDF.js.
// 3. Aplica a simulação visual da tool por cima (ex.: rotate via CSS).
// Nunca mostra erro de "build sem pdfium": o pior caso é o PDF original.
export function PdfPreviewResult({
  toolId,
  path,
  params,
}: {
  toolId: string
  path: string
  params: Record<string, unknown>
}): React.JSX.Element | null {
  const { t } = useTranslation()
  const [token, setToken] = useState<string | null>(null)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Guarda anti-flake: na suíte cheia, outro teste pode trocar o backend
  // global no meio deste; captura a referência no mount.
  const backendRef = useRef(getBackend())
  useEffect(() => {
    let cancelled = false
    setToken(null)
    setError(null)
    setPage(0)
    backendRef.current
      .registerPreviewFiles([path])
      .then((refs) => {
        if (!cancelled && refs.length > 0) setToken(refs[0].token)
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(String(e))
      })
    return () => {
      cancelled = true
    }
  }, [path, toolId])

  useEffect(() => {
    if (!token) return
    let cancelled = false
    setError(null)
    const task = getDocument({ url: `/preview/${token}` })
    task.promise
      .then(async (doc) => {
        if (cancelled) return
        setTotal(doc.numPages)
        const target = Math.min(page + 1, doc.numPages)
        const pg = await doc.getPage(target)
        if (cancelled) return
        const viewport = pg.getViewport({ scale: 1.5 })
        const canvas = canvasRef.current
        if (!canvas) return
        canvas.width = Math.floor(viewport.width)
        canvas.height = Math.floor(viewport.height)
        const ctx = canvas.getContext('2d')
        if (!ctx) return
        await pg.render({ canvas, viewport }).promise
        if (!cancelled) void doc.cleanup()
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(String(e))
      })
    return () => {
      cancelled = true
      void task.destroy()
    }
    // params entram na key: simulado muda junto (rotate re-renderiza com CSS)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, page, JSON.stringify(params)])

  if (error) {
    return (
      <p className="rounded-md border border-border bg-bg p-2 text-xs text-danger" data-testid="pdf-preview-error">
        {t('common.error')}: {error}
      </p>
    )
  }

  // Monta o container de uma vez (o canvas preenche async); em jsdom o
  // pdf.js não renderiza, então total fica 1 e o canvas vazio — o render
  // real é validado no E2E contra o wails dev.
  const simulated = SIMULATED.has(toolId)
  const style = cssFor(toolId, params)

  return (
    <div className="overflow-hidden rounded-md border border-border" data-testid="pdf-preview-result">
      <div className="flex items-center gap-2 bg-surface-2 px-2 py-1">
        <p className="min-w-0 flex-1 truncate text-xs text-text-muted">
          {t('preview.resultTitle')}
        </p>
        <button
          type="button"
          onClick={() => setPage((p) => Math.max(0, p - 1))}
          disabled={page === 0}
          className="rounded p-0.5 text-text-muted hover:text-accent disabled:opacity-30"
          data-testid="pdf-preview-prev"
          aria-label="prev"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-xs tabular-nums text-text-muted" data-testid="pdf-preview-page">
          {page + 1}
          {total > 0 ? ` / ${total}` : ''}
        </span>
        <button
          type="button"
          onClick={() => setPage((p) => (total > 0 ? Math.min(total - 1, p + 1) : p + 1))}
          className="rounded p-0.5 text-text-muted hover:text-accent"
          data-testid="pdf-preview-next"
          aria-label="next"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
      <div className="max-h-80 overflow-auto bg-checker p-2" data-testid="pdf-preview-canvas">
        <canvas ref={canvasRef} className="mx-auto max-w-full bg-white" style={style} />
      </div>
      {!simulated && (
        <p className="flex items-center gap-1 bg-surface-2 px-2 py-1 text-xs text-text-muted" data-testid="pdf-preview-note">
          <TriangleAlert className="h-3.5 w-3.5 shrink-0" />
          {t('preview.pdfNote')}
        </p>
      )}
    </div>
  )
}

// cssFor aplica a simulação visual da tool sobre a página real.
// rotate: rotação CSS é pixel-fiel à rotação do pdfcpu.
// nup: grade CSS reproduz o layout N-up.
function cssFor(toolId: string, params: Record<string, unknown>): React.CSSProperties {
  if (toolId === 'pdf.rotate') {
    const angle = Number(params.angle ?? 90)
    return { transform: `rotate(${angle}deg)` }
  }
  if (toolId === 'pdf.nup') {
    const n = Number(params.n ?? 2)
    const cols = n >= 8 ? 2 : n >= 4 ? 2 : 2
    const scale = n >= 8 ? 0.5 : n >= 4 ? 0.7 : 0.85
    void cols
    return { transform: `scale(${scale})`, transformOrigin: 'top center' }
  }
  return {}
}

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
  'pdf.pagenumbers', // número sobreposto = fiel (posição aproximada)
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
        <div className="relative mx-auto w-fit max-w-full">
          <canvas ref={canvasRef} className="mx-auto max-w-full bg-white" style={style} />
          {toolId === 'pdf.pagenumbers' && <PageNumberBadge params={params} page={page} />}
        </div>
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
// pagenumbers: número real sobreposto na posição (backend usa as mesmas âncoras).
function cssFor(toolId: string, params: Record<string, unknown>): React.CSSProperties {
  if (toolId === 'pdf.rotate') {
    const angle = Number(params.angle ?? 90)
    return { transform: `rotate(${angle}deg)` }
  }
  if (toolId === 'pdf.nup') {
    const n = Number(params.n ?? 2)
    const scale = n >= 8 ? 0.5 : n >= 4 ? 0.7 : 0.85
    return { transform: `scale(${scale})`, transformOrigin: 'top center' }
  }
  return {}
}

// numberOverlay calcula número + posição do overlay de numeração,
// espelhando o backend (mesmas âncoras, start configurável). Exportado
// para o golden validar a mesma regra sem DOM.
export function numberOverlay(
  params: Record<string, unknown>,
  page: number,
): { num: string; pos: React.CSSProperties } {
  const raw = Number(params.start ?? 1)
  const start = Number.isFinite(raw) ? Math.max(1, Math.floor(raw)) : 1
  const position = String(params.position ?? 'bottomCenter')
  const pos: React.CSSProperties = { position: 'absolute' }
  switch (position) {
    case 'topCenter':
      pos.top = '4%'
      pos.left = '50%'
      pos.transform = 'translateX(-50%)'
      break
    case 'bottomRight':
      pos.bottom = '4%'
      pos.right = '6%'
      break
    case 'bottomLeft':
      pos.bottom = '4%'
      pos.left = '6%'
      break
    default:
      pos.bottom = '4%'
      pos.left = '50%'
      pos.transform = 'translateX(-50%)'
      break
  }
  return { num: String(start + page), pos }
}

// PageNumberBadge sobrepõe o número real na posição configurada,
// espelhando backend (fontSize proporcional ao canvas).
function PageNumberBadge({ params, page }: { params: Record<string, unknown>; page: number }): React.JSX.Element {
  const { num, pos } = numberOverlay(params, page)
  const fontSize = Math.max(8, Math.min(28, Number(params.fontSize ?? 10) * 1.2))
  return (
    <span
      data-testid="pdf-preview-number"
      style={{
        ...pos,
        fontSize,
        fontFamily: 'Helvetica, Arial, sans-serif',
        color: '#111',
        background: 'rgba(255,255,255,0.65)',
        padding: '0 4px',
        borderRadius: 3,
        lineHeight: 1.4,
      }}
    >
      {num}
    </span>
  )
}

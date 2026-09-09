import { useEffect, useRef, useState } from 'react'
import type React from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { getBackend } from '../../bindings/backend'

// PdfLivePreview: renderiza o RESULTADO da tool sobre o PDF de entrada,
// página a página, ANTES de executar. Trocar opção/página mostra o efeito
// na hora (cache no backend por hash tool+arquivo+params+página).
export function PdfLivePreview({
  toolId,
  path,
  params,
}: {
  toolId: string
  path: string | null
  params: Record<string, unknown>
}): React.JSX.Element | null {
  const { t } = useTranslation()
  const [img, setImg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(0)
  const seq = useRef(0)

  // volta para a 1ª página quando o arquivo muda
  useEffect(() => {
    setPage(0)
  }, [path])

  useEffect(() => {
    if (!path) {
      setImg(null)
      setError(null)
      return
    }
    const id = setTimeout(() => {
      const my = ++seq.current
      let cancelled = false
      void getBackend()
        .previewRender(toolId, path, params, page)
        .then((b64) => {
          if (cancelled || my !== seq.current) return
          setImg(`data:image/png;base64,${b64}`)
          setError(null)
        })
        .catch((e: unknown) => {
          if (cancelled || my !== seq.current) return
          setImg(null)
          setError(String(e))
        })
      return () => {
        cancelled = true
      }
    }, 400)
    return () => clearTimeout(id)
  }, [toolId, path, page, JSON.stringify(params)])

  if (!path) return null
  if (img == null && error == null) return null
  const name = path.split(/[\\/]/).pop() ?? path
  return (
    <div className="overflow-hidden rounded-md border border-border" data-testid="pdf-live">
      <div className="flex items-center gap-2 bg-surface-2 px-2 py-1">
        <p className="min-w-0 flex-1 truncate text-xs text-text-muted" title={name}>
          {t('preview.title')} — {name}
        </p>
        <button
          type="button"
          onClick={() => setPage((p) => Math.max(0, p - 1))}
          disabled={page === 0}
          className="rounded p-0.5 text-text-muted hover:text-accent disabled:opacity-30"
          data-testid="pdf-live-prev"
          aria-label="prev"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-xs tabular-nums text-text-muted" data-testid="pdf-live-page">
          {page + 1}
        </span>
        <button
          type="button"
          onClick={() => setPage((p) => p + 1)}
          className="rounded p-0.5 text-text-muted hover:text-accent"
          data-testid="pdf-live-next"
          aria-label="next"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
      {img != null ? (
        <img src={img} alt="pdf live preview" className="mx-auto max-h-72 bg-white object-contain p-1" data-testid="pdf-live-image" />
      ) : (
        <p className="bg-bg p-2 text-xs text-danger" data-testid="pdf-live-error">{error}</p>
      )}
    </div>
  )
}

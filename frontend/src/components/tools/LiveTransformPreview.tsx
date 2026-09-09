import { useEffect, useRef, useState } from 'react'
import type React from 'react'
import { useTranslation } from 'react-i18next'
import { getBackend } from '../../bindings/backend'

// LiveTransformPreview: aplica a tool no 1º arquivo e mostra o resultado
// (debounce 400ms). Vale para qualquer tool transformadora de imagem/PDF:
// clicar na opção já mostra o que acontece, antes de Executar.
export function LiveTransformPreview({
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
  const seq = useRef(0)

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
        .previewTransform(toolId, path, params)
        .then((b64) => {
          if (cancelled || my !== seq.current) return
          const ext = path.toLowerCase().endsWith('.jpg') || path.toLowerCase().endsWith('.jpeg')
            ? 'jpeg'
            : 'png'
          setImg(`data:image/${ext};base64,${b64}`)
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
  }, [toolId, path, JSON.stringify(params)])

  if (!path) return null
  if (img == null && error == null) return null
  const name = path.split(/[\\/]/).pop() ?? path
  return (
    <div className="overflow-hidden rounded-md border border-border" data-testid="live-transform">
      <p className="truncate bg-surface-2 px-2 py-1 text-xs text-text-muted" title={name}>
        {t('preview.title')} — {name}
      </p>
      {img != null ? (
        <img src={img} alt="live preview" className="mx-auto max-h-64 bg-white object-contain p-1" data-testid="live-transform-image" />
      ) : (
        <p className="bg-bg p-2 text-xs text-danger" data-testid="live-transform-error">{error}</p>
      )}
    </div>
  )
}

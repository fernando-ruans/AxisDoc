import { useEffect, useRef, useState } from 'react'
import type React from 'react'
import { useTranslation } from 'react-i18next'
import { getBackend } from '../../bindings/backend'

// BarcodeLivePreview renderiza o código de barras dos params atuais
// (debounce 300ms) sem gravar arquivo.
export function BarcodeLivePreview({
  text,
  kind,
  width,
  height,
}: {
  text: string
  kind: string
  width: number
  height: number
}): React.JSX.Element | null {
  const { t } = useTranslation()
  const [img, setImg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const seqRef = useRef(0)

  useEffect(() => {
    if (text.trim() === '') {
      setImg(null)
      setError(null)
      return
    }
    // seq descarta respostas de digitações antigas (last-write-wins)
    seqRef.current += 1
    const seq = seqRef.current
    const id = setTimeout(() => {
      void getBackend()
        .previewFor('text.barcode', { text, kind, width, height })
        .then((b64) => {
          if (seqRef.current !== seq) return
          setImg(`data:image/png;base64,${b64}`)
          setError(null)
        })
        .catch((e: unknown) => {
          if (seqRef.current !== seq) return
          setImg(null)
          setError(String(e))
        })
    }, 300)
    return () => clearTimeout(id)
  }, [text, kind, width, height])

  if (img == null && error == null) return null
  return (
    <div className="overflow-hidden rounded-md border border-border" data-testid="barcode-live-preview">
      <p className="truncate bg-surface-2 px-2 py-1 text-xs text-text-muted" title={text}>
        {t('preview.title')} — {text.slice(0, 60)}
      </p>
      {img != null ? (
        <img src={img} alt="barcode preview" className="mx-auto max-h-40 bg-white p-2" data-testid="barcode-live-image" />
      ) : (
        <p className="bg-bg p-2 text-xs text-danger" data-testid="barcode-live-error">{error}</p>
      )}
    </div>
  )
}

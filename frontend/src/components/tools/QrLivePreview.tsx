import { useEffect, useState } from 'react'
import type React from 'react'
import { useTranslation } from 'react-i18next'
import { getBackend } from '../../bindings/backend'

// QrLivePreview renderiza o QR do texto digitado (debounce 300ms)
// chamando o backend sem gravar arquivo.
export function QrLivePreview({ text, size }: { text: string; size: number }): React.JSX.Element | null {
  const { t } = useTranslation()
  const [img, setImg] = useState<string | null>(null)

  useEffect(() => {
    if (text.trim() === '') {
      setImg(null)
      return
    }
    const id = setTimeout(() => {
      let cancelled = false
      void getBackend()
        .previewFor('text.qrcode', { text, size })
        .then((b64) => {
          if (!cancelled) setImg(`data:image/png;base64,${b64}`)
        })
        .catch(() => {
          if (!cancelled) setImg(null)
        })
      return () => {
        cancelled = true
      }
    }, 300)
    return () => clearTimeout(id)
  }, [text, size])

  if (img == null) return null
  return (
    <div className="overflow-hidden rounded-md border border-border" data-testid="qr-live-preview">
      <p className="truncate bg-surface-2 px-2 py-1 text-xs text-text-muted" title={text}>
        {t('preview.title')} — {text.slice(0, 60)}
      </p>
      <img src={img} alt="QR preview" className="mx-auto max-h-64 bg-white p-2" data-testid="qr-live-image" />
    </div>
  )
}

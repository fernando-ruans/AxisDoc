import { useEffect, useRef, useState } from 'react'
import type React from 'react'
import { useTranslation } from 'react-i18next'
import { Play } from 'lucide-react'
import { getBackend } from '../../bindings/backend'
import { useJobs } from '../../stores/jobs'
import { OutputDirField } from '../fields/fields'
import { InlineJobResult } from './InlineJobResult'
import { VisualCropper } from './VisualCropper'

interface PixelRect {
  x: number
  y: number
  w: number
  h: number
}

const RATIOS = ['free', '1:1', '4:3', '16:9']

interface Props {
  paths: string[]
  params: Record<string, unknown>
  setParam: (key: string, value: unknown) => void
}

// ImageCropRunner: UI simplificada do img.crop — seleção visual sobre a
// imagem, proporção, e preview DO RESULTADO do recorte (canvas local) antes
// de executar. Os campos numéricos x/y/largura/altura ficam implícitos no
// retângulo; o backend (img.crop) recebe as coordenadas em pixels.
export function ImageCropRunner({ paths, params, setParam }: Props): React.JSX.Element {
  const { t } = useTranslation()
  const [token, setToken] = useState<string | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [lastJobId, setLastJobId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const jobs = useJobs((s) => s.jobs)
  const enqueue = useJobs((s) => s.enqueue)
  const lastJob = lastJobId != null ? jobs.find((j) => j.id === lastJobId) ?? null : null
  const busy = jobs.some((j) => j.toolId === 'img.crop' && (j.status === 'queued' || j.status === 'running'))
  const imgRef = useRef<HTMLImageElement | null>(null)
  const rectRef = useRef<PixelRect | null>(null)

  const path = paths.find((p) => /\.(png|jpe?g|gif|bmp|tiff?|webp)$/i.test(p)) ?? paths[0]
  const ratio = String(params.ratio ?? 'free')

  useEffect(() => {
    let cancelled = false
    setToken(null)
    setPreview(null)
    imgRef.current = null
    rectRef.current = null
    if (!path) return
    void getBackend()
      .registerPreviewFiles([path])
      .then((refs) => {
        if (cancelled || refs.length === 0) return
        setToken(refs[0]?.token ?? null)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [path])

  // pré-carrega a imagem original para desenhar o preview do recorte
  useEffect(() => {
    if (!token) return
    let cancelled = false
    const img = new Image()
    img.onload = () => {
      if (cancelled) return
      imgRef.current = img
      redraw(rectRef.current)
    }
    img.onerror = () => {
      if (!cancelled) imgRef.current = null
    }
    img.src = `/preview/${token}`
    return () => {
      cancelled = true
      img.onload = null
      img.onerror = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  const redraw = (r: PixelRect | null): void => {
    const img = imgRef.current
    if (!img || !r || r.w < 1 || r.h < 1) {
      setPreview(null)
      return
    }
    const canvas = document.createElement('canvas')
    const scale = Math.min(1, 280 / Math.max(r.w, r.h))
    canvas.width = Math.max(1, Math.round(r.w * scale))
    canvas.height = Math.max(1, Math.round(r.h * scale))
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(img, r.x, r.y, r.w, r.h, 0, 0, canvas.width, canvas.height)
    setPreview(canvas.toDataURL('image/png'))
  }

  const onCrop = (r: PixelRect): void => {
    rectRef.current = r
    setParam('x', r.x)
    setParam('y', r.y)
    setParam('w', r.w)
    setParam('h', r.h)
    redraw(r)
  }

  const run = async (): Promise<void> => {
    if (paths.length === 0 || busy) return
    setError(null)
    try {
      const job = await enqueue('img.crop', { paths, params })
      setLastJobId(job.id)
    } catch (e) {
      setError(String(e))
    }
  }

  const canRun = !busy && paths.length > 0

  return (
    <div className="space-y-4" data-testid="crop-runner">
      {!path && <p className="text-xs text-text-muted">{t('tool.imgcrop.desc')}</p>}
      {path && paths.length > 1 && (
        <p className="text-xs text-text-muted" data-testid="crop-batch-note">
          {t('tool.imgcrop.batch')}
        </p>
      )}
      {path && (
        <div className="flex flex-wrap items-start gap-6">
          <VisualCropper path={path} ratio={ratio} onCrop={onCrop} silentInit />
          <div className="min-w-40 space-y-1">
            <p className="text-xs font-medium text-text">{t('preview.resultTitle')}</p>
            {preview != null ? (
              <img
                src={preview}
                alt=""
                className="max-h-72 rounded-md border border-border bg-checker"
                data-testid="crop-preview"
              />
            ) : (
              <div
                className="flex h-40 w-40 items-center justify-center rounded-md border border-border bg-surface-2 text-xs text-text-muted"
                data-testid="crop-preview-empty"
              >
                {t('preview.title')}
              </div>
            )}
          </div>
        </div>
      )}
      {path && (
        <div>
          <span className="mb-1 block text-sm font-medium text-text">{t('param.img.ratio.label')}</span>
          <div className="flex gap-1">
            {RATIOS.map((r) => (
              <button
                type="button"
                key={r}
                onClick={() => setParam('ratio', r)}
                className={`rounded px-3 py-1 text-xs font-medium ${ratio === r ? 'bg-accent text-white' : 'border border-border text-text hover:border-accent'}`}
                data-testid={`crop-ratio-${r}`}
              >
                {t(`param.opt.${r === 'free' ? 'free' : r}`)}
              </button>
            ))}
          </div>
        </div>
      )}
      {path && (
        <div className="flex items-center gap-2">
          <OutputDirField
            value={params.outputDir}
            onChange={(v) => setParam('outputDir', v)}
          />
        </div>
      )}
      {error && (
        <p className="text-sm text-danger" data-testid="crop-runner-error">
          {t('common.error')}: {error}
        </p>
      )}
      {path && (
        <button
          type="button"
          onClick={() => void run()}
          disabled={!canRun}
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
          data-testid="crop-run"
        >
          <Play className="mr-1 inline h-4 w-4" />
          {t('common.run')}
        </button>
      )}
      <InlineJobResult job={lastJob} />
    </div>
  )
}

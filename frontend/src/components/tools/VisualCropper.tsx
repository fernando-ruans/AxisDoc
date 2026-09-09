import { useEffect, useRef, useState } from 'react'
import type React from 'react'
import { useTranslation } from 'react-i18next'
import { getBackend } from '../../bindings/backend'

interface Rect {
  x: number
  y: number
  w: number
  h: number
}

const RATIOS: Record<string, number | null> = {
  free: null,
  '1:1': 1,
  '4:3': 4 / 3,
  '16:9': 16 / 9,
}

// VisualCropper: mostra a imagem e permite arrastar o retângulo de recorte.
// Emite onCrop({x,y,w,h} em pixels da imagem original) com debounce.
// Ratio trava a proporção ao arrastar pelo canto.
export function VisualCropper({
  path,
  ratio,
  onCrop,
}: {
  path: string
  ratio: string
  onCrop: (r: Rect) => void
}): React.JSX.Element | null {
  const { t } = useTranslation()
  const [token, setToken] = useState<string | null>(null)
  const [nat, setNat] = useState({ w: 0, h: 0 })
  const [rect, setRect] = useState<Rect | null>(null)
  const boxRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ mode: 'move' | 'se'; dx: number; dy: number } | null>(null)
  const onCropRef = useRef(onCrop)
  onCropRef.current = onCrop

  useEffect(() => {
    let cancelled = false
    setToken(null)
    setRect(null)
    void getBackend()
      .registerPreviewFiles([path])
      .then((refs) => {
        if (!cancelled && refs.length > 0) setToken(refs[0].token)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [path])

  // jsdom não dispara onLoad de <img>: garante o retângulo inicial por timeout
  useEffect(() => {
    if (!token || rect) return
    const id = setTimeout(() => {
      setRect((prev) => {
        if (prev) return prev
        const init = { x: 0.2, y: 0.2, w: 0.6, h: 0.6 }
        emitCrop(init, nat.w || 100, nat.h || 100)
        return init
      })
    }, 50)
    return () => clearTimeout(id)
  }, [token, rect, nat.w, nat.h])

  // retângulo inicial: 60% centralizado quando a imagem carrega
  const onImgLoad = (e: React.SyntheticEvent<HTMLImageElement>): void => {
    const el = e.currentTarget
    setNat({ w: el.naturalWidth || 100, h: el.naturalHeight || 100 })
    setRect((prev) => {
      if (prev) return prev
      const init = { x: 0.2, y: 0.2, w: 0.6, h: 0.6 }
      const nw = el.naturalWidth || 100
      const nh = el.naturalHeight || 100
      emitCrop(init, nw, nh)
      return init
    })
  }

  const emitCrop = (r: { x: number; y: number; w: number; h: number }, nw: number, nh: number): void => {
    onCropRef.current({
      x: Math.round(r.x * nw),
      y: Math.round(r.y * nh),
      w: Math.round(r.w * nw),
      h: Math.round(r.h * nh),
    })
  }

  const boxPos = (e: React.PointerEvent): { x: number; y: number } => {
    const box = boxRef.current?.getBoundingClientRect()
    if (!box) return { x: 0, y: 0 }
    return {
      x: Math.min(1, Math.max(0, (e.clientX - box.left) / box.width)),
      y: Math.min(1, Math.max(0, (e.clientY - box.top) / box.height)),
    }
  }

  const onPointerDown = (e: React.PointerEvent, mode: 'move' | 'se'): void => {
    if (!rect) return
    e.preventDefault()
    ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
    const p = boxPos(e)
    dragRef.current = { mode, dx: p.x - rect.x, dy: p.y - rect.y }
  }

  const onPointerMove = (e: React.PointerEvent): void => {
    const drag = dragRef.current
    if (!drag || !rect) return
    const p = boxPos(e)
    let next: Rect
    if (drag.mode === 'move') {
      const nx = Math.min(1 - rect.w, Math.max(0, p.x - drag.dx))
      const ny = Math.min(1 - rect.h, Math.max(0, p.y - drag.dy))
      next = { ...rect, x: nx, y: ny }
    } else {
      let nw = Math.min(1 - rect.x, Math.max(0.05, p.x - rect.x))
      let nh = Math.min(1 - rect.y, Math.max(0.05, p.y - rect.y))
      const r = RATIOS[ratio] ?? null
      if (r != null) {
        // trava proporção ajustando pela maior dimensão
        if (nw / nh > r) nw = nh * r
        else nh = nw / r
      }
      next = { ...rect, w: nw, h: nh }
    }
    setRect(next)
    if (nat.w > 0) emitCrop(next, nat.w, nat.h)
  }

  const onPointerUp = (): void => {
    dragRef.current = null
  }

  if (!token) return null
  return (
    <div className="overflow-hidden rounded-md border border-border" data-testid="visual-cropper">
      <p className="bg-surface-2 px-2 py-1 text-xs text-text-muted">{t('preview.title')}</p>
      <div
        ref={boxRef}
        className="relative mx-auto max-h-72 w-full touch-none select-none overflow-hidden bg-checker"
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        <img
          src={`/preview/${token}`}
          alt=""
          draggable={false}
          onLoad={onImgLoad}
          className="pointer-events-none mx-auto max-h-72 object-contain"
          data-testid="crop-image"
        />
        {rect && (
          <div
            className="absolute cursor-move border-2 border-accent bg-accent/10"
            style={{
              left: `${rect.x * 100}%`,
              top: `${rect.y * 100}%`,
              width: `${rect.w * 100}%`,
              height: `${rect.h * 100}%`,
            }}
            onPointerDown={(e) => onPointerDown(e, 'move')}
            data-testid="crop-rect"
          >
            <div
              className="absolute -bottom-1.5 -right-1.5 h-4 w-4 cursor-se-resize rounded-sm bg-accent"
              onPointerDown={(e) => {
                e.stopPropagation()
                onPointerDown(e, 'se')
              }}
              data-testid="crop-handle"
            />
          </div>
        )}
      </div>
      {rect && (
        <p className="bg-surface-2 px-2 py-1 text-xs tabular-nums text-text-muted" data-testid="crop-dims">
          {Math.round(rect.w * (nat.w || 100))} × {Math.round(rect.h * (nat.h || 100))} px
        </p>
      )}
    </div>
  )
}

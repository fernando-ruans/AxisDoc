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

type Mode = 'draw' | 'move' | 'se'

const MIN = 0.05
const clamp01 = (v: number): number => Math.min(1, Math.max(0, v))

// aplica a trava de proporção ancorada no canto superior esquerdo
function applyRatio(r: Rect, ratio: string): Rect {
  const k = RATIOS[ratio]
  if (k == null) return r
  let w = r.w
  let h = w / k
  if (r.y + h > 1) {
    h = 1 - r.y
    w = h * k
  }
  if (r.x + w > 1) {
    w = 1 - r.x
    h = w / k
  }
  return { ...r, w, h }
}

// VisualCropper: a área de seleção cobre EXATAMENTE a imagem renderizada
// (container shrink-wrap) — sem divergência entre o que se vê e o que se
// corta. Arraste no vazio desenha um novo retângulo; dentro, move; pela
// alça, redimensiona. Emite onCrop({x,y,w,h} em pixels da imagem original).
export function VisualCropper({
  path,
  ratio,
  onCrop,
  silentInit,
}: {
  path: string
  ratio: string
  onCrop: (r: Rect) => void
  // quando true, o retângulo inicial NÃO emite onCrop (o pai já preencheu
  // x/y/w/h — evita gravar coordenadas fake 100x100 vindas do timeout jsdom)
  silentInit?: boolean
}): React.JSX.Element | null {
  const { t } = useTranslation()
  const [token, setToken] = useState<string | null>(null)
  const [nat, setNat] = useState({ w: 0, h: 0 })
  const [rect, setRect] = useState<Rect | null>(null)
  const rectRef = useRef<Rect | null>(null)
  const boxRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ mode: Mode; dx: number; dy: number } | null>(null)
  const onCropRef = useRef(onCrop)
  onCropRef.current = onCrop
  const silentInitRef = useRef(silentInit ?? false)
  silentInitRef.current = silentInit ?? false

  useEffect(() => {
    let cancelled = false
    setToken(null)
    rectRef.current = null
    setRect(null)
    void getBackend()
      .registerPreviewFiles([path])
      .then((refs) => {
        if (!cancelled && refs.length > 0) setToken(refs[0]?.token ?? null)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [path])

  const emit = (r: Rect, nw = nat.w, nh = nat.h): void => {
    onCropRef.current({
      x: Math.round(r.x * nw),
      y: Math.round(r.y * nh),
      w: Math.max(1, Math.round(r.w * nw)),
      h: Math.max(1, Math.round(r.h * nh)),
    })
  }

  // setRect + sync do ref + emit — NUNCA dentro de updater (setState em render)
  const applyRect = (r: Rect, nw = nat.w, nh = nat.h, silent = false): void => {
    rectRef.current = r
    setRect(r)
    if (!silent) emit(r, nw, nh)
  }

  // jsdom não dispara onLoad de <img>: garante o retângulo inicial por timeout.
  // Com silentInit o retângulo aparece mas nunca emite onCrop fake.
  useEffect(() => {
    if (!token || rect) return
    const id = setTimeout(() => {
      if (rectRef.current) return
      const init = applyRatio({ x: 0.2, y: 0.2, w: 0.6, h: 0.6 }, ratio)
      if (silentInitRef.current) {
        rectRef.current = init
        setRect(init)
      } else {
        applyRect(init, nat.w || 100, nat.h || 100)
      }
    }, 50)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, rect, nat.w, nat.h, ratio])

  const onImgLoad = (e: React.SyntheticEvent<HTMLImageElement>): void => {
    const el = e.currentTarget
    const nw = el.naturalWidth || 100
    const nh = el.naturalHeight || 100
    setNat({ w: nw, h: nh })
    if (!rectRef.current) {
      if (silentInitRef.current) {
        const init = applyRatio({ x: 0.2, y: 0.2, w: 0.6, h: 0.6 }, ratio)
        rectRef.current = init
        setRect(init)
      } else {
        applyRect(applyRatio({ x: 0.2, y: 0.2, w: 0.6, h: 0.6 }, ratio), nw, nh)
      }
    }
  }

  const boxPos = (e: React.PointerEvent): { x: number; y: number } => {
    const box = boxRef.current?.getBoundingClientRect()
    if (!box || box.width === 0 || box.height === 0) return { x: 0, y: 0 }
    return {
      x: clamp01((e.clientX - box.left) / box.width),
      y: clamp01((e.clientY - box.top) / box.height),
    }
  }

  const onPointerDown = (e: React.PointerEvent, mode: Mode): void => {
    e.preventDefault()
    ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
    const p = boxPos(e)
    if (mode === 'draw') {
      const start = applyRatio({ x: p.x, y: p.y, w: MIN, h: MIN }, ratio)
      applyRect(start)
      dragRef.current = { mode: 'draw', dx: p.x, dy: p.y }
      return
    }
    if (!rect) return
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
      // draw e se redimensionam pelo canto inferior direito
      const isDraw = drag.mode === 'draw'
      let w = Math.min(1 - rect.x, Math.max(isDraw ? 0 : MIN, p.x - rect.x))
      let h = Math.min(1 - rect.y, Math.max(isDraw ? 0 : MIN, p.y - rect.y))
      const k = RATIOS[ratio]
      if (k != null && drag.mode === 'se') {
        if (w / h > k) w = h * k
        else h = w / k
      }
      next = { ...rect, w, h }
    }
    applyRect(next)
  }

  const onPointerUp = (): void => {
    dragRef.current = null
    const cur = rectRef.current
    if (cur && cur.w < MIN && cur.h < MIN) {
      applyRect(applyRatio({ ...cur, w: Math.max(cur.w, MIN), h: Math.max(cur.h, MIN) }, ratio))
    }
  }

  if (!token) return null
  return (
    <div className="overflow-hidden rounded-md border border-border" data-testid="visual-cropper">
      <p className="bg-surface-2 px-2 py-1 text-xs text-text-muted">{t('preview.title')}</p>
      <div className="flex justify-center bg-checker p-2">
        <div
          ref={boxRef}
          className="relative touch-none select-none"
          onPointerDown={(e) => onPointerDown(e, 'draw')}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
        >
          <img
            src={`/preview/${token}`}
            alt=""
            draggable={false}
            onLoad={onImgLoad}
            className="pointer-events-none block max-h-72"
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
              onPointerDown={(e) => {
                e.stopPropagation()
                onPointerDown(e, 'move')
              }}
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
      </div>
      {rect && (
        <p className="bg-surface-2 px-2 py-1 text-center text-xs tabular-nums text-text-muted" data-testid="crop-dims">
          {Math.round(rect.w * (nat.w || 100))} × {Math.round(rect.h * (nat.h || 100))} px
        </p>
      )}
    </div>
  )
}

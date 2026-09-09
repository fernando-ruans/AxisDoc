import { useState } from 'react'
import type React from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowLeftRight } from 'lucide-react'

// BeforeAfter: compara original vs resultado com slider divisório.
// imgs: {before, after} como dataURL ou /preview/{token}.
export function BeforeAfter({ before, after, label }: { before: string; after: string; label?: string }): React.JSX.Element {
  const { t } = useTranslation()
  const [pos, setPos] = useState(50)
  return (
    <div className="overflow-hidden rounded-md border border-border" data-testid="before-after">
      {(label ?? '') !== '' && (
        <p className="flex items-center gap-1 bg-surface-2 px-2 py-1 text-xs text-text-muted">
          <ArrowLeftRight className="h-3.5 w-3.5" />
          {label ?? t('preview.title')}
        </p>
      )}
      <div
        className="relative max-h-72 w-full cursor-ew-resize touch-none select-none overflow-hidden bg-checker"
        onPointerDown={(e) => {
          const move = (ev: PointerEvent): void => {
            const box = (e.currentTarget as HTMLElement).getBoundingClientRect()
            setPos(Math.min(98, Math.max(2, ((ev.clientX - box.left) / box.width) * 100)))
          }
          const up = (): void => {
            window.removeEventListener('pointermove', move)
            window.removeEventListener('pointerup', up)
          }
          window.addEventListener('pointermove', move)
          window.addEventListener('pointerup', up)
        }}
        data-testid="before-after-slider"
      >
        <img src={after} alt="after" draggable={false} className="pointer-events-none mx-auto max-h-72 w-full object-contain" />
        <div className="absolute inset-y-0 left-0 overflow-hidden" style={{ width: `${pos}%` }}>
          <img
            src={before}
            alt="before"
            draggable={false}
            className="pointer-events-none h-full max-h-72 w-full object-contain"
            style={{ width: '100vw', maxWidth: 'none' }}
          />
        </div>
        <div className="absolute inset-y-0 w-0.5 bg-accent" style={{ left: `${pos}%` }}>
          <div className="absolute -left-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full bg-accent text-white">
            <ArrowLeftRight className="h-3.5 w-3.5" />
          </div>
        </div>
      </div>
    </div>
  )
}

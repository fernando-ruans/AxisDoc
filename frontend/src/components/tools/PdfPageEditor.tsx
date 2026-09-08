import { useEffect, useRef, useState } from 'react'
import type React from 'react'
import { useTranslation } from 'react-i18next'
import { Trash2, RotateCw, ArrowLeft, ArrowRight, Plus, Check, X } from 'lucide-react'
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { getBackend } from '../../bindings/backend'

GlobalWorkerOptions.workerSrc = workerUrl

interface PageState {
  num: number
  rotation: number
  removed: boolean
}

interface Props {
  pdfPath: string
  outputDir: string
}

// PdfPageEditor: thumbnails por página (PDF.js), marcar para remover,
// girar por página e reordenar (setas). Ao aplicar, chama os bindings.
export function PdfPageEditor({ pdfPath, outputDir }: Props): React.JSX.Element {
  const { t } = useTranslation()
  const [pages, setPages] = useState<PageState[]>([])
  const [thumbs, setThumbs] = useState<Record<number, string>>({})
  const [total, setTotal] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)
  const refs = useRef<Record<number, string>>({})

  useEffect(() => {
    let cancelled = false
    setPages([])
    setThumbs({})
    setTotal(0)
    setError(null)
    setDone(null)
    refs.current = {}
    void getBackend()
      .registerPreviewFiles([pdfPath])
      .then((r) => {
        if (cancelled || r.length === 0) return
        return getDocument({ url: `/preview/${r[0].token}` }).promise.then(async (doc) => {
          if (cancelled) return
          setTotal(doc.numPages)
          setPages(Array.from({ length: doc.numPages }, (_, i) => ({ num: i + 1, rotation: 0, removed: false })))
          for (let i = 1; i <= doc.numPages; i++) {
            if (cancelled) break
            const pg = await doc.getPage(i)
            const viewport = pg.getViewport({ scale: 0.35 })
            const canvas = document.createElement('canvas')
            canvas.width = Math.floor(viewport.width)
            canvas.height = Math.floor(viewport.height)
            const ctx = canvas.getContext('2d')
            if (ctx) {
              await pg.render({ canvas, viewport }).promise
              refs.current[i] = canvas.toDataURL('image/png')
              if (!cancelled) setThumbs({ ...refs.current })
            }
          }
          await doc.cleanup()
        })
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(String(e))
      })
    return () => {
      cancelled = true
    }
  }, [pdfPath])

  const move = (idx: number, dir: -1 | 1): void => {
    setPages((prev) => {
      const next = [...prev]
      const j = idx + dir
      if (j < 0 || j >= next.length) return prev
      ;[next[idx], next[j]] = [next[j], next[idx]]
      return next
    })
  }

  const toggleRemove = (idx: number): void =>
    setPages((prev) => prev.map((p, i) => (i === idx ? { ...p, removed: !p.removed } : p)))

  const rotate = (idx: number): void =>
    setPages((prev) => prev.map((p, i) => (i === idx ? { ...p, rotation: (p.rotation + 90) % 360 } : p)))

  const insertBlank = (idx: number): void =>
    setPages((prev) => {
      const next = [...prev]
      next.splice(idx + 1, 0, { num: -1, rotation: 0, removed: false })
      return next
    })

  const apply = async (): Promise<void> => {
    setBusy(true)
    setError(null)
    setDone(null)
    try {
      const removed = pages.filter((p) => p.removed && p.num > 0).map((p) => p.num)
      const kept = pages.filter((p) => !p.removed)
      const realKept = kept.filter((p) => p.num > 0)
      const blanks = kept.filter((p) => p.num < 0).length
      const sortedNums = realKept.map((p) => p.num).sort((a, b) => a - b)
      const currentOrder = realKept.map((p) => p.num)
      const needReorder = currentOrder.join(',') !== sortedNums.join(',')
      const needRotate = realKept.some((p) => p.rotation !== 0)

      if (removed.length === 0 && !needReorder && !needRotate && blanks === 0) {
        throw new Error(t('pdfeditor.noChanges'))
      }

      let current = pdfPath
      const applyOne = async (fn: () => Promise<string[]>): Promise<void> => {
        const files = await fn()
        if (files.length === 0) throw new Error('operação falhou')
        current = files[0]
      }

      // 1. remoções primeiro
      if (removed.length > 0) {
        await applyOne(() => getBackend().pdfEditRemove(current, removed.join(','), outputDir))
      }

      // 2. reordenação: após remoção, as páginas atuais são 1..N na ordem original;
      // remapeia a ordem desejada (em números originais) para posições atuais.
      if (needReorder) {
        const remaining = removed.length > 0
          ? sortedNums.filter((n) => !removed.includes(n))
          : sortedNums
        const desired = realKept.map((p) => p.num)
        const mapped = desired.map((orig) => {
          const idx = remaining.indexOf(orig)
          if (idx < 0) throw new Error(`página ${orig} indisponível`)
          return String(idx + 1)
        })
        await applyOne(() => getBackend().pdfEditReorder(current, mapped.join(','), outputDir))
      }

      // 3. rotações (posições finais: após reorder, a posição final é o índice em desired)
      if (needRotate) {
        const finalOrder = needReorder ? realKept.map((p) => p.num) : sortedNums
        const rots = realKept
          .map((p) => ({ orig: p.num, angle: p.rotation }))
          .filter((r) => r.angle !== 0)
          .map((r) => ({ page: finalOrder.indexOf(r.orig) + 1, angle: r.angle }))
        await applyOne(() => getBackend().pdfEditRotate(current, rots, outputDir))
      }

      // 4. páginas em branco no fim
      if (blanks > 0) {
        await applyOne(() => getBackend().pdfEditInsertBlank(current, blanks, outputDir))
      }

      setDone(current)
    } catch (e) {
      setError(String(e))
    } finally {
      setBusy(false)
    }
  }

  const canApply =
    !busy &&
    (pages.some((p) => p.removed) ||
      pages.some((p) => p.rotation !== 0) ||
      pages.some((p) => p.num < 0) ||
      pages.map((p) => p.num).join(',') !== pages.map((p) => p.num).sort((a, b) => a - b).join(','))

  return (
    <div className="space-y-3" data-testid="pdf-editor">
      <p className="text-xs text-text-muted">
        {total > 0 ? `${total} ${t('common.pages')}` : t('common.loading')}
      </p>
      {error && (
        <p className="text-sm text-danger" data-testid="pdf-editor-error">
          {t('common.error')}: {error}
        </p>
      )}
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4" data-testid="pdf-editor-grid">
        {pages.map((p, i) => (
          <div
            key={i}
            className={`overflow-hidden rounded-md border ${p.removed ? 'border-danger opacity-50' : 'border-border'} bg-surface`}
            data-testid={`pdf-page-${i}`}
            data-removed={p.removed}
          >
            {p.num < 0 ? (
              <div className="flex h-28 items-center justify-center bg-bg text-xs text-text-muted">
                {t('pdfeditor.blank')}
              </div>
            ) : (
              thumbs[p.num] != null && (
                <img
                  src={thumbs[p.num]}
                  alt={`p${p.num}`}
                  className="h-28 w-full object-contain bg-white"
                  style={{ transform: `rotate(${p.rotation}deg)` }}
                />
              )
            )}
            <p className="px-1 pt-1 text-center text-xs text-text">
              {p.num < 0 ? t('pdfeditor.blank') : `p${p.num}${p.rotation > 0 ? ` ${p.rotation}°` : ''}`}
            </p>
            <div className="flex items-center justify-center gap-0.5 pb-1">
              <button title="←" onClick={() => move(i, -1)} className="rounded p-0.5 text-text-muted hover:text-accent" disabled={i === 0}>
                <ArrowLeft className="h-3.5 w-3.5" />
              </button>
              <button title="→" onClick={() => move(i, 1)} className="rounded p-0.5 text-text-muted hover:text-accent" disabled={i === pages.length - 1}>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
              {p.num > 0 && (
                <button
                  title={t('pdfeditor.rotate')}
                  onClick={() => rotate(i)}
                  className="rounded p-0.5 text-text-muted hover:text-accent"
                  data-testid={`pdf-rotate-${i}`}
                >
                  <RotateCw className="h-3.5 w-3.5" />
                </button>
              )}
              {p.num > 0 && (
                <button
                  title={t('pdfeditor.remove')}
                  onClick={() => toggleRemove(i)}
                  className={`rounded p-0.5 ${p.removed ? 'text-danger' : 'text-text-muted hover:text-danger'}`}
                  data-testid={`pdf-remove-${i}`}
                >
                  {p.removed ? <X className="h-3.5 w-3.5" /> : <Trash2 className="h-3.5 w-3.5" />}
                </button>
              )}
              <button title={t('pdfeditor.insertBlank')} onClick={() => insertBlank(i)} className="rounded p-0.5 text-text-muted hover:text-accent">
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
      <button
        onClick={() => void apply()}
        disabled={!canApply}
        className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
        data-testid="pdf-editor-apply"
      >
        {busy ? t('common.loading') : t('pdfeditor.apply')}
      </button>
      {done && (
        <p className="flex items-center gap-1 text-xs text-success-text" data-testid="pdf-editor-done">
          <Check className="h-4 w-4" />
          <span className="truncate" title={done}>{done}</span>
        </p>
      )}
    </div>
  )
}

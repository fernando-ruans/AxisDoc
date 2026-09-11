import type React from 'react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Search, X } from 'lucide-react'
import { useCatalog } from '../stores/catalog'
import { cn } from '../lib/utils'

interface Props {
  open: boolean
  onClose: () => void
  onSelect: (toolId: string) => void
}

export function CommandPalette({ open, onClose, onSelect }: Props): React.JSX.Element | null {
  const { t } = useTranslation()
  const tools = useCatalog((s) => s.tools)
  const [query, setQuery] = useState('')
  const [index, setIndex] = useState(0)

  const actions = useMemo(
    () => [
      { id: '__view:jobs', label: t('job.title') },
    ],
    [t],
  )

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    const toolItems = tools.map((t2) => ({ id: t2.id, label: t(t2.titleKey), hint: t2.category }))
    const all = [...actions.map((a) => ({ id: a.id, label: a.label, hint: '' })), ...toolItems]
    if (!q) return all
    return all.filter(
      (x) =>
        x.id.toLowerCase().includes(q) ||
        x.label.toLowerCase().includes(q) ||
        x.hint.toLowerCase().includes(q),
    )
  }, [tools, query, t, actions])

  useEffect(() => {
    if (open) {
      setQuery('')
      setIndex(0)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setIndex((i) => Math.min(i + 1, results.length - 1))
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setIndex((i) => Math.max(i - 1, 0))
      }
      if (e.key === 'Enter' && results[index]) {
        onSelect(results[index].id)
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, results, index, onClose, onSelect])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 pt-24"
      data-testid="command-palette"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-lg border border-border bg-surface shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <Search className="h-4 w-4 text-text-muted" aria-hidden />
          <input
            autoFocus
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setIndex(0)
            }}
            placeholder={t('app.search')}
            className="w-full bg-transparent text-sm text-text outline-none"
            data-testid="palette-input"
          />
          <button onClick={onClose} aria-label={t('common.close')} className="text-text-muted hover:text-text">
            <X className="h-4 w-4" />
          </button>
        </div>
        <ul className="max-h-72 overflow-y-auto p-2" data-testid="palette-results">
          {results.length === 0 && (
            <li className="px-3 py-6 text-center text-sm text-text-muted">{t('app.noTools')}</li>
          )}
          {results.map((item, i) => (
            <li key={item.id}>
              <button
                className={cn(
                  'w-full rounded px-3 py-2 text-left text-sm',
                  i === index ? 'bg-accent text-white' : 'text-text hover:bg-surface-2',
                )}
                onMouseEnter={() => setIndex(i)}
                onClick={() => {
                  onSelect(item.id)
                  onClose()
                }}
                data-testid={`palette-item-${item.id}`}
              >
                {item.label}
                {item.hint && <span className="ml-2 text-xs opacity-60">{item.hint}</span>}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

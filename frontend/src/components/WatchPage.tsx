import { useEffect, useState } from 'react'
import type React from 'react'
import { useTranslation } from 'react-i18next'
import { Trash2 } from 'lucide-react'
import { getBackend } from '../bindings/backend'
import type { Pipeline, WatchRuleOut } from '../bindings/backend'

export function WatchPage(): React.JSX.Element {
  const { t } = useTranslation()
  const [rules, setRules] = useState<WatchRuleOut[]>([])
  const [macros, setMacros] = useState<Pipeline[]>([])
  const [folder, setFolder] = useState('')
  const [pattern, setPattern] = useState('.pdf')
  const [macroId, setMacroId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = async (): Promise<void> => {
    try {
      const [r, m] = await Promise.all([getBackend().watchList(), getBackend().pipelineList()])
      setRules(r ?? [])
      setMacros(m ?? [])
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refresh()
  }, [])

  const add = async (): Promise<void> => {
    setError(null)
    if (!folder || !macroId) return
    const macro = macros.find((m) => m.id === macroId)
    if (!macro) return
    try {
      await getBackend().watchAdd(folder, pattern, macro)
      setFolder('')
      await refresh()
    } catch (e) {
      setError(String(e))
    }
  }

  const remove = async (id: string): Promise<void> => {
    await getBackend().watchRemove(id)
    await refresh()
  }

  return (
    <div className="mx-auto max-w-2xl" data-testid="watch-page">
      <h2 className="mb-1 text-xl font-semibold">{t('watch.title')}</h2>

      {loading && <p className="mt-4 text-sm text-text-muted">{t('common.loading')}</p>}

      {!loading && error && (
        <p className="mt-4 text-sm text-danger" data-testid="watch-error">
          {t('common.error')}: {error}
        </p>
      )}

      {!loading && !error && rules.length === 0 && (
        <p className="mt-4 text-sm text-text-muted">{t('watch.empty')}</p>
      )}
      {!loading && !error && rules.length > 0 && (
        <ul className="mt-4 space-y-2">
          {rules.map((r) => (
            <li key={r.id} className="flex items-center justify-between rounded-md border border-border bg-surface p-3" data-testid="watch-rule">
              <div className="min-w-0 text-xs">
                <p className="truncate text-sm text-text">{r.folder}</p>
                <p className="text-text-muted">{r.pattern || '∗'} → {r.pipeline.name}</p>
              </div>
              <button
                title={t('watch.remove')}
                onClick={() => void remove(r.id)}
                className="rounded p-1 text-text-muted hover:text-danger"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-6 rounded-md border border-border bg-surface p-4">
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-text">{t('watch.folder')}</label>
            <button
              onClick={async () => {
                const f = await getBackend().pickFolder()
                if (f) setFolder(f)
              }}
              className="w-full rounded-md border border-border px-3 py-2 text-left text-sm text-text hover:border-accent"
              data-testid="watch-folder"
            >
              {folder || t('common.pickFolder')}
            </button>
          </div>
          <div>
            <label htmlFor="watch-pattern" className="mb-1 block text-sm font-medium text-text">{t('watch.pattern')}</label>
            <input
              id="watch-pattern"
              value={pattern}
              onChange={(e) => setPattern(e.target.value)}
              className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-text"
              data-testid="watch-pattern"
            />
          </div>
          <div>
            <label htmlFor="watch-macro" className="mb-1 block text-sm font-medium text-text">{t('watch.pipeline')}</label>
            <select
              id="watch-macro"
              value={macroId}
              onChange={(e) => setMacroId(e.target.value)}
              className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-text"
              data-testid="watch-macro"
            >
              <option value="" disabled>
                {t('watch.pipeline')}
              </option>
              {macros.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
          {error && <p className="text-sm text-danger">{error}</p>}
          <button
            onClick={() => void add()}
            disabled={!folder || !macroId}
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
            data-testid="watch-add"
          >
            {t('watch.add')}
          </button>
        </div>
      </div>
    </div>
  )
}

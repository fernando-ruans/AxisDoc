import { useState } from 'react'
import type React from 'react'
import { useTranslation } from 'react-i18next'
import { Search as SearchIcon, ExternalLink, FolderOpen } from 'lucide-react'
import { getBackend } from '../bindings/backend'
import type { SearchHit } from '../bindings/backend'

export function SearchPage(): React.JSX.Element {
  const { t } = useTranslation()
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<SearchHit[]>([])
  const [count, setCount] = useState(0)
  const [busy, setBusy] = useState(false)
  const [searched, setSearched] = useState(false)

  const run = async (): Promise<void> => {
    setBusy(true)
    try {
      const [h, c] = await Promise.all([
        getBackend().searchQuery(query, 50),
        getBackend().searchCount(),
      ])
      setHits(h)
      setCount(c)
      setSearched(true)
    } finally {
      setBusy(false)
    }
  }

  const indexFolder = async (): Promise<void> => {
    const folder = await getBackend().pickFolder()
    if (!folder) return
    await getBackend().enqueue('search.index', { paths: [folder], params: { recursive: true } })
    setCount(await getBackend().searchCount())
  }

  const highlight = (snippet: string): React.JSX.Element[] => {
    const parts = snippet.split(/(▶.*?◀)/g)
    return parts.map((p, i) =>
      p.startsWith('▶') ? (
        <mark key={i} className="rounded bg-accent/30 px-0.5">{p.slice(1, -1)}</mark>
      ) : (
        <span key={i}>{p}</span>
      ),
    )
  }

  return (
    <div className="mx-auto max-w-2xl" data-testid="search-page">
      <h2 className="mb-1 text-xl font-semibold">{t('search.title')}</h2>
      <div className="mt-4 flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void run()
          }}
          placeholder={t('search.placeholder')}
          className="flex-1 rounded-md border border-border bg-surface px-3 py-2 text-sm text-text"
          data-testid="search-input"
        />
        <button
          onClick={() => void run()}
          disabled={busy || !query.trim()}
          className="flex items-center gap-1 rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
          data-testid="search-run"
        >
          <SearchIcon className="h-4 w-4" />
          {t('search.title')}
        </button>
      </div>
      <div className="mt-2 flex items-center gap-3 text-xs text-text-muted">
        <span data-testid="search-count">{count} {t('search.indexed')}</span>
        <button onClick={() => void indexFolder()} className="text-accent hover:underline" data-testid="search-index-folder">
          {t('search.indexFolder')}
        </button>
      </div>
      {searched && hits.length === 0 && (
        <p className="mt-4 text-sm text-text-muted" data-testid="search-empty">{t('search.noResults')}</p>
      )}
      {!searched && count === 0 && (
        <p className="mt-4 text-sm text-text-muted">{t('search.hint')}</p>
      )}
      <ul className="mt-4 space-y-2" data-testid="search-results">
        {hits.map((h) => (
          <li key={h.docId} className="rounded-md border border-border bg-surface p-3" data-testid="search-hit">
            <p className="text-sm font-medium text-text">{h.title}</p>
            <p className="mt-1 text-xs text-text-muted">{highlight(h.snippet)}</p>
            <div className="mt-1 flex items-center gap-1 text-xs">
              <span className="min-w-0 flex-1 truncate text-text-muted" title={h.path}>{h.path}</span>
              <button title={t('common.open')} onClick={() => void getBackend().openPath(h.path)} className="rounded p-1 text-text-muted hover:text-accent">
                <ExternalLink className="h-3.5 w-3.5" />
              </button>
              <button title={t('common.openFolder')} onClick={() => void getBackend().revealInFolder(h.path)} className="rounded p-1 text-text-muted hover:text-accent">
                <FolderOpen className="h-3.5 w-3.5" />
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

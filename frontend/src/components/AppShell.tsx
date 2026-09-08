import type React from 'react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Fingerprint, Moon, Sun, History, FileSearch, Wrench, Download,
  FileText, FilePlus2, Scissors, RotateCw, Stamp, Minimize2,
  Repeat, Scaling, Table2, GitCompare, Braces, Code2, FileJson,
  Pencil, List, QrCode, ScanBarcode, Database, ScanText, FileImage,
  Search as SearchIcon, Workflow, FolderClock, DatabaseZap,
  FileSpreadsheet, Table, AlignLeft, Binary, Clock, Link, Columns3, Code,
  Crop, FlipHorizontal, Wand2, Shapes, Film, Palette, ListOrdered, Lock, LockOpen, Layers,
  PencilRuler,
} from 'lucide-react'
import { useCatalog } from '../stores/catalog'
import { useTheme } from '../stores/theme'
import { CommandPalette } from './CommandPalette'
import { GenericToolForm } from './tools/GenericToolForm'
import { JobList } from './JobList'
import { SearchPage } from './SearchPage'
import { PipelinesPage } from './PipelinesPage'
import { WatchPage } from './WatchPage'
import { getBackend } from '../bindings/backend'
import { cn } from '../lib/utils'

type IconComponent = typeof Fingerprint

const ICONS: Record<string, IconComponent> = {
  fingerprint: Fingerprint,
  'file-info': FileText,
  'file-plus-2': FilePlus2,
  scissors: Scissors,
  'rotate-cw': RotateCw,
  stamp: Stamp,
  'minimize-2': Minimize2,
  'file-text': FileText,
  repeat: Repeat,
  scaling: Scaling,
  'table-2': Table2,
  'git-compare': GitCompare,
  braces: Braces,
  code: Code2,
  'file-json': FileJson,
  'file-image': FileImage,
  pencil: Pencil,
  list: List,
  'qr-code': QrCode,
  'scan-barcode': ScanBarcode,
  database: Database,
  'scan-text': ScanText,
  'database-zap': DatabaseZap,
  'file-spreadsheet': FileSpreadsheet,
  table: Table,
  'align-left': AlignLeft,
  binary: Binary,
  clock: Clock,
  link: Link,
  'columns-3': Columns3,
  'code-2': Code,
  crop: Crop,
  'flip-horizontal': FlipHorizontal,
  wand: Wand2,
  shapes: Shapes,
  film: Film,
  palette: Palette,
  'list-ordered': ListOrdered,
  lock: Lock,
  'lock-open': LockOpen,
  layers: Layers,
  'pencil-ruler': PencilRuler,
}

function iconFor(name: string): IconComponent {
  return ICONS[name] ?? Wrench
}

export function AppShell(): React.JSX.Element {
  const { t } = useTranslation()
  const tools = useCatalog((s) => s.tools)
  const loading = useCatalog((s) => s.loading)
  const error = useCatalog((s) => s.error)
  const load = useCatalog((s) => s.load)
  const theme = useTheme((s) => s.theme)
  const toggleTheme = useTheme((s) => s.toggle)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  const [showJobs, setShowJobs] = useState(false)
  const [view, setView] = useState<'tool' | 'search' | 'pipelines' | 'watch'>('tool')
  const [updateTag, setUpdateTag] = useState<string | null>(null)

  useEffect(() => {
    void load()
    void getBackend()
      .checkUpdate()
      .then((r) => {
        if (r.hasUpdate) setUpdateTag(r.tag)
      })
      .catch(() => undefined)
  }, [load])

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPaletteOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const categories = useMemo(() => {
    const map = new Map<string, typeof tools>()
    for (const tool of tools) {
      const list = map.get(tool.category) ?? []
      list.push(tool)
      map.set(tool.category, list)
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [tools])

  const selectedTool = tools.find((x) => x.id === selected)

  return (
    <div className="flex h-screen bg-bg text-text">
      <aside className="flex w-64 flex-col border-r border-border bg-surface" data-testid="sidebar">
        <div className="border-b border-border px-4 py-4">
          <div className="flex items-center gap-2.5">
            <img
              src="logo.png"
              alt=""
              className="h-9 w-9"
              draggable={false}
              data-testid="app-logo"
            />
            <h1 className="text-lg font-bold tracking-tight">{t('app.name')}</h1>
          </div>
          <p className="mt-1 text-xs text-text-muted">{t('app.tagline')}</p>
        </div>

        <button
          onClick={() => setPaletteOpen(true)}
          className="mx-3 mt-3 flex items-center gap-2 rounded-md border border-border px-3 py-2 text-left text-sm text-text-muted hover:border-text-muted"
          data-testid="open-palette"
        >
          <FileSearch className="h-4 w-4" />
          {t('app.search')}
        </button>

        <nav className="flex-1 overflow-y-auto px-3 py-3" data-testid="tool-nav">
          {loading && <p className="px-2 text-sm text-text-muted">{t('common.loading')}</p>}
          {error && (
            <p className="px-2 text-sm text-danger" data-testid="catalog-error">
              {t('common.error')}: {error}
            </p>
          )}
          {categories.map(([cat, catTools]) => (
            <div key={cat} className="mb-4">
              <p className="px-2 pb-1 text-xs font-semibold uppercase tracking-wide text-text-muted">
                {t(`category.${cat}`, { defaultValue: cat })}
              </p>
              <ul>
                {catTools.map((tool) => {
                  const Icon = iconFor(tool.icon)
                  return (
                    <li key={tool.id}>
                      <button
                        onClick={() => setSelected(tool.id)}
                        className={cn(
                          'flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm',
                          selected === tool.id
                            ? 'bg-accent/20 text-accent'
                            : 'text-text hover:bg-surface-2',
                        )}
                        data-testid={`tool-${tool.id}`}
                      >
                        <Icon className="h-4 w-4" />
                        {t(tool.titleKey)}
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="border-t border-border p-3">
          <button
            onClick={() => { setShowJobs(false); setView('search') }}
            className={cn('flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-surface-2', view === 'search' && !showJobs ? 'text-accent' : 'text-text')}
            data-testid="nav-search"
          >
            <SearchIcon className="h-4 w-4" />
            {t('search.title')}
          </button>
          <button
            onClick={() => { setShowJobs(false); setView('pipelines') }}
            className={cn('flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-surface-2', view === 'pipelines' && !showJobs ? 'text-accent' : 'text-text')}
            data-testid="nav-pipelines"
          >
            <Workflow className="h-4 w-4" />
            {t('pipelines.title')}
          </button>
          <button
            onClick={() => { setShowJobs(false); setView('watch') }}
            className={cn('flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-surface-2', view === 'watch' && !showJobs ? 'text-accent' : 'text-text')}
            data-testid="nav-watch"
          >
            <FolderClock className="h-4 w-4" />
            {t('watch.title')}
          </button>
          <button
            onClick={() => setShowJobs((v) => !v)}
            className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm text-text hover:bg-surface-2"
            data-testid="toggle-jobs"
          >
            <History className="h-4 w-4" />
            {t('job.title')}
          </button>
          <button
            onClick={toggleTheme}
            className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm text-text hover:bg-surface-2"
            data-testid="toggle-theme"
            aria-label={t('app.theme')}
          >
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            {t('app.theme')}
          </button>
          {updateTag && (
            <p className="mt-1 flex items-center gap-1 px-2 text-xs text-warn-text" data-testid="update-badge">
              <Download className="h-3.5 w-3.5" />
              {t('update.available', { tag: updateTag })}
            </p>
          )}
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto p-8" data-testid="main">
        {showJobs ? (
          <div className="mx-auto max-w-2xl">
            <h2 className="mb-4 text-xl font-semibold">{t('job.title')}</h2>
            <JobList />
          </div>
        ) : view === 'search' ? (
          <SearchPage />
        ) : view === 'pipelines' ? (
          <PipelinesPage />
        ) : view === 'watch' ? (
          <WatchPage />
        ) : selectedTool ? (
          <div className="mx-auto max-w-2xl" data-testid="tool-page">
            <h2 className="mb-1 text-xl font-semibold">{t(selectedTool.titleKey)}</h2>
            <p className="mb-6 text-sm text-zinc-500">{t(selectedTool.descKey)}</p>
            <GenericToolForm tool={selectedTool} />
          </div>
        ) : (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <h2 className="text-2xl font-bold">{t('app.name')}</h2>
              <p className="mt-2 text-sm text-zinc-500">{t('app.tagline')}</p>
            </div>
          </div>
        )}
      </main>

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onSelect={(id) => {
          setShowJobs(false)
          if (id === '__view:search' || id === '__view:pipelines' || id === '__view:watch' || id === '__view:jobs') {
            if (id === '__view:jobs') setShowJobs(true)
            else setView(id.replace('__view:', '') as typeof view)
            setSelected(null)
            return
          }
          setView('tool')
          setSelected(id)
        }}
      />
    </div>
  )
}

import type React from 'react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Moon, Sun, History, FileSearch, Download, ChevronDown, PanelLeftClose, PanelLeftOpen, House,
} from 'lucide-react'
import { useCatalog } from '../stores/catalog'
import { useTheme } from '../stores/theme'
import { CommandPalette } from './CommandPalette'
import { GenericToolForm } from './tools/GenericToolForm'
import { ToolHeader } from './ToolHeader'
import { HomeDashboard } from './HomeDashboard'
import { JobList } from './JobList'
import { getBackend } from '../bindings/backend'
import { iconFor } from './icons'
import { useJobs } from '../stores/jobs'
import { cn } from '../lib/utils'

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
  // view única: 'tool' | 'jobs' | 'home' — menu inferior reduzido a
  // Início + Jobs (+ tema e barra lateral).
  const [view, setView] = useState<'tool' | 'jobs' | 'home'>('home')
  const [updateTag, setUpdateTag] = useState<string | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(() => {
    try {
      return localStorage.getItem('axisdoc.sidebar') !== 'closed'
    } catch {
      return true
    }
  })
  // seções colapsáveis da sidebar (lembra do localStorage)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() => {
    try {
      return JSON.parse(localStorage.getItem('axisdoc.collapsed') ?? '{}') as Record<string, boolean>
    } catch {
      return {}
    }
  })
  const runningJobs = useJobs((s) => s.jobs.filter((j) => j.status === 'running' || j.status === 'queued').length)

  const goView = (v: typeof view): void => {
    if (v !== 'tool') setSelected(null)
    setView(v)
  }
  const goTool = (id: string): void => {
    setSelected(id)
    setView('tool')
  }
  const goHome = (): void => {
    setSelected(null)
    setView('home')
  }
  const toggleSidebar = (): void => {
    setSidebarOpen((prev) => {
      try {
        localStorage.setItem('axisdoc.sidebar', prev ? 'closed' : 'open')
      } catch {
        // storage indisponível: mantém só em memória
      }
      return !prev
    })
  }
  const toggleSection = (cat: string): void => {
    setCollapsed((prev) => {
      const next = { ...prev, [cat]: !prev[cat] }
      try {
        localStorage.setItem('axisdoc.collapsed', JSON.stringify(next))
      } catch {
        // storage indisponível: mantém só em memória
      }
      return next
    })
  }

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

  // ferramentas visíveis no menu inferior: só Início e Jobs
  const navItems = [
    { view: 'home' as const, icon: House, label: t('home.title'), testid: 'nav-home' },
    { view: 'jobs' as const, icon: History, label: t('job.title'), testid: 'nav-jobs', badge: runningJobs > 0 ? runningJobs : null },
  ]

  return (
    <div className="flex h-screen bg-bg text-text">
      {sidebarOpen && (
      <aside className="flex w-64 shrink-0 flex-col border-r border-border bg-surface" data-testid="sidebar">
        <div className="border-b border-border px-4 py-3">
          <div className="flex items-center gap-2.5">
            <img
              src="logo.png"
              alt=""
              className="h-11 w-11"
              draggable={false}
              data-testid="app-logo"
            />
            <div className="min-w-0 leading-tight">
              <h1 className="text-lg font-bold tracking-tight">{t('app.name')}</h1>
              <p className="text-[11px] leading-snug text-text-muted">{t('app.tagline')}</p>
            </div>
          </div>
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
          {categories.map(([cat, catTools]) => {
            const isCollapsed = collapsed[cat] ?? false
            const active = selected != null && catTools.some((x) => x.id === selected)
            return (
              <div key={cat} className="mb-1">
                <button
                  type="button"
                  onClick={() => toggleSection(cat)}
                  aria-expanded={!isCollapsed}
                  data-testid={`section-${cat}`}
                  className="flex w-full items-center gap-1 rounded px-2 py-1.5 text-xs font-semibold uppercase tracking-wide text-text-muted hover:bg-surface-2"
                >
                  <ChevronDown
                    className={cn('h-3.5 w-3.5 transition-transform', isCollapsed && '-rotate-90')}
                  />
                  <span className="flex-1 text-left">
                    {t(`category.${cat}`, { defaultValue: cat })}
                  </span>
                  <span className="rounded-full bg-surface-2 px-1.5 text-[10px] tabular-nums">
                    {catTools.length}
                  </span>
                  {active && <span className="h-1.5 w-1.5 rounded-full bg-accent" data-testid={`section-active-${cat}`} />}
                </button>
                {!isCollapsed && (
                  <ul>
                    {catTools.map((tool) => {
                      const Icon = iconFor(tool.icon)
                      const isSel = selected === tool.id && view === 'tool'
                      return (
                        <li key={tool.id}>
                          <button
                            onClick={() => goTool(tool.id)}
                            className={cn(
                              'flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm',
                              isSel
                                ? 'bg-accent/20 text-accent'
                                : 'text-text hover:bg-surface-2',
                            )}
                            data-testid={`tool-${tool.id}`}
                          >
                            <Icon className="h-4 w-4 shrink-0" />
                            <span className="truncate">{t(tool.titleKey)}</span>
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>
            )
          })}
        </nav>

        <div className="border-t border-border p-2" data-testid="sidebar-footer">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = view === item.view
            return (
              <button
                key={item.view}
                onClick={() => goView(item.view)}
                className={cn(
                  'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-surface-2',
                  isActive ? 'text-accent' : 'text-text',
                )}
                data-testid={item.testid}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="flex-1 text-left">{item.label}</span>
                {item.badge != null && (
                  <span className="rounded-full bg-accent px-1.5 text-[10px] font-semibold tabular-nums text-white" data-testid="jobs-badge">
                    {item.badge}
                  </span>
                )}
              </button>
            )
          })}
          <button
            onClick={toggleSidebar}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-text hover:bg-surface-2"
            data-testid="toggle-sidebar"
            aria-label={t('app.hideSidebar')}
            title={t('app.hideSidebar')}
          >
            <PanelLeftClose className="h-4 w-4 shrink-0" />
            <span className="flex-1 text-left">{t('app.hideSidebar')}</span>
          </button>
          <button
            onClick={toggleTheme}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-text hover:bg-surface-2"
            data-testid="toggle-theme"
            aria-label={t('app.theme')}
          >
            {theme === 'dark' ? <Sun className="h-4 w-4 shrink-0" /> : <Moon className="h-4 w-4 shrink-0" />}
            <span className="flex-1 text-left">{t('app.theme')}</span>
          </button>
          {updateTag && (
            <p className="mt-1 flex items-center gap-1 px-2 text-xs text-warn-text" data-testid="update-badge">
              <Download className="h-3.5 w-3.5" />
              {t('update.available', { tag: updateTag })}
            </p>
          )}
        </div>
      </aside>
      )}
      {!sidebarOpen && (
        <button
          type="button"
          onClick={toggleSidebar}
          title={t('app.showSidebar')}
          data-testid="show-sidebar"
          className="absolute left-2 top-2 z-40 rounded-md border border-border bg-surface p-2 text-text-muted hover:text-text"
        >
          <PanelLeftOpen className="h-4 w-4" />
        </button>
      )}

      <main className="flex-1 overflow-y-auto p-8" data-testid="main">
        {view === 'jobs' ? (
          <div className="mx-auto max-w-2xl">
            <h2 className="mb-4 text-xl font-semibold">{t('job.title')}</h2>
            <JobList />
          </div>
        ) : view === 'home' || selectedTool == null ? (
          <HomeDashboard
            tools={tools}
            onSelect={(id) => {
              setView('tool')
              setSelected(id)
            }}
          />
        ) : (
          <div className="mx-auto max-w-2xl" data-testid="tool-page">
            <ToolHeader tool={selectedTool} />
            <GenericToolForm tool={selectedTool} />
          </div>
        )}
      </main>

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onSelect={(id) => {
          if (id === '__view:jobs') {
            goView('jobs')
            return
          }
          goTool(id)
        }}
      />
    </div>
  )
}

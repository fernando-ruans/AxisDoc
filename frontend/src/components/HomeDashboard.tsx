import { useMemo } from 'react'
import type React from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowRight, Clock3 } from 'lucide-react'
import type { ToolInfo } from '../bindings/backend'
import { useJobs } from '../stores/jobs'
import { iconFor } from './icons'

// HomeDashboard: tela inicial com ações rápidas por categoria, ferramentas
// populares e atividade recente. Substitui a tela vazia "AxisDoc".
export function HomeDashboard({ tools, onSelect }: { tools: ToolInfo[]; onSelect: (id: string) => void }): React.JSX.Element {
  const { t } = useTranslation()
  const jobs = useJobs((s) => s.jobs)

  const categories = useMemo(() => {
    const map = new Map<string, ToolInfo[]>()
    for (const tool of tools) {
      const list = map.get(tool.category) ?? []
      list.push(tool)
      map.set(tool.category, list)
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [tools])

  const popular = useMemo(() => {
    const counts = new Map<string, number>()
    for (const j of jobs) counts.set(j.toolId, (counts.get(j.toolId) ?? 0) + 1)
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([id]) => tools.find((x) => x.id === id))
      .filter((x): x is ToolInfo => x != null)
  }, [jobs, tools])

  const recent = jobs.slice(0, 4)

  return (
    <div className="mx-auto max-w-3xl space-y-8" data-testid="home-dashboard">
      {popular.length > 0 && (
        <section>
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-text-muted">
            {t('home.popular')}
          </h3>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {popular.map((tool) => (
              <ToolCard key={tool.id} tool={tool} onSelect={onSelect} />
            ))}
          </div>
        </section>
      )}

      {categories.map(([cat, catTools]) => (
        <section key={cat}>
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-text-muted">
            {t(`category.${cat}`, { defaultValue: cat })}
          </h3>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {catTools.map((tool) => (
              <ToolCard key={tool.id} tool={tool} onSelect={onSelect} />
            ))}
          </div>
        </section>
      ))}

      {recent.length > 0 && (
        <section>
          <h3 className="mb-2 flex items-center gap-1 text-sm font-semibold uppercase tracking-wide text-text-muted">
            <Clock3 className="h-3.5 w-3.5" />
            {t('home.recent')}
          </h3>
          <ul className="space-y-1">
            {recent.map((j) => {
              const tool = tools.find((x) => x.id === j.toolId)
              return (
                <li
                  key={j.id}
                  className="flex items-center justify-between rounded-md border border-border bg-surface px-3 py-2 text-sm"
                >
                  <span className="truncate text-text">
                    {tool ? t(tool.titleKey) : j.toolId}
                  </span>
                  <span className="ml-2 shrink-0 text-xs text-text-muted">{t(`job.${j.status}`)}</span>
                </li>
              )
            })}
          </ul>
        </section>
      )}
    </div>
  )
}

function ToolCard({ tool, onSelect }: { tool: ToolInfo; onSelect: (id: string) => void }): React.JSX.Element {
  const { t } = useTranslation()
  const Icon = iconFor(tool.icon)
  return (
    <button
      type="button"
      onClick={() => onSelect(tool.id)}
      data-testid={`home-tool-${tool.id}`}
      className="group flex items-center gap-3 rounded-xl border border-border bg-surface p-3 text-left transition-colors hover:border-accent"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
        <Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium text-text">{t(tool.titleKey)}</span>
        <span className="block truncate text-xs text-text-muted">{t(tool.descKey)}</span>
      </span>
      <ArrowRight className="ml-auto h-4 w-4 shrink-0 text-text-muted opacity-0 transition-opacity group-hover:opacity-100" />
    </button>
  )
}

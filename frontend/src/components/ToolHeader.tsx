import type React from 'react'
import { useTranslation } from 'react-i18next'
import type { ToolInfo } from '../bindings/backend'
import { iconFor } from './icons'

// ToolHeader: cabeçalho padrão das páginas de ferramenta — ícone em card,
// título, descrição e categoria.
export function ToolHeader({ tool }: { tool: ToolInfo }): React.JSX.Element {
  const { t } = useTranslation()
  const Icon = iconFor(tool.icon)
  return (
    <div className="mb-6 flex items-center gap-4" data-testid="tool-header">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
        <Icon className="h-6 w-6" />
      </div>
      <div className="min-w-0">
        <h2 className="truncate text-xl font-semibold text-text">{t(tool.titleKey)}</h2>
        <p className="truncate text-sm text-text-muted">
          {t(tool.descKey)} · {t(`category.${tool.category}`, { defaultValue: tool.category })}
        </p>
      </div>
    </div>
  )
}

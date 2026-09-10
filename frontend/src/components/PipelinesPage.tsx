import { useEffect, useState } from 'react'
import type React from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Trash2, Play } from 'lucide-react'
import { getBackend } from '../bindings/backend'
import type { Pipeline, PipelineStep, ToolInfo } from '../bindings/backend'
import { useCatalog } from '../stores/catalog'

function newId(): string {
  return `m${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`
}

export function PipelinesPage(): React.JSX.Element {
  const { t } = useTranslation()
  const tools = useCatalog((s) => s.tools)
  const [macros, setMacros] = useState<Pipeline[]>([])
  const [name, setName] = useState('')
  const [steps, setSteps] = useState<PipelineStep[]>([])
  const [paths, setPaths] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [runResult, setRunResult] = useState<{ paths: string[]; message: string } | null>(null)

  const refresh = async (): Promise<void> => {
    try {
      setMacros((await getBackend().pipelineList()) ?? [])
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refresh()
  }, [])

  const toolsById = new Map<string, ToolInfo>(tools.map((x) => [x.id, x]))

  const save = async (): Promise<void> => {
    if (!name.trim() || steps.length === 0) return
    setError(null)
    try {
      await getBackend().pipelineSave({ id: newId(), name: name.trim(), steps })
      setName('')
      setSteps([])
      await refresh()
    } catch (e) {
      setError(String(e))
    }
  }

  const remove = async (id: string): Promise<void> => {
    await getBackend().pipelineDelete(id)
    await refresh()
  }

  const pickPaths = async (): Promise<void> => {
    const files = (await getBackend().pickFiles()) ?? []
    setPaths((prev) => [...prev, ...files.filter((f) => !prev.includes(f))])
  }

  const runMacro = async (m: Pipeline): Promise<void> => {
    if (paths.length === 0) return
    setError(null)
    setRunResult(null)
    try {
      setRunResult(await getBackend().pipelineRun(m, paths))
    } catch (e) {
      setError(String(e))
    }
  }

  return (
    <div className="mx-auto max-w-2xl" data-testid="pipelines-page">
      <h2 className="mb-1 text-xl font-semibold">{t('pipelines.title')}</h2>

      {loading && <p className="mt-4 text-sm text-text-muted">{t('common.loading')}</p>}

      {!loading && !error && macros.length === 0 && (
        <p className="mt-4 text-sm text-text-muted">{t('pipelines.empty')}</p>
      )}
      {!loading && !error && macros.length > 0 && (
        <ul className="mt-4 space-y-2">
          {macros.map((m) => (
            <li key={m.id} className="rounded-md border border-border bg-surface p-3" data-testid="macro-item">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-text">{m.name}</span>
                <div className="flex gap-1">
                  <button
                    title={t('pipelines.run')}
                    onClick={() => void runMacro(m)}
                    disabled={paths.length === 0}
                    className="rounded p-1 text-text-muted hover:text-accent disabled:opacity-30"
                  >
                    <Play className="h-4 w-4" />
                  </button>
                  <button
                    title={t('pipelines.delete')}
                    onClick={() => void remove(m.id)}
                    className="rounded p-1 text-text-muted hover:text-danger"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <p className="mt-1 text-xs text-text-muted">
                {m.steps.map((s) => s.toolId).join(' → ')}
              </p>
            </li>
          ))}
        </ul>
      )}

      {error && !loading && (
        <p className="mt-2 text-sm text-danger" data-testid="macro-error">
          {t('common.error')}: {error}
        </p>
      )}

      {runResult && (
        <div className="mt-2 rounded-md border border-border bg-surface p-3" data-testid="macro-result">
          {runResult.message !== '' && (
            <pre className="max-h-40 overflow-auto whitespace-pre-wrap text-xs text-text">
              {runResult.message}
            </pre>
          )}
          {runResult.paths.length > 0 && (
            <ul className="mt-1 space-y-1">
              {runResult.paths.map((p) => (
                <li key={p} className="truncate text-xs text-text-muted" title={p}>{p}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="mt-4">
        <button onClick={() => void pickPaths()} className="rounded-md border border-dashed border-border px-3 py-2 text-sm text-text hover:border-accent" data-testid="macro-pick-files">
          {t('common.pickFiles')}{paths.length > 0 ? ` (${paths.length})` : ''}
        </button>
      </div>

      <div className="mt-6 rounded-md border border-border bg-surface p-4">
        <h3 className="text-sm font-medium text-text">{t('pipelines.newPipeline')}</h3>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('pipelines.name')}
          className="mt-2 w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-text"
          data-testid="macro-name"
        />
        <p className="mt-3 text-xs text-text-muted">{t('pipelines.steps')}</p>
        <ul className="mt-1 space-y-1">
          {steps.map((s, i) => (
            <li key={i} className="flex items-center justify-between rounded bg-bg px-2 py-1 text-xs text-text">
              <span>{toolsById.get(s.toolId)?.id ?? s.toolId}</span>
              <button
                onClick={() => setSteps((prev) => prev.filter((_, x) => x !== i))}
                className="text-text-muted hover:text-danger"
                aria-label={t('watch.remove')}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
        <div className="mt-2 flex gap-2">
          <select
            id="macro-tool-select"
            className="flex-1 rounded-md border border-border bg-bg px-2 py-2 text-sm text-text"
            defaultValue=""
            data-testid="macro-tool-select"
          >
            <option value="" disabled>
              {t('pipelines.addStep')}
            </option>
            {tools.map((x) => (
              <option key={x.id} value={x.id}>
                {t(x.titleKey)}
              </option>
            ))}
          </select>
          <button
            onClick={() => {
              const sel = document.getElementById('macro-tool-select') as HTMLSelectElement | null
              if (sel?.value) {
                const info = toolsById.get(sel.value)
                const defaults: Record<string, unknown> = {}
                for (const p of info?.params ?? []) {
                  if (p.default !== undefined) defaults[p.key] = p.default
                }
                setSteps((prev) => [...prev, { toolId: sel.value, params: defaults }])
                sel.value = ''
              }
            }}
            className="rounded-md border border-border px-3 py-2 text-sm text-text hover:border-accent"
            data-testid="macro-add-step"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
        {error && !loading && <p className="mt-2 hidden text-sm text-danger">{error}</p>}
        <button
          onClick={() => void save()}
          disabled={!name.trim() || steps.length === 0}
          className="mt-3 rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
          data-testid="macro-save"
        >
          {t('pipelines.save')}
        </button>
      </div>
    </div>
  )
}

import type React from 'react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ExternalLink, FolderOpen, Copy, Check } from 'lucide-react'
import { getBackend } from '../bindings/backend'
import { useJobs } from '../stores/jobs'
import { useCatalog } from '../stores/catalog'
import { cn } from '../lib/utils'

export function JobList(): React.JSX.Element {
  const { t } = useTranslation()
  const jobs = useJobs((s) => s.jobs)
  const cancel = useJobs((s) => s.cancel)
  const removeJob = useJobs((s) => s.deleteJob)
  const clearHistory = useJobs((s) => s.clearHistory)
  const tools = useCatalog((s) => s.tools)
  const [copied, setCopied] = useState<string | null>(null)

  const titleOf = (toolId: string): string => {
    const tool = tools.find((x) => x.id === toolId)
    return tool ? t(tool.titleKey) : toolId
  }

  if (jobs.length === 0) {
    return <p className="text-sm text-text-muted" data-testid="jobs-empty">{t('job.empty')}</p>
  }

  const copyPath = async (path: string): Promise<void> => {
    try {
      await navigator.clipboard.writeText(path)
      setCopied(path)
      setTimeout(() => setCopied(null), 1500)
    } catch {
      setCopied(null)
    }
  }

  const pathsOf = (job: { output?: Record<string, unknown> }): string[] => {
    const p = job.output?.paths
    return Array.isArray(p) ? p.filter((x): x is string => typeof x === 'string') : []
  }

  return (
    <ul className="space-y-2" data-testid="job-list">
      {jobs.map((job) => {
        const paths = pathsOf(job)
        return (
        <li
          key={job.id}
          className="rounded-md border border-border bg-surface p-3"
          data-testid={`job-${job.id}`}
          data-status={job.status}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium text-text">{titleOf(job.toolId)}</span>
            <span
              className={cn(
                'rounded px-2 py-0.5 text-xs',
                job.status === 'done' && 'bg-success-bg text-success-text',
                job.status === 'failed' && 'bg-danger/20 text-danger',
                job.status === 'running' && 'bg-accent/20 text-accent',
                job.status === 'canceled' && 'bg-surface-2 text-text-muted',
                job.status === 'queued' && 'bg-warn-bg text-warn-text',
              )}
            >
              {t(`job.${job.status}`)}
            </span>
          </div>
          {(job.status === 'running' || job.status === 'queued') && (
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded bg-surface-2">
              <div
                className="h-full bg-accent transition-all"
                style={{ width: `${job.progress}%` }}
                data-testid="job-progress"
              />
            </div>
          )}
          {(job.status === 'running' || job.status === 'queued') && (
            <button
              onClick={() => void cancel(job.id)}
              className="mt-2 text-xs text-text-muted hover:text-danger"
            >
              {t('job.cancel')}
            </button>
          )}
          {job.status === 'failed' && job.error && (
            <p className="mt-1 text-xs text-danger">{job.error}</p>
          )}
          {job.status === 'done' && job.output?.message != null && (
            <pre
              className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded bg-bg p-2 text-xs text-text"
              data-testid={`job-result-${job.id}`}
            >
              {String(job.output.message)}
            </pre>
          )}
          {paths.length > 0 && (
            <ul className="mt-2 space-y-1" data-testid={`job-paths-${job.id}`}>
              {paths.map((p) => (
                <li key={p} className="flex items-center gap-1 text-xs">
                  <span className="min-w-0 flex-1 truncate text-text-muted" title={p}>{p}</span>
                  <button
                    title={t('common.open')}
                    onClick={() => void getBackend().openPath(p)}
                    className="rounded p-1 text-text-muted hover:text-accent"
                    data-testid="job-open"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </button>
                  <button
                    title={t('common.openFolder')}
                    onClick={() => void getBackend().revealInFolder(p)}
                    className="rounded p-1 text-text-muted hover:text-accent"
                    data-testid="job-open-folder"
                  >
                    <FolderOpen className="h-3.5 w-3.5" />
                  </button>
                  <button
                    title={t('common.copyPath')}
                    onClick={() => void copyPath(p)}
                    className="rounded p-1 text-text-muted hover:text-accent"
                    data-testid="job-copy-path"
                  >
                    {copied === p ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {(job.status === 'done' || job.status === 'failed' || job.status === 'canceled') && (
            <button
              onClick={() => void removeJob(job.id)}
              className="mt-2 text-xs text-text-muted hover:text-danger"
            >
              {t('common.clear')}
            </button>
          )}
        </li>
        )
      })}
    </ul>
  )
}

import { useEffect, useState } from 'react'
import type React from 'react'
import { useTranslation } from 'react-i18next'
import { ExternalLink, FolderOpen, Copy, Check } from 'lucide-react'
import { getBackend } from '../../bindings/backend'
import type { Job } from '../../bindings/backend'
import { BeforeAfter } from '../BeforeAfter'

// InlineJobResult mostra o resultado do último job executado na própria aba.
export function InlineJobResult({ job, beforePath }: { job: Job | null; beforePath?: string }): React.JSX.Element | null {
  const { t } = useTranslation()
  const [copied, setCopied] = useState<string | null>(null)
  const [beforeToken, setBeforeToken] = useState<string | null>(null)
  const [afterToken, setAfterToken] = useState<string | null>(null)

  const rawPaths = job?.output?.paths
  const paths: string[] = Array.isArray(rawPaths)
    ? rawPaths.filter((x): x is string => typeof x === 'string')
    : []
  const firstImage = paths.find((p) => /\.(png|jpg|jpeg|gif|bmp|webp)$/i.test(p)) ?? null

  useEffect(() => {
    setBeforeToken(null)
    setAfterToken(null)
    if (job == null || job.status !== 'done') return
    if (beforePath == null || firstImage == null) return
    let cancelled = false
    void getBackend()
      .registerPreviewFiles([beforePath, firstImage])
      .then((refs) => {
        if (cancelled || refs.length < 2) return
        setBeforeToken(refs[0].token)
        setAfterToken(refs[1].token)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [job?.id, beforePath, firstImage])

  if (job == null) return null
  if (job.status === 'queued' || job.status === 'running') return null

  const copyPath = async (path: string): Promise<void> => {
    try {
      await navigator.clipboard.writeText(path)
      setCopied(path)
      setTimeout(() => setCopied(null), 1500)
    } catch {
      setCopied(null)
    }
  }

  return (
    <div
      className="rounded-md border border-border bg-surface p-3"
      data-testid="inline-result"
      data-status={job.status}
    >
      {job.status === 'failed' ? (
        <p className="text-sm text-danger" data-testid="inline-error">
          {job.error || t('job.failed')}
        </p>
      ) : (
        <>
          {typeof job.output?.message === 'string' && job.output.message !== '' && (
            <pre
              className="max-h-60 overflow-auto whitespace-pre-wrap rounded bg-bg p-2 text-xs text-text"
              data-testid="inline-message"
            >
              {String(job.output.message)}
            </pre>
          )}
          {paths.length > 0 && (
            <ul className="mt-2 space-y-1" data-testid="inline-paths">
              {paths.map((p) => (
                <li key={p} className="flex items-center gap-1 text-xs">
                  <span className="min-w-0 flex-1 truncate text-text-muted" title={p}>{p}</span>
                  <button
                    title={t('common.open')}
                    onClick={() => void getBackend().openPath(p)}
                    className="rounded p-1 text-text-muted hover:text-accent"
                    data-testid="inline-open"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </button>
                  <button
                    title={t('common.openFolder')}
                    onClick={() => void getBackend().revealInFolder(p)}
                    className="rounded p-1 text-text-muted hover:text-accent"
                    data-testid="inline-open-folder"
                  >
                    <FolderOpen className="h-3.5 w-3.5" />
                  </button>
                  <button
                    title={t('common.copyPath')}
                    onClick={() => void copyPath(p)}
                    className="rounded p-1 text-text-muted hover:text-accent"
                    data-testid="inline-copy-path"
                  >
                    {copied === p ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {beforeToken != null && afterToken != null && (
            <div className="mt-2">
              <BeforeAfter
                before={`/preview/${beforeToken}`}
                after={`/preview/${afterToken}`}
                label={t('preview.compare')}
              />
            </div>
          )}
          {paths.length === 0 && (job.output?.message == null || job.output.message === '') && (
            <p className="text-xs text-text-muted">{t('job.done')}</p>
          )}
        </>
      )}
    </div>
  )
}

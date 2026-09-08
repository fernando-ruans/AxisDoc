import { useEffect, useState } from 'react'
import type React from 'react'
import { useTranslation } from 'react-i18next'
import { FileText } from 'lucide-react'
import { getBackend } from '../bindings/backend'
import type { PreviewRef, StructuredSummary } from '../bindings/backend'
import { PdfViewer } from './PdfViewer'

function StructuredSummaryView({ summary }: { summary: StructuredSummary }): React.JSX.Element {
  const { t } = useTranslation()
  if (summary.kind === 'table') {
    return (
      <div className="overflow-x-auto bg-bg p-2" data-testid="preview-table">
        <p className="mb-1 text-xs text-text-muted" data-testid="preview-table-meta">
          {summary.rows} {t('preview.rows')} × {summary.cols} {t('preview.cols')}
        </p>
        <table className="w-full border-collapse text-xs text-text">
          <tbody>
            {(summary.sample ?? []).map((row, i) => (
              <tr key={i} className={i === 0 ? 'font-semibold' : ''}>
                {row.map((cell, j) => (
                  <td key={j} className="max-w-40 truncate border border-border px-1 py-0.5" title={cell}>
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }
  return (
    <p className="bg-bg p-2 text-xs text-text-muted" data-testid="preview-pdf-meta">
      {summary.pages} {t('common.pages')}
      {summary.title !== '' ? ` — ${summary.title}` : ''}
    </p>
  )
}

const IMAGE_EXTS = ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp']
const TEXT_EXTS = ['.txt', '.md', '.csv', '.json', '.yaml', '.yml', '.toml', '.log']
// Extensões que o backend consegue resumir sem ler tudo:
// planilhas (cabeçalho + primeiras linhas) e PDFs (contagem de páginas).
const STRUCTURED_EXTS = ['.csv', '.xlsx', '.xlsm', '.pdf']

function extOf(name: string): string {
  const i = name.lastIndexOf('.')
  return i >= 0 ? name.slice(i).toLowerCase() : ''
}

interface Props {
  paths: string[]
  toolId?: string
  params?: Record<string, unknown>
}

export function FilePreview({ paths }: Props): React.JSX.Element | null {
  const { t } = useTranslation()
  const [refs, setRefs] = useState<PreviewRef[]>([])
  const [texts, setTexts] = useState<Record<string, string>>({})
  const [summaries, setSummaries] = useState<Record<string, StructuredSummary | null>>({})

  useEffect(() => {
    if (paths.length === 0) {
      setRefs([])
      setTexts({})
      setSummaries({})
      return
    }
    let cancelled = false
    void getBackend()
      .registerPreviewFiles(paths.slice(0, 8))
      .then(async (r) => {
        if (cancelled) return
        setRefs(r)
        const needText = r.filter((x) => TEXT_EXTS.includes(extOf(x.name)))
        for (const ref of needText) {
          try {
            const text = await getBackend().previewText(ref.token, 40)
            if (!cancelled) setTexts((prev) => ({ ...prev, [ref.token]: text }))
          } catch {
            // ignora erro de preview de texto
          }
        }
        const needSummary = r.filter((x) => STRUCTURED_EXTS.includes(extOf(x.name)))
        for (const ref of needSummary) {
          try {
            const summary = await getBackend().previewSummary(ref.token)
            if (!cancelled) setSummaries((prev) => ({ ...prev, [ref.token]: summary }))
          } catch {
            // ignora erro de resumo
          }
        }
      })
      .catch(() => {
        // backend sem suporte a preview: não mostra nada
      })
    return () => {
      cancelled = true
    }
  }, [paths.join('|')])

  if (paths.length === 0) return null
  if (refs.length === 0) return null

  return (
    <div className="space-y-3" data-testid="file-preview">
      <p className="text-sm font-medium text-text">{t('preview.title')}</p>
      {refs.map((ref) => {
        const ext = extOf(ref.name)
        return (
          <div key={ref.token} className="overflow-hidden rounded-md border border-border">
            <p className="truncate bg-surface-2 px-2 py-1 text-xs text-text-muted" title={ref.name}>
              {ref.name}
            </p>
            {IMAGE_EXTS.includes(ext) && (
              <img src={`/preview/${ref.token}`} alt={ref.name} className="max-h-64 w-full object-contain bg-surface" data-testid="preview-image" />
            )}
            {ext === '.pdf' && <PdfViewer src={`/preview/${ref.token}`} />}
            {TEXT_EXTS.includes(ext) && (
              <pre className="max-h-48 overflow-auto whitespace-pre-wrap bg-bg p-2 text-xs text-text" data-testid="preview-text">
                {texts[ref.token] ?? '…'}
              </pre>
            )}
            {STRUCTURED_EXTS.includes(ext) && summaries[ref.token] != null && (
              <StructuredSummaryView summary={summaries[ref.token] as StructuredSummary} />
            )}
            {STRUCTURED_EXTS.includes(ext) && !(ref.token in summaries) && (
              <p className="bg-bg p-2 text-xs text-text-muted">…</p>
            )}
            {!IMAGE_EXTS.includes(ext) && ext !== '.pdf' && !TEXT_EXTS.includes(ext) && (
              <p className="flex items-center gap-2 bg-surface p-2 text-xs text-text-muted">
                <FileText className="h-4 w-4" />
                {ref.name}
              </p>
            )}
          </div>
        )
      })}
    </div>
  )
}

import type React from 'react'
import { useTranslation } from 'react-i18next'
import { FolderOpen, FilePlus2 } from 'lucide-react'
import { getBackend } from '../../bindings/backend'
import type { ToolParam } from '../../bindings/backend'
import { cn } from '../../lib/utils'

export interface FieldProps {
  param: ToolParam
  value: unknown
  onChange: (value: unknown) => void
}

function useLabel(param: ToolParam): string {
  const { t } = useTranslation()
  return t(param.label, { defaultValue: param.key })
}

function Hint({ param }: { param: ToolParam }): React.JSX.Element | null {
  const { t } = useTranslation()
  if (!param.hint) return null
  return <p className="mt-1 text-xs text-text-muted">{t(param.hint)}</p>
}

function FieldLabel({ param, htmlFor }: { param: ToolParam; htmlFor: string }): React.JSX.Element {
  return (
    <label htmlFor={htmlFor} className="mb-1 block text-sm font-medium text-text">
      {useLabel(param)}
    </label>
  )
}

const inputCls =
  'w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text'

/** Texto simples / senha / multilinha. */
export function TextField({ param, value, onChange }: FieldProps): React.JSX.Element {
  const { t } = useTranslation()
  const id = `f-${param.key}`
  if (param.type === 'textarea') {
    return (
      <div>
        <FieldLabel param={param} htmlFor={id} />
        <textarea
          id={id}
          rows={3}
          value={String(value ?? '')}
          placeholder={param.placeholder ? t(param.placeholder) : undefined}
          onChange={(e) => onChange(e.target.value)}
          className={`${inputCls} resize-y`}
          data-testid={`param-${param.key}`}
        />
        <Hint param={param} />
      </div>
    )
  }
  return (
    <div>
      <FieldLabel param={param} htmlFor={id} />
      <input
        id={id}
        type={param.type === 'password' ? 'password' : 'text'}
        value={String(value ?? '')}
        placeholder={param.placeholder ? t(param.placeholder) : undefined}
        onChange={(e) => onChange(e.target.value)}
        className={inputCls}
        data-testid={`param-${param.key}`}
      />
      <Hint param={param} />
    </div>
  )
}

/** Number como input ou slider (quando Min/Max definidos ou widget=slider). */
export function NumberField({ param, value, onChange }: FieldProps): React.JSX.Element {
  const id = `f-${param.key}`
  const num = Number(value ?? param.default ?? 0)
  const asSlider = param.widget === 'slider' || (param.min !== undefined && param.max !== undefined && param.max > (param.min ?? 0))
  const set = (v: number): void => onChange(Number.isNaN(v) ? 0 : v)
  return (
    <div>
      <FieldLabel param={param} htmlFor={id} />
      {asSlider ? (
        <div className="flex items-center gap-3">
          <input
            id={id}
            type="range"
            min={param.min ?? 0}
            max={param.max ?? 100}
            value={num}
            onChange={(e) => set(Number(e.target.value))}
            className="flex-1 accent-[var(--color-accent)]"
            data-testid={`param-${param.key}`}
          />
          <span className="w-14 text-right text-sm tabular-nums text-text" data-testid={`param-${param.key}-value`}>
            {num}
          </span>
        </div>
      ) : (
        <input
          id={id}
          type="number"
          value={num}
          min={param.min}
          max={param.max}
          onChange={(e) => set(Number(e.target.value))}
          className={cn(inputCls, 'w-40')}
          data-testid={`param-${param.key}`}
        />
      )}
      <Hint param={param} />
    </div>
  )
}

/** Bool como switch (default) — checkbox nativo estilizado. */
export function BoolField({ param, value, onChange }: FieldProps): React.JSX.Element {
  const id = `f-${param.key}`
  return (
    <div>
      <label htmlFor={id} className="flex cursor-pointer items-center gap-2 text-sm text-text">
        <input
          id={id}
          type="checkbox"
          checked={Boolean(value)}
          onChange={(e) => onChange(e.target.checked)}
          className="h-4 w-4 accent-[var(--color-accent)]"
          data-testid={`param-${param.key}`}
        />
        {useLabel(param)}
      </label>
      <Hint param={param} />
    </div>
  )
}

/** Select como dropdown, segmented ou cards (widget). */
export function SelectField({
  param,
  value,
  onChange,
  optionLabel,
}: FieldProps & { optionLabel?: (opt: string) => string }): React.JSX.Element {
  const id = `f-${param.key}`
  const options = param.options ?? []
  const labelOf = (opt: string): string => (optionLabel ? optionLabel(opt) : opt)
  if (param.widget === 'segmented') {
    return (
      <div>
        <FieldLabel param={param} htmlFor={id} />
        <div className="flex flex-wrap gap-1 rounded-md border border-border bg-surface p-1" role="group" data-testid={`param-${param.key}`}>
          {options.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => onChange(opt)}
              data-testid={`param-${param.key}-${opt}`}
              data-selected={String(value) === opt}
              className={cn(
                'rounded px-3 py-1.5 text-sm',
                String(value) === opt ? 'bg-accent text-white' : 'text-text hover:bg-surface-2',
              )}
            >
              {labelOf(opt)}
            </button>
          ))}
        </div>
        <Hint param={param} />
      </div>
    )
  }
  if (param.widget === 'cards') {
    return (
      <div>
        <FieldLabel param={param} htmlFor={id} />
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5" data-testid={`param-${param.key}`}>
          {options.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => onChange(opt)}
              data-testid={`param-${param.key}-${opt}`}
              data-selected={String(value) === opt}
              className={cn(
                'rounded-md border px-2 py-3 text-center text-sm',
                String(value) === opt
                  ? 'border-accent bg-accent/10 text-accent'
                  : 'border-border text-text hover:border-text-muted',
              )}
            >
              {labelOf(opt)}
            </button>
          ))}
        </div>
        <Hint param={param} />
      </div>
    )
  }
  return (
    <div>
      <FieldLabel param={param} htmlFor={id} />
      <select
        id={id}
        value={String(value ?? '')}
        onChange={(e) => onChange(e.target.value)}
        className={cn(inputCls, 'w-64')}
        data-testid={`param-${param.key}`}
      >
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {labelOf(opt)}
          </option>
        ))}
      </select>
      <Hint param={param} />
    </div>
  )
}

/** Seletor de arquivo único com filtro por extensão (ParamFile). */
export function FileField({ param, value, onChange }: FieldProps): React.JSX.Element {
  const id = `f-${param.key}`
  const pick = async (): Promise<void> => {
    const files = await getBackend().pickFiles()
    if (files.length === 0) return
    const accept = (param.accept ?? []).map((a) => a.toLowerCase())
    const match = accept.length === 0
      ? files[0]
      : (files.find((f) => accept.some((a) => f.toLowerCase().endsWith(a))) ?? files[0])
    onChange(match)
  }
  return (
    <div>
      <FieldLabel param={param} htmlFor={id} />
      <button
        id={id}
        type="button"
        onClick={() => void pick()}
        className="flex w-full items-center gap-2 rounded-md border border-border px-3 py-2 text-left text-sm text-text hover:border-accent"
        data-testid={`param-${param.key}`}
      >
        <FilePlus2 className="h-4 w-4 shrink-0 text-text-muted" />
        <span className="truncate">{String(value ?? '') || useLabel(param)}</span>
      </button>
      <Hint param={param} />
    </div>
  )
}

/** Pasta de destino (outputDir) — exibida uma vez no rodapé dos layouts. */
export function OutputDirField({ value, onChange }: { value: unknown; onChange: (v: string) => void }): React.JSX.Element {
  const { t } = useTranslation()
  return (
    <button
      type="button"
      onClick={async () => {
        const folder = await getBackend().pickFolder()
        if (folder) onChange(folder)
      }}
      title={t('common.outputDir')}
      className="flex shrink-0 items-center gap-2 rounded-md border border-border px-3 py-2 text-left text-sm text-text hover:border-accent"
      data-testid="output-dir"
    >
      <FolderOpen className="h-4 w-4 shrink-0 text-text-muted" />
      <span className="max-w-48 truncate">{String(value ?? '') || t('common.outputDirHint')}</span>
    </button>
  )
}

/** Despacha o campo certo para cada param. */
export function ParamField(props: FieldProps & { optionLabel?: (opt: string) => string }): React.JSX.Element | null {
  const { param } = props
  switch (param.type) {
    case 'select':
      return <SelectField {...props} />
    case 'number':
      return <NumberField {...props} />
    case 'bool':
      return <BoolField {...props} />
    case 'text':
    case 'password':
    case 'textarea':
      return <TextField {...props} />
    case 'file':
      return <FileField {...props} />
    case 'output':
    case 'folder':
      // output/outputDir são tratados pelos layouts (destino único) — nunca aqui
      return null
    default:
      return null
  }
}

/** Filtra params visíveis (VisibleIf) e separa destino (outputDir/output). */
export function splitParams(
  params: ToolParam[],
  values: Record<string, unknown>,
): { visible: ToolParam[]; hasDest: boolean } {
  const visible = params.filter((p) => {
    if (p.key === 'outputDir' || p.type === 'output' || p.type === 'folder') return false
    if (!p.visibleIf) return true
    return values[p.visibleIf.key] === p.visibleIf.equals
  })
  const hasDest = params.some((p) => p.key === 'outputDir' || p.type === 'output' || p.type === 'folder')
  return { visible, hasDest }
}

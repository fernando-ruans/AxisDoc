export interface ToolParam {
  key: string
  label: string
  type: 'select' | 'number' | 'bool' | 'text' | 'output' | 'folder' | 'password' | 'file' | 'textarea'
  options?: string[]
  default?: unknown
  required?: boolean
  min?: number
  max?: number
  placeholder?: string
  hint?: string
  visibleIf?: { key: string; equals: unknown }
  accept?: string[]
  widget?: '' | 'slider' | 'segmented' | 'cards' | 'switch'
}

export interface ToolInfo {
  id: string
  category: string
  titleKey: string
  descKey: string
  icon: string
  stepNames: string[]
  params?: ToolParam[]
  frontendDriven?: boolean
}

export interface PreviewRef {
  token: string
  name: string
  path?: string
}

export interface StructuredSummary {
  kind: 'table' | 'pdf'
  rows: number
  cols: number
  sample: string[][]
  pages: number
  title: string
}

export interface Job {
  id: string
  toolId: string
  status: 'queued' | 'running' | 'done' | 'failed' | 'canceled'
  input: Record<string, unknown>
  output?: Record<string, unknown>
  error?: string
  progress: number
  createdAt: string
  updatedAt: string
}

export interface JobInput {
  paths?: string[]
  params?: Record<string, unknown>
}

/**
 * Contrato do backend. A implementação real usa os bindings gerados pelo
 * Wails (window.go); os testes injetam fakes via setBackend().
 */
export interface Backend {
  listTools(): Promise<ToolInfo[]>
  enqueue(toolId: string, input: JobInput): Promise<Job>
  cancel(id: string): Promise<void>
  listJobs(limit: number): Promise<Job[]>
  pickFiles(): Promise<string[]>
  pickFolder(): Promise<string>
  savePath(defaultName: string): Promise<string>
  version(): Promise<string>
  ping(): Promise<string>
  checkUpdate(): Promise<{ hasUpdate: boolean; tag: string }>
  deleteJob(id: string): Promise<void>
  clearHistory(): Promise<void>
  openPath(path: string): Promise<void>
  revealInFolder(path: string): Promise<void>
  registerPreviewFiles(paths: string[]): Promise<PreviewRef[]>
  previewText(token: string, maxLines: number): Promise<string>
  previewSummary(token: string): Promise<StructuredSummary>
  previewFor(toolId: string, params: Record<string, unknown>): Promise<string>
  previewTransform(toolId: string, path: string, params: Record<string, unknown>): Promise<string>
  previewRender(toolId: string, path: string, params: Record<string, unknown>, page: number): Promise<string>
  saveRenderedPage(outputDir: string, baseName: string, page: number, ext: string, base64: string): Promise<string>
  pdfEditRemove(pdfPath: string, range: string, outputDir: string): Promise<string[]>
  pdfEditReorder(pdfPath: string, order: string, outputDir: string): Promise<string[]>
  pdfEditRotate(pdfPath: string, rots: Array<{ page: number; angle: number }>, outputDir: string): Promise<string[]>
  pdfEditInsertBlank(pdfPath: string, count: number, outputDir: string): Promise<string[]>
  onEvent(name: string, cb: (data: unknown) => void): () => void
}

let backend: Backend | null = null

export function getBackend(): Backend {
  if (backend) return backend
  throw new Error('backend não inicializado')
}

export function setBackend(b: Backend): void {
  backend = b
}

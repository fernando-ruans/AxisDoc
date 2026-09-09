import type { Backend, Job, JobInput, Pipeline, PreviewRef, SearchHit, StructuredSummary, ToolInfo, WatchRuleOut } from './backend'

// Mock do backend para E2E (Playwright) e desenvolvimento sem Wails.
// Roda em memória, simula progresso com timers.

const mockTools: ToolInfo[] = [
  {
    id: 'security.hashfile',
    category: 'security',
    titleKey: 'tool.hashfile.title',
    descKey: 'tool.hashfile.desc',
    icon: 'fingerprint',
    stepNames: ['step.hashfile.compute'],
    params: [
      { key: 'algorithm', label: 'param.algorithm.label', type: 'select', options: ['sha256', 'sha512', 'sha1', 'md5', 'crc32'], default: 'sha256' },
      { key: 'outputPath', label: 'tool.hashfile.saveOutput', type: 'output' },
    ],
  },
]

const FIXTURE_HASHES: Record<string, string> = {
  'amostra.txt': 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
  'relatorio.pdf': 'ca3d1f5f2f4c2f4b1e9a0d3c8f7b6a5d4e3f2c1b0a9f8e7d6c5b4a3f2e1d0c9b',
}

export class MockBackend implements Backend {
  private listeners = new Map<string, Set<(data: unknown) => void>>()
  private jobs = new Map<string, Job>()
  private counter = 0

  async listTools(): Promise<ToolInfo[]> {
    return mockTools
  }

  async enqueue(toolId: string, input: JobInput): Promise<Job> {
    const id = `mock-${++this.counter}`
    const job: Job = {
      id,
      toolId,
      status: 'queued',
      input: input as Record<string, unknown>,
      progress: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    this.jobs.set(id, job)
    this.emit('job:queued', job)
    void this.simulate(job)
    return job
  }

  private async simulate(job: Job): Promise<void> {
    const update = (patch: Partial<Job>) => {
      Object.assign(job, patch, { updatedAt: new Date().toISOString() })
    }
    update({ status: 'running' })
    this.emit('job:started', { id: job.id, toolId: job.toolId })
    for (let pct = 0; pct <= 100; pct += 25) {
      await new Promise((r) => setTimeout(r, 60))
      if (job.status === 'canceled') return
      update({ progress: pct })
      this.emit('job:progress', { id: job.id, progress: pct })
    }
    const paths = (job.input.paths as string[] | undefined) ?? []
    const algorithm =
      (job.input.params as Record<string, unknown> | undefined)?.algorithm as string | undefined ??
      'sha256'
    const lines = paths.map((p) => {
      const name = p.split(/[\\/]/).pop() ?? p
      const hash = FIXTURE_HASHES[name] ?? 'deadbeef'.repeat(8)
      return `${hash}  ${p} (${algorithm})`
    })
    update({
      status: 'done',
      progress: 100,
      output: { paths: [], message: lines.join('\n') },
    })
    this.emit('job:done', { id: job.id, status: 'done', output: { message: lines.join('\n') } })
  }

  async cancel(id: string): Promise<void> {
    const job = this.jobs.get(id)
    if (!job) throw new Error('não encontrado')
    job.status = 'canceled'
    this.emit('job:done', { id, status: 'canceled' })
  }

  async listJobs(limit: number): Promise<Job[]> {
    return [...this.jobs.values()].slice(-limit).reverse()
  }

  async pickFiles(): Promise<string[]> {
    return ['C:/fixtures/amostra.txt', 'C:/fixtures/relatorio.pdf']
  }

  async pickFolder(): Promise<string> {
    return 'C:/fixtures'
  }

  async savePath(defaultName: string): Promise<string> {
    return `C:/fixtures/${defaultName}`
  }

  async version(): Promise<string> {
    return '0.1.0-mock'
  }

  async ping(): Promise<string> {
    return 'pong'
  }

  async checkUpdate(): Promise<{ hasUpdate: boolean; tag: string }> {
    return { hasUpdate: false, tag: '' }
  }

  async deleteJob(id: string): Promise<void> {
    this.jobs.delete(id)
  }

  async clearHistory(): Promise<void> {
    this.jobs.clear()
  }

  async openPath(_path: string): Promise<void> {
    // noop no mock
  }

  async revealInFolder(_path: string): Promise<void> {
    // noop no mock
  }

  async registerPreviewFiles(paths: string[]): Promise<PreviewRef[]> {
    return paths.map((p, i) => ({
      token: `mock-token-${i}`,
      name: p.split(/[\\/]/).pop() ?? p,
      path: p,
    }))
  }

  async previewText(token: string, _maxLines: number): Promise<string> {
    return `conteúdo mock de ${token}\nlinha 1\nlinha 2`
  }

  async previewSummary(token: string): Promise<StructuredSummary> {
    if (token.endsWith?.('.pdf') || token.includes('pdf')) {
      return { kind: 'pdf', rows: 0, cols: 0, sample: [], pages: 3, title: 'mock.pdf' }
    }
    return {
      kind: 'table', rows: 3, cols: 2, pages: 0, title: '',
      sample: [['nome', 'idade'], ['Ana', '30'], ['Bruno', '25']],
    }
  }

  async previewFor(_toolId: string, _params: Record<string, unknown>): Promise<string> {
    // 1x1 PNG transparente como placeholder
    return 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
  }

  async previewTransform(_toolId: string, _path: string, _params: Record<string, unknown>): Promise<string> {
    return 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
  }

  async saveRenderedPage(outputDir: string, baseName: string, page: number, ext: string, _base64: string): Promise<string> {
    return `${outputDir}/${baseName}_p${String(page).padStart(2, '0')}.${ext}`
  }

  async searchQuery(_q: string, _limit: number): Promise<SearchHit[]> {
    return [
      { docId: 'd1', path: 'C:/fixtures/doc.txt', title: 'doc.txt', snippet: 'trecho ▶exemplo◀ …', rank: 0.1 },
    ]
  }

  async searchCount(): Promise<number> {
    return 1
  }

  async pipelineList(): Promise<Pipeline[]> {
    return []
  }

  async pipelineSave(_p: Pipeline): Promise<void> {
    // noop
  }

  async pipelineDelete(_id: string): Promise<void> {
    // noop
  }

  async pipelineRun(_p: Pipeline, _paths: string[]): Promise<{ paths: string[]; message: string }> {
    return { paths: [], message: 'macro executada (mock)' }
  }

  async watchList(): Promise<WatchRuleOut[]> {
    return []
  }

  async watchAdd(_folder: string, _pattern: string, _p: Pipeline): Promise<void> {
    // noop
  }

  async watchRemove(_id: string): Promise<void> {
    // noop
  }

  async pdfEditRemove(_pdfPath: string, _range: string, _outputDir: string): Promise<string[]> {
    return ['C:/fixtures/editado.pdf']
  }

  async pdfEditReorder(_pdfPath: string, _order: string, _outputDir: string): Promise<string[]> {
    return ['C:/fixtures/editado.pdf']
  }

  async pdfEditRotate(
    _pdfPath: string,
    _rots: Array<{ page: number; angle: number }>,
    _outputDir: string,
  ): Promise<string[]> {
    return ['C:/fixtures/editado.pdf']
  }

  async pdfEditInsertBlank(_pdfPath: string, _count: number, _outputDir: string): Promise<string[]> {
    return ['C:/fixtures/editado.pdf']
  }

  onEvent(name: string, cb: (data: unknown) => void): () => void {
    if (!this.listeners.has(name)) this.listeners.set(name, new Set())
    this.listeners.get(name)!.add(cb)
    return () => this.listeners.get(name)?.delete(cb)
  }

  private emit(name: string, data: unknown): void {
    this.listeners.get(name)?.forEach((cb) => cb(data))
  }
}

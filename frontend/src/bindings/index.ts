import type { Backend } from './backend'
import { MockBackend } from './mockBackend'

// Detecta modo E2E: sem bindings Wails ou com flag ?mock na URL.
export function detectBackend(): Backend {
  const params = new URLSearchParams(window.location.search)
  if (params.has('mock')) return new MockBackend()
  // Wails injeta window.go e window.runtime quando compilado
  const w = window as unknown as { go?: unknown; runtime?: unknown }
  if (w.go && w.runtime) {
    return createWailsBackend()
  }
  // dev server sem Wails: usa mock para permitir desenvolvimento de UI
  return new MockBackend()
}

function createWailsBackend(): Backend {
  const w = window as unknown as {
    go: Record<string, Record<string, Record<string, (...args: unknown[]) => Promise<unknown>>>>
    runtime: {
      EventsOn: (name: string, cb: (...data: unknown[]) => void) => () => void
    }
  }
  // bindings vivem em window.go.<package>.<Service>.<Method>
  const call = <T>(service: string, method: string, ...args: unknown[]): Promise<T> => {
    for (const pkg of Object.values(w.go)) {
      const svc = pkg?.[service]
      if (svc && typeof svc[method] === 'function') {
        return svc[method](...args) as Promise<T>
      }
    }
    return Promise.reject(new Error(`binding ausente: ${service}.${method}`))
  }
  return {
    listTools: () => call('ToolService', 'ListTools'),
    enqueue: (toolId, input) => call('JobService', 'Enqueue', toolId, input),
    cancel: (id) => call('JobService', 'Cancel', id),
    listJobs: (limit) => call('JobService', 'ListJobs', limit),
    pickFiles: () => call('SystemService', 'PickFiles'),
    pickFolder: () => call('SystemService', 'PickFolder'),
    savePath: (name) => call('SystemService', 'SavePath', name),
    version: () => call('SystemService', 'Version'),
    ping: () => call('SystemService', 'Ping'),
    checkUpdate: () => call('SystemService', 'CheckUpdate'),
    deleteJob: (id) => call('JobService', 'DeleteJob', id),
    clearHistory: () => call('JobService', 'ClearHistory'),
    openPath: (path) => call('SystemService', 'OpenPath', path),
    revealInFolder: (path) => call('SystemService', 'RevealInFolder', path),
    registerPreviewFiles: (paths) => call('SystemService', 'RegisterPreviewFiles', paths),
    previewText: (token, maxLines) => call('SystemService', 'PreviewText', token, maxLines),
    previewSummary: (token) => call('SystemService', 'PreviewSummary', token),
    previewFor: (toolId, params) => call('SystemService', 'PreviewFor', toolId, params),
    previewTransform: (toolId, path, params) => call('SystemService', 'PreviewTransform', toolId, path, params),
    previewRender: (toolId, path, params, page) => call('SystemService', 'PreviewRender', toolId, path, params, page),
    saveRenderedPage: (outputDir, baseName, page, ext, base64) =>
      call('SystemService', 'SaveRenderedPage', outputDir, baseName, page, ext, base64),
    searchQuery: (q, limit) => call('SearchService', 'Query', q, limit),
    searchCount: () => call('SearchService', 'Count'),
    pipelineList: () => call('PipelineService', 'List'),
    pipelineSave: (p) => call('PipelineService', 'Save', p),
    pipelineDelete: (id) => call('PipelineService', 'Delete', id),
    pipelineRun: (p, paths) => call('PipelineService', 'Run', p, paths),
    watchList: () => call('WatchService', 'ListRules'),
    watchAdd: (folder, pattern, p) => call('WatchService', 'AddRule', folder, pattern, p),
    watchRemove: (id) => call('WatchService', 'RemoveRule', id),
    pdfEditRemove: (pdfPath, range, outputDir) => call('PdfEditService', 'Remove', pdfPath, range, outputDir),
    pdfEditReorder: (pdfPath, order, outputDir) => call('PdfEditService', 'Reorder', pdfPath, order, outputDir),
    pdfEditRotate: (pdfPath, rots, outputDir) => call('PdfEditService', 'Rotate', pdfPath, rots, outputDir),
    pdfEditInsertBlank: (pdfPath, count, outputDir) => call('PdfEditService', 'InsertBlank', pdfPath, count, outputDir),
    onEvent: (name, cb) => w.runtime.EventsOn(name, cb),
  }
}

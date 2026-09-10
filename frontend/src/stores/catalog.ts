import { create } from 'zustand'
import type { ToolInfo } from '../bindings/backend'
import { FRONTEND_TOOLS } from '../tools/frontendTools'

interface CatalogState {
  tools: ToolInfo[]
  loading: boolean
  error: string | null
  load: () => Promise<void>
}

// mesma ordem do backend (registry.List): categoria, depois ID
function byCategoryThenId(a: ToolInfo, b: ToolInfo): number {
  if (a.category !== b.category) return a.category < b.category ? -1 : 1
  return a.id < b.id ? -1 : 1
}

export const useCatalog = create<CatalogState>((set) => ({
  tools: [],
  loading: true,
  error: null,
  load: async () => {
    try {
      const { getBackend } = await import('../bindings/backend')
      const tools = await getBackend().listTools()
      // mescla as tools frontend-driven (ausentes do registry do backend)
      const merged = [...tools, ...FRONTEND_TOOLS.filter((f) => !tools.some((b) => b.id === f.id))]
      merged.sort(byCategoryThenId)
      set({ tools: merged, loading: false, error: null })
    } catch (e) {
      set({ error: String(e), loading: false })
    }
  },
}))

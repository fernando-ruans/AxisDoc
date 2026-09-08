import { create } from 'zustand'
import type { ToolInfo } from '../bindings/backend'

interface CatalogState {
  tools: ToolInfo[]
  loading: boolean
  error: string | null
  load: () => Promise<void>
}

export const useCatalog = create<CatalogState>((set) => ({
  tools: [],
  loading: true,
  error: null,
  load: async () => {
    try {
      const { getBackend } = await import('../bindings/backend')
      const tools = await getBackend().listTools()
      set({ tools, loading: false, error: null })
    } catch (e) {
      set({ error: String(e), loading: false })
    }
  },
}))

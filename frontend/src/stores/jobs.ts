import { create } from 'zustand'
import type { Job, JobInput } from '../bindings/backend'

interface JobsState {
  jobs: Job[]
  add: (job: Job) => void
  patch: (id: string, patch: Partial<Job>) => void
  enqueue: (toolId: string, input: JobInput) => Promise<Job>
  cancel: (id: string) => Promise<void>
  refresh: () => Promise<void>
  deleteJob: (id: string) => Promise<void>
  clearHistory: () => Promise<void>
}

export const useJobs = create<JobsState>((set, get) => ({
  jobs: [],
  add: (job) => set((s) => ({ jobs: [job, ...s.jobs] })),
  patch: (id, patch) =>
    set((s) => ({
      jobs: s.jobs.map((j) => (j.id === id ? { ...j, ...patch } : j)),
    })),
  enqueue: async (toolId, input) => {
    const { getBackend } = await import('../bindings/backend')
    const job = await getBackend().enqueue(toolId, input)
    // evita duplicar se o evento job:queued já adicionou
    if (!get().jobs.some((j) => j.id === job.id)) {
      get().add(job)
    }
    return job
  },
  cancel: async (id) => {
    const { getBackend } = await import('../bindings/backend')
    await getBackend().cancel(id)
    get().patch(id, { status: 'canceled' })
  },
  refresh: async () => {
    const { getBackend } = await import('../bindings/backend')
    const jobs = await getBackend().listJobs(50)
    set({ jobs })
  },
  deleteJob: async (id) => {
    const { getBackend } = await import('../bindings/backend')
    await getBackend().deleteJob(id)
    set((s) => ({ jobs: s.jobs.filter((j) => j.id !== id) }))
  },
  clearHistory: async () => {
    const { getBackend } = await import('../bindings/backend')
    await getBackend().clearHistory()
    set({ jobs: [] })
  },
}))

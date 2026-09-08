import { useEffect } from 'react'
import { useJobs } from './stores/jobs'
import { getBackend } from './bindings/backend'
import { AppShell } from './components/AppShell'
import './i18n'
import { useTheme } from './stores/theme'

export default function App(): React.JSX.Element {
  const initTheme = useTheme((s) => s.init)

  useEffect(() => {
    initTheme()
    const { add, patch, refresh } = useJobs.getState()
    void refresh()
    const offs = [
      getBackend().onEvent('job:queued', (data) => add(data as never)),
      getBackend().onEvent('job:started', (data) => {
        const d = data as { id: string }
        patch(d.id, { status: 'running' })
      }),
      getBackend().onEvent('job:progress', (data) => {
        const d = data as { id: string; progress: number }
        patch(d.id, { progress: d.progress })
      }),
      getBackend().onEvent('job:done', (data) => {
        const d = data as {
          id: string
          status: string
          output?: { message?: string; paths?: string[] }
        }
        patch(d.id, {
          status: d.status as never,
          output: d.output
            ? { message: d.output.message ?? '', paths: d.output.paths ?? [] }
            : undefined,
          progress: d.status === 'done' ? 100 : undefined,
        })
      }),
    ]
    return () => offs.forEach((off) => off())
  }, [initTheme])

  return <AppShell />
}

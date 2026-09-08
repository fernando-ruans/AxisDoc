import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from '../App'
import { setBackend } from '../bindings/backend'
import type { Backend, Job } from '../bindings/backend'
import { MockBackend } from '../bindings/mockBackend'

afterEach(() => cleanup())

function makeBackend(overrides: Partial<Backend> = {}): Backend {
  const base = new MockBackend() as unknown as Record<string, unknown>
  const obj = Object.create(Object.getPrototypeOf(base)) as Record<string, unknown>
  Object.assign(obj, base)
  for (const [k, v] of Object.entries(overrides)) {
    if (v !== undefined) obj[k] = v
  }
  return obj as unknown as Backend
}

describe('AppShell', () => {
  beforeEach(() => {
    localStorage.clear()
    setBackend(makeBackend())
  })

  it('renderiza sidebar com o nome do app', async () => {
    render(<App />)
    expect(await screen.findByTestId('sidebar')).toBeInTheDocument()
    expect(screen.getAllByText('AxisDoc').length).toBeGreaterThan(0)
  })

  it('carrega a lista de ferramentas do backend', async () => {
    render(<App />)
    await waitFor(() =>
      expect(screen.getByTestId('tool-security.hashfile')).toBeInTheDocument(),
    )
  })

  it('mostra erro quando o backend falha ao listar', async () => {
    setBackend(makeBackend({ listTools: () => Promise.reject(new Error('boom')) }))
    render(<App />)
    await waitFor(() => expect(screen.getByTestId('catalog-error')).toBeInTheDocument())
    expect(screen.getByTestId('catalog-error').textContent).toContain('boom')
  })

  it('abre a command palette com Ctrl+K', async () => {
    const user = userEvent.setup()
    render(<App />)
    await waitFor(() => expect(screen.getByTestId('tool-security.hashfile')).toBeInTheDocument())
    await user.keyboard('{Control>}k')
    expect(screen.getByTestId('command-palette')).toBeInTheDocument()
  })

  it('filtra ferramentas na palette e abre ao Enter', async () => {
    const user = userEvent.setup()
    render(<App />)
    await waitFor(() => expect(screen.getByTestId('tool-security.hashfile')).toBeInTheDocument())
    await user.click(screen.getByTestId('open-palette'))
    const input = screen.getByTestId('palette-input')
    await user.type(input, 'hash{Enter}')
    await waitFor(() => expect(screen.getByTestId('tool-page')).toBeInTheDocument())
    expect(screen.getByTestId('tool-page')).toHaveTextContent('Hash de arquivos')
  })

  it('navega para as páginas Busca, Macros e Watch', async () => {
    const user = userEvent.setup()
    render(<App />)
    await waitFor(() => expect(screen.getByTestId('nav-search')).toBeInTheDocument())

    await user.click(screen.getByTestId('nav-search'))
    expect(await screen.findByTestId('search-page')).toBeInTheDocument()
    await user.click(screen.getByTestId('nav-pipelines'))
    expect(await screen.findByTestId('pipelines-page')).toBeInTheDocument()
    expect(await screen.findByText('Nenhuma macro salva')).toBeInTheDocument()
    await user.click(screen.getByTestId('nav-watch'))
    expect(await screen.findByTestId('watch-page')).toBeInTheDocument()
    expect(await screen.findByText('Nenhuma regra ativa')).toBeInTheDocument()
  })

  it('mostra "nenhuma ferramenta" quando a busca não encontra nada', async () => {
    const user = userEvent.setup()
    render(<App />)
    await waitFor(() => expect(screen.getByTestId('tool-security.hashfile')).toBeInTheDocument())
    await user.click(screen.getByTestId('open-palette'))
    await user.type(screen.getByTestId('palette-input'), 'zzzz')
    expect(screen.getByText('Nenhuma ferramenta encontrada')).toBeInTheDocument()
  })
})

describe('GenericToolForm (hashfile)', () => {
  beforeEach(() => {
    localStorage.clear()
    setBackend(makeBackend())
  })

  it('exibe o resultado na própria aba após executar', async () => {
    const user = userEvent.setup()
    render(<App />)
    await waitFor(() => expect(screen.getByTestId('tool-security.hashfile')).toBeInTheDocument())
    await user.click(screen.getByTestId('tool-security.hashfile'))
    await user.click(screen.getByTestId('pick-files'))
    await user.click(screen.getByTestId('run-tool'))
    // resultado aparece inline, sem ir para Jobs
    const inline = await screen.findByTestId('inline-result', undefined, { timeout: 5000 })
    expect(inline).toBeInTheDocument()
    expect(await screen.findByTestId('inline-message')).toHaveTextContent('amostra.txt')
  })

  it('desabilita o botão sem arquivos selecionados', async () => {
    const user = userEvent.setup()
    render(<App />)
    await waitFor(() => expect(screen.getByTestId('tool-security.hashfile')).toBeInTheDocument())
    await user.click(screen.getByTestId('tool-security.hashfile'))
    expect(screen.getByTestId('run-tool')).toBeDisabled()
  })

  it('mostra preview dos arquivos selecionados', async () => {
    const user = userEvent.setup()
    render(<App />)
    await waitFor(() => expect(screen.getByTestId('tool-security.hashfile')).toBeInTheDocument())
    await user.click(screen.getByTestId('tool-security.hashfile'))
    await user.click(screen.getByTestId('pick-files'))
    await waitFor(() => expect(screen.getByTestId('file-preview')).toBeInTheDocument())
    expect(screen.getByTestId('preview-text')).toBeInTheDocument()
  })

  it('exibe os arquivos de saída com botões abrir/pasta/copiar', async () => {
    const fakeJobs: Job[] = [
      {
        id: 'j1',
        toolId: 'security.hashfile',
        status: 'done',
        input: {},
        output: { message: 'ok', paths: ['C:/saida/a.pdf', 'C:/saida/b.pdf'] },
        progress: 100,
        createdAt: '',
        updatedAt: '',
      },
    ]
    setBackend(makeBackend({ listJobs: async () => fakeJobs }))
    const user = userEvent.setup()
    render(<App />)
    await user.click(await screen.findByTestId('toggle-jobs'))
    expect(await screen.findByTestId('job-paths-j1')).toBeInTheDocument()
    expect(screen.getAllByTestId('job-open')).toHaveLength(2)
    expect(screen.getAllByTestId('job-open-folder')).toHaveLength(2)
    expect(screen.getAllByTestId('job-copy-path')).toHaveLength(2)
  })

  it('alterna o tema', async () => {
    const user = userEvent.setup()
    render(<App />)
    await waitFor(() => expect(screen.getByTestId('toggle-theme')).toBeInTheDocument())
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    await user.click(screen.getByTestId('toggle-theme'))
    expect(document.documentElement.classList.contains('dark')).toBe(false)
    expect(localStorage.getItem('axisdoc.theme')).toBe('light')
  })
})

describe('MockBackend', () => {
  it('emite eventos de progresso até done', async () => {
    const b = new MockBackend()
    const events: string[] = []
    b.onEvent('job:progress', () => events.push('progress'))
    b.onEvent('job:done', () => events.push('done'))
    const job = await b.enqueue('security.hashfile', { paths: ['x.txt'] })
    await waitFor(
      () => {
        expect(job.status).toBe('done')
      },
      { timeout: 3000 },
    )
    expect(events).toContain('done')
    await expect(b.ping()).resolves.toBe('pong')
  })

  it('cancela job', async () => {
    const b = new MockBackend()
    const job = await b.enqueue('security.hashfile', { paths: [] })
    await b.cancel(job.id)
    expect((await b.listJobs(10)).find((j) => j.id === job.id)?.status).toBe('canceled')
  })
})

describe('i18n', () => {
  it('usa PT-BR por padrão', () => {
    localStorage.clear()
    setBackend(makeBackend())
    render(<App />)
    expect(screen.getAllByText('AxisDoc').length).toBeGreaterThan(0)
    expect(
      screen.getAllByText('Kit de ferramentas de escritório — 100% offline').length,
    ).toBeGreaterThan(0)
  })
})

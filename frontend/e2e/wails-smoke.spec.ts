import { test, expect } from '@playwright/test'

// Smoke E2E contra o backend REAL (wails dev em http://localhost:34115).
// Requer `wails dev` rodando. Valida o contrato frontend↔backend real.

test.describe.configure({ mode: 'serial' })

test('backend real responde ping e lista ferramentas', async ({ page }) => {
  await page.goto('http://localhost:34115')
  await expect(page.getByTestId('sidebar')).toBeVisible({ timeout: 20_000 })
  await expect(page.getByTestId('tool-security.hashfile')).toBeVisible({ timeout: 20_000 })
})

test('executa hash na tool real', async ({ page }) => {
  await page.goto('http://localhost:34115')
  await expect(page.getByTestId('tool-security.hashfile')).toBeVisible({ timeout: 20_000 })
  await page.getByTestId('tool-security.hashfile').click()
  // diálogo nativo não abre em headless: injeta paths direto pelo enfileiramento
  // (o fluxo completo com diálogo é validado manualmente no checklist de release)
  const executed = await page.evaluate(async () => {
    const w = window as unknown as {
      go: Record<string, Record<string, Record<string, (...args: unknown[]) => Promise<unknown>>>>
    }
    const job = (await w.go.main.JobService.Enqueue('security.hashfile', {
      paths: ['C:\\Windows\\win.ini'],
      params: { algorithm: 'sha256' },
    })) as { id: string }
    return job.id
  })
  expect(executed).toBeTruthy()

  await page.getByTestId('nav-jobs').click()
  const result = page.getByTestId(`job-result-${executed}`)
  await expect(result).toBeVisible({ timeout: 15_000 })
  await expect(result).toContainText('win.ini', { ignoreCase: true })
})

// Catálogo real: toda tool tem label resolvido (sem chave crua).
test('catálogo real renderiza labels resolvidos', async ({ page }) => {
  await page.goto('http://localhost:34115')
  await expect(page.getByTestId('sidebar')).toBeVisible({ timeout: 20_000 })
  const tools = await page.evaluate(async () => {
    const w = window as unknown as {
      go: Record<string, Record<string, Record<string, (...args: unknown[]) => Promise<unknown>>>>
    }
    return (await w.go.main.ToolService.ListTools()) as Array<{
      id: string
      titleKey: string
      params: Array<{ key: string; label: string; type: string; options?: string[] }>
    }>
  })
  expect(tools.length).toBeGreaterThanOrEqual(22)
  // params serializam com keys minúsculas (contrato TS)
  for (const t of tools) {
    expect(t.id, 'tool sem id').toBeTruthy()
    for (const p of t.params ?? []) {
      expect(p.key, `${t.id}: param sem key`).toBeTruthy()
      expect(p.label, `${t.id}.${p.key}: param sem label`).toBeTruthy()
      expect(
        ['select', 'number', 'bool', 'text', 'output', 'folder', 'password'],
        `${t.id}.${p.key}: type inválido`,
      ).toContain(p.type)
      if (p.type === 'select') {
        expect(p.options?.length, `${t.id}.${p.key}: select sem options`).toBeGreaterThan(0)
      }
    }
  }
})

// Converte imagem real PNG→JPG via backend.
test('img.convert real produz arquivo', async ({ page }) => {
  await page.goto('http://localhost:34115')
  await expect(page.getByTestId('sidebar')).toBeVisible({ timeout: 20_000 })
  const out = await page.evaluate(async () => {
    const w = window as unknown as {
      go: Record<string, Record<string, Record<string, (...args: unknown[]) => Promise<unknown>>>>
    }
    const job = (await w.go.main.JobService.Enqueue('img.convert', {
      paths: ['C:\\Windows\\Web\\Wallpaper\\Windows\\img0.jpg'],
      params: { format: 'png', quality: 85 },
    })) as { id: string }
    // aguarda done via polling
    for (let i = 0; i < 60; i++) {
      const jobs = (await w.go.main.JobService.ListJobs(10)) as Array<{
        id: string
        status: string
        output?: { paths?: string[] }
      }>
      const j = jobs.find((x) => x.id === job.id)
      if (j?.status === 'done') return j.output?.paths ?? []
      if (j?.status === 'failed' || j?.status === 'canceled') throw new Error(`job ${j.status}`)
      await new Promise((r) => setTimeout(r, 500))
    }
    throw new Error('timeout aguardando job')
  })
  expect(out.length).toBeGreaterThan(0)
})

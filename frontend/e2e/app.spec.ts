import { test, expect } from '@playwright/test'

// E2E contra o dev server do Vite com o backend mockado (MockBackend).
// O contrato frontend↔backend real é validado pelo smoke no wails dev.

test.beforeEach(async ({ page }) => {
  await page.goto('/?mock=1')
})

test('app carrega com sidebar e ferramentas', async ({ page }) => {
  await expect(page.getByTestId('sidebar')).toBeVisible()
  await expect(page.getByTestId('tool-security.hashfile')).toBeVisible()
})

test('fluxo completo: escolher ferramenta, calcular hash, ver resultado', async ({ page }) => {
  await page.getByTestId('tool-security.hashfile').click()
  await page.getByTestId('pick-files').click()
  await expect(page.getByTestId('selected-files')).toContainText('amostra.txt')
  // preview aparece para os arquivos selecionados
  await expect(page.getByTestId('file-preview')).toBeVisible()

  await page.getByTestId('run-tool').click()
  await page.getByTestId('toggle-jobs').click()

  const result = page.locator('[data-testid^="job-result-"]')
  await expect(result).toBeVisible({ timeout: 10_000 })
  await expect(result).toContainText('amostra.txt')
  await expect(result).toContainText('sha256')
})

test('navega para as páginas de Busca, Macros e Watch', async ({ page }) => {
  await page.getByTestId('nav-search').click()
  await expect(page.getByTestId('search-page')).toBeVisible()
  await expect(page.getByTestId('search-count')).toContainText('documentos indexados')

  await page.getByTestId('nav-pipelines').click()
  await expect(page.getByTestId('pipelines-page')).toBeVisible()

  await page.getByTestId('nav-watch').click()
  await expect(page.getByTestId('watch-page')).toBeVisible()
})

test('command palette abre e navega para ferramenta', async ({ page }) => {
  await page.getByTestId('open-palette').click()
  await page.getByTestId('palette-input').fill('hash')
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('tool-page')).toContainText('Hash de arquivos')
})

test('alternar tema persiste em localStorage', async ({ page }) => {
  await expect(page.locator('html')).toHaveClass(/dark/)
  await page.getByTestId('toggle-theme').click()
  await expect(page.locator('html')).not.toHaveClass(/dark/)
  const stored = await page.evaluate(() => localStorage.getItem('axisdoc.theme'))
  expect(stored).toBe('light')
})

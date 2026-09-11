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
  await page.getByTestId('nav-jobs').click()

  const result = page.locator('[data-testid^="job-result-"]')
  await expect(result).toBeVisible({ timeout: 10_000 })
  await expect(result).toContainText('amostra.txt')
  await expect(result).toContainText('sha256')
})

test('menu inferior tem só Início e Jobs', async ({ page }) => {
  await expect(page.getByTestId('nav-home')).toBeVisible()
  await expect(page.getByTestId('nav-jobs')).toBeVisible()
  await expect(page.getByTestId('nav-search')).toHaveCount(0)
  await expect(page.getByTestId('nav-pipelines')).toHaveCount(0)
  await expect(page.getByTestId('nav-watch')).toHaveCount(0)
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

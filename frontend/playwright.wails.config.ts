import { defineConfig, devices } from '@playwright/test'

// Config para smoke contra o wails dev server (backend real).
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  retries: 0,
  use: {
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'wails',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})

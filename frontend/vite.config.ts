import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    // threads é instável no Windows quando pdf.js entra no bundle de teste;
    // forks isola por processo e eliminou flakes do golden de preview.
    pool: 'forks',
    // o worker do pdf.js no jsdom é timing-dependente no CI (fake worker);
    // retry cobre os goldens de preview sem mascarar regressões locais.
    retry: process.env.CI ? 2 : 0,
    setupFiles: ['./src/test/setup.ts'],
    exclude: ['e2e/**', 'node_modules/**', 'dist/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/test/**', 'src/main.tsx'],
    },
  },
} as never)

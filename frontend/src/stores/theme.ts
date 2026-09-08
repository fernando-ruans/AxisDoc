import { create } from 'zustand'

type Theme = 'dark' | 'light'

interface ThemeState {
  theme: Theme
  toggle: () => void
  init: () => void
}

function apply(theme: Theme): void {
  document.documentElement.classList.toggle('dark', theme === 'dark')
  localStorage.setItem('axisdoc.theme', theme)
}

export const useTheme = create<ThemeState>((set, get) => ({
  theme: 'dark',
  toggle: () => {
    const next: Theme = get().theme === 'dark' ? 'light' : 'dark'
    set({ theme: next })
    apply(next)
  },
  init: () => {
    const saved = (localStorage.getItem('axisdoc.theme') as Theme | null) ?? 'dark'
    set({ theme: saved })
    apply(saved)
  },
}))

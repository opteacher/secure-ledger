import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export type ThemeMode = 'light' | 'dark'

const STORAGE_KEY = 'secure-ledger-theme'

export const useThemeStore = defineStore('theme', () => {
  const theme = ref<ThemeMode>('light')

  const isDark = computed(() => theme.value === 'dark')

  function applyTheme(value: ThemeMode): void {
    theme.value = value
    if (typeof document !== 'undefined') {
      const root = document.documentElement
      if (value === 'dark') {
        root.classList.add('dark')
      } else {
        root.classList.remove('dark')
      }
    }
    persist()
  }

  function setTheme(value: ThemeMode): void {
    applyTheme(value)
  }

  function toggleTheme(): void {
    applyTheme(theme.value === 'dark' ? 'light' : 'dark')
  }

  function persist(): void {
    try {
      localStorage.setItem(STORAGE_KEY, theme.value)
    } catch {
      // localStorage may be unavailable (Electron sandbox or test env)
    }
  }

  function loadTheme(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored === 'dark' || stored === 'light') {
        applyTheme(stored)
        return
      }
    } catch {
      applyTheme('light')
      return
    }
    const prefersDark =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches
    applyTheme(prefersDark ? 'dark' : 'light')
  }

  return {
    theme,
    isDark,
    setTheme,
    toggleTheme,
    loadTheme,
  }
})
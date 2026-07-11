import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useThemeStore } from '@/stores/theme'
import type { ThemeMode } from '@/stores/theme'

let store: ReturnType<typeof useThemeStore>

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  document.documentElement.classList.remove('dark')
  setActivePinia(createPinia())
  store = useThemeStore()
})

afterEach(() => {
  document.documentElement.classList.remove('dark')
  localStorage.clear()
})

describe('useThemeStore', () => {
  it('initializes with light theme by default', () => {
    expect(store.theme).toBe('light')
  })

  it('initializes isDark as false when theme is light', () => {
    expect(store.isDark).toBe(false)
  })

  describe('setTheme', () => {
    it('updates theme value to dark when called with dark', () => {
      store.setTheme('dark')
      expect(store.theme).toBe('dark')
      expect(store.isDark).toBe(true)
    })

    it('updates theme value to light when called with light', () => {
      store.setTheme('dark')
      store.setTheme('light')
      expect(store.theme).toBe('light')
      expect(store.isDark).toBe(false)
    })

    it('adds dark class to documentElement when set to dark', () => {
      store.setTheme('dark')
      expect(document.documentElement.classList.contains('dark')).toBe(true)
    })

    it('removes dark class from documentElement when set to light', () => {
      store.setTheme('dark')
      expect(document.documentElement.classList.contains('dark')).toBe(true)
      store.setTheme('light')
      expect(document.documentElement.classList.contains('dark')).toBe(false)
    })

    it('persists theme to localStorage', () => {
      store.setTheme('dark')
      expect(localStorage.getItem('secure-ledger-theme')).toBe('dark')
    })

    it('overwrites previous theme value in localStorage', () => {
      store.setTheme('dark')
      store.setTheme('light')
      expect(localStorage.getItem('secure-ledger-theme')).toBe('light')
    })

    it('does not throw when localStorage.setItem throws', () => {
      const originalSet = Storage.prototype.setItem
      Storage.prototype.setItem = vi.fn(() => {
        throw new Error('storage unavailable')
      })
      expect(() => store.setTheme('dark')).not.toThrow()
      Storage.prototype.setItem = originalSet
    })
  })

  describe('toggleTheme', () => {
    it('switches from light to dark', () => {
      store.toggleTheme()
      expect(store.theme).toBe('dark')
      expect(store.isDark).toBe(true)
    })

    it('switches from dark back to light', () => {
      store.setTheme('dark')
      store.toggleTheme()
      expect(store.theme).toBe('light')
      expect(store.isDark).toBe(false)
    })

    it('updates documentElement class on toggle', () => {
      expect(document.documentElement.classList.contains('dark')).toBe(false)
      store.toggleTheme()
      expect(document.documentElement.classList.contains('dark')).toBe(true)
      store.toggleTheme()
      expect(document.documentElement.classList.contains('dark')).toBe(false)
    })

    it('persists new theme to localStorage on each toggle', () => {
      store.toggleTheme()
      expect(localStorage.getItem('secure-ledger-theme')).toBe('dark')
      store.toggleTheme()
      expect(localStorage.getItem('secure-ledger-theme')).toBe('light')
    })
  })

  describe('loadTheme', () => {
    it('loads theme from localStorage when stored value is dark', () => {
      localStorage.setItem('secure-ledger-theme', 'dark')
      store.loadTheme()
      expect(store.theme).toBe('dark')
      expect(document.documentElement.classList.contains('dark')).toBe(true)
    })

    it('loads theme from localStorage when stored value is light', () => {
      localStorage.setItem('secure-ledger-theme', 'light')
      store.loadTheme()
      expect(store.theme).toBe('light')
      expect(document.documentElement.classList.contains('dark')).toBe(false)
    })

    it('falls back to light when localStorage is empty and no system preference', () => {
      const matchMediaSpy = vi.fn().mockReturnValue({ matches: false })
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        configurable: true,
        value: matchMediaSpy,
      })
      store.loadTheme()
      expect(store.theme).toBe('light')
      expect(document.documentElement.classList.contains('dark')).toBe(false)
    })

    it('applies system dark preference when available and no stored theme', () => {
      localStorage.clear()
      const matchMediaSpy = vi.fn().mockImplementation((query: string) => ({
        matches: query.includes('dark'),
      }))
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        configurable: true,
        value: matchMediaSpy,
      })
      store.loadTheme()
      expect(store.theme).toBe('dark')
      expect(document.documentElement.classList.contains('dark')).toBe(true)
    })

    it('falls back to light when localStorage.getItem throws', () => {
      const originalGet = Storage.prototype.getItem
      Storage.prototype.getItem = vi.fn(() => {
        throw new Error('storage unavailable')
      })
      const matchMediaSpy = vi.fn().mockReturnValue({ matches: false })
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        configurable: true,
        value: matchMediaSpy,
      })
      expect(() => store.loadTheme()).not.toThrow()
      expect(store.theme).toBe('light')
      Storage.prototype.getItem = originalGet
    })

    it('overwrites current state with stored value, even if different', () => {
      store.setTheme('dark')
      localStorage.setItem('secure-ledger-theme', 'light')
      store.loadTheme()
      expect(store.theme).toBe('light')
    })

    it('ignores invalid localStorage values and falls back to system', () => {
      localStorage.setItem('secure-ledger-theme', 'purple' as ThemeMode)
      const matchMediaSpy = vi.fn().mockReturnValue({ matches: false })
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        configurable: true,
        value: matchMediaSpy,
      })
      store.loadTheme()
      expect(store.theme).toBe('light')
    })
  })

  describe('idempotency', () => {
    it('calling setTheme with same value does not throw', () => {
      store.setTheme('dark')
      expect(() => store.setTheme('dark')).not.toThrow()
      expect(store.theme).toBe('dark')
    })

    it('toggling twice returns to original state', () => {
      const start = store.theme
      store.toggleTheme()
      store.toggleTheme()
      expect(store.theme).toBe(start)
    })

    it('consecutive setTheme calls converge to last value', () => {
      store.setTheme('dark')
      store.setTheme('light')
      store.setTheme('dark')
      store.setTheme('light')
      expect(store.theme).toBe('light')
      expect(localStorage.getItem('secure-ledger-theme')).toBe('light')
    })
  })
})
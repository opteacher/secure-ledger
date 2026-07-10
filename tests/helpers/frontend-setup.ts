/**
 * Frontend test setup for jsdom environment
 * Mocks window.ipc for Pinia stores and API wrappers
 */
import { vi } from 'vitest'

// Mock window.ipc which is normally injected by Electron's preload script
Object.defineProperty(window, 'ipc', {
  value: {
    invoke: vi.fn(async (channel: string, ...args: any[]) => {
      console.warn(`[MockIPC] Unhandled invoke: ${channel}`, args)
      return null
    }),
    on: vi.fn((channel: string, callback: Function) => {
      console.warn(`[MockIPC] Unhandled on: ${channel}`)
      return () => {}
    }),
    send: vi.fn((channel: string, ...args: any[]) => {
      console.warn(`[MockIPC] Unhandled send: ${channel}`, args)
    }),
  },
  writable: true,
  configurable: true,
})

// Mock ResizeObserver (not available in jsdom)
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}))

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}))

// Set test environment
process.env.NODE_ENV = 'test'

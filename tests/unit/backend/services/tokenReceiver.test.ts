/**
 * Token Receiver & Puppeteer Manager 服务单元测试
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import http from 'http'

vi.mock('../../../../electron/backend/services/endpointShare', () => ({
  validateImportConditions: vi.fn(() => Promise.resolve({
    valid: true, payload: { iat: Math.floor(Date.now() / 1000), jti: 'jti', version: '2.0', endpoint: { name: 'T', icon: 'i', login_type: 'web', pages: [] }, restrictions: { type: 'unlimited' }, usageCount: 0, publicKey: 'pk' },
  })),
  importEndpointFromToken: vi.fn(() => Promise.resolve({ id: 1, name: 'Test EP' })),
}))

vi.mock('../../../../electron/backend/utils/network', () => ({
  getLocalIPs: vi.fn(() => ['192.168.1.100']), areInSameSubnet: vi.fn(() => true),
}))

vi.mock('../../../../electron/backend/services/chromeVersion', () => ({
  getBrowserVersion: vi.fn(() => ({ path: '/ch', version: '120.0.0.0', majorVersion: 120 })),
  decidePuppeteerVersion: vi.fn(() => 'high'), CHROME_VERSION_THRESHOLD: 112,
}))

vi.mock('child_process', () => ({ execSync: vi.fn() }))

describe('tokenReceiver 服务', () => {
  let mockServer: any
  let mockListen: any

  beforeEach(async () => {
    vi.clearAllMocks()
    vi.resetModules() // clear module cache so tokenReceiver internal state resets
    // Event store shared by mockOn & mockOnce so mockListen can fire 'listening'
    const events: Record<string, Array<Function>> = {}
    const mockOn = vi.fn((event: string, handler: Function) => {
      ;(events[event] ??= []).push(handler)
    })
    const mockOnce = vi.fn((event: string, handler: Function) => {
      ;(events[event] ??= []).push(handler)
      mockOn(event, handler) // also track in on.mock.calls for test compat
    })
    mockListen = vi.fn((...args: any[]) => {
      const cb = args.find((a: any) => typeof a === 'function')
      setTimeout(() => {
        ;(events['listening'] || []).forEach((h) => h())
        events['listening'] = []
        cb?.()
      }, 0)
    })
    mockServer = {
      listen: mockListen,
      close: vi.fn((cb?: () => void) => { if (cb) setTimeout(cb, 0) }),
      on: mockOn,
      once: mockOnce,
    }
    vi.spyOn(http, 'createServer').mockReturnValue(mockServer as any)
  })

  describe('startTokenReceiver', () => {
    it('成功启动服务器', async () => {
      const { startTokenReceiver } = await import('../../../../electron/backend/services/tokenReceiver')
      const result = await startTokenReceiver()
      expect(result.success).toBe(true)
    })
    it('重复启动返回已运行', async () => {
      const { startTokenReceiver } = await import('../../../../electron/backend/services/tokenReceiver')
      await startTokenReceiver()
      const r = await startTokenReceiver()
      expect(r.success).toBe(true)
    })
    it('监听失败返回错误', async () => {
      mockListen.mockImplementation((..._args: any[]) => {
        setTimeout(() => {
          // Fire ALL error handlers so each port iteration fails
          const onCalls = mockServer.on.mock.calls || []
          for (const [event, handler] of onCalls) {
            if (event === 'error') handler({ message: 'EADDRINUSE' })
          }
        }, 0)
      })
      const { startTokenReceiver } = await import('../../../../electron/backend/services/tokenReceiver')
      const r = await startTokenReceiver()
      expect(r.success).toBe(false)
    })
  })

  describe('stopTokenReceiver', () => {
    it('无服务器运行也返回成功', async () => {
      const { stopTokenReceiver } = await import('../../../../electron/backend/services/tokenReceiver')
      expect(stopTokenReceiver().success).toBe(true)
    })
  })

  describe('getTokenReceiverStatus', () => {
    it('初始状态为 not running', async () => {
      const { getTokenReceiverStatus } = await import('../../../../electron/backend/services/tokenReceiver')
      expect(getTokenReceiverStatus().running).toBe(false)
    })
  })

  describe('handleTokenConfirmResponse', () => {
    it('处理确认响应不抛出异常', async () => {
      const { handleTokenConfirmResponse } = await import('../../../../electron/backend/services/tokenReceiver')
      expect(() => handleTokenConfirmResponse('nonexistent', true)).not.toThrow()
    })
  })

  describe('registerTokenConfirmationHandler', () => {
    it('注册 IPC 处理器不抛出异常', async () => {
      const { registerTokenConfirmationHandler } = await import('../../../../electron/backend/services/tokenReceiver')
      expect(() => registerTokenConfirmationHandler()).not.toThrow()
    })
  })
})


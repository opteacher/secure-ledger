/**
 * 自动化登录服务单元测试
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

const mockEndpointData = {
  id: 1, name: 'Test Login', icon: 'icon-key', login_type: 'web' as const, share_token: null,
  pages: [{
    id: 1, endpoint_id: 1, order_index: 0, url: 'https://example.com/login',
    slots: [
      { id: 1, page_id: 1, order_index: 0, name: 'username', element_xpath: '//input[@name="user"]', action_type: 'input' as const, value: 'testuser', is_encrypted: false, timeout: 200 },
      { id: 2, page_id: 1, order_index: 1, name: 'password', element_xpath: '//input[@name="pass"]', action_type: 'input' as const, value: 'encrypted_pass', is_encrypted: true, timeout: 200 },
      { id: 3, page_id: 1, order_index: 2, name: 'submit', element_xpath: '//button[@type="submit"]', action_type: 'click' as const, value: null, is_encrypted: false, timeout: 200 },
    ],
  }],
}

const { mockGetEndpoint } = vi.hoisted(() => ({
  mockGetEndpoint: vi.fn(() => mockEndpointData),
}))
vi.mock('../../../../electron/backend/services/endpoint', () => ({ getEndpoint: mockGetEndpoint }))

const mockPage = {
  bringToFront: vi.fn(() => Promise.resolve()),
  evaluateOnNewDocument: vi.fn(() => Promise.resolve()),
  goto: vi.fn(() => Promise.resolve()),
  locator: vi.fn(() => ({ wait: vi.fn(() => Promise.resolve()), fill: vi.fn(() => Promise.resolve()), click: vi.fn(() => Promise.resolve()), select: vi.fn(() => Promise.resolve()) })),
  waitForXPath: vi.fn(() => Promise.resolve({ click: vi.fn(() => Promise.resolve()), type: vi.fn(() => Promise.resolve()), select: vi.fn(() => Promise.resolve()), evaluate: vi.fn(() => Promise.resolve()) })),
}

const mockBrowser = {
  pages: vi.fn(() => Promise.resolve([mockPage])),
  newPage: vi.fn(() => Promise.resolve(mockPage)),
  disconnect: vi.fn(),
}

const { mockLaunchBrowser, mockConnectToExistingBrowser, mockAnalyzeBrowserForPuppeteer } = vi.hoisted(() => ({
  mockLaunchBrowser: vi.fn(() => Promise.resolve({ browser: mockBrowser, puppeteerVersion: 'high', versionInfo: { version: '120.0.0.0', majorVersion: 120, path: '/chrome' } })),
  mockConnectToExistingBrowser: vi.fn(() => Promise.resolve({ browser: mockBrowser, puppeteerVersion: 'high', isConnected: true })),
  mockAnalyzeBrowserForPuppeteer: vi.fn(() => ({ versionInfo: { path: '/chrome', version: '120.0.0.0', majorVersion: 120 }, puppeteerVersion: 'high', decision: 'Using high version' })),
}))

vi.mock('../../../../electron/backend/services/puppeteerManager', () => ({
  launchBrowser: mockLaunchBrowser, connectToExistingBrowser: mockConnectToExistingBrowser, analyzeBrowserForPuppeteer: mockAnalyzeBrowserForPuppeteer,
}))

vi.mock('../../../../electron/backend/services/browser', () => ({ getBrowserList: vi.fn(() => []) }))
vi.mock('../../../../electron/backend/services/browserInstance', () => ({ checkBrowserInstance: vi.fn(() => Promise.resolve({ available: true, port: 9222 })) }))

const { mockDecryptSlotValue } = vi.hoisted(() => ({
  mockDecryptSlotValue: vi.fn((val: string) => 'decrypted_' + val),
}))
vi.mock('../../../../electron/backend/services/slot', () => ({ decryptSlotValue: mockDecryptSlotValue }))

const { mockCheckTokenPermission, mockIncrementTokenUsage } = vi.hoisted(() => ({
  mockCheckTokenPermission: vi.fn(() => Promise.resolve({ allowed: true })),
  mockIncrementTokenUsage: vi.fn(() => Promise.resolve('new-token')),
}))
vi.mock('../../../../electron/backend/services/endpointShare', () => ({
  checkTokenPermission: mockCheckTokenPermission, incrementTokenUsage: mockIncrementTokenUsage,
}))

import { executeLogin, executeLoginInWebview } from '../../../../electron/backend/services/automation'

describe('automation 服务', () => {
  beforeEach(() => vi.clearAllMocks())

  describe('executeLogin', () => {
    it('成功执行登录流程（新启动模式）', async () => {
      const result = await executeLogin(1, 'C:\\chrome.exe')
      expect(result.success).toBe(true)
      expect(result.message).toContain('successfully')
    })

    it('成功执行登录流程（连接现有实例）', async () => {
      const result = await executeLogin(1, 'C:\\chrome.exe', 'auto', 'ws://127.0.0.1:9222/browser/abc')
      expect(result.success).toBe(true)
      expect(result.isConnected).toBe(true)
    })

    it('Endpoint 不存在时抛出错误', async () => {
      mockGetEndpoint.mockReturnValueOnce(null as any)
      await expect(executeLogin(999, 'C:\\chrome.exe')).rejects.toThrow('Endpoint not found')
    })

    it('Token 权限检查失败时抛出错误', async () => {
      mockGetEndpoint.mockReturnValue({ ...mockEndpointData, share_token: 'invalid-token' } as any)
      mockCheckTokenPermission.mockResolvedValueOnce({ allowed: false, reason: 'Token expired' })
      await expect(executeLogin(1, 'C:\\chrome.exe')).rejects.toThrow('Token expired')
    })

    it('登录异常时返回失败结果', async () => {
      mockBrowser.pages.mockRejectedValueOnce(new Error('Browser crashed'))
      const result = await executeLogin(1, 'C:\\chrome.exe')
      expect(result.success).toBe(false)
      expect(result.message).toContain('Browser crashed')
    })

    it('用户指定 Puppeteer 版本', async () => {
      await executeLogin(1, 'C:\\chrome.exe', 'low')
      expect(mockAnalyzeBrowserForPuppeteer).toHaveBeenCalledWith('C:\\chrome.exe', 'low')
    })

    it('加密 slot 值在输入前被解密', async () => {
      await executeLogin(1, 'C:\\chrome.exe')
      expect(mockDecryptSlotValue).toHaveBeenCalled()
    })

    it('finally 中断开浏览器连接', async () => {
      await executeLogin(1, 'C:\\chrome.exe')
      expect(mockBrowser.disconnect).toHaveBeenCalled()
    })
  })

  describe('executeLoginInWebview', () => {
    it('在 webview 中执行登录操作', async () => {
      const mockWebview = {
        src: '', executeJavaScript: vi.fn(() => Promise.resolve()),
        addEventListener: vi.fn((_e: string, h: () => void) => setTimeout(h, 10)),
        removeEventListener: vi.fn(),
      } as unknown as Electron.WebviewTag

      await expect(executeLoginInWebview(mockEndpointData as any, mockWebview)).resolves.toBeUndefined()
    })
  })
})

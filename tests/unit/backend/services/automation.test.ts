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
  waitForXPath: vi.fn(() => Promise.resolve({ click: vi.fn(() => Promise.resolve()), type: vi.fn(() => Promise.resolve()), select: vi.fn(() => Promise.resolve()), evaluate: vi.fn(() => Promise.resolve()), screenshot: vi.fn(() => Promise.resolve(Buffer.from('img'))) })),
  $: vi.fn(() => Promise.resolve({ screenshot: vi.fn(() => Promise.resolve(Buffer.from('img'))) })),
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

const { mockCaptchaRecognize } = vi.hoisted(() => ({
  mockCaptchaRecognize: vi.fn(() => Promise.resolve({ text: 'AB12', confidence: 85 })),
}))
vi.mock('../../../../electron/backend/services/captcha', () => ({
  recognize: mockCaptchaRecognize, shutdownOcr: vi.fn(),
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

    it('captcha slot 调用 captchaService.recognize 并传入截图', async () => {
      const pageMock = vi.fn(() => Promise.resolve({ screenshot: vi.fn(() => Promise.resolve(Buffer.from('img'))) }))
      mockPage.$.mockImplementation(pageMock)
      const captchaEndpoint = {
        ...mockEndpointData,
        pages: [{
          ...mockEndpointData.pages[0],
          slots: [
            { id: 10, page_id: 1, order_index: 0, name: 'captcha', element_xpath: '//img[@id="captcha"]', action_type: 'captcha' as const, value: '', is_encrypted: false, timeout: 200, output_key: 'captcha1' },
          ],
        }],
      }
      mockGetEndpoint.mockReturnValueOnce(captchaEndpoint)
      mockPage.locator.mockReturnValue({
        wait: vi.fn(() => Promise.resolve()),
      })
      await executeLogin(1, 'C:\\chrome.exe')
      expect(mockPage.$).toHaveBeenCalled()
      expect(mockCaptchaRecognize).toHaveBeenCalled()
    })

    it('captcha output_key 不为空时存入 varStore 并解析 {{key}}', async () => {
      mockCaptchaRecognize.mockResolvedValueOnce({ text: 'CD34', confidence: 90 })
      mockPage.$.mockImplementation(() => Promise.resolve({ screenshot: vi.fn(() => Promise.resolve(Buffer.from('img'))) }))
      const mockFill = vi.fn(() => Promise.resolve())
      const captchaEndpoint = {
        ...mockEndpointData,
        pages: [{
          ...mockEndpointData.pages[0],
          slots: [
            { id: 10, page_id: 1, order_index: 0, name: 'captcha', element_xpath: '//img[@id="c"]', action_type: 'captcha' as const, value: '', is_encrypted: false, timeout: 200, output_key: 'code' },
            { id: 11, page_id: 1, order_index: 1, name: 'input', element_xpath: '//input[@name="code"]', action_type: 'input' as const, value: '{{code}}', is_encrypted: false, timeout: 200 },
          ],
        }],
      }
      mockGetEndpoint.mockReturnValueOnce(captchaEndpoint)
      mockPage.locator.mockReturnValue({
        wait: vi.fn(() => Promise.resolve()),
        fill: mockFill,
      })
      await executeLogin(1, 'C:\\chrome.exe')
      expect(mockCaptchaRecognize).toHaveBeenCalled()
      // The input step should receive the resolved value "CD34" instead of "{{code}}"
      expect(mockFill).toHaveBeenCalledWith('CD34')
    })
  })
describe('executeLoginInWebview', () => {
    const makeMockWebview = (executeResult: any = true) => ({
      src: '',
      executeJavaScript: vi.fn(() => Promise.resolve(executeResult)),
      addEventListener: vi.fn((_e: string, h: () => void) => setTimeout(h, 10)),
      removeEventListener: vi.fn(),
    } as unknown as Electron.WebviewTag)

    it('在 webview 中执行登录操作 (单页单 slot)', async () => {
      const mockWebview = makeMockWebview(true)
      await expect(executeLoginInWebview(mockEndpointData as any, mockWebview)).resolves.toBeUndefined()
      expect((mockWebview as any).executeJavaScript).toHaveBeenCalled()
    })

    it('单页多 slot (input/click/select) 全部成功', async () => {
      const endpoint = {
        id: 1, name: 'T', login_type: 'web' as const, share_token: null,
        pages: [{
          id: 1, endpoint_id: 1, order_index: 0, url: 'https://x.com/l',
          slots: [
            { id: 1, page_id: 1, order_index: 0, name: 'u', element_xpath: '//input[@name="user"]', action_type: 'input' as const, value: 'alice', is_encrypted: false, timeout: 50 },
            { id: 2, page_id: 1, order_index: 1, name: 'p', element_xpath: '//input[@name="pass"]', action_type: 'input' as const, value: 'enc', is_encrypted: true, timeout: 50 },
            { id: 3, page_id: 1, order_index: 2, name: 's', element_xpath: '//button[@type="submit"]', action_type: 'click' as const, value: '', is_encrypted: false, timeout: 50 },
          ],
        }],
      }
      const mockWebview = makeMockWebview(true)
      await executeLoginInWebview(endpoint as any, mockWebview)
      expect((mockWebview as any).executeJavaScript).toHaveBeenCalledTimes(3)
    })

    it('多页流程: 页面间正确切换 (src 设置 + did-finish-load 等)', async () => {
      const endpoint = {
        id: 1, name: 'T', login_type: 'web' as const, share_token: null,
        pages: [
          {
            id: 1, endpoint_id: 1, order_index: 0, url: 'https://a.com',
            slots: [{ id: 1, page_id: 1, order_index: 0, name: 'u', element_xpath: '//input', action_type: 'input' as const, value: 'x', is_encrypted: false, timeout: 10 }],
          },
          {
            id: 2, endpoint_id: 1, order_index: 1, url: 'https://b.com',
            slots: [{ id: 2, page_id: 2, order_index: 0, name: 's', element_xpath: '//button', action_type: 'click' as const, value: '', is_encrypted: false, timeout: 10 }],
          },
        ],
      }
      const mockWebview = makeMockWebview(true)
      await executeLoginInWebview(endpoint as any, mockWebview)
      expect((mockWebview as any).src).toBe('https://b.com')
      expect((mockWebview as any).executeJavaScript).toHaveBeenCalledTimes(2)
    })

    it('加密 slot 值在执行 JS 前被解密 (走 decryptSlotValue)', async () => {
      const endpoint = {
        id: 1, name: 'T', login_type: 'web' as const, share_token: null,
        pages: [{
          id: 1, endpoint_id: 1, order_index: 0, url: 'https://x.com',
          slots: [{ id: 1, page_id: 1, order_index: 0, name: 'p', element_xpath: '//input', action_type: 'input' as const, value: 'enc_val', is_encrypted: true, timeout: 10 }],
        }],
      }
      const mockWebview = makeMockWebview(true)
      await executeLoginInWebview(endpoint as any, mockWebview)
      expect(mockDecryptSlotValue).toHaveBeenCalledWith('enc_val', 1)
    })

    it('webview.executeJavaScript 返回 false (超时未找到元素) 时 reject', async () => {
      const mockWebview = makeMockWebview(false)
      await expect(executeLoginInWebview(mockEndpointData as any, mockWebview))
        .rejects.toThrow(/超时/)
    })

    it('xpath 含单引号 (注入尝试) 不破坏注入的 JS 代码', async () => {
      const endpoint = {
        id: 1, name: 'T', login_type: 'web' as const, share_token: null,
        pages: [{
          id: 1, endpoint_id: 1, order_index: 0, url: 'https://x.com',
          slots: [{ id: 1, page_id: 1, order_index: 0, name: 'u', element_xpath: `//input[@value='O'Brien']`, action_type: 'click' as const, value: '', is_encrypted: false, timeout: 10 }],
        }],
      }
      const mockWebview = makeMockWebview(true)
      await executeLoginInWebview(endpoint as any, mockWebview)
      const injectedJs = (mockWebview as any).executeJavaScript.mock.calls[0][0] as string
      expect(() => new Function(injectedJs)).not.toThrow()
      expect(injectedJs).toContain(`O'Brien`)
    })

    it('value 含单引号 (注入尝试) 不破坏注入的 JS 代码', async () => {
      const endpoint = {
        id: 1, name: 'T', login_type: 'web' as const, share_token: null,
        pages: [{
          id: 1, endpoint_id: 1, order_index: 0, url: 'https://x.com',
          slots: [{ id: 1, page_id: 1, order_index: 0, name: 'u', element_xpath: '//input', action_type: 'input' as const, value: `O'Brien`, is_encrypted: false, timeout: 10 }],
        }],
      }
      const mockWebview = makeMockWebview(true)
      await executeLoginInWebview(endpoint as any, mockWebview)
      const injectedJs = (mockWebview as any).executeJavaScript.mock.calls[0][0] as string
      expect(() => new Function(injectedJs)).not.toThrow()
    })

    it('无 url 的页面跳过 webview.src 设置 (直接执行 slots)', async () => {
      const endpoint = {
        id: 1, name: 'T', login_type: 'web' as const, share_token: null,
        pages: [{
          id: 1, endpoint_id: 1, order_index: 0, url: '',
          slots: [{ id: 1, page_id: 1, order_index: 0, name: 's', element_xpath: '//button', action_type: 'click' as const, value: '', is_encrypted: false, timeout: 10 }],
        }],
      }
      const mockWebview = makeMockWebview(true)
      const origSrc = (mockWebview as any).src
      await executeLoginInWebview(endpoint as any, mockWebview)
      expect((mockWebview as any).src).toBe(origSrc)
      expect((mockWebview as any).executeJavaScript).toHaveBeenCalledTimes(1)
    })

    it('captcha slot 在 webview 模式中被跳过 (不调用 executeJavaScript)', async () => {
      const endpoint = {
        id: 1, name: 'T', login_type: 'web' as const, share_token: null,
        pages: [{
          id: 1, endpoint_id: 1, order_index: 0, url: 'https://x.com',
          slots: [
            { id: 10, page_id: 1, order_index: 0, name: 'captcha', element_xpath: '//img', action_type: 'captcha' as const, value: '', is_encrypted: false, timeout: 10, output_key: 'code' },
            { id: 11, page_id: 1, order_index: 1, name: 'submit', element_xpath: '//button', action_type: 'click' as const, value: '', is_encrypted: false, timeout: 10 },
          ],
        }],
      }
      const mockWebview = makeMockWebview(true)
      await executeLoginInWebview(endpoint as any, mockWebview)
      // Only the click slot should be executed (captcha skipped)
      expect((mockWebview as any).executeJavaScript).toHaveBeenCalledTimes(1)
    })

    it('slot.timeout > 0 时在每步操作后被应用 (delay)', async () => {
      const endpoint = {
        id: 1, name: 'T', login_type: 'web' as const, share_token: null,
        pages: [{
          id: 1, endpoint_id: 1, order_index: 0, url: 'https://x.com',
          slots: [{ id: 1, page_id: 1, order_index: 0, name: 's', element_xpath: '//button', action_type: 'click' as const, value: '', is_encrypted: false, timeout: 300 }],
        }],
      }
      const start = Date.now()
      const mockWebview = makeMockWebview(true)
      await executeLoginInWebview(endpoint as any, mockWebview)
      const elapsed = Date.now() - start
      expect(elapsed).toBeGreaterThanOrEqual(280)
    })
  })
})

describe('automation 服务: executeLogin timeout 与 failedXpaths', () => {
  beforeEach(() => vi.clearAllMocks())

  it('高版本 Puppeteer locator.wait 超时参数为 30000ms', async () => {
    const locatorWaitSpy = vi.fn(() => Promise.resolve())
    mockPage.locator.mockReturnValueOnce({
      wait: locatorWaitSpy,
      fill: vi.fn(() => Promise.resolve()),
      click: vi.fn(() => Promise.resolve()),
      select: vi.fn(() => Promise.resolve()),
    })
    await executeLogin(1, 'C:\\chrome.exe')
    expect(locatorWaitSpy).toHaveBeenCalledWith({ timeout: 30000 })
  })

it('低版本 Puppeteer waitForXPath 超时参数为 30000ms', async () => {
      mockLaunchBrowser.mockResolvedValueOnce({
        browser: mockBrowser,
        puppeteerVersion: 'low',
        versionInfo: { version: '90.0.0.0', majorVersion: 90, path: '/chrome' },
      })
      await executeLogin(1, 'C:\\chrome.exe')
      expect(mockPage.waitForXPath).toHaveBeenCalledWith('//input[@name="user"]', { timeout: 30000 })
    })

  it('单 slot 超时 (locator.wait reject) 时收集到 failedXpaths 且整体 success:false', async () => {
    mockPage.locator.mockReturnValueOnce({
      wait: vi.fn(() => Promise.reject(new Error('timeout'))),
      fill: vi.fn(), click: vi.fn(), select: vi.fn(),
    })
    mockPage.locator.mockReturnValue({
      wait: vi.fn(() => Promise.resolve()),
      fill: vi.fn(() => Promise.resolve()),
      click: vi.fn(() => Promise.resolve()),
      select: vi.fn(() => Promise.resolve()),
    })

    const result = await executeLogin(1, 'C:\\chrome.exe')
    expect(result.success).toBe(false)
    expect(result.failedXpaths).toBeDefined()
    expect(result.failedXpaths).toContain('//input[@name="user"]')
    expect(result.message).toContain('部分步骤执行失败')
  })

  it('全部 slot 超时时 failedXpaths 包含全部 xpath', async () => {
    mockPage.locator.mockReturnValue({
      wait: vi.fn(() => Promise.reject(new Error('timeout'))),
      fill: vi.fn(), click: vi.fn(), select: vi.fn(),
    })
    const result = await executeLogin(1, 'C:\\chrome.exe')
    expect(result.success).toBe(false)
    expect(result.failedXpaths).toBeDefined()
    expect(result.failedXpaths).toEqual([
      '//input[@name="user"]',
      '//input[@name="pass"]',
      '//button[@type="submit"]',
    ])
  })

  it('全部 slot 成功时 failedXpaths 为 undefined 且 success:true', async () => {
    mockPage.locator.mockReturnValue({
      wait: vi.fn(() => Promise.resolve()),
      fill: vi.fn(() => Promise.resolve()),
      click: vi.fn(() => Promise.resolve()),
      select: vi.fn(() => Promise.resolve()),
    })
const result = await executeLogin(1, 'C:\\chrome.exe')
      expect(result.success).toBe(true)
      expect(result.failedXpaths).toBeUndefined()
      expect(result.message).toContain('successfully')
    })
  })

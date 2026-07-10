/**
 * Puppeteer 版本管理服务单元测试
 * 测试 puppeteerManager.ts 的所有导出函数
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// ─── 使用 vi.hoisted 避免 hoisting 引用错误 ─────────────

const mockHighPuppeteer = vi.hoisted(() => ({
  launch: vi.fn().mockResolvedValue({ disconnect: vi.fn(), pages: vi.fn(() => []) }),
  connect: vi.fn().mockResolvedValue({ disconnect: vi.fn() }),
}))

const mockLowPuppeteer = vi.hoisted(() => ({
  launch: vi.fn().mockResolvedValue({ disconnect: vi.fn(), pages: vi.fn(() => []) }),
  connect: vi.fn().mockResolvedValue({ disconnect: vi.fn() }),
}))

const mockGetBrowserVersion = vi.hoisted(() => vi.fn())
const mockDecidePuppeteerVersion = vi.hoisted(() => vi.fn())

// ─── Mock 模块 ────────────────────────────────────────────

vi.mock('puppeteer-core', () => ({
  default: mockHighPuppeteer,
}))

vi.mock('puppeteer-core-legacy', () => ({
  default: mockLowPuppeteer,
}))

vi.mock('../../../../electron/backend/services/chromeVersion', () => ({
  getBrowserVersion: mockGetBrowserVersion,
  decidePuppeteerVersion: mockDecidePuppeteerVersion,
  CHROME_VERSION_THRESHOLD: 112,
}))

// ─── 动态导入被测模块 ────────────────────────────────────

import {
  getPuppeteer,
  analyzeBrowserForPuppeteer,
  launchBrowser,
  connectToExistingBrowser,
  clearPuppeteerCache,
  getLoadedVersions,
} from '../../../../electron/backend/services/puppeteerManager'

// ─── 辅助常量 ────────────────────────────────────────────

const defaultVersionInfo = {
  path: '/path/to/chrome',
  version: '120.0.6099.109',
  majorVersion: 120,
}

// ─── 测试套件 ────────────────────────────────────────────

describe('puppeteerManager 服务', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    clearPuppeteerCache()
    // 恢复默认 mock 行为
    mockHighPuppeteer.launch.mockResolvedValue({ disconnect: vi.fn(), pages: vi.fn(() => []) })
    mockHighPuppeteer.connect.mockResolvedValue({ disconnect: vi.fn() })
    mockLowPuppeteer.launch.mockResolvedValue({ disconnect: vi.fn(), pages: vi.fn(() => []) })
    mockLowPuppeteer.connect.mockResolvedValue({ disconnect: vi.fn() })
  })

  // ============================================================
  //  getPuppeteer
  // ============================================================

  describe('getPuppeteer', () => {
    it('"high" 版本加载 puppeteer-core 并返回模块', async () => {
      const result = await getPuppeteer('high')
      expect(result).toBe(mockHighPuppeteer)
    })

    it('"low" 版本加载 puppeteer-core-legacy 并返回模块', async () => {
      const result = await getPuppeteer('low')
      expect(result).toBe(mockLowPuppeteer)
    })

    it('缓存命中时返回相同模块引用', async () => {
      const module1 = await getPuppeteer('high')
      const module2 = await getPuppeteer('high')
      expect(module1).toBe(module2)
    })

    it('缓存命中时不会将已缓存的版本重复添加', async () => {
      await getPuppeteer('high')
      await getPuppeteer('high')
      // 缓存中应该只有一个 high，不会重复添加
      expect(getLoadedVersions()).toEqual(['high'])
    })
  })

  // ============================================================
  //  analyzeBrowserForPuppeteer
  // ============================================================

  describe('analyzeBrowserForPuppeteer', () => {
    it('auto 模式 + 版本 < 112 → 返回 low 版本及对应决策文字', () => {
      mockGetBrowserVersion.mockReturnValue({
        path: '/path/to/chrome',
        version: '90.0.4430.212',
        majorVersion: 90,
      })
      mockDecidePuppeteerVersion.mockReturnValue('low')

      const result = analyzeBrowserForPuppeteer('/path/to/chrome', 'auto')

      expect(result.puppeteerVersion).toBe('low')
      expect(result.decision).toBe('Chrome 90 < 112，使用低版本 Puppeteer (13.7.0)')
      expect(result.versionInfo.majorVersion).toBe(90)
      expect(mockGetBrowserVersion).toHaveBeenCalledWith('/path/to/chrome')
      expect(mockDecidePuppeteerVersion).toHaveBeenCalledWith(90, 'auto')
    })

    it('auto 模式 + 版本 >= 112 → 返回 high 版本及对应决策文字', () => {
      mockGetBrowserVersion.mockReturnValue({
        path: '/path/to/chrome',
        version: '120.0.6099.109',
        majorVersion: 120,
      })
      mockDecidePuppeteerVersion.mockReturnValue('high')

      const result = analyzeBrowserForPuppeteer('/path/to/chrome', 'auto')

      expect(result.puppeteerVersion).toBe('high')
      expect(result.decision).toBe('Chrome 120 >= 112，使用高版本 Puppeteer (22.x)')
      expect(result.versionInfo.majorVersion).toBe(120)
    })

    it('auto 模式 + null 版本 → 默认返回 high 版本及对应决策文字', () => {
      mockGetBrowserVersion.mockReturnValue({
        path: '/path/to/chrome',
        version: null,
        majorVersion: null,
      })
      mockDecidePuppeteerVersion.mockReturnValue('high')

      const result = analyzeBrowserForPuppeteer('/path/to/chrome', 'auto')

      expect(result.puppeteerVersion).toBe('high')
      expect(result.decision).toBe('无法检测浏览器版本，默认使用高版本 Puppeteer')
      expect(result.versionInfo.majorVersion).toBeNull()
      expect(mockDecidePuppeteerVersion).toHaveBeenCalledWith(null, 'auto')
    })

    it('用户指定 high → 返回 high 版本，忽略实际版本号', () => {
      mockGetBrowserVersion.mockReturnValue({
        path: '/path/to/chrome',
        version: '90.0.4430.212',
        majorVersion: 90,
      })
      mockDecidePuppeteerVersion.mockReturnValue('high')

      const result = analyzeBrowserForPuppeteer('/path/to/chrome', 'high')

      expect(result.puppeteerVersion).toBe('high')
      expect(result.decision).toBe('用户指定使用高版本 Puppeteer')
      expect(mockDecidePuppeteerVersion).toHaveBeenCalledWith(90, 'high')
    })

    it('用户指定 low → 返回 low 版本，忽略实际版本号', () => {
      mockGetBrowserVersion.mockReturnValue({
        path: '/path/to/chrome',
        version: '120.0.6099.109',
        majorVersion: 120,
      })
      mockDecidePuppeteerVersion.mockReturnValue('low')

      const result = analyzeBrowserForPuppeteer('/path/to/chrome', 'low')

      expect(result.puppeteerVersion).toBe('low')
      expect(result.decision).toBe('用户指定使用低版本 Puppeteer')
      expect(mockDecidePuppeteerVersion).toHaveBeenCalledWith(120, 'low')
    })

    it('默认 userPreference 为 auto', () => {
      mockGetBrowserVersion.mockReturnValue({
        path: '/path/to/chrome',
        version: '120.0.6099.109',
        majorVersion: 120,
      })
      mockDecidePuppeteerVersion.mockReturnValue('high')

      const result = analyzeBrowserForPuppeteer('/path/to/chrome')

      expect(result.puppeteerVersion).toBe('high')
      expect(mockDecidePuppeteerVersion).toHaveBeenCalledWith(120, 'auto')
    })
  })

  // ============================================================
  //  launchBrowser
  // ============================================================

  describe('launchBrowser', () => {
    beforeEach(() => {
      mockGetBrowserVersion.mockReturnValue(defaultVersionInfo)
    })

    it('auto 模式高版本 Chrome → 使用 high puppeteer 启动', async () => {
      mockDecidePuppeteerVersion.mockReturnValue('high')
      const mockLaunchedBrowser = { disconnect: vi.fn(), pages: vi.fn(() => []) }
      mockHighPuppeteer.launch.mockResolvedValue(mockLaunchedBrowser)

      const result = await launchBrowser('/path/to/chrome', 'auto')

      expect(result.puppeteerVersion).toBe('high')
      expect(result.browser).toBe(mockLaunchedBrowser)
      expect(result.versionInfo).toEqual(defaultVersionInfo)
      expect(mockHighPuppeteer.launch).toHaveBeenCalledTimes(1)
      expect(mockLowPuppeteer.launch).not.toHaveBeenCalled()
    })

    it('用户指定 low → 使用 low puppeteer 启动', async () => {
      mockDecidePuppeteerVersion.mockReturnValue('low')
      const mockLaunchedBrowser = { disconnect: vi.fn(), pages: vi.fn(() => []) }
      mockLowPuppeteer.launch.mockResolvedValue(mockLaunchedBrowser)

      const result = await launchBrowser('/path/to/chrome', 'low')

      expect(result.puppeteerVersion).toBe('low')
      expect(result.browser).toBe(mockLaunchedBrowser)
      expect(result.versionInfo).toEqual(defaultVersionInfo)
      expect(mockLowPuppeteer.launch).toHaveBeenCalledTimes(1)
      expect(mockHighPuppeteer.launch).not.toHaveBeenCalled()
    })

    it('自定义 args 传递到启动参数中', async () => {
      mockDecidePuppeteerVersion.mockReturnValue('high')
      const mockLaunchedBrowser = { disconnect: vi.fn(), pages: vi.fn(() => []) }
      mockHighPuppeteer.launch.mockResolvedValue(mockLaunchedBrowser)

      const customArgs = ['--window-size=800,600', '--disable-gpu']
      await launchBrowser('/path/to/chrome', 'auto', { args: customArgs })

      expect(mockHighPuppeteer.launch).toHaveBeenCalledWith(
        expect.objectContaining({
          args: customArgs,
          executablePath: '/path/to/chrome',
          headless: false,
        })
      )
    })

    it('未提供 args 时使用默认参数', async () => {
      mockDecidePuppeteerVersion.mockReturnValue('high')
      const mockLaunchedBrowser = { disconnect: vi.fn(), pages: vi.fn(() => []) }
      mockHighPuppeteer.launch.mockResolvedValue(mockLaunchedBrowser)

      await launchBrowser('/path/to/chrome', 'auto')

      expect(mockHighPuppeteer.launch).toHaveBeenCalledWith(
        expect.objectContaining({
          args: expect.arrayContaining([
            '--start-maximized',
            '--disable-blink-features=AutomationControlled',
          ]),
        })
      )
    })

    it('启动选项包含正确的 executablePath', async () => {
      mockDecidePuppeteerVersion.mockReturnValue('high')
      const mockLaunchedBrowser = { disconnect: vi.fn(), pages: vi.fn(() => []) }
      mockHighPuppeteer.launch.mockResolvedValue(mockLaunchedBrowser)

      await launchBrowser('/custom/chrome/path', 'auto')

      expect(mockHighPuppeteer.launch).toHaveBeenCalledWith(
        expect.objectContaining({
          executablePath: '/custom/chrome/path',
        })
      )
    })

    it('launch 失败时错误向上传播', async () => {
      mockDecidePuppeteerVersion.mockReturnValue('high')
      mockHighPuppeteer.launch.mockRejectedValue(new Error('Launch failed'))

      await expect(launchBrowser('/path/to/chrome', 'auto')).rejects.toThrow(
        'Launch failed'
      )
    })

    it('返回对象包含 versionInfo 的完整信息', async () => {
      const versionInfoWithError = {
        path: '/bad/path',
        version: null,
        majorVersion: null,
        error: 'Browser executable not found',
      }
      mockGetBrowserVersion.mockReturnValue(versionInfoWithError)
      mockDecidePuppeteerVersion.mockReturnValue('high')
      const mockLaunchedBrowser = { disconnect: vi.fn(), pages: vi.fn(() => []) }
      mockHighPuppeteer.launch.mockResolvedValue(mockLaunchedBrowser)

      const result = await launchBrowser('/bad/path', 'auto')

      expect(result.versionInfo).toEqual(versionInfoWithError)
      expect(result.versionInfo.error).toBe('Browser executable not found')
    })
  })

  // ============================================================
  //  connectToExistingBrowser
  // ============================================================

  describe('connectToExistingBrowser', () => {
    beforeEach(() => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          json: () => Promise.resolve({ Browser: 'Chrome/120.0.6099.109' }),
        })
      )
    })

    afterEach(() => {
      vi.unstubAllGlobals()
    })

    it('浏览器高版本 → 通过 browserWSEndpoint 成功连接并返回 high 版本', async () => {
      const connectedBrowser = { disconnect: vi.fn(), wsEndpoint: vi.fn() }
      mockHighPuppeteer.connect.mockResolvedValue(connectedBrowser)

      const result = await connectToExistingBrowser(
        'ws://localhost:9222/devtools/browser/abc123'
      )

      expect(result.browser).toBe(connectedBrowser)
      expect(result.puppeteerVersion).toBe('high')
      expect(result.isConnected).toBe(true)
      expect(mockHighPuppeteer.connect).toHaveBeenCalledWith(
        expect.objectContaining({
          browserWSEndpoint: 'ws://localhost:9222/devtools/browser/abc123',
          defaultViewport: null,
          ignoreHTTPSErrors: true,
        })
      )
      expect(fetch).toHaveBeenCalledWith('http://localhost:9222/json/version')
    })

    it('browserWSEndpoint 失败后，browserURL 成功回退连接', async () => {
      const connectedBrowser = { disconnect: vi.fn() }
      mockHighPuppeteer.connect
        .mockRejectedValueOnce(new Error('ws connect failed'))
        .mockResolvedValueOnce(connectedBrowser)

      const result = await connectToExistingBrowser(
        'ws://localhost:9222/devtools/browser/abc123'
      )

      expect(result.browser).toBe(connectedBrowser)
      expect(result.puppeteerVersion).toBe('high')
      expect(result.isConnected).toBe(true)
      expect(mockHighPuppeteer.connect).toHaveBeenCalledTimes(2)
      // 第二次调用使用 browserURL
      expect(mockHighPuppeteer.connect).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          browserURL: 'http://localhost:9222',
        })
      )
    })

    it('检测到低版本 Chrome → 优先使用 low puppeteer 连接', async () => {
      const fetchMock = global.fetch as ReturnType<typeof vi.fn>
      fetchMock.mockResolvedValue({
        json: () => Promise.resolve({ Browser: 'Chrome/90.0.4430.212' }),
      })

      const connectedBrowser = { disconnect: vi.fn() }
      mockLowPuppeteer.connect.mockResolvedValue(connectedBrowser)

      const result = await connectToExistingBrowser(
        'ws://localhost:9222/devtools/browser/abc123'
      )

      expect(result.puppeteerVersion).toBe('low')
      expect(mockLowPuppeteer.connect).toHaveBeenCalled()
      expect(mockHighPuppeteer.connect).not.toHaveBeenCalled()
    })

    it('wsEndpoint 解析失败 → high 失败后回退 low，且不调用 fetch', async () => {
      // 无效 URL 导致解析失败，browserUrl 为 undefined
      const fetchMock = global.fetch as ReturnType<typeof vi.fn>

      // high connect 失败（无效 wsEndpoint），没有 browserURL 回退
      mockHighPuppeteer.connect.mockRejectedValue(new Error('Invalid WebSocket URL'))
      // low connect 成功
      const connectedBrowser = { disconnect: vi.fn() }
      mockLowPuppeteer.connect.mockResolvedValue(connectedBrowser)

      const result = await connectToExistingBrowser('not-a-valid-url', {})

      // 解析失败不会调用 fetch（因为没有 browserUrl）
      expect(fetchMock).not.toHaveBeenCalled()
      // 版本回退到 low 并成功连接
      expect(result.puppeteerVersion).toBe('low')
      expect(result.browser).toBe(connectedBrowser)
      expect(result.isConnected).toBe(true)
    })

    it('high 版本失败后自动尝试 low 版本回退', async () => {
      const fetchMock = global.fetch as ReturnType<typeof vi.fn>
      fetchMock.mockResolvedValue({
        json: () => Promise.resolve({ Browser: 'Chrome/120.0.6099.109' }),
      })

      // high 版本 connect 两次都失败（browserWSEndpoint + browserURL）
      mockHighPuppeteer.connect.mockRejectedValue(new Error('High version failed'))
      // low 版本 connect 成功
      const connectedBrowser = { disconnect: vi.fn() }
      mockLowPuppeteer.connect.mockResolvedValue(connectedBrowser)

      const result = await connectToExistingBrowser(
        'ws://localhost:9222/devtools/browser/abc123'
      )

      expect(result.puppeteerVersion).toBe('low')
      expect(result.browser).toBe(connectedBrowser)
      expect(mockHighPuppeteer.connect).toHaveBeenCalled()
      expect(mockLowPuppeteer.connect).toHaveBeenCalled()
    })

    it('/json/version 获取失败 → 默认使用 high 版本', async () => {
      const fetchMock = global.fetch as ReturnType<typeof vi.fn>
      fetchMock.mockRejectedValue(new Error('Network error'))

      const connectedBrowser = { disconnect: vi.fn() }
      mockHighPuppeteer.connect.mockResolvedValue(connectedBrowser)

      const result = await connectToExistingBrowser(
        'ws://localhost:9222/devtools/browser/abc123'
      )

      // 版本检测失败，默认 high
      expect(result.puppeteerVersion).toBe('high')
      expect(mockHighPuppeteer.connect).toHaveBeenCalled()
    })

    it('所有版本都失败 → 抛出增强错误信息', async () => {
      mockHighPuppeteer.connect.mockRejectedValue(new Error('Connection refused'))
      mockLowPuppeteer.connect.mockRejectedValue(new Error('Connection refused'))

      await expect(
        connectToExistingBrowser('ws://localhost:9222/devtools/browser/abc123')
      ).rejects.toThrow('连接浏览器失败: Connection refused')
    })

    it('"Not allowed" 错误 → 增强消息提示 --remote-allow-origins', async () => {
      mockHighPuppeteer.connect.mockRejectedValue(
        new Error('Not allowed to access the specified resource')
      )
      mockLowPuppeteer.connect.mockRejectedValue(
        new Error('Not allowed to access the specified resource')
      )

      await expect(
        connectToExistingBrowser('ws://localhost:9222/devtools/browser/abc123')
      ).rejects.toThrow('--remote-allow-origins=*')
    })

    it('"Protocol error" 错误 → 增强消息提示 --remote-allow-origins', async () => {
      mockHighPuppeteer.connect.mockRejectedValue(
        new Error('Protocol error (Protocol error)')
      )
      mockLowPuppeteer.connect.mockRejectedValue(
        new Error('Protocol error (Protocol error)')
      )

      await expect(
        connectToExistingBrowser('ws://localhost:9222/devtools/browser/abc123')
      ).rejects.toThrow('--remote-allow-origins=*')
    })

    it('wsEndpoint 解析失败 → 不尝试 browserURL 回退，但尝试版本回退', async () => {
      // 无效 URL → browserUrl 为 undefined，不会尝试 browserURL
      const fetchMock = global.fetch as ReturnType<typeof vi.fn>

      // high connect 失败（browserWSEndpoint 用无效 ws），没有 browserURL 回退
      mockHighPuppeteer.connect.mockRejectedValue(new Error('Invalid WebSocket URL'))
      // low connect 也失败
      mockLowPuppeteer.connect.mockRejectedValue(new Error('Invalid WebSocket URL'))

      await expect(
        connectToExistingBrowser('not-a-valid-url')
      ).rejects.toThrow('连接浏览器失败: Invalid WebSocket URL')
      // 无 browserUrl → 不 fetch
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it('自定义 options 合并到 connect 调用中', async () => {
      const connectedBrowser = { disconnect: vi.fn() }
      mockHighPuppeteer.connect.mockResolvedValue(connectedBrowser)

      await connectToExistingBrowser('ws://localhost:9222/devtools/browser/abc123', {
        targetFilter: { type: 'page' },
      })

      expect(mockHighPuppeteer.connect).toHaveBeenCalledWith(
        expect.objectContaining({
          targetFilter: { type: 'page' },
        })
      )
    })

    it('默认不传 viewport 和 TLS 选项', async () => {
      const connectedBrowser = { disconnect: vi.fn() }
      mockHighPuppeteer.connect.mockResolvedValue(connectedBrowser)

      await connectToExistingBrowser('ws://localhost:9222/devtools/browser/abc123')

      expect(mockHighPuppeteer.connect).toHaveBeenCalledWith(
        expect.objectContaining({
          defaultViewport: null,
          ignoreHTTPSErrors: true,
        })
      )
    })
  })

  // ============================================================
  //  clearPuppeteerCache
  // ============================================================

  describe('clearPuppeteerCache', () => {
    it('清除缓存后 getLoadedVersions 返回空数组', async () => {
      await getPuppeteer('high')
      expect(getLoadedVersions()).toEqual(['high'])

      clearPuppeteerCache()
      expect(getLoadedVersions()).toEqual([])
    })

    it('清除缓存后再次加载会重新导入', async () => {
      await getPuppeteer('high')
      clearPuppeteerCache()
      // 再次加载应成功（重新走导入流程）
      const result = await getPuppeteer('high')
      expect(result).toBe(mockHighPuppeteer)
      expect(getLoadedVersions()).toEqual(['high'])
    })
  })

  // ============================================================
  //  getLoadedVersions
  // ============================================================

  describe('getLoadedVersions', () => {
    it('未加载任何版本时返回空数组', () => {
      expect(getLoadedVersions()).toEqual([])
    })

    it('加载 high 版本后包含 ["high"]', async () => {
      await getPuppeteer('high')
      expect(getLoadedVersions()).toEqual(['high'])
    })

    it('先后加载 high 和 low 后包含 ["high", "low"]', async () => {
      await getPuppeteer('high')
      await getPuppeteer('low')
      expect(getLoadedVersions()).toEqual(['high', 'low'])
    })

    it('重复加载相同版本不会重复出现在列表', async () => {
      await getPuppeteer('high')
      await getPuppeteer('high')
      await getPuppeteer('low')
      await getPuppeteer('low')
      expect(getLoadedVersions()).toEqual(['high', 'low'])
    })
  })
})

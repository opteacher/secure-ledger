/**
 * 浏览器服务单元测试
 * 测试 browser.ts 的所有导出函数
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

// ─── 使用 vi.hoisted 避免 hoisting 引用错误 ─────────────

const { mockRun, mockQuery } = vi.hoisted(() => ({
  mockRun: vi.fn(() => ({ changes: 1, lastInsertRowid: 1 })),
  mockQuery: vi.fn(() => [] as any[]),
}))

const { mockDetectChrome } = vi.hoisted(() => ({
  mockDetectChrome: vi.fn(() => [] as { name: string; path: string; version?: string }[]),
}))

const { mockGetInstalledChromePath, mockRegisterChrome } = vi.hoisted(() => ({
  mockGetInstalledChromePath: vi.fn(() => null as string | null),
  mockRegisterChrome: vi.fn(),
}))

const { mockGetBrowserVersion } = vi.hoisted(() => ({
  mockGetBrowserVersion: vi.fn(() => ({ version: '120.0.0.0', majorVersion: 120 })),
}))

// ─── Mock 模块 ────────────────────────────────────────────

vi.mock('../../../../electron/backend/database', () => ({
  run: mockRun,
  query: mockQuery,
}))

vi.mock('../../../../electron/backend/services/chrome', () => ({
  detectChrome: mockDetectChrome,
}))

vi.mock('../../../../electron/backend/services/chromium', () => ({
  getInstalledChromePath: mockGetInstalledChromePath,
  registerChrome: mockRegisterChrome,
}))

vi.mock('../../../../electron/backend/services/chromeVersion', () => ({
  getBrowserVersion: mockGetBrowserVersion,
}))

// ─── 动态导入被测模块 ────────────────────────────────────

import {
  getBrowserList,
  getEnabledBrowsers,
  addBrowser,
  deleteBrowser,
  updateBrowserStatus,
  updateBrowser,
  updateBrowserPuppeteerVersion,
  detectAndUpdateBrowserVersion,
  detectSystemBrowsers,
  initDefaultBrowsers,
  detectAndAddNewBrowsers,
  getAvailableBrowsers,
} from '../../../../electron/backend/services/browser'

// ─── 测试辅助函数 ────────────────────────────────────────

function makeBrowserConfig(
  overrides: Partial<{
    id: number
    name: string
    path: string
    is_enabled: number
    puppeteer_version: string
    chrome_version: string | null
    created_at: string
    updated_at: string
  }> = {}
) {
  return {
    id: overrides.id ?? 1,
    name: overrides.name ?? 'Chrome',
    path: overrides.path ?? 'C:\\chrome.exe',
    is_enabled: overrides.is_enabled ?? 1,
    puppeteer_version: overrides.puppeteer_version ?? 'auto',
    chrome_version: overrides.chrome_version ?? '120.0.0.0',
    created_at: overrides.created_at ?? '2024-01-01T00:00:00.000Z',
    updated_at: overrides.updated_at ?? '2024-01-01T00:00:00.000Z',
  }
}

// ─── 测试套件 ────────────────────────────────────────────

describe('browser 服务', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRun.mockReturnValue({ changes: 1, lastInsertRowid: 1 })
    mockQuery.mockReturnValue([])
    mockDetectChrome.mockReturnValue([])
    mockGetInstalledChromePath.mockReturnValue(null)
    mockGetBrowserVersion.mockReturnValue({ version: '120.0.0.0', majorVersion: 120 })
  })

  // ── getBrowserList ──

  describe('getBrowserList', () => {
    it('返回浏览器配置数组', () => {
      const browser = makeBrowserConfig()
      mockQuery.mockReturnValue([browser])
      const result = getBrowserList()
      expect(result).toEqual([browser])
      expect(mockQuery).toHaveBeenCalledWith(
        'SELECT * FROM browser ORDER BY created_at ASC'
      )
    })

    it('无浏览器时返回空数组', () => {
      mockQuery.mockReturnValue([])
      const result = getBrowserList()
      expect(result).toEqual([])
    })
  })

  // ── getEnabledBrowsers ──

  describe('getEnabledBrowsers', () => {
    it('返回已启用的浏览器', () => {
      const enabled = makeBrowserConfig({ id: 1, is_enabled: 1 })
      mockQuery.mockReturnValue([enabled])
      const result = getEnabledBrowsers()
      expect(result).toEqual([enabled])
      expect(mockQuery).toHaveBeenCalledWith(
        'SELECT * FROM browser WHERE is_enabled = 1 ORDER BY created_at ASC'
      )
    })

    it('无启用浏览器时返回空数组', () => {
      mockQuery.mockReturnValue([])
      const result = getEnabledBrowsers()
      expect(result).toEqual([])
    })
  })

  // ── addBrowser ──

  describe('addBrowser', () => {
    it('成功添加并返回浏览器配置', () => {
      mockRun.mockReturnValue({ changes: 1, lastInsertRowid: 42 })
      mockGetBrowserVersion.mockReturnValue({ version: '120.0.0.0', majorVersion: 120 })

      const result = addBrowser('Chrome', 'C:\\chrome.exe')

      expect(result.id).toBe(42)
      expect(result.name).toBe('Chrome')
      expect(result.path).toBe('C:\\chrome.exe')
      expect(result.is_enabled).toBe(true)
      expect(result.puppeteer_version).toBe('auto')
      expect(result.chrome_version).toBe('120.0.0.0')
      expect(mockGetBrowserVersion).toHaveBeenCalledWith('C:\\chrome.exe')
      expect(mockRun).toHaveBeenCalledWith(
        'INSERT INTO browser (name, path, is_enabled, puppeteer_version, chrome_version) VALUES (?, ?, 1, ?, ?)',
        ['Chrome', 'C:\\chrome.exe', 'auto', '120.0.0.0']
      )
    })

    it('版本检测失败时 chrome_version 为 null', () => {
      mockGetBrowserVersion.mockReturnValue({ version: null, majorVersion: null })
      mockRun.mockReturnValue({ changes: 1, lastInsertRowid: 1 })

      const result = addBrowser('Firefox', 'C:\\firefox.exe')

      expect(result.chrome_version).toBeNull()
      expect(mockRun).toHaveBeenCalledWith(
        'INSERT INTO browser (name, path, is_enabled, puppeteer_version, chrome_version) VALUES (?, ?, 1, ?, ?)',
        ['Firefox', 'C:\\firefox.exe', 'auto', null]
      )
    })
  })

  // ── deleteBrowser ──

  describe('deleteBrowser', () => {
    it('删除成功返回 true', () => {
      mockRun.mockReturnValue({ changes: 1, lastInsertRowid: 0 })
      expect(deleteBrowser(1)).toBe(true)
      expect(mockRun).toHaveBeenCalledWith('DELETE FROM browser WHERE id = ?', [1])
    })

    it('删除失败（changes=0）返回 false', () => {
      mockRun.mockReturnValue({ changes: 0, lastInsertRowid: 0 })
      expect(deleteBrowser(999)).toBe(false)
    })
  })

  // ── updateBrowserStatus ──

  describe('updateBrowserStatus', () => {
    it('启用浏览器成功返回 true', () => {
      mockRun.mockReturnValue({ changes: 1, lastInsertRowid: 0 })
      const result = updateBrowserStatus(1, true)
      expect(result).toBe(true)
      expect(mockRun).toHaveBeenCalledWith(
        'UPDATE browser SET is_enabled = ?, updated_at = ? WHERE id = ?',
        [1, expect.any(String), 1]
      )
    })

    it('禁用浏览器成功返回 true', () => {
      mockRun.mockReturnValue({ changes: 1, lastInsertRowid: 0 })
      const result = updateBrowserStatus(2, false)
      expect(result).toBe(true)
      expect(mockRun).toHaveBeenCalledWith(
        'UPDATE browser SET is_enabled = ?, updated_at = ? WHERE id = ?',
        [0, expect.any(String), 2]
      )
    })

    it('changes=0 时返回 false（浏览器不存在）', () => {
      mockRun.mockReturnValue({ changes: 0, lastInsertRowid: 0 })
      expect(updateBrowserStatus(999, true)).toBe(false)
    })
  })

  // ── updateBrowser ──

  describe('updateBrowser', () => {
    it('更新浏览器信息（含版本重新检测）', () => {
      mockRun.mockReturnValue({ changes: 1, lastInsertRowid: 0 })
      mockGetBrowserVersion.mockReturnValue({ version: '125.0.0.0', majorVersion: 125 })

      const result = updateBrowser(1, 'Chrome Beta', 'D:\\chromium.exe')

      expect(result).toBe(true)
      expect(mockGetBrowserVersion).toHaveBeenCalledWith('D:\\chromium.exe')
      expect(mockRun).toHaveBeenCalledWith(
        'UPDATE browser SET name = ?, path = ?, chrome_version = ?, updated_at = ? WHERE id = ?',
        ['Chrome Beta', 'D:\\chromium.exe', '125.0.0.0', expect.any(String), 1]
      )
    })

    it('路径不变但版本更新', () => {
      mockRun.mockReturnValue({ changes: 1, lastInsertRowid: 0 })
      mockGetBrowserVersion.mockReturnValue({ version: '122.0.0.0', majorVersion: 122 })

      const result = updateBrowser(1, 'Chrome', 'C:\\chrome.exe')

      expect(result).toBe(true)
      expect(mockGetBrowserVersion).toHaveBeenCalledWith('C:\\chrome.exe')
    })

    it('changes=0 时返回 false', () => {
      mockRun.mockReturnValue({ changes: 0, lastInsertRowid: 0 })
      expect(updateBrowser(999, 'Ghost', 'C:\\ghost.exe')).toBe(false)
    })
  })

  // ── updateBrowserPuppeteerVersion ──

  describe('updateBrowserPuppeteerVersion', () => {
    it('设为 auto 成功返回 true', () => {
      mockRun.mockReturnValue({ changes: 1, lastInsertRowid: 0 })
      const result = updateBrowserPuppeteerVersion(1, 'auto')
      expect(result).toBe(true)
      expect(mockRun).toHaveBeenCalledWith(
        'UPDATE browser SET puppeteer_version = ?, updated_at = ? WHERE id = ?',
        ['auto', expect.any(String), 1]
      )
    })

    it('设为 high 成功返回 true', () => {
      mockRun.mockReturnValue({ changes: 1, lastInsertRowid: 0 })
      const result = updateBrowserPuppeteerVersion(2, 'high')
      expect(result).toBe(true)
      expect(mockRun).toHaveBeenCalledWith(
        'UPDATE browser SET puppeteer_version = ?, updated_at = ? WHERE id = ?',
        ['high', expect.any(String), 2]
      )
    })

    it('设为 low 成功返回 true', () => {
      mockRun.mockReturnValue({ changes: 1, lastInsertRowid: 0 })
      const result = updateBrowserPuppeteerVersion(3, 'low')
      expect(result).toBe(true)
      expect(mockRun).toHaveBeenCalledWith(
        'UPDATE browser SET puppeteer_version = ?, updated_at = ? WHERE id = ?',
        ['low', expect.any(String), 3]
      )
    })

    it('changes=0 时返回 false', () => {
      mockRun.mockReturnValue({ changes: 0, lastInsertRowid: 0 })
      expect(updateBrowserPuppeteerVersion(999, 'auto')).toBe(false)
    })
  })

  // ── detectAndUpdateBrowserVersion ──

  describe('detectAndUpdateBrowserVersion', () => {
    it('浏览器存在时检测并更新版本', () => {
      const browser = makeBrowserConfig({ path: 'C:\\chrome.exe', chrome_version: '110.0.0.0' })
      mockQuery.mockReturnValue([browser])
      mockGetBrowserVersion.mockReturnValue({ version: '120.0.0.0', majorVersion: 120 })

      const result = detectAndUpdateBrowserVersion(1)

      expect(result).toEqual({ version: '120.0.0.0', majorVersion: 120 })
      expect(mockGetBrowserVersion).toHaveBeenCalledWith('C:\\chrome.exe')
      expect(mockRun).toHaveBeenCalledWith(
        'UPDATE browser SET chrome_version = ?, updated_at = ? WHERE id = ?',
        ['120.0.0.0', expect.any(String), 1]
      )
    })

    it('浏览器不存在时返回 null 版本', () => {
      mockQuery.mockReturnValue([])

      const result = detectAndUpdateBrowserVersion(999)

      expect(result).toEqual({ version: null, majorVersion: null })
      expect(mockGetBrowserVersion).not.toHaveBeenCalled()
      expect(mockRun).not.toHaveBeenCalled()
    })

    it('版本检测失败时版本为 null', () => {
      const browser = makeBrowserConfig({ path: 'C:\\chrome.exe' })
      mockQuery.mockReturnValue([browser])
      mockGetBrowserVersion.mockReturnValue({ version: null, majorVersion: null })

      const result = detectAndUpdateBrowserVersion(1)

      expect(result).toEqual({ version: null, majorVersion: null })
      expect(mockRun).toHaveBeenCalledWith(
        'UPDATE browser SET chrome_version = ?, updated_at = ? WHERE id = ?',
        [null, expect.any(String), 1]
      )
    })
  })

  // ── detectSystemBrowsers ──

  describe('detectSystemBrowsers', () => {
    it('委托给 detectChrome 并返回结果', () => {
      const detected = [
        { name: 'Chrome', path: 'C:\\chrome.exe' },
        { name: 'Edge', path: 'C:\\edge.exe' },
      ]
      mockDetectChrome.mockReturnValue(detected)

      const result = detectSystemBrowsers()

      expect(result).toEqual(detected)
      expect(mockDetectChrome).toHaveBeenCalledTimes(1)
    })

    it('无系统浏览器时返回空数组', () => {
      mockDetectChrome.mockReturnValue([])

      const result = detectSystemBrowsers()

      expect(result).toEqual([])
    })
  })

  // ── initDefaultBrowsers ──

  describe('initDefaultBrowsers', () => {
    it('无现有浏览器时初始化 Chromium 和系统浏览器', () => {
      mockQuery.mockReturnValue([])
      mockGetInstalledChromePath.mockReturnValue('D:\\app\\chromium.exe')
      mockGetBrowserVersion.mockReturnValue({ version: '120.0.0.0', majorVersion: 120 })
      mockDetectChrome.mockReturnValue([
        { name: 'Chrome', path: 'C:\\chrome.exe' },
        { name: 'Edge', path: 'C:\\edge.exe' },
      ])

      initDefaultBrowsers()

      // Chromium registered
      expect(mockRun).toHaveBeenCalledWith(
        'INSERT INTO browser (name, path, is_enabled, puppeteer_version, chrome_version) VALUES (?, ?, 1, ?, ?)',
        ['Chromium', 'D:\\app\\chromium.exe', 'auto', '120.0.0.0']
      )
      // System browsers added
      expect(mockRun).toHaveBeenCalledWith(
        'INSERT INTO browser (name, path, is_enabled, puppeteer_version, chrome_version) VALUES (?, ?, 1, ?, ?)',
        ['Chrome', 'C:\\chrome.exe', 'auto', '120.0.0.0']
      )
      expect(mockRun).toHaveBeenCalledWith(
        'INSERT INTO browser (name, path, is_enabled, puppeteer_version, chrome_version) VALUES (?, ?, 1, ?, ?)',
        ['Edge', 'C:\\edge.exe', 'auto', '120.0.0.0']
      )
      expect(mockGetInstalledChromePath).toHaveBeenCalledTimes(1)
      expect(mockDetectChrome).toHaveBeenCalledTimes(1)
    })

    it('已有浏览器时跳过初始化', () => {
      const existing = makeBrowserConfig()
      mockQuery.mockReturnValue([existing])

      initDefaultBrowsers()

      expect(mockGetInstalledChromePath).not.toHaveBeenCalled()
      expect(mockDetectChrome).not.toHaveBeenCalled()
      expect(mockRun).not.toHaveBeenCalled()
    })

    it('Chromium 路径为 null 时只添加系统浏览器', () => {
      mockQuery.mockReturnValue([])
      mockGetInstalledChromePath.mockReturnValue(null)
      mockDetectChrome.mockReturnValue([{ name: 'Chrome', path: 'C:\\chrome.exe' }])
      mockGetBrowserVersion.mockReturnValue({ version: '120.0.0.0', majorVersion: 120 })

      initDefaultBrowsers()

      // Only system browser inserted
      expect(mockRun).toHaveBeenCalledTimes(1)
      expect(mockRun).toHaveBeenCalledWith(
        'INSERT INTO browser (name, path, is_enabled, puppeteer_version, chrome_version) VALUES (?, ?, 1, ?, ?)',
        ['Chrome', 'C:\\chrome.exe', 'auto', '120.0.0.0']
      )
    })

    it('Chromium 注册异常时被忽略', () => {
      mockQuery.mockReturnValue([])
      mockGetInstalledChromePath.mockReturnValue('D:\\app\\chromium.exe')
      // getBrowserVersion throws for first call (chromium), succeeds for detected
      mockGetBrowserVersion
        .mockImplementationOnce(() => {
          throw new Error('Duplicate')
        })
        .mockReturnValueOnce({ version: '120.0.0.0', majorVersion: 120 })
      mockDetectChrome.mockReturnValue([{ name: 'Chrome', path: 'C:\\chrome.exe' }])

      initDefaultBrowsers()

      // Only system browser added (chromium register caught)
      expect(mockRun).toHaveBeenCalledTimes(1)
      expect(mockRun).toHaveBeenCalledWith(
        'INSERT INTO browser (name, path, is_enabled, puppeteer_version, chrome_version) VALUES (?, ?, 1, ?, ?)',
        ['Chrome', 'C:\\chrome.exe', 'auto', '120.0.0.0']
      )
    })
  })

  // ── detectAndAddNewBrowsers ──

  describe('detectAndAddNewBrowsers', () => {
    it('全部为新浏览器时添加计数正确', () => {
      mockQuery.mockReturnValue([])
      mockGetInstalledChromePath.mockReturnValue('D:\\app\\chromium.exe')
      mockGetBrowserVersion.mockReturnValue({ version: '120.0.0.0', majorVersion: 120 })
      mockDetectChrome.mockReturnValue([
        { name: 'Chrome', path: 'C:\\chrome.exe' },
        { name: 'Edge', path: 'C:\\edge.exe' },
      ])

      const result = detectAndAddNewBrowsers()

      expect(result.added).toBe(3) // chromium + chrome + edge
      expect(result.skipped).toBe(0)
      expect(result.total).toBe(3)
    })

    it('全部已存在时跳过计数正确', () => {
      const existing = [
        makeBrowserConfig({ path: 'D:\\app\\chromium.exe' }),
        makeBrowserConfig({ path: 'C:\\chrome.exe', id: 2 }),
      ]
      mockQuery.mockReturnValue(existing)
      mockGetInstalledChromePath.mockReturnValue('D:\\app\\chromium.exe')
      mockDetectChrome.mockReturnValue([{ name: 'Chrome', path: 'C:\\chrome.exe' }])

      const result = detectAndAddNewBrowsers()

      // Chromium 已在数据库中，if 语句直接跳过（不计入 skipped）
      // Chrome 在 detectChrome 中命中 → skipped++
      expect(result.added).toBe(0)
      expect(result.skipped).toBe(1)
      expect(result.total).toBe(2) // chromium + chrome
    })

    it('混合场景计数正确（部分新，部分已存在）', () => {
      const existing = [makeBrowserConfig({ path: 'C:\\chrome.exe' })]
      mockQuery.mockReturnValue(existing)
      mockGetInstalledChromePath.mockReturnValue('D:\\app\\chromium.exe')
      mockGetBrowserVersion.mockReturnValue({ version: '120.0.0.0', majorVersion: 120 })
      mockDetectChrome.mockReturnValue([
        { name: 'Chrome', path: 'C:\\chrome.exe' }, // 已存在
        { name: 'Edge', path: 'C:\\edge.exe' },     // 新
      ])

      const result = detectAndAddNewBrowsers()

      expect(result.added).toBe(2) // chromium + edge
      expect(result.skipped).toBe(1) // chrome skipped
      expect(result.total).toBe(3) // chromium + chrome + edge
    })

    it('Chromium 路径为 null 时只统计系统浏览器', () => {
      mockQuery.mockReturnValue([])
      mockGetInstalledChromePath.mockReturnValue(null)
      mockDetectChrome.mockReturnValue([{ name: 'Chrome', path: 'C:\\chrome.exe' }])
      mockGetBrowserVersion.mockReturnValue({ version: '120.0.0.0', majorVersion: 120 })

      const result = detectAndAddNewBrowsers()

      expect(result.added).toBe(1)
      expect(result.skipped).toBe(0)
      expect(result.total).toBe(1)
    })

    it('插入异常时 skipped 递增而非崩溃', () => {
      mockQuery.mockReturnValue([])
      mockGetInstalledChromePath.mockReturnValue('D:\\app\\chromium.exe')
      mockDetectChrome.mockReturnValue([{ name: 'Chrome', path: 'C:\\chrome.exe' }])
      // getBrowserVersion throws when called (insert fails)
      mockGetBrowserVersion.mockImplementation(() => {
        throw new Error('Duplicate')
      })

      const result = detectAndAddNewBrowsers()

      // Both fail to insert → skipped, not added
      expect(result.skipped).toBe(2)
      expect(result.added).toBe(0)
      expect(result.total).toBe(2)
    })

    it('路径比较不区分大小写', () => {
      const existing = [makeBrowserConfig({ path: 'C:\\Chrome.EXE' })]
      mockQuery.mockReturnValue(existing)
      mockGetInstalledChromePath.mockReturnValue(null)
      mockDetectChrome.mockReturnValue([{ name: 'Chrome', path: 'c:\\chrome.exe' }])

      const result = detectAndAddNewBrowsers()

      expect(result.skipped).toBe(1)
      expect(result.added).toBe(0)
    })
  })

  // ── getAvailableBrowsers ──

  describe('getAvailableBrowsers', () => {
    it('数据库有有效路径时直接返回数据库浏览器', () => {
      // 使用项目内真实存在的文件路径，避免依赖 fs mock（require('fs') 可能不受 vi.mock 拦截）
      const enabled = makeBrowserConfig({ id: 1, path: 'package.json' })
      mockQuery.mockReturnValue([enabled])

      const result = getAvailableBrowsers()

      expect(result).toEqual([enabled])
      expect(mockDetectChrome).not.toHaveBeenCalled()
    })

    it('数据库路径全部无效时回退到系统检测', () => {
      const enabled = [makeBrowserConfig({ path: 'C:\\nonexistent\\chrome.exe' })]
      mockQuery.mockReturnValue(enabled)
      mockDetectChrome.mockReturnValue([{ name: 'Chrome', path: 'C:\\real-chrome.exe' }])

      const result = getAvailableBrowsers()

      expect(result.length).toBe(1)
      expect(result[0].id).toBe(0) // 临时 ID
      expect(result[0].name).toBe('Chrome')
      expect(result[0].path).toBe('C:\\real-chrome.exe')
      expect(result[0].is_enabled).toBe(true)
      expect(result[0].puppeteer_version).toBe('auto')
      expect(result[0].chrome_version).toBeNull()
      expect(mockDetectChrome).toHaveBeenCalled()
    })

    it('数据库无浏览器且检测结果为空时返回空数组', () => {
      mockQuery.mockReturnValue([])
      mockDetectChrome.mockReturnValue([])

      const result = getAvailableBrowsers()

      expect(result).toEqual([])
    })

    it('多个数据库浏览器中只返回路径有效的', () => {
      const browsers = [
        makeBrowserConfig({ id: 1, path: 'package.json' }),          // 真实存在
        makeBrowserConfig({ id: 2, path: 'C:\\nonexistent\\chrome.exe' }), // 不存在
      ]
      mockQuery.mockReturnValue(browsers)

      const result = getAvailableBrowsers()

      expect(result.length).toBe(1)
      expect(result[0].id).toBe(1)
      expect(mockDetectChrome).not.toHaveBeenCalled()
    })
  })
})

/**
 * Chrome & ChromeVersion 服务单元测试
 */
import { describe, it, expect, beforeEach, vi, afterAll } from 'vitest'

const { mockExecSync, mockExistsSync, mockLstatSync, mockRealpathSync } = vi.hoisted(() => ({
  mockExecSync: vi.fn(),
  mockExistsSync: vi.fn(() => true),
  mockLstatSync: vi.fn(() => ({ isSymbolicLink: () => false })),
  mockRealpathSync: vi.fn((p: string) => p),
}))

vi.mock('child_process', () => ({ execSync: mockExecSync }))
vi.mock('fs', () => ({ existsSync: mockExistsSync, lstatSync: mockLstatSync, realpathSync: mockRealpathSync }))

const { mockPlatform } = vi.hoisted(() => ({ mockPlatform: vi.fn(() => 'win32') }))
vi.mock('os', () => ({ platform: mockPlatform }))

const originalEnv = process.env
beforeEach(() => { process.env = { ...originalEnv } })
afterAll(() => { process.env = originalEnv })

import { detectChrome } from '../../../../electron/backend/services/chrome'
import { getBrowserVersion, decidePuppeteerVersion, detectBrowserVersions, CHROME_VERSION_THRESHOLD } from '../../../../electron/backend/services/chromeVersion'

describe('chrome 服务', () => {
  beforeEach(() => { vi.clearAllMocks(); mockExistsSync.mockReturnValue(true); mockPlatform.mockReturnValue('win32') })

  describe('detectChrome', () => {
    it('Windows: 检测到 Chrome', () => {
      mockExecSync.mockReturnValueOnce('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe\n')
      expect(detectChrome().length).toBeGreaterThan(0)
    })
    it('Linux: 检测到浏览器', () => {
      mockPlatform.mockReturnValue('linux')
      mockExecSync.mockImplementation((cmd: string) => { if (cmd.includes('which google-chrome')) return '/usr/bin/google-chrome'; throw new Error('nf') })
      expect(detectChrome().length).toBeGreaterThan(0)
    })
    it('无浏览器时返回空数组', () => {
      mockPlatform.mockReturnValue('linux')
      mockExecSync.mockImplementation(() => { throw new Error('nf') })
      mockExistsSync.mockReturnValue(false)
      expect(detectChrome()).toEqual([])
    })
    it('返回的浏览器有正确字段', () => {
      mockExecSync.mockReturnValue('C:\\chrome.exe')
      const result = detectChrome()
      if (result.length > 0) {
        expect(result[0]).toHaveProperty('name')
        expect(result[0]).toHaveProperty('path')
      }
    })
  })
})

describe('chromeVersion 服务', () => {
  beforeEach(() => { vi.clearAllMocks(); mockExistsSync.mockReturnValue(true); mockPlatform.mockReturnValue('win32') })

  describe('getBrowserVersion', () => {
    it('Windows: 获取版本号', () => {
      mockExecSync.mockReturnValue('Version=120.0.6099.109\r\n')
      const r = getBrowserVersion('C:\\chrome.exe')
      expect(r.version).toBe('120.0.6099.109')
      expect(r.majorVersion).toBe(120)
    })
    it('浏览器文件不存在时返回错误', () => {
      mockExistsSync.mockReturnValue(false)
      expect(getBrowserVersion('/no').version).toBeNull()
    })
    it('wmic失败回退到--version', () => {
      mockExecSync.mockImplementationOnce(() => { throw new Error('wmic') }).mockImplementationOnce(() => { throw new Error('ps') }).mockReturnValueOnce('Google Chrome 120.0.6099.109')
      expect(getBrowserVersion('C:\\chrome.exe').version).toBe('120.0.6099.109')
    })
    it('所有方法失败返回null', () => {
      mockExecSync.mockImplementation(() => { throw new Error('fail') })
      expect(getBrowserVersion('C:\\chrome.exe').version).toBeNull()
    })
    it('不支持平台返回错误', () => {
      mockPlatform.mockReturnValue('freebsd')
      expect(getBrowserVersion('/b').error).toContain('Unsupported')
    })
  })

  describe('decidePuppeteerVersion', () => {
    it('high', () => expect(decidePuppeteerVersion(80, 'high')).toBe('high'))
    it('low', () => expect(decidePuppeteerVersion(130, 'low')).toBe('low'))
    it('auto: low', () => expect(decidePuppeteerVersion(90, 'auto')).toBe('low'))
    it('auto: high', () => expect(decidePuppeteerVersion(120, 'auto')).toBe('high'))
    it('auto: 112 threshold', () => expect(decidePuppeteerVersion(112, 'auto')).toBe('high'))
    it('auto: null', () => expect(decidePuppeteerVersion(null, 'auto')).toBe('high'))
  })

  describe('detectBrowserVersions', () => {
    it('批量检测', () => {
      mockExecSync.mockReturnValue('Version=100.0.0.0\r\n')
      expect(detectBrowserVersions(['/a', '/b']).size).toBe(2)
    })
  })

  describe('CHROME_VERSION_THRESHOLD', () => {
    it('阈值为112', () => expect(CHROME_VERSION_THRESHOLD).toBe(112))
  })
})

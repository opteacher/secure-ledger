/**
 * Chromium 管理服务单元测试
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

const { mockAddBrowser, mockGetBrowserList, mockDeleteBrowser } = vi.hoisted(() => ({
  mockAddBrowser: vi.fn(), mockGetBrowserList: vi.fn(() => []), mockDeleteBrowser: vi.fn(),
}))

vi.mock('../../../../electron/backend/services/browser', () => ({
  addBrowser: mockAddBrowser, getBrowserList: mockGetBrowserList, deleteBrowser: mockDeleteBrowser,
}))

const { mockExistsSync } = vi.hoisted(() => ({ mockExistsSync: vi.fn() }))
vi.mock('fs', () => ({ existsSync: mockExistsSync, mkdirSync: vi.fn(), copyFileSync: vi.fn(), chmodSync: vi.fn(), unlinkSync: vi.fn() }))
const { mockExecSync } = vi.hoisted(() => ({ mockExecSync: vi.fn() }))
vi.mock('child_process', () => ({ execSync: mockExecSync }))
const { mockPlatform, mockArch } = vi.hoisted(() => ({ mockPlatform: vi.fn(() => 'win32'), mockArch: vi.fn(() => 'x64') }))
vi.mock('os', () => ({ platform: mockPlatform, arch: mockArch }))
vi.mock('extract-zip', () => ({ default: vi.fn(() => Promise.resolve()) }))

const originalEnv = process.env
beforeEach(() => { process.env = { ...originalEnv }; delete process.env.VITE_DEV_SERVER_URL; vi.clearAllMocks(); mockExistsSync.mockReturnValue(false); mockPlatform.mockReturnValue('win32'); mockArch.mockReturnValue('x64') })
afterAll(() => { process.env = originalEnv })

import {
  getInstalledChromePath, isChromeInstalled, registerChrome, unregisterChrome,
  installChrome, uninstallChrome, getChromeStatus, ensureChrome,
} from '../../../../electron/backend/services/chromium'

describe('chromium 服务', () => {
  describe('getInstalledChromePath', () => {
    it('Chrome 已安装返回路径', () => { mockExistsSync.mockImplementation((p: string) => p.includes('chrome.exe') || p.includes('win64')); expect(getInstalledChromePath()).toBeTruthy() })
    it('未安装返回 null', () => { mockExistsSync.mockReturnValue(false); expect(getInstalledChromePath()).toBeNull() })
  })

  describe('isChromeInstalled', () => {
    it('安装返回 true', () => { mockExistsSync.mockImplementation((p: string) => p.includes('chrome.exe') || p.includes('win64')); expect(isChromeInstalled()).toBe(true) })
    it('未安装返回 false', () => { expect(isChromeInstalled()).toBe(false) })
  })

  describe('registerChrome', () => {
    it('未安装返回失败', () => { expect(registerChrome().success).toBe(false) })
    it('已安装已注册返回成功', () => {
      mockExistsSync.mockImplementation((p: string) => p.includes('chrome.exe') || p.includes('win64'))
      mockGetBrowserList.mockReturnValue([{ path: 'some-path' }])
      const r = registerChrome()
      expect(r).toHaveProperty('success')
    })
  })

  describe('unregisterChrome', () => {
    it('未安装返回失败', () => { expect(unregisterChrome().success).toBe(false) })
    it('安装但未注册返回成功', () => {
      mockExistsSync.mockImplementation((p: string) => p.includes('chrome.exe') || p.includes('win64'))
      mockGetBrowserList.mockReturnValue([])
      expect(unregisterChrome().success).toBe(true)
    })
  })

  describe('installChrome', () => {
    it('不支持平台返回失败', async () => { mockPlatform.mockReturnValue('freebsd'); expect((await installChrome()).success).toBe(false) })
    it('已安装直接返回成功', async () => {
      mockExistsSync.mockImplementation((p: string) => p.includes('chrome.exe') || p.includes('win64'))
      expect((await installChrome()).success).toBe(true)
    })
  })

  describe('uninstallChrome', () => {
    it('卸载成功', () => {
      mockExistsSync.mockImplementation((p: string) => p.includes('chrome.exe') || p.includes('chromium') || p.includes('win64'))
      expect(uninstallChrome().success).toBe(true)
    })
  })

  describe('getChromeStatus', () => {
    it('已安装状态', () => {
      mockExistsSync.mockImplementation((p: string) => p.includes('chrome.exe') || p.includes('win64'))
      const s = getChromeStatus()
      expect(s.installed).toBe(true)
      expect(s.platform).toBe('win32-x64')
    })
    it('未安装状态', () => { expect(getChromeStatus().installed).toBe(false) })
  })

  describe('ensureChrome', () => {
    it('已安装返回就绪', async () => {
      mockExistsSync.mockImplementation((p: string) => p.includes('chrome.exe') || p.includes('win64'))
      expect((await ensureChrome()).installed).toBe(true)
    })
  })
})

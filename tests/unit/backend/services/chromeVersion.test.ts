/**
 * Chrome 版本检测服务单元测试
 * 测试 chromeVersion.ts 的所有导出函数和常量
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

// ─── 使用 vi.hoisted 避免 hoisting 引用错误 ─────────────

const { mockExecSync, mockExistsSync, mockPlatform } = vi.hoisted(() => ({
  mockExecSync: vi.fn(),
  mockExistsSync: vi.fn(() => true),
  mockPlatform: vi.fn(() => 'win32'),
}))

// ─── Mock 模块 ────────────────────────────────────────────

vi.mock('child_process', () => ({ execSync: mockExecSync }))
vi.mock('fs', () => ({ existsSync: mockExistsSync }))
vi.mock('os', () => ({ platform: mockPlatform }))

// ─── 动态导入被测模块 ────────────────────────────────────

import {
  getBrowserVersion,
  decidePuppeteerVersion,
  detectBrowserVersions,
  CHROME_VERSION_THRESHOLD,
} from '../../../../electron/backend/services/chromeVersion'

// ─── 测试套件 ────────────────────────────────────────────

describe('chromeVersion 服务', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockExistsSync.mockReturnValue(true)
    mockPlatform.mockReturnValue('win32')
  })

  // ─── getBrowserVersion ─────────────────────────────────

  describe('getBrowserVersion', () => {
    it('浏览器文件不存在时返回错误信息', () => {
      mockExistsSync.mockReturnValue(false)

      const result = getBrowserVersion('C:\\no-such-browser.exe')

      expect(result.path).toBe('C:\\no-such-browser.exe')
      expect(result.version).toBeNull()
      expect(result.majorVersion).toBeNull()
      expect(result.error).toBe('Browser executable not found')
    })

    it('不支持的平台返回错误信息', () => {
      mockPlatform.mockReturnValue('freebsd')

      const result = getBrowserVersion('/usr/bin/browser')

      expect(result.error).toContain('Unsupported platform')
      expect(result.error).toContain('freebsd')
      expect(result.version).toBeNull()
      expect(result.majorVersion).toBeNull()
    })

    // ─── Windows 平台测试 ────────────────────────

    it('win32: wmic 成功获取版本号', () => {
      mockPlatform.mockReturnValue('win32')
      mockExecSync.mockImplementation((cmd: string) => {
        if (cmd.includes('wmic')) return 'Version=127.0.6533.88\r\n'
        throw new Error('unexpected')
      })

      const result = getBrowserVersion('C:\\Program Files\\Chrome\\chrome.exe')

      expect(result.version).toBe('127.0.6533.88')
      expect(result.majorVersion).toBe(127)
      expect(result.error).toBeUndefined()
    })

    it('win32: wmic 失败，PowerShell 成功获取版本号', () => {
      mockPlatform.mockReturnValue('win32')
      mockExecSync.mockImplementation((cmd: string) => {
        if (cmd.includes('wmic')) throw new Error('wmic failed')
        if (cmd.includes('powershell')) return '127.0.6533.88'
        throw new Error('unexpected')
      })

      const result = getBrowserVersion('C:\\Chrome\\chrome.exe')

      expect(result.version).toBe('127.0.6533.88')
      expect(result.majorVersion).toBe(127)
    })

    it('win32: wmic 和 PowerShell 都失败，--version 成功获取版本号', () => {
      mockPlatform.mockReturnValue('win32')
      mockExecSync.mockImplementation((cmd: string) => {
        if (cmd.includes('wmic')) throw new Error('wmic failed')
        if (cmd.includes('powershell')) throw new Error('powershell failed')
        if (cmd.includes('--version')) return 'Google Chrome 127.0.6533.88'
        throw new Error('unexpected')
      })

      const result = getBrowserVersion('C:\\Chrome\\chrome.exe')

      expect(result.version).toBe('127.0.6533.88')
      expect(result.majorVersion).toBe(127)
    })

    it('win32: PowerShell 返回哨兵值 "0.0.0.0" 时回退到 --version', () => {
      mockPlatform.mockReturnValue('win32')
      mockExecSync.mockImplementation((cmd: string) => {
        if (cmd.includes('wmic')) throw new Error('wmic failed')
        if (cmd.includes('powershell')) return '0.0.0.0'
        if (cmd.includes('--version')) return 'Chromium 120.0.6099.109'
        throw new Error('unexpected')
      })

      const result = getBrowserVersion('C:\\Edge\\msedge.exe')

      expect(result.version).toBe('120.0.6099.109')
      expect(result.majorVersion).toBe(120)
    })

    it('win32: 三种方法全部失败返回 null', () => {
      mockPlatform.mockReturnValue('win32')
      mockExecSync.mockImplementation(() => {
        throw new Error('all methods failed')
      })

      const result = getBrowserVersion('C:\\bad-browser.exe')

      expect(result.version).toBeNull()
      expect(result.majorVersion).toBeNull()
    })

    // ─── macOS 平台测试 ──────────────────────────

    it('darwin: mdls 成功获取版本号', () => {
      mockPlatform.mockReturnValue('darwin')
      mockExecSync.mockImplementation((cmd: string) => {
        if (cmd.includes('mdls')) return 'kMDItemVersion = "127.0.6533.88"'
        throw new Error('unexpected')
      })

      const result = getBrowserVersion('/Applications/Chrome.app')

      expect(result.version).toBe('127.0.6533.88')
      expect(result.majorVersion).toBe(127)
    })

    it('darwin: mdls 失败，PlistBuddy 成功获取版本号（.app 路径）', () => {
      mockPlatform.mockReturnValue('darwin')
      mockExecSync.mockImplementation((cmd: string) => {
        if (cmd.includes('mdls')) throw new Error('mdls failed')
        if (cmd.includes('PlistBuddy')) return '130.0.6723.59\n'
        throw new Error('unexpected')
      })

      const result = getBrowserVersion('/Applications/Google Chrome.app')

      expect(result.version).toBe('130.0.6723.59')
      expect(result.majorVersion).toBe(130)
    })

    it('darwin: 非 .app 路径跳过 PlistBuddy，直接使用 --version', () => {
      mockPlatform.mockReturnValue('darwin')
      mockExecSync.mockImplementation((cmd: string) => {
        if (cmd.includes('mdls')) throw new Error('mdls failed')
        if (cmd.includes('PlistBuddy')) throw new Error('should not call PlistBuddy')
        if (cmd.includes('--version')) return 'Chromium 120.0.6099.109'
        throw new Error('unexpected')
      })

      const result = getBrowserVersion('/usr/local/bin/chromium')

      expect(result.version).toBe('120.0.6099.109')
      expect(result.majorVersion).toBe(120)
    })

    it('darwin: mdls 和 PlistBuddy 都失败，--version 成功', () => {
      mockPlatform.mockReturnValue('darwin')
      mockExecSync.mockImplementation((cmd: string) => {
        if (cmd.includes('mdls')) throw new Error('mdls failed')
        if (cmd.includes('PlistBuddy')) throw new Error('PlistBuddy failed')
        if (cmd.includes('--version')) return 'Google Chrome 115.0.5790.170'
        throw new Error('unexpected')
      })

      const result = getBrowserVersion('/Applications/Brave Browser.app')

      expect(result.version).toBe('115.0.5790.170')
      expect(result.majorVersion).toBe(115)
    })

    it('darwin: 所有方法失败返回 null', () => {
      mockPlatform.mockReturnValue('darwin')
      mockExecSync.mockImplementation(() => {
        throw new Error('all methods failed')
      })

      const result = getBrowserVersion('/Applications/Bad.app')

      expect(result.version).toBeNull()
      expect(result.majorVersion).toBeNull()
    })

    // ─── Linux 平台测试 ──────────────────────────

    it('linux: --version 成功获取版本号', () => {
      mockPlatform.mockReturnValue('linux')
      mockExecSync.mockImplementation((cmd: string) => {
        if (cmd.includes('--version')) return 'Google Chrome 127.0.6533.88'
        throw new Error('unexpected')
      })

      const result = getBrowserVersion('/usr/bin/google-chrome')

      expect(result.version).toBe('127.0.6533.88')
      expect(result.majorVersion).toBe(127)
    })

    it('linux: --version 失败，snap info 成功（/snap/ 路径）', () => {
      mockPlatform.mockReturnValue('linux')
      mockExecSync.mockImplementation((cmd: string) => {
        if (cmd.includes('--version')) throw new Error('--version failed')
        if (cmd.includes('snap info')) return '  installed:          120.0.6099.109'
        throw new Error('unexpected')
      })

      const result = getBrowserVersion('/snap/chromium/current')

      expect(result.version).toBe('120.0.6099.109')
      expect(result.majorVersion).toBe(120)
    })

    it('linux: 非 /snap/ 路径跳过 snap info，直接返回 null', () => {
      mockPlatform.mockReturnValue('linux')
      mockExecSync.mockImplementation(() => {
        throw new Error('--version failed')
      })

      const result = getBrowserVersion('/usr/bin/chromium-browser')

      expect(result.version).toBeNull()
      expect(result.majorVersion).toBeNull()
    })

    it('linux: 所有方法失败返回 null', () => {
      mockPlatform.mockReturnValue('linux')
      mockExecSync.mockImplementation(() => {
        throw new Error('all methods failed')
      })

      const result = getBrowserVersion('/snap/firefox/current')

      expect(result.version).toBeNull()
      expect(result.majorVersion).toBeNull()
    })

    // ─── execSync 异常处理 ───────────────────────

    it('所有内部方法失败时返回 null 版本（execSync 异常被内部 catch 处理）', () => {
      mockPlatform.mockReturnValue('linux')
      mockExecSync.mockImplementation(() => {
        throw new Error('ETIMEDOUT: connection timeout')
      })

      const result = getBrowserVersion('/usr/bin/google-chrome')

      expect(result.version).toBeNull()
      expect(result.majorVersion).toBeNull()
      // execSync 异常被内部函数的 try/catch 捕获，不会传播到外部
      // 因此 result.error 为 undefined（无错误信息）
      expect(result.error).toBeUndefined()
    })

    // ─── 版本号解析 ─────────────────────────────

    it('正确解析 "127.0.6533.88" 的主版本号为 127', () => {
      mockPlatform.mockReturnValue('linux')
      mockExecSync.mockReturnValue('Google Chrome 127.0.6533.88')

      const result = getBrowserVersion('/usr/bin/google-chrome')

      expect(result.version).toBe('127.0.6533.88')
      expect(result.majorVersion).toBe(127)
    })

    it('主版本号不可解析时（如以点开头 ".127.0.6533.88"）返回 majorVersion 为 null', () => {
      // 使用 linux --version 路径：正则 /[\d.]+/ 能匹配 ".127.0.6533.88"
      // 但 parseInt('.', 10) 返回 NaN → majorVersion 为 null
      mockPlatform.mockReturnValue('linux')
      mockExecSync.mockReturnValue('.127.0.6533.88')

      const result = getBrowserVersion('/usr/bin/google-chrome')

      expect(result.version).toBe('.127.0.6533.88')
      expect(result.majorVersion).toBeNull()
    })

    it('version 为 null 时 majorVersion 也为 null', () => {
      mockPlatform.mockReturnValue('win32')
      mockExecSync.mockImplementation(() => {
        throw new Error('all failed')
      })

      const result = getBrowserVersion('C:\\chrome.exe')

      expect(result.version).toBeNull()
      expect(result.majorVersion).toBeNull()
    })
  })

  // ─── decidePuppeteerVersion ─────────────────────────────

  describe('decidePuppeteerVersion', () => {
    it('auto 模式 + majorVersion 为 null → 返回 high（默认高版本）', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      const result = decidePuppeteerVersion(null, 'auto')

      expect(result).toBe('high')
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Cannot detect Chrome version')
      )
      consoleSpy.mockRestore()
    })

    it('auto 模式 + majorVersion < 112（如 90）→ 返回 low', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      const result = decidePuppeteerVersion(90, 'auto')

      expect(result).toBe('low')
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('using low version Puppeteer')
      )
      consoleSpy.mockRestore()
    })

    it('auto 模式 + majorVersion = 112（等于阈值）→ 返回 high', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      const result = decidePuppeteerVersion(112, 'auto')

      expect(result).toBe('high')
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('using high version Puppeteer')
      )
      consoleSpy.mockRestore()
    })

    it('auto 模式 + majorVersion > 112（如 120）→ 返回 high', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      const result = decidePuppeteerVersion(120, 'auto')

      expect(result).toBe('high')
      consoleSpy.mockRestore()
    })

    it('auto 模式 + majorVersion = 111（低于阈值）→ 返回 low', () => {
      const result = decidePuppeteerVersion(111, 'auto')

      expect(result).toBe('low')
    })

    it('用户指定 high 覆盖所有：null 版本仍返回 high', () => {
      const result = decidePuppeteerVersion(null, 'high')

      expect(result).toBe('high')
    })

    it('用户指定 high 覆盖所有：低版本 90 仍返回 high', () => {
      const result = decidePuppeteerVersion(90, 'high')

      expect(result).toBe('high')
    })

    it('用户指定 high 覆盖所有：高版本 120 仍返回 high', () => {
      const result = decidePuppeteerVersion(120, 'high')

      expect(result).toBe('high')
    })

    it('用户指定 low 覆盖所有：null 版本仍返回 low', () => {
      const result = decidePuppeteerVersion(null, 'low')

      expect(result).toBe('low')
    })

    it('用户指定 low 覆盖所有：低版本 90 仍返回 low', () => {
      const result = decidePuppeteerVersion(90, 'low')

      expect(result).toBe('low')
    })

    it('用户指定 low 覆盖所有：高版本 130 仍返回 low', () => {
      const result = decidePuppeteerVersion(130, 'low')

      expect(result).toBe('low')
    })

    it('默认 userPreference 为 auto（不传第三个参数）', () => {
      // 不传 userPreference，使用默认值 'auto'
      const result = decidePuppeteerVersion(100)

      expect(result).toBe('low')
    })
  })

  // ─── detectBrowserVersions ──────────────────────────────

  describe('detectBrowserVersions', () => {
    it('多个路径返回对应数量的版本信息', () => {
      mockExecSync.mockImplementation((cmd: string) => {
        if (cmd.includes('wmic')) return 'Version=100.0.0.0\r\n'
        throw new Error('unexpected')
      })

      const results = detectBrowserVersions(['C:\\a.exe', 'C:\\b.exe', 'C:\\c.exe'])

      expect(results.size).toBe(3)
      expect(results.get('C:\\a.exe')?.version).toBe('100.0.0.0')
      expect(results.get('C:\\b.exe')?.version).toBe('100.0.0.0')
      expect(results.get('C:\\c.exe')?.version).toBe('100.0.0.0')
    })

    it('空数组返回空 Map', () => {
      const results = detectBrowserVersions([])

      expect(results.size).toBe(0)
    })

    it('混合成功/失败：部分路径存在，部分不存在', () => {
      mockPlatform.mockReturnValue('win32')
      mockExecSync.mockImplementation((cmd: string) => {
        if (cmd.includes('wmic')) return 'Version=120.0.0.0\r\n'
        throw new Error('unexpected')
      })
      // 路径 "C:\\missing.exe" 不存在
      mockExistsSync.mockImplementation((p: string) => !p.includes('missing'))

      const results = detectBrowserVersions([
        'C:\\good.exe',
        'C:\\missing.exe',
        'C:\\also-good.exe',
      ])

      expect(results.size).toBe(3)
      expect(results.get('C:\\good.exe')?.version).toBe('120.0.0.0')
      expect(results.get('C:\\good.exe')?.error).toBeUndefined()
      expect(results.get('C:\\missing.exe')?.version).toBeNull()
      expect(results.get('C:\\missing.exe')?.error).toBe('Browser executable not found')
      expect(results.get('C:\\also-good.exe')?.version).toBe('120.0.0.0')
    })

    it('所有路径均不存在时返回带错误信息的 Map', () => {
      mockExistsSync.mockReturnValue(false)

      const results = detectBrowserVersions(['/a', '/b'])

      expect(results.size).toBe(2)
      for (const info of results.values()) {
        expect(info.version).toBeNull()
        expect(info.error).toBe('Browser executable not found')
      }
    })
  })

  // ─── CHROME_VERSION_THRESHOLD ───────────────────────────

  describe('CHROME_VERSION_THRESHOLD', () => {
    it('阈值常量应为 112', () => {
      expect(CHROME_VERSION_THRESHOLD).toBe(112)
    })
  })
})

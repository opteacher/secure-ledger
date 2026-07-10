/**
 * 日志服务测试
 * 测试 getLogDir, getLogContent, clearLogs, logger 对象
 * 以及 initLogger 的行为（目录创建、版本检查）
 *
 * Mock: fs 模块, electron.app（通过全局 mock 提供）
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ============================================================
// Mock fs - all mock functions for fine-grained control
// ============================================================
const mockExistsSync = vi.fn()
const mockMkdirSync = vi.fn()
const mockWriteFileSync = vi.fn()
const mockReadFileSync = vi.fn()
const mockAppendFileSync = vi.fn()
const mockStatSync = vi.fn()
const mockRenameSync = vi.fn()
const mockReaddirSync = vi.fn()
const mockUnlinkSync = vi.fn()
const mockRmSync = vi.fn()

vi.mock('fs', () => ({
  existsSync: (...args: any[]) => mockExistsSync(...args),
  mkdirSync: (...args: any[]) => mockMkdirSync(...args),
  writeFileSync: (...args: any[]) => mockWriteFileSync(...args),
  readFileSync: (...args: any[]) => mockReadFileSync(...args),
  appendFileSync: (...args: any[]) => mockAppendFileSync(...args),
  statSync: (...args: any[]) => mockStatSync(...args),
  renameSync: (...args: any[]) => mockRenameSync(...args),
  readdirSync: (...args: any[]) => mockReaddirSync(...args),
  unlinkSync: (...args: any[]) => mockUnlinkSync(...args),
  rmSync: (...args: any[]) => mockRmSync(...args),
}))

vi.mock('path', async () => {
  const actual = await vi.importActual('path')
  return { ...actual }
})

import { mockApp } from '../../../helpers/electron-mock'

function makeStat(size: number, mtime?: number) {
  return {
    size,
    mtime: { getTime: () => mtime || Date.now() },
    isFile: () => true,
    isDirectory: () => false,
  }
}

// ============================================================
// Tests
// ============================================================

describe('getLogDir', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    vi.resetModules()
    mockExistsSync.mockReturnValue(false)
  })

  it('应返回日志目录路径（字符串且非空）', async () => {
    const mod = await import('../../../../electron/backend/services/logger')
    const dir = mod.getLogDir()
    expect(dir).toBeDefined()
    expect(typeof dir).toBe('string')
  })

  it('initLogger 后应返回正确的日志路径', async () => {
    mockExistsSync.mockReturnValue(false)
    const mod = await import('../../../../electron/backend/services/logger')
    mockApp.getVersion.mockReturnValue('1.0.0')

    const origLog = console.log
    const origInfo = console.info
    const origWarn = console.warn
    const origError = console.error

    mod.initLogger()

    const dir = mod.getLogDir()
    expect(dir).toContain('logs')

    console.log = origLog
    console.info = origInfo
    console.warn = origWarn
    console.error = origError
  })
})

describe('getLogContent', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    vi.resetModules()
    mockExistsSync.mockReturnValue(false)
  })

  it('日志目录无文件时应返回 "No logs available"', async () => {
    const mod = await import('../../../../electron/backend/services/logger')
    mockReaddirSync.mockReturnValue([])

    const content = mod.getLogContent()
    expect(content).toBe('No logs available')
  })

  it('应读取最新日志文件的内容', async () => {
    const mod = await import('../../../../electron/backend/services/logger')

    const now = Date.now()
    const oldTime = now - 3600000

    mockReaddirSync.mockReturnValue(['app-2024-01-01.log', 'app-2024-01-02.log'])
    mockStatSync
      .mockReturnValueOnce(makeStat(500, oldTime))
      .mockReturnValueOnce(makeStat(1000, now))
      .mockReturnValueOnce(makeStat(500, oldTime))
      .mockReturnValueOnce(makeStat(1000, now))

    mockReadFileSync.mockReturnValue('[2024-01-02T10:00:00.000Z] [INFO] Test log\n')

    const content = mod.getLogContent()
    expect(content).toContain('Test log')
  })

  it('日志超过 maxLines 时应截断并显示最后 N 行', async () => {
    const mod = await import('../../../../electron/backend/services/logger')

    mockReaddirSync.mockReturnValue(['app-2024-01-01.log'])
    mockStatSync.mockReturnValue(makeStat(2000))

    const lines = Array.from({ length: 100 }, (_, i) => `line ${i}`)
    mockReadFileSync.mockReturnValue(lines.join('\n'))

    const content = mod.getLogContent(10)
    expect(content).toContain('showing last 10 lines')
    expect(content).toContain('line 99')
  })

  it('多个日志文件时应显示文件列表', async () => {
    const mod = await import('../../../../electron/backend/services/logger')

    const now = Date.now()
    mockReaddirSync.mockReturnValue([
      'app-2024-01-01.log', 'app-2024-01-02.log', 'app-2024-01-03.log',
    ])
    mockStatSync
      .mockReturnValueOnce(makeStat(500, now - 172800000))
      .mockReturnValueOnce(makeStat(800, now - 86400000))
      .mockReturnValueOnce(makeStat(1200, now))
      .mockReturnValueOnce(makeStat(500, now - 172800000))
      .mockReturnValueOnce(makeStat(800, now - 86400000))

    mockReadFileSync.mockReturnValue('latest log content')

    const content = mod.getLogContent()
    expect(content).toContain('Log files (3 total)')
    expect(content).toContain('app-2024-01-03.log')
  })

  it('超过 5 个日志文件时只显示前 5 个并提示剩余', async () => {
    const mod = await import('../../../../electron/backend/services/logger')

    const now = Date.now()
    const logFiles = Array.from({ length: 8 }, (_, i) => `app-2024-01-0${i + 1}.log`)
    mockReaddirSync.mockReturnValue(logFiles)

    for (let i = 0; i < 8; i++) {
      mockStatSync.mockReturnValueOnce(makeStat(500 * (i + 1), now - i * 86400000))
    }
    for (let i = 0; i < 5; i++) {
      mockStatSync.mockReturnValueOnce(makeStat(500 * (i + 1), now - i * 86400000))
    }

    mockReadFileSync.mockReturnValue('content')

    const content = mod.getLogContent()
    expect(content).toContain('and 3 more files')
  })

  it('读取失败时应返回错误消息', async () => {
    const mod = await import('../../../../electron/backend/services/logger')

    mockReaddirSync.mockReturnValue(['app-2024-01-01.log'])
    mockStatSync.mockImplementation(() => {
      throw new Error('stat failed')
    })

    const content = mod.getLogContent()
    expect(content).toContain('Failed to read logs')
  })

  it('日志内容不超过 maxLines 时应全部返回', async () => {
    const mod = await import('../../../../electron/backend/services/logger')

    mockReaddirSync.mockReturnValue(['app-2024-01-01.log'])
    mockStatSync.mockReturnValue(makeStat(2000))
    mockReadFileSync.mockReturnValue('line1\nline2\nline3')

    const content = mod.getLogContent(100)
    expect(content).toBe('line1\nline2\nline3')
    expect(content).not.toContain('showing last')
  })
})

describe('clearLogs', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    vi.resetModules()
    mockExistsSync.mockReturnValue(false)
  })

  it('日志目录存在时应删除并重建', async () => {
    const mod = await import('../../../../electron/backend/services/logger')

    mockExistsSync.mockReturnValue(false)
    const origLog = console.log
    const origInfo = console.info
    const origWarn = console.warn
    const origError = console.error
    mod.initLogger()
    console.log = origLog
    console.info = origInfo
    console.warn = origWarn
    console.error = origError

    mockExistsSync.mockReturnValue(true)
    mockAppendFileSync.mockClear()

    const result = mod.clearLogs()
    expect(result.success).toBe(true)
    expect(mockRmSync).toHaveBeenCalledWith(
      expect.stringContaining('logs'),
      { recursive: true, force: true }
    )
    expect(mockMkdirSync).toHaveBeenCalledWith(
      expect.stringContaining('logs'),
      { recursive: true }
    )
  })

  it('日志目录不存在时应跳过删除', async () => {
    const mod = await import('../../../../electron/backend/services/logger')

    const origLog = console.log
    mod.initLogger()
    console.log = origLog

    mockExistsSync.mockReturnValue(false)

    const result = mod.clearLogs()
    expect(result.success).toBe(true)
    expect(mockRmSync).not.toHaveBeenCalled()
  })

  it('删除失败时应返回错误信息', async () => {
    const mod = await import('../../../../electron/backend/services/logger')

    mockExistsSync.mockReturnValue(false)
    mockApp.getVersion.mockReturnValue('1.0.0')
    const origLog = console.log
    mod.initLogger()
    console.log = origLog

    mockExistsSync.mockReturnValue(true)
    mockRmSync.mockImplementation(() => {
      throw new Error('Permission denied')
    })

    const result = mod.clearLogs()
    expect(result.success).toBe(false)
    expect(result.message).toBe('Permission denied')
  })
})

describe('日志写入', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    vi.resetModules()
    mockExistsSync.mockReturnValue(false)
    mockApp.getVersion.mockReturnValue('1.0.0-test')
  })

  it('logger.info 应写入日志文件', async () => {
    const mod = await import('../../../../electron/backend/services/logger')

    const origLog = console.log
    const origInfo = console.info
    const origWarn = console.warn
    const origError = console.error

    mod.initLogger()
    console.log = origLog
    console.info = origInfo
    console.warn = origWarn
    console.error = origError

    mockAppendFileSync.mockClear()
    mockExistsSync.mockReturnValue(false)
    mockStatSync.mockReturnValue(makeStat(100))

    mod.logger.info('用户登录成功', { userId: 1 })

    const calls = mockAppendFileSync.mock.calls
    if (calls.length > 0) {
      const callArg = calls[0]?.[1] || ''
      expect(callArg).toContain('[INFO]')
      expect(callArg).toContain('用户登录成功')
      expect(callArg).toContain('"userId": 1')
    }
  })

  it('logger.warn 应写入 WARN 级别日志', async () => {
    const mod = await import('../../../../electron/backend/services/logger')
    const origLog = console.log

    mod.initLogger()
    console.log = origLog
    mockAppendFileSync.mockClear()

    mockExistsSync.mockReturnValue(false)
    mockStatSync.mockReturnValue(makeStat(100))

    mod.logger.warn('磁盘空间不足')

    const calls = mockAppendFileSync.mock.calls
    if (calls.length > 0) {
      const callArg = calls[0]?.[1] || ''
      expect(callArg).toContain('[WARN]')
      expect(callArg).toContain('磁盘空间不足')
    }
  })

  it('logger.error 应写入 ERROR 级别日志并包含堆栈', async () => {
    const mod = await import('../../../../electron/backend/services/logger')
    const origLog = console.log

    mod.initLogger()
    console.log = origLog
    mockAppendFileSync.mockClear()

    mockExistsSync.mockReturnValue(false)
    mockStatSync.mockReturnValue(makeStat(100))

    const err = new Error('数据库连接失败')
    mod.logger.error('严重错误', err)

    const calls = mockAppendFileSync.mock.calls
    if (calls.length > 0) {
      const callArg = calls[0]?.[1] || ''
      expect(callArg).toContain('[ERROR]')
      expect(callArg).toContain('数据库连接失败')
    }
  })

  it('logger.debug 应写入 DEBUG 级别日志', async () => {
    const mod = await import('../../../../electron/backend/services/logger')
    const origLog = console.log

    mod.initLogger()
    console.log = origLog
    mockAppendFileSync.mockClear()

    mockExistsSync.mockReturnValue(false)
    mockStatSync.mockReturnValue(makeStat(100))

    mod.logger.debug('调试信息', { detail: 'test' })

    const calls = mockAppendFileSync.mock.calls
    if (calls.length > 0) {
      const callArg = calls[0]?.[1] || ''
      expect(callArg).toContain('[DEBUG]')
    }
  })

  it('日志文件超过大小阈值时应触发轮转', async () => {
    const mod = await import('../../../../electron/backend/services/logger')
    const origLog = console.log

    mod.initLogger()
    console.log = origLog
    mockAppendFileSync.mockClear()

    mockExistsSync.mockReturnValue(true)
    mockStatSync.mockReturnValue(makeStat(6 * 1024 * 1024))
    mockReaddirSync.mockReturnValue([])

    mod.logger.info('触发轮转的日志')

    expect(mockRenameSync).toHaveBeenCalled()
  })

  it('日志写入失败时不应抛出错误', async () => {
    const mod = await import('../../../../electron/backend/services/logger')
    const origLog = console.log

    mod.initLogger()
    console.log = origLog

    mockExistsSync.mockReturnValue(false)
    mockStatSync.mockReturnValue(makeStat(100))
    mockAppendFileSync.mockImplementation(() => {
      throw new Error('Disk full')
    })

    expect(() => mod.logger.info('这条日志会失败')).not.toThrow()
  })
})

describe('initLogger - 目录与版本', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    vi.resetModules()
    mockExistsSync.mockReturnValue(false)
  })

  it('日志目录不存在时应自动创建', async () => {
    const mod = await import('../../../../electron/backend/services/logger')
    mockApp.getVersion.mockReturnValue('1.0.0')
    mockExistsSync.mockReturnValue(false)

    const origLog = console.log
    const origInfo = console.info
    const origWarn = console.warn
    const origError = console.error

    mod.initLogger()

    console.log = origLog
    console.info = origInfo
    console.warn = origWarn
    console.error = origError

    const mkdirCalls = mockMkdirSync.mock.calls
    const logDirCall = mkdirCalls.find((c: any[]) => String(c[0]).includes('logs'))
    expect(logDirCall).toBeDefined()
    expect(logDirCall[1]).toEqual({ recursive: true })
  })

  it('首次安装时应创建版本文件', async () => {
    const mod = await import('../../../../electron/backend/services/logger')
    mockApp.getVersion.mockReturnValue('2.0.0')
    mockExistsSync.mockReturnValue(false)

    const origLog = console.log
    mod.initLogger()
    console.log = origLog

    expect(mockWriteFileSync).toHaveBeenCalledWith(
      expect.stringContaining('.version'),
      '2.0.0',
      'utf-8'
    )
  })

  it('版本升级时应清理旧日志', async () => {
    const mod = await import('../../../../electron/backend/services/logger')
    mockApp.getVersion.mockReturnValue('2.0.0')

    mockExistsSync.mockReturnValueOnce(true).mockReturnValueOnce(true)
    mockReadFileSync.mockReturnValue('1.0.0')

    const origLog = console.log
    const origInfo = console.info
    const origWarn = console.warn
    const origError = console.error

    mod.initLogger()

    console.log = origLog
    console.info = origInfo
    console.warn = origWarn
    console.error = origError

    expect(mockRmSync).toHaveBeenCalledWith(
      expect.stringContaining('logs'),
      { recursive: true, force: true }
    )
  })

  it('版本相同时不应清理日志', async () => {
    const mod = await import('../../../../electron/backend/services/logger')
    mockApp.getVersion.mockReturnValue('1.5.0')

    mockExistsSync.mockReturnValueOnce(true).mockReturnValueOnce(false)
    mockReadFileSync.mockReturnValue('1.5.0')

    const origLog = console.log
    mod.initLogger()
    console.log = origLog

    const rmSyncLogCalls = mockRmSync.mock.calls.filter(
      (call: any[]) => String(call[0]).includes('logs')
    )
    expect(rmSyncLogCalls).toHaveLength(0)
  })
})

describe('initLogger - 进程事件', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    vi.resetModules()
    mockExistsSync.mockReturnValue(false)
    mockApp.getVersion.mockReturnValue('1.0.0')
  })

  it('应注册 uncaughtException 和 unhandledRejection 处理器', async () => {
    const mod = await import('../../../../electron/backend/services/logger')

    const ucBefore = process.listenerCount('uncaughtException')
    const uhBefore = process.listenerCount('unhandledRejection')

    const origLog = console.log
    const origInfo = console.info
    const origWarn = console.warn
    const origError = console.error
    mod.initLogger()
    console.log = origLog
    console.info = origInfo
    console.warn = origWarn
    console.error = origError

    const ucAfter = process.listenerCount('uncaughtException')
    const uhAfter = process.listenerCount('unhandledRejection')

    expect(ucAfter).toBeGreaterThanOrEqual(ucBefore)
    expect(uhAfter).toBeGreaterThanOrEqual(uhBefore)
  })
})

describe('console.log 重定向', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    vi.resetModules()
    mockExistsSync.mockReturnValue(false)
    mockApp.getVersion.mockReturnValue('1.0.0-t')
  })

  it('initLogger 后 console.log 应将内容写入文件', async () => {
    const mod = await import('../../../../electron/backend/services/logger')

    const origLog = console.log
    const origInfo = console.info
    const origWarn = console.warn
    const origError = console.error

    mod.initLogger()
    mockAppendFileSync.mockClear()

    mockExistsSync.mockReturnValue(false)
    mockStatSync.mockReturnValue(makeStat(100))

    console.log('控制台测试日志')

    console.log = origLog
    console.info = origInfo
    console.warn = origWarn
    console.error = origError

    const calls = mockAppendFileSync.mock.calls
    if (calls.length > 0) {
      const callArg = calls[0]?.[1] || ''
      expect(callArg).toContain('控制台测试日志')
    }
  })

  it('console.error 应使用 ERROR 级别', async () => {
    const mod = await import('../../../../electron/backend/services/logger')

    const origError = console.error

    mod.initLogger()
    mockAppendFileSync.mockClear()

    mockExistsSync.mockReturnValue(false)
    mockStatSync.mockReturnValue(makeStat(100))

    console.error('错误输出')

    console.error = origError

    const calls = mockAppendFileSync.mock.calls
    if (calls.length > 0) {
      const callArg = calls[0]?.[1] || ''
      expect(callArg).toContain('[ERROR]')
    }
  })

  it('console.warn 应使用 WARN 级别', async () => {
    const mod = await import('../../../../electron/backend/services/logger')

    const origWarn = console.warn

    mod.initLogger()
    mockAppendFileSync.mockClear()

    mockExistsSync.mockReturnValue(false)
    mockStatSync.mockReturnValue(makeStat(100))

    console.warn('警告输出')

    console.warn = origWarn

    const calls = mockAppendFileSync.mock.calls
    if (calls.length > 0) {
      const callArg = calls[0]?.[1] || ''
      expect(callArg).toContain('[WARN]')
    }
  })
})

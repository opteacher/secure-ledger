/**
 * Terminal 服务单元测试 (terminal + terminalConfig + ttyd)
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

const { mockRun, mockQuery } = vi.hoisted(() => ({
  mockRun: vi.fn(() => ({ changes: 1, lastInsertRowid: 1 })),
  mockQuery: vi.fn(() => []),
}))

vi.mock('../../../../electron/backend/database', () => ({ run: mockRun, query: mockQuery }))

const { mockSpawnOn, mockSpawnUnref, mockSpawnKill, mockSpawn } = vi.hoisted(() => {
  const on = vi.fn().mockReturnThis()
  return {
    mockSpawnOn: on,
    mockSpawnUnref: vi.fn(),
    mockSpawnKill: vi.fn(),
    mockSpawn: vi.fn(() => ({ on, unref: mockSpawnUnref, kill: mockSpawnKill, killed: false, pid: 12345 })),
  }
})

const { mockExecSync, mockExec } = vi.hoisted(() => ({
  mockExecSync: vi.fn(),
  mockExec: vi.fn((_cmd: string, ...args: any[]) => {
    // 兼容 2 参数 (cmd, callback) 和 3 参数 (cmd, options, callback)
    const cb = typeof args[args.length - 1] === 'function' ? args[args.length - 1] : args[0]
    if (typeof cb === 'function') cb(null)
  }),
}))

vi.mock('child_process', () => ({ spawn: mockSpawn, execSync: mockExecSync, exec: mockExec }))

vi.mock('https', () => ({ get: vi.fn(() => ({ on: vi.fn() })) }))

const { mockExistsSync } = vi.hoisted(() => ({
  mockExistsSync: vi.fn(() => true),
}))

vi.mock('fs', () => ({
  existsSync: mockExistsSync, mkdirSync: vi.fn(), chmodSync: vi.fn(),
  copyFileSync: vi.fn(), unlinkSync: vi.fn(),
  createWriteStream: vi.fn(() => ({ on: vi.fn((e: string, cb: any) => { if (e === 'finish') setTimeout(cb, 0) }), close: vi.fn() })),
}))

const { mockPlatform, mockArch } = vi.hoisted(() => ({
  mockPlatform: vi.fn(() => 'win32'),
  mockArch: vi.fn(() => 'x64'),
}))

vi.mock('os', () => ({ platform: mockPlatform, arch: mockArch }))

import { detectTerminals, launchSSHTerminal } from '../../../../electron/backend/services/terminal'
import {
  getTerminalList, getEnabledTerminals, addTerminal, deleteTerminal, updateTerminalStatus,
  updateTerminal, detectSystemTerminals, detectTerminalType, initDefaultTerminals,
  detectAndAddNewTerminals, getAvailableTerminals,
} from '../../../../electron/backend/services/terminalConfig'
import {
  isPuTTYInstalled, getAvailablePlinkPath, getAvailableSshpassPath, installPuTTY,
  isTtydAvailable, isTtydInstalled, checkTtydCompatibility, installTtyd, ensureTtyd,
  stopTtyd, startTtyd, startTtydWithSSH, getTtydPath, setCustomTtydPath,
  getPlinkPathForDisplay, setCustomPlinkPath, getSshpassPathForDisplay, setCustomSshpassPath,
  getPlatformInfo, getTtydStatus, checkPort, killPortProcess,
} from '../../../../electron/backend/services/ttyd'

describe('terminal 服务', () => {
  beforeEach(() => { vi.clearAllMocks(); mockPlatform.mockReturnValue('win32'); mockExistsSync.mockReturnValue(true) })

  describe('detectTerminals', () => {
    it('Windows: 检测到终端工具', () => {
      mockExecSync.mockReturnValue('C:\\Windows\\System32\\cmd.exe\n')
      expect(Array.isArray(detectTerminals())).toBe(true)
    })
    it('不支持的平台返回空数组', () => {
      mockPlatform.mockReturnValue('freebsd')
      expect(detectTerminals()).toEqual([])
    })
  })

  describe('launchSSHTerminal', () => {
    it('Windows: 使用密钥文件启动 SSH', async () => {
      const r = await launchSSHTerminal({ id: 'cmd', name: 'CMD', path: 'cmd.exe' }, '192.168.1.1', 22, 'user', '/key')
      expect(r.success).toBe(true)
    })
    it('不支持的平台返回失败', async () => {
      mockPlatform.mockReturnValue('freebsd')
      const r = await launchSSHTerminal({ id: 'xterm', name: 'X', path: '/x' }, '1.1.1.1', 22)
      expect(r.success).toBe(false)
    })
  })
})

describe('terminalConfig 服务', () => {
  beforeEach(() => { vi.clearAllMocks(); mockQuery.mockReturnValue([]); mockRun.mockReturnValue({ changes: 1, lastInsertRowid: 1 }) })

  describe('getTerminalList', () => {
    it('返回终端列表', () => {
      mockQuery.mockReturnValue([{ id: 1, name: 'Pwsh', path: 'pwsh.exe', terminal_type: 'powershell', is_enabled: true }])
      expect(getTerminalList()).toHaveLength(1)
    })
  })
  describe('addTerminal', () => {
    it('成功添加终端', () => {
      mockRun.mockReturnValue({ changes: 1, lastInsertRowid: 5 })
      expect(addTerminal('My', '/p', 'custom').id).toBe(5)
    })
  })
  describe('deleteTerminal', () => {
    it('成功删除返回 true', () => { mockRun.mockReturnValue({ changes: 1, lastInsertRowid: 0 }); expect(deleteTerminal(1)).toBe(true) })
    it('无影响行返回 false', () => { mockRun.mockReturnValue({ changes: 0, lastInsertRowid: 0 }); expect(deleteTerminal(99)).toBe(false) })
  })
  describe('updateTerminalStatus', () => {
    it('启用', () => { mockRun.mockReturnValue({ changes: 1, lastInsertRowid: 0 }); expect(updateTerminalStatus(1, true)).toBe(true) })
    it('禁用', () => { mockRun.mockReturnValue({ changes: 1, lastInsertRowid: 0 }); expect(updateTerminalStatus(1, false)).toBe(true) })
  })
  describe('updateTerminal', () => {
    it('更新终端信息', () => { mockRun.mockReturnValue({ changes: 1, lastInsertRowid: 0 }); expect(updateTerminal(1, 'N', '/n')).toBe(true) })
  })
  describe('initDefaultTerminals', () => {
    it('已有终端时跳过', () => { mockQuery.mockReturnValue([{ id: 1 }]); expect(initDefaultTerminals().message).toContain('已存在') })
    it('无终端时初始化', () => {
      mockQuery.mockReturnValue([]); mockPlatform.mockReturnValue('win32'); mockExecSync.mockReturnValue('cmd.exe\n')
      expect(initDefaultTerminals().success).toBe(true)
    })
  })
  describe('getAvailableTerminals', () => {
    it('数据库有配置返回数据库结果', () => {
      mockQuery.mockReturnValue([{ id: 1, name: 'P', path: 'p.exe', terminal_type: 'pwsh', is_enabled: true }])
      expect(getAvailableTerminals()[0].id).toBe(1)
    })
    it('数据库无配置返回检测结果', () => {
      mockQuery.mockReturnValue([]); mockPlatform.mockReturnValue('win32'); mockExecSync.mockReturnValue('cmd.exe\n')
      expect(Array.isArray(getAvailableTerminals())).toBe(true)
    })
  })
  describe('detectSystemTerminals', () => {
    it('委托给 terminal.detectTerminals', () => {
      mockPlatform.mockReturnValue('win32')
      mockExecSync.mockReturnValue('cmd.exe\n')
      const result = detectSystemTerminals()
      expect(Array.isArray(result)).toBe(true)
    })
  })
  describe('detectTerminalType', () => {
    it('匹配检测到的终端类型', () => {
      mockPlatform.mockReturnValue('win32')
      mockExecSync.mockReturnValue('C:\\Windows\\System32\\cmd.exe\n')
      const type = detectTerminalType('C:\\Windows\\System32\\cmd.exe')
      expect(typeof type).toBe('string')
    })
    it('未匹配返回空字符串', () => {
      mockPlatform.mockReturnValue('win32')
      mockExecSync.mockReturnValue('cmd.exe\n')
      const type = detectTerminalType('/nonexistent/path')
      expect(type).toBe('')
    })
  })
  describe('detectAndAddNewTerminals', () => {
    it('所有终端都是新的', () => {
      mockQuery.mockReturnValue([])
      mockPlatform.mockReturnValue('win32')
      mockExecSync.mockReturnValue('C:\\Windows\\System32\\cmd.exe\n')
      const result = detectAndAddNewTerminals()
      expect(result.added).toBeGreaterThanOrEqual(1)
      expect(typeof result.total).toBe('number')
    })
    it('所有终端都已存在（跳过）', () => {
      mockPlatform.mockReturnValue('win32')
      mockExecSync.mockReturnValue('C:\\Windows\\System32\\cmd.exe\n')
      mockQuery.mockReturnValue([{ id: 1, path: 'C:\\Windows\\System32\\cmd.exe', name: 'CMD', terminal_type: 'cmd', is_enabled: true }])
      const result = detectAndAddNewTerminals()
      expect(typeof result.skipped).toBe('number')
      expect(typeof result.added).toBe('number')
      expect(typeof result.total).toBe('number')
    })
    it('混合场景部分新增部分跳过', () => {
      mockPlatform.mockReturnValue('win32')
      mockExecSync.mockReturnValue('C:\\Windows\\System32\\cmd.exe\n')
      mockQuery.mockReturnValue([{ id: 1, path: 'C:\\Windows\\System32\\cmd.exe', name: 'CMD', terminal_type: 'cmd', is_enabled: true }])
      const result = detectAndAddNewTerminals()
      expect(typeof result.added).toBe('number')
      expect(typeof result.skipped).toBe('number')
    })
  })
})

describe('ttyd 服务', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPlatform.mockReturnValue('win32')
    mockExistsSync.mockReturnValue(true)
    mockExecSync.mockReturnValue('ttyd 1.7.7')
    // process.resourcesPath is Electron-only, needs mock in Vitest
    ;(process as any).resourcesPath = 'C:\\'
  })

  describe('isPuTTYInstalled', () => {
    it('非 Windows 返回 false', () => { mockPlatform.mockReturnValue('linux'); expect(isPuTTYInstalled()).toBe(false) })
    it('未安装返回 false', () => { mockPlatform.mockReturnValue('win32'); mockExistsSync.mockReturnValue(false); expect(isPuTTYInstalled()).toBe(false) })
  })
  describe('getAvailablePlinkPath', () => {
    it('非 Windows 返回 null', () => { mockPlatform.mockReturnValue('linux'); expect(getAvailablePlinkPath()).toBeNull() })
  })
  describe('installPuTTY', () => {
    it('非 Windows 返回失败', async () => { mockPlatform.mockReturnValue('linux'); expect((await installPuTTY()).success).toBe(false) })
    it('已安装返回成功', async () => { mockExistsSync.mockReturnValue(true); expect((await installPuTTY()).success).toBe(true) })
  })
  describe('isTtydAvailable', () => {
    it('未安装返回 false', () => { mockExistsSync.mockReturnValue(false); expect(isTtydAvailable()).toBe(false); expect(isTtydInstalled()).toBe(false) })
  })
  describe('checkTtydCompatibility', () => {
    it('未安装返回 incompatible', () => { mockExistsSync.mockReturnValue(false); expect(checkTtydCompatibility().compatible).toBe(false) })
    it('GLIBC 不兼容', () => {
      mockExistsSync.mockReturnValue(true)
      mockExecSync.mockImplementation(() => { throw new Error('GLIBC_2.29 not found') })
      expect(checkTtydCompatibility().compatible).toBe(false)
    })
  })
  describe('stopTtyd', () => { it('无运行进程返回成功', () => expect(stopTtyd().success).toBe(true)) })
  describe('startTtyd', () => {
    it('未安装返回失败', () => { mockExistsSync.mockReturnValue(false); expect(startTtyd().success).toBe(false) })
  })
  describe('startTtydWithSSH', () => {
    it('未安装返回失败', () => { mockExistsSync.mockReturnValue(false); expect(startTtydWithSSH({ host: 'e.com', port: 22 }).success).toBe(false) })
  })
  describe('setCustomTtydPath', () => {
    it('文件不存在返回失败', () => { mockExistsSync.mockReturnValue(false); expect(setCustomTtydPath('/no').success).toBe(false) })
    it('设置成功', () => { mockExistsSync.mockReturnValue(true); expect(setCustomTtydPath('/yes').success).toBe(true) })
  })
  describe('getPlatformInfo', () => {
    it('Windows', () => { mockPlatform.mockReturnValue('win32'); const i = getPlatformInfo(); expect(i.isWindows).toBe(true); expect(i.isLinux).toBe(false) })
    it('Linux', () => { mockPlatform.mockReturnValue('linux'); const i = getPlatformInfo(); expect(i.isLinux).toBe(true) })
    it('macOS', () => { mockPlatform.mockReturnValue('darwin'); const i = getPlatformInfo(); expect(i.isMac).toBe(true) })
  })
  describe('getTtydStatus', () => {
    it('无运行进程', () => { expect(getTtydStatus().running).toBe(false) })
  })
  describe('checkPort', () => {
    it('端口未被占用', () => { mockExecSync.mockImplementation(() => { throw new Error('nf') }); expect(checkPort(7681).inUse).toBe(false) })
    it('端口被占用', () => {
      mockExecSync.mockReturnValueOnce('TCP 0.0.0.0:7681 LISTENING 12345').mockReturnValueOnce('ttyd.exe 12345')
      const r = checkPort(7681)
      expect(r.inUse).toBe(true)
    })
  })
  describe('killPortProcess', () => {
    it('端口未被占用', () => { mockExecSync.mockImplementation(() => { throw new Error('nf') }); expect(killPortProcess(7681).success).toBe(true) })
    it('终止进程成功', () => {
      mockExecSync.mockReturnValueOnce('TCP 0.0.0.0:7681 LISTENING 12345').mockReturnValueOnce('ttyd.exe 12345').mockReturnValueOnce('OK')
      expect(killPortProcess(7681).success).toBe(true)
    })
  })
  describe('getAvailableSshpassPath', () => {
    it('Windows 返回 null', () => {
      mockPlatform.mockReturnValue('win32')
      expect(getAvailableSshpassPath()).toBeNull()
    })
    it('Linux 使用 which 找到 sshpass', () => {
      mockPlatform.mockReturnValue('linux')
      mockExecSync.mockReturnValueOnce('/usr/bin/sshpass')
      mockExistsSync.mockReturnValue(true)
      expect(getAvailableSshpassPath()).toBe('/usr/bin/sshpass')
    })
    it('Linux 未找到返回 null', () => {
      mockPlatform.mockReturnValue('linux')
      mockExecSync.mockImplementation(() => { throw new Error('not found') })
      mockExistsSync.mockReturnValue(false)
      expect(getAvailableSshpassPath()).toBeNull()
    })
  })
  describe('installTtyd', () => {
    it('安装成功从打包文件复制', async () => {
      mockExistsSync.mockReturnValue(true)
      const result = await installTtyd()
      expect(result.success).toBe(true)
    })
    it('网络下载不可用且无打包文件时失败', async () => {
      mockExistsSync.mockReturnValue(false)
      mockPlatform.mockReturnValue('freebsd')
      mockArch.mockReturnValue('x64')
      const result = await installTtyd()
      expect(result.success).toBe(false)
    })
  })
  describe('ensureTtyd', () => {
    it('ttyd 已可用', async () => {
      mockExistsSync.mockReturnValue(true)
      mockExecSync.mockReturnValue('ttyd 1.7.7')
      const result = await ensureTtyd()
      expect(result.installed).toBe(true)
    })
    it('ttyd 不可用', async () => {
      mockExistsSync.mockReturnValue(false)
      mockPlatform.mockReturnValue('freebsd')
      const result = await ensureTtyd()
      expect(result.installed).toBe(false)
    })
  })
  describe('getTtydPath', () => {
    it('自定义路径存在时返回 custom', () => {
      mockExistsSync.mockReturnValue(true)
      setCustomTtydPath('C:\\custom\\ttyd.exe')
      const info = getTtydPath()
      expect(info.source).toBe('custom')
      setCustomTtydPath(null)
    })
    it('无自定义路径且无打包文件时 source=none', () => {
      mockExistsSync.mockReturnValue(false)
      mockPlatform.mockReturnValue('linux')
      mockExecSync.mockImplementation(() => { throw new Error('not found') })
      const info = getTtydPath()
      expect(info.source).toBe('none')
      expect(info.path).toBeNull()
    })
  })
  describe('getPlinkPathForDisplay', () => {
    it('自定义路径存在时返回 custom', () => {
      mockExistsSync.mockReturnValue(true)
      setCustomPlinkPath('C:\\plink.exe')
      const info = getPlinkPathForDisplay()
      expect(info.source).toBe('custom')
      setCustomPlinkPath(null)
    })
    it('无自定义路径且系统无 plink 时 source=none', () => {
      mockExistsSync.mockReturnValue(false)
      mockPlatform.mockReturnValue('win32')
      setCustomPlinkPath(null)
      const info = getPlinkPathForDisplay()
      expect(info.source).toBe('none')
      expect(info.path).toBeNull()
    })
  })
  describe('setCustomPlinkPath', () => {
    it('null 重置成功', () => {
      expect(setCustomPlinkPath(null).success).toBe(true)
    })
    it('文件不存在返回失败', () => {
      mockExistsSync.mockReturnValue(false)
      expect(setCustomPlinkPath('C:\\nope.exe').success).toBe(false)
    })
    it('文件存在设置成功', () => {
      mockExistsSync.mockReturnValue(true)
      expect(setCustomPlinkPath('C:\\plink.exe').success).toBe(true)
    })
  })
  describe('getSshpassPathForDisplay', () => {
    it('Windows 是 none', () => {
      mockPlatform.mockReturnValue('win32')
      const info = getSshpassPathForDisplay()
      expect(info.source).toBe('none')
    })
    it('Linux 有系统 sshpass 返回 system', () => {
      mockPlatform.mockReturnValue('linux')
      mockExecSync.mockReturnValue('/usr/bin/sshpass')
      mockExistsSync.mockReturnValue(true)
      const info = getSshpassPathForDisplay()
      expect(info.source).toBe('system')
    })
    it('Linux 无系统 sshpass 返回 none', () => {
      mockPlatform.mockReturnValue('linux')
      mockExecSync.mockImplementation(() => { throw new Error('not found') })
      mockExistsSync.mockReturnValue(false)
      const info = getSshpassPathForDisplay()
      expect(info.source).toBe('none')
    })
  })
  describe('setCustomSshpassPath', () => {
    it('null 重置成功', () => {
      expect(setCustomSshpassPath(null).success).toBe(true)
    })
    it('文件不存在返回失败', () => {
      mockExistsSync.mockReturnValue(false)
      expect(setCustomSshpassPath('/nope').success).toBe(false)
    })
    it('文件存在设置成功', () => {
      mockExistsSync.mockReturnValue(true)
      expect(setCustomSshpassPath('/usr/bin/sshpass').success).toBe(true)
    })
  })
})

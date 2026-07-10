/**
 * SSH 服务测试
 * Mock: ssh2.Client, fs, electron.BrowserWindow
 *
 * Pattern: Override functions control ssh2 mock behavior per test.
 * Tests set overrides BEFORE calling service functions, then trigger events.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as fs from 'fs'

// ============================================================
// Override variables - set in tests to configure ssh2 mock behavior
// ============================================================
let _execImpl: ((cmd: string, cb: (err: Error | null, stream: any) => void) => void) | null = null
let _sftpImpl: ((cb: (err: Error | null, sftp: any) => void) => void) | null = null
let mockClientInstance: Record<string, any> | null = null

vi.mock('fs', () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  statSync: vi.fn(),
  readdirSync: vi.fn(),
  mkdirSync: vi.fn(),
}))

vi.mock('path', async () => {
  const actual = await vi.importActual('path')
  return { ...actual }
})

vi.mock('ssh2', () => ({
  Client: vi.fn().mockImplementation(function (this: any) {
    const events: Record<string, (...args: any[]) => void> = {}
    const client: Record<string, any> = {
      _events: events,
      on: vi.fn((event: string, cb: (...args: any[]) => void) => {
        events[event] = cb
        return client
      }),
      connect: vi.fn(),
      end: vi.fn(),
      exec: vi.fn((cmd: string, cb: any) => {
        if (_execImpl) _execImpl(cmd, cb)
      }),
      sftp: vi.fn((cb: any) => {
        if (_sftpImpl) _sftpImpl(cb)
      }),
    }
    mockClientInstance = client
    return client
  }),
}))

// ============================================================
// Helpers
// ============================================================
function triggerClientEvent(event: string, ...args: any[]) {
  if (mockClientInstance?._events?.[event]) {
    mockClientInstance._events[event](...args)
  }
}

function createMockStream() {
  const stream: any = {
    on: vi.fn().mockReturnThis(),
    stderr: { on: vi.fn() },
  }
  return stream
}

// ============================================================
// Imports
// ============================================================
import {
  testConnection,
  executeCommand,
  uploadFile,
  listRemoteDirectory,
  uploadWithProgress,
} from '../../../../electron/backend/services/ssh'
import type { SSHConfig, UploadConfig } from '../../../../electron/backend/services/ssh'

// ============================================================
// Tests
// ============================================================

describe('testConnection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockClientInstance = null
    _execImpl = null
    _sftpImpl = null
  })

  it('连接成功时应返回 success: true', async () => {
    const promise = testConnection({ host: '192.168.1.100', port: 22, username: 'admin', password: 'secret' })
    triggerClientEvent('ready')
    const result = await promise
    expect(result.success).toBe(true)
    expect(result.message).toBe('连接成功')
    expect(mockClientInstance!.end).toHaveBeenCalled()
  })

  it('连接失败时应返回错误信息', async () => {
    const promise = testConnection({ host: '10.0.0.1', port: 2222, username: 'user', password: 'pass' })
    triggerClientEvent('error', new Error('Connection refused'))
    const result = await promise
    expect(result.success).toBe(false)
    expect(result.message).toBe('Connection refused')
  })

  it('应使用 password 认证', async () => {
    const promise = testConnection({ host: 'host', port: 22, username: 'user', password: 'pwd' })
    triggerClientEvent('ready')
    await promise
    const call = mockClientInstance!.connect.mock.calls[0][0]
    expect(call.host).toBe('host')
    expect(call.password).toBe('pwd')
  })

  it('privateKey 优先于 password', async () => {
    const promise = testConnection({ host: 'host', port: 22, username: 'user', password: 'pwd', privateKey: 'key' })
    triggerClientEvent('ready')
    await promise
    const call = mockClientInstance!.connect.mock.calls[0][0]
    expect(call.privateKey).toBe('key')
    expect(call.password).toBeUndefined()
  })

  it('默认端口应为 22', async () => {
    const promise = testConnection({ host: 'host', username: 'user', password: 'pwd' } as SSHConfig)
    triggerClientEvent('ready')
    await promise
    expect(mockClientInstance!.connect.mock.calls[0][0].port).toBe(22)
  })

  it('readyTimeout 应在连接配置中设置', async () => {
    const promise = testConnection({ host: 'host', port: 22, username: 'user', password: 'pwd' })
    triggerClientEvent('ready')
    await promise
    expect(mockClientInstance!.connect.mock.calls[0][0].readyTimeout).toBe(15000)
  })

  it('连接超时应返回失败并关闭连接', async () => {
    const promise = testConnection({ host: '10.0.0.1', port: 22, username: 'user', password: 'pwd' })
    triggerClientEvent('timeout')
    const result = await promise
    expect(result.success).toBe(false)
    expect(result.message).toBe('连接超时')
    expect(mockClientInstance!.end).toHaveBeenCalled()
  })
})

describe('executeCommand', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockClientInstance = null
    _execImpl = null
    _sftpImpl = null
  })

  it('成功执行命令时应返回输出', async () => {
    const mockStream = createMockStream()
    _execImpl = (cmd, cb) => cb(null, mockStream)

    const promise = executeCommand({ host: 'h', port: 22, username: 'u', password: 'p', command: 'ls' })
    triggerClientEvent('ready')

    // Simulate data
    mockStream.on.mock.calls.find((c: any[]) => c[0] === 'data')?.[1](Buffer.from('output'))
    mockStream.on.mock.calls.find((c: any[]) => c[0] === 'close')?.[1]()

    const result = await promise
    expect(result.success).toBe(true)
    expect(result.output).toBe('output')
  })

  it('命令应包含 stderr 输出', async () => {
    const mockStream = createMockStream()
    _execImpl = (cmd, cb) => cb(null, mockStream)

    const promise = executeCommand({ host: 'h', port: 22, username: 'u', password: 'p', command: 'bad' })
    triggerClientEvent('ready')

    mockStream.stderr.on.mock.calls.find((c: any[]) => c[0] === 'data')?.[1](Buffer.from('err msg'))
    mockStream.on.mock.calls.find((c: any[]) => c[0] === 'close')?.[1]()

    const result = await promise
    expect(result.success).toBe(true)
    expect(result.error).toBe('err msg')
  })

  it('exec 回调返回错误时应处理', async () => {
    _execImpl = (cmd, cb) => cb(new Error('Exec failed'), null)
    const promise = executeCommand({ host: 'h', port: 22, username: 'u', password: 'p', command: 'test' })
    triggerClientEvent('ready')
    const result = await promise
    expect(result.success).toBe(false)
    expect(result.error).toBe('Exec failed')
  })

  it('连接错误时应返回失败', async () => {
    const promise = executeCommand({ host: 'h', port: 22, username: 'u', password: 'p', command: 'test' })
    triggerClientEvent('error', new Error('Host unreachable'))
    const result = await promise
    expect(result.success).toBe(false)
    expect(result.error).toBe('Host unreachable')
  })

  it('连接超时应返回失败', async () => {
    const promise = executeCommand({ host: 'h', port: 22, username: 'u', password: 'p', command: 'test' })
    triggerClientEvent('timeout')
    const result = await promise
    expect(result.success).toBe(false)
    expect(result.error).toBe('连接超时')
    expect(mockClientInstance!.end).toHaveBeenCalled()
  })
})

describe('uploadFile', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockClientInstance = null
    _execImpl = null
    _sftpImpl = null
  })

  function config(overrides: Partial<UploadConfig> = {}): UploadConfig {
    return {
      host: 'host', port: 22, username: 'user', password: 'pwd',
      localPath: '/local/file.txt', remotePath: '/remote/path',
      isFolder: false, overwrite: false,
      ...overrides,
    }
  }

  it('本地文件不存在时应返回错误', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false)
    const result = await uploadFile(config())
    expect(result.success).toBe(false)
    expect(result.message).toBe('本地文件不存在')
  })

  it('文件上传成功应返回 success', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true)
    const mockSftp = { fastPut: vi.fn((a: string, b: string, cb: any) => cb(null)), mkdir: vi.fn(), unlink: vi.fn(), readdir: vi.fn() }
    _sftpImpl = (cb) => cb(null, mockSftp)

    const promise = uploadFile(config())
    triggerClientEvent('ready')
    const result = await promise
    expect(result.success).toBe(true)
    expect(result.message).toBe('文件上传成功')
  })

  it('覆盖模式下应先删除再上传', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true)
    const mockSftp = { unlink: vi.fn((p: string, cb: any) => cb()), fastPut: vi.fn((a: string, b: string, cb: any) => cb(null)), mkdir: vi.fn(), readdir: vi.fn() }
    _sftpImpl = (cb) => cb(null, mockSftp)

    const promise = uploadFile(config({ overwrite: true }))
    triggerClientEvent('ready')
    await promise
    expect(mockSftp.unlink).toHaveBeenCalledWith('/remote/path/file.txt', expect.any(Function))
  })

  it('上传文件夹应创建远程目录', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true)
    const mockSftp = { mkdir: vi.fn((p: string, cb: any) => cb()), fastPut: vi.fn(), unlink: vi.fn(), readdir: vi.fn() }
    _sftpImpl = (cb) => cb(null, mockSftp)

    const promise = uploadFile(config({ isFolder: true, localPath: '/local/folder' }))
    triggerClientEvent('ready')
    const result = await promise
    expect(result.success).toBe(true)
    expect(result.message).toBe('文件夹创建成功')
  })

  it('SFTP 连接失败应返回错误', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true)
    _sftpImpl = (cb) => cb(new Error('SFTP session failed'), null)

    const promise = uploadFile(config())
    triggerClientEvent('ready')
    const result = await promise
    expect(result.success).toBe(false)
    expect(result.message).toBe('SFTP session failed')
  })

  it('fastPut 失败应返回错误', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true)
    const mockSftp = { fastPut: vi.fn((a: string, b: string, cb: any) => cb(new Error('Permission denied'))), mkdir: vi.fn(), unlink: vi.fn(), readdir: vi.fn() }
    _sftpImpl = (cb) => cb(null, mockSftp)

    const promise = uploadFile(config())
    triggerClientEvent('ready')
    const result = await promise
    expect(result.success).toBe(false)
    expect(result.message).toBe('Permission denied')
  })

  it('连接超时应返回失败并关闭连接', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true)
    const promise = uploadFile(config())
    triggerClientEvent('timeout')
    const result = await promise
    expect(result.success).toBe(false)
    expect(result.message).toBe('连接超时')
    expect(mockClientInstance!.end).toHaveBeenCalled()
  })
})

describe('listRemoteDirectory', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockClientInstance = null
    _execImpl = null
    _sftpImpl = null
  })

  function sftpConfig(filename = 'ssh_key'): SSHConfig {
    return { host: 'host', port: 22, username: 'user', keyfilePath: '/path/to/' + filename }
  }

  const now = Math.floor(Date.now() / 1000)

  it('成功列出目录时应返回排序后的文件列表', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true)
    vi.mocked(fs.readFileSync).mockReturnValue(Buffer.from('fake-key'))

    const mockList = [
      { filename: 'file1.txt', longname: '-rw-r--r--', attrs: { size: 1024, mtime: now } },
      { filename: 'subdir', longname: 'drwxr-xr-x', attrs: { size: 4096, mtime: now } },
      { filename: 'README.md', longname: '-rw-r--r--', attrs: { size: 2048, mtime: now } },
    ]
    const mockSftp = { readdir: vi.fn((p: string, cb: any) => cb(null, mockList)), fastPut: vi.fn(), mkdir: vi.fn(), unlink: vi.fn() }
    _sftpImpl = (cb) => cb(null, mockSftp)

    const promise = listRemoteDirectory(sftpConfig(), '/home/user')
    triggerClientEvent('ready')
    const result = await promise
    expect(result.success).toBe(true)
    expect(result.files).toHaveLength(3)
    expect(result.files[0].isDirectory).toBe(true)  // directory first
    // files sorted by localeCompare: README.md vs file1.txt depends on locale
    const fileNames = result.files.map((f: any) => f.name)
    expect(fileNames).toContain('subdir')
    expect(fileNames).toContain('README.md')
    expect(fileNames).toContain('file1.txt')
  })

  it('readdir 失败应返回错误', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true)
    vi.mocked(fs.readFileSync).mockReturnValue(Buffer.from('fake-key'))

    const mockSftp = { readdir: vi.fn((p: string, cb: any) => cb(new Error('Permission denied'), null)), fastPut: vi.fn(), mkdir: vi.fn(), unlink: vi.fn() }
    _sftpImpl = (cb) => cb(null, mockSftp)

    const promise = listRemoteDirectory(sftpConfig(), '/root')
    triggerClientEvent('ready')
    const result = await promise
    expect(result.success).toBe(false)
    expect(result.message).toBe('Permission denied')
  })

  it('SFTP 连接失败应返回错误', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true)
    vi.mocked(fs.readFileSync).mockReturnValue(Buffer.from('fake-key'))
    _sftpImpl = (cb) => cb(new Error('SFTP unavailable'), null)

    const promise = listRemoteDirectory(sftpConfig(), '/tmp')
    triggerClientEvent('ready')
    const result = await promise
    expect(result.success).toBe(false)
    expect(result.message).toBe('SFTP unavailable')
  })

  it('空目录应返回空文件列表', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true)
    vi.mocked(fs.readFileSync).mockReturnValue(Buffer.from('fake-key'))

    const mockSftp = { readdir: vi.fn((p: string, cb: any) => cb(null, [])), fastPut: vi.fn(), mkdir: vi.fn(), unlink: vi.fn() }
    _sftpImpl = (cb) => cb(null, mockSftp)

    const promise = listRemoteDirectory(sftpConfig(), '/empty')
    triggerClientEvent('ready')
    const result = await promise
    expect(result.success).toBe(true)
    expect(result.files).toEqual([])
  })

  it('连接超时应返回失败', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true)
    vi.mocked(fs.readFileSync).mockReturnValue(Buffer.from('fake-key'))

    const promise = listRemoteDirectory(sftpConfig(), '/tmp')
    triggerClientEvent('timeout')
    const result = await promise
    expect(result.success).toBe(false)
    expect(result.message).toBe('连接超时')
    expect(mockClientInstance!.end).toHaveBeenCalled()
  })
})

describe('getConnectionConfig - 认证方式选择', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockClientInstance = null
    _execImpl = null
    _sftpImpl = null
  })

  it('密钥文件存在时应读取作为 privateKey', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true)
    vi.mocked(fs.readFileSync).mockReturnValue(Buffer.from('key-file-content'))

    const mockSftp = { readdir: vi.fn((p: string, cb: any) => cb(null, [])), fastPut: vi.fn(), mkdir: vi.fn(), unlink: vi.fn() }
    _sftpImpl = (cb) => cb(null, mockSftp)

    const promise = listRemoteDirectory({ host: 'h', port: 22, username: 'u', keyfilePath: '/k', passphrase: 'ph' }, '/tmp')
    triggerClientEvent('ready')
    await promise

    const call = mockClientInstance!.connect.mock.calls[0][0]
    expect(call.privateKey).toEqual(Buffer.from('key-file-content'))
    expect(call.passphrase).toBe('ph')
  })

  it('keyfile 存在但读取失败时不设认证（不会降级到 password）', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true)
    vi.mocked(fs.readFileSync).mockImplementation(() => { throw new Error('read err') })

    const mockSftp = { readdir: vi.fn((p: string, cb: any) => cb(null, [])), fastPut: vi.fn(), mkdir: vi.fn(), unlink: vi.fn() }
    _sftpImpl = (cb) => cb(null, mockSftp)

    const promise = listRemoteDirectory({ host: 'h', port: 22, username: 'u', keyfilePath: '/bad', password: 'pwd' }, '/tmp')
    triggerClientEvent('ready')
    await promise

    const call = mockClientInstance!.connect.mock.calls[0][0]
    // keyfile existed but read failed → no privateKey set, and password branch not reached
    expect(call.privateKey).toBeUndefined()
    expect(call.password).toBeUndefined()
  })

  it('config.privateKey 存在时应直接使用', async () => {
    const mockSftp = { readdir: vi.fn((p: string, cb: any) => cb(null, [])), fastPut: vi.fn(), mkdir: vi.fn(), unlink: vi.fn() }
    _sftpImpl = (cb) => cb(null, mockSftp)

    const promise = listRemoteDirectory({ host: 'h', port: 22, username: 'u', privateKey: 'inline-key' }, '/tmp')
    triggerClientEvent('ready')
    await promise

    expect(mockClientInstance!.connect.mock.calls[0][0].privateKey).toBe('inline-key')
  })

  it('无任何认证方式时应不设认证字段', async () => {
    const mockSftp = { readdir: vi.fn((p: string, cb: any) => cb(null, [])), fastPut: vi.fn(), mkdir: vi.fn(), unlink: vi.fn() }
    _sftpImpl = (cb) => cb(null, mockSftp)

    const promise = listRemoteDirectory({ host: 'h', port: 22, username: 'u' }, '/tmp')
    triggerClientEvent('ready')
    await promise

    const call = mockClientInstance!.connect.mock.calls[0][0]
    expect(call.password).toBeUndefined()
    expect(call.privateKey).toBeUndefined()
  })

  it('getConnectionConfig 应包含 readyTimeout', async () => {
    const mockSftp = { readdir: vi.fn((p: string, cb: any) => cb(null, [])), fastPut: vi.fn(), mkdir: vi.fn(), unlink: vi.fn() }
    _sftpImpl = (cb) => cb(null, mockSftp)

    const promise = listRemoteDirectory({ host: 'h', port: 22, username: 'u', password: 'p' }, '/tmp')
    triggerClientEvent('ready')
    await promise

    const call = mockClientInstance!.connect.mock.calls[0][0]
    expect(call.readyTimeout).toBe(15000)
  })
})

describe('uploadWithProgress', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockClientInstance = null
    _execImpl = null
    _sftpImpl = null
    vi.mocked(fs.existsSync).mockReturnValue(true)
  })

  it('本地路径不存在时应返回错误', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false)
    const cfg: UploadConfig = { host: 'h', port: 22, username: 'u', password: 'p', localPath: '/x', remotePath: '/r', isFolder: false, overwrite: false }
    const result = await uploadWithProgress(cfg)
    expect(result.success).toBe(false)
    expect(result.message).toBe('本地路径不存在')
  })

  it('单文件上传应返回进度', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true)
    vi.mocked(fs.statSync).mockReturnValue({ size: 5000 } as any)

    const mockSftp = { fastPut: vi.fn((a: string, b: string, cb: any) => cb(null)), mkdir: vi.fn((p: string, cb: any) => cb()), unlink: vi.fn(), readdir: vi.fn() }
    _sftpImpl = (cb) => cb(null, mockSftp)

    const cfg: UploadConfig = { host: 'h', port: 22, username: 'u', password: 'p', localPath: '/f.txt', remotePath: '/r', isFolder: false, overwrite: false }
    const promise = uploadWithProgress(cfg)
    triggerClientEvent('ready')
    const result = await promise
    expect(result.success).toBe(true)
    expect(result.filesUploaded).toBe(1)
    expect(result.totalFiles).toBe(1)
  })

  it('文件夹上传应递归获取所有文件', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true)
    vi.mocked(fs.statSync).mockReturnValue({ size: 1000 } as any)
    vi.mocked(fs.readdirSync)
      .mockReturnValueOnce([{ name: 'a.txt', isFile: () => true, isDirectory: () => false }, { name: 'sub', isFile: () => false, isDirectory: () => true }] as any)
      .mockReturnValueOnce([{ name: 'b.txt', isFile: () => true, isDirectory: () => false }] as any)

    const mockSftp = { fastPut: vi.fn((a: string, b: string, cb: any) => cb(null)), mkdir: vi.fn((p: string, cb: any) => cb()), unlink: vi.fn(), readdir: vi.fn() }
    _sftpImpl = (cb) => cb(null, mockSftp)

    const cfg: UploadConfig = { host: 'h', port: 22, username: 'u', password: 'p', localPath: '/dir', remotePath: '/r', isFolder: true, overwrite: false }
    const promise = uploadWithProgress(cfg)
    triggerClientEvent('ready')
    const result = await promise
    expect(result.success).toBe(true)
    expect(result.filesUploaded).toBe(2)
    expect(result.totalFiles).toBe(2)
  })

  it('空文件夹应返回错误', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true)
    vi.mocked(fs.readdirSync).mockReturnValue([] as any)

    const mockSftp = { fastPut: vi.fn(), mkdir: vi.fn(), unlink: vi.fn(), readdir: vi.fn() }
    _sftpImpl = (cb) => cb(null, mockSftp)

    const cfg: UploadConfig = { host: 'h', port: 22, username: 'u', password: 'p', localPath: '/empty', remotePath: '/r', isFolder: true, overwrite: false }
    const promise = uploadWithProgress(cfg)
    triggerClientEvent('ready')
    const result = await promise
    expect(result.success).toBe(false)
    expect(result.message).toBe('没有文件需要上传')
  })

  it('SFTP 连接失败应返回错误', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true)
    vi.mocked(fs.statSync).mockReturnValue({ size: 100 } as any)
    vi.mocked(fs.readdirSync).mockReturnValue([{ name: 'f.txt', isFile: () => true, isDirectory: () => false }] as any)
    _sftpImpl = (cb) => cb(new Error('SFTP not available'), null)

    const cfg: UploadConfig = { host: 'h', port: 22, username: 'u', password: 'p', localPath: '/f.txt', remotePath: '/r', isFolder: false, overwrite: false }
    const promise = uploadWithProgress(cfg)
    triggerClientEvent('ready')
    const result = await promise
    expect(result.success).toBe(false)
    expect(result.message).toBe('SFTP not available')
  })

  it('连接错误应返回错误', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true)
    vi.mocked(fs.statSync).mockReturnValue({ size: 100 } as any)
    vi.mocked(fs.readdirSync).mockReturnValue([{ name: 'f.txt', isFile: () => true, isDirectory: () => false }] as any)

    const cfg: UploadConfig = { host: 'h', port: 22, username: 'u', password: 'p', localPath: '/f.txt', remotePath: '/r', isFolder: false, overwrite: false }
    const promise = uploadWithProgress(cfg)
    triggerClientEvent('error', new Error('Timed out'))
    const result = await promise
    expect(result.success).toBe(false)
    expect(result.message).toBe('Timed out')
  })

  it('连接超时应返回失败并记录 totalFiles', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true)
    vi.mocked(fs.statSync).mockReturnValue({ size: 100 } as any)
    vi.mocked(fs.readdirSync).mockReturnValue([{ name: 'f.txt', isFile: () => true, isDirectory: () => false }] as any)

    const cfg: UploadConfig = { host: 'h', port: 22, username: 'u', password: 'p', localPath: '/f.txt', remotePath: '/r', isFolder: false, overwrite: false }
    const promise = uploadWithProgress(cfg)
    triggerClientEvent('timeout')
    const result = await promise
    expect(result.success).toBe(false)
    expect(result.message).toBe('连接超时')
    expect(result.filesUploaded).toBe(0)
    expect(result.totalFiles).toBe(1)
    expect(mockClientInstance!.end).toHaveBeenCalled()
  })
})

/**
 * IPC 处理器注册测试 - 验证全部 107 个频道正确注册
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ============================================================
// Mock ALL service imports (paths relative to THIS test file)
// ============================================================
vi.mock('../../../../electron/backend/services/account', () => ({ hasAccount: vi.fn(), createAccount: vi.fn(), loginAccount: vi.fn(), verifyToken: vi.fn(), changePassword: vi.fn() }))
vi.mock('../../../../electron/backend/services/endpoint', () => ({ listEndpoints: vi.fn(), getEndpoint: vi.fn(), createEndpoint: vi.fn(), updateEndpoint: vi.fn(), deleteEndpoint: vi.fn(), exportEndpoints: vi.fn(), importEndpoints: vi.fn() }))
vi.mock('../../../../electron/backend/services/page', () => ({ listPages: vi.fn(), getPage: vi.fn(), createPage: vi.fn(), updatePage: vi.fn(), deletePage: vi.fn() }))
vi.mock('../../../../electron/backend/services/slot', () => ({ listSlots: vi.fn(), getSlot: vi.fn(), createSlot: vi.fn(), updateSlot: vi.fn(), deleteSlot: vi.fn(), decryptSlotValueAuto: vi.fn() }))
vi.mock('../../../../electron/backend/services/chrome', () => ({ detectChrome: vi.fn() }))
vi.mock('../../../../electron/backend/services/automation', () => ({ executeLogin: vi.fn(), cancelExecution: vi.fn() }))
vi.mock('../../../../electron/backend/services/ssh', () => ({ uploadFile: vi.fn(), executeCommand: vi.fn(), listRemoteDirectory: vi.fn(), uploadWithProgress: vi.fn() }))
vi.mock('../../../../electron/backend/services/ttyd', () => ({
  startTtydWithSSH: vi.fn(), stopTtyd: vi.fn(), isTtydInstalled: vi.fn(), isTtydAvailable: vi.fn(),
  checkTtydCompatibility: vi.fn(), installTtyd: vi.fn(), getTtydPath: vi.fn(), setCustomTtydPath: vi.fn(),
  getTtydStatus: vi.fn(), checkPort: vi.fn(), killPortProcess: vi.fn(), getPlinkPathForDisplay: vi.fn(),
  setCustomPlinkPath: vi.fn(), getSshpassPathForDisplay: vi.fn(), setCustomSshpassPath: vi.fn(),
  getPlatformInfo: vi.fn(), isPuTTYInstalled: vi.fn(), installPuTTY: vi.fn(),
}))
vi.mock('../../../../electron/backend/services/terminal', () => ({ detectTerminals: vi.fn(), launchSSHTerminal: vi.fn() }))
vi.mock('../../../../electron/backend/services/terminalConfig', () => ({
  getTerminalList: vi.fn(), getAvailableTerminals: vi.fn(), addTerminal: vi.fn(), deleteTerminal: vi.fn(),
  updateTerminalStatus: vi.fn(), detectSystemTerminals: vi.fn(), initDefaultTerminals: vi.fn(), detectAndAddNewTerminals: vi.fn(),
}))
vi.mock('../../../../electron/backend/services/browser', () => ({
  getBrowserList: vi.fn(), getAvailableBrowsers: vi.fn(), addBrowser: vi.fn(), deleteBrowser: vi.fn(),
  updateBrowserStatus: vi.fn(), detectSystemBrowsers: vi.fn(), initDefaultBrowsers: vi.fn(),
  detectAndAddNewBrowsers: vi.fn(), updateBrowserPuppeteerVersion: vi.fn(), detectAndUpdateBrowserVersion: vi.fn(),
}))
vi.mock('../../../../electron/backend/services/logger', () => ({ initLogger: vi.fn(), getLogDir: vi.fn(), getLogContent: vi.fn(), clearLogs: vi.fn(), logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))
vi.mock('../../../../electron/backend/services/chromium', () => ({ getChromiumStatus: vi.fn(), installChromium: vi.fn(), uninstallChromium: vi.fn(), registerChromium: vi.fn(), unregisterChromium: vi.fn() }))
vi.mock('../../../../electron/backend/services/appLock', () => ({
  getLockSettings: vi.fn(), updateLockSettings: vi.fn(), setLockPassword: vi.fn(), verifyLockPassword: vi.fn(),
  removeLockPassword: vi.fn(), lockApp: vi.fn(), unlockApp: vi.fn(), isAppLocked: vi.fn(), sendUnlockRequestEmail: vi.fn(),
}))
vi.mock('../../../../electron/backend/services/browserInstance', () => ({ checkBrowserInstance: vi.fn() }))
vi.mock('../../../../electron/backend/services/keyRotation', () => ({ rotateKeys: vi.fn(), getRotationStatus: vi.fn(), startScheduledRotation: vi.fn(), stopScheduledRotation: vi.fn() }))
vi.mock('../../../../electron/backend/services/captcha', () => ({ recognize: vi.fn(), shutdownOcr: vi.fn() }))
vi.mock('../../../../electron/backend/services/ocrConfig', () => ({ getOcrMethod: vi.fn(() => 'tesseract'), setOcrMethod: vi.fn(), getOcrConfig: vi.fn(() => ({ method: 'tesseract', muggleAvailable: false, mugglePythonPath: null, muggleDiagnostics: null })) }))
vi.mock('../../../../electron/backend/crypto/secureKeyStorage', () => ({ isEncryptionAvailable: vi.fn(), generateKeys: vi.fn(), loadKeys: vi.fn(), getStatus: vi.fn(), deleteKeys: vi.fn() }))
vi.mock('../../../../electron/backend/services/endpointShare', () => ({
  generateShareToken: vi.fn(), importEndpointFromToken: vi.fn(), checkTokenPermission: vi.fn(),
  getTokenStatus: vi.fn(), getSharedEndpoints: vi.fn(), deleteSharedEndpoint: vi.fn(),
}))
vi.mock('../../../../electron/backend/services/tokenReceiver', () => ({ startTokenReceiver: vi.fn(), stopTokenReceiver: vi.fn(), getTokenReceiverStatus: vi.fn() }))
vi.mock('../../../../electron/backend/utils/network', () => ({ getLocalIPs: vi.fn(), isValidIP: vi.fn(), isValidCIDR: vi.fn(), isIPInCIDR: vi.fn() }))
vi.mock('../../../../electron/backend/database/index', () => ({
  getDatabasePath: vi.fn(() => '/mock/path'), initializeDatabase: vi.fn(), getDatabase: vi.fn(),
  closeDatabase: vi.fn(), exec: vi.fn(), query: vi.fn(), queryOne: vi.fn(), run: vi.fn(), transaction: vi.fn(), flushDatabase: vi.fn(),
}))
vi.mock('path', async () => ({ ...(await vi.importActual('path')) }))
vi.mock('fs', () => ({ readFileSync: vi.fn(() => 'mock-file') }))

import { mockIpcMain } from '../../../helpers/electron-mock'
import * as accountService from '../../../../electron/backend/services/account'

// ============================================================
// All 106 expected channels
// ============================================================
const ALL_EXPECTED_CHANNELS: string[] = [
  'account:hasAccount', 'account:create', 'account:login', 'account:verify', 'account:changePassword',
  'endpoint:list', 'endpoint:get', 'endpoint:create', 'endpoint:update', 'endpoint:delete',
  'endpoint:export', 'endpoint:import', 'endpoint:share', 'endpoint:importToken',
  'endpoint:checkTokenPermission', 'endpoint:getTokenStatus',
  'page:list', 'page:get', 'page:create', 'page:update', 'page:delete',
  'slot:list', 'slot:get', 'slot:create', 'slot:update', 'slot:delete', 'slot:decryptValue',
  'chrome:detect',
  'login:execute', 'login:cancel',
  'ssh:upload', 'ssh:execute', 'ssh:startTtyd', 'ssh:stopTtyd', 'ssh:selectKeyfile',
  'ssh:checkTtyd', 'ssh:installTtyd', 'ssh:listDir', 'ssh:selectUploadFiles',
  'ssh:uploadWithProgress', 'ssh:checkPuTTY', 'ssh:installPuTTY',
  'terminal:detect', 'terminal:launchSSH',
  'app:getDatabasePath', 'app:openDatabaseFolder', 'app:selectExecutable',
  'dialog:openFile', 'file:read',
  'app:getLogPath', 'app:getLogContent', 'app:clearLogs', 'app:openLogFolder',
  'ttyd:getPath', 'ttyd:setPath', 'ttyd:getStatus', 'ttyd:checkPort', 'ttyd:killPort',
  'plink:getPath', 'plink:setPath',
  'sshpass:getPath', 'sshpass:setPath',
  'platform:getInfo',
  'browser:getList', 'browser:getAvailable', 'browser:add', 'browser:delete',
  'browser:updateStatus', 'browser:detect', 'browser:initDefault', 'browser:detectAndAdd',
  'browser:updatePuppeteerVersion', 'browser:detectVersion', 'browser:analyzeVersion', 'browser:checkInstance',
  'terminalConfig:getList', 'terminalConfig:getAvailable', 'terminalConfig:add', 'terminalConfig:delete',
  'terminalConfig:updateStatus', 'terminalConfig:detect', 'terminalConfig:initDefault', 'terminalConfig:detectAndAdd',
  'chromium:getStatus', 'chromium:install', 'chromium:uninstall', 'chromium:register', 'chromium:unregister',
  'appLock:getSettings', 'appLock:updateSettings', 'appLock:setPassword', 'appLock:verifyPassword',
  'appLock:removePassword', 'appLock:lock', 'appLock:unlock', 'appLock:isLocked', 'appLock:sendUnlockRequest',
  'keyRotation:rotate', 'keyRotation:status', 'keyRotation:start', 'keyRotation:stop',
  'secureKeyStorage:isEncryptionAvailable',
  'tokenReceiver:start', 'tokenReceiver:stop', 'tokenReceiver:status',
  'network:getLocalIPs',
  'captcha:recognize', 'captcha:getConfig', 'captcha:setConfig',
]

const EXPECTED_COUNT = 109

describe('registerAllIPCHandlers', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  it('应有 107 个频道总数', () => { expect(ALL_EXPECTED_CHANNELS.length).toBe(EXPECTED_COUNT) })

  it('每个预期频道都应被注册', async () => {
    const { registerAllIPCHandlers } = await import('../../../../electron/backend/ipc/index')
    registerAllIPCHandlers()
    const registered = mockIpcMain.handle.mock.calls.map((c: any[]) => c[0])
    for (const ch of ALL_EXPECTED_CHANNELS) expect(registered).toContain(ch)
  })

  it('不应注册意外频道', async () => {
    const { registerAllIPCHandlers } = await import('../../../../electron/backend/ipc/index')
    registerAllIPCHandlers()
    const unexpected = mockIpcMain.handle.mock.calls.map((c: any[]) => c[0]).filter((ch: string) => !ALL_EXPECTED_CHANNELS.includes(ch))
    expect(unexpected).toEqual([])
  })

  it('所有 handler 应为函数', async () => {
    const { registerAllIPCHandlers } = await import('../../../../electron/backend/ipc/index')
    registerAllIPCHandlers()
    for (const call of mockIpcMain.handle.mock.calls) expect(typeof call[1]).toBe('function')
  })

  it('恰好 107 个 handler', async () => {
    const { registerAllIPCHandlers } = await import('../../../../electron/backend/ipc/index')
    registerAllIPCHandlers()
    expect(mockIpcMain.handle).toHaveBeenCalledTimes(EXPECTED_COUNT)
  })

  it('应打印注册完成日志', async () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const { registerAllIPCHandlers } = await import('../../../../electron/backend/ipc/index')
    registerAllIPCHandlers()
    expect(spy).toHaveBeenCalledWith('All IPC handlers registered')
    spy.mockRestore()
  })

  it('handler 应返回 IPCResponse 格式', async () => {
    const { registerAllIPCHandlers } = await import('../../../../electron/backend/ipc/index')
    registerAllIPCHandlers()
    const call = mockIpcMain.handle.mock.calls.find((c: any[]) => c[0] === 'account:hasAccount')
    const result = await call[1]({}, [])
    expect(result).toHaveProperty('success')
    expect(result).toHaveProperty('data')
  })

  it('handler 异常应返回 { success: false, error: ... }', async () => {
    ;(accountService.verifyToken as any).mockImplementation(() => { throw new Error('Invalid token') })
    const { registerAllIPCHandlers } = await import('../../../../electron/backend/ipc/index')
    registerAllIPCHandlers()
    const call = mockIpcMain.handle.mock.calls.find((c: any[]) => c[0] === 'account:verify')
    const result = await call[1]({}, ['bad-token'])
    expect(result.success).toBe(false)
    expect(result.error).toBe('Invalid token')
  })

  // 分组验证
  it('account: 5', async () => {
    const { registerAllIPCHandlers } = await import('../../../../electron/backend/ipc/index')
    registerAllIPCHandlers()
    expect(mockIpcMain.handle.mock.calls.map((c: any[]) => c[0]).filter((c: string) => c.startsWith('account:')).length).toBe(5)
  })
  it('endpoint: 11', async () => {
    const { registerAllIPCHandlers } = await import('../../../../electron/backend/ipc/index')
    registerAllIPCHandlers()
    expect(mockIpcMain.handle.mock.calls.map((c: any[]) => c[0]).filter((c: string) => c.startsWith('endpoint:')).length).toBe(11)
  })
  it('ssh: 12', async () => {
    const { registerAllIPCHandlers } = await import('../../../../electron/backend/ipc/index')
    registerAllIPCHandlers()
    expect(mockIpcMain.handle.mock.calls.map((c: any[]) => c[0]).filter((c: string) => c.startsWith('ssh:')).length).toBe(12)
  })
  it('browser: 12', async () => {
    const { registerAllIPCHandlers } = await import('../../../../electron/backend/ipc/index')
    registerAllIPCHandlers()
    expect(mockIpcMain.handle.mock.calls.map((c: any[]) => c[0]).filter((c: string) => c.startsWith('browser:')).length).toBe(12)
  })
  it('appLock: 9', async () => {
    const { registerAllIPCHandlers } = await import('../../../../electron/backend/ipc/index')
    registerAllIPCHandlers()
    expect(mockIpcMain.handle.mock.calls.map((c: any[]) => c[0]).filter((c: string) => c.startsWith('appLock:')).length).toBe(9)
  })
  it('captcha: 1', async () => {
    const { registerAllIPCHandlers } = await import('../../../../electron/backend/ipc/index')
    registerAllIPCHandlers()
    expect(mockIpcMain.handle.mock.calls.map((c: any[]) => c[0]).filter((c: string) => c.startsWith('captcha:')).length).toBe(3)
  })
  it('captcha:recognize handler 调用 captchaService.recognize', async () => {
    const { recognize } = await import('../../../../electron/backend/services/captcha')
    ;(recognize as any).mockResolvedValueOnce({ text: 'ABC', confidence: 90 })
    const { registerAllIPCHandlers } = await import('../../../../electron/backend/ipc/index')
    registerAllIPCHandlers()
    const call = mockIpcMain.handle.mock.calls.find((c: any[]) => c[0] === 'captcha:recognize')
    const result = await call[1]({}, { imageBase64: Buffer.from('test-img').toString('base64') })
    expect(result.success).toBe(true)
    expect(result.data).toBe('ABC')
  })
})

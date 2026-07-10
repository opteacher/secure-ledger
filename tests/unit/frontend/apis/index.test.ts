import { describe, it, expect, beforeEach, vi } from 'vitest'

const mockInvoke = vi.fn()
const mockOn = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
  ;(window as any).ipc = { invoke: mockInvoke, on: mockOn, send: vi.fn() }
})

import {
  accountApi,
  endpointApi,
  pageApi,
  slotApi,
  chromeApi,
  loginApi,
  sshApi,
  terminalApi,
  appApi,
  ttydApi,
  plinkApi,
  sshpassApi,
  platformApi,
  browserApi,
  terminalConfigApi,
  appLockApi,
  keyRotationApi,
  secureKeyStorageApi,
  tokenReceiverApi,
  networkApi,
} from '@/apis'

// ==========================================================================
// accountApi
// ==========================================================================
describe('accountApi', () => {
  it('hasAccount calls account:hasAccount with no args', async () => {
    await accountApi.hasAccount()
    expect(mockInvoke).toHaveBeenCalledWith('account:hasAccount')
    expect(mockInvoke).toHaveBeenCalledTimes(1)
  })

  it('create calls account:create with {username, password}', async () => {
    await accountApi.create('alice', 'secret')
    expect(mockInvoke).toHaveBeenCalledWith('account:create', {
      username: 'alice',
      password: 'secret',
    })
  })

  it('login calls account:login with {username, password}', async () => {
    await accountApi.login('alice', 'secret')
    expect(mockInvoke).toHaveBeenCalledWith('account:login', {
      username: 'alice',
      password: 'secret',
    })
  })

  it('verify calls account:verify with token string', async () => {
    await accountApi.verify('my-token')
    expect(mockInvoke).toHaveBeenCalledWith('account:verify', 'my-token')
  })

  it('changePassword calls account:changePassword with {oldPassword, newPassword}', async () => {
    await accountApi.changePassword('old', 'new')
    expect(mockInvoke).toHaveBeenCalledWith('account:changePassword', {
      oldPassword: 'old',
      newPassword: 'new',
    })
  })
})

// ==========================================================================
// endpointApi
// ==========================================================================
describe('endpointApi', () => {
  it('list calls endpoint:list with no args', async () => {
    await endpointApi.list()
    expect(mockInvoke).toHaveBeenCalledWith('endpoint:list')
  })

  it('get calls endpoint:get with id', async () => {
    await endpointApi.get(42)
    expect(mockInvoke).toHaveBeenCalledWith('endpoint:get', 42)
  })

  it('create calls endpoint:create with data', async () => {
    const data = { name: 'my-endpoint', login_type: 'web' as const }
    await endpointApi.create(data)
    expect(mockInvoke).toHaveBeenCalledWith('endpoint:create', data)
  })

  it('update calls endpoint:update with {id, updates}', async () => {
    const updates = { name: 'renamed' }
    await endpointApi.update(7, updates)
    expect(mockInvoke).toHaveBeenCalledWith('endpoint:update', { id: 7, updates })
  })

  it('delete calls endpoint:delete with id', async () => {
    await endpointApi.delete(9)
    expect(mockInvoke).toHaveBeenCalledWith('endpoint:delete', 9)
  })

  it('export calls endpoint:export with ids array', async () => {
    await endpointApi.export([1, 2, 3])
    expect(mockInvoke).toHaveBeenCalledWith('endpoint:export', [1, 2, 3])
  })

  it('import calls endpoint:import with data', async () => {
    const data: any[] = [{ id: 1, name: 'e1' }]
    await endpointApi.import(data)
    expect(mockInvoke).toHaveBeenCalledWith('endpoint:import', data)
  })

  it('share calls endpoint:share with {id, restrictions}', async () => {
    const restrictions = { type: 'unlimited' as const }
    await endpointApi.share(5, restrictions)
    expect(mockInvoke).toHaveBeenCalledWith('endpoint:share', {
      id: 5,
      restrictions,
    })
  })

  it('importToken calls endpoint:importToken with token string', async () => {
    await endpointApi.importToken('jwt-token-here')
    expect(mockInvoke).toHaveBeenCalledWith('endpoint:importToken', 'jwt-token-here')
  })

  it('checkTokenPermission calls endpoint:checkTokenPermission with {id}', async () => {
    await endpointApi.checkTokenPermission(10)
    expect(mockInvoke).toHaveBeenCalledWith('endpoint:checkTokenPermission', { id: 10 })
  })

  it('getTokenStatus calls endpoint:getTokenStatus with {id}', async () => {
    await endpointApi.getTokenStatus(11)
    expect(mockInvoke).toHaveBeenCalledWith('endpoint:getTokenStatus', { id: 11 })
  })
})

// ==========================================================================
// pageApi
// ==========================================================================
describe('pageApi', () => {
  it('list calls page:list with endpointId', async () => {
    await pageApi.list(5)
    expect(mockInvoke).toHaveBeenCalledWith('page:list', 5)
  })

  it('get calls page:get with id', async () => {
    await pageApi.get(3)
    expect(mockInvoke).toHaveBeenCalledWith('page:get', 3)
  })

  it('create calls page:create with data', async () => {
    const data = { url: 'https://example.com' }
    await pageApi.create(data)
    expect(mockInvoke).toHaveBeenCalledWith('page:create', data)
  })

  it('update calls page:update with {id, updates}', async () => {
    const updates = { url: 'https://new.example.com' }
    await pageApi.update(2, updates)
    expect(mockInvoke).toHaveBeenCalledWith('page:update', { id: 2, updates })
  })

  it('delete calls page:delete with id', async () => {
    await pageApi.delete(4)
    expect(mockInvoke).toHaveBeenCalledWith('page:delete', 4)
  })
})

// ==========================================================================
// slotApi
// ==========================================================================
describe('slotApi', () => {
  it('list calls slot:list with pageId', async () => {
    await slotApi.list(8)
    expect(mockInvoke).toHaveBeenCalledWith('slot:list', 8)
  })

  it('get calls slot:get with id', async () => {
    await slotApi.get(6)
    expect(mockInvoke).toHaveBeenCalledWith('slot:get', 6)
  })

  it('create calls slot:create with data', async () => {
    const data = { element_xpath: '//input[@id="user"]', action_type: 'input' as const }
    await slotApi.create(data)
    expect(mockInvoke).toHaveBeenCalledWith('slot:create', data)
  })

  it('update calls slot:update with {id, updates}', async () => {
    const updates = { value: 'new-value' }
    await slotApi.update(3, updates)
    expect(mockInvoke).toHaveBeenCalledWith('slot:update', { id: 3, updates })
  })

  it('delete calls slot:delete with id', async () => {
    await slotApi.delete(7)
    expect(mockInvoke).toHaveBeenCalledWith('slot:delete', 7)
  })

  it('decryptValue calls slot:decryptValue with {encryptedValue}', async () => {
    await slotApi.decryptValue('enc123')
    expect(mockInvoke).toHaveBeenCalledWith('slot:decryptValue', { encryptedValue: 'enc123' })
  })
})

// ==========================================================================
// chromeApi
// ==========================================================================
describe('chromeApi', () => {
  it('detect calls chrome:detect with no args', async () => {
    await chromeApi.detect()
    expect(mockInvoke).toHaveBeenCalledWith('chrome:detect')
  })
})

// ==========================================================================
// loginApi
// ==========================================================================
describe('loginApi', () => {
  it('execute calls login:execute with {endpointId, chromePath, wsEndpoint}', async () => {
    await loginApi.execute(12, '/path/to/chrome', 'ws://localhost:9222')
    expect(mockInvoke).toHaveBeenCalledWith('login:execute', {
      endpointId: 12,
      chromePath: '/path/to/chrome',
      wsEndpoint: 'ws://localhost:9222',
    })
  })

  it('execute calls login:execute with undefined wsEndpoint when omitted', async () => {
    await loginApi.execute(13, '/path/to/chrome')
    expect(mockInvoke).toHaveBeenCalledWith('login:execute', {
      endpointId: 13,
      chromePath: '/path/to/chrome',
      wsEndpoint: undefined,
    })
  })

  it('cancel calls login:cancel with no args', async () => {
    await loginApi.cancel()
    expect(mockInvoke).toHaveBeenCalledWith('login:cancel')
  })
})

// ==========================================================================
// sshApi
// ==========================================================================
describe('sshApi', () => {
  it('upload calls ssh:upload with config', async () => {
    const config = { host: '192.168.1.1', port: 22, username: 'root', localPath: '/tmp', remotePath: '/opt', isFolder: false, overwrite: true }
    await sshApi.upload(config)
    expect(mockInvoke).toHaveBeenCalledWith('ssh:upload', config)
  })

  it('execute calls ssh:execute with config', async () => {
    const config = { host: '192.168.1.1', port: 22, username: 'root', command: 'ls' }
    await sshApi.execute(config as any)
    expect(mockInvoke).toHaveBeenCalledWith('ssh:execute', config)
  })

  it('startTtyd calls ssh:startTtyd with config', async () => {
    const config = { host: '192.168.1.1', port: 22 }
    await sshApi.startTtyd(config)
    expect(mockInvoke).toHaveBeenCalledWith('ssh:startTtyd', config)
  })

  it('stopTtyd calls ssh:stopTtyd with no args', async () => {
    await sshApi.stopTtyd()
    expect(mockInvoke).toHaveBeenCalledWith('ssh:stopTtyd')
  })

  it('selectKeyfile calls ssh:selectKeyfile with no args', async () => {
    await sshApi.selectKeyfile()
    expect(mockInvoke).toHaveBeenCalledWith('ssh:selectKeyfile')
  })

  it('checkTtyd calls ssh:checkTtyd with no args', async () => {
    await sshApi.checkTtyd()
    expect(mockInvoke).toHaveBeenCalledWith('ssh:checkTtyd')
  })

  it('installTtyd calls ssh:installTtyd with no args', async () => {
    await sshApi.installTtyd()
    expect(mockInvoke).toHaveBeenCalledWith('ssh:installTtyd')
  })

  it('listDir calls ssh:listDir with {config, remotePath}', async () => {
    const config = { host: '192.168.1.1', port: 22, username: 'root' }
    await sshApi.listDir(config, '/var/log')
    expect(mockInvoke).toHaveBeenCalledWith('ssh:listDir', { config, remotePath: '/var/log' })
  })

  it('selectUploadFiles calls ssh:selectUploadFiles with {isFolder}', async () => {
    await sshApi.selectUploadFiles(true)
    expect(mockInvoke).toHaveBeenCalledWith('ssh:selectUploadFiles', { isFolder: true })
  })

  it('uploadWithProgress calls ssh:uploadWithProgress with {config}', async () => {
    const config = { host: '192.168.1.1', port: 22, username: 'root', localPath: '/tmp', remotePath: '/opt', isFolder: true, overwrite: false }
    await sshApi.uploadWithProgress(config)
    expect(mockInvoke).toHaveBeenCalledWith('ssh:uploadWithProgress', { config })
  })

  it('onUploadProgress calls window.ipc.on with channel and callback, returns cleanup', () => {
    const mockCleanup = vi.fn()
    mockOn.mockReturnValue(mockCleanup)

    const cb = vi.fn()
    const result = sshApi.onUploadProgress(cb)

    expect(mockOn).toHaveBeenCalledWith('ssh:upload:progress', cb)
    expect(result).toBe(mockCleanup)
  })

  it('checkPuTTY calls ssh:checkPuTTY with no args', async () => {
    await sshApi.checkPuTTY()
    expect(mockInvoke).toHaveBeenCalledWith('ssh:checkPuTTY')
  })

  it('installPuTTY calls ssh:installPuTTY with no args', async () => {
    await sshApi.installPuTTY()
    expect(mockInvoke).toHaveBeenCalledWith('ssh:installPuTTY')
  })
})

// ==========================================================================
// terminalApi
// ==========================================================================
describe('terminalApi', () => {
  it('detect calls terminal:detect with no args', async () => {
    await terminalApi.detect()
    expect(mockInvoke).toHaveBeenCalledWith('terminal:detect')
  })

  it('launchSSH calls terminal:launchSSH with config', async () => {
    const config = {
      terminalId: 'wt',
      terminalPath: 'C:\\Windows\\System32\\wt.exe',
      terminalName: 'Windows Terminal',
      host: '192.168.1.1',
      port: 22,
    }
    await terminalApi.launchSSH(config)
    expect(mockInvoke).toHaveBeenCalledWith('terminal:launchSSH', config)
  })
})

// ==========================================================================
// appApi
// ==========================================================================
describe('appApi', () => {
  it('getDatabasePath calls app:getDatabasePath with no args', async () => {
    await appApi.getDatabasePath()
    expect(mockInvoke).toHaveBeenCalledWith('app:getDatabasePath')
  })

  it('openDatabaseFolder calls app:openDatabaseFolder with no args', async () => {
    await appApi.openDatabaseFolder()
    expect(mockInvoke).toHaveBeenCalledWith('app:openDatabaseFolder')
  })

  it('selectExecutable calls app:selectExecutable with {title}', async () => {
    await appApi.selectExecutable('Pick a browser')
    expect(mockInvoke).toHaveBeenCalledWith('app:selectExecutable', { title: 'Pick a browser' })
  })

  it('selectExecutable calls app:selectExecutable with {title: undefined} when omitted', async () => {
    await appApi.selectExecutable()
    expect(mockInvoke).toHaveBeenCalledWith('app:selectExecutable', { title: undefined })
  })

  it('getLogPath calls app:getLogPath with no args', async () => {
    await appApi.getLogPath()
    expect(mockInvoke).toHaveBeenCalledWith('app:getLogPath')
  })

  it('getLogContent calls app:getLogContent with {maxLines}', async () => {
    await appApi.getLogContent(100)
    expect(mockInvoke).toHaveBeenCalledWith('app:getLogContent', { maxLines: 100 })
  })

  it('clearLogs calls app:clearLogs with no args', async () => {
    await appApi.clearLogs()
    expect(mockInvoke).toHaveBeenCalledWith('app:clearLogs')
  })

  it('openLogFolder calls app:openLogFolder with no args', async () => {
    await appApi.openLogFolder()
    expect(mockInvoke).toHaveBeenCalledWith('app:openLogFolder')
  })
})

// ==========================================================================
// ttydApi
// ==========================================================================
describe('ttydApi', () => {
  it('getPath calls ttyd:getPath with no args', async () => {
    await ttydApi.getPath()
    expect(mockInvoke).toHaveBeenCalledWith('ttyd:getPath')
  })

  it('setPath calls ttyd:setPath with {path}', async () => {
    await ttydApi.setPath('/usr/bin/ttyd')
    expect(mockInvoke).toHaveBeenCalledWith('ttyd:setPath', { path: '/usr/bin/ttyd' })
  })

  it('setPath calls ttyd:setPath with {path: null}', async () => {
    await ttydApi.setPath(null)
    expect(mockInvoke).toHaveBeenCalledWith('ttyd:setPath', { path: null })
  })

  it('getStatus calls ttyd:getStatus with no args', async () => {
    await ttydApi.getStatus()
    expect(mockInvoke).toHaveBeenCalledWith('ttyd:getStatus')
  })

  it('checkPort calls ttyd:checkPort with {port}', async () => {
    await ttydApi.checkPort(7681)
    expect(mockInvoke).toHaveBeenCalledWith('ttyd:checkPort', { port: 7681 })
  })

  it('killPort calls ttyd:killPort with {port}', async () => {
    await ttydApi.killPort(7681)
    expect(mockInvoke).toHaveBeenCalledWith('ttyd:killPort', { port: 7681 })
  })
})

// ==========================================================================
// plinkApi
// ==========================================================================
describe('plinkApi', () => {
  it('getPath calls plink:getPath with no args', async () => {
    await plinkApi.getPath()
    expect(mockInvoke).toHaveBeenCalledWith('plink:getPath')
  })

  it('setPath calls plink:setPath with {path}', async () => {
    await plinkApi.setPath('C:\\putty\\plink.exe')
    expect(mockInvoke).toHaveBeenCalledWith('plink:setPath', { path: 'C:\\putty\\plink.exe' })
  })
})

// ==========================================================================
// sshpassApi
// ==========================================================================
describe('sshpassApi', () => {
  it('getPath calls sshpass:getPath with no args', async () => {
    await sshpassApi.getPath()
    expect(mockInvoke).toHaveBeenCalledWith('sshpass:getPath')
  })

  it('setPath calls sshpass:setPath with {path}', async () => {
    await sshpassApi.setPath('/usr/bin/sshpass')
    expect(mockInvoke).toHaveBeenCalledWith('sshpass:setPath', { path: '/usr/bin/sshpass' })
  })
})

// ==========================================================================
// platformApi
// ==========================================================================
describe('platformApi', () => {
  it('getInfo calls platform:getInfo with no args', async () => {
    await platformApi.getInfo()
    expect(mockInvoke).toHaveBeenCalledWith('platform:getInfo')
  })
})

// ==========================================================================
// browserApi
// ==========================================================================
describe('browserApi', () => {
  it('getList calls browser:getList with no args', async () => {
    await browserApi.getList()
    expect(mockInvoke).toHaveBeenCalledWith('browser:getList')
  })

  it('getAvailable calls browser:getAvailable with no args', async () => {
    await browserApi.getAvailable()
    expect(mockInvoke).toHaveBeenCalledWith('browser:getAvailable')
  })

  it('add calls browser:add with {name, path}', async () => {
    await browserApi.add('Chrome', '/usr/bin/chrome')
    expect(mockInvoke).toHaveBeenCalledWith('browser:add', { name: 'Chrome', path: '/usr/bin/chrome' })
  })

  it('delete calls browser:delete with {id}', async () => {
    await browserApi.delete(5)
    expect(mockInvoke).toHaveBeenCalledWith('browser:delete', { id: 5 })
  })

  it('updateStatus calls browser:updateStatus with {id, isEnabled}', async () => {
    await browserApi.updateStatus(3, false)
    expect(mockInvoke).toHaveBeenCalledWith('browser:updateStatus', { id: 3, isEnabled: false })
  })

  it('updatePuppeteerVersion calls browser:updatePuppeteerVersion with {id, version}', async () => {
    await browserApi.updatePuppeteerVersion(4, 'high')
    expect(mockInvoke).toHaveBeenCalledWith('browser:updatePuppeteerVersion', { id: 4, version: 'high' })
  })

  it('detectVersion calls browser:detectVersion with {id}', async () => {
    await browserApi.detectVersion(2)
    expect(mockInvoke).toHaveBeenCalledWith('browser:detectVersion', { id: 2 })
  })

  it('analyzeVersion calls browser:analyzeVersion with {path, preference}', async () => {
    await browserApi.analyzeVersion('/usr/bin/chrome', 'auto')
    expect(mockInvoke).toHaveBeenCalledWith('browser:analyzeVersion', {
      path: '/usr/bin/chrome',
      preference: 'auto',
    })
  })

  it('detect calls browser:detect with no args', async () => {
    await browserApi.detect()
    expect(mockInvoke).toHaveBeenCalledWith('browser:detect')
  })

  it('initDefault calls browser:initDefault with no args', async () => {
    await browserApi.initDefault()
    expect(mockInvoke).toHaveBeenCalledWith('browser:initDefault')
  })

  it('detectAndAdd calls browser:detectAndAdd with no args', async () => {
    await browserApi.detectAndAdd()
    expect(mockInvoke).toHaveBeenCalledWith('browser:detectAndAdd')
  })

  it('checkInstance calls browser:checkInstance with {port}', async () => {
    await browserApi.checkInstance(9222)
    expect(mockInvoke).toHaveBeenCalledWith('browser:checkInstance', { port: 9222 })
  })

  it('checkInstance calls browser:checkInstance with {port: undefined} when omitted', async () => {
    await browserApi.checkInstance()
    expect(mockInvoke).toHaveBeenCalledWith('browser:checkInstance', { port: undefined })
  })
})

// ==========================================================================
// terminalConfigApi
// ==========================================================================
describe('terminalConfigApi', () => {
  it('getList calls terminalConfig:getList with no args', async () => {
    await terminalConfigApi.getList()
    expect(mockInvoke).toHaveBeenCalledWith('terminalConfig:getList')
  })

  it('getAvailable calls terminalConfig:getAvailable with no args', async () => {
    await terminalConfigApi.getAvailable()
    expect(mockInvoke).toHaveBeenCalledWith('terminalConfig:getAvailable')
  })

  it('add calls terminalConfig:add with {name, path, terminalType}', async () => {
    await terminalConfigApi.add('WT', 'C:\\wt.exe', 'windows-terminal')
    expect(mockInvoke).toHaveBeenCalledWith('terminalConfig:add', {
      name: 'WT',
      path: 'C:\\wt.exe',
      terminalType: 'windows-terminal',
    })
  })

  it('delete calls terminalConfig:delete with {id}', async () => {
    await terminalConfigApi.delete(6)
    expect(mockInvoke).toHaveBeenCalledWith('terminalConfig:delete', { id: 6 })
  })

  it('updateStatus calls terminalConfig:updateStatus with {id, isEnabled}', async () => {
    await terminalConfigApi.updateStatus(3, true)
    expect(mockInvoke).toHaveBeenCalledWith('terminalConfig:updateStatus', { id: 3, isEnabled: true })
  })

  it('detect calls terminalConfig:detect with no args', async () => {
    await terminalConfigApi.detect()
    expect(mockInvoke).toHaveBeenCalledWith('terminalConfig:detect')
  })

  it('initDefault calls terminalConfig:initDefault with no args', async () => {
    await terminalConfigApi.initDefault()
    expect(mockInvoke).toHaveBeenCalledWith('terminalConfig:initDefault')
  })

  it('detectAndAdd calls terminalConfig:detectAndAdd with no args', async () => {
    await terminalConfigApi.detectAndAdd()
    expect(mockInvoke).toHaveBeenCalledWith('terminalConfig:detectAndAdd')
  })
})

// ==========================================================================
// appLockApi
// ==========================================================================
describe('appLockApi', () => {
  it('getSettings calls appLock:getSettings with no args', async () => {
    await appLockApi.getSettings()
    expect(mockInvoke).toHaveBeenCalledWith('appLock:getSettings')
  })

  it('updateSettings calls appLock:updateSettings with settings', async () => {
    const settings = { is_enabled: true, lock_delay_minutes: 5 }
    await appLockApi.updateSettings(settings)
    expect(mockInvoke).toHaveBeenCalledWith('appLock:updateSettings', settings)
  })

  it('setPassword calls appLock:setPassword with {password}', async () => {
    await appLockApi.setPassword('hunter2')
    expect(mockInvoke).toHaveBeenCalledWith('appLock:setPassword', { password: 'hunter2' })
  })

  it('verifyPassword calls appLock:verifyPassword with {password}', async () => {
    await appLockApi.verifyPassword('hunter2')
    expect(mockInvoke).toHaveBeenCalledWith('appLock:verifyPassword', { password: 'hunter2' })
  })

  it('removePassword calls appLock:removePassword with no args', async () => {
    await appLockApi.removePassword()
    expect(mockInvoke).toHaveBeenCalledWith('appLock:removePassword')
  })

  it('lock calls appLock:lock with no args', async () => {
    await appLockApi.lock()
    expect(mockInvoke).toHaveBeenCalledWith('appLock:lock')
  })

  it('unlock calls appLock:unlock with no args', async () => {
    await appLockApi.unlock()
    expect(mockInvoke).toHaveBeenCalledWith('appLock:unlock')
  })

  it('isLocked calls appLock:isLocked with no args', async () => {
    await appLockApi.isLocked()
    expect(mockInvoke).toHaveBeenCalledWith('appLock:isLocked')
  })

  it('sendUnlockRequest calls appLock:sendUnlockRequest with no args', async () => {
    await appLockApi.sendUnlockRequest()
    expect(mockInvoke).toHaveBeenCalledWith('appLock:sendUnlockRequest')
  })
})

// ==========================================================================
// keyRotationApi
// ==========================================================================
describe('keyRotationApi', () => {
  it('rotate calls keyRotation:rotate with no args', async () => {
    await keyRotationApi.rotate()
    expect(mockInvoke).toHaveBeenCalledWith('keyRotation:rotate')
  })

  it('getStatus calls keyRotation:status with no args', async () => {
    await keyRotationApi.getStatus()
    expect(mockInvoke).toHaveBeenCalledWith('keyRotation:status')
  })

  it('start calls keyRotation:start with {intervalMs}', async () => {
    await keyRotationApi.start(60000)
    expect(mockInvoke).toHaveBeenCalledWith('keyRotation:start', { intervalMs: 60000 })
  })

  it('stop calls keyRotation:stop with no args', async () => {
    await keyRotationApi.stop()
    expect(mockInvoke).toHaveBeenCalledWith('keyRotation:stop')
  })
})

// ==========================================================================
// secureKeyStorageApi
// ==========================================================================
describe('secureKeyStorageApi', () => {
  it('isEncryptionAvailable calls secureKeyStorage:isEncryptionAvailable with no args', async () => {
    await secureKeyStorageApi.isEncryptionAvailable()
    expect(mockInvoke).toHaveBeenCalledWith('secureKeyStorage:isEncryptionAvailable')
  })
})

// ==========================================================================
// tokenReceiverApi
// ==========================================================================
describe('tokenReceiverApi', () => {
  it('start calls tokenReceiver:start with no args', async () => {
    await tokenReceiverApi.start()
    expect(mockInvoke).toHaveBeenCalledWith('tokenReceiver:start')
  })

  it('stop calls tokenReceiver:stop with no args', async () => {
    await tokenReceiverApi.stop()
    expect(mockInvoke).toHaveBeenCalledWith('tokenReceiver:stop')
  })

  it('status calls tokenReceiver:status with no args', async () => {
    await tokenReceiverApi.status()
    expect(mockInvoke).toHaveBeenCalledWith('tokenReceiver:status')
  })
})

// ==========================================================================
// networkApi
// ==========================================================================
describe('networkApi', () => {
  it('getLocalIPs calls network:getLocalIPs with no args', async () => {
    await networkApi.getLocalIPs()
    expect(mockInvoke).toHaveBeenCalledWith('network:getLocalIPs')
  })
})

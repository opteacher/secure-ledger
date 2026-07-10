/**
 * E2E test setup - mocks window.ipc for browser-based testing
 * 
 * Usage in tests:
 *   import { test, expect } from '../setup'
 */
import { test as base, Page } from '@playwright/test'

/**
 * Mock IPC handler that intercepts window.ipc.invoke calls
 * and returns fake data for each channel.
 */
async function mockIpcOnPage(page: Page) {
  await page.addInitScript(() => {
    // @ts-ignore - adding custom property to window
    (window as any).ipc = {
      invoke: async (channel: string, ...args: any[]) => {
        console.log('[MockIPC] invoke: ' + channel, args)
        
        switch (channel) {
          // ============ Account ============
          case 'account:hasAccount':
            return true
          case 'account:login':
            return { success: true, data: { token: 'mock-token-123', username: 'test' } }
          case 'account:verify':
            return { valid: true, username: 'test' }
          case 'account:create':
            return { success: true, message: 'Account created successfully' }
          case 'account:changePassword':
            return { success: true }
          
          // ============ Endpoint ============
          case 'endpoint:list':
            return {
              success: true,
              data: [
                { id: 1, name: '测试SSH', icon: '🔧', login_type: 'ssh', share_token: '', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
                { id: 2, name: '测试Web', icon: '🌐', login_type: 'web', share_token: '', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
              ],
            }
          case 'endpoint:get':
            return {
              id: 1,
              name: '测试SSH',
              icon: '🔧',
              login_type: 'ssh',
              share_token: '',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              pages: [
                {
                  id: 1,
                  endpoint_id: 1,
                  order_index: 0,
                  url: '192.168.1.1:22',
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                  slots: [
                    { id: 1, page_id: 1, order_index: 0, name: 'SSH用户名', element_xpath: '', action_type: 'input', value: 'admin', is_encrypted: false, timeout: 200 },
                    { id: 2, page_id: 1, order_index: 1, name: 'SSH密码', element_xpath: '', action_type: 'password', value: 'mock-encrypted-password', is_encrypted: true, timeout: 200 },
                  ],
                },
              ],
            }
          case 'endpoint:create':
            return { ...args[0], id: 3 }
          case 'endpoint:update':
            return { success: true }
          case 'endpoint:delete':
            return { success: true }
          case 'endpoint:export':
            return []
          case 'endpoint:import':
            return { success: 1, failed: 0 }
          
          // Share / Import Token
          case 'endpoint:share':
            return 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.mock-token-12345'
          case 'endpoint:importToken':
            return { id: 3, name: '导入的登录端', icon: '🌐', login_type: 'web', share_token: 'shared', created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
          case 'endpoint:getTokenStatus':
            return { isToken: true, isValid: true, usageInfo: '2/5次', expiryInfo: '' }
          case 'endpoint:checkTokenPermission':
            return { allowed: true }
          
          // ============ Page ============
          case 'page:list':
            return []
          case 'page:create':
            return { id: Date.now(), endpoint_id: args[0]?.endpoint_id || 0, url: args[0]?.url || '', order_index: 0, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
          case 'page:update':
            return true
          case 'page:delete':
            return true
          
          // ============ Slot ============
          case 'slot:decryptValue':
            return 'decrypted-mock-password'
          case 'slot:list':
            return []
          case 'slot:create':
            return { id: Date.now(), page_id: args[0]?.page_id || 0, ...args[0] }
          case 'slot:update':
            return true
          case 'slot:delete':
            return true
          
          // ============ App ============
          case 'app:getDatabasePath':
            return { path: '/mock/path/secure-ledger.db' }
          case 'app:openDatabaseFolder':
            return { success: true, path: '/mock/path' }
          case 'app:getLogPath':
            return { path: '/mock/path/logs' }
          case 'app:getLogContent':
            return { content: '[2026-04-10 10:00:00] INFO: Application started\n[2026-04-10 10:00:01] INFO: IPC handlers registered\n[2026-04-10 10:00:02] INFO: Database initialized' }
          case 'app:clearLogs':
            return { success: true, message: '日志已清空' }
          case 'app:openLogFolder':
            return { success: true, path: '/mock/path/logs' }
          case 'app:selectExecutable':
            return { canceled: true, filePaths: [] }
          
          // ============ SSH ============
          case 'ssh:checkTtyd':
            return { installed: true, available: true, error: null }
          case 'ssh:installTtyd':
            return { success: true, message: 'ttyd installed' }
          case 'ssh:startTtyd':
            return { success: true, message: 'ttyd started on port 7681', port: 7681 }
          case 'ssh:stopTtyd':
            return { success: true, message: 'ttyd stopped' }
          case 'ssh:listDir':
            return {
              success: true,
              files: [
                { name: 'home', isDirectory: true, size: 4096, modifiedTime: new Date().toISOString(), rights: 'drwxr-xr-x' },
                { name: 'etc', isDirectory: true, size: 4096, modifiedTime: new Date().toISOString(), rights: 'drwxr-xr-x' },
                { name: 'test.txt', isDirectory: false, size: 1024, modifiedTime: new Date().toISOString(), rights: '-rw-r--r--' },
              ],
            }
          case 'ssh:selectKeyfile':
            return { canceled: false, filePaths: ['/home/user/.ssh/id_rsa'] }
          case 'ssh:selectUploadFiles':
            return { canceled: true, filePaths: [] }
          case 'ssh:upload':
            return { success: true, message: '上传成功' }
          case 'ssh:execute':
            return { success: true, output: 'command output', error: undefined }
          case 'ssh:checkPuTTY':
            return { installed: true }
          case 'ssh:installPuTTY':
            return { success: true, message: 'PuTTY installed' }
          
          // ============ Browser ============
          case 'browser:list':
            return []
          case 'browser:getList':
            return [
              { id: 1, name: 'Google Chrome', path: '/usr/bin/google-chrome', is_enabled: true, puppeteer_version: 'auto', chrome_version: '120.0.0', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
              { id: 2, name: 'Chromium', path: '/usr/bin/chromium', is_enabled: false, puppeteer_version: 'auto', chrome_version: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
            ]
          case 'browser:getAvailable':
            return [
              { id: 1, name: 'Google Chrome', path: '/usr/bin/google-chrome', is_enabled: true, puppeteer_version: 'auto', chrome_version: '120.0.0', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
            ]
          case 'browser:add':
            return { id: 3, name: args[0]?.name, path: args[0]?.path, is_enabled: true, puppeteer_version: 'auto', chrome_version: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
          case 'browser:delete':
            return true
          case 'browser:updateStatus':
            return true
          case 'browser:updatePuppeteerVersion':
            return true
          case 'browser:detect':
            return [
              { name: 'Google Chrome', path: '/usr/bin/google-chrome', version: '120.0.0' },
              { name: 'Firefox', path: '/usr/bin/firefox', version: '110.0' },
            ]
          case 'browser:detectVersion':
            return { version: '120.0.0', majorVersion: 120 }
          case 'browser:analyzeVersion':
            return { versionInfo: { path: args[0]?.path || '', version: '120.0.0', majorVersion: 120 }, puppeteerVersion: 'high', decision: 'Use high version' }
          case 'browser:initDefault':
            return {}
          case 'browser:detectAndAdd':
            return { added: 1, skipped: 0, total: 1 }
          case 'browser:checkInstance':
            return { available: false, port: 9222 }
          
          // ============ Terminal Config ============
          case 'terminalConfig:getList':
            return [
              { id: 1, name: 'Windows Terminal', path: 'C:\\Users\\test\\wt.exe', terminal_type: 'wt', is_enabled: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
              { id: 2, name: 'PowerShell', path: 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe', terminal_type: 'powershell', is_enabled: false, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
            ]
          case 'terminalConfig:getAvailable':
            return [
              { id: 1, name: 'Windows Terminal', path: 'C:\\Users\\test\\wt.exe', terminal_type: 'wt', is_enabled: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
            ]
          case 'terminalConfig:add':
            return { id: 3, name: args[0]?.name, path: args[0]?.path, terminal_type: args[0]?.terminalType || '', is_enabled: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
          case 'terminalConfig:delete':
            return true
          case 'terminalConfig:updateStatus':
            return true
          case 'terminalConfig:detect':
            return [
              { id: 'wt', name: 'Windows Terminal', path: 'C:\\Users\\test\\wt.exe' },
              { id: 'powershell', name: 'PowerShell', path: 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe' },
            ]
          case 'terminalConfig:initDefault':
            return { success: true, message: '初始完成', count: 2 }
          case 'terminalConfig:detectAndAdd':
            return { added: 1, skipped: 1, total: 2 }
          
          // ============ Terminal (SSH Launch) ============
          case 'terminal:detect':
            return []
          case 'terminal:launchSSH':
            return { success: true, message: 'SSH terminal launched' }
          
          // ============ Login Execution ============
          case 'login:execute':
            return { success: true, message: 'Login executed successfully' }
          case 'login:cancel':
            return {}
          
          // ============ Lock ============
          case 'appLock:get':
            return { success: true, data: { is_enabled: false, is_locked: false, lock_delay_minutes: 5, has_password: false } }
          case 'appLock:getSettings':
            return { id: 1, is_enabled: false, is_locked: false, lock_delay_minutes: 5, has_password: false, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
          case 'appLock:updateSettings':
            return { id: 1, is_enabled: args[0]?.is_enabled !== undefined ? args[0].is_enabled : false, is_locked: false, lock_delay_minutes: args[0]?.lock_delay_minutes || 5, has_password: false, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
          case 'appLock:shouldLock':
            return { success: true, data: false }
          case 'appLock:setPassword':
            return { success: true, message: '密码设置成功' }
          case 'appLock:verifyPassword':
            return { valid: true }
          case 'appLock:removePassword':
            return { success: true, message: '密码已清除' }
          case 'appLock:lock':
            return {}
          case 'appLock:unlock':
            return {}
          case 'appLock:isLocked':
            return { is_locked: false }
          case 'appLock:sendUnlockRequest':
            return { success: true, message: 'Unlock request sent' }
          
          // ============ Key Rotation ============
          case 'keyRotation:status':
            return { isRotating: false, isScheduled: false, lastRotationTime: null, nextRotationTime: null }
          case 'keyRotation:rotate':
            return { success: true, message: '密钥轮换成功', details: { appLockPassword: true, slotsTotal: 10, slotsReEncrypted: 10, slotsSkipped: 0, errors: [], backupPath: '/mock/backup' } }
          case 'keyRotation:start':
            return { success: true, message: '定时轮换已启动' }
          case 'keyRotation:stop':
            return { success: true, message: '定时轮换已停止' }
          
          // ============ Secure Key Storage ============
          case 'secureKeyStorage:status':
            return { success: true, data: { hasKeys: true, initialized: true } }
          case 'secureKeyStorage:isEncryptionAvailable':
            return { available: true }
          case 'secureKeyStorage:generateKeys':
            return { success: true, message: 'Keys generated' }
          
          // ============ Key Hierarchy ============
          case 'keyHierarchy:status':
            return { success: true, data: { masterKeyGenerated: true, keyPairsGenerated: 2, healthy: true } }
          
          // ============ Chrome (legacy) ============
          case 'chrome:detect':
            return []
          
          // ============ ttyd API ============
          case 'ttyd:getPath':
            return { path: '/usr/bin/ttyd', source: 'system' }
          case 'ttyd:setPath':
            return { success: true, message: '路径已更新' }
          case 'ttyd:getStatus':
            return { running: false, port: null, pid: null }
          case 'ttyd:checkPort':
            return { inUse: false }
          case 'ttyd:killPort':
            return { success: true, message: '端口进程已终止' }
          
          // ============ plink API ============
          case 'plink:getPath':
            return { path: null, source: 'none' }
          case 'plink:setPath':
            return { success: true, message: 'plink 路径已更新' }
          
          // ============ sshpass API ============
          case 'sshpass:getPath':
            return { path: null, source: 'none' }
          case 'sshpass:setPath':
            return { success: true, message: 'sshpass 路径已更新' }
          
          // ============ Platform ============
          case 'platform:getInfo':
            return { platform: 'win32', isWindows: true, isMac: false, isLinux: false }
          
          // ============ Network ============
          case 'network:getLocalIPs':
            return { ips: ['192.168.1.100', '10.0.0.1'] }
          
          // ============ Token Receiver ============
          case 'tokenReceiver:start':
            return { success: true, port: 37777 }
          case 'tokenReceiver:stop':
            return { success: true }
          case 'tokenReceiver:status':
            return { running: false, port: null }
          
          // ============ Default ============
          default:
            console.warn('[MockIPC] Unhandled channel: ' + channel)
            return null
        }
      },
      on: (channel: string, callback: Function) => {
        console.log('[MockIPC] on: ' + channel)
        return () => {}
      },
      send: (channel: string, ...args: any[]) => {
        console.log('[MockIPC] send: ' + channel, args)
      },
    }
  })
}

// Extend the base test with our fixture
export const test = base.extend({
  page: async ({ page }, use) => {
    await mockIpcOnPage(page)
    await use(page)
  },
})

export { expect } from '@playwright/test'
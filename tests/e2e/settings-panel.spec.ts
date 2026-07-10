/**
 * 设置面板 E2E 测试
 */
import { test, expect } from './setup'

test.describe('设置侧边栏 /#/', () => {
  test('点击设置按钮应打开设置侧边栏', async ({ page }) => {
    await page.addInitScript(() => {
      ;(window as any).ipc = {
        ...(window as any).ipc,
        invoke: async (channel: string) => {
          if (channel === 'account:hasAccount') return true
          if (channel === 'account:verify') return { valid: true, username: 'test' }
          if (channel === 'endpoint:list') return { success: true, data: [] }
          if (channel === 'appLock:shouldLock') return { success: true, data: false }
          if (channel === 'appLock:getSettings') {
            return { id: 1, is_enabled: false, is_locked: false, lock_delay_minutes: 5, has_password: false, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
          }
          return null
        },
      }
    })
    
    await page.goto('/#/')
    await page.waitForLoadState('networkidle')
    
    // 点击设置按钮
    const settingsBtn = page.locator('button:has-text("设置")').first()
    if (await settingsBtn.isVisible({ timeout: 10000 })) {
      await settingsBtn.click()
      await page.waitForTimeout(2000)
      
      // 验证设置面板显示
      await expect(page.locator('h3:has-text("设置")').first()).toBeVisible({ timeout: 5000 })
    }
  })

  test('设置面板应显示浏览器管理区域', async ({ page }) => {
    await page.addInitScript(() => {
      ;(window as any).ipc = {
        ...(window as any).ipc,
        invoke: async (channel: string) => {
          if (channel === 'account:hasAccount') return true
          if (channel === 'account:verify') return { valid: true, username: 'test' }
          if (channel === 'endpoint:list') return { success: true, data: [] }
          if (channel === 'appLock:shouldLock') return { success: true, data: false }
          if (channel === 'appLock:getSettings') {
            return { id: 1, is_enabled: false, is_locked: false, lock_delay_minutes: 5, has_password: false, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
          }
          if (channel === 'browser:getList') {
            return [
              { id: 1, name: 'Google Chrome', path: '/usr/bin/google-chrome', is_enabled: true, puppeteer_version: 'auto', chrome_version: '120.0.0', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
              { id: 2, name: 'Chromium', path: '/usr/bin/chromium', is_enabled: false, puppeteer_version: 'auto', chrome_version: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
            ]
          }
          if (channel === 'browser:detect') return []
          if (channel === 'terminalConfig:getList') return []
          if (channel === 'terminalConfig:detect') return []
          if (channel === 'keyRotation:status') return { isRotating: false, isScheduled: false, lastRotationTime: null, nextRotationTime: null }
          if (channel === 'secureKeyStorage:isEncryptionAvailable') return { available: true }
          if (channel === 'app:getDatabasePath') return { path: '/mock/path/secure-ledger.db' }
          if (channel === 'app:getLogPath') return { path: '/mock/path/logs' }
          if (channel === 'ttyd:getPath') return { path: '/usr/bin/ttyd', source: 'system' }
          if (channel === 'ttyd:getStatus') return { running: false, port: null, pid: null }
          if (channel === 'ttyd:checkPort') return { inUse: false }
          if (channel === 'platform:getInfo') return { platform: 'win32', isWindows: true, isMac: false, isLinux: false }
          if (channel === 'plink:getPath') return { path: null, source: 'none' }
          return null
        },
      }
    })
    
    await page.goto('/#/')
    await page.waitForLoadState('networkidle')
    
    // 打开设置
    const settingsBtn = page.locator('button:has-text("设置")').first()
    if (await settingsBtn.isVisible({ timeout: 10000 })) {
      await settingsBtn.click()
      await page.waitForTimeout(2000)
    }
    
    // 验证浏览器管理标题
    await expect(page.locator('text=浏览器管理').first()).toBeVisible({ timeout: 5000 })
    // 验证浏览器列表中显示 Chrome
    await expect(page.locator('text=Google Chrome').first()).toBeVisible({ timeout: 5000 })
  })

  test('设置面板应显示命令行工具管理区域', async ({ page }) => {
    await page.addInitScript(() => {
      ;(window as any).ipc = {
        ...(window as any).ipc,
        invoke: async (channel: string) => {
          if (channel === 'account:hasAccount') return true
          if (channel === 'account:verify') return { valid: true, username: 'test' }
          if (channel === 'endpoint:list') return { success: true, data: [] }
          if (channel === 'appLock:shouldLock') return { success: true, data: false }
          if (channel === 'appLock:getSettings') {
            return { id: 1, is_enabled: false, is_locked: false, lock_delay_minutes: 5, has_password: false, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
          }
          if (channel === 'browser:getList') return []
          if (channel === 'browser:detect') return []
          if (channel === 'terminalConfig:getList') {
            return [
              { id: 1, name: 'Windows Terminal', path: 'C:\\Users\\test\\wt.exe', terminal_type: 'wt', is_enabled: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
            ]
          }
          if (channel === 'terminalConfig:detect') return []
          if (channel === 'keyRotation:status') return { isRotating: false, isScheduled: false, lastRotationTime: null, nextRotationTime: null }
          if (channel === 'secureKeyStorage:isEncryptionAvailable') return { available: true }
          if (channel === 'app:getDatabasePath') return { path: '/mock/path/secure-ledger.db' }
          if (channel === 'app:getLogPath') return { path: '/mock/path/logs' }
          if (channel === 'ttyd:getPath') return { path: '/usr/bin/ttyd', source: 'system' }
          if (channel === 'ttyd:getStatus') return { running: false, port: null, pid: null }
          if (channel === 'ttyd:checkPort') return { inUse: false }
          if (channel === 'platform:getInfo') return { platform: 'win32', isWindows: true, isMac: false, isLinux: false }
          if (channel === 'plink:getPath') return { path: null, source: 'none' }
          return null
        },
      }
    })
    
    await page.goto('/#/')
    await page.waitForLoadState('networkidle')
    
    // 打开设置
    const settingsBtn = page.locator('button:has-text("设置")').first()
    if (await settingsBtn.isVisible({ timeout: 10000 })) {
      await settingsBtn.click()
      await page.waitForTimeout(2000)
    }
    
    // 验证命令行工具标题
    await expect(page.locator('text=命令行工具').first()).toBeVisible({ timeout: 5000 })
  })

  test('设置面板应显示密钥轮换状态', async ({ page }) => {
    await page.addInitScript(() => {
      ;(window as any).ipc = {
        ...(window as any).ipc,
        invoke: async (channel: string) => {
          if (channel === 'account:hasAccount') return true
          if (channel === 'account:verify') return { valid: true, username: 'test' }
          if (channel === 'endpoint:list') return { success: true, data: [] }
          if (channel === 'appLock:shouldLock') return { success: true, data: false }
          if (channel === 'appLock:getSettings') {
            return { id: 1, is_enabled: false, is_locked: false, lock_delay_minutes: 5, has_password: false, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
          }
          if (channel === 'browser:getList') return []
          if (channel === 'browser:detect') return []
          if (channel === 'terminalConfig:getList') return []
          if (channel === 'terminalConfig:detect') return []
          if (channel === 'keyRotation:status') {
            return { isRotating: false, isScheduled: true, lastRotationTime: '2026-04-01T10:00:00Z', nextRotationTime: '2026-04-08T10:00:00Z' }
          }
          if (channel === 'secureKeyStorage:isEncryptionAvailable') return { available: true }
          if (channel === 'app:getDatabasePath') return { path: '/mock/path/secure-ledger.db' }
          if (channel === 'app:getLogPath') return { path: '/mock/path/logs' }
          if (channel === 'ttyd:getPath') return { path: '/usr/bin/ttyd', source: 'system' }
          if (channel === 'ttyd:getStatus') return { running: false, port: null, pid: null }
          if (channel === 'ttyd:checkPort') return { inUse: false }
          if (channel === 'platform:getInfo') return { platform: 'win32', isWindows: true, isMac: false, isLinux: false }
          if (channel === 'plink:getPath') return { path: null, source: 'none' }
          return null
        },
      }
    })
    
    await page.goto('/#/')
    await page.waitForLoadState('networkidle')
    
    // 打开设置
    const settingsBtn = page.locator('button:has-text("设置")').first()
    if (await settingsBtn.isVisible({ timeout: 10000 })) {
      await settingsBtn.click()
      await page.waitForTimeout(2000)
    }
    
    // 验证密钥轮换区域
    await expect(page.locator('text=密钥轮换').first()).toBeVisible({ timeout: 5000 })
    // 验证轮换按钮
    await expect(page.locator('button:has-text("轮换")').first()).toBeVisible({ timeout: 5000 })
  })

  test('设置面板应显示数据库和日志路径', async ({ page }) => {
    await page.addInitScript(() => {
      ;(window as any).ipc = {
        ...(window as any).ipc,
        invoke: async (channel: string) => {
          if (channel === 'account:hasAccount') return true
          if (channel === 'account:verify') return { valid: true, username: 'test' }
          if (channel === 'endpoint:list') return { success: true, data: [] }
          if (channel === 'appLock:shouldLock') return { success: true, data: false }
          if (channel === 'appLock:getSettings') {
            return { id: 1, is_enabled: false, is_locked: false, lock_delay_minutes: 5, has_password: false, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
          }
          if (channel === 'browser:getList') return []
          if (channel === 'browser:detect') return []
          if (channel === 'terminalConfig:getList') return []
          if (channel === 'terminalConfig:detect') return []
          if (channel === 'keyRotation:status') return { isRotating: false, isScheduled: false, lastRotationTime: null, nextRotationTime: null }
          if (channel === 'secureKeyStorage:isEncryptionAvailable') return { available: true }
          if (channel === 'app:getDatabasePath') return { path: '/mock/custom/path/secure-ledger.db' }
          if (channel === 'app:getLogPath') return { path: '/mock/custom/path/logs' }
          if (channel === 'ttyd:getPath') return { path: '/usr/bin/ttyd', source: 'system' }
          if (channel === 'ttyd:getStatus') return { running: false, port: null, pid: null }
          if (channel === 'ttyd:checkPort') return { inUse: false }
          if (channel === 'platform:getInfo') return { platform: 'win32', isWindows: true, isMac: false, isLinux: false }
          if (channel === 'plink:getPath') return { path: null, source: 'none' }
          return null
        },
      }
    })
    
    await page.goto('/#/')
    await page.waitForLoadState('networkidle')
    
    // 打开设置
    const settingsBtn = page.locator('button:has-text("设置")').first()
    if (await settingsBtn.isVisible({ timeout: 10000 })) {
      await settingsBtn.click()
      await page.waitForTimeout(2000)
    }
    
    // 验证数据库文件路径显示
    await expect(page.locator('text=数据库文件').first()).toBeVisible({ timeout: 5000 })
    await expect(page.locator('text=日志文件').first()).toBeVisible({ timeout: 5000 })
  })
})
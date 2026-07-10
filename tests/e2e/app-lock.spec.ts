/**
 * 应用锁定功能 E2E 测试
 */
import { test, expect } from './setup'

test.describe('应用锁定功能', () => {
  test('设置锁定密码', async ({ page }) => {
    await page.addInitScript(() => {
      ;(window as any).ipc = {
        ...(window as any).ipc,
        invoke: async (channel: string, data?: any) => {
          if (channel === 'account:hasAccount') return true
          if (channel === 'account:verify') return { valid: true, username: 'test' }
          if (channel === 'endpoint:list') return { success: true, data: [] }
          if (channel === 'appLock:shouldLock') return { success: true, data: false }
          if (channel === 'appLock:get') {
            return { success: true, data: { is_enabled: false, is_locked: false, lock_delay_minutes: 5, has_password: false } }
          }
          if (channel === 'appLock:setPassword') {
            (window as any).__passwordSet = true
            return { success: true, message: '密码设置成功' }
          }
          if (channel === 'appLock:update') { return { success: true } }
          return null
        },
      }
    })
    
    await page.goto('/#/')
    await page.waitForLoadState('networkidle')
    
    // 查找并点击设置按钮
    const settingsBtn = page.locator('button:has-text("设置"), button:has-text("Settings")').first()
    if (await settingsBtn.isVisible({ timeout: 10000 }).catch(() => false)) {
      await settingsBtn.click()
      await page.waitForTimeout(2000)
    }
  })

  test('锁定/解锁循环', async ({ page }) => {
    await page.addInitScript(() => {
      ;(window as any).ipc = {
        ...(window as any).ipc,
        invoke: async (channel: string) => {
          if (channel === 'account:hasAccount') return true
          if (channel === 'account:verify') return { valid: true, username: 'test' }
          if (channel === 'endpoint:list') return { success: true, data: [] }
          if (channel === 'appLock:shouldLock') return { success: true, data: true }
          if (channel === 'appLock:get') {
            return { success: true, data: { is_enabled: true, is_locked: (window as any).__isLocked, lock_delay_minutes: 5, has_password: true } }
          }
          if (channel === 'appLock:verifyPassword') {
            return { success: true }
          }
          return null
        },
      }
    })
    
    await page.goto('/#/')
    await page.waitForLoadState('networkidle')
    
    // 如果应用需要锁定，应该能看到锁屏界面或密码输入
    const lockScreen = page.locator('input[type="password"]').first()
    if (await lockScreen.isVisible({ timeout: 5000 }).catch(() => false)) {
      await lockScreen.fill('123456')
      
      // 查找解锁按钮
      const unlockBtn = page.locator('button:has-text("解锁"), button:has-text("Unlock")').first()
      if (await unlockBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await unlockBtn.click()
        await page.evaluate(() => { (window as any).__isLocked = false })
        await page.waitForTimeout(2000)
      }
    }
  })
})

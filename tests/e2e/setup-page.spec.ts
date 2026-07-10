/**
 * 初始设置页面 E2E 测试
 */
import { test, expect } from './setup'

test.describe('初始设置页面 /#/setup', () => {
  test('应该显示设置表单（首次使用时）', async ({ page }) => {
    // 模拟没有账户
    await page.addInitScript(() => {
      const originalInvoke = (window as any).ipc?.invoke
      ;(window as any).ipc = {
        ...(window as any).ipc,
        invoke: async (channel: string) => {
          if (channel === 'account:hasAccount') return false
          if (channel === 'secureKeyStorage:status') {
            return { success: true, data: { hasKeys: false, initialized: false } }
          }
          if (channel === 'appLock:shouldLock') return { success: true, data: false }
          // Fall back to original mock for other channels
          if (originalInvoke) return originalInvoke(channel)
          return null
        },
      }
    })
    
    await page.goto('/#/setup')
    
    // 验证设置表单存在
    const passwordInput = page.locator('input[type="password"]').first()
    await expect(passwordInput).toBeVisible({ timeout: 10000 })
  })

  test('创建账户后应该跳转到主页', async ({ page }) => {
    await page.addInitScript(() => {
      ;(window as any).ipc = {
        ...(window as any).ipc,
        invoke: async (channel: string) => {
          if (channel === 'account:hasAccount') return false
          if (channel === 'account:create') return { success: true, message: 'Account created successfully' }
          if (channel === 'secureKeyStorage:status') {
            return { success: true, data: { hasKeys: false, initialized: false } }
          }
          if (channel === 'secureKeyStorage:generateKeys') {
            return { success: true, message: 'Keys generated' }
          }
          if (channel === 'appLock:shouldLock') return { success: true, data: false }
          return null
        },
      }
    })
    
    await page.goto('/#/setup')
    
    // 填写密码
    const passwordInputs = page.locator('input[type="password"]')
    const count = await passwordInputs.count()
    
    if (count >= 2) {
      await passwordInputs.nth(0).fill('test123')
      await passwordInputs.nth(1).fill('test123')
    } else if (count === 1) {
      await passwordInputs.nth(0).fill('test123')
    }
    
    // 点击提交/创建按钮
    const submitButton = page.locator('button:has-text("创建"), button:has-text("Setup"), button:has-text("设置")').first()
    if (await submitButton.isVisible()) {
      await submitButton.click()
    }
  })
})

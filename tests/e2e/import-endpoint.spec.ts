/**
 * 导入登录端流程 E2E 测试
 */
import { test, expect } from './setup'

test.describe('导入登录端 /#/home', () => {
  test('应显示导入登录端按钮', async ({ page }) => {
    await page.addInitScript(() => {
      ;(window as any).ipc = {
        ...(window as any).ipc,
        invoke: async (channel: string) => {
          if (channel === 'account:hasAccount') return true
          if (channel === 'account:verify') return { valid: true, username: 'test' }
          if (channel === 'endpoint:list') return { success: true, data: [] }
          if (channel === 'appLock:get') return { success: true, data: { is_enabled: false } }
          if (channel === 'appLock:shouldLock') return { success: true, data: false }
          return null
        },
      }
    })
    await page.goto('/#/home')
    await expect(page.locator('text=导入登录端, button:has-text("导入")').first()).toBeVisible({ timeout: 10000 })
  })

  test('点击导入登录端应打开导入对话框', async ({ page }) => {
    await page.addInitScript(() => {
      ;(window as any).ipc = {
        ...(window as any).ipc,
        invoke: async (channel: string) => {
          if (channel === 'account:hasAccount') return true
          if (channel === 'account:verify') return { valid: true, username: 'test' }
          if (channel === 'endpoint:list') return { success: true, data: [] }
          if (channel === 'appLock:get') return { success: true, data: { is_enabled: false } }
          if (channel === 'appLock:shouldLock') return { success: true, data: false }
          return null
        },
      }
    })
    await page.goto('/#/home')
    const importBtn = page.locator('text=导入登录端').first()
    if (await importBtn.isVisible({ timeout: 10000 })) await importBtn.click()
    await page.waitForTimeout(500)
    await expect(page.locator('textarea, input[type="text"]').first()).toBeVisible({ timeout: 5000 })
  })

  test('输入 Token 并导入应调用 endpoint:importToken', async ({ page }) => {
    await page.addInitScript(() => {
      (window as any).__tokenImported = 0
      ;(window as any).ipc = {
        ...(window as any).ipc,
        invoke: async (channel: string) => {
          if (channel === 'account:hasAccount') return true
          if (channel === 'account:verify') return { valid: true, username: 'test' }
          if (channel === 'endpoint:list') return { success: true, data: [] }
          if (channel === 'endpoint:importToken') { (window as any).__tokenImported++; return { id: 99, name: '已导入', login_type: 'web' } }
          if (channel === 'appLock:get') return { success: true, data: { is_enabled: false } }
          if (channel === 'appLock:shouldLock') return { success: true, data: false }
          return null
        },
      }
    })
    await page.goto('/#/home')
    const importBtn = page.locator('text=导入登录端').first()
    if (await importBtn.isVisible({ timeout: 10000 })) await importBtn.click()
    await page.waitForTimeout(500)
    const textarea = page.locator('textarea').first()
    if (await textarea.isVisible({ timeout: 5000 })) {
      await textarea.fill('eyJhbGciOiJSUzI1NiJ9.test-token')
      const confirmBtn = page.locator('button:has-text("导入"), button:has-text("确认")').first()
      if (await confirmBtn.isVisible({ timeout: 3000 })) await confirmBtn.click()
      await page.waitForTimeout(2000)
    }
    const invoked = await page.evaluate(() => (window as any).__tokenImported)
    expect(invoked).toBeGreaterThan(0)
  })
})

/**
 * Web 自动化登录流程 E2E 测试
 */
import { test, expect } from './setup'

test.describe('Web 自动化登录 /#/home', () => {
  test('Web 端点应显示执行登录按钮', async ({ page }) => {
    await page.addInitScript(() => {
      ;(window as any).ipc = {
        ...(window as any).ipc,
        invoke: async (channel: string) => {
          if (channel === 'account:hasAccount') return true
          if (channel === 'account:verify') return { valid: true, username: 'test' }
          if (channel === 'endpoint:list') return { success: true, data: [
            { id: 1, name: 'Web测试', login_type: 'web', icon: '🌐', share_token: '' }
          ]}
          if (channel === 'appLock:get') return { success: true, data: { is_enabled: false } }
          if (channel === 'appLock:shouldLock') return { success: true, data: false }
          return null
        },
      }
    })
    await page.goto('/#/home')
    await page.waitForLoadState('networkidle')
    const execBtn = page.locator('button:has-text("执行"), text=执行').first()
    await expect(execBtn).toBeVisible({ timeout: 10000 })
  })

  test('点击执行登录应弹出浏览器选择', async ({ page }) => {
    await page.addInitScript(() => {
      ;(window as any).ipc = {
        ...(window as any).ipc,
        invoke: async (channel: string) => {
          if (channel === 'account:hasAccount') return true
          if (channel === 'account:verify') return { valid: true, username: 'test' }
          if (channel === 'endpoint:list') return { success: true, data: [
            { id: 1, name: 'Web登录测试', login_type: 'web', icon: '🌐', share_token: '' }
          ]}
          if (channel === 'endpoint:get') return {
            id: 1, name: 'Web登录测试', login_type: 'web',
            pages: [{ id: 1, order_index: 0, url: 'https://example.com/login',
              slots: [{ id: 1, page_id: 1, order_index: 0, name: '密码', element_xpath: '//input', action_type: 'input', value: 'enc', is_encrypted: true, timeout: 200 }]
            }]
          }
          if (channel === 'browser:getAvailable') return [{ id: 1, name: 'Chrome', path: '/chrome.exe', is_enabled: true }]
          if (channel === 'slot:decryptValue') return 'testpass'
          if (channel === 'appLock:get') return { success: true, data: { is_enabled: false } }
          if (channel === 'appLock:shouldLock') return { success: true, data: false }
          return null
        },
      }
    })
    await page.goto('/#/home')
    await page.waitForLoadState('networkidle')
    const execBtn = page.locator('button:has-text("执行")').first()
    if (await execBtn.isVisible({ timeout: 10000 })) await execBtn.click()
    await page.waitForTimeout(1000)
    await expect(page.locator('text=Chrome').first()).toBeVisible({ timeout: 5000 })
  })

  test('选择浏览器后应执行登录流程', async ({ page }) => {
    await page.addInitScript(() => {
      (window as any).__loginExecuted = 0
      ;(window as any).ipc = {
        ...(window as any).ipc,
        invoke: async (channel: string) => {
          if (channel === 'account:hasAccount') return true
          if (channel === 'account:verify') return { valid: true, username: 'test' }
          if (channel === 'endpoint:list') return { success: true, data: [
            { id: 1, name: 'Web执行测试', login_type: 'web', icon: '🌐', share_token: '' }
          ]}
          if (channel === 'endpoint:get') return {
            id: 1, name: 'Web执行测试', login_type: 'web',
            pages: [{ id: 1, order_index: 0, url: 'https://example.com/login',
              slots: [{ id: 1, page_id: 1, order_index: 0, name: '密码', element_xpath: '//input', action_type: 'input', value: 'enc', is_encrypted: true, timeout: 200 }]
            }]
          }
          if (channel === 'browser:getAvailable') return [{ id: 1, name: 'Chrome', path: '/chrome.exe', is_enabled: true }]
          if (channel === 'slot:decryptValue') return 'testpass'
          if (channel === 'login:execute') { (window as any).__loginExecuted++; return { success: true, isConnected: true } }
          if (channel === 'appLock:get') return { success: true, data: { is_enabled: false } }
          if (channel === 'appLock:shouldLock') return { success: true, data: false }
          return null
        },
      }
    })
    await page.goto('/#/home')
    await page.waitForLoadState('networkidle')
    const execBtn = page.locator('button:has-text("执行")').first()
    if (await execBtn.isVisible({ timeout: 10000 })) await execBtn.click()
    await page.waitForTimeout(500)
    const chromeBtn = page.locator('text=Chrome').first()
    if (await chromeBtn.isVisible({ timeout: 5000 })) await chromeBtn.click()
    await page.waitForTimeout(2000)
    const invoked = await page.evaluate(() => (window as any).__loginExecuted)
    expect(invoked).toBeGreaterThan(0)
  })
})

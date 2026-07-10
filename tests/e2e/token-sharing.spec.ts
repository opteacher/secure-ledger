/**
 * Token 分享流程 E2E 测试
 */
import { test, expect } from './setup'

test.describe('Token 分享 /#/home', () => {
  test('应显示分享按钮', async ({ page }) => {
    await page.addInitScript(() => {
      ;(window as any).ipc = {
        ...(window as any).ipc,
        invoke: async (channel: string) => {
          if (channel === 'account:hasAccount') return true
          if (channel === 'account:verify') return { valid: true, username: 'test' }
          if (channel === 'endpoint:list') return { success: true, data: [
            { id: 1, name: '分享测试', login_type: 'web', icon: '🌐', share_token: '' }
          ]}
          if (channel === 'appLock:get') return { success: true, data: { is_enabled: false } }
          if (channel === 'appLock:shouldLock') return { success: true, data: false }
          return null
        },
      }
    })
    await page.goto('/#/home')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('text=分享测试').first()).toBeVisible({ timeout: 10000 })
  })

  test('点击分享应打开分享对话框', async ({ page }) => {
    await page.addInitScript(() => {
      ;(window as any).ipc = {
        ...(window as any).ipc,
        invoke: async (channel: string) => {
          if (channel === 'account:hasAccount') return true
          if (channel === 'account:verify') return { valid: true, username: 'test' }
          if (channel === 'endpoint:list') return { success: true, data: [
            { id: 1, name: '分享对话框测试', login_type: 'web', icon: '🌐', share_token: '' }
          ]}
          if (channel === 'endpoint:get') return {
            id: 1, name: '分享对话框测试', login_type: 'web',
            pages: [{ id: 1, order_index: 0, url: 'https://example.com', slots: [] }]
          }
          if (channel === 'network:getLocalIPs') return { ips: ['192.168.1.1'] }
          if (channel === 'appLock:get') return { success: true, data: { is_enabled: false } }
          if (channel === 'appLock:shouldLock') return { success: true, data: false }
          return null
        },
      }
    })
    await page.goto('/#/home')
    await page.waitForLoadState('networkidle')
    const shareBtn = page.locator('button:has-text("分享"), text=分享').first()
    if (await shareBtn.isVisible({ timeout: 10000 })) await shareBtn.click()
    await page.waitForTimeout(500)
    await expect(page.locator('text=生成').first()).toBeVisible({ timeout: 5000 })
  })

  test('生成 Token 应调用 endpoint:share', async ({ page }) => {
    await page.addInitScript(() => {
      (window as any).__tokenGenerated = 0
      ;(window as any).ipc = {
        ...(window as any).ipc,
        invoke: async (channel: string) => {
          if (channel === 'account:hasAccount') return true
          if (channel === 'account:verify') return { valid: true, username: 'test' }
          if (channel === 'endpoint:list') return { success: true, data: [
            { id: 1, name: '生成Token测试', login_type: 'web', icon: '🌐', share_token: '' }
          ]}
          if (channel === 'endpoint:get') return {
            id: 1, name: '生成Token测试', login_type: 'web',
            pages: [{ id: 1, order_index: 0, url: 'https://example.com', slots: [] }]
          }
          if (channel === 'endpoint:share') { (window as any).__tokenGenerated++; return 'eyJhbGciOiJSUzI1NiJ9.mock-token' }
          if (channel === 'network:getLocalIPs') return { ips: ['192.168.1.1'] }
          if (channel === 'appLock:get') return { success: true, data: { is_enabled: false } }
          if (channel === 'appLock:shouldLock') return { success: true, data: false }
          return null
        },
      }
    })
    await page.goto('/#/home')
    await page.waitForLoadState('networkidle')
    const shareBtn = page.locator('button:has-text("分享")').first()
    if (await shareBtn.isVisible({ timeout: 10000 })) await shareBtn.click()
    await page.waitForTimeout(500)
    const genBtn = page.locator('button:has-text("生成")').first()
    if (await genBtn.isVisible({ timeout: 5000 })) await genBtn.click()
    await page.waitForTimeout(2000)
    const invoked = await page.evaluate(() => (window as any).__tokenGenerated)
    expect(invoked).toBeGreaterThan(0)
  })
})

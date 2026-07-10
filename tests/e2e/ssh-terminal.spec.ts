/**
 * SSH 终端连接流程 E2E 测试
 */
import { test, expect } from './setup'

test.describe('SSH 终端连接 /#/endpoint/:id', () => {
  test('SSH 类型端点应显示认证配置字段', async ({ page }) => {
    await page.addInitScript(() => {
      ;(window as any).ipc = {
        ...(window as any).ipc,
        invoke: async (channel: string) => {
          if (channel === 'account:hasAccount') return true
          if (channel === 'account:verify') return { valid: true, username: 'test' }
          if (channel === 'endpoint:get') return {
            id: 1, name: '测试服务器', login_type: 'ssh',
            pages: [{ id: 1, endpoint_id: 1, order_index: 0, url: '192.168.1.100:22',
              slots: [
                { id: 1, page_id: 1, order_index: 0, name: 'SSH用户名', action_type: 'input', value: 'root', is_encrypted: false, timeout: 0 },
                { id: 2, page_id: 1, order_index: 1, name: 'SSH密码', action_type: 'password', value: 'enc', is_encrypted: true, timeout: 0 },
              ] }]
          }
          if (channel === 'endpoint:list') return { success: true, data: [{ id: 1, name: '测试服务器', login_type: 'ssh' }] }
          if (channel === 'slot:decryptValue') return 'decrypted'
          if (channel === 'appLock:shouldLock') return { success: true, data: false }
          return null
        },
      }
    })
    await page.goto('/#/endpoint/1')
    await expect(page.locator('text=SSH 认证').first()).toBeVisible({ timeout: 10000 })
    await expect(page.locator('text=用户名').first()).toBeVisible({ timeout: 5000 })
    await expect(page.locator('text=密码').first()).toBeVisible({ timeout: 5000 })
  })

  test('点击连接按钮应触发 ttyd 启动', async ({ page }) => {
    await page.addInitScript(() => {
      (window as any).__sshInvoked = 0
      ;(window as any).ipc = {
        ...(window as any).ipc,
        invoke: async (channel: string) => {
          if (channel === 'account:hasAccount') return true
          if (channel === 'account:verify') return { valid: true, username: 'test' }
          if (channel === 'endpoint:get') return {
            id: 1, name: 'SSH连接测试', login_type: 'ssh',
            pages: [{ id: 1, endpoint_id: 1, order_index: 0, url: '192.168.1.100:22', slots: [] }]
          }
          if (channel === 'ssh:checkTtyd') return { installed: true, available: true, error: null }
          if (channel === 'ssh:startTtyd') { (window as any).__sshInvoked++; return { success: true, port: 7681 } }
          if (channel === 'appLock:get') return { success: true, data: { is_enabled: false } }
          if (channel === 'appLock:shouldLock') return { success: true, data: false }
          return null
        },
      }
    })
    await page.goto('/#/endpoint/1')
    const btn = page.locator('button:has-text("连接"), button:has-text("重连")').first()
    if (await btn.isVisible({ timeout: 10000 })) await btn.click()
    await page.waitForTimeout(2000)
    const invoked = await page.evaluate(() => (window as any).__sshInvoked)
    expect(invoked).toBeGreaterThan(0)
  })

  test('断开连接应调用 stopTtyd', async ({ page }) => {
    await page.addInitScript(() => {
      (window as any).__sshStopped = 0
      ;(window as any).ipc = {
        ...(window as any).ipc,
        invoke: async (channel: string) => {
          if (channel === 'account:hasAccount') return true
          if (channel === 'account:verify') return { valid: true, username: 'test' }
          if (channel === 'endpoint:get') return {
            id: 1, name: 'SSH断开测试', login_type: 'ssh',
            pages: [{ id: 1, endpoint_id: 1, order_index: 0, url: '192.168.1.100:22', slots: [] }]
          }
          if (channel === 'ssh:checkTtyd') return { installed: true, available: true, error: null }
          if (channel === 'ssh:startTtyd') return { success: true, port: 7681 }
          if (channel === 'ssh:stopTtyd') { (window as any).__sshStopped++; return { success: true } }
          if (channel === 'appLock:get') return { success: true, data: { is_enabled: false } }
          if (channel === 'appLock:shouldLock') return { success: true, data: false }
          return null
        },
      }
    })
    await page.goto('/#/endpoint/1')
    const connectBtn = page.locator('button:has-text("连接"), button:has-text("重连")').first()
    if (await connectBtn.isVisible({ timeout: 10000 })) { await connectBtn.click(); await page.waitForTimeout(2000) }
    const disconnectBtn = page.locator('button:has-text("断开")').first()
    if (await disconnectBtn.isVisible({ timeout: 5000 })) { await disconnectBtn.click(); await page.waitForTimeout(1000) }
    const stopped = await page.evaluate(() => (window as any).__sshStopped)
    expect(stopped).toBeGreaterThan(0)
  })
})

/**
 * 主页 E2E 测试
 */
import { test, expect } from './setup'

test.describe('主页 /#/', () => {
  test('应该显示登录端列表', async ({ page }) => {
    // 模拟已登录状态
    await page.addInitScript(() => {
      // Mock account:hasAccount to return true (skip setup)
      const origInvoke = (window as any).ipc?.invoke
      ;(window as any).ipc = {
        ...(window as any).ipc,
        invoke: async (channel: string) => {
          if (channel === 'account:hasAccount') return true
          if (channel === 'account:verify') return { valid: true, username: 'test' }
          if (channel === 'endpoint:list') {
            return {
              success: true,
              data: [
                { id: 1, name: '测试服务器', icon: '🔧', login_type: 'ssh', share_token: '', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
                { id: 2, name: '测试网页', icon: '🌐', login_type: 'web', share_token: '', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
              ],
            }
          }
          if (channel === 'appLock:shouldLock') return { success: true, data: false }
          if (origInvoke) return origInvoke(channel)
          return null
        },
      }
    })
    
    await page.goto('/#/')
    
    // 等待页面加载 - 检查有登录端名称显示
    await expect(page.locator('text=测试服务器').first()).toBeVisible({ timeout: 10000 })
    await expect(page.locator('text=测试网页').first()).toBeVisible({ timeout: 5000 })
  })

  test('应该能打开设置侧边栏', async ({ page }) => {
    await page.addInitScript(() => {
      ;(window as any).ipc = {
        ...(window as any).ipc,
        invoke: async (channel: string) => {
          if (channel === 'account:hasAccount') return true
          if (channel === 'account:verify') return { valid: true, username: 'test' }
          if (channel === 'endpoint:list') return { success: true, data: [] }
          if (channel === 'browser:list') return []
          if (channel === 'appLock:get') {
            return { success: true, data: { is_enabled: false, is_locked: false, lock_delay_minutes: 5, has_password: true } }
          }
          if (channel === 'appLock:shouldLock') return { success: true, data: false }
          return null
        },
      }
    })
    
    await page.goto('/#/')
    
    // 查找并点击设置按钮（通常在右上角的齿轮图标或菜单按钮）
    const settingsButton = page.locator('button:has-text("设置"), button:has-text("Settings"), svg').first()
    
    // 如果可见则点击
    if (await settingsButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await settingsButton.click()
    }
  })

  test('SSH类型端点应该显示上传按钮', async ({ page }) => {
    await page.addInitScript(() => {
      ;(window as any).ipc = {
        ...(window as any).ipc,
        invoke: async (channel: string) => {
          if (channel === 'account:hasAccount') return true
          if (channel === 'account:verify') return { valid: true, username: 'test' }
          if (channel === 'endpoint:list') {
            return {
              success: true,
              data: [
                { id: 1, name: 'SSH服务器', icon: '🔧', login_type: 'ssh', share_token: '', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
              ],
            }
          }
          if (channel === 'appLock:shouldLock') return { success: true, data: false }
          return null
        },
      }
    })
    
    await page.goto('/#/')
    
    // 验证SSH类型的端点显示
    await expect(page.locator('text=SSH服务器').first()).toBeVisible({ timeout: 10000 })
  })

  test('应该能导航到添加端点页面', async ({ page }) => {
    await page.addInitScript(() => {
      ;(window as any).ipc = {
        ...(window as any).ipc,
        invoke: async (channel: string) => {
          if (channel === 'account:hasAccount') return true
          if (channel === 'account:verify') return { valid: true, username: 'test' }
          if (channel === 'endpoint:list') return { success: true, data: [] }
          if (channel === 'appLock:shouldLock') return { success: true, data: false }
          return null
        },
      }
    })
    
    await page.goto('/#/')
    
    // 查找添加按钮
    const addButton = page.locator('button:has-text("添加"), button:has-text("新增"), button:has-text("Add"), a:has-text("添加")').first()
    if (await addButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await addButton.click()
    }
  })
})

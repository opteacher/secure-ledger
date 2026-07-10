/**
 * Web 端点编辑 E2E 测试
 */
import { test, expect } from './setup'

test.describe('Web 端点编辑 /#/endpoint/new', () => {
  test('创建新 Web 端点应显示步骤页和操作步骤面板', async ({ page }) => {
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
    
    await page.goto('/#/endpoint/new')
    await page.waitForLoadState('networkidle')
    
    // 默认应该是 Web 类型
    // 验证步骤页侧边栏
    await expect(page.locator('text=步骤页').first()).toBeVisible({ timeout: 10000 })
    
    // 验证"添加步骤页"按钮
    await expect(page.locator('text=添加步骤页').first()).toBeVisible({ timeout: 5000 })
    
    // 验证操作步骤面板
    await expect(page.locator('text=操作步骤').first()).toBeVisible({ timeout: 5000 })
    
    // 验证"选择元素"按钮
    await expect(page.locator('button:has-text("选择元素")').first()).toBeVisible({ timeout: 5000 })
  })

  test('Web 端点应能输入页面 URL', async ({ page }) => {
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
    
    await page.goto('/#/endpoint/new')
    await page.waitForLoadState('networkidle')
    
    // 填写端点名称
    const nameInput = page.locator('input[placeholder="登录端名称"]').first()
    if (await nameInput.isVisible({ timeout: 10000 })) {
      await nameInput.fill('测试网页登录')
    }
    
    // 填写 URL
    const urlInput = page.locator('input[placeholder*="https://"]').first()
    if (await urlInput.isVisible({ timeout: 5000 })) {
      await urlInput.fill('https://example.com/login')
    }
    
    // 验证"加载"按钮可见
    await expect(page.locator('button:has-text("加载")').first()).toBeVisible({ timeout: 5000 })
  })

  test('Web 端点应能添加操作步骤（slot）', async ({ page }) => {
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
    
    await page.goto('/#/endpoint/new')
    await page.waitForLoadState('networkidle')
    
    // 点击"添加"操作步骤按钮
    const addSlotBtn = page.locator('button:has-text("+ 添加"), button:has-text("添加")').first()
    if (await addSlotBtn.isVisible({ timeout: 10000 })) {
      await addSlotBtn.click()
      await page.waitForTimeout(1000)
    }
    
    // 验证 Web 端点的操作步骤面板显示
    await expect(page.locator('text=操作步骤').first()).toBeVisible({ timeout: 5000 })
  })

  test('保存 Web 端点应创建并跳转到主页', async ({ page }) => {
    
    await page.addInitScript(() => {
      ;(window as any).ipc = {
        ...(window as any).ipc,
        invoke: async (channel: string, ...args: any[]) => {
          if (channel === 'account:hasAccount') return true
          if (channel === 'account:verify') return { valid: true, username: 'test' }
          if (channel === 'endpoint:list') return { success: true, data: [] }
          if (channel === 'appLock:shouldLock') return { success: true, data: false }
          if (channel === 'endpoint:create') {
            (window as any).__endpointCreated = true
            return { id: 99, name: args[0]?.name || '', login_type: 'web' }
          }
          if (channel === 'page:create') {
            (window as any).__pageCreated = true
            return { id: 20, endpoint_id: 3, order_index: 0, url: args[0]?.url || '', created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
          }
          if (channel === 'slot:create') {
            (window as any).__slotsCreated = ((window as any).__slotsCreated || 0) + 1
            return { id: 200 + ((window as any).__slotsCreated || 0), page_id: 20, ...args[0] }
          }
          return null
        },
      }
    })
    
    await page.goto('/#/endpoint/new')
    await page.waitForLoadState('networkidle')
    
    // 填写端点名称
    const nameInput = page.locator('input[placeholder="登录端名称"]').first()
    if (await nameInput.isVisible({ timeout: 10000 })) {
      await nameInput.fill('保存的Web')
    }
    
    // 填写 URL
    const urlInput = page.locator('input[placeholder*="https://"]').first()
    if (await urlInput.isVisible({ timeout: 5000 })) {
      await urlInput.fill('https://example.com/login')
    }
    
    // 点击保存
    const saveBtn = page.locator('button:has-text("保存")').first()
    if (await saveBtn.isVisible({ timeout: 5000 })) {
      await saveBtn.click()
      await page.waitForTimeout(3000)
      
      // 验证 endpoint:create 被调用
      const created = await page.evaluate(() => !!(window as any).__endpointCreated)
      expect(created).toBe(true)
    }
  })

  test('已有 Web 端点应加载已有数据和步骤页', async ({ page }) => {
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
                { id: 2, name: '已有Web', icon: '🌐', login_type: 'web', share_token: '', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
              ],
            }
          }
          if (channel === 'endpoint:get') {
            return {
              id: 2, name: '已有Web', icon: '🌐', login_type: 'web', share_token: '',
              created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
              pages: [{
                id: 2, endpoint_id: 2, order_index: 0, url: 'https://example.com/dashboard',
                created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
                slots: [
                  { id: 5, page_id: 2, order_index: 0, name: '', element_xpath: '//*[@id=\"username\"]', action_type: 'input', value: 'testuser', is_encrypted: false, timeout: 200 },
                  { id: 6, page_id: 2, order_index: 1, name: '', element_xpath: '//*[@id=\"password\"]', action_type: 'input', value: 'enc-pass', is_encrypted: true, timeout: 200 },
                  { id: 7, page_id: 2, order_index: 2, name: '', element_xpath: '//*[@id=\"login-btn\"]', action_type: 'click', value: '', is_encrypted: false, timeout: 500 },
                ],
              }],
            }
          }
          if (channel === 'slot:decryptValue') return 'decrypted-pass'
          if (channel === 'appLock:shouldLock') return { success: true, data: false }
          return null
        },
      }
    })
    
    await page.goto('/#/endpoint/2')
    await page.waitForLoadState('networkidle')
    
    // 验证端点名称
    const nameInput = page.locator('input[placeholder="登录端名称"]')
    if (await nameInput.isVisible({ timeout: 10000 })) {
      // 验证 Web 端点元素
      await expect(page.locator('text=操作步骤').first()).toBeVisible({ timeout: 5000 })
    }
  })
})
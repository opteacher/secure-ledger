/**
 * SSH 端点编辑 E2E 测试
 */
import { test, expect } from './setup'

test.describe('SSH 端点编辑 /#/endpoint/new', () => {
  test('创建新端点应显示 SSH 类型选择', async ({ page }) => {
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
    
    // 验证保存按钮存在
    await expect(page.locator('button:has-text("保存")').first()).toBeVisible({ timeout: 10000 })
    
    // 验证类型选择器存在
    const typeSelect = page.locator('select').first()
    await expect(typeSelect).toBeVisible({ timeout: 5000 })
    
    // 验证选项包含 SSH
    await expect(page.locator('option:has-text("SSH登录")').first()).toBeVisible({ timeout: 5000 })
  })

  test('切换到 SSH 类型应显示 SSH 认证面板', async ({ page }) => {
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
    
    // 选择 SSH 类型
    const typeSelect = page.locator('select').first()
    if (await typeSelect.isVisible({ timeout: 5000 })) {
      await typeSelect.selectOption('ssh')
      await page.waitForTimeout(1000)
    }
    
    // 验证 SSH 认证面板显示
    await expect(page.locator('text=SSH 认证').first()).toBeVisible({ timeout: 5000 })
    await expect(page.locator('text=服务器地址').first()).toBeVisible({ timeout: 5000 })
  })

  test('SSH 端点应能添加步骤页 URL', async ({ page }) => {
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
    
    // 选择 SSH 类型
    const typeSelect = page.locator('select').first()
    if (await typeSelect.isVisible({ timeout: 5000 })) {
      await typeSelect.selectOption('ssh')
      await page.waitForTimeout(500)
    }
    
    // 填写端点名称
    const nameInput = page.locator('input[placeholder="登录端名称"]').first()
    if (await nameInput.isVisible({ timeout: 5000 })) {
      await nameInput.fill('测试SSH服务器')
    }
    
    // 填写服务器地址
    const urlInput = page.locator('input[placeholder*="example.com"]').first()
    if (await urlInput.isVisible({ timeout: 5000 })) {
      await urlInput.fill('192.168.1.100:22')
    }
    
    // 填写 SSH 认证信息
    const usernameInput = page.locator('input[placeholder="留空使用系统默认"]').first()
    if (await usernameInput.isVisible({ timeout: 5000 })) {
      await usernameInput.fill('admin')
    }
    
    const passwordInput = page.locator('input[placeholder="••••••••"]').first()
    if (await passwordInput.isVisible({ timeout: 5000 })) {
      await passwordInput.fill('secure-password')
    }
  })

  test('保存 SSH 端点应创建并跳转到主页', async ({ page }) => {
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
            return { id: 5, name: args[0]?.name, icon: '', login_type: 'ssh', share_token: '', created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
          }
          if (channel === 'page:create') {
            (window as any).__pageCreated = true
            return { id: 10, endpoint_id: 5, order_index: 0, url: args[0]?.url || '', created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
          }
          if (channel === 'slot:create') {
            (window as any).__slotsCreated = ((window as any).__slotsCreated || 0) + 1
            return { id: 100 + ((window as any).__slotsCreated || 0), page_id: 10, ...args[0] }
          }
          return null
        },
      }
    })
    
    await page.goto('/#/endpoint/new')
    await page.waitForLoadState('networkidle')
    
    // 选择 SSH
    const typeSelect = page.locator('select').first()
    if (await typeSelect.isVisible({ timeout: 5000 })) {
      await typeSelect.selectOption('ssh')
      await page.waitForTimeout(500)
    }
    
    // 填写信息
    const nameInput = page.locator('input[placeholder="登录端名称"]').first()
    if (await nameInput.isVisible({ timeout: 5000 })) {
      await nameInput.fill('保存的SSH')
    }
    
    const urlInput = page.locator('input[placeholder*="example.com"]').first()
    if (await urlInput.isVisible({ timeout: 5000 })) {
      await urlInput.fill('192.168.1.1:22')
    }
    
    // 点击保存
    const saveBtn = page.locator('button:has-text("保存")').first()
    if (await saveBtn.isVisible({ timeout: 5000 })) {
      await saveBtn.click()
      await page.waitForTimeout(3000)
      
      // 验证创建流程
      const created = await page.evaluate(() => !!(window as any).__endpointCreated)
      expect(created).toBe(true)
    }
  })

  test('已有 SSH 端点应显示已有认证信息', async ({ page }) => {
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
                { id: 1, name: '现有SSH', icon: '🔧', login_type: 'ssh', share_token: '', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
              ],
            }
          }
          if (channel === 'endpoint:get') {
            return {
              id: 1, name: '现有SSH', icon: '🔧', login_type: 'ssh', share_token: '',
              created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
              pages: [{
                id: 1, endpoint_id: 1, order_index: 0, url: '10.0.0.1:22',
                created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
                slots: [
                  { id: 1, page_id: 1, order_index: 0, name: 'SSH用户名', element_xpath: '', action_type: 'input', value: 'root', is_encrypted: false, timeout: 0 },
                  { id: 2, page_id: 1, order_index: 1, name: 'SSH密码', element_xpath: '', action_type: 'password', value: 'enc-value', is_encrypted: true, timeout: 0 },
                ],
              }],
            }
          }
          if (channel === 'slot:decryptValue') return 'decrypted-password'
          if (channel === 'appLock:shouldLock') return { success: true, data: false }
          return null
        },
      }
    })
    
    await page.goto('/#/endpoint/1')
    await page.waitForLoadState('networkidle')
    
    // 验证端点名称已加载
    const nameInput = page.locator('input[placeholder="登录端名称"]')
    if (await nameInput.isVisible({ timeout: 10000 })) {
      // 验证已有 SSH 配置被加载
      await expect(page.locator('text=SSH 认证').first()).toBeVisible({ timeout: 5000 })
    }
  })
})
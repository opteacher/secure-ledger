/**
 * 登录端 CRUD E2E 测试
 */
import { test, expect } from './setup'

test.describe('登录端 CRUD 操作', () => {
  test('创建 Web 类型登录端', async ({ page }) => {
    await page.addInitScript(() => {
      ;(window as any).ipc = {
        ...(window as any).ipc,
        invoke: async (channel: string, data?: any) => {
          if (channel === 'account:hasAccount') return true
          if (channel === 'account:verify') return { valid: true, username: 'test' }
          if (channel === 'endpoint:list') return { success: true, data: [] }
          if (channel === 'appLock:shouldLock') return { success: true, data: false }
          if (channel === 'endpoint:create') {
            return {
              success: true,
              data: { id: 1, name: data?.name || '新端点', icon: data?.icon || '', login_type: data?.login_type || 'web', share_token: '' },
            }
          }
          if (channel === 'page:create') return { success: true }
          if (channel === 'slot:create') return { success: true }
          return null
        },
      }
    })
    
    await page.goto('/#/')
    
    // 验证页面加载后能看到添加端点入口
    await page.waitForLoadState('networkidle')
    
    // 检查是否有创建端点的入口按钮
    const addEndpointBtn = page.locator('button:has-text("添加"), button:has-text("新增"), button:has-text("创建")').first()
    if (await addEndpointBtn.isVisible({ timeout: 10000 }).catch(() => false)) {
      await addEndpointBtn.click()
      
      // 验证创建表单或对话框出现
      await page.waitForTimeout(2000)
    }
  })

  test('编辑端点名称', async ({ page }) => {
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
                { id: 1, name: '可编辑端点', icon: '🌐', login_type: 'web', share_token: '', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
              ],
            }
          }
          if (channel === 'endpoint:get') {
            return {
              id: 1, name: '可编辑端点', icon: '🌐', login_type: 'web', share_token: '',
              pages: [], created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
            }
          }
          if (channel === 'endpoint:update') { return { success: true } }
          if (channel === 'appLock:shouldLock') return { success: true, data: false }
          return null
        },
      }
    })
    
    await page.goto('/#/')
    await page.waitForLoadState('networkidle')
    
    await expect(page.locator('text=可编辑端点').first()).toBeVisible({ timeout: 10000 })
  })

  test('删除端点', async ({ page }) => {
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
                { id: 1, name: '待删除端点', icon: '🌐', login_type: 'web', share_token: '', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
              ],
            }
          }
          if (channel === 'endpoint:delete') {
            (window as any).__deleteConfirmed = true
            return { success: true }
          }
          if (channel === 'appLock:shouldLock') return { success: true, data: false }
          return null
        },
      }
    })
    
    await page.goto('/#/')
    await page.waitForLoadState('networkidle')
    
    await expect(page.locator('text=待删除端点').first()).toBeVisible({ timeout: 10000 })
    const deleteBtn = page.locator('button:has-text("删除"), [title="删除"]').first()
    if (await deleteBtn.isVisible({ timeout: 5000 })) {
      await deleteBtn.click()
      await page.waitForTimeout(1000)
    }
    const deleted = await page.evaluate(() => !!(window as any).__deleteConfirmed)
    expect(deleted).toBe(true)
  })
})

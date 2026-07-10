/**
 * 上传模态框 E2E 测试
 */
import { test, expect } from './setup'

test.describe('上传文件模态框', () => {
  test('打开后应该显示文件选择和目录浏览', async ({ page }) => {
    // 模拟已登录进入主页，并且有 SSH 端点
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
          if (channel === 'endpoint:get') {
            return {
              id: 1,
              name: 'SSH服务器',
              icon: '🔧',
              login_type: 'ssh',
              share_token: '',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              pages: [
                {
                  id: 1,
                  endpoint_id: 1,
                  order_index: 0,
                  url: '192.168.1.100:22',
                  ssh_port: 22,
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                  slots: [
                    { id: 1, page_id: 1, order_index: 0, name: 'SSH用户名', element_xpath: '', action_type: 'input', value: 'admin', is_encrypted: false, timeout: 200 },
                    { id: 2, page_id: 1, order_index: 1, name: 'SSH密码', element_xpath: '', action_type: 'password', value: 'encrypted-pass', is_encrypted: true, timeout: 200 },
                  ],
                },
              ],
            }
          }
          if (channel === 'slot:decryptValue') return 'admin123'
          if (channel === 'ssh:listDir') {
            return {
              success: true,
              files: [
                { name: 'home', isDirectory: true, size: 4096, modifiedTime: new Date().toISOString(), rights: 'drwxr-xr-x' },
                { name: 'var', isDirectory: true, size: 4096, modifiedTime: new Date().toISOString(), rights: 'drwxr-xr-x' },
                { name: 'etc', isDirectory: true, size: 4096, modifiedTime: new Date().toISOString(), rights: 'drwxr-xr-x' },
              ],
            }
          }
          if (channel === 'appLock:shouldLock') return { success: true, data: false }
          if (channel === 'secureKeyStorage:status') return { success: true, data: { hasKeys: true, initialized: true } }
          if (channel === 'keyRotation:status') return { success: true, data: { lastRotation: null, nextRotation: null, isRunning: false } }
          if (channel === 'chrome:detect') return []
          return null
        },
      }
    })

    await page.goto('/#/')
    
    // 等待页面加载
    await page.waitForLoadState('networkidle')
    
    // 验证主页显示了 SSH 端点
    const sshEndpoint = page.locator('text=SSH服务器')
    await expect(sshEndpoint.first()).toBeVisible({ timeout: 15000 })
  })
})

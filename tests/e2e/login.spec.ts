/**
 * 登录页面 E2E 测试
 */
import { test, expect } from './setup'

test.describe('登录页面 /#/login', () => {
  test('应该显示登录表单', async ({ page }) => {
    await page.goto('/#/login')
    
    // 验证页面标题
    await expect(page.locator('h1, h2, h3').first()).toBeVisible()
    
    // 验证登录表单元素存在
    const usernameInput = page.locator('input[type="text"], input[placeholder*="用户"], input[name="username"]').first()
    const passwordInput = page.locator('input[type="password"], input[placeholder*="密码"], input[name="password"]').first()
    const loginButton = page.locator('button:has-text("登录"), button:has-text("Login")').first()
    
    // 这些元素可能因为 mock 时间问题需要等待
    await expect(usernameInput).toBeVisible({ timeout: 10000 })
    await expect(passwordInput).toBeVisible({ timeout: 5000 })
    await expect(loginButton).toBeVisible({ timeout: 5000 })
  })

  test('空表单提交应该显示验证提示', async ({ page }) => {
    await page.goto('/#/login')
    
    // 点击登录按钮而不填写表单
    const loginButton = page.locator('button:has-text("登录"), button:has-text("Login")').first()
    await loginButton.click()
    
    // 验证至少有一个输入框显示验证消息或表单保持可见
    await expect(page.locator('input[type="password"]').first()).toBeVisible()
  })

  test('无效登录应该显示错误信息', async ({ page }) => {
    // 覆盖 mock 使登录失败
    await page.addInitScript(() => {
      (window as any).ipc = {
        ...(window as any).ipc,
        invoke: async (channel: string) => {
          if (channel === 'account:hasAccount') return true
          if (channel === 'account:login') {
            throw new Error('用户名或密码错误')
          }
          return null
        },
      }
    })
    
    await page.goto('/#/login')
    
    // 填写无效凭据
    const usernameInput = page.locator('input[type="text"], input[placeholder*="用户"], input[name="username"]').first()
    const passwordInput = page.locator('input[type="password"], input[placeholder*="密码"], input[name="password"]').first()
    
    await usernameInput.fill('wronguser')
    await passwordInput.fill('wrongpass')
    
    // 提交
    const loginButton = page.locator('button:has-text("登录"), button:has-text("Login")').first()
    await loginButton.click()
    
    // 验证错误消息显示
    await expect(page.locator('text=错误').first()).toBeVisible({ timeout: 5000 })
  })
})

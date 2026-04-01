/**
 * Win7 兼容版自动化服务
 * 
 * 使用 puppeteer 19.x 兼容 API（waitForXPath 等）
 * 此文件仅在 Win7 构建时替换 electron/backend/services/automation.ts
 * 
 * 注意：构建时此文件会被复制到 electron/backend/services/ 目录
 * 所以导入路径应该指向 electron/backend/services/ 目录下的模块
 */
import puppeteer from 'puppeteer-core'
import { getEndpoint } from '../electron/backend/services/endpoint'
import { hybridDecrypt, isHybridEncrypted } from '../electron/backend/crypto/hybrid'
import type { EndpointFull } from '../electron/backend/services/endpoint'

// 延时函数
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

// 执行登录自动化（Win7 兼容版）
export async function executeLogin(endpointId: number, chromePath: string): Promise<{ success: boolean; message: string }> {
  // 获取登录端完整数据
  const endpoint = getEndpoint(endpointId)
  console.log('[Automation] Get endpoint data:', endpointId, endpoint ? 'success' : 'not found')
  if (!endpoint) {
    throw new Error('Endpoint not found')
  }
  console.log('[Automation] Page count:', endpoint.pages.length)
  for (const p of endpoint.pages) {
    console.log('[Automation] Page:', p.url, 'slot count:', p.slots.length)
    for (const s of p.slots) {
      console.log('[Automation]   - Slot:', s.action_type, s.element_xpath)
    }
  }
  // 启动浏览器
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: false,
    defaultViewport: null,
    args: [
      '--start-maximized',
      '--disable-blink-features=AutomationControlled',
    ],
    ignoreDefaultArgs: ['--enable-automation'],
    ignoreHTTPSErrors: true,
  })

  try {
    // 获取页面
    const pages = await browser.pages()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let page: any = pages[0] || await browser.newPage()

    // 隐藏自动化特征
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false })
    })

    // 按顺序执行每个步骤页
    for (const pageData of endpoint.pages) {
      // 导航到页面
      if (pageData.url) {
        console.log('[Automation] Navigate to:', pageData.url)
        await page.goto(pageData.url, { waitUntil: 'networkidle0', timeout: 30000 })
      }

      // 执行操作
      for (const slot of pageData.slots) {
        try {
          console.log('[Automation] Execute slot:', slot.action_type, slot.element_xpath)
          
          // Win7 兼容：使用 waitForXPath（puppeteer 19.x API）
          const element = await page.waitForXPath(slot.element_xpath, { timeout: 10000 })
          
          if (!element) {
            console.error(`[Automation] Element not found: ${slot.element_xpath}`)
            continue
          }
          
          // 等待指定时间
          await delay(slot.timeout || 200)

          // 获取值（如果是加密的，需要解密）
          let value = slot.value
          if (slot.is_encrypted && value) {
            try {
              value = hybridDecrypt(value)
              console.log('[Automation] Decrypted value for input (length:', value.length, 'chars)')
            } catch {
              console.warn('Failed to decrypt value, using original')
            }
          }

          // 执行操作（Win7 兼容：使用 ElementHandle API）
          switch (slot.action_type) {
            case 'input':
              // 点击聚焦
              await element.click()
              // 清空并输入
              await element.evaluate((el: any) => { el.value = '' })
              await element.type(value, { delay: 50 })
              console.log('[Automation] Input completed (type:', slot.action_type, ', encrypted:', slot.is_encrypted, ')')
              break
            case 'click':
              await element.click()
              console.log('[Automation] Click completed')
              break
            case 'select':
              await element.select(value)
              console.log('[Automation] Select completed (encrypted:', slot.is_encrypted, ')')
              break
          }

        } catch (slotError: any) {
          console.error(`Slot execution failed [${slot.element_xpath}]:`, slotError.message)
          // 继续执行下一个操作
        }
      }

      // 每个步骤页之间等待一下
      await delay(500)
    }

    return { success: true, message: 'Login executed successfully' }
  } catch (error: any) {
    console.error('Login execution failed:', error)
    return { success: false, message: error.message }
  } finally {
    // 断开浏览器连接（不关闭，让用户继续操作）
    browser.disconnect()
  }
}

// 在 Webview 中执行登录（用于内置预览）
export async function executeLoginInWebview(endpoint: EndpointFull, webview: Electron.WebviewTag): Promise<void> {
  for (const pageData of endpoint.pages) {
    if (pageData.url) {
      webview.src = pageData.url
      await new Promise<void>(resolve => {
        const handler = () => {
          webview.removeEventListener('did-finish-load', handler)
          resolve()
        }
        webview.addEventListener('did-finish-load', handler)
      })
    }

    for (const slot of pageData.slots) {
      const xpath = slot.element_xpath
      const jsCode = `
        (function() {
          const result = document.evaluate('${xpath}', document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
          const element = result.singleNodeValue;
          if (element) {
            ${slot.action_type === 'input' ? `element.value = '${slot.value}'` : 
              slot.action_type === 'click' ? 'element.click()' : 
              `element.value = '${slot.value}'`}
          }
        })()
      `
      await webview.executeJavaScript(jsCode)
      await delay(slot.timeout || 200)
    }
  }
}
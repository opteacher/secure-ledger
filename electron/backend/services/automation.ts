import puppeteer from 'puppeteer-core'
import { getEndpoint } from './endpoint'
import { getMasterKey } from './account'
import { decrypt } from '../crypto'
import type { EndpointFull } from './endpoint'
import type { ElementHandle } from 'puppeteer-core'

// 延时函数
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

/**
 * 等待并获取 XPath 元素（兼容 puppeteer 19.x 和 22+）
 * 使用 any 类型以兼容不同版本的 API
 */
async function waitForXPath(page: any, xpath: string, timeout: number = 10000): Promise<ElementHandle | null> {
  // puppeteer 22+ 使用 locator API
  if (typeof page.locator === 'function') {
    try {
      const locator = page.locator(`xpath=${xpath}`)
      await locator.wait({ timeout })
      // locator API 后，使用 waitForSelector 或 evaluate 获取元素
      const elements = await page.$x(xpath)
      return elements[0] || null
    } catch {
      return null
    }
  }
  
  // puppeteer 19.x 使用 waitForXPath
  if (typeof page.waitForXPath === 'function') {
    try {
      const element = await page.waitForXPath(xpath, { timeout })
      return element
    } catch {
      return null
    }
  }
  
  // 降级方案：使用 waitForSelector 配合 xpath/ 前缀
  try {
    const selector = `xpath/${xpath}`
    await page.waitForSelector(selector, { timeout })
    const elements = await page.$x(xpath)
    return elements[0] || null
  } catch {
    return null
  }
}

/**
 * 输入文本（兼容 puppeteer 19.x 和 22+）
 */
async function fillElement(element: ElementHandle, value: string): Promise<void> {
  // 先点击聚焦，再清空，再输入
  await element.click()
  await element.focus()
  
  // 清空现有内容
  await element.evaluate((el: any) => {
    if (el.value !== undefined) {
      el.value = ''
    } else if (el.isContentEditable) {
      el.textContent = ''
    }
  })
  
  // 输入新值
  await element.type(value, { delay: 50 })
}

/**
 * 点击元素（兼容 puppeteer 19.x 和 22+）
 */
async function clickElement(element: ElementHandle): Promise<void> {
  await element.click()
}

/**
 * 选择下拉框选项（兼容 puppeteer 19.x 和 22+）
 */
async function selectElement(element: ElementHandle, value: string): Promise<void> {
  await element.select(value)
}

// 执行登录自动化
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
          
          // 使用兼容函数等待元素
          const element = await waitForXPath(page, slot.element_xpath, 10000)
          
          if (!element) {
            console.error(`[Automation] Element not found: ${slot.element_xpath}`)
            continue
          }
          
          // 等待指定时间
          await delay(slot.timeout || 200)

          // 获取值（如果是加密的，需要解密）
          let value = slot.value
          if (slot.is_encrypted) {
            try {
              const masterKey = getMasterKey('')
              value = decrypt(slot.value, masterKey)
            } catch {
              console.warn('Failed to decrypt value, using original')
            }
          }

          // 执行操作
          switch (slot.action_type) {
            case 'input':
              await fillElement(element, value)
              console.log('[Automation] Input completed:', value)
              break
            case 'click':
              await clickElement(element)
              console.log('[Automation] Click completed')
              break
            case 'select':
              await selectElement(element, value)
              console.log('[Automation] Select completed:', value)
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
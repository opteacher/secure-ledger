import { getEndpoint } from './endpoint'
import { getMasterKey } from './account'
import { decrypt } from '../crypto'
import { launchBrowser, analyzeBrowserForPuppeteer, type PuppeteerVersion } from './puppeteerManager'
import { getBrowserList } from './browser'
import type { EndpointFull } from './endpoint'

// 延时函数
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

// 执行登录自动化
export async function executeLogin(
  endpointId: number, 
  chromePath: string,
  puppeteerVersionOverride?: 'auto' | 'high' | 'low'
): Promise<{ success: boolean; message: string; puppeteerVersion?: PuppeteerVersion }> {
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
  
  // 获取浏览器的 Puppeteer 版本设置
  let userPreference: 'auto' | 'high' | 'low' = 'auto'
  if (puppeteerVersionOverride) {
    userPreference = puppeteerVersionOverride
  } else {
    // 从数据库获取用户配置
    const browsers = getBrowserList()
    const browserConfig = browsers.find(b => b.path === chromePath)
    if (browserConfig) {
      userPreference = browserConfig.puppeteer_version || 'auto'
    }
  }
  
  // 分析浏览器版本并决定使用的 Puppeteer 版本
  const analysis = analyzeBrowserForPuppeteer(chromePath, userPreference)
  console.log('[Automation] Browser analysis:', {
    version: analysis.versionInfo.version,
    majorVersion: analysis.versionInfo.majorVersion,
    puppeteerVersion: analysis.puppeteerVersion,
    decision: analysis.decision
  })
  
  // 使用 puppeteerManager 启动浏览器（自动选择合适的 Puppeteer 版本）
  const { browser, puppeteerVersion } = await launchBrowser(chromePath, userPreference, {
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
    let page = pages[0] || await browser.newPage()

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
          
          // 根据 Puppeteer 版本使用不同的 API
          if (puppeteerVersion === 'high') {
            // 高版本 Puppeteer (22.x) 使用 Locator API
            const locator = page.locator(`xpath=${slot.element_xpath}`)
            await locator.wait({ timeout: 10000 })
            
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
                await locator.fill(value)
                console.log('[Automation] Input completed:', value)
                break
              case 'click':
                await locator.click()
                console.log('[Automation] Click completed')
                break
              case 'select':
                await locator.select({ value })
                console.log('[Automation] Select completed:', value)
                break
            }
          } else {
            // 低版本 Puppeteer (13.x) 使用传统的 waitForXPath API
            // 返回 ElementHandle，可以使用 click(), type(), select() 等方法
            const element = await page.waitForXPath(slot.element_xpath, { timeout: 10000 })
            
            if (!element) {
              console.warn('[Automation] Element not found:', slot.element_xpath)
              continue
            }
            
            // 等待指定时间
            await delay(slot.timeout || 200)
            
            // 获取值
            let value = slot.value
            if (slot.is_encrypted) {
              try {
                const masterKey = getMasterKey('')
                value = decrypt(slot.value, masterKey)
              } catch {
                console.warn('Failed to decrypt value, using original')
              }
            }
            
            // 执行操作（使用 ElementHandle API）
            switch (slot.action_type) {
              case 'input':
                // 点击聚焦
                await element.click()
                // 清空并输入
                await element.evaluate((el: Element) => { (el as HTMLInputElement).value = '' })
                await element.type(value, { delay: 50 })
                console.log('[Automation] Input completed:', value)
                break
              case 'click':
                await element.click()
                console.log('[Automation] Click completed')
                break
              case 'select':
                await element.select(value)
                console.log('[Automation] Select completed:', value)
                break
            }
          }

        } catch (slotError: any) {
          console.error(`Slot execution failed [${slot.element_xpath}]:`, slotError.message)
          // 继续执行下一个操作
        }
      }

      // 每个步骤页之间等待一下
      await delay(500)
    }

    return { 
      success: true, 
      message: 'Login executed successfully',
      puppeteerVersion 
    }
  } catch (error: any) {
    console.error('Login execution failed:', error)
    return { 
      success: false, 
      message: error.message,
      puppeteerVersion 
    }
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
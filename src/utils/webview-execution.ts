/**
 * Webview 元素等待与操作执行 - 公共 helper
 *
 * 用于 Electron webview (executeJavaScript) 和后端 executeLoginInWebview。
 * 替代 Puppeteer 的 waitForXPath：在注入的 JS 中通过 Promise + setTimeout 轮询,
 * 直到元素出现或超时。
 *
 * 设计:
 * - 超时 30s（满足用户"至少 30 秒以上"要求）
 * - 轮询间隔 200ms
 * - XPath 通过 JSON.stringify 安全注入, 防止单引号破坏 JS 字符串
 * - 支持 input / click / select 三种 action_type
 * - input 触发 input 事件, 兼容 Vue/React 等框架
 * - 返回 Promise<boolean>, true=操作成功, false=超时未找到
 */

/** 等待元素出现的超时时间 (毫秒) */
export const ELEMENT_WAIT_TIMEOUT_MS = 30000

/** 轮询间隔 (毫秒) */
export const POLL_INTERVAL_MS = 200

export type WebviewActionType = 'input' | 'click' | 'select'

export interface WebviewSlotAction {
  xpath: string
  actionType: WebviewActionType
  value: string
}

/**
 * 构造注入 webview 的 JS 代码: 等待 XPath 元素出现后执行操作。
 *
 * 返回的 JS 字符串会被 webview.executeJavaScript 执行,
 * 执行结果为 Promise<boolean>:
 *   - true: 元素找到并操作完成
 *   - false: 超时未找到元素
 *
 * 注入的 JS 在 webview 上下文运行, 因此使用原生 DOM API。
 *
 * @param action 包含 xpath / actionType / value 的操作描述
 * @param timeoutMs 等待超时, 默认 30s
 * @returns 可被 executeJavaScript 直接执行的 JS 字符串
 */
export function buildWaitAndActJs(
  action: WebviewSlotAction,
  timeoutMs: number = ELEMENT_WAIT_TIMEOUT_MS,
): string {
  const xpathJson = JSON.stringify(action.xpath)
  const valueJson = JSON.stringify(action.value)
  const timeout = Math.max(1000, Math.floor(timeoutMs))
  const interval = POLL_INTERVAL_MS

  let actJs: string
  switch (action.actionType) {
    case 'input':
      // 清空 + 设置值 + 触发 input 事件 (兼容 Vue/React 双向绑定)
      actJs = `
        element.focus();
        element.value = ${valueJson};
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
      `
      break
    case 'click':
      actJs = `element.click();`
      break
    case 'select':
      actJs = `
        element.value = ${valueJson};
        element.dispatchEvent(new Event('change', { bubbles: true }));
      `
      break
    default:
      actJs = `/* unknown action_type: ${JSON.stringify(action.actionType)} */`
  }

  return ('(function() {' +
      '  return new Promise(function(resolve) {' +
      '    var xpath = ' + xpathJson + ';' +
      '    var maxWait = ' + timeout + ';' +
      '    var interval = ' + interval + ';' +
      '    var elapsed = 0;' +
      '    function tryFind() {' +
      '      var result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);' +
      '      var element = result.singleNodeValue;' +
      '      if (element) {' +
      '        try { ' + actJs + ' } catch (e) {}' +
      '        resolve(true);' +
      '      } else if ((elapsed += interval) >= maxWait) {' +
      '        resolve(false);' +
      '      } else {' +
      '        setTimeout(tryFind, interval);' +
      '      }' +
      '    }' +
      '    tryFind();' +
      '  });' +
      '})()')
}

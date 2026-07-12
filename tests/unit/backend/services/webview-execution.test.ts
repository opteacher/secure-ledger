import { describe, it, expect } from 'vitest'
import {
  buildWaitAndActJs,
  ELEMENT_WAIT_TIMEOUT_MS,
  POLL_INTERVAL_MS,
  type WebviewActionType,
} from '../../../../electron/backend/services/webview-execution'

describe('webview-execution: buildWaitAndActJs', () => {
  describe('ELEMENT_WAIT_TIMEOUT_MS 常量', () => {
    it('ELEMENT_WAIT_TIMEOUT_MS 等于 30000ms (用户要求 ≥ 30s)', () => {
      expect(ELEMENT_WAIT_TIMEOUT_MS).toBe(30000)
    })

    it('POLL_INTERVAL_MS 等于 200ms', () => {
      expect(POLL_INTERVAL_MS).toBe(200)
    })
  })

  describe('基础结构', () => {
    it('返回的 JS 是 IIFE 包裹 Promise', () => {
      const js = buildWaitAndActJs({ xpath: '//div', actionType: 'click', value: '' })
      expect(js).toContain('new Promise')
      expect(js).toContain('function()')
      expect(js.trim()).toMatch(/^\(function/)
    })

    it('注入 document.evaluate + XPathResult.FIRST_ORDERED_NODE_TYPE', () => {
      const js = buildWaitAndActJs({ xpath: '//div', actionType: 'click', value: '' })
      expect(js).toContain('document.evaluate(')
      expect(js).toContain('XPathResult.FIRST_ORDERED_NODE_TYPE')
    })

    it('包含 resolve(true) 用于元素找到分支', () => {
      const js = buildWaitAndActJs({ xpath: '//div', actionType: 'click', value: '' })
      expect(js).toContain('resolve(true);')
    })

    it('包含 resolve(false) 用于超时分支', () => {
      const js = buildWaitAndActJs({ xpath: '//div', actionType: 'click', value: '' })
      expect(js).toContain('resolve(false);')
    })

    it('默认使用 ELEMENT_WAIT_TIMEOUT_MS 超时 (30000)', () => {
      const js = buildWaitAndActJs({ xpath: '//div', actionType: 'click', value: '' })
      expect(js).toContain('30000')
    })

    it('可显式传入 timeoutMs 参数覆盖默认值', () => {
      const js = buildWaitAndActJs({ xpath: '//div', actionType: 'click', value: '' }, 5000)
      expect(js).toContain('5000')
      expect(js).not.toContain('30000')
    })

    it('timeout 小于 1000ms 时被提升到 1000ms (避免过短超时)', () => {
      const js = buildWaitAndActJs({ xpath: '//div', actionType: 'click', value: '' }, 100)
      expect(js).toContain('1000')
      expect(js).not.toContain(' 100 ')
    })

    it('使用 POLL_INTERVAL_MS 200ms 作为轮询间隔', () => {
      const js = buildWaitAndActJs({ xpath: '//div', actionType: 'click', value: '' })
      expect(js).toContain('200')
    })
  })

  describe('action_type=input', () => {
    const xpath = '//input[@name="user"]'
    const value = 'alice'
    const js = buildWaitAndActJs({ xpath, actionType: 'input', value })

    it('注入 element.focus() 准备输入', () => {
      expect(js).toContain('element.focus()')
    })

    it('注入 element.value = <valueJson>', () => {
      expect(js).toContain('element.value = "alice"')
    })

    it('触发 input 事件 (bubbles)', () => {
      expect(js).toContain("new Event('input', { bubbles: true })")
    })

    it('触发 change 事件 (bubbles)', () => {
      expect(js).toContain("new Event('change', { bubbles: true })")
    })
  })

  describe('action_type=click', () => {
    const js = buildWaitAndActJs({ xpath: '//button', actionType: 'click', value: '' })

    it('注入 element.click()', () => {
      expect(js).toContain('element.click();')
    })

    it('click 不注入 element.value =', () => {
      expect(js).not.toContain('element.value = ')
    })
  })

  describe('action_type=select', () => {
    const js = buildWaitAndActJs({ xpath: '//select', actionType: 'select', value: 'option1' })

    it('注入 element.value = <valueJson>', () => {
      expect(js).toContain('element.value = "option1"')
    })

    it('触发 change 事件 (bubbles)', () => {
      expect(js).toContain("new Event('change', { bubbles: true })")
    })

    it('select 不触发 input 事件 (与 input 不同)', () => {
      expect(js).not.toContain("new Event('input'")
    })
  })
})

describe('action_type=captcha', () => {
  it('生成 console.warn 包含 output_key', () => {
    const js = buildWaitAndActJs({ xpath: '//img[@id="captcha"]', actionType: 'captcha', value: '', outputKey: 'code' })
    expect(js).toContain('console.warn')
    expect(js).toContain('[captcha]')
    expect(js).toContain('code')
  })

  it('不包含 element.click / element.value 等操作', () => {
    const js = buildWaitAndActJs({ xpath: '//img', actionType: 'captcha', value: '' })
    expect(js).not.toContain('element.click')
    expect(js).not.toContain('element.value')
    expect(js).not.toContain('element.focus')
  })

  it('outputKey 为空字符串时仍生成合法 JS', () => {
    const js = buildWaitAndActJs({ xpath: '//img', actionType: 'captcha', value: '', outputKey: '' })
    expect(() => new Function(js)).not.toThrow()
  })
})

describe('webview-execution: buildWaitAndActJs XSS 防护', () => {
  it('XPath 含单引号时安全转义 (JSON.stringify 包裹)', () => {
    const xpath = `//input[@value='O'Brien']`
    const js = buildWaitAndActJs({ xpath, actionType: 'click', value: '' })
    expect(() => new Function(js)).not.toThrow()
    expect(js).toContain(JSON.stringify(xpath))
  })

  it('XPath 含双引号时安全转义', () => {
    const xpath = `//input[@value="say \"hi\""]`
    const js = buildWaitAndActJs({ xpath, actionType: 'click', value: '' })
    expect(() => new Function(js)).not.toThrow()
  })

  it('XPath 含反斜杠时安全转义', () => {
    const xpath = `//input[@data='a\\b']`
    const js = buildWaitAndActJs({ xpath, actionType: 'click', value: '' })
    expect(() => new Function(js)).not.toThrow()
  })

  it('Value 含单引号时安全转义', () => {
    const js = buildWaitAndActJs({
      xpath: '//input',
      actionType: 'input',
      value: `O'Brien's "quote"`,
    })
    expect(() => new Function(js)).not.toThrow()
    expect(js).toContain(JSON.stringify(`O'Brien's "quote"`))
  })

  it('Value 含换行符时安全转义', () => {
    const js = buildWaitAndActJs({
      xpath: '//textarea',
      actionType: 'input',
      value: 'line1\nline2',
    })
    expect(() => new Function(js)).not.toThrow()
  })

  it('Value 含反斜杠时安全转义', () => {
    const js = buildWaitAndActJs({
      xpath: '//input',
      actionType: 'input',
      value: 'back\\slash',
    })
    expect(() => new Function(js)).not.toThrow()
  })

  it('XPath 含恶意 JS 代码片段 (注入尝试) 时被字符串字面量隔离', () => {
    const malicious = `'; alert('xss'); var x = '`
    const js = buildWaitAndActJs({
      xpath: malicious,
      actionType: 'click',
      value: '',
    })
    expect(() => new Function(js)).not.toThrow()
    expect(js).toContain(JSON.stringify(malicious))
  })
})

describe('webview-execution: buildWaitAndActJs 轮询循环', () => {
  it('包含 setTimeout 递归轮询调用', () => {
    const js = buildWaitAndActJs({ xpath: '//div', actionType: 'click', value: '' })
    expect(js).toContain('setTimeout(tryFind')
    expect(js).toMatch(/function tryFind[\s\S]*setTimeout\(tryFind,/)
  })

  it('elapsed 累加 POLL_INTERVAL_MS', () => {
    const js = buildWaitAndActJs({ xpath: '//div', actionType: 'click', value: '' })
    expect(js).toContain('elapsed += interval')
  })

  it('elapsed >= maxWait 时调用 resolve(false)', () => {
    const js = buildWaitAndActJs({ xpath: '//div', actionType: 'click', value: '' })
    expect(js).toMatch(/else if \(\(elapsed \+= interval\) >= maxWait\) \{[\s\S]*resolve\(false\)/)
  })

  it('元素操作异常时仍 resolve(true) (操作错误由调用方处理)', () => {
    const js = buildWaitAndActJs({ xpath: '//div', actionType: 'click', value: '' })
    expect(js).toMatch(/try \{[\s\S]*\} catch \(e\) \{[\s\S]*\}\s*resolve\(true\)/)
  })
})
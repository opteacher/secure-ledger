import { describe, it, expect } from 'vitest'
import {
  buildWaitAndActJs,
  ELEMENT_WAIT_TIMEOUT_MS,
  POLL_INTERVAL_MS,
  type WebviewActionType,
} from '@/utils/webview-execution'

describe('webview-execution (frontend): buildWaitAndActJs', () => {
  it('ELEMENT_WAIT_TIMEOUT_MS 满足用户要求 ≥ 30s', () => {
    expect(ELEMENT_WAIT_TIMEOUT_MS).toBeGreaterThanOrEqual(30000)
  })

  it('POLL_INTERVAL_MS 等于 200', () => {
    expect(POLL_INTERVAL_MS).toBe(200)
  })

  it('action=input 注入 focus + value + dispatchEvent', () => {
    const js = buildWaitAndActJs({ xpath: '//input', actionType: 'input', value: 'hi' })
    expect(js).toContain('element.focus()')
    expect(js).toContain('"hi"')
    expect(js).toContain("new Event('input'")
    expect(js).toContain("new Event('change'")
  })

  it('action=click 注入 element.click()', () => {
    const js = buildWaitAndActJs({ xpath: '//button', actionType: 'click', value: '' })
    expect(js).toContain('element.click();')
  })

  it('action=select 注入 value + change 事件', () => {
    const js = buildWaitAndActJs({ xpath: '//select', actionType: 'select', value: 'opt1' })
    expect(js).toContain('"opt1"')
    expect(js).toContain("new Event('change'")
    expect(js).not.toContain("new Event('input'")
  })

  it('默认使用 30s 超时', () => {
    const js = buildWaitAndActJs({ xpath: '//x', actionType: 'click', value: '' })
    expect(js).toContain('30000')
  })

  it('XPath 通过 JSON.stringify 安全注入 (含单引号的 xpath 不破坏 JS)', () => {
    const xpath = `//input[@value='O'Brien']`
    const js = buildWaitAndActJs({ xpath, actionType: 'click', value: '' })
    expect(() => new Function(js)).not.toThrow()
    expect(js).toContain(JSON.stringify(xpath))
  })

  it('Value 通过 JSON.stringify 安全注入', () => {
    const js = buildWaitAndActJs({
      xpath: '//input',
      actionType: 'input',
      value: `O'Brien "with" quotes`,
    })
    expect(() => new Function(js)).not.toThrow()
  })

  it('私有 actionType 走 default 分支不抛错', () => {
    const js = buildWaitAndActJs({
      xpath: '//x',
      actionType: ('unknown' as unknown as WebviewActionType),
      value: '',
    })
    expect(() => new Function(js)).not.toThrow()
    expect(js).toContain('unknown action_type')
  })

  it('可执行的 JS 在 jsdom 中模拟运行: element.evaluate mock 返回元素立即 resolve(true)', async () => {
    document.body.innerHTML = '<button id="btn">click</button>'
    const btn = document.getElementById('btn') as HTMLButtonElement
    const evaluateSpy = vi.spyOn(document, 'evaluate').mockReturnValue({
      singleNodeValue: btn as Node,
      iterateNext: () => null,
      snapshotLength: 1,
      snapshotItem: () => null,
      invalidType: 0,
      anyType: 0,
      numberType: 1,
      stringType: 2,
      booleanType: 3,
      unorderedNodeIteratorType: 4,
      orderedNodeIteratorType: 5,
      unorderedNodeSnapshotType: 6,
      orderedNodeSnapshotType: 7,
      anyUnorderedNodeType: 8,
      firstOrderedNodeType: 9,
      resultType: 9,
    } as unknown as XPathResult)

    const js = buildWaitAndActJs({ xpath: '//button[@id="btn"]', actionType: 'click', value: '' })
    const fn = new Function('return ' + js) as () => Promise<boolean>
    const result = await fn()
    expect(result).toBe(true)
    expect(evaluateSpy).toHaveBeenCalled()
    evaluateSpy.mockRestore()
  })

  it('可执行的 JS 在 jsdom 中模拟运行 input 操作: 设置值并触发事件', async () => {
    document.body.innerHTML = '<input id="user" type="text" />'
    const inputEl = document.getElementById('user') as HTMLInputElement
    let inputEventCount = 0
    inputEl.addEventListener('input', () => { inputEventCount++ })
    const evaluateSpy = vi.spyOn(document, 'evaluate').mockReturnValue({
      singleNodeValue: inputEl as Node,
    } as unknown as XPathResult)

    const js = buildWaitAndActJs({
      xpath: '//input[@id="user"]',
      actionType: 'input',
      value: 'alice',
    })
    const fn = new Function('return ' + js) as () => Promise<boolean>
    const ok = await fn()
    expect(ok).toBe(true)
    expect(inputEl.value).toBe('alice')
    expect(inputEventCount).toBeGreaterThan(0)
    evaluateSpy.mockRestore()
  })

  it('可执行的 JS 在 jsdom 中模拟运行: element 未找到时 setTimeout 后 resolve(false)', async () => {
    document.body.innerHTML = '<div>empty</div>'
    vi.useFakeTimers()
    const evaluateSpy = vi.spyOn(document, 'evaluate').mockReturnValue({
      singleNodeValue: null,
    } as unknown as XPathResult)

    const js = buildWaitAndActJs({ xpath: '//nonexistent', actionType: 'click', value: '' }, 1000)
    const fn = new Function('return ' + js) as () => Promise<boolean>
    const promise = fn()
    await vi.advanceTimersByTimeAsync(1200)
    const result = await promise
    expect(result).toBe(false)
    vi.useRealTimers()
    evaluateSpy.mockRestore()
  })

  it('可执行的 JS 元素操作抛错时仍 resolve(true)', async () => {
    document.body.innerHTML = '<button id="btn">x</button>'
    const btn = document.getElementById('btn') as HTMLButtonElement
    const origClick = btn.click
    btn.click = function () {
      throw new Error('mock click throw')
    } as typeof origClick

    const evaluateSpy = vi.spyOn(document, 'evaluate').mockReturnValue({
      singleNodeValue: btn as Node,
    } as unknown as XPathResult)

    const js = buildWaitAndActJs({ xpath: '//button[@id="btn"]', actionType: 'click', value: '' })
    const fn = new Function('return ' + js) as () => Promise<boolean>
    const ok = await fn()
    expect(ok).toBe(true)

    btn.click = origClick
    evaluateSpy.mockRestore()
  })
})
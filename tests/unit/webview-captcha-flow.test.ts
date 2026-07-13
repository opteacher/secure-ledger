/**
 * Webview 执行流程测试 — captcha → varStore → {{key}} 解析
 *
 * 模拟 EndpointEdit.vue executePages() 中的 captcha 捕获 + 模板变量替换全链路。
 * 参考 Puppeteer 自动化流程验证 webview 路径行为一致性。
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { createVarStore, resolveTemplateVars } from '../../electron/backend/services/templateVars'

// ============================================================
// 前端内联版本 — 与 EndpointEdit.vue line ~999 逐字一致
// ============================================================
function frontendResolveTemplateVars(input: string | null, varStore: Map<string, string>): string {
  if (!input) return ''
  return input.replace(/\{\{(\w+)\}\}/g, (_: string, key: string) => {
    const val = varStore.get(key)
    return val !== undefined ? val : `{{${key}}}`
  })
}

// ============================================================
// 模拟 captcha 识别流程
// ============================================================
interface CaptchaStep {
  xpath: string
  output_key?: string
}

interface InputStep {
  xpath: string
  value: string
}

interface ExecutionContext {
  varStore: Map<string, string>
  captchaResults: Map<string, string> // xpath → recognized text
  executedInputs: Array<{ xpath: string; resolvedValue: string }>
}

function createMockContext(): ExecutionContext {
  return {
    varStore: new Map(),
    captchaResults: new Map(),
    executedInputs: [],
  }
}

/** 模拟 captcha 识别（canvas capture → OCR → varStore.set） */
async function mockCaptchaStep(
  ctx: ExecutionContext,
  slot: CaptchaStep,
  mockRecognize: (xpath: string) => Promise<string>,
): Promise<void> {
  const text = await mockRecognize(slot.xpath)
  if (slot.output_key) {
    ctx.varStore.set(slot.output_key, text)
    console.log(`[test] Captcha recognized: "${text}", output_key=${slot.output_key}`)
  }
}

/** 模拟 input 步骤（decrypt → resolveTemplateVars → execute） */
function mockInputStep(ctx: ExecutionContext, slot: InputStep, afterResolve?: (xpath: string, val: string) => void): void {
  // decrypt (mock: pass-through)
  let value: string = slot.value

  // resolve template vars (frontend inline version)
  value = frontendResolveTemplateVars(value, ctx.varStore)

  // record
  ctx.executedInputs.push({ xpath: slot.xpath, resolvedValue: value })
  afterResolve?.(slot.xpath, value)
}

// ============================================================
// Tests
// ============================================================
describe('Webview Execution Flow', () => {
  describe('frontendResolveTemplateVars — 与后端 resolveTemplateVars 等价', () => {
    it('解析 {{key}} 为对应值', () => {
      const store = new Map([['result', 'ABC123']])
      expect(frontendResolveTemplateVars('{{result}}', store)).toBe('ABC123')
    })

    it('未知键保留字面量 {{key}}', () => {
      const store = new Map<string, string>()
      expect(frontendResolveTemplateVars('{{unknown}}', store)).toBe('{{unknown}}')
    })

    it('多个变量同时解析', () => {
      const store = new Map([['a', '1'], ['b', '2']])
      expect(frontendResolveTemplateVars('{{a}}-{{b}}', store)).toBe('1-2')
    })

    it('null input 返回空字符串', () => {
      expect(frontendResolveTemplateVars(null, new Map())).toBe('')
    })

    it('空字符串返回空字符串', () => {
      expect(frontendResolveTemplateVars('', new Map())).toBe('')
    })

    it('部分变量已知部分未知', () => {
      const store = new Map([['known', 'yes']])
      expect(frontendResolveTemplateVars('{{known}}-{{unknown}}', store)).toBe('yes-{{unknown}}')
    })

    it('与后端 resolveTemplateVars 行为完全一致', () => {
      const store = new Map([['k', 'v']])
      const backendStore = createVarStore()
      backendStore.set('k', 'v')

      const testCases = ['{{k}}', '{{unknown}}', '', 'plain text', '{{k}}-{{unknown}}', null]
      for (const input of testCases) {
        const frontend = frontendResolveTemplateVars(input as string | null, store)
        const backend = resolveTemplateVars(input as string | null, backendStore)
        expect(frontend).toBe(backend)
      }
    })
  })

  describe('captcha → varStore → input 全链路', () => {
    let ctx: ExecutionContext

    beforeEach(() => {
      ctx = createMockContext()
    })

    it('captcha 识别后 input 步骤成功解析 {{key}}', async () => {
      // Step 1: captcha 识别 captcha 图片，output_key="result"
      await mockCaptchaStep(ctx, { xpath: '//img[@id="captcha"]', output_key: 'result' }, async () => 'X9F2K')
      expect(ctx.varStore.get('result')).toBe('X9F2K')

      // Step 2: input 步骤，value="{{result}}"
      mockInputStep(ctx, { xpath: '//input[@name="code"]', value: '{{result}}' })
      expect(ctx.executedInputs[0].resolvedValue).toBe('X9F2K')
    })

    it('captcha 识别为空字符串时 input 正确得到空值', async () => {
      await mockCaptchaStep(ctx, { xpath: '//img[@id="captcha"]', output_key: 'result' }, async () => '')
      expect(ctx.varStore.get('result')).toBe('')

      mockInputStep(ctx, { xpath: '//input[@name="code"]', value: '{{result}}' })
      // 空字符串 !== undefined，所以应该被解析为空字符串
      expect(ctx.executedInputs[0].resolvedValue).toBe('')
    })

    it('captcha 失败（OCR 抛出异常）时 input 保留 {{key}} 字面量', async () => {
      // captcha step fails
      try {
        await mockCaptchaStep(ctx, { xpath: '//img[@id="captcha"]', output_key: 'result' }, async () => {
          throw new Error('OCR failed')
        })
      } catch {
        // expected
      }
      expect(ctx.varStore.has('result')).toBe(false)

      mockInputStep(ctx, { xpath: '//input[@name="code"]', value: '{{result}}' })
      expect(ctx.executedInputs[0].resolvedValue).toBe('{{result}}')
    })

    it('多个 captcha + input 步骤交叉执行', async () => {
      await mockCaptchaStep(ctx, { xpath: '//img#c1', output_key: 'c1' }, async () => 'AAA')
      mockInputStep(ctx, { xpath: '//input#i1', value: '{{c1}}' })
      expect(ctx.executedInputs[0].resolvedValue).toBe('AAA')

      await mockCaptchaStep(ctx, { xpath: '//img#c2', output_key: 'c2' }, async () => 'BBB')
      mockInputStep(ctx, { xpath: '//input#i2', value: '{{c1}}-{{c2}}' })
      expect(ctx.executedInputs[1].resolvedValue).toBe('AAA-BBB')
    })

    it('input value 为 null 时不崩溃', () => {
      mockInputStep(ctx, { xpath: '//input#click-only', value: null as any })
      // click-type slots have null value — should resolve to empty string, not crash
      expect(ctx.executedInputs[0].resolvedValue).toBe('')
    })

    it('混合文本和模板变量', () => {
      const store = ctx.varStore
      store.set('user', 'admin')
      mockInputStep(ctx, { xpath: '//input', value: 'Hello {{user}}!' })
      expect(ctx.executedInputs[0].resolvedValue).toBe('Hello admin!')
    })
  })

  describe('xpath 注入安全性（JSON.stringify）', () => {
    it('含单引号的 xpath 不破坏 JS 字符串', () => {
      const xpath = "//*[@id='captcha']"
      const json = JSON.stringify(xpath)
      expect(json).toBe('"//*[@id=\'captcha\']"')
      // 在 JS 中 evaluate 应能正常工作
      const parsed = JSON.parse(json)
      expect(parsed).toBe(xpath)
    })

    it('含双引号的 xpath 不破坏 JSON', () => {
      const xpath = '//*[@id="captcha"]'
      const json = JSON.stringify(xpath)
      expect(json).toBe('"//*[@id=\\"captcha\\"]"')
      const parsed = JSON.parse(json)
      expect(parsed).toBe(xpath)
    })
  })
})

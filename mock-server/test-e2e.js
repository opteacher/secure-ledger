/**
 * 完整端到端测试 — 模拟 webview 验证码识别 + 模板变量替换全链路
 * 
 * 流程:
 *   1. 从 mock server 获取验证码图片
 *   2. 模拟 webview canvas 截图转 base64
 *   3. 使用 tesseract.js + file:// langPath (同 captcha.ts 配置)
 *   4. OCR 识别验证码
 *   5. 模板变量 {{result}} → 实际值
 *   6. 模拟完整的 login 请求验证
 */
const http = require('http')
const { createWorker } = require('tesseract.js')
const path = require('path')
const { existsSync } = require('fs')
const { resolve } = require('path')

const TESSSDATA_DIR = resolve(__dirname, '../resources/tessdata')
const WORKER_SCRIPT = resolve(__dirname, '../node_modules/tesseract.js/src/worker-script/node/index.js')

// ---- 同 captcha.ts 的 toFileUrl 逻辑 ----
function toFileUrl(dirPath) {
  return 'file://' + dirPath.replace(/\\/g, '/').replace(/^([A-Za-z]):/, '/$1:')
}
const langPath = toFileUrl(TESSSDATA_DIR)

console.log('=== E2E Captcha Test ===')
console.log('langPath:', langPath)
console.log('workerPath:', WORKER_SCRIPT)

// ---- 同 EndpointEdit.vue 的模板变量解析 ----
function resolveTemplateVars(input, varStore) {
  if (!input) return ''
  return input.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const val = varStore.get(key)
    return val !== undefined ? val : `{{${key}}}`
  })
}

async function fetchCaptcha() {
  return new Promise((resolve, reject) => {
    http.get('http://localhost:3456/captcha?v=e2e', (res) => {
      const chunks = []
      res.on('data', chunk => chunks.push(chunk))
      res.on('end', () => resolve(Buffer.concat(chunks)))
    }).on('error', reject)
  })
}

async function mockLogin(username, password, captchaText) {
  return new Promise((resolve, reject) => {
    const body = new URLSearchParams({ username, password, captcha: captchaText, captcha_id: 'e2e' }).toString()
    const req = http.request('http://localhost:3456/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    }, (res) => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        if (res.statusCode === 302) {
          resolve({ success: true, redirect: res.headers.location })
        } else {
          try { resolve(JSON.parse(data)) } catch { resolve({ success: false, raw: data }) }
        }
      })
    })
    req.on('error', reject)
    req.write(body)
    req.end()
  })
}

async function main() {
  // Step 1: 模拟 webview 截图 → base64 (同 EndpointEdit.vue canvas 捕获)
  console.log('\n[Step 1] 获取验证码 (模拟 webview canvas 截图)...')
  const imgBuffer = await fetchCaptcha()
  const base64 = imgBuffer.toString('base64')
  console.log('[Step 1] 图片大小:', imgBuffer.length, 'bytes, base64 长度:', base64.length)

  // Step 2: 模拟 captchaApi.recognize() → IPC → captchaService.recognize()
  console.log('\n[Step 2] 创建 Tesseract worker (同 captcha.ts 配置)...')
  const worker = await createWorker('eng', 1, {
    langPath,        // file:// URL ← 关键修复
    workerPath: WORKER_SCRIPT,
    cacheMethod: 'readOnly',
    gzip: false,
  })
  console.log('[Step 2] Worker 创建成功')

  console.log('\n[Step 3] OCR 识别...')
  const { data } = await worker.recognize(imgBuffer)
  const rawText = data.text || ''
  const captchaText = rawText.trim().replace(/[^A-Za-z0-9]/g, '')
  console.log('[Step 3] 原始识别:', JSON.stringify(rawText))
  console.log('[Step 3] 清洗后:', JSON.stringify(captchaText))
  console.log('[Step 3] 置信度:', data.confidence, '%')

  await worker.terminate()

  // Step 4: 模拟模板变量替换 (同 EndpointEdit.vue 的 {{result}} → 实际值)
  console.log('\n[Step 4] 模板变量替换...')
  const varStore = new Map()
  varStore.set('result', captchaText)
  
  const slotValue = '{{result}}'
  const resolved = resolveTemplateVars(slotValue, varStore)
  console.log('[Step 4] 输入值: "' + slotValue + '"')
  console.log('[Step 4] 解析后: "' + resolved + '"')
  console.log('[Step 4] 匹配:', resolved === captchaText ? '✓ PASS' : '✗ FAIL')

  // Step 5: 模拟完整登录
  console.log('\n[Step 5] 模拟登录请求...')
  const loginResult = await mockLogin('admin', 'admin123', captchaText)
  console.log('[Step 5] 登录结果:', JSON.stringify(loginResult))
  
  // Final verdict
  const allPass = captchaText.length > 0 && resolved === captchaText && loginResult.success
  console.log('\n' + '='.repeat(50))
  if (allPass) {
    console.log('✓ 全链路测试通过')
    console.log('  验证码识别 → varStore 存储 → {{result}} 解析 → 登录成功')
  } else {
    console.log('✗ 测试失败')
  }
  console.log('='.repeat(50))
  
  process.exit(allPass ? 0 : 1)
}

main().catch(err => {
  console.error('\n✗ 测试崩溃:', err.message)
  process.exit(1)
})

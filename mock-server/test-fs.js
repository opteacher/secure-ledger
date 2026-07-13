/**
 * E2E 测试 — FS 模式 (initWorkerWithFSWrite 路径，绕过 node-fetch)
 */
const http = require('http')
const { createWorker } = require('tesseract.js')
const path = require('path')
const { existsSync, readFileSync } = require('fs')

const TESSSDATA_DIR = path.resolve(__dirname, '../resources/tessdata')
const WORKER_SCRIPT = path.resolve(__dirname, '../node_modules/tesseract.js/src/worker-script/node/index.js')
const TRAINEDDATA = path.join(TESSSDATA_DIR, 'eng.traineddata')

function resolveVars(input, varStore) {
  if (!input) return ''
  return input.replace(/\{\{(\w+)\}\}/g, (_, k) => varStore.get(k) ?? `{{${k}}}`)
}

async function main() {
  // 1. 获取验证码
  const imgBuffer = await new Promise((resolve, reject) => {
    http.get('http://localhost:3456/captcha?v=fs', (res) => {
      const chunks = []
      res.on('data', c => chunks.push(c))
      res.on('end', () => resolve(Buffer.concat(chunks)))
    }).on('error', reject)
  })
  console.log('[1] Captcha fetched:', imgBuffer.length, 'bytes')

  // 2. 创建 worker (FS 模式 — 同 captcha.ts initWorkerWithFSWrite)
  console.log('[2] Creating worker (FS mode)...')
  const worker = await createWorker([], 1, {
    workerPath: WORKER_SCRIPT,
    cacheMethod: 'readOnly',
  })
  const traineddata = readFileSync(TRAINEDDATA)
  await worker.FS('writeFile', ['eng.traineddata', traineddata])
  await worker.reinitialize('eng', 1)
  console.log('[2] Worker ready')

  // 3. OCR
  console.log('[3] Recognizing...')
  const { data } = await worker.recognize(imgBuffer)
  const text = (data.text || '').trim().replace(/[^A-Za-z0-9]/g, '')
  console.log('[3] Raw:', JSON.stringify(data.text), 'Clean:', JSON.stringify(text), 'Confidence:', data.confidence)
  await worker.terminate()

  // 4. 模板变量
  const store = new Map([['result', text]])
  const r = resolveVars('{{result}}', store)
  console.log('[4] {{result}} →', JSON.stringify(r), r === text ? '✓' : '✗')

  // 5. 登录
  const body = new URLSearchParams({ username: 'admin', password: 'admin123', captcha: text, captcha_id: 'fs' }).toString()
  const loginResult = await new Promise((resolve, reject) => {
    const req = http.request('http://localhost:3456/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    }, (res) => {
      let d = ''
      res.on('data', c => d += c)
      res.on('end', () => resolve(res.statusCode === 302 ? { ok: true, redirect: res.headers.location } : JSON.parse(d || '{}')))
    })
    req.on('error', reject)
    req.write(body)
    req.end()
  })
  console.log('[5] Login:', JSON.stringify(loginResult))

  const pass = text.length > 0 && r === text && loginResult.ok
  console.log('\n' + '='.repeat(40))
  console.log(pass ? '✓ E2E PASS' : '✗ E2E FAIL')
  console.log('='.repeat(40))
  process.exit(pass ? 0 : 1)
}

main().catch(e => { console.error(e); process.exit(1) })

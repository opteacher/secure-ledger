/**
 * E2E: 便携 Python + muggle_ocr 验证码识别端到端测试
 * 
 * 前提: resources/python-runtime/python.exe 已部署（npm run setup-python）
 * 用法: node mock-server/test-muggle.js
 */
const http = require('http')
const { execFileSync } = require('child_process')
const { resolve } = require('path')
const { existsSync } = require('fs')

const PYTHON = resolve(__dirname, '../resources/python-runtime/python.exe')
const MUGGLE_SCRIPT = resolve(__dirname, '../resources/python/muggleOCR.py')

function checkRuntime() {
  if (!existsSync(PYTHON)) {
    console.log('SKIP: Portable runtime not deployed at', PYTHON)
    process.exit(0)
  }
  if (!existsSync(MUGGLE_SCRIPT)) {
    console.log('SKIP: muggleOCR.py not found at', MUGGLE_SCRIPT)
    process.exit(0)
  }
}

async function main() {
  checkRuntime()

  // 1. 获取验证码
  console.log('[1] Fetching captcha...')
  const imgBuffer = await new Promise((res, rej) => {
    http.get('http://localhost:3456/captcha?v=muggle', (resp) => {
      const c = []; resp.on('data', d => c.push(d)); resp.on('end', () => res(Buffer.concat(c)))
    }).on('error', rej)
  })
  console.log('[1] Done:', imgBuffer.length, 'bytes')

  // 2. 写临时文件 → 调 muggleOCR.py
  const { writeFileSync, unlinkSync } = require('fs')
  const { tmpdir } = require('os')
  const tmpFile = resolve(tmpdir(), 'muggle_test_' + Date.now() + '.png')
  writeFileSync(tmpFile, imgBuffer)

  console.log('[2] Calling muggle_ocr via Python...')
  const output = execFileSync(PYTHON, [MUGGLE_SCRIPT, tmpFile], {
    encoding: 'utf-8', timeout: 15000, stdio: ['ignore', 'pipe', 'pipe']
  })
  unlinkSync(tmpFile)

  const codeIdx = output.indexOf('[|code|]')
  if (codeIdx === -1) {
    console.log('FAIL: output parse error:', output.trim())
    process.exit(1)
  }
  const text = output.slice(codeIdx + '[|code|]'.length).split('\n')[0].trim()
  console.log('[2] Recognized:', JSON.stringify(text))

  // 3. 模板变量替换
  const store = new Map([['result', text]])
  const resolved = '{{result}}'.replace(/\{\{(\w+)\}\}/g, (_, k) => store.get(k) ?? `{{${k}}}`)
  console.log('[3] {{result}} ->', JSON.stringify(resolved), resolved === text ? '✓' : '✗')

  // 4. 模拟登录
  const body = new URLSearchParams({ username: 'admin', password: 'admin123', captcha: text, captcha_id: 'muggle' }).toString()
  const loginResult = await new Promise((res, rej) => {
    const req = http.request('http://localhost:3456/login', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    }, (resp) => {
      let d = ''; resp.on('data', c => d += c); resp.on('end', () => res(resp.statusCode === 302 ? { ok: true } : JSON.parse(d || '{}')))
    })
    req.on('error', rej); req.write(body); req.end()
  })
  console.log('[4] Login:', JSON.stringify(loginResult))

  const pass = text.length > 0 && resolved === text && loginResult.ok
  console.log('\n' + '='.repeat(40))
  console.log(pass ? '✓ MUGGLE E2E PASS' : '✗ FAIL')
  console.log('='.repeat(40))
  process.exit(pass ? 0 : 1)
}

main().catch(e => { console.error(e); process.exit(1) })

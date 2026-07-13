/**
 * Mock 登录网站 — 用于测试 secure-ledger 验证码识别 + 模板变量自动化流程
 *
 * 启动: node mock-server/server.js  (或 npm run mock-server)
 * 访问: http://localhost:3456
 *
 * 测试账号: admin / admin123
 * 验证码: 4 位随机字母数字, 通过 sharp 将 SVG 转 PNG
 */

const http = require('http')
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

// ============================================================
// Configuration
// ============================================================
const PORT = 3456
const VALID_USERNAME = 'admin'
const VALID_PASSWORD = 'admin123'

// 内存存储: captchaId → answer
const captchaStore = new Map()

// ============================================================
// Captcha Generator  (SVG → PNG via sharp)
// ============================================================
function randomCaptchaText(length = 4) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let result = ''
  for (let i = 0; i < length; i++) {
    result += chars[Math.floor(Math.random() * chars.length)]
  }
  return result
}

function svgCaptcha(text) {
  const noise = Array.from({ length: 6 }, () =>
    `<circle cx="${Math.random() * 120}" cy="${Math.random() * 40}" r="${1 + Math.random() * 2}" fill="#999" opacity="0.5"/>`
  ).join('')
  const line = `<line x1="${Math.random() * 120}" y1="0" x2="${Math.random() * 120}" y2="40" stroke="#ccc" stroke-width="1"/>`

  return `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="40">
    <rect width="120" height="40" fill="#f8f9fa" rx="4"/>
    ${noise}
    ${line}
    <text x="8" y="28" font-family="monospace" font-size="24" font-weight="bold" fill="#333" letter-spacing="3">${text}</text>
  </svg>`
}

async function generateCaptchaPng(text) {
  const sharp = require('sharp')
  const svg = svgCaptcha(text)
  return sharp(Buffer.from(svg)).png().toBuffer()
}

// ============================================================
// HTTP Server
// ============================================================
const LOGIN_HTML = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Mock Login - Secure Ledger Test</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f0f2f5; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
  .login-box { background: #fff; padding: 40px; border-radius: 12px; box-shadow: 0 2px 16px rgba(0,0,0,0.1); width: 360px; }
  .login-box h2 { text-align: center; margin-bottom: 24px; color: #1a1a2e; }
  .form-group { margin-bottom: 16px; }
  .form-group label { display: block; margin-bottom: 6px; font-size: 14px; color: #555; font-weight: 500; }
  .form-group input { width: 100%; padding: 10px 12px; border: 1px solid #d9d9d9; border-radius: 6px; font-size: 14px; outline: none; transition: border-color .2s; }
  .form-group input:focus { border-color: #4f46e5; box-shadow: 0 0 0 2px rgba(79,70,229,0.1); }
  .captcha-row { display: flex; gap: 10px; align-items: center; }
  .captcha-row img { height: 40px; border: 1px solid #d9d9d9; border-radius: 6px; cursor: pointer; }
  .captcha-row input { flex: 1; }
  .btn { width: 100%; padding: 12px; background: #4f46e5; color: #fff; border: none; border-radius: 6px; font-size: 15px; font-weight: 600; cursor: pointer; transition: background .2s; }
  .btn:hover { background: #4338ca; }
  .error { color: #dc2626; font-size: 13px; margin-top: 8px; text-align: center; }
</style>
</head>
<body>
<div class="login-box">
  <h2>Mock Login</h2>
  <form id="login-form" method="POST" action="/login">
    <div class="form-group">
      <label for="username">Username</label>
      <input id="username" name="username" type="text" placeholder="admin" autocomplete="off">
    </div>
    <div class="form-group">
      <label for="password">Password</label>
      <input id="password" name="password" type="password" placeholder="admin123" autocomplete="off">
    </div>
    <div class="form-group">
      <label>Captcha</label>
      <div class="captcha-row">
        <img id="captcha-img" src="/captcha?v=1" alt="captcha" onclick="refreshCaptcha()">
        <input id="captcha" name="captcha" type="text" placeholder="输入验证码" maxlength="4" autocomplete="off">
      </div>
    </div>
    <input type="hidden" id="captcha-id" name="captcha_id" value="1">
    <button id="login-btn" type="submit" class="btn">登 录</button>
    <p id="error-msg" class="error"></p>
  </form>
</div>
<script>
  let captchaVer = 1
  function refreshCaptcha() {
    captchaVer++
    document.getElementById('captcha-img').src = '/captcha?v=' + captchaVer
    document.getElementById('captcha-id').value = String(captchaVer)
  }
  document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault()
    const form = e.target
    const body = new URLSearchParams(new FormData(form))
    const resp = await fetch('/login', { method: 'POST', body })
    if (resp.redirected) {
      window.location.href = resp.url
    } else {
      const data = await resp.json()
      document.getElementById('error-msg').textContent = data.error || 'Login failed'
      refreshCaptcha()
    }
  })
</script>
</body>
</html>`

const SUCCESS_HTML = `<!DOCTYPE html>
<html lang="zh-CN">
<head><meta charset="UTF-8"><title>Login Success</title>
<style>
  body { font-family: -apple-system, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; background: #f0fdf4; }
  .card { background: #fff; padding: 48px; border-radius: 12px; box-shadow: 0 2px 16px rgba(0,0,0,0.1); text-align: center; }
  .check { font-size: 48px; margin-bottom: 16px; }
  h1 { color: #16a34a; margin-bottom: 8px; }
  p { color: #666; }
</style></head>
<body>
<div class="card">
  <div class="check">✅</div>
  <h1>Login Successful</h1>
  <p>自动化测试通过 — 验证码识别 + 模板变量替换正常</p>
</div>
</body>
</html>`

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`)

  // GET / — login page
  if (req.method === 'GET' && url.pathname === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
    res.end(LOGIN_HTML)
    return
  }

  // GET /captcha?v=N — captcha image
  if (req.method === 'GET' && url.pathname === '/captcha') {
    const captchaId = url.searchParams.get('v') || '1'
    const text = randomCaptchaText(4)
    captchaStore.set(captchaId, text)
    console.log(`[MockServer] Captcha #${captchaId}: "${text}"`)
    try {
      const png = await generateCaptchaPng(text)
      res.writeHead(200, { 'Content-Type': 'image/png', 'Cache-Control': 'no-cache' })
      res.end(png)
    } catch (e) {
      console.error('[MockServer] Captcha generation failed:', e.message)
      res.writeHead(500)
      res.end('captcha error')
    }
    return
  }

  // POST /login — validate
  if (req.method === 'POST' && url.pathname === '/login') {
    let body = ''
    req.on('data', chunk => { body += chunk })
    req.on('end', () => {
      const params = new URLSearchParams(body)
      const username = params.get('username') || ''
      const password = params.get('password') || ''
      const captcha = (params.get('captcha') || '').toUpperCase()
      const captchaId = params.get('captcha_id') || '1'

      const expectedCaptcha = captchaStore.get(captchaId)
      captchaStore.delete(captchaId) // one-time use

      console.log(`[MockServer] Login attempt: user="${username}", captcha_in="${captcha}", expected="${expectedCaptcha}"`)

      if (username !== VALID_USERNAME || password !== VALID_PASSWORD) {
        res.writeHead(401, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: '用户名或密码错误' }))
        return
      }
      if (captcha !== (expectedCaptcha || '')) {
        res.writeHead(401, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: `验证码错误 (expected: ${expectedCaptcha}, got: ${captcha})` }))
        return
      }

      // Success — redirect
      res.writeHead(302, { Location: '/success' })
      res.end()
    })
    return
  }

  // GET /success
  if (req.method === 'GET' && url.pathname === '/success') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
    res.end(SUCCESS_HTML)
    return
  }

  // 404
  res.writeHead(404)
  res.end('Not Found')
})

server.listen(PORT, () => {
  console.log(`[MockServer] Running at http://localhost:${PORT}`)
  console.log(`[MockServer] Test account: admin / admin123`)
  console.log(`[MockServer] Captcha: 4-char alphanumeric, changes each load`)
})

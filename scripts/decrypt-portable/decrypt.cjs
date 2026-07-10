/**
 * 数据库解密工具 - 便携版 (无需 npm install)
 *
 * 用法:
 *   node decrypt.cjs [--db <路径>] [--keys <路径>] [--output <文件>] [--all] [--help]
 *
 * 自包含，所有依赖已内置于本目录:
 *   - sql-wasm.js   (sql.js)
 *   - sql-wasm.wasm (WebAssembly 二进制)
 */

'use strict'

const { execSync } = require('child_process')
const { existsSync, readFileSync, writeFileSync, unlinkSync, statSync } = require('fs')
const { join } = require('path')
const { homedir, tmpdir } = require('os')
const crypto = require('crypto')

// 本地加载 sql.js (无需 npm install)
const initSqlJs = require(join(__dirname, 'sql-wasm.js'))

// ============================================================
// 命令行参数解析
// ============================================================
function parseArgs() {
  const args = process.argv.slice(2)
  let dbPath = '', keysPath = '', outputPath = null, showAll = false

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--db':     dbPath = args[++i] || ''; break
      case '--keys':   keysPath = args[++i] || ''; break
      case '--output': outputPath = args[++i] || ''; break
      case '--all':    showAll = true; break
      case '--help':
        console.log(`
数据库加密数据解密工具 - 便携版

用法: node decrypt.cjs [选项]

选项:
  --db <path>      数据库文件路径
                   默认 Windows: %APPDATA%\\secure-ledger\\secure-ledger.db
                   默认 Linux:   ~/.config/secure-ledger/secure-ledger.db
  --keys <path>    密钥目录路径
                   默认 Windows: %APPDATA%\\secure-ledger\\keys
                   默认 Linux:   ~/.config/secure-ledger/keys
  --output <path>  输出 JSON 文件路径 (默认: 控制台输出)
  --all            输出所有数据（含非加密字段）
  --help           显示此帮助信息

示例:
  node decrypt.cjs --output decrypted.json
  node decrypt.cjs --db "D:\\backup\\secure-ledger.db\\secure-ledger.db" --keys "D:\\backup\\secure-ledger.db\\keys"
  node decrypt.cjs --all --output full.json
`)
        process.exit(0)
    }
  }

  const platform = process.platform
  const appDataDir = platform === 'win32'
    ? join(process.env.APPDATA || join(homedir(), 'AppData', 'Roaming'), 'secure-ledger')
    : join(homedir(), '.config', 'secure-ledger')

  if (!dbPath)   dbPath   = join(appDataDir, 'secure-ledger.db')
  if (!keysPath) keysPath = join(appDataDir, 'keys')

  return { dbPath, keysPath, outputPath, showAll }
}

// ============================================================
// 私钥解密
// ============================================================
function decryptPrivateKey(keysPath) {
  const privateKeyPath = join(keysPath, 'private.pem.enc')
  if (!existsSync(privateKeyPath)) {
    console.error(`[错误] 私钥文件不存在: ${privateKeyPath}`)
    return null
  }

  const stats = statSync(privateKeyPath)
  console.log(`  私钥文件大小: ${stats.size} 字节 (${(stats.size/1024).toFixed(1)} KB)`)

  if (stats.size < 200) {
    console.error(`  ✗ 私钥文件异常小 (${stats.size} 字节)，可能损坏`)
    return null
  }

  const header = readFileSync(privateKeyPath, { encoding: 'utf-8' }).substring(0, 3)
  if (!header.startsWith('v')) {
    console.error(`  ✗ 私钥文件头无效: "${header}"`)
    return null
  }
  console.log(`  版本标记: ${header}`)

  try {
    if (process.platform === 'win32') return decryptWin(privateKeyPath)
    if (process.platform === 'linux') return decryptLinux()
    console.error(`[错误] 不支持的平台: ${process.platform}`)
    return null
  } catch (e) {
    console.error(`[错误] 私钥解密失败: ${e.message}`)
    return null
  }
}

function decryptWin(filePath) {
  const buf = readFileSync(filePath)
  console.log('  [方法1] PowerShell DPAPI 解密...')
  const r = psDpapi(buf, filePath)
  if (r) return r
  console.log('  [方法2] Electron safeStorage...')
  return electronDecrypt(filePath)
}

function psDpapi(encryptedBuffer, filePath) {
  const psPath = join(tmpdir(), `sl-dp-${Date.now()}.ps1`)
  const binPath = join(tmpdir(), `sl-dp-${Date.now()}.bin`)
  try {
    writeFileSync(binPath, encryptedBuffer)
    writeFileSync(psPath, `
Add-Type -AssemblyName System.Security
$bytes = [System.IO.File]::ReadAllBytes('${binPath.replace(/\\/g,'\\\\')}')
$headerSize = 0
if ($bytes.Length -gt 3) {
  $h = [System.Text.Encoding]::ASCII.GetString($bytes[0..2])
  if ($h -match '^v\\d{2}$') { $headerSize = 3 }
}
$dpapiBlob = if ($headerSize -gt 0) { $bytes[$headerSize..($bytes.Length-1)] } else { $bytes }
try {
  $plain = [System.Security.Cryptography.ProtectedData]::Unprotect($dpapiBlob, $null, [System.Security.Cryptography.DataProtectionScope]::CurrentUser)
  Write-Output ([Convert]::ToBase64String($plain))
} catch {
  Write-Error "DPAPI failed: $($_.Exception.Message)"
  exit 1
}`.trim(), 'utf-8')

    const out = execSync(
      `powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "${psPath}"`,
      { encoding: 'utf-8', timeout: 15000, stdio: ['pipe','pipe','ignore'] }
    ).trim()
    if (out && /^[A-Za-z0-9+/]+=*$/.test(out)) {
      console.log('  ✓ DPAPI 解密成功')
      return Buffer.from(out, 'base64').toString('utf-8')
    }
  } catch (_) {} finally {
    try { unlinkSync(psPath) } catch (_) {}
    try { unlinkSync(binPath) } catch (_) {}
  }
  return null
}

function electronDecrypt(filePath) {
  const outPath = join(tmpdir(), `sl-el-${Date.now()}.txt`)
  const jsPath = join(tmpdir(), `sl-el-${Date.now()}.js`)
  try {
    writeFileSync(jsPath, `
const { app, safeStorage } = require('electron')
const fs = require('fs')
app.whenReady().then(() => {
  try {
    if (!safeStorage.isEncryptionAvailable()) { fs.writeFileSync('${outPath.replace(/\\/g,'\\\\')}','ERROR: EncryptNotAvail'); app.quit(); return }
    const buf = fs.readFileSync('${filePath.replace(/\\/g,'\\\\')}')
    const dec = safeStorage.decryptString(buf)
    fs.writeFileSync('${outPath.replace(/\\/g,'\\\\')}', dec, 'utf-8')
  } catch(e) { fs.writeFileSync('${outPath.replace(/\\/g,'\\\\')}','ERROR: '+e.message) }
  app.quit()
})`.trim(), 'utf-8')

    const ep = join(__dirname, '..', '..', 'node_modules', '.bin', 'electron.cmd')
    const ef = join(__dirname, '..', '..', 'node_modules', 'electron', 'dist', 'electron.exe')
    let cmd = existsSync(ep) ? `"${ep}" "${jsPath}"` : existsSync(ef) ? `"${ef}" "${jsPath}"` : ''
    if (!cmd) { console.error('  ✗ 未找到 Electron'); return null }
    execSync(cmd, { timeout: 30000, stdio: ['pipe','pipe','ignore'] })
    if (existsSync(outPath)) {
      const r = readFileSync(outPath, 'utf-8')
      if (r.startsWith('ERROR:')) { console.error(`  ✗ ${r.substring(7)}`); return null }
      console.log('  ✓ Electron 解密成功')
      return r
    }
  } catch (_) {} finally {
    try { unlinkSync(jsPath) } catch (_) {}
    try { unlinkSync(outPath) } catch (_) {}
  }
  return null
}

function decryptLinux() {
  try {
    const r = execSync("secret-tool lookup application 'Electron safeStorage' 2>/dev/null", { encoding:'utf-8', timeout:10000 }).trim()
    if (r) return r
  } catch (_) {}
  console.error('[提示] 请确保 gnome-keyring 已解锁: sudo apt install libsecret-tools')
  return null
}

// ============================================================
// 加解密核心
// ============================================================
function rsaPrivateDecrypt(ciphertext, privateKeyPem) {
  try {
    const buf = Buffer.from(ciphertext, 'base64')
    if (!buf.length) return null
    return crypto.privateDecrypt(
      { key: privateKeyPem, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' }, buf
    ).toString('utf-8')
  } catch (_) { return null }
}

function rsaPublicDecrypt(ciphertext, publicKeyPem) {
  try {
    return crypto.publicDecrypt(
      { key: publicKeyPem, padding: crypto.constants.RSA_PKCS1_PADDING }, Buffer.from(ciphertext, 'base64')
    ).toString('utf-8')
  } catch (_) { return null }
}

function extractPublicKey(privateKeyPem) {
  try {
    return crypto.createPublicKey(crypto.createPrivateKey(privateKeyPem)).export({ type: 'spki', format: 'pem' }).toString()
  } catch (_) { return null }
}

function aesGcmDecrypt(dataHex, keyHex, ivHex, tagHex) {
  try {
    const d = crypto.createDecipheriv('aes-256-gcm', Buffer.from(keyHex,'hex'), Buffer.from(ivHex,'hex'))
    d.setAuthTag(Buffer.from(tagHex,'hex'))
    return Buffer.concat([d.update(Buffer.from(dataHex,'hex')), d.final()]).toString('utf-8')
  } catch (_) { return null }
}

function hybridDecrypt(ciphertext, privateKeyPem, publicKeyPem) {
  if (!ciphertext) return ''
  const clean = ciphertext.replace(/[\r\n\s]/g, '')
  const parts = clean.split(':')
  // 纯 RSA
  if (parts.length === 1)
    return rsaPrivateDecrypt(clean, privateKeyPem) || rsaPublicDecrypt(clean, publicKeyPem)
  // 混合: Base64(key):Hex(IV):Hex(tag):Hex(data)
  if (parts.length === 4) {
    const aesKey = rsaPrivateDecrypt(parts[0], privateKeyPem) || rsaPublicDecrypt(parts[0], publicKeyPem)
    if (!aesKey) return null
    return aesGcmDecrypt(parts[3], aesKey, parts[1], parts[2])
  }
  return null // 3-part 需要外部密钥
}

function isEncryptedValue(value) {
  if (!value || value.length < 10) return false
  const clean = value.replace(/[\r\n\s]/g, '')
  const parts = clean.split(':')
  if (parts.length === 4) return /^[A-Za-z0-9+/]+=*$/.test(parts[0])
  if (parts.length === 1) {
    try { return Buffer.from(clean, 'base64').length === 256 && /^[A-Za-z0-9+/]+=*$/.test(clean) } catch (_) { return false }
  }
  return false
}

// ============================================================
// 数据库解密主流程
// ============================================================
async function main() {
  console.log('数据库加密数据解密工具 - 便携版\n')
  const cfg = parseArgs()
  console.log(`数据库: ${cfg.dbPath}`)
  console.log(`密钥:   ${cfg.keysPath}`)
  console.log(`格式:   ${cfg.showAll ? 'JSON' : '报告'}\n`)

  // 1. 加载私钥
  console.log('[1/4] 加载私钥...')
  const pvt = decryptPrivateKey(cfg.keysPath)
  const pubPath = join(cfg.keysPath, 'public.pem')
  let pub = ''
  if (existsSync(pubPath)) {
    pub = readFileSync(pubPath, 'utf-8')
    console.log(`  ✓ 公钥已加载`)
  } else if (pvt) {
    pub = extractPublicKey(pvt) || ''
    console.log(`  ⚠ 从私钥提取公钥`)
  }
  console.log(pvt ? '  ✓ 私钥解密成功' : '  ✗ 私钥加载失败')

  // 2. 打开数据库
  console.log(`\n[2/4] 打开数据库: ${cfg.dbPath}`)
  if (!existsSync(cfg.dbPath)) { console.error(`  ✗ 数据库不存在`); process.exit(1) }
  const SQL = await initSqlJs()
  const db = new SQL.Database(readFileSync(cfg.dbPath))
  console.log('  ✓ 已打开')

  // 3. 查询
  console.log('\n[3/4] 查询...')
  const eps = [], pgs = [], sls = []
  try { db.each('SELECT id,name,icon,login_type,share_token FROM endpoint ORDER BY id', (r) => eps.push(r)) } catch(_){}
  try { db.each('SELECT id,endpoint_id,order_index,url,ssh_port FROM page ORDER BY id', (r) => pgs.push(r)) } catch(_){}
  try { db.each('SELECT * FROM slot ORDER BY id', (r) => sls.push(r)) } catch(_){}
  db.close()
  console.log(`  ✓ ${eps.length} 端点, ${pgs.length} 页, ${sls.length} 槽`)

  // 4. 解密
  console.log('\n[4/4] 解密...')
  const encSlots = sls.filter(s => s.is_encrypted === 1 && s.value)
  console.log(`  加密: ${encSlots.length}, 总: ${sls.length}`)
  let ok = 0, fail = 0

  const decrypted = sls.map(s => {
    const b = { ...s, encrypted_value: s.value, decryption_status: 'not_encrypted' }
    if (s.is_encrypted !== 1 || !s.value) { b.decryption_status = s.value ? 'not_encrypted' : 'empty'; return b }
    if (!isEncryptedValue(s.value)) { b.decryption_status = 'not_encrypted'; b.decryption_error = '非已知加密格式'; return b }
    if (!pvt) { b.decryption_status = 'failed'; b.decryption_error = '私钥不可用'; fail++; return b }
    const d = hybridDecrypt(s.value, pvt, pub)
    if (d !== null) { b.value = d; b.decryption_status = 'ok'; ok++ }
    else { b.decryption_status = 'failed'; b.decryption_error = '解密失败'; fail++ }
    return b
  })
  console.log(`  ✓ ${ok} 成功, ${fail} 失败`)

  const result = { db_path: cfg.dbPath, keys_path: cfg.keysPath, private_key_loaded: !!pvt,
    total_slots: sls.length, encrypted_slots: encSlots.length, decrypted_slots: ok, failed_slots: fail,
    endpoints: eps, pages: pgs, slots: decrypted }

  // 输出
  const out = cfg.showAll ? JSON.stringify(result, null, 2) : formatReport(result)
  if (cfg.outputPath) { writeFileSync(cfg.outputPath, out, 'utf-8'); console.log(`\n结果已写入: ${cfg.outputPath}`) }
  else console.log(out)
}

function formatReport(r) {
  let o = `${'='.repeat(60)}\n  数据库解密报告\n${'='.repeat(60)}\n\n`
  o += `数据库: ${r.db_path}\n密钥: ${r.keys_path}\n私钥: ${r.private_key_loaded?'已加载 ✓':'失败 ✗'}\n\n`
  o += `统计: ${r.endpoints.length}端点 ${r.pages.length}页 ${r.total_slots}槽\n`
  o += `加密: ${r.encrypted_slots}  |  解密: ${r.decrypted_slots} ✓  |  失败: ${r.failed_slots} ✗\n\n`
  for (const ep of r.endpoints) {
    const epPages = r.pages.filter(p => p.endpoint_id === ep.id)
    if (!epPages.length) continue
    o += `${'─'.repeat(60)}\n端点: ${ep.name} [${ep.login_type}] (ID:${ep.id})\n${'─'.repeat(60)}\n`
    for (const pg of epPages) {
      const pgSlots = r.slots.filter(s => s.page_id === pg.id)
      if (!pgSlots.length) continue
      o += `\n  步骤${pg.order_index}: ${pg.url}${pg.ssh_port?' :'+pg.ssh_port:''}\n`
      for (const s of pgSlots) {
        const st = s.decryption_status === 'ok' ? '✓' : s.decryption_status === 'failed' ? '✗' : s.decryption_status === 'empty' ? '○' : '-'
        o += `    [${st}] ${s.action_type}${s.name?' "'+s.name+'"':''} (#${s.id})\n`
        if (s.decryption_status === 'ok') {
          const v = s.action_type === 'password' ? '●'.repeat(Math.min(s.value.length, 16)) : s.value.length > 80 ? s.value.slice(0,80)+'...' : s.value
          o += `      值: ${v}\n`
          if (s.username) o += `      用户: ${s.username}\n`
        } else if (s.decryption_status === 'failed') o += `      错误: ${s.decryption_error}\n`
      }
    }
  }
  return o + `\n${'='.repeat(60)}\n`
}

main().catch(e => { console.error('失败:', e); process.exit(1) })

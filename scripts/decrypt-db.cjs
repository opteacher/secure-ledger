/**
 * 数据库加密数据解密工具 (JavaScript 版本)
 *
 * 解密 secure-ledger.db 中加密的 slot 数据，输出为 JSON。
 *
 * 用法:
 *   node scripts/decrypt-db.cjs [--db <路径>] [--keys <路径>] [--output <文件>]
 *
 * 选项:
 *   --db <path>      数据库文件路径 (默认: %APPDATA%/secure-ledger/secure-ledger.db)
 *   --keys <path>    密钥目录路径 (默认: %APPDATA%/secure-ledger/keys)
 *   --output <path>  输出 JSON 文件路径 (默认: 控制台输出)
 *   --all            输出所有数据（含非加密字段）
 *   --help           显示帮助
 *
 * 加密方案:
 *   - 短数据 (≤245字节): RSA-2048 OAEP 公钥加密，私钥解密
 *   - 长数据 (>245字节): AES-256-GCM 加密数据，RSA 加密 AES 密钥
 *   - 格式: Base64(RSA_ciphertext) 或 Base64(encrypted_key):Hex(IV):Hex(tag):Hex(data)
 *   - 私钥存储: Electron safeStorage (Windows DPAPI / Linux Secret Service)
 */

'use strict'

const { execSync } = require('child_process')
const { existsSync, readFileSync, writeFileSync, unlinkSync, statSync } = require('fs')
const { join, dirname } = require('path')
const { homedir, tmpdir } = require('os')
const crypto = require('crypto')

// ============================================================
// 命令行参数解析
// ============================================================

function parseArgs() {
  const args = process.argv.slice(2)

  let dbPath = ''
  let keysPath = ''
  let outputPath = null
  let showAll = false

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--db':
        dbPath = args[++i] || ''
        break
      case '--keys':
        keysPath = args[++i] || ''
        break
      case '--output':
        outputPath = args[++i] || ''
        break
      case '--all':
        showAll = true
        break
      case '--help':
        console.log(`
数据库加密数据解密工具

用法: node scripts/decrypt-db.cjs [选项]

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
  node scripts/decrypt-db.cjs
  node scripts/decrypt-db.cjs --output decrypted.json
  node scripts/decrypt-db.cjs --db "D:\\backup\\secure-ledger.db" --keys "D:\\backup\\keys"
`)
        process.exit(0)
    }
  }

  // 默认路径
  const platform = process.platform
  const appDataDir = platform === 'win32'
    ? join(process.env.APPDATA || join(homedir(), 'AppData', 'Roaming'), 'secure-ledger')
    : join(homedir(), '.config', 'secure-ledger')

  if (!dbPath) {
    dbPath = join(appDataDir, 'secure-ledger.db')
  }
  if (!keysPath) {
    keysPath = join(appDataDir, 'keys')
  }

  return { dbPath, keysPath, outputPath, showAll }
}

// ============================================================
// 私钥解密 (OS Keyring)
// ============================================================

/**
 * 从 Electron safeStorage 加密的文件中解密私钥
 */
function decryptPrivateKey(keysPath) {
  const privateKeyPath = join(keysPath, 'private.pem.enc')

  if (!existsSync(privateKeyPath)) {
    console.error(`[错误] 私钥文件不存在: ${privateKeyPath}`)
    return null
  }

  // 诊断：检查文件大小
  const stats = statSync(privateKeyPath)
  const sizeKB = (stats.size / 1024).toFixed(1)
  console.log(`  私钥文件大小: ${stats.size} 字节 (${sizeKB} KB)`)

  if (stats.size < 200) {
    console.error(`  ✗ 私钥文件异常小 (${stats.size} 字节)！`)
    console.error('    正常加密后的 RSA-2048 私钥约 1.7 KB')
    console.error('    文件可能已损坏或加密失败')
    console.error('')
    console.error('  可能原因:')
    console.error('    1. 应用上次运行时 safeStorage 加密服务不可用')
    console.error('    2. 密钥文件被意外截断')
    console.error('')
    console.error('  解决方案:')
    console.error('    1. 重新运行应用生成新密钥对 (数据将丢失!)')
    console.error('    2. 如有备份，恢复 private.pem.enc 文件')
    return null
  }

  // 读取文件头验证
  const header = readFileSync(privateKeyPath, { encoding: 'utf-8', flag: 'r' }).substring(0, 3)
  if (!header.startsWith('v')) {
    console.error(`  ✗ 私钥文件头无效: "${header}" (预期 v10 或 v11)`)
    return null
  }
  console.log(`  版本标记: ${header}`)

  try {
    if (process.platform === 'win32') {
      return decryptPrivateKeyWindows(privateKeyPath)
    } else if (process.platform === 'linux') {
      return decryptPrivateKeyLinux(privateKeyPath)
    } else {
      console.error(`[错误] 不支持的平台: ${process.platform}`)
      return null
    }
  } catch (error) {
    console.error(`[错误] 私钥解密失败: ${error.message}`)
    return null
  }
}

/**
 * PowerShell 脚本文件方式: 写 .ps1 文件到临时目录执行
 */
function decryptWithPowerShellScript(filePath, encryptedBuffer) {
  const ps1Path = join(tmpdir(), `sl-dpapi-${Date.now()}.ps1`)
  const encPath = join(tmpdir(), `sl-enc-${Date.now()}.bin`)

  try {
    // 写入加密数据到临时二进制文件
    writeFileSync(encPath, encryptedBuffer)

    // 写入 PowerShell 脚本
    const ps1Content = `
Add-Type -AssemblyName System.Security

$encPath = '${encPath.replace(/\\/g, '\\\\')}'
$bytes = [System.IO.File]::ReadAllBytes($encPath)

# 剥离 Electron safeStorage 版本头 ("v10" 或 "v11", 3 字节)
$headerSize = 0
if ($bytes.Length -gt 3) {
  $header = [System.Text.Encoding]::ASCII.GetString($bytes[0..2])
  if ($header -match '^v\\d{2}$') {
    $headerSize = 3
  }
}

$dpapiBlob = if ($headerSize -gt 0) { $bytes[$headerSize..($bytes.Length-1)] } else { $bytes }

# DPAPI 解密
try {
  $plainBytes = [System.Security.Cryptography.ProtectedData]::Unprotect(
    $dpapiBlob, $null, [System.Security.Cryptography.DataProtectionScope]::CurrentUser
  )
  # 输出为 Base64
  Write-Output ([Convert]::ToBase64String($plainBytes))
} catch {
  Write-Error "DPAPI.Unprotect failed: $($_.Exception.Message)"
  exit 1
}
`.trim()

    writeFileSync(ps1Path, ps1Content, 'utf-8')

    const result = execSync(
      `powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "${ps1Path}"`,
      { encoding: 'utf-8', timeout: 15000, stdio: ['pipe', 'pipe', 'ignore'] }
    ).trim()

    if (result && /^[A-Za-z0-9+/]+=*$/.test(result)) {
      console.log('  ✓ 解密成功')
      return Buffer.from(result, 'base64').toString('utf-8')
    }
  } catch (error) {
    // PowerShell 失败，尝试下一个方法
  } finally {
    try { unlinkSync(ps1Path) } catch (_) {}
    try { unlinkSync(encPath) } catch (_) {}
  }

  return null
}

/**
 * Windows: 解密 Electron safeStorage 加密的数据
 */
function decryptPrivateKeyWindows(filePath) {
  const encryptedBuffer = readFileSync(filePath)

  // ---- 方法1: PowerShell 脚本文件 ----
  console.log('  [方法1] PowerShell 临时脚本...')
  const result = decryptWithPowerShellScript(filePath, encryptedBuffer)
  if (result) return result

  // ---- 方法2: Electron safeStorage (备用) ----
  console.log('  [方法2] Electron safeStorage 解密...')
  return decryptPrivateKeyViaElectron(filePath)
}

/**
 * 使用 Electron 进程解密私钥
 */
function decryptPrivateKeyViaElectron(filePath) {
  // 临时输出文件
  const outputPath = join(tmpdir(), `sl-key-decrypt-${Date.now()}.txt`)

  // Electron helper 脚本
  const helperScript = join(tmpdir(), `sl-key-helper-${Date.now()}.js`)
  const helperCode = `
const { app, safeStorage } = require('electron')
const fs = require('fs')

app.whenReady().then(() => {
  try {
    const encPath = ${JSON.stringify(filePath)}
    const outPath = ${JSON.stringify(outputPath)}
    
    if (!safeStorage.isEncryptionAvailable()) {
      fs.writeFileSync(outPath, 'ERROR: Encryption not available')
      app.quit()
      return
    }
    
    const encryptedBuffer = fs.readFileSync(encPath)
    const decrypted = safeStorage.decryptString(encryptedBuffer)
    fs.writeFileSync(outPath, decrypted, 'utf-8')
    console.log('Decryption successful')
  } catch (e) {
    fs.writeFileSync(outPath, 'ERROR: ' + e.message)
  }
  app.quit()
})
`.trim()

  try {
    writeFileSync(helperScript, helperCode, 'utf-8')

    // 启动 Electron
    const electronPath = join(__dirname, '..', 'node_modules', '.bin', 'electron.cmd')
    const electronFallback = join(__dirname, '..', 'node_modules', 'electron', 'dist', 'electron.exe')

    let cmd = ''
    if (existsSync(electronPath)) {
      cmd = `"${electronPath}" "${helperScript}"`
    } else if (existsSync(electronFallback)) {
      cmd = `"${electronFallback}" "${helperScript}"`
    } else {
      console.error('  ✗ 未找到 Electron 可执行文件')
      return null
    }

    execSync(cmd, { timeout: 30000, stdio: ['pipe', 'pipe', 'ignore'] })

    // 读取解密结果
    if (existsSync(outputPath)) {
      const result = readFileSync(outputPath, 'utf-8')
      if (result.startsWith('ERROR:')) {
        console.error(`  ✗ Electron 解密失败: ${result.substring(7)}`)
        return null
      }
      return result
    }

    return null
  } catch (error) {
    console.error(`  ✗ Electron 解密异常: ${error.message}`)
    return null
  } finally {
    try { unlinkSync(helperScript) } catch (_) {}
    try { unlinkSync(outputPath) } catch (_) {}
  }
}

/**
 * Linux: 使用 secret-tool 解密
 */
function decryptPrivateKeyLinux(filePath) {
  try {
    const result = execSync(
      `secret-tool lookup application 'Electron safeStorage' 2>/dev/null`,
      { encoding: 'utf-8', timeout: 10000 }
    ).trim()

    if (result) {
      return result
    }
  } catch (_) {
    // secret-tool 不可用或查询失败
  }

  console.error('[警告] Linux secret-tool 不可用')
  console.error('[提示] 请确保 gnome-keyring 已解锁:')
  console.error('  sudo apt install libsecret-tools')
  console.error('  然后确保密钥环已解锁')

  return null
}

// ============================================================
// 混合解密逻辑 (复刻自 hybrid.ts)
// ============================================================

const AES_ALGORITHM = 'aes-256-gcm'

/**
 * RSA 私钥解密 (OAEP padding)
 */
function rsaPrivateDecrypt(ciphertext, privateKeyPem) {
  try {
    const buffer = Buffer.from(ciphertext, 'base64')
    // Buffer.from 可能因无效 base64 抛出异常
    if (buffer.length === 0) return null
    const decrypted = crypto.privateDecrypt(
      {
        key: privateKeyPem,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: 'sha256'
      },
      buffer
    )
    return decrypted.toString('utf-8')
  } catch (_) {
    return null
  }
}

/**
 * RSA 公钥解密 (旧格式兼容 - PKCS1 padding)
 */
function rsaPublicDecrypt(ciphertext, publicKeyPem) {
  try {
    const buffer = Buffer.from(ciphertext, 'base64')
    const decrypted = crypto.publicDecrypt(
      {
        key: publicKeyPem,
        padding: crypto.constants.RSA_PKCS1_PADDING
      },
      buffer
    )
    return decrypted.toString('utf-8')
  } catch (_) {
    return null
  }
}

/**
 * 从 PEM 私钥提取公钥
 */
function extractPublicKey(privateKeyPem) {
  try {
    const privateKey = crypto.createPrivateKey(privateKeyPem)
    const publicKey = crypto.createPublicKey(privateKey)
    return publicKey.export({ type: 'spki', format: 'pem' }).toString()
  } catch (_) {
    return null
  }
}

/**
 * AES-256-GCM 解密
 */
function aesGcmDecrypt(encryptedDataHex, keyHex, ivHex, authTagHex) {
  try {
    const key = Buffer.from(keyHex, 'hex')
    const iv = Buffer.from(ivHex, 'hex')
    const authTag = Buffer.from(authTagHex, 'hex')
    const encryptedData = Buffer.from(encryptedDataHex, 'hex')

    const decipher = crypto.createDecipheriv(AES_ALGORITHM, key, iv)
    decipher.setAuthTag(authTag)

    let decrypted = decipher.update(encryptedData)
    decrypted = Buffer.concat([decrypted, decipher.final()])
    return decrypted.toString('utf-8')
  } catch (_) {
    return null
  }
}

/**
 * 混合解密 (复刻 hybridDecrypt)
 */
function hybridDecrypt(ciphertext, privateKeyPem, publicKeyPem) {
  if (!ciphertext) return ''

  const cleanValue = ciphertext.replace(/[\r\n\s]/g, '')
  const parts = cleanValue.split(':')

  // 纯 RSA 加密: 只有 Base64
  if (parts.length === 1) {
    // 优先新格式 (私钥解密)
    let decrypted = rsaPrivateDecrypt(cleanValue, privateKeyPem)
    if (decrypted) return decrypted

    // 兼容旧格式 (公钥解密)
    decrypted = rsaPublicDecrypt(cleanValue, publicKeyPem)
    if (decrypted) return decrypted

    return null
  }

  // 混合加密: Base64(encrypted_key):Hex(IV):Hex(tag):Hex(data)
  if (parts.length === 4) {
    const encryptedKey = parts[0]
    const ivHex = parts[1]
    const authTagHex = parts[2]
    const encryptedData = parts[3]

    // 优先新格式: 私钥解密 AES 密钥
    let aesKeyHex = rsaPrivateDecrypt(encryptedKey, privateKeyPem)

    // 兼容旧格式: 公钥解密 AES 密钥
    if (!aesKeyHex) {
      aesKeyHex = rsaPublicDecrypt(encryptedKey, publicKeyPem)
    }

    if (!aesKeyHex) return null

    // AES 解密数据
    return aesGcmDecrypt(encryptedData, aesKeyHex, ivHex, authTagHex)
  }

  // 对称加密格式 (Token 分享用): Hex(IV):Hex(tag):Hex(data) — 3 parts
  if (parts.length === 3) {
    return null // 需要外部密钥
  }

  return null
}

/**
 * 检查值是否可能被加密
 */
function isEncryptedValue(value) {
  if (!value || value.length < 10) return false
  const clean = value.replace(/[\r\n\s]/g, '')
  const parts = clean.split(':')

  // 混合加密: 4 parts
  if (parts.length === 4) {
    return /^[A-Za-z0-9+/]+=*$/.test(parts[0])
  }

  // 纯 RSA: 1 part, base64, ~256 bytes
  if (parts.length === 1) {
    try {
      const buf = Buffer.from(clean, 'base64')
      return buf.length === 256 && /^[A-Za-z0-9+/]+=*$/.test(clean)
    } catch (_) {
      return false
    }
  }

  return false
}

// ============================================================
// 数据库操作
// ============================================================

async function loadAndDecrypt(config) {
  const { dbPath, keysPath, showAll } = config

  // ---- 1. 加载私钥 ----
  console.log('[1/4] 加载私钥...')
  const privateKeyPem = decryptPrivateKey(keysPath)
  const publicKeyPath = join(keysPath, 'public.pem')
  let publicKeyPem = ''

  if (existsSync(publicKeyPath)) {
    publicKeyPem = readFileSync(publicKeyPath, 'utf-8')
    console.log(`  ✓ 公钥已加载: ${publicKeyPath}`)
  } else {
    console.log(`  ⚠ 公钥文件未找到，从私钥提取: ${publicKeyPath}`)
    if (privateKeyPem) {
      publicKeyPem = extractPublicKey(privateKeyPem) || ''
    }
  }

  if (!privateKeyPem) {
    console.error('  ✗ 私钥加载失败，加密数据无法解密')
  } else {
    console.log('  ✓ 私钥解密成功')
  }

  // ---- 2. 打开数据库 ----
  console.log(`\n[2/4] 打开数据库: ${dbPath}`)
  if (!existsSync(dbPath)) {
    console.error(`  ✗ 数据库文件不存在: ${dbPath}`)
    process.exit(1)
  }

  const initSqlJs = require('sql.js')
  const SQL = await initSqlJs()
  const fileBuffer = readFileSync(dbPath)
  const db = new SQL.Database(fileBuffer)
  console.log('  ✓ 数据库已打开')

  // ---- 3. 查询数据 ----
  console.log('\n[3/4] 查询加密数据...')

  const endpoints = []
  try {
    const stmt = db.prepare('SELECT id, name, icon, login_type, share_token FROM endpoint ORDER BY id')
    while (stmt.step()) {
      endpoints.push(stmt.getAsObject())
    }
    stmt.free()
  } catch (e) {
    console.error('  ⚠ 查询 endpoint 失败')
  }

  const pages = []
  try {
    const stmt = db.prepare('SELECT id, endpoint_id, order_index, url, ssh_port FROM page ORDER BY id')
    while (stmt.step()) {
      pages.push(stmt.getAsObject())
    }
    stmt.free()
  } catch (e) {
    console.error('  ⚠ 查询 page 失败')
  }

  const slots = []
  try {
    const stmt = db.prepare(
      'SELECT id, page_id, order_index, name, element_xpath, action_type, value, is_encrypted, timeout, username, keyfile, passphrase, created_at, updated_at FROM slot ORDER BY id'
    )
    while (stmt.step()) {
      slots.push(stmt.getAsObject())
    }
    stmt.free()
  } catch (e) {
    console.error('  ✗ 查询 slot 失败')
  }

  db.close()
  console.log(`  ✓ 查询完成: ${endpoints.length} 端点, ${pages.length} 步骤页, ${slots.length} 操作槽`)

  // ---- 4. 解密 ----
  console.log('\n[4/4] 解密操作槽...')
  const encryptedSlots = slots.filter(s => s.is_encrypted === 1 && s.value)
  console.log(`  加密槽: ${encryptedSlots.length}, 总槽: ${slots.length}`)

  let decryptedCount = 0
  let failedCount = 0

  const decryptedSlots = slots.map(slot => {
    const base = {
      id: slot.id,
      page_id: slot.page_id,
      order_index: slot.order_index,
      name: slot.name,
      element_xpath: slot.element_xpath,
      action_type: slot.action_type,
      value: slot.value,
      encrypted_value: slot.value,
      is_encrypted: slot.is_encrypted,
      timeout: slot.timeout,
      username: slot.username,
      keyfile: slot.keyfile,
      passphrase: slot.passphrase,
      created_at: slot.created_at,
      updated_at: slot.updated_at,
      decryption_status: 'not_encrypted',
    }

    // 非加密或空值
    if (slot.is_encrypted !== 1 || !slot.value) {
      if (!slot.value) base.decryption_status = 'empty'
      return base
    }

    // 检查是否是加密格式
    if (!isEncryptedValue(slot.value)) {
      base.decryption_status = 'not_encrypted'
      base.decryption_error = '值不是已知加密格式'
      return base
    }

    // 尝试解密
    if (!privateKeyPem) {
      base.decryption_status = 'failed'
      base.decryption_error = '私钥不可用'
      failedCount++
      return base
    }

    const decrypted = hybridDecrypt(slot.value, privateKeyPem, publicKeyPem)

    if (decrypted !== null) {
      base.value = decrypted
      base.decryption_status = 'ok'
      decryptedCount++
    } else {
      base.decryption_status = 'failed'
      base.decryption_error = '解密失败 (密钥不匹配或格式错误)'
      failedCount++
    }

    return base
  })

  console.log(`  ✓ 解密完成: ${decryptedCount} 成功, ${failedCount} 失败`)

  return {
    db_path: dbPath,
    keys_path: keysPath,
    private_key_loaded: privateKeyPem !== null,
    total_slots: slots.length,
    encrypted_slots: encryptedSlots.length,
    decrypted_slots: decryptedCount,
    failed_slots: failedCount,
    endpoints,
    pages,
    slots: decryptedSlots,
  }
}

/**
 * 格式化输出结果
 */
function formatOutput(result, showAll) {
  let output = ''

  if (showAll) {
    return JSON.stringify(result, null, 2)
  }

  // 人类可读输出
  output += '='.repeat(70) + '\n'
  output += '  数据库解密报告\n'
  output += '='.repeat(70) + '\n\n'

  output += `数据库: ${result.db_path}\n`
  output += `密钥目录: ${result.keys_path}\n`
  output += `私钥状态: ${result.private_key_loaded ? '已加载 ✓' : '加载失败 ✗'}\n\n`

  output += `统计:\n`
  output += `  端点: ${result.endpoints.length}\n`
  output += `  步骤页: ${result.pages.length}\n`
  output += `  总槽: ${result.total_slots}\n`
  output += `  加密槽: ${result.encrypted_slots}\n`
  output += `  解密成功: ${result.decrypted_slots}\n`
  output += `  解密失败: ${result.failed_slots}\n\n`

  // 按端点分组显示
  for (const ep of result.endpoints) {
    const epPages = result.pages.filter(p => p.endpoint_id === ep.id)
    if (epPages.length === 0) continue

    output += `\n${'─'.repeat(70)}\n`
    output += `端点: ${ep.name} [${ep.login_type}] (ID: ${ep.id})\n`
    output += `${'─'.repeat(70)}\n`

    for (const page of epPages) {
      const pageSlots = result.slots.filter(s => s.page_id === page.id)
      if (pageSlots.length === 0) continue

      output += `\n  步骤 ${page.order_index}: ${page.url}`
      if (page.ssh_port) output += ` :${page.ssh_port}`
      output += `\n`

      for (const slot of pageSlots) {
        const status = slot.decryption_status === 'ok' ? '✓'
          : slot.decryption_status === 'failed' ? '✗'
          : slot.decryption_status === 'empty' ? '○'
          : '-'

        output += `\n    [${status}] ${slot.action_type}`
        if (slot.name) output += ` "${slot.name}"`
        output += ` (slot #${slot.id})\n`

        if (slot.decryption_status === 'ok') {
          // 掩码显示密码类敏感数据
          const displayValue = slot.action_type === 'password'
            ? '●'.repeat(Math.min(slot.value.length, 16))
            : slot.value.length > 80
              ? slot.value.substring(0, 80) + '...'
              : slot.value
          output += `      值: ${displayValue}\n`
          if (slot.username) output += `      用户名: ${slot.username}\n`
        } else if (slot.decryption_status === 'failed') {
          output += `      错误: ${slot.decryption_error}\n`
        } else if (slot.decryption_status === 'empty') {
          output += `      值: (空)\n`
        }
      }
    }
  }

  output += `\n${'='.repeat(70)}\n`
  return output
}

// ============================================================
// 主函数
// ============================================================

async function main() {
  console.log('数据库加密数据解密工具 v1.0 (JS)\n')

  const config = parseArgs()

  console.log(`数据库路径: ${config.dbPath}`)
  console.log(`密钥目录:   ${config.keysPath}`)
  console.log(`输出格式:   ${config.showAll ? '完整 JSON' : '可读报告'}`)
  console.log()

  const result = await loadAndDecrypt(config)

  const output = formatOutput(result, config.showAll)

  if (config.outputPath) {
    writeFileSync(config.outputPath, output, 'utf-8')
    console.log(`\n结果已写入: ${config.outputPath}`)
  } else {
    console.log(output)
  }
}

main().catch(err => {
  console.error('脚本执行失败:', err)
  process.exit(1)
})

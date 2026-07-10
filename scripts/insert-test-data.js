/**
 * 插入加密测试数据到 secure-ledger.db
 * 用于验证 decrypt-db.ts 脚本
 */
const crypto = require('crypto')
const { readFileSync, writeFileSync } = require('fs')
const { join } = require('path')
const appData = process.env.APPDATA || join(require('os').homedir(), 'AppData', 'Roaming')

async function main() {
  // Step 1: Load public key
  const pubKeyPath = join(appData, 'secure-ledger', 'keys', 'public.pem')
  const publicKey = readFileSync(pubKeyPath, 'utf-8')
  console.log('Public key loaded:', pubKeyPath)

  // Step 2: Encrypt short test value (RSA direct, <= 245 bytes)
  const testValue = 'my_secret_password_123!'
  const encrypted = crypto.publicEncrypt(
    { key: publicKey, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' },
    Buffer.from(testValue, 'utf-8')
  )
  const encryptedB64 = encrypted.toString('base64')
  console.log('RSA encrypted:', encryptedB64.substring(0, 60) + '...')

  // Step 3: Encrypt long test value (Hybrid: AES + RSA)
  const longValue = 'A'.repeat(300)
  const aesKey = crypto.randomBytes(32)
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv('aes-256-gcm', aesKey, iv)
  let encData = cipher.update(longValue, 'utf-8', 'hex')
  encData += cipher.final('hex')
  const authTag = cipher.getAuthTag()

  const aesKeyHex = aesKey.toString('hex')
  const encKey = crypto.publicEncrypt(
    { key: publicKey, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' },
    Buffer.from(aesKeyHex, 'utf-8')
  )
  const encKeyB64 = encKey.toString('base64')
  const hybridEncrypted = encKeyB64 + ':' + iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encData
  console.log('Hybrid encrypted:', hybridEncrypted.substring(0, 80) + '...')

  // Step 4: Insert into database
  const initSqlJs = require('sql.js')
  const SQL = await initSqlJs()
  const dbPath = join(appData, 'secure-ledger', 'secure-ledger.db')
  const fileBuffer = readFileSync(dbPath)
  const db = new SQL.Database(fileBuffer)

  const page = db.exec('SELECT id FROM page LIMIT 1')
  if (page.length === 0) {
    console.log('ERROR: No pages found')
    process.exit(1)
  }
  const pageId = page[0].values[0][0]
  console.log('Using page ID:', pageId)

  // Clean old test data
  db.run("DELETE FROM slot WHERE page_id = ? AND name LIKE 'TEST_%'", [pageId])

  // Insert RSA-encrypted test slot
  db.run(
    'INSERT INTO slot (page_id, order_index, name, element_xpath, action_type, value, is_encrypted, timeout) VALUES (?, 99, ?, ?, ?, ?, 1, 200)',
    [pageId, 'TEST_short_rsa', '//test[@name="short"]', 'input', encryptedB64]
  )

  // Insert hybrid-encrypted test slot
  db.run(
    'INSERT INTO slot (page_id, order_index, name, element_xpath, action_type, value, is_encrypted, timeout) VALUES (?, 100, ?, ?, ?, ?, 1, 200)',
    [pageId, 'TEST_long_hybrid', '//test[@name="long"]', 'password', hybridEncrypted]
  )

  // Save
  const data = db.export()
  writeFileSync(dbPath, Buffer.from(data))
  db.close()

  console.log('')
  console.log('=== Test data inserted ===')
  console.log('  Slot 1 (RSA):     "' + testValue + '"')
  console.log('  Slot 2 (Hybrid):  ' + longValue.length + ' "A" chars')
  console.log('')
  console.log('Now run: npm run decrypt-db')
}

main().catch(e => { console.error(e); process.exit(1) })

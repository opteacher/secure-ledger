/**
 * 混合加密模块
 * 
 * 使用 AES + RSA 混合加密方案处理任意长度的数据
 * - 短数据（≤245字节）：直接 RSA 加密
 * - 长数据（>245字节）：AES 加密数据 + RSA 加密 AES 密钥
 * 
 * 新方案（正确用法）：
 * - 加密：公钥加密（保护数据）
 * - 解密：私钥解密（需要私钥才能解密）
 * 
 * 格式：
 * - RSA 直接加密：Base64(RSA ciphertext)（长度256字节）
 * - 混合加密：Base64(RSA(AES key)) + ":" + Hex(IV) + ":" + Hex(AuthTag) + ":" + Hex(AES ciphertext)
 */
import crypto from 'crypto'
import { 
  publicEncrypt, 
  privateDecrypt, 
  loadPrivateKey, 
  loadPublicKey,
  // 旧方案（用于兼容）
  privateEncrypt,
  publicDecrypt
} from './rsa'

const AES_KEY_SIZE = 32 // 256 bits
const AES_IV_SIZE = 16 // 128 bits
const AES_ALGORITHM = 'aes-256-gcm'
const RSA_MAX_SIZE = 245 // RSA-2048 PKCS1 最大加密字节数

// ============================================
// 新方案：公钥加密 / 私钥解密
// ============================================

/**
 * 加密数据（自动选择方案）
 * 使用公钥加密，私钥解密
 * @param plaintext 明文
 * @returns 加密后的字符串
 */
export function hybridEncrypt(plaintext: string): string {
  if (!plaintext) {
    return plaintext
  }

  const buffer = Buffer.from(plaintext, 'utf-8')
  const byteLength = buffer.length

  // 短数据：直接 RSA 加密
  if (byteLength <= RSA_MAX_SIZE) {
    const encrypted = publicEncrypt(plaintext)
    if (encrypted) {
      return encrypted
    }
    console.warn('[Hybrid] RSA encryption failed, falling back to hybrid')
  }

  // 长数据：混合加密
  return aesRsaEncrypt(plaintext)
}

/**
 * AES + RSA 混合加密（新方案：公钥加密）
 * 1. 生成随机 AES 密钥
 * 2. 用 AES 加密数据
 * 3. 用 RSA 公钥加密 AES 密钥
 */
function aesRsaEncrypt(plaintext: string): string {
  // 生成随机 AES 密钥和 IV
  const aesKey = crypto.randomBytes(AES_KEY_SIZE)
  const iv = crypto.randomBytes(AES_IV_SIZE)

  // AES 加密数据
  const cipher = crypto.createCipheriv(AES_ALGORITHM, aesKey, iv)
  let encrypted = cipher.update(plaintext, 'utf-8', 'hex')
  encrypted += cipher.final('hex')
  const authTag = cipher.getAuthTag()

  // RSA 公钥加密 AES 密钥
  const aesKeyHex = aesKey.toString('hex')
  const encryptedKey = publicEncrypt(aesKeyHex)
  
  if (!encryptedKey) {
    console.error('[Hybrid] Failed to encrypt AES key with public key')
    throw new Error('Encryption failed')
  }

  // 格式：RSA(AES key):IV:AuthTag:AES ciphertext
  return `${encryptedKey}:${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`
}

/**
 * 解密数据（自动检测格式）
 * 支持新旧两种格式
 * @param ciphertext 密文
 * @returns 解密后的明文
 */
export function hybridDecrypt(ciphertext: string): string {
  if (!ciphertext) {
    return ciphertext
  }

  // 清理格式
  const cleanValue = ciphertext.replace(/[\r\n\s]/g, '')

  // 检查格式判断加密类型
  const parts = cleanValue.split(':')
  
  // 纯 RSA 加密：只有 Base64 字符串
  if (parts.length === 1) {
    // 优先尝试新格式（私钥解密）
    const decrypted = privateDecrypt(cleanValue)
    if (decrypted) {
      return decrypted
    }
    
    // 兼容旧格式（公钥解密）
    const oldDecrypted = publicDecrypt(cleanValue)
    if (oldDecrypted) {
      console.log('[Hybrid] Decrypted using legacy format, consider re-encrypting')
      return oldDecrypted
    }
    
    console.warn('[Hybrid] Decryption failed')
    throw new Error('Decryption failed')
  }

  // 混合加密
  if (parts.length === 4) {
    return aesRsaDecrypt(cleanValue)
  }

  // 其他格式
  console.warn('[Hybrid] Unknown format, returning original value')
  return ciphertext
}

/**
 * AES + RSA 混合解密
 * 支持新旧两种格式
 */
function aesRsaDecrypt(ciphertext: string): string {
  const parts = ciphertext.split(':')
  if (parts.length !== 4) {
    throw new Error('Invalid hybrid encryption format')
  }

  const [encryptedKey, ivHex, authTagHex, encryptedData] = parts

  // 优先尝试新格式：私钥解密 AES 密钥
  let aesKeyHex = privateDecrypt(encryptedKey)
  
  // 兼容旧格式：公钥解密 AES 密钥
  if (!aesKeyHex) {
    aesKeyHex = publicDecrypt(encryptedKey)
    if (aesKeyHex) {
      console.log('[Hybrid] Decrypted AES key using legacy format, consider re-encrypting')
    }
  }
  
  if (!aesKeyHex) {
    console.error('[Hybrid] Failed to decrypt AES key')
    throw new Error('Key decryption failed')
  }

  const aesKey = Buffer.from(aesKeyHex, 'hex')
  const iv = Buffer.from(ivHex, 'hex')
  const authTag = Buffer.from(authTagHex, 'hex')

  // AES 解密数据
  const decipher = crypto.createDecipheriv(AES_ALGORITHM, aesKey, iv)
  decipher.setAuthTag(authTag)

  try {
    let decrypted = decipher.update(encryptedData, 'hex', 'utf-8')
    decrypted += decipher.final('utf-8')
    return decrypted
  } catch (error) {
    console.error('[Hybrid] AES decryption failed:', error)
    throw new Error('Decryption failed')
  }
}

// ============================================
// Token 分享专用：对称密钥加密
// ============================================

/**
 * 使用对称密钥加密数据
 * 用于 Token 分享：分享端生成随机密钥，导入端用密钥解密
 * @param plaintext 明文
 * @param keyHex 十六进制格式的 AES 密钥（64字符 = 32字节）
 * @returns 加密后的字符串（格式：IV:AuthTag:Ciphertext，都是 Hex）
 */
export function symmetricEncrypt(plaintext: string, keyHex: string): string {
  if (!plaintext || !keyHex) {
    throw new Error('Missing plaintext or key')
  }
  
  const aesKey = Buffer.from(keyHex, 'hex')
  if (aesKey.length !== AES_KEY_SIZE) {
    throw new Error('Invalid key size')
  }
  
  const iv = crypto.randomBytes(AES_IV_SIZE)
  
  const cipher = crypto.createCipheriv(AES_ALGORITHM, aesKey, iv)
  let encrypted = cipher.update(plaintext, 'utf-8', 'hex')
  encrypted += cipher.final('hex')
  const authTag = cipher.getAuthTag()
  
  // 格式：IV:AuthTag:Ciphertext（都是 Hex）
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`
}

/**
 * 使用对称密钥解密数据
 * 用于 Token 导入：用分享端提供的密钥解密
 * @param ciphertext 密文（格式：IV:AuthTag:Ciphertext）
 * @param keyHex 十六进制格式的 AES 密钥
 * @returns 解密后的明文
 */
export function symmetricDecrypt(ciphertext: string, keyHex: string): string {
  if (!ciphertext || !keyHex) {
    throw new Error('Missing ciphertext or key')
  }
  
  const parts = ciphertext.split(':')
  if (parts.length !== 3) {
    throw new Error('Invalid symmetric encryption format')
  }
  
  const [ivHex, authTagHex, encryptedData] = parts
  
  const aesKey = Buffer.from(keyHex, 'hex')
  const iv = Buffer.from(ivHex, 'hex')
  const authTag = Buffer.from(authTagHex, 'hex')
  
  const decipher = crypto.createDecipheriv(AES_ALGORITHM, aesKey, iv)
  decipher.setAuthTag(authTag)
  
  try {
    let decrypted = decipher.update(encryptedData, 'hex', 'utf-8')
    decrypted += decipher.final('utf-8')
    return decrypted
  } catch (error) {
    console.error('[Hybrid] Symmetric decryption failed:', error)
    throw new Error('Decryption failed')
  }
}

/**
 * 生成随机对称密钥
 * @returns 十六进制格式的 32 字节密钥
 */
export function generateSymmetricKey(): string {
  return crypto.randomBytes(AES_KEY_SIZE).toString('hex')
}

// ============================================
// 检测函数
// ============================================

/**
 * 检查值是否已被加密（RSA 或混合加密）
 */
export function isHybridEncrypted(value: string): boolean {
  if (!value || value.length < 10) {
    return false
  }

  const cleanValue = value.replace(/[\r\n\s]/g, '')

  // 检查混合加密格式：4个部分
  const parts = cleanValue.split(':')
  if (parts.length === 4) {
    const encryptedKey = parts[0]
    
    // 检查是否是有效的 Base64
    if (!/^[A-Za-z0-9+/]+=*$/.test(encryptedKey)) {
      return false
    }

    // 解码检查长度
    try {
      const buffer = Buffer.from(encryptedKey, 'base64')
      return buffer.length === 256
    } catch {
      return false
    }
  }

  // 检查纯 RSA 加密
  if (parts.length === 1) {
    try {
      const buffer = Buffer.from(cleanValue, 'base64')
      return buffer.length === 256
    } catch {
      return false
    }
  }

  return false
}

/**
 * 检查是否是对称加密格式（用于 Token 分享）
 * 格式：IV:AuthTag:Ciphertext（3个 Hex 部分）
 */
export function isSymmetricEncrypted(value: string): boolean {
  if (!value || value.length < 10) {
    return false
  }
  
  const parts = value.split(':')
  if (parts.length !== 3) {
    return false
  }
  
  // 检查每个部分是否是有效的 Hex
  const hexRegex = /^[0-9a-fA-F]+$/
  return parts.every(part => hexRegex.test(part))
}
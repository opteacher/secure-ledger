/**
 * 混合加密模块
 * 
 * 使用 AES + RSA 混合加密方案处理任意长度的数据
 * - 短数据（≤245字节）：直接 RSA 加密
 * - 长数据（>245字节）：AES 加密数据 + RSA 加密 AES 密钥
 * 
 * 格式：
 * - RSA 直接加密：Base64(RSA ciphertext)（长度256字节）
 * - 混合加密：Base64(RSA(AES key)) + ":" + Hex(IV) + ":" + Hex(AuthTag) + ":" + Hex(AES ciphertext)
 */
import crypto from 'crypto'
import { privateEncrypt, publicDecrypt, loadPrivateKey, loadPublicKey } from './rsa'

const AES_KEY_SIZE = 32 // 256 bits
const AES_IV_SIZE = 16 // 128 bits
const AES_ALGORITHM = 'aes-256-gcm'
const RSA_MAX_SIZE = 245 // RSA-2048 PKCS1 最大加密字节数

/**
 * 加密数据（自动选择方案）
 * @param plaintext 明文
 * @returns 加密后的字符串
 */
export function hybridEncrypt(plaintext: string): string {
  if (!plaintext) {
    return plaintext
  }

  const buffer = Buffer.from(plaintext, 'utf-8')
  const byteLength = buffer.length

  // 短数据：直接加密
  if (byteLength <= RSA_MAX_SIZE) {
    const encrypted = privateEncrypt(plaintext)
    if (encrypted) {
      return encrypted
    }
    console.warn('[Hybrid] Encryption failed, falling back')
  }

  // 长数据：混合加密
  return aesRsaEncrypt(plaintext)
}

/**
 * AES + RSA 混合加密
 * 1. 生成随机 AES 密钥
 * 2. 用 AES 加密数据
 * 3. 用 RSA 加密 AES 密钥
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

  // RSA 加密 AES 密钥
  const aesKeyHex = aesKey.toString('hex')
  const encryptedKey = privateEncrypt(aesKeyHex)
  
  if (!encryptedKey) {
    console.error('[Hybrid] Failed to encrypt key')
    throw new Error('Encryption failed')
  }

  // 格式：RSA(AES key):IV:AuthTag:AES ciphertext
  return `${encryptedKey}:${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`
}

/**
 * 解密数据（自动检测格式）
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
  
  // 纯加密：只有 Base64 字符串
  if (parts.length === 1) {
    const decrypted = publicDecrypt(cleanValue)
    if (decrypted) {
      return decrypted
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
 */
function aesRsaDecrypt(ciphertext: string): string {
  const parts = ciphertext.split(':')
  if (parts.length !== 4) {
    throw new Error('Invalid hybrid encryption format')
  }

  const [encryptedKey, ivHex, authTagHex, encryptedData] = parts

  // RSA 解密 AES 密钥
  const aesKeyHex = publicDecrypt(encryptedKey)
  if (!aesKeyHex) {
    console.error('[Hybrid] Failed to decrypt key')
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
    console.error('[Hybrid] Decryption failed:', error)
    throw new Error('Decryption failed')
  }
}

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
    // 检查第一个部分是否是 RSA 加密的 AES 密钥
    const encryptedKey = parts[0]
    
    // 检查是否是有效的 Base64
    if (!/^[A-Za-z0-9+/]+=*$/.test(encryptedKey)) {
      return false
    }

    // 解码检查长度
    try {
      const buffer = Buffer.from(encryptedKey, 'base64')
      if (buffer.length === 256) {
        return true
      }
    } catch {
      return false
    }
  }

  // 检查纯加密
  if (parts.length === 1) {
    try {
      const buffer = Buffer.from(cleanValue, 'base64')
      if (buffer.length === 256) {
        // 尝试解密确认
        const publicKey = loadPublicKey()
        if (publicKey) {
          try {
            crypto.publicDecrypt(
              {
                key: publicKey,
                padding: crypto.constants.RSA_PKCS1_PADDING
              },
              buffer
            )
            return true
          } catch {
            return false
          }
        }
      }
    } catch {
      return false
    }
  }

  return false
}
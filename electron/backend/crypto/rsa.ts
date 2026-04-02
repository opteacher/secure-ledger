/**
 * RSA 加密模块
 * 
 * 正确的 RSA 用法：
 * - 加密：公钥加密（publicEncrypt）
 * - 解密：私钥解密（privateDecrypt）
 * 
 * 私钥加密存储在 private.pem.enc，需要系统密钥解密
 * 公钥明文存储在 public.pem
 */
import crypto from 'crypto'

// 缓存的密钥（由 secureKeyStorage 加载）
let cachedPrivateKey: string | null = null
let cachedPublicKey: string | null = null

/**
 * 设置缓存的私钥（由 secureKeyStorage 调用）
 */
export function setCachedPrivateKey(key: string | null): void {
  cachedPrivateKey = key
}

/**
 * 设置缓存的公钥（由 secureKeyStorage 调用）
 */
export function setCachedPublicKey(key: string | null): void {
  cachedPublicKey = key
}

/**
 * 获取缓存的私钥
 */
export function loadPrivateKey(): string | null {
  return cachedPrivateKey
}

/**
 * 获取缓存的公钥
 */
export function loadPublicKey(): string | null {
  return cachedPublicKey
}

/**
 * 检查是否有缓存的密钥对
 */
export function hasKeyPair(): boolean {
  return cachedPrivateKey !== null && cachedPublicKey !== null
}

/**
 * 清除缓存的密钥
 */
export function clearKeyCache(): void {
  if (cachedPrivateKey) {
    // 安全清除
    const length = cachedPrivateKey.length
    cachedPrivateKey = 'X'.repeat(length)
    cachedPrivateKey = null
  }
  cachedPublicKey = null
}

// ============================================
// 新方案：公钥加密 / 私钥解密（正确的 RSA 用法）
// ============================================

/**
 * 使用公钥加密数据
 * @param plaintext 明文
 * @returns Base64 编码的密文，失败返回 null
 */
export function publicEncrypt(plaintext: string): string | null {
  if (!cachedPublicKey) {
    console.error('[Crypto] No public key available for encryption')
    return null
  }
  
  if (!plaintext) {
    return null
  }
  
  const buffer = Buffer.from(plaintext, 'utf-8')
  const byteLength = buffer.length
  
  if (byteLength > 245) {
    console.error(`[Crypto] Data too long for RSA: ${byteLength} bytes`)
    return null
  }
  
  try {
    const encrypted = crypto.publicEncrypt(
      {
        key: cachedPublicKey,
        padding: crypto.constants.RSA_PKCS1_PADDING
      },
      buffer
    )
    return encrypted.toString('base64')
  } catch (error) {
    console.error('[Crypto] Public encryption failed:', error)
    return null
  }
}

/**
 * 使用公钥加密数据（指定公钥）
 * @param plaintext 明文
 * @param publicKey PEM 编码的公钥
 * @returns Base64 编码的密文，失败返回 null
 */
export function publicEncryptWithKey(plaintext: string, publicKey: string): string | null {
  if (!publicKey || !plaintext) {
    return null
  }
  
  const buffer = Buffer.from(plaintext, 'utf-8')
  
  if (buffer.length > 245) {
    return null
  }
  
  try {
    const encrypted = crypto.publicEncrypt(
      {
        key: publicKey,
        padding: crypto.constants.RSA_PKCS1_PADDING
      },
      buffer
    )
    return encrypted.toString('base64')
  } catch (error) {
    console.error('[Crypto] Public encryption with key failed:', error)
    return null
  }
}

/**
 * 使用私钥解密数据
 * @param ciphertext Base64 编码的密文
 * @returns 解密后的明文，失败返回 null
 */
export function privateDecrypt(ciphertext: string): string | null {
  if (!cachedPrivateKey) {
    return null
  }
  
  try {
    const buffer = Buffer.from(ciphertext, 'base64')
    const decrypted = crypto.privateDecrypt(
      {
        key: cachedPrivateKey,
        padding: crypto.constants.RSA_PKCS1_PADDING
      },
      buffer
    )
    return decrypted.toString('utf-8')
  } catch {
    // 静默失败 - 可能是旧格式数据（公钥加密），由调用方尝试公钥解密
    return null
  }
}

/**
 * 使用私钥解密数据（指定私钥）
 * @param ciphertext Base64 编码的密文
 * @param privateKey PEM 编码的私钥
 * @returns 解密后的明文，失败返回 null
 */
export function privateDecryptWithKey(ciphertext: string, privateKey: string): string | null {
  if (!privateKey || !ciphertext) {
    return null
  }
  
  try {
    const buffer = Buffer.from(ciphertext, 'base64')
    const decrypted = crypto.privateDecrypt(
      {
        key: privateKey,
        padding: crypto.constants.RSA_PKCS1_PADDING
      },
      buffer
    )
    return decrypted.toString('utf-8')
  } catch {
    // 静默失败
    return null
  }
}

// ============================================
// 旧方案：私钥加密 / 公钥解密（已废弃，仅用于数据迁移）
// ============================================

/**
 * @deprecated 使用 publicEncrypt 代替
 * 使用私钥加密数据（旧方案，仅用于数据迁移）
 */
export function privateEncrypt(plaintext: string): string | null {
  if (!cachedPrivateKey) {
    console.error('[Crypto] No private key available for encryption')
    return null
  }
  
  if (!plaintext) {
    return null
  }
  
  const buffer = Buffer.from(plaintext, 'utf-8')
  
  if (buffer.length > 245) {
    return null
  }
  
  try {
    const encrypted = crypto.privateEncrypt(
      {
        key: cachedPrivateKey,
        padding: crypto.constants.RSA_PKCS1_PADDING
      },
      buffer
    )
    return encrypted.toString('base64')
  } catch (error) {
    console.error('[Crypto] Private encryption failed:', error)
    return null
  }
}

/**
 * @deprecated 使用 privateDecrypt 代替
 * 使用公钥解密数据（旧方案，仅用于数据迁移）
 */
export function publicDecrypt(ciphertext: string): string | null {
  if (!cachedPublicKey) {
    return null
  }
  
  try {
    const buffer = Buffer.from(ciphertext, 'base64')
    const decrypted = crypto.publicDecrypt(
      {
        key: cachedPublicKey,
        padding: crypto.constants.RSA_PKCS1_PADDING
      },
      buffer
    )
    return decrypted.toString('utf-8')
  } catch {
    // 静默失败 - 可能是新格式数据（私钥加密）
    return null
  }
}

/**
 * @deprecated 用于旧数据迁移
 * 使用指定公钥解密数据（旧方案）
 */
export function publicDecryptWithKey(ciphertext: string, publicKey: string): string | null {
  if (!publicKey || !ciphertext) {
    return null
  }
  
  try {
    const buffer = Buffer.from(ciphertext, 'base64')
    const decrypted = crypto.publicDecrypt(
      {
        key: publicKey,
        padding: crypto.constants.RSA_PKCS1_PADDING
      },
      buffer
    )
    return decrypted.toString('utf-8')
  } catch {
    // 静默失败
    return null
  }
}

// ============================================
// 辅助函数
// ============================================

/**
 * 检查值是否已被加密（检测 RSA 密文格式）
 */
export function isEncrypted(value: string): boolean {
  if (!value || value.length < 10) {
    return false
  }
  
  const cleanValue = value.replace(/[\r\n\s]/g, '')
  
  // 检查是否是有效的 Base64
  if (!/^[A-Za-z0-9+/]+=*$/.test(cleanValue)) {
    return false
  }
  
  // 检查长度是否为 256 字节（RSA-2048 密文）
  try {
    const buffer = Buffer.from(cleanValue, 'base64')
    return buffer.length === 256
  } catch {
    return false
  }
}

/**
 * 检查值是否是旧格式加密（私钥加密）
 * 通过尝试用公钥解密来判断
 */
export function isOldFormatEncrypted(value: string): boolean {
  if (!isEncrypted(value)) {
    return false
  }
  
  if (!cachedPublicKey) {
    return false
  }
  
  try {
    const buffer = Buffer.from(value.replace(/[\r\n\s]/g, ''), 'base64')
    crypto.publicDecrypt(
      {
        key: cachedPublicKey,
        padding: crypto.constants.RSA_PKCS1_PADDING
      },
      buffer
    )
    return true
  } catch {
    return false
  }
}

/**
 * 检查值是否是新格式加密（公钥加密）
 * 通过尝试用私钥解密来判断
 */
export function isNewFormatEncrypted(value: string): boolean {
  if (!isEncrypted(value)) {
    return false
  }
  
  if (!cachedPrivateKey) {
    return false
  }
  
  try {
    const buffer = Buffer.from(value.replace(/[\r\n\s]/g, ''), 'base64')
    crypto.privateDecrypt(
      {
        key: cachedPrivateKey,
        padding: crypto.constants.RSA_PKCS1_PADDING
      },
      buffer
    )
    return true
  } catch {
    return false
  }
}

/**
 * 加密敏感值（如果尚未加密）
 * 使用新的公钥加密方案
 */
export function encryptIfNeeded(value: string, force: boolean = false): string {
  if (!value) {
    return value
  }
  
  // 如果已经是新格式加密，且不强制重新加密，直接返回
  if (!force && isNewFormatEncrypted(value)) {
    return value
  }
  
  const encrypted = publicEncrypt(value)
  return encrypted || value
}

/**
 * 解密值（自动检测格式）
 * 支持新旧两种格式
 */
export function decryptIfNeeded(value: string): string {
  if (!value) {
    return value
  }
  
  // 尝试新格式（私钥解密）
  if (cachedPrivateKey) {
    const decrypted = privateDecrypt(value)
    if (decrypted) {
      return decrypted
    }
  }
  
  // 尝试旧格式（公钥解密）- 用于迁移
  if (cachedPublicKey) {
    const decrypted = publicDecrypt(value)
    if (decrypted) {
      return decrypted
    }
  }
  
  // 无法解密，返回原值
  return value
}
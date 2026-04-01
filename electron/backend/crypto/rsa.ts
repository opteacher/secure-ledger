/**
 * RSA 加密模块
 * 
 * 提供同步的 RSA 加密/解密接口
 * 密钥通过 secureKeyStorage 安全加载
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

/**
 * 使用私钥加密数据
 * @param plaintext 明文
 * @returns Base64 编码的密文，失败返回 null
 */
export function privateEncrypt(plaintext: string): string | null {
  if (!cachedPrivateKey) {
    console.error('[Crypto] No key available for encryption')
    return null
  }
  
  if (!plaintext) {
    return null
  }
  
  const buffer = Buffer.from(plaintext, 'utf-8')
  const byteLength = buffer.length
  
  if (byteLength > 245) {
    console.error(`[Crypto] Data too long: ${byteLength} bytes`)
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
    console.error('[Crypto] Encryption failed:', error)
    return null
  }
}

/**
 * 使用公钥解密数据
 * @param ciphertext Base64 编码的密文
 * @returns 解密后的明文，失败返回 null
 */
export function publicDecrypt(ciphertext: string): string | null {
  if (!cachedPublicKey) {
    console.error('[Crypto] No key available for decryption')
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
  } catch (error) {
    console.error('[Crypto] Decryption failed:', error)
    return null
  }
}

/**
 * 检查值是否已被加密
 * 静默检查，不打印错误日志
 */
export function isEncrypted(value: string): boolean {
  if (!value || value.length < 10) {
    return false
  }
  
  // 移除可能的换行符和空格
  const cleanValue = value.replace(/[\r\n\s]/g, '')
  
  // 检查是否是有效的 Base64
  if (!/^[A-Za-z0-9+/]+=*$/.test(cleanValue)) {
    return false
  }
  
  // 尝试解码并检查长度
  try {
    const buffer = Buffer.from(cleanValue, 'base64')
    const decodedLength = buffer.length
    
    if (decodedLength !== 256) {
      return false
    }
  } catch (e) {
    return false
  }
  
  // 静默尝试解密来最终确认
  if (!cachedPublicKey) {
    return false
  }
  
  try {
    const buffer = Buffer.from(cleanValue, 'base64')
    crypto.publicDecrypt(
      {
        key: cachedPublicKey,
        padding: crypto.constants.RSA_PKCS1_PADDING
      },
      buffer
    )
    return true
  } catch (e) {
    return false
  }
}

/**
 * 加密敏感值（如果尚未加密）
 * @param value 明文或已加密的值
 * @param force 是否强制重新加密
 * @returns 加密后的值
 */
export function encryptIfNeeded(value: string, force: boolean = false): string {
  if (!value) {
    return value
  }
  
  // 如果不是强制加密，且值已经被加密，直接返回
  if (!force && isEncrypted(value)) {
    return value
  }
  
  const encrypted = privateEncrypt(value)
  return encrypted || value
}

/**
 * 解密值（如果已加密）
 * @param value 可能已加密的值
 * @returns 解密后的明文
 */
export function decryptIfNeeded(value: string): string {
  if (!value) {
    return value
  }
  
  // 尝试解密
  const decrypted = publicDecrypt(value)
  return decrypted || value
}
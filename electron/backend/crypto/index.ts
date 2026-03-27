import crypto from 'crypto'
import { randomBytes, pbkdf2Sync, createCipheriv, createDecipheriv } from 'crypto'

// 加密配置
const ALGORITHM = 'aes-256-gcm'
const KEY_LENGTH = 32 // 256 bits
const IV_LENGTH = 16 // 128 bits
const SALT_LENGTH = 32
const AUTH_TAG_LENGTH = 16
const PBKDF2_ITERATIONS = 100000

/**
 * 生成随机盐
 */
export function generateSalt(): string {
  return randomBytes(SALT_LENGTH).toString('hex')
}

/**
 * 从密码派生密钥
 * @param password 用户密码
 * @param salt 盐值
 * @returns 派生的密钥 (hex格式)
 */
export function deriveKey(password: string, salt: string): string {
  return pbkdf2Sync(
    password,
    Buffer.from(salt, 'hex'),
    PBKDF2_ITERATIONS,
    KEY_LENGTH,
    'sha256'
  ).toString('hex')
}

/**
 * 加密数据
 * @param plaintext 明文
 * @param key 加密密钥 (hex格式)
 * @returns 加密后的数据 (hex格式: iv:authTag:ciphertext)
 */
export function encrypt(plaintext: string, key: string): string {
  const iv = randomBytes(IV_LENGTH)
  const keyBuffer = Buffer.from(key, 'hex')
  
  const cipher = createCipheriv(ALGORITHM, keyBuffer, iv)
  
  let encrypted = cipher.update(plaintext, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  
  const authTag = cipher.getAuthTag()
  
  // 格式: iv:authTag:ciphertext
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`
}

/**
 * 解密数据
 * @param ciphertext 密文 (hex格式: iv:authTag:ciphertext)
 * @param key 解密密钥 (hex格式)
 * @returns 解密后的明文
 */
export function decrypt(ciphertext: string, key: string): string {
  const parts = ciphertext.split(':')
  if (parts.length !== 3) {
    throw new Error('无效的密文格式')
  }
  
  const [ivHex, authTagHex, encryptedData] = parts
  const iv = Buffer.from(ivHex, 'hex')
  const authTag = Buffer.from(authTagHex, 'hex')
  const keyBuffer = Buffer.from(key, 'hex')
  
  const decipher = createDecipheriv(ALGORITHM, keyBuffer, iv)
  decipher.setAuthTag(authTag)
  
  let decrypted = decipher.update(encryptedData, 'hex', 'utf8')
  decrypted += decipher.final('utf8')
  
  return decrypted
}

/**
 * 哈希密码
 * @param password 明文密码
 * @returns 哈希后的密码
 */
export function hashPassword(password: string): string {
  const salt = generateSalt()
  const hash = pbkdf2Sync(
    password,
    Buffer.from(salt, 'hex'),
    PBKDF2_ITERATIONS,
    KEY_LENGTH,
    'sha256'
  ).toString('hex')
  return `${salt}:${hash}`
}

/**
 * 验证密码
 * @param password 待验证的密码
 * @param storedHash 存储的哈希值 (salt:hash格式)
 * @returns 是否匹配
 */
export function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, hash] = storedHash.split(':')
  if (!salt || !hash) {
    return false
  }
  
  const computedHash = pbkdf2Sync(
    password,
    Buffer.from(salt, 'hex'),
    PBKDF2_ITERATIONS,
    KEY_LENGTH,
    'sha256'
  ).toString('hex')
  
  return hash === computedHash
}

/**
 * 生成主密钥
 * @returns 随机生成的主密钥 (hex格式)
 */
export function generateMasterKey(): string {
  return randomBytes(KEY_LENGTH).toString('hex')
}

/**
 * 加密主密钥
 * @param masterKey 主密钥
 * @param derivedKey 从用户密码派生的密钥
 * @returns 加密后的主密钥
 */
export function encryptMasterKey(masterKey: string, derivedKey: string): string {
  return encrypt(masterKey, derivedKey)
}

/**
 * 解密主密钥
 * @param encryptedMasterKey 加密的主密钥
 * @param derivedKey 从用户密码派生的密钥
 * @returns 主密钥
 */
export function decryptMasterKey(encryptedMasterKey: string, derivedKey: string): string {
  return decrypt(encryptedMasterKey, derivedKey)
}
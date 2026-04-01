/**
 * 安全密钥存储模块
 * 
 * 使用 Electron safeStorage API 加密私钥后存储到文件系统
 * - Windows: DPAPI
 * - macOS: Keychain
 * - Linux: Secret Service (GNOME Keyring / KWallet)
 */
import { safeStorage, app } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync } from 'fs'
import crypto from 'crypto'

// 密钥文件名
const KEYS_DIR_NAME = 'keys'
const PRIVATE_KEY_ENC_FILE = 'private.pem.enc'  // 加密的私钥
const PUBLIC_KEY_FILE = 'public.pem'            // 公钥（明文）

// RSA 密钥配置
const RSA_KEY_SIZE = 2048

// 密钥缓存（使用后应立即清除）
let cachedPrivateKey: string | null = null
let cachedPublicKey: string | null = null

/**
 * 获取密钥目录路径
 */
export function getKeysDirectory(): string {
  const userDataPath = app.getPath('userData')
  const keysDir = join(userDataPath, KEYS_DIR_NAME)
  
  if (!existsSync(keysDir)) {
    mkdirSync(keysDir, { recursive: true })
    
    // Windows: 设置目录为隐藏 + 系统
    if (process.platform === 'win32') {
      try {
        const { execSync } = require('child_process')
        execSync(`attrib +s +h "${keysDir}"`, { stdio: 'ignore' })
      } catch {
        // 忽略错误
      }
    }
  }
  
  return keysDir
}

/**
 * 获取加密私钥文件路径
 */
export function getPrivateKeyPath(): string {
  return join(getKeysDirectory(), PRIVATE_KEY_ENC_FILE)
}

/**
 * 获取公钥文件路径
 */
export function getPublicKeyPath(): string {
  return join(getKeysDirectory(), PUBLIC_KEY_FILE)
}

/**
 * 检查加密服务是否可用
 */
export async function isEncryptionAvailable(): Promise<boolean> {
  try {
    // 优先使用异步 API（推荐）
    if (safeStorage.isEncryptionAvailable()) {
      return true
    }
    return false
  } catch (error) {
    console.error('[SecureKeyStorage] Encryption availability check failed:', error)
    return false
  }
}

/**
 * 生成 RSA 密钥对
 */
export function generateKeyPair(): { privateKey: string; publicKey: string } {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: RSA_KEY_SIZE,
    publicKeyEncoding: {
      type: 'spki',
      format: 'pem'
    },
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'pem'
    }
  })
  
  return { privateKey, publicKey }
}

/**
 * 安全保存密钥对
 * 私钥使用 safeStorage 加密后存储
 */
export async function saveKeyPair(privateKey: string, publicKey: string): Promise<void> {
  const keysDir = getKeysDirectory()
  
  // 检查加密服务可用性
  const encryptionAvailable = await isEncryptionAvailable()
  if (!encryptionAvailable) {
    throw new Error('系统加密服务不可用，无法安全存储私钥')
  }
  
  try {
    // 使用 safeStorage 加密私钥
    const encryptedBuffer = safeStorage.encryptString(privateKey)
    
    // 写入加密的私钥
    writeFileSync(join(keysDir, PRIVATE_KEY_ENC_FILE), encryptedBuffer)
    
    // 公钥可以直接明文存储（公钥本身就是公开的）
    writeFileSync(join(keysDir, PUBLIC_KEY_FILE), publicKey, 'utf-8')
    
    // 更新缓存
    cachedPrivateKey = privateKey
    cachedPublicKey = publicKey
    
    console.log('[SecureKeyStorage] Key pair saved securely')
  } catch (error) {
    console.error('[SecureKeyStorage] Failed to save key pair:', error)
    throw error
  }
}

/**
 * 加载私钥（解密）
 */
export async function loadPrivateKey(): Promise<string | null> {
  // 返回缓存的私钥
  if (cachedPrivateKey) {
    return cachedPrivateKey
  }
  
  const privateKeyPath = getPrivateKeyPath()
  if (!existsSync(privateKeyPath)) {
    return null
  }
  
  try {
    // 读取加密的私钥
    const encryptedBuffer = readFileSync(privateKeyPath)
    
    // 使用 safeStorage 解密
    const privateKey = safeStorage.decryptString(encryptedBuffer)
    
    // 缓存
    cachedPrivateKey = privateKey
    
    return privateKey
  } catch (error) {
    console.error('[SecureKeyStorage] Failed to load private key:', error)
    return null
  }
}

/**
 * 加载公钥
 */
export function loadPublicKey(): string | null {
  if (cachedPublicKey) {
    return cachedPublicKey
  }
  
  const publicKeyPath = getPublicKeyPath()
  if (!existsSync(publicKeyPath)) {
    return null
  }
  
  try {
    cachedPublicKey = readFileSync(publicKeyPath, 'utf-8')
    return cachedPublicKey
  } catch (error) {
    console.error('[SecureKeyStorage] Failed to load public key:', error)
    return null
  }
}

/**
 * 检查密钥对是否存在
 */
export function hasKeyPair(): boolean {
  return existsSync(getPrivateKeyPath()) && existsSync(getPublicKeyPath())
}

/**
 * 初始化密钥对（如果不存在则生成）
 */
export async function initializeKeyPair(): Promise<boolean> {
  // 检查加密服务可用性
  const encryptionAvailable = await isEncryptionAvailable()
  if (!encryptionAvailable) {
    console.error('[SecureKeyStorage] Encryption service not available')
    
    // Linux 特殊处理：提示用户解锁密钥环
    if (process.platform === 'linux') {
      console.error('[SecureKeyStorage] Linux: Please ensure GNOME Keyring or KWallet is unlocked')
    }
    
    return false
  }
  
  if (hasKeyPair()) {
    // 加载现有密钥到缓存
    await loadPrivateKey()
    loadPublicKey()
    console.log('[SecureKeyStorage] Existing key pair loaded')
    return true
  }
  
  try {
    console.log('[SecureKeyStorage] Generating new key pair...')
    const { privateKey, publicKey } = generateKeyPair()
    await saveKeyPair(privateKey, publicKey)
    console.log('[SecureKeyStorage] New key pair generated and saved securely')
    return true
  } catch (error) {
    console.error('[SecureKeyStorage] Failed to generate key pair:', error)
    return false
  }
}

/**
 * 清除内存中的私钥缓存
 * 应在敏感操作后立即调用
 */
export function clearPrivateKeyCache(): void {
  if (cachedPrivateKey) {
    // 安全清除：先用随机字符覆盖
    const length = cachedPrivateKey.length
    cachedPrivateKey = 'X'.repeat(length)
    cachedPrivateKey = null
    console.log('[SecureKeyStorage] Private key cache cleared')
  }
}

/**
 * 执行敏感操作（自动清除缓存）
 */
export async function withPrivateKey<T>(operation: (key: string) => Promise<T>): Promise<T> {
  const privateKey = await loadPrivateKey()
  if (!privateKey) {
    throw new Error('Private key not available')
  }
  
  try {
    return await operation(privateKey)
  } finally {
    clearPrivateKeyCache()
  }
}

/**
 * 删除密钥对（用于重置）
 */
export function deleteKeyPair(): boolean {
  try {
    const privateKeyPath = getPrivateKeyPath()
    const publicKeyPath = getPublicKeyPath()
    
    if (existsSync(privateKeyPath)) {
      unlinkSync(privateKeyPath)
    }
    if (existsSync(publicKeyPath)) {
      unlinkSync(publicKeyPath)
    }
    
    // 清除缓存
    clearPrivateKeyCache()
    cachedPublicKey = null
    
    console.log('[SecureKeyStorage] Key pair deleted')
    return true
  } catch (error) {
    console.error('[SecureKeyStorage] Failed to delete key pair:', error)
    return false
  }
}

/**
 * 获取密钥状态
 */
export async function getKeyStatus(): Promise<{
  exists: boolean
  keySize: number
  keysDir: string
  encryptionAvailable: boolean
}> {
  return {
    exists: hasKeyPair(),
    keySize: RSA_KEY_SIZE,
    keysDir: getKeysDirectory(),
    encryptionAvailable: await isEncryptionAvailable()
  }
}
/**
 * 密钥层级管理模块
 *
 * v1.0 加密方案的核心模块
 * - 根密钥 (Root Key): 管理员部署的 root_public.pem，用于紧急恢复
 * - 端点子密钥 (Endpoint Sub-Key): 每个端点独立的 RSA-2048 密钥对
 * - 备份密钥 (Backup Key): 用根公钥加密的子私钥，用于紧急恢复
 *
 * 加密版本管理：
 * - version = null: 旧版本 (v0), 使用全局单一密钥对 (private.pem.enc / public.pem)
 * - version = 'v1.0': 新版本, 使用端点级密钥层级
 *
 * 数据库表（由 database/init.ts 创建）：
 * - endpoint_key: 端点子密钥存储表
 * - system_config: 系统配置表（加密版本等）
 */
import { safeStorage, app } from 'electron'
import crypto from 'crypto'
import { join } from 'path'
import { existsSync, readFileSync } from 'fs'
import { v4 as uuidv4 } from 'uuid'
import { db } from '../database/init'
import { hybridDecrypt, hybridEncryptWithKey, hybridDecryptWithKey, isHybridEncrypted } from './hybrid'
import {
  loadPrivateKey as loadGlobalPrivateKey,
  loadPublicKey as loadGlobalPublicKey
} from './secureKeyStorage'
import { setCachedPrivateKey, setCachedPublicKey } from './rsa'

// ============================================
// 常量
// ============================================

/** 当前加密方案版本 */
export const ENCRYPTION_VERSION = 'v1.0'

/** 根公钥文件名（位于 keys/ 目录） */
export const ROOT_PUBLIC_KEY_FILE = 'root_public.pem'

/** 系统配置表名 */
export const SYSTEM_CONFIG_TABLE = 'system_config'

/** RSA 密钥长度 */
const RSA_KEY_SIZE = 2048

/** AES 配置（备份加密用） */
const AES_ALGORITHM = 'aes-256-gcm'
const AES_KEY_SIZE = 32
const AES_IV_SIZE = 16

/** 备份加密格式前缀 */
const BACKUP_FORMAT_PREFIX = 'v1:'

// ============================================
// 接口定义
// ============================================

/** 端点子密钥记录 */
export interface EndpointKeyRecord {
  id: number
  endpoint_id: number
  sub_public_key: string // RSA-2048 PEM 格式公钥，明文
  encrypted_sub_private_key: string // safeStorage 加密的子私钥
  backup_encrypted_key: string // 根公钥加密的子私钥 — 紧急恢复用
  key_id: string // UUID
  created_at: string
}

/** 迁移结果 */
export interface MigrationResult {
  success: boolean
  endpointsMigrated: number
  slotsReEncrypted: number
  errors: string[]
}

// ============================================
// 根公钥缓存
// ============================================

/** 缓存的根公钥（PEM 字符串） */
let cachedRootPublicKey: string | null = null

/** 根公钥文件完整路径（初始化后设置） */
let rootPublicKeyPath: string = ''

// ============================================
// 辅助函数
// ============================================

/**
 * 获取 keys 目录路径
 */
function getKeysDir(): string {
  return join(app.getPath('userData'), 'keys')
}

// ============================================
// 根公钥管理
// ============================================

/**
 * 初始化根公钥
 * 从 userData/keys/root_public.pem 加载管理员部署的根公钥
 * @returns 加载状态和文件路径
 */
export function initRootPublicKey(): { loaded: boolean; path: string } {
  // 多路径查找: userData/keys/ → resources/keys/ (打包) → 项目根目录 (开发)
  const paths = [getKeysDir()]

  // 打包模式: resources/keys/
  if (process.resourcesPath) {
    paths.push(join(process.resourcesPath, 'keys'))
  }
  // 开发模式: 项目根目录 root-keys/
  if (process.env['VITE_DEV_SERVER_URL']) {
    paths.push(join(app.getAppPath(), '..', 'root-keys'))
  }

  for (const dir of paths) {
    const filePath = join(dir, ROOT_PUBLIC_KEY_FILE)
    if (!existsSync(filePath)) continue

    rootPublicKeyPath = filePath
    try {
      cachedRootPublicKey = readFileSync(filePath, 'utf-8')
      if (!cachedRootPublicKey.includes('-----BEGIN PUBLIC KEY-----')) {
        console.error('[KeyHierarchy] 根公钥文件格式无效:', filePath)
        cachedRootPublicKey = null
        continue
      }
      console.log('[KeyHierarchy] 根公钥加载成功:', filePath)
      return { loaded: true, path: filePath }
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : '未知错误'
      console.error('[KeyHierarchy] 根公钥加载失败:', errMsg)
      continue
    }
  }

  // 所有路径都找不到
  const fallbackPath = join(getKeysDir(), ROOT_PUBLIC_KEY_FILE)
  console.error('[KeyHierarchy] 根公钥未部署 — v1.0 方案强制要求')
  console.error('[KeyHierarchy] 管理员应在离线环境生成根密钥对，然后将 root_public.pem 部署到:')
  for (const p of paths) console.error('  -', p)
  return { loaded: false, path: fallbackPath }
}

/**
 * 获取缓存的根公钥
 * 如果未缓存则尝试从文件加载
 * @returns 根公钥 PEM 字符串，不存在返回 null
 */
export function getRootPublicKey(): string | null {
  if (cachedRootPublicKey) {
    return cachedRootPublicKey
  }

  // 尝试自动加载
  const filePath = rootPublicKeyPath || join(getKeysDir(), ROOT_PUBLIC_KEY_FILE)
  if (existsSync(filePath)) {
    try {
      cachedRootPublicKey = readFileSync(filePath, 'utf-8')
      if (!cachedRootPublicKey.includes('-----BEGIN PUBLIC KEY-----')) {
        cachedRootPublicKey = null
        return null
      }
      return cachedRootPublicKey
    } catch {
      return null
    }
  }

  return null
}

// ============================================
// 端点子密钥生成
// ============================================

/**
 * 生成端点子密钥对
 * 使用 RSA-2048，PEM 格式输出
 * @returns 包含公钥和私钥的对象
 */
export function generateEndpointSubKeyPair(): { publicKey: string; privateKey: string } {
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

  return { publicKey, privateKey }
}

// ============================================
// 备份密钥（根公钥加密子私钥）
// ============================================

/**
 * 使用根公钥加密子私钥生成备份
 * 使用混合加密（AES-256-GCM + RSA-OAEP-SHA256）处理大密钥
 * 格式：v1:base64(RSA加密的AES密钥):hex(IV):hex(AuthTag):hex(AES密文)
 * @param subPrivateKey 子私钥 PEM 字符串
 * @returns 加密后的备份字符串，根公钥不可用时返回 null
 */
export function createBackupEncryptedKey(subPrivateKey: string): string | null {
  const rootPublicKey = getRootPublicKey()
  if (!rootPublicKey) {
    console.warn('[KeyHierarchy] 无法创建备份：根公钥不可用')
    return null
  }

  if (!subPrivateKey) {
    console.error('[KeyHierarchy] 无法创建备份：子私钥为空')
    return null
  }

  try {
    // 1. 生成随机 AES 密钥和 IV
    const aesKey = crypto.randomBytes(AES_KEY_SIZE)
    const iv = crypto.randomBytes(AES_IV_SIZE)

    // 2. AES-256-GCM 加密子私钥
    const cipher = crypto.createCipheriv(AES_ALGORITHM, aesKey, iv)
    let encrypted = cipher.update(subPrivateKey, 'utf-8', 'hex')
    encrypted += cipher.final('hex')
    const authTag = cipher.getAuthTag()

    // 3. RSA-OAEP-SHA256 加密 AES 密钥
    const encryptedKey = crypto.publicEncrypt(
      {
        key: rootPublicKey,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: 'sha256'
      },
      aesKey
    )
    const encryptedKeyBase64 = encryptedKey.toString('base64')

    // 4. 组装备份格式
    const backup = `${BACKUP_FORMAT_PREFIX}${encryptedKeyBase64}:${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`

    return backup
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : '未知错误'
    console.error('[KeyHierarchy] 备份密钥创建失败:', errMsg)
    return null
  }
}

/**
 * 使用根私钥从备份恢复子私钥
 * 支持 v1: 格式的混合加密备份
 * @param backupKey 备份密文
 * @param rootPrivateKey 根私钥 PEM 字符串
 * @returns 解密后的子私钥，失败返回 null
 */
export function recoverSubPrivateKey(backupKey: string, rootPrivateKey: string): string | null {
  if (!backupKey || !rootPrivateKey) {
    console.error('[KeyHierarchy] 恢复子私钥失败：参数缺失')
    return null
  }

  try {
    // 检查备份格式前缀
    if (!backupKey.startsWith(BACKUP_FORMAT_PREFIX)) {
      console.error('[KeyHierarchy] 不支持的备份格式')
      return null
    }

    // 去除前缀
    const payload = backupKey.slice(BACKUP_FORMAT_PREFIX.length)
    const parts = payload.split(':')

    if (parts.length !== 4) {
      console.error('[KeyHierarchy] 备份格式无效')
      return null
    }

    const [encryptedKeyBase64, ivHex, authTagHex, encryptedData] = parts

    // 1. RSA-OAEP-SHA256 解密 AES 密钥
    const encryptedKeyBuffer = Buffer.from(encryptedKeyBase64, 'base64')
    const aesKeyBuffer = crypto.privateDecrypt(
      {
        key: rootPrivateKey,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: 'sha256'
      },
      encryptedKeyBuffer
    )

    // 2. AES-256-GCM 解密子私钥
    const iv = Buffer.from(ivHex, 'hex')
    const authTag = Buffer.from(authTagHex, 'hex')
    const decipher = crypto.createDecipheriv(AES_ALGORITHM, aesKeyBuffer, iv)
    decipher.setAuthTag(authTag)

    let decrypted = decipher.update(encryptedData, 'hex', 'utf-8')
    decrypted += decipher.final('utf-8')

    return decrypted
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : '未知错误'
    console.error('[KeyHierarchy] 子私钥恢复失败:', errMsg)
    return null
  }
}

// ============================================
// 端点密钥数据库操作
// ============================================

/**
 * 保存端点子密钥
 * - 使用 safeStorage 加密子私钥
 * - 使用根公钥创建紧急恢复备份
 * - 写入 endpoint_key 表
 * @param endpointId 端点 ID
 * @param subPublicKey 子公钥 PEM
 * @param subPrivateKey 子私钥 PEM
 * @returns 保存后的 EndpointKeyRecord，失败返回 null
 */
export function saveEndpointKeys(
  endpointId: number,
  subPublicKey: string,
  subPrivateKey: string
): EndpointKeyRecord | null {
  try {
    // 1. 使用 safeStorage 加密子私钥
    const encryptedBuffer = safeStorage.encryptString(subPrivateKey)
    const encryptedSubPrivateKey = Buffer.from(encryptedBuffer).toString('base64')

    // 2. 创建备份（根公钥加密子私钥）
    const backupEncryptedKey = createBackupEncryptedKey(subPrivateKey)
    if (!backupEncryptedKey) {
      console.warn('[KeyHierarchy] 备份密钥创建失败（根公钥可能未部署），继续保存')
    }

    // 3. 生成唯一 key_id
    const keyId = uuidv4()
    const now = new Date().toISOString()

    // 4. 写入数据库
    const result = db.run(
      `INSERT OR REPLACE INTO endpoint_key
        (endpoint_id, sub_public_key, encrypted_sub_private_key, backup_encrypted_key, key_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        endpointId,
        subPublicKey,
        encryptedSubPrivateKey,
        backupEncryptedKey || '',
        keyId,
        now
      ]
    )

    const record: EndpointKeyRecord = {
      id: result.lastInsertRowid as number,
      endpoint_id: endpointId,
      sub_public_key: subPublicKey,
      encrypted_sub_private_key: encryptedSubPrivateKey,
      backup_encrypted_key: backupEncryptedKey || '',
      key_id: keyId,
      created_at: now
    }

    console.log('[KeyHierarchy] 端点密钥已保存: endpointId=', endpointId, 'keyId=', keyId)
    return record
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : '未知错误'
    console.error('[KeyHierarchy] 端点密钥保存失败:', errMsg)
    return null
  }
}

/**
 * 加载端点密钥记录（不解密私钥）
 * @param endpointId 端点 ID
 * @returns EndpointKeyRecord 或 null
 */
export function loadEndpointKeys(endpointId: number): EndpointKeyRecord | null {
  try {
    const record = db.queryOne<{
      id: number
      endpoint_id: number
      sub_public_key: string
      encrypted_sub_private_key: string
      backup_encrypted_key: string
      key_id: string
      created_at: string
    }>(
      'SELECT * FROM endpoint_key WHERE endpoint_id = ?',
      [endpointId]
    )

    if (!record) {
      return null
    }

    return {
      id: record.id,
      endpoint_id: record.endpoint_id,
      sub_public_key: record.sub_public_key,
      encrypted_sub_private_key: record.encrypted_sub_private_key,
      backup_encrypted_key: record.backup_encrypted_key,
      key_id: record.key_id,
      created_at: record.created_at
    }
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : '未知错误'
    console.error('[KeyHierarchy] 端点密钥加载失败:', errMsg)
    return null
  }
}

/**
 * 加载并解密端点的子私钥
 * 从数据库加载加密的子私钥，使用 safeStorage 解密
 * @param endpointId 端点 ID
 * @returns 明文的子私钥 PEM 字符串，失败返回 null
 */
export function loadSubPrivateKey(endpointId: number): string | null {
  try {
    const record = loadEndpointKeys(endpointId)
    if (!record) {
      console.warn('[KeyHierarchy] 端点密钥记录不存在: endpointId=', endpointId)
      return null
    }

    // 使用 safeStorage 解密子私钥
    const encryptedBuffer = Buffer.from(record.encrypted_sub_private_key, 'base64')
    const privateKey = safeStorage.decryptString(encryptedBuffer)

    return privateKey
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : '未知错误'
    console.error('[KeyHierarchy] 子私钥解密失败:', errMsg)
    return null
  }
}

/**
 * 删除端点密钥记录
 * @param endpointId 端点 ID
 * @returns 是否成功删除
 */
export function deleteEndpointKeys(endpointId: number): boolean {
  try {
    const result = db.run('DELETE FROM endpoint_key WHERE endpoint_id = ?', [endpointId])
    const deleted = result.changes > 0

    if (deleted) {
      console.log('[KeyHierarchy] 端点密钥已删除: endpointId=', endpointId)
    } else {
      console.log('[KeyHierarchy] 未找到要删除的端点密钥: endpointId=', endpointId)
    }

    return deleted
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : '未知错误'
    console.error('[KeyHierarchy] 端点密钥删除失败:', errMsg)
    return false
  }
}

/**
 * 修复缺失的 backup_encrypted_key
 * 适用场景: 迁移时根公钥未部署 → 现根公钥已部署 → 补充备份
 */
export function repairMissingBackups(): { fixed: number; errors: string[] } {
  const errors: string[] = []
  let fixed = 0
  const rootPub = getRootPublicKey()
  if (!rootPub) return { fixed: 0, errors: ['根公钥不可用'] }

  const records = db.query<{ endpoint_id: number; encrypted_sub_private_key: string }>(
    "SELECT endpoint_id, encrypted_sub_private_key FROM endpoint_key WHERE backup_encrypted_key = '' OR backup_encrypted_key IS NULL"
  )
  for (const rec of records) {
    try {
      const sub = safeStorage.decryptString(Buffer.from(rec.encrypted_sub_private_key, 'base64'))
      const backup = crypto.publicEncrypt(
        { key: rootPub, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' },
        Buffer.from(sub)
      ).toString('base64')
      db.run('UPDATE endpoint_key SET backup_encrypted_key = ? WHERE endpoint_id = ?', [backup, rec.endpoint_id])
      fixed++
    } catch (e: any) { errors.push(`endpoint ${rec.endpoint_id}: ${e.message}`) }
  }
  return { fixed, errors }
}

// ============================================
// 加密版本管理
// ============================================

/**
 * 获取当前加密方案版本
 * 查询 system_config 表
 * @returns 版本字符串，null 表示旧版本 (v0)
 */
export function getEncryptionVersion(): string | null {
  try {
    const config = db.queryOne<{ key: string; value: string; updated_at: string }>(
      `SELECT key, value, updated_at FROM ${SYSTEM_CONFIG_TABLE} WHERE key = 'encryption_version'`
    )

    if (!config) {
      return null // 旧版本 v0
    }

    return config.value
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : '未知错误'
    console.error('[KeyHierarchy] 加密版本查询失败:', errMsg)
    return null
  }
}

/**
 * 设置当前加密方案版本为 v1.0
 * INSERT OR REPLACE 到 system_config 表
 */
export function setEncryptionVersion(): void {
  try {
    db.run(
      `INSERT OR REPLACE INTO ${SYSTEM_CONFIG_TABLE} (key, value, updated_at)
       VALUES ('encryption_version', ?, CURRENT_TIMESTAMP)`,
      [ENCRYPTION_VERSION]
    )
    console.log('[KeyHierarchy] 加密版本已设置为:', ENCRYPTION_VERSION)
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : '未知错误'
    console.error('[KeyHierarchy] 加密版本设置失败:', errMsg)
  }
}

// ============================================
// 从旧版本迁移
// ============================================

/**
 * 从 v0 旧版本迁移到 v1.0 密钥层级方案
 *
 * 流程：
 * 1. 检查是否已迁移 → 是则直接返回
 * 2. 加载旧的全局密钥对 (private.pem.enc / public.pem)
 * 3. 遍历所有端点，为每个端点生成新的子密钥对
 * 4. 对每个端点的加密 slot 值：使用旧全局密钥解密 → 使用新子公钥重新加密
 * 5. 设置版本号为 v1.0
 *
 * @returns 迁移结果：成功标记、迁移的端点数、重新加密的 slot 数、错误列表
 */
export async function migrateFromLegacy(): Promise<MigrationResult> {
  const errors: string[] = []
  let endpointsMigrated = 0
  let slotsReEncrypted = 0

  try {
    // 1. 检查是否已迁移
    const currentVersion = getEncryptionVersion()
    if (currentVersion === ENCRYPTION_VERSION) {
      console.log('[KeyHierarchy] 已是最新加密版本，跳过迁移')
      return {
        success: true,
        endpointsMigrated: 0,
        slotsReEncrypted: 0,
        errors: []
      }
    }

    console.log('[KeyHierarchy] 开始从旧版本迁移到 v1.0...')

    // 2. 加载旧的全局密钥对
    const globalPrivateKey = await loadGlobalPrivateKey()
    const globalPublicKey = loadGlobalPublicKey()

    if (!globalPrivateKey || !globalPublicKey) {
      const msg = '无法加载旧全局密钥对，迁移终止'
      console.error('[KeyHierarchy]', msg)
      return {
        success: false,
        endpointsMigrated: 0,
        slotsReEncrypted: 0,
        errors: [msg]
      }
    }

    // 将旧密钥设置到 rsa 缓存，供 hybridDecrypt 使用
    setCachedPrivateKey(globalPrivateKey)
    setCachedPublicKey(globalPublicKey)
    console.log('[KeyHierarchy] 旧全局密钥对已加载到缓存')

    // 3. 获取所有端点
    const endpoints = db.query<{ id: number; name: string }>(
      'SELECT id, name FROM endpoint ORDER BY id'
    )

    if (endpoints.length === 0) {
      console.log('[KeyHierarchy] 没有端点需要迁移')
      setEncryptionVersion() // 直接标记版本
      return {
        success: true,
        endpointsMigrated: 0,
        slotsReEncrypted: 0,
        errors: []
      }
    }

    console.log(`[KeyHierarchy] 共 ${endpoints.length} 个端点需要迁移`)

    // 4. 逐个端点迁移
    for (const endpoint of endpoints) {
      try {
        console.log(`[KeyHierarchy] 迁移端点: ${endpoint.name} (id=${endpoint.id})`)

        // 检查是否已有子密钥（上次迁移可能部分完成）
        const existingKeys = loadEndpointKeys(endpoint.id)
        if (existingKeys) {
          console.log(`[KeyHierarchy] 端点 ${endpoint.id} 已有子密钥，跳过生成`)

          // 仍需检查是否有 slot 未重加密（上次可能中断）
          const slots = db.query<{ id: number; value: string; is_encrypted: number }>(
            `SELECT s.id, s.value, s.is_encrypted
             FROM slot s JOIN page p ON s.page_id = p.id
             WHERE p.endpoint_id = ? AND s.is_encrypted = 1 AND s.value IS NOT NULL AND s.value != ''`,
            [endpoint.id]
          )

          let reEncrypted = 0
          for (const slot of slots) {
            if (!isHybridEncrypted(slot.value)) continue
            try {
              // 尝试用子私钥解密（上次可能已部分迁移）
              const subPriv = safeStorage.decryptString(Buffer.from(existingKeys.encrypted_sub_private_key, 'base64'))
              let decrypted = hybridDecryptWithKey(slot.value, subPriv)
              if (!decrypted) {
                // 子密钥解密失败 → 仍用旧全局密钥
                decrypted = hybridDecrypt(slot.value)
              }
              // 重新加密（确保用子公钥）
              const reEncryptedValue = hybridEncryptWithKey(decrypted, existingKeys.sub_public_key)
              db.run('UPDATE slot SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [reEncryptedValue, slot.id])
              reEncrypted++
            } catch (e: any) {
              errors.push(`slot ${slot.id}: ${e.message}`)
            }
          }
          if (reEncrypted > 0) {
            slotsReEncrypted += reEncrypted
            console.log(`[KeyHierarchy] 端点 ${endpoint.id} 补重加密 ${reEncrypted} 个 slot`)
          }
          endpointsMigrated++
          continue
        }

        // a. 生成新的子密钥对
        const { publicKey: subPublicKey, privateKey: subPrivateKey } =
          generateEndpointSubKeyPair()

        // b. 保存子密钥对
        const saved = saveEndpointKeys(endpoint.id, subPublicKey, subPrivateKey)
        if (!saved) {
          errors.push(`端点 ${endpoint.id} (${endpoint.name}): 子密钥保存失败`)
          continue
        }

        // c. 查找该端点下所有加密的 slot（通过 page 关联）
        const slots = db.query<{
          id: number
          value: string
          is_encrypted: number
        }>(
          `SELECT s.id, s.value, s.is_encrypted
           FROM slot s
           JOIN page p ON s.page_id = p.id
           WHERE p.endpoint_id = ?
             AND s.is_encrypted = 1
             AND s.value IS NOT NULL
             AND s.value != ''`,
          [endpoint.id]
        )

        // d. 重新加密每个 slot
        for (const slot of slots) {
          try {
            // 跳过非混合加密格式的值
            if (!isHybridEncrypted(slot.value)) {
              console.log(`[KeyHierarchy] 跳过非混合加密的 slot ${slot.id}`)
              continue
            }

            // 使用旧全局密钥解密
            let decryptedValue: string
            try {
              decryptedValue = hybridDecrypt(slot.value)
            } catch (decryptError: unknown) {
              const errMsg =
                decryptError instanceof Error ? decryptError.message : '未知错误'
              console.error(`[KeyHierarchy] slot ${slot.id} 解密失败:`, errMsg)
              errors.push(`slot ${slot.id}: 解密失败 - ${errMsg}`)
              continue
            }

            if (!decryptedValue) {
              errors.push(`slot ${slot.id}: 解密结果为空`)
              continue
            }

            // 使用新子公钥重新加密
            let reEncryptedValue: string
            try {
              reEncryptedValue = hybridEncryptWithKey(decryptedValue, subPublicKey)
            } catch (encryptError: unknown) {
              const errMsg =
                encryptError instanceof Error ? encryptError.message : '未知错误'
              console.error(`[KeyHierarchy] slot ${slot.id} 重新加密失败:`, errMsg)
              errors.push(`slot ${slot.id}: 重新加密失败 - ${errMsg}`)
              continue
            }

            if (!reEncryptedValue) {
              errors.push(`slot ${slot.id}: 重新加密结果为空`)
              continue
            }

            // 更新数据库
            db.run('UPDATE slot SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [
              reEncryptedValue,
              slot.id
            ])
            slotsReEncrypted++
          } catch (slotError: unknown) {
            const errMsg = slotError instanceof Error ? slotError.message : '未知错误'
            console.error(`[KeyHierarchy] slot ${slot.id} 迁移异常:`, errMsg)
            errors.push(`slot ${slot.id}: ${errMsg}`)
          }
        }

        endpointsMigrated++
        console.log(
          `[KeyHierarchy] 端点 ${endpoint.name} 迁移完成: ${slots.length} 个 slot 已处理`
        )
      } catch (endpointError: unknown) {
        const errMsg = endpointError instanceof Error ? endpointError.message : '未知错误'
        console.error(`[KeyHierarchy] 端点 ${endpoint.id} 迁移失败:`, errMsg)
        errors.push(`端点 ${endpoint.id} (${endpoint.name}): ${errMsg}`)
      }
    }

    // 5. 设置版本号（即使有部分错误也标记，已成功的端点不会再重复迁移）
    setEncryptionVersion()

    // 不因部分错误而标记失败 — 已迁移的端点不会重复
    const success = errors.length === 0
    if (!success) {
      console.warn('[KeyHierarchy] 迁移有部分错误，已成功迁移的端点不会重复处理')
    }
    console.log(
      `[KeyHierarchy] 迁移完成: ${endpointsMigrated} 个端点, ${slotsReEncrypted} 个 slot 重新加密, ${errors.length} 个错误`
    )

    return {
      success,
      endpointsMigrated,
      slotsReEncrypted,
      errors
    }
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : '未知错误'
    console.error('[KeyHierarchy] 迁移过程发生严重错误:', errMsg)
    errors.push(`致命错误: ${errMsg}`)

    return {
      success: false,
      endpointsMigrated,
      slotsReEncrypted,
      errors
    }
  }
}

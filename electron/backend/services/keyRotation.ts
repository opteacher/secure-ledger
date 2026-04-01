/**
 * RSA 密钥轮换服务
 * 
 * 定时重新生成密钥对，并对所有加密数据进行重新加密
 * 流程：
 * 1. 用旧密钥解密所有加密数据
 * 2. 生成新密钥对
 * 3. 用新密钥重新加密
 * 4. 安全存储新密钥
 */
import { db } from '../database/init'
import {
  getKeysDirectory,
  generateKeyPair,
  saveKeyPair,
  loadPrivateKey,
  loadPublicKey,
  isEncryptionAvailable,
  hasKeyPair
} from '../crypto/secureKeyStorage'
import * as rsa from '../crypto/rsa'
import { hybridEncrypt, hybridDecrypt, isHybridEncrypted } from '../crypto/hybrid'
import { join } from 'path'
import { readdirSync, statSync, existsSync, mkdirSync } from 'fs'

// 配置
const DEFAULT_ROTATION_INTERVAL = 7 * 24 * 60 * 60 * 1000 // 7天（毫秒）

// 轮换状态
let rotationTimer: NodeJS.Timeout | null = null
let lastRotationTime: Date | null = null
let isRotating = false

// 轮换结果接口
export interface RotationResult {
  success: boolean
  message: string
  details: {
    appLockPassword: boolean
    slotsTotal: number
    slotsReEncrypted: number
    slotsSkipped: number
    errors: string[]
  }
}

/**
 * 解密并重新加密应用锁密码（使用混合加密）
 */
function reEncryptAppLockPassword(): { success: boolean; message: string } {
  try {
    const result = db.queryOne<{ lock_password_hash: string }>(
      'SELECT lock_password_hash FROM app_lock_settings WHERE id = 1'
    )
    
    if (!result?.lock_password_hash) {
      return { success: true, message: 'No password to re-encrypt' }
    }
    
    // 如果不是混合加密的，跳过
    if (!isHybridEncrypted(result.lock_password_hash)) {
      return { success: true, message: 'Password not encrypted, skipping' }
    }
    
    // 解密（使用旧密钥）
    const decryptedPassword = hybridDecrypt(result.lock_password_hash)
    if (!decryptedPassword) {
      return { success: false, message: 'Failed to decrypt password with old key' }
    }
    
    // 用新密钥加密
    const newEncryptedPassword = hybridEncrypt(decryptedPassword)
    if (!newEncryptedPassword) {
      return { success: false, message: 'Failed to encrypt password with new key' }
    }
    
    // 更新数据库
    db.run(
      'UPDATE app_lock_settings SET lock_password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 1',
      [newEncryptedPassword]
    )
    
    return { success: true, message: 'Password re-encrypted successfully' }
  } catch (error: any) {
    return { success: false, message: error.message }
  }
}

/**
 * 解密并重新加密 slot 值（使用混合加密）
 */
function reEncryptSlotValue(slotId: number): { success: boolean; message: string } {
  try {
    const slot = db.queryOne<{ id: number; value: string; is_encrypted: number }>(
      'SELECT id, value, is_encrypted FROM slot WHERE id = ?',
      [slotId]
    )
    
    if (!slot || !slot.value) {
      return { success: true, message: 'No value to re-encrypt' }
    }
    
    // 如果不是加密的，跳过
    if (!slot.is_encrypted) {
      return { success: true, message: 'Value not encrypted, skipping' }
    }
    
    // 如果不是混合加密的，跳过
    if (!isHybridEncrypted(slot.value)) {
      return { success: true, message: 'Value not encrypted, skipping' }
    }
    
    // 解密（使用旧密钥）
    const decryptedValue = hybridDecrypt(slot.value)
    if (!decryptedValue) {
      return { success: false, message: 'Failed to decrypt with old key' }
    }
    
    // 用新密钥加密
    const newEncryptedValue = hybridEncrypt(decryptedValue)
    if (!newEncryptedValue) {
      return { success: false, message: 'Failed to encrypt with new key' }
    }
    
    // 更新数据库
    db.run(
      'UPDATE slot SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [newEncryptedValue, slotId]
    )
    
    return { success: true, message: 'Value re-encrypted successfully' }
  } catch (error: any) {
    return { success: false, message: error.message }
  }
}

/**
 * 获取所有混合加密的 slot IDs
 */
function getHybridEncryptedSlots(): number[] {
  const slots = db.query<{ id: number; value: string; is_encrypted: number }>(
    'SELECT id, value, is_encrypted FROM slot WHERE is_encrypted = 1 AND value IS NOT NULL AND value != ""'
  )
  
  return slots
    .filter(slot => isHybridEncrypted(slot.value))
    .map(slot => slot.id)
}

/**
 * 执行密钥轮换
 */
export async function rotateKeys(): Promise<RotationResult> {
  if (isRotating) {
    return {
      success: false,
      message: 'Key rotation already in progress',
      details: {
        appLockPassword: false,
        slotsTotal: 0,
        slotsReEncrypted: 0,
        slotsSkipped: 0,
        errors: ['Rotation already in progress']
      }
    }
  }
  
  isRotating = true
  const errors: string[] = []
  let appLockPasswordSuccess = false
  let slotsTotal = 0
  let slotsReEncrypted = 0
  let slotsSkipped = 0
  
  console.log('[KeyRotation] Starting key rotation...')
  
  try {
    // 1. 检查加密服务可用性
    const encryptionAvailable = await isEncryptionAvailable()
    if (!encryptionAvailable) {
      throw new Error('System encryption service not available')
    }
    
    // 2. 加载旧密钥（用于解密现有数据）
    const oldPrivateKey = await loadPrivateKey()
    const oldPublicKey = loadPublicKey()
    
    if (!oldPrivateKey || !oldPublicKey) {
      throw new Error('No existing keys to rotate')
    }
    
    // 将旧密钥设置到 rsa 模块的缓存（用于解密）
    rsa.setCachedPrivateKey(oldPrivateKey)
    rsa.setCachedPublicKey(oldPublicKey)
    
    console.log('[KeyRotation] Old keys loaded')
    
    // 3. 先解密所有需要重新加密的数据（保存明文到内存）
    console.log('[KeyRotation] Processing data with old keys...')
    
    // 解密应用锁密码
    let decryptedAppLockPassword: string | null = null
    const appLockResult = db.queryOne<{ lock_password_hash: string }>(
      'SELECT lock_password_hash FROM app_lock_settings WHERE id = 1'
    )
    if (appLockResult?.lock_password_hash && isHybridEncrypted(appLockResult.lock_password_hash)) {
      try {
        decryptedAppLockPassword = hybridDecrypt(appLockResult.lock_password_hash)
      } catch (error: any) {
        errors.push(`Sensitive data processing failed: ${error.message}`)
      }
    }
    
    // 解密所有 slot 值
    const slotIds = getHybridEncryptedSlots()
    slotsTotal = slotIds.length
    const decryptedSlots: Map<number, string> = new Map()
    
    for (const slotId of slotIds) {
      try {
        const slot = db.queryOne<{ id: number; value: string }>(
          'SELECT id, value FROM slot WHERE id = ?',
          [slotId]
        )
        if (slot?.value) {
          const decryptedValue = hybridDecrypt(slot.value)
          decryptedSlots.set(slotId, decryptedValue)
        }
      } catch (error: any) {
        slotsSkipped++
        errors.push(`Slot ${slotId} processing failed: ${error.message}`)
      }
    }
    
    console.log(`[KeyRotation] Processed ${decryptedSlots.size} slots`)
    
    // 4. 生成新密钥对
    console.log('[KeyRotation] Generating new key pair...')
    const { privateKey: newPrivateKey, publicKey: newPublicKey } = generateKeyPair()
    
    // 5. 设置新密钥到缓存
    rsa.setCachedPrivateKey(newPrivateKey)
    rsa.setCachedPublicKey(newPublicKey)
    
    console.log('[KeyRotation] New keys ready')
    
    // 6. 用新密钥重新加密应用锁密码
    console.log('[KeyRotation] Re-encrypting sensitive data...')
    if (decryptedAppLockPassword) {
      try {
        const newEncryptedPassword = hybridEncrypt(decryptedAppLockPassword)
        db.run(
          'UPDATE app_lock_settings SET lock_password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 1',
          [newEncryptedPassword]
        )
        appLockPasswordSuccess = true
        console.log('[KeyRotation] Sensitive data re-encrypted')
      } catch (error: any) {
        errors.push(`App lock password re-encryption failed: ${error.message}`)
      }
    }
    
    // 7. 用新密钥重新加密所有 slot 值
    console.log('[KeyRotation] Re-encrypting slot values...')
    decryptedSlots.forEach((decryptedValue, slotId) => {
      try {
        const newEncryptedValue = hybridEncrypt(decryptedValue)
        db.run(
          'UPDATE slot SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
          [newEncryptedValue, slotId]
        )
        slotsReEncrypted++
      } catch (error: any) {
        slotsSkipped++
        errors.push(`Slot ${slotId} re-encryption failed: ${error.message}`)
      }
    })
    
    console.log(`[KeyRotation] Re-encrypted ${slotsReEncrypted} slots`)
    
    // 7. 安全保存新密钥
    console.log('[KeyRotation] Saving new keys securely...')
    await saveKeyPair(newPrivateKey, newPublicKey)
    
    lastRotationTime = new Date()
    
    const success = errors.length === 0 || errors.every(e => e.includes('not encrypted') || e.includes('No '))
    const message = success
      ? `Key rotation completed: ${slotsReEncrypted} slots re-encrypted`
      : `Key rotation completed with ${errors.length} warnings`
    
    console.log('[KeyRotation]', message)
    
    return {
      success: true,
      message,
      details: {
        appLockPassword: appLockPasswordSuccess,
        slotsTotal,
        slotsReEncrypted,
        slotsSkipped,
        errors
      }
    }
    
  } catch (error: any) {
    console.error('[KeyRotation] Key rotation failed:', error)
    
    return {
      success: false,
      message: `Key rotation failed: ${error.message}`,
      details: {
        appLockPassword: false,
        slotsTotal,
        slotsReEncrypted,
        slotsSkipped,
        errors: [...errors, error.message]
      }
    }
  } finally {
    isRotating = false
  }
}

/**
 * 启动定时轮换
 * @param intervalMs 轮换间隔（毫秒），默认7天
 */
export function startScheduledRotation(intervalMs: number = DEFAULT_ROTATION_INTERVAL): void {
  if (rotationTimer) {
    console.log('[KeyRotation] Scheduled rotation already running')
    return
  }
  
  console.log(`[KeyRotation] Starting scheduled rotation every ${intervalMs / 1000 / 60 / 60 / 24} days`)
  
  rotationTimer = setInterval(async () => {
    console.log('[KeyRotation] Scheduled rotation triggered')
    try {
      await rotateKeys()
    } catch (error) {
      console.error('[KeyRotation] Scheduled rotation error:', error)
    }
  }, intervalMs)
  
  // 防止定时器阻止进程退出
  if (rotationTimer.unref) {
    rotationTimer.unref()
  }
}

/**
 * 停止定时轮换
 */
export function stopScheduledRotation(): void {
  if (rotationTimer) {
    clearInterval(rotationTimer)
    rotationTimer = null
    console.log('[KeyRotation] Scheduled rotation stopped')
  }
}

/**
 * 获取轮换状态
 */
export function getRotationStatus(): {
  isRotating: boolean
  isScheduled: boolean
  lastRotationTime: Date | null
  nextRotationTime: Date | null
} {
  let nextRotationTime: Date | null = null
  if (rotationTimer) {
    if (lastRotationTime) {
      nextRotationTime = new Date(lastRotationTime.getTime() + DEFAULT_ROTATION_INTERVAL)
    } else {
      nextRotationTime = new Date(Date.now() + DEFAULT_ROTATION_INTERVAL)
    }
  }
  
  return {
    isRotating,
    isScheduled: rotationTimer !== null,
    lastRotationTime,
    nextRotationTime
  }
}
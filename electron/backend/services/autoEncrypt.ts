/**
 * 自动加密服务
 * 
 * 应用启动时自动检查并加密未加密的敏感数据
 * - 应用锁密码
 * - 操作槽值（is_encrypted = 1）
 */
import { db } from '../database/init'
import { hybridEncrypt, isHybridEncrypted } from '../crypto/hybrid'

/**
 * 自动加密应用锁密码
 * 如果未加密，则使用混合加密方案加密
 */
export function autoEncryptAppLockPassword(): { success: boolean; message: string } {
  const result = db.queryOne<{ lock_password_hash: string }>(
    'SELECT lock_password_hash FROM app_lock_settings WHERE id = 1'
  )

  if (!result?.lock_password_hash) {
    return { success: true, message: 'No password' }
  }

  // 检查是否已加密（新方案）
  if (isHybridEncrypted(result.lock_password_hash)) {
    return { success: true, message: 'Already encrypted' }
  }

  // 检查数据长度判断是否是旧的 PBKDF2 哈希
  const byteLength = Buffer.from(result.lock_password_hash, 'utf-8').length
  
  // 如果长度很长，说明是旧数据格式
    // 旧数据无法迁移，只能等待用户重新输入
    if (byteLength > 250) {
      console.log('[AutoEncrypt] Legacy password format detected, clearing')
      
      // 清除旧密码
      db.run('UPDATE app_lock_settings SET lock_password_hash = NULL WHERE id = 1')
      
      return { 
        success: true, 
        message: 'Legacy password cleared - please set new password' 
      }
    }

  // 短数据（明文密码），直接加密
  try {
    const encrypted = hybridEncrypt(result.lock_password_hash)
    
    db.run(
      'UPDATE app_lock_settings SET lock_password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 1',
      [encrypted]
    )
    
    console.log('[AutoEncrypt] App lock password encrypted')
    return { success: true, message: 'Password encrypted' }
  } catch (error: any) {
    console.error('[AutoEncrypt] Failed to encrypt app lock password:', error)
    return { success: false, message: error.message }
  }
}

/**
 * 自动加密所有操作槽值
 * 只加密标记为 is_encrypted = 1 的值
 */
export function autoEncryptAllSlots(): { 
  total: number
  encrypted: number
  skipped: number
  errors: string[]
} {
  const result = {
    total: 0,
    encrypted: 0,
    skipped: 0,
    errors: [] as string[]
  }

  // 获取所有标记为加密但实际未加密的 slot
  const slots = db.query<{ id: number; value: string }>(
    'SELECT id, value FROM slot WHERE is_encrypted = 1 AND value IS NOT NULL AND value != ""'
  )

  result.total = slots.length

  for (const slot of slots) {
    // 检查是否已加密（新方案）
    if (isHybridEncrypted(slot.value)) {
      result.skipped++
      continue
    }

    // 未加密的数据，使用混合加密
    try {
      const encrypted = hybridEncrypt(slot.value)
      
      db.run(
        'UPDATE slot SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [encrypted, slot.id]
      )
      
      result.encrypted++
    } catch (error: any) {
      result.errors.push(`Slot ${slot.id}: ${error.message}`)
      result.skipped++
    }
  }

  if (result.encrypted > 0 || result.errors.length > 0) {
    console.log(`[AutoEncrypt] Slots: ${result.encrypted} encrypted, ${result.skipped} skipped`)
  }
  return result
}

/**
 * 应用启动时自动加密所有未加密的敏感数据
 */
export function autoEncryptOnStartup(): {
  appLockPassword: { success: boolean; message: string }
  slots: { total: number; encrypted: number; skipped: number; errors: string[] }
} {
  const appLockResult = autoEncryptAppLockPassword()
  const slotsResult = autoEncryptAllSlots()
  
  return {
    appLockPassword: appLockResult,
    slots: slotsResult
  }
}
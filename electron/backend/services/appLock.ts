/**
 * 应用锁定服务
 * 管理应用自动锁定设置和解锁验证
 */
import { db } from '../database/init'

export interface AppLockSettings {
  id: number
  is_enabled: boolean
  is_locked: boolean      // 应用是否处于锁定状态
  lock_delay_minutes: number
  has_password: boolean  // 是否已设置密码（不返回实际密码）
  created_at: string
  updated_at: string
}

/**
 * 获取锁定设置
 */
export function getLockSettings(): AppLockSettings {
  // 先尝试查询，如果 is_locked 列不存在则添加
  let result: {
    id: number
    is_enabled: number
    is_locked: number
    lock_delay_minutes: number
    lock_password_hash: string | null
    created_at: string
    updated_at: string
  } | undefined
  
  try {
    result = db.queryOne<{
      id: number
      is_enabled: number
      is_locked: number
      lock_delay_minutes: number
      lock_password_hash: string | null
      created_at: string
      updated_at: string
    }>('SELECT * FROM app_lock_settings WHERE id = 1')
  } catch (e) {
    // is_locked 列可能不存在，尝试添加
    console.log('[AppLock] Column is_locked not found, adding it...')
    try {
      db.run(`ALTER TABLE app_lock_settings ADD COLUMN is_locked INTEGER DEFAULT 0`)
      console.log('[AppLock] is_locked column added')
    } catch {}
    // 重新查询
    result = db.queryOne<{
      id: number
      is_enabled: number
      is_locked: number
      lock_delay_minutes: number
      lock_password_hash: string | null
      created_at: string
      updated_at: string
    }>('SELECT * FROM app_lock_settings WHERE id = 1')
  }
  
  if (!result) {
    // 如果没有记录，返回默认值
    return {
      id: 1,
      is_enabled: false,
      is_locked: false,
      lock_delay_minutes: 5,
      has_password: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
  }
  
  return {
    id: result.id,
    is_enabled: result.is_enabled === 1,
    is_locked: result.is_locked === 1,
    lock_delay_minutes: result.lock_delay_minutes,
    has_password: !!result.lock_password_hash,
    created_at: result.created_at,
    updated_at: result.updated_at
  }
}

/**
 * 更新锁定设置
 */
export function updateLockSettings(settings: {
  is_enabled?: boolean
  lock_delay_minutes?: number
}): AppLockSettings {
  const updates: string[] = []
  const values: any[] = []
  
  if (settings.is_enabled !== undefined) {
    updates.push('is_enabled = ?')
    values.push(settings.is_enabled ? 1 : 0)
  }
  
  if (settings.lock_delay_minutes !== undefined) {
    updates.push('lock_delay_minutes = ?')
    values.push(settings.lock_delay_minutes)
  }
  
  if (updates.length > 0) {
    updates.push('updated_at = CURRENT_TIMESTAMP')
    values.push(1) // id = 1
    
    db.run(
      `UPDATE app_lock_settings SET ${updates.join(', ')} WHERE id = ?`,
      values
    )
  }
  
  return getLockSettings()
}

/**
 * 设置锁定密码（明文存储）
 */
export function setLockPassword(password: string): { success: boolean; message: string } {
  if (!password || password.length !== 6) {
    return { success: false, message: '密码长度必须为6位' }
  }
  
  db.run(
    `UPDATE app_lock_settings SET lock_password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 1`,
    [password]  // 明文存储
  )
  
  return { success: true, message: '密码设置成功' }
}

/**
 * 验证锁定密码
 */
export function verifyLockPassword(password: string): boolean {
  const result = db.queryOne<{ lock_password_hash: string }>(
    'SELECT lock_password_hash FROM app_lock_settings WHERE id = 1'
  )
  
  if (!result || !result.lock_password_hash) {
    // 没有设置密码，允许解锁
    return true
  }
  
  // 明文比较
  return password === result.lock_password_hash
}

/**
 * 检查是否需要锁定
 */
export function shouldLock(): boolean {
  const settings = getLockSettings()
  return settings.is_enabled && settings.has_password
}

/**
 * 检查是否启用了锁定功能
 */
export function isLockEnabled(): boolean {
  const settings = getLockSettings()
  return settings.is_enabled
}

/**
 * 获取锁定延时（分钟）
 */
export function getLockDelay(): number {
  const settings = getLockSettings()
  return settings.lock_delay_minutes
}

/**
 * 移除锁定密码
 */
export function removeLockPassword(): { success: boolean; message: string } {
  db.run(
    `UPDATE app_lock_settings SET lock_password_hash = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = 1`
  )
  
  return { success: true, message: '密码已移除' }
}

/**
 * 锁定应用
 */
export function lockApp(): void {
  db.run(
    `UPDATE app_lock_settings SET is_locked = 1, updated_at = CURRENT_TIMESTAMP WHERE id = 1`
  )
  console.log('[AppLock] App locked')
}

/**
 * 解锁应用
 */
export function unlockApp(): void {
  db.run(
    `UPDATE app_lock_settings SET is_locked = 0, updated_at = CURRENT_TIMESTAMP WHERE id = 1`
  )
  console.log('[AppLock] App unlocked')
}

/**
 * 检查应用是否处于锁定状态
 */
export function isAppLocked(): boolean {
  try {
    const result = db.queryOne<{ is_locked: number }>(
      'SELECT is_locked FROM app_lock_settings WHERE id = 1'
    )
    return result?.is_locked === 1
  } catch {
    // is_locked 列可能不存在，尝试添加
    try {
      db.run(`ALTER TABLE app_lock_settings ADD COLUMN is_locked INTEGER DEFAULT 0`)
    } catch {}
    return false
  }
}

/**
 * 发送解锁请求邮件
 * 附带数据库文件
 */
export async function sendUnlockRequestEmail(dbPath: string): Promise<{ success: boolean; message: string; dbPath?: string }> {
  const fs = await import('fs')
  
  // 检查数据库文件是否存在
  if (!fs.existsSync(dbPath)) {
    return { success: false, message: '数据库文件不存在' }
  }
  
  // SMTP 配置（使用开发者邮箱）
  const smtpPassword = process.env.SMTP_PASSWORD || ''
  
  // 如果没有配置 SMTP 密码，返回数据库路径，让调用方打开邮件客户端
  if (!smtpPassword) {
    return { 
      success: true, 
      message: '请手动发送邮件',
      dbPath
    }
  }
  
  const nodemailer = await import('nodemailer')
  
  const smtpConfig = {
    host: 'smtp.qq.com',
    port: 465,
    secure: true,
    auth: {
      user: 'zjc120012@qq.com',
      pass: smtpPassword
    }
  }
  
  try {
    // 创建邮件传输器
    const transporter = nodemailer.default.createTransport(smtpConfig)
    
    // 读取数据库文件
    const dbContent = fs.readFileSync(dbPath)
    
    // 发送邮件
    await transporter.sendMail({
      from: smtpConfig.auth.user,
      to: 'zjc120012@gaj.jdq.sh',
      subject: '忘记密码，请求解封',
      text: '用户请求解锁应用，请查看附件中的数据库文件。',
      attachments: [
        {
          filename: 'secure-ledger.db',
          content: dbContent
        }
      ]
    })
    
    return { success: true, message: '邮件发送成功' }
  } catch (e: any) {
    console.error('[AppLock] Send email failed:', e)
    // 发送失败，返回数据库路径让用户手动发送
    return { 
      success: true, 
      message: '自动发送失败，请手动发送邮件',
      dbPath
    }
  }
}
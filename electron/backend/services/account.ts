/**
 * 账户服务
 * 
 * 简化版：移除 masterKey 概念，只保留账户密码验证
 * 敏感数据加密由混合加密模块处理，不再需要 masterKey
 */
import { db } from '../database/init'
import { hashPassword, verifyPassword } from '../crypto'
import type { Account } from '../database/init'

// 检查是否有账户
export function hasAccount(): boolean {
  const result = db.queryOne<{ count: number }>('SELECT COUNT(*) as count FROM account')
  return (result?.count ?? 0) > 0
}

// 检查用户名是否存在
export function checkUsernameExists(username: string): boolean {
  const result = db.queryOne<{ count: number }>('SELECT COUNT(*) as count FROM account WHERE username = ?', [username])
  return (result?.count ?? 0) > 0
}

// 创建账户
export function createAccount(username: string, password: string): { success: boolean; message: string } {
  // 检查用户名是否已存在
  if (checkUsernameExists(username)) {
    throw new Error('Username already exists')
  }

  // 哈希密码
  const passwordHash = hashPassword(password)
  
  // 插入账户（不再需要 master_key 和 salt）
  db.run(
    `INSERT INTO account (username, password_hash) VALUES (?, ?)`,
    [username, passwordHash]
  )

  return { success: true, message: 'Account created successfully' }
}

// 登录验证
export function loginAccount(username: string, password: string): { token: string; username: string } {
  const account = db.queryOne<Account>(
    'SELECT * FROM account WHERE username = ?',
    [username]
  )

  if (!account) {
    throw new Error('Invalid username or password')
  }

  // 验证密码
  if (!verifyPassword(password, account.password_hash)) {
    throw new Error('Invalid username or password')
  }

  // 生成简单 token (实际应用应使用 JWT)
  const token = Buffer.from(`${username}:${Date.now()}`).toString('base64')

  return { token, username }
}

// 验证 token (简化版)
export function verifyToken(token: string): { valid: boolean; username?: string } {
  if (!token) {
    return { valid: false }
  }

  try {
    const decoded = Buffer.from(token, 'base64').toString('utf8')
    const [username] = decoded.split(':')
    
    const account = db.queryOne<Account>(
      'SELECT username FROM account WHERE username = ?',
      [username]
    )

    return { valid: !!account, username: account?.username }
  } catch {
    return { valid: false }
  }
}

// 修改密码
export function changePassword(oldPassword: string, newPassword: string): { success: boolean } {
  const account = db.queryOne<Account>('SELECT * FROM account LIMIT 1')

  if (!account) {
    throw new Error('Account not found')
  }

  // 验证旧密码
  if (!verifyPassword(oldPassword, account.password_hash)) {
    throw new Error('Incorrect old password')
  }

  // 生成新密码哈希
  const newPasswordHash = hashPassword(newPassword)
  
  // 更新账户（不再需要更新 master_key）
  db.run(
    'UPDATE account SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [newPasswordHash, account.id]
  )

  return { success: true }
}

// 验证账户密码（用于其他模块验证）
export function verifyAccountPassword(password: string): boolean {
  const account = db.queryOne<Account>('SELECT * FROM account LIMIT 1')
  
  if (!account) {
    return false
  }
  
  return verifyPassword(password, account.password_hash)
}
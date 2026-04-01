/**
 * 加密模块（简化版）
 * 
 * 只提供基础的密码哈希功能（用于账户密码）
 * 敏感数据加密使用混合加密模块 (hybrid.ts)
 */
import crypto from 'crypto'

/**
 * 生成随机盐
 */
export function generateSalt(): string {
  return crypto.randomBytes(32).toString('hex')
}

/**
 * 哈希密码（用于账户密码验证）
 * 使用 PBKDF2-SHA256
 */
export function hashPassword(password: string): string {
  const salt = generateSalt()
  const hash = crypto.pbkdf2Sync(
    password,
    Buffer.from(salt, 'hex'),
    100000,
    32,
    'sha256'
  ).toString('hex')
  return `${salt}:${hash}`
}

/**
 * 验证密码（用于账户登录验证）
 */
export function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, hash] = storedHash.split(':')
  if (!salt || !hash) {
    return false
  }
  
  const computedHash = crypto.pbkdf2Sync(
    password,
    Buffer.from(salt, 'hex'),
    100000,
    32,
    'sha256'
  ).toString('hex')
  
  return hash === computedHash
}
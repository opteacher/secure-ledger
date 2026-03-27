#!/usr/bin/env ts-node
/**
 * 测试用户创建脚本
 * 用于开发环境快速创建测试账户
 */

import Database from 'better-sqlite3'
import { join } from 'path'
import { hashPassword, generateSalt, deriveKey, generateMasterKey, encryptMasterKey } from '../electron/backend/crypto'

interface TestUserConfig {
  username: string
  password: string
}

// 测试用户配置
const TEST_USERS: TestUserConfig[] = [
  { username: 'admin', password: 'admin123' }
]
function createTestUser(db: Database.Database, user: TestUserConfig): void {
  const { username, password } = user

  // 检查是否已存在账户
  const existing = db.prepare('SELECT COUNT(*) as count FROM account WHERE username = ?').get(username) as { count: number } | undefined

  if (existing && existing.count > 0) {
    console.log(`⚠️  用户 ${username} 已存在，跳过`)
    return
  }

  // 生成密码哈希和盐
  const salt = generateSalt()
  const passwordHash = hashPassword(password)

  // 派生密钥并加密主密钥
  const derivedKey = deriveKey(password, salt)
  const masterKey = generateMasterKey()
  const encryptedMasterKey = encryptMasterKey(masterKey, derivedKey)

  // 插入账户
  db.prepare(
    `INSERT INTO account (username, password_hash, master_key, salt) VALUES (?, ?, ?, ?)`
  ).run(username, passwordHash, encryptedMasterKey, salt)

  console.log(`✅ 测试用户创建成功：${username} / ${password}`)
}

function main() {
  // 获取数据库路径 (开发环境使用当前目录)
  const dbPath = process.env.DB_PATH || join(process.cwd(), 'secure-ledger.db')

  console.log('📦 密钥终端 - 测试用户创建工具')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log(`数据库路径：${dbPath}`)
  console.log('')

  try {
    const db = new Database(dbPath)

    // 检查数据库是否存在
    const tables = db.prepare("SELECT COUNT(*) as count FROM sqlite_master WHERE type='table' AND name='account'").get() as { count: number } | undefined

    if (!tables || tables.count === 0) {
      console.error('❌ 数据库未初始化，请先运行主程序创建数据库结构')
      db.close()
      process.exit(1)
    }

    console.log('开始创建测试用户...')
    console.log('')

    // 创建测试用户
    for (const user of TEST_USERS) {
      createTestUser(db, user)
    }

    console.log('')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('✅ 测试用户创建完成')
    console.log('')
    console.log('登录信息:')
    TEST_USERS.forEach(user => {
      console.log(`  - ${user.username} / ${user.password}`)
    })

    db.close()
  } catch (error) {
    console.error('❌ 创建失败:', error)
    process.exit(1)
  }
}

main()

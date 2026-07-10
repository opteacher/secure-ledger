/**
 * 账户服务单元测试
 * 测试 account.ts 的所有导出函数
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

// ─── 使用 vi.hoisted 避免 hoisting 引用错误 ─────────────

const mockDb = vi.hoisted(() => ({
  query: vi.fn(),
  queryOne: vi.fn(),
  run: vi.fn(() => ({ changes: 1, lastInsertRowid: 1 })),
  exec: vi.fn(),
  transaction: vi.fn((fn: () => unknown) => fn()),
}))

const mockHashPassword = vi.hoisted(() => vi.fn((pw: string) => `salt:${pw}_hashed`))
const mockVerifyPassword = vi.hoisted(
  () => vi.fn((pw: string, stored: string) => stored === `salt:${pw}_hashed`)
)

// ─── Mock 模块 ────────────────────────────────────────────

vi.mock('../../../../electron/backend/database/init', () => ({
  db: mockDb,
}))

vi.mock('../../../../electron/backend/crypto', () => ({
  hashPassword: mockHashPassword,
  verifyPassword: mockVerifyPassword,
}))

// ─── 动态导入被测模块 ────────────────────────────────────

import {
  hasAccount,
  checkUsernameExists,
  createAccount,
  loginAccount,
  verifyToken,
  changePassword,
  verifyAccountPassword,
} from '../../../../electron/backend/services/account'

// ─── 测试套件 ────────────────────────────────────────────

describe('account 服务', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDb.run.mockReturnValue({ changes: 1, lastInsertRowid: 1 })
  })

  describe('hasAccount', () => {
    it('存在账户时返回 true', () => {
      mockDb.queryOne.mockReturnValue({ count: 3 })
      expect(hasAccount()).toBe(true)
    })

    it('无账户时返回 false', () => {
      mockDb.queryOne.mockReturnValue({ count: 0 })
      expect(hasAccount()).toBe(false)
    })

    it('数据库返回 undefined 时返回 false', () => {
      mockDb.queryOne.mockReturnValue(undefined)
      expect(hasAccount()).toBe(false)
    })

    it('数据库返回 null 时返回 false', () => {
      mockDb.queryOne.mockReturnValue(null)
      expect(hasAccount()).toBe(false)
    })
  })

  describe('checkUsernameExists', () => {
    it('已存在的用户名返回 true', () => {
      mockDb.queryOne.mockReturnValue({ count: 1 })
      expect(checkUsernameExists('admin')).toBe(true)
    })

    it('不存在的用户名返回 false', () => {
      mockDb.queryOne.mockReturnValue({ count: 0 })
      expect(checkUsernameExists('ghost')).toBe(false)
    })

    it('数据库返回 undefined 时返回 false', () => {
      mockDb.queryOne.mockReturnValue(undefined)
      expect(checkUsernameExists('any')).toBe(false)
    })
  })

  describe('createAccount', () => {
    it('成功创建账户并返回成功消息', () => {
      mockDb.queryOne.mockReturnValue({ count: 0 })
      const result = createAccount('newuser', 'password123')
      expect(mockHashPassword).toHaveBeenCalledWith('password123')
      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO account'),
        expect.arrayContaining(['newuser'])
      )
      expect(result.success).toBe(true)
      expect(result.message).toBe('Account created successfully')
    })

    it('用户已存在时抛出错误', () => {
      mockDb.queryOne.mockReturnValue({ count: 1 })
      expect(() => createAccount('admin', 'pass')).toThrow('Username already exists')
      expect(mockDb.run).not.toHaveBeenCalled()
    })

    it('哈希密码被正确调用', () => {
      mockDb.queryOne.mockReturnValue({ count: 0 })
      createAccount('user', 'secret')
      expect(mockHashPassword).toHaveBeenCalledTimes(1)
      expect(mockHashPassword).toHaveBeenCalledWith('secret')
    })
  })

  describe('loginAccount', () => {
    const fakeAccount = { id: 1, username: 'testuser', password_hash: 'salt:testuser_hashed' }

    it('正确凭据返回 token 和用户名', () => {
      mockDb.queryOne.mockReturnValue(fakeAccount)
      mockVerifyPassword.mockReturnValue(true)
      const result = loginAccount('testuser', 'rightpass')
      expect(result.token).toBeTruthy()
      expect(result.username).toBe('testuser')
      expect(() => Buffer.from(result.token, 'base64')).not.toThrow()
    })

    it('用户不存在时抛出错误', () => {
      mockDb.queryOne.mockReturnValue(undefined)
      expect(() => loginAccount('ghost', 'pass')).toThrow('Invalid username or password')
    })

    it('密码错误时抛出错误', () => {
      mockDb.queryOne.mockReturnValue(fakeAccount)
      mockVerifyPassword.mockReturnValue(false)
      expect(() => loginAccount('testuser', 'wrongpass')).toThrow('Invalid username or password')
    })

    it('token 包含用户名信息', () => {
      mockDb.queryOne.mockReturnValue(fakeAccount)
      mockVerifyPassword.mockReturnValue(true)
      const result = loginAccount('testuser', 'rightpass')
      const decoded = Buffer.from(result.token, 'base64').toString('utf-8')
      expect(decoded).toContain('testuser')
    })
  })

  describe('verifyToken', () => {
    it('空 token 返回无效', () => {
      expect(verifyToken('')).toEqual({ valid: false })
    })

    it('null/undefined token 返回无效', () => {
      expect(verifyToken(null as unknown as string)).toEqual({ valid: false })
      expect(verifyToken(undefined as unknown as string)).toEqual({ valid: false })
    })

    it('有效 token 验证成功', () => {
      const token = Buffer.from('testuser:1234567890').toString('base64')
      mockDb.queryOne.mockReturnValue({ username: 'testuser' })
      const result = verifyToken(token)
      expect(result.valid).toBe(true)
      expect(result.username).toBe('testuser')
    })

    it('无效 base64 token 返回无效', () => {
      mockDb.queryOne.mockReturnValue(undefined)
      const result = verifyToken('!!!not-valid-base64!!!')
      expect(result.valid).toBe(false)
      expect(result.username).toBeUndefined()
    })

    it('有效格式但用户不存在时返回无效', () => {
      const token = Buffer.from('ghost:1234567890').toString('base64')
      mockDb.queryOne.mockReturnValue(undefined)
      expect(verifyToken(token).valid).toBe(false)
    })

    it('数据库返回 null 时返回无效', () => {
      const token = Buffer.from('ghost:1234567890').toString('base64')
      mockDb.queryOne.mockReturnValue(null)
      expect(verifyToken(token).valid).toBe(false)
    })
  })

  describe('changePassword', () => {
    const fakeAccount = { id: 1, username: 'test', password_hash: 'salt:oldpass_hashed' }

    it('成功修改密码', () => {
      mockDb.queryOne.mockReturnValue(fakeAccount)
      mockVerifyPassword.mockReturnValue(true)
      mockHashPassword.mockReturnValue('newSalt:newpass_hashed')
      const result = changePassword('oldpass', 'newpass')
      expect(result.success).toBe(true)
      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE account SET password_hash'),
        expect.arrayContaining([fakeAccount.id])
      )
    })

    it('账户不存在时抛出错误', () => {
      mockDb.queryOne.mockReturnValue(undefined)
      expect(() => changePassword('old', 'new')).toThrow('Account not found')
    })

    it('旧密码错误时抛出错误', () => {
      mockDb.queryOne.mockReturnValue(fakeAccount)
      mockVerifyPassword.mockReturnValue(false)
      expect(() => changePassword('wrongOld', 'newpass')).toThrow('Incorrect old password')
    })

    it('新密码被正确哈希', () => {
      mockDb.queryOne.mockReturnValue(fakeAccount)
      mockVerifyPassword.mockReturnValue(true)
      changePassword('oldpass', 'brandNew')
      expect(mockHashPassword).toHaveBeenCalledWith('brandNew')
    })
  })

  describe('verifyAccountPassword', () => {
    const fakeAccount = { id: 1, username: 'test', password_hash: 'salt:test_hashed' }

    it('正确密码返回 true', () => {
      mockDb.queryOne.mockReturnValue(fakeAccount)
      mockVerifyPassword.mockReturnValue(true)
      expect(verifyAccountPassword('rightpass')).toBe(true)
    })

    it('错误密码返回 false', () => {
      mockDb.queryOne.mockReturnValue(fakeAccount)
      mockVerifyPassword.mockReturnValue(false)
      expect(verifyAccountPassword('wrongpass')).toBe(false)
    })

    it('账户不存在时返回 false', () => {
      mockDb.queryOne.mockReturnValue(undefined)
      expect(verifyAccountPassword('any')).toBe(false)
    })

    it('数据库返回 null 时返回 false', () => {
      mockDb.queryOne.mockReturnValue(null)
      expect(verifyAccountPassword('any')).toBe(false)
    })
  })
})

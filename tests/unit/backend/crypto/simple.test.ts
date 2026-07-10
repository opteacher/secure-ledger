/**
 * 简单加密模块测试 - PBKDF2 密码哈希
 */
import { generateSalt, hashPassword, verifyPassword } from '../../../../electron/backend/crypto/simple'

describe('简单加密模块 (simple.ts)', () => {
  describe('generateSalt', () => {
    it('应该生成 64 位十六进制字符串（32 字节）', () => {
      const salt = generateSalt()
      expect(typeof salt).toBe('string')
      expect(salt.length).toBe(64)
      expect(/^[0-9a-f]+$/.test(salt)).toBe(true)
    })

    it('每次调用应该生成不同的盐值', () => {
      const salt1 = generateSalt()
      const salt2 = generateSalt()
      const salt3 = generateSalt()
      expect(salt1).not.toBe(salt2)
      expect(salt2).not.toBe(salt3)
      expect(salt1).not.toBe(salt3)
    })

    it('应生成足够熵的盐值（唯一性抽样测试）', () => {
      const salts = new Set<string>()
      for (let i = 0; i < 100; i++) {
        salts.add(generateSalt())
      }
      expect(salts.size).toBe(100)
    })
  })

  describe('hashPassword', () => {
    it('应该返回 salt:hash 格式的字符串', () => {
      const result = hashPassword('test123')
      expect(result).toContain(':')
      const [salt, hash] = result.split(':')
      expect(salt.length).toBe(64)
      expect(hash.length).toBe(64)
      expect(/^[0-9a-f]+$/.test(salt)).toBe(true)
      expect(/^[0-9a-f]+$/.test(hash)).toBe(true)
    })

    it('相同密码应该产生不同的哈希值（不同盐）', () => {
      const hash1 = hashPassword('mypassword')
      const hash2 = hashPassword('mypassword')
      expect(hash1).not.toBe(hash2)
      // 但两者都应该是有效格式
      expect(hash1.split(':')).toHaveLength(2)
      expect(hash2.split(':')).toHaveLength(2)
    })

    it('应该处理空字符串密码', () => {
      const result = hashPassword('')
      expect(result).toContain(':')
      const [salt, hash] = result.split(':')
      expect(salt.length).toBe(64)
      expect(hash.length).toBe(64)
    })

    it('应该处理中文字符密码', () => {
      const result = hashPassword('中文密码测试123')
      expect(result).toContain(':')
      const [salt, hash] = result.split(':')
      expect(salt.length).toBe(64)
      expect(hash.length).toBe(64)
    })

    it('应该处理特殊字符密码', () => {
      const result = hashPassword('!@#$%^&*()_+-=[]{}|;:",.<>?/~`')
      expect(result).toContain(':')
      const [salt, hash] = result.split(':')
      expect(salt.length).toBe(64)
      expect(hash.length).toBe(64)
    })

    it('应该处理超长密码', () => {
      const longPassword = 'a'.repeat(10000)
      const result = hashPassword(longPassword)
      expect(result).toContain(':')
    })
  })

  describe('verifyPassword', () => {
    it('应该验证正确的密码', () => {
      const password = 'mySecureP@ssw0rd'
      const hashed = hashPassword(password)
      expect(verifyPassword(password, hashed)).toBe(true)
    })

    it('应该拒绝错误的密码', () => {
      const hashed = hashPassword('correctPassword')
      expect(verifyPassword('wrongPassword', hashed)).toBe(false)
    })

    it('应该拒绝大小写不同的密码', () => {
      const hashed = hashPassword('Password')
      expect(verifyPassword('password', hashed)).toBe(false)
    })

    it('应该处理空密码', () => {
      const hashed = hashPassword('')
      expect(verifyPassword('', hashed)).toBe(true)
      expect(verifyPassword('something', hashed)).toBe(false)
    })

    it('应该处理中文密码验证', () => {
      const password = '我的密码123'
      const hashed = hashPassword(password)
      expect(verifyPassword(password, hashed)).toBe(true)
      expect(verifyPassword('我的密码124', hashed)).toBe(false)
    })

    it('应该拒绝无效格式的哈希 — 不包含冒号', () => {
      expect(verifyPassword('anypassword', 'invalidhashwithoutcolon')).toBe(false)
    })

    it('应该拒绝无效格式的哈希 — 盐值为空', () => {
      expect(verifyPassword('anypassword', ':somehash')).toBe(false)
    })

    it('应该拒绝无效格式的哈希 — 哈希值为空', () => {
      expect(verifyPassword('anypassword', 'somesalt:')).toBe(false)
    })

    it('应该拒绝空哈希字符串', () => {
      expect(verifyPassword('anypassword', '')).toBe(false)
    })

    it('应该拒绝只有冒号的哈希', () => {
      expect(verifyPassword('anypassword', ':')).toBe(false)
    })

    it('应该处理多个冒号的哈希格式（取前两部分）', () => {
      const password = 'testpass'
      const hashed = hashPassword(password)
      const withExtraColons = hashed + ':extra:parts'
      expect(verifyPassword(password, withExtraColons)).toBe(true)
    })

    it('批量验证往返测试', () => {
      const passwords = ['test', 'admin123', '', '中文', '!@#', 'a'.repeat(500)]
      for (const pwd of passwords) {
        const hashed = hashPassword(pwd)
        expect(verifyPassword(pwd, hashed)).toBe(true)
      }
    })
  })
})

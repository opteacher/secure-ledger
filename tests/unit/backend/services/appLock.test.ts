/**
 * 应用锁定服务单元测试
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

const mockDb = vi.hoisted(() => ({
  query: vi.fn(),
  queryOne: vi.fn(),
  run: vi.fn(() => ({ changes: 1, lastInsertRowid: 1 })),
  exec: vi.fn(),
  transaction: vi.fn((fn: () => unknown) => fn()),
}))

const mockHybridEncrypt = vi.hoisted(() => vi.fn((v: string) => `HYBRID_ENC:${v}`))
const mockHybridDecrypt = vi.hoisted(() => vi.fn((v: string) => {
  if (v.startsWith('HYBRID_ENC:')) return v.replace('HYBRID_ENC:', '')
  throw new Error('decrypt failed')
}))
const mockIsHybridEncrypted = vi.hoisted(() => vi.fn((v: string) => v.startsWith('HYBRID_ENC:')))

vi.mock('../../../../electron/backend/database/init', () => ({ db: mockDb }))
vi.mock('../../../../electron/backend/crypto/hybrid', () => ({
  hybridEncrypt: mockHybridEncrypt,
  hybridDecrypt: mockHybridDecrypt,
  isHybridEncrypted: mockIsHybridEncrypted,
}))

import {
  getLockSettings, updateLockSettings, setLockPassword, verifyLockPassword,
  shouldLock, isLockEnabled, getLockDelay, removeLockPassword,
  lockApp, unlockApp, isAppLocked, sendUnlockRequestEmail,
} from '../../../../electron/backend/services/appLock'

function makeRow(o: Record<string, unknown> = {}) {
  return {
    id: 1, is_enabled: 0, is_locked: 0, lock_delay_minutes: 5, lock_password_hash: null,
    created_at: '2024-01-01T00:00:00.000Z', updated_at: '2024-01-01T00:00:00.000Z', ...o,
  }
}

describe('appLock 服务', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDb.run.mockReturnValue({ changes: 1, lastInsertRowid: 1 })
  })

  describe('getLockSettings', () => {
    it('返回数据库中的锁定设置', () => {
      mockDb.queryOne.mockReturnValue(makeRow({ is_enabled: 1, lock_password_hash: 'h' }))
      const r = getLockSettings()
      expect(r.is_enabled).toBe(true)
      expect(r.has_password).toBe(true)
      expect(r.lock_delay_minutes).toBe(5)
    })
    it('数据库无记录时返回默认设置', () => {
      mockDb.queryOne.mockReturnValue(undefined)
      const r = getLockSettings()
      expect(r.is_enabled).toBe(false)
      expect(r.is_locked).toBe(false)
      expect(r.has_password).toBe(false)
    })
    it('is_locked 列不存在时自动添加并重试', () => {
      mockDb.queryOne.mockImplementationOnce(() => { throw new Error('no such column: is_locked') })
        .mockReturnValueOnce(makeRow({ is_locked: 1 }))
      expect(getLockSettings().is_locked).toBe(true)
      expect(mockDb.run).toHaveBeenCalledWith('ALTER TABLE app_lock_settings ADD COLUMN is_locked INTEGER DEFAULT 0')
    })
    it('整数 is_enabled 转为 boolean', () => {
      mockDb.queryOne.mockReturnValue(makeRow({ is_enabled: 1 }))
      expect(getLockSettings().is_enabled).toBe(true)
      vi.clearAllMocks()
      mockDb.queryOne.mockReturnValue(makeRow({ is_enabled: 0 }))
      expect(getLockSettings().is_enabled).toBe(false)
    })
  })

  describe('updateLockSettings', () => {
    it('更新启用状态', () => {
      mockDb.queryOne.mockReturnValue(makeRow({ is_enabled: 1 }))
      const r = updateLockSettings({ is_enabled: true })
      expect(mockDb.run).toHaveBeenCalledWith(expect.stringContaining('is_enabled = ?'), expect.arrayContaining([1, 1]))
      expect(r.is_enabled).toBe(true)
    })
    it('传入空对象不执行更新', () => {
      mockDb.queryOne.mockReturnValue(makeRow())
      updateLockSettings({})
      expect(mockDb.run).not.toHaveBeenCalled()
    })
    it('返回更新后的完整设置', () => {
      mockDb.queryOne.mockReturnValue(makeRow({ is_enabled: 1, lock_delay_minutes: 15 }))
      const r = updateLockSettings({ is_enabled: true, lock_delay_minutes: 15 })
      expect(r.lock_delay_minutes).toBe(15)
    })
  })

  describe('setLockPassword', () => {
    it('密码非6位返回失败', () => {
      expect(setLockPassword('12345').success).toBe(false)
      expect(setLockPassword('').success).toBe(false)
      expect(setLockPassword('1234567').success).toBe(false)
    })
    it('6位密码设置成功', () => {
      const r = setLockPassword('123456')
      expect(r.success).toBe(true)
      expect(mockHybridEncrypt).toHaveBeenCalledWith('123456')
      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('SET lock_password_hash'),
        expect.arrayContaining(['HYBRID_ENC:123456'])
      )
    })
  })

  describe('verifyLockPassword', () => {
    it('未设置密码时返回 true', () => {
      mockDb.queryOne.mockReturnValue({ lock_password_hash: null })
      expect(verifyLockPassword('any')).toBe(true)
    })
    it('数据库无记录返回 true', () => {
      mockDb.queryOne.mockReturnValue(undefined)
      expect(verifyLockPassword('any')).toBe(true)
    })
    it('混合加密密码验证成功', () => {
      mockDb.queryOne.mockReturnValue({ lock_password_hash: 'HYBRID_ENC:123456' })
      mockIsHybridEncrypted.mockReturnValue(true)
      mockHybridDecrypt.mockReturnValue('123456')
      expect(verifyLockPassword('123456')).toBe(true)
    })
    it('混合加密密码验证失败', () => {
      mockDb.queryOne.mockReturnValue({ lock_password_hash: 'HYBRID_ENC:123456' })
      mockIsHybridEncrypted.mockReturnValue(true)
      mockHybridDecrypt.mockReturnValue('123456')
      expect(verifyLockPassword('wrong')).toBe(false)
    })
    it('解密失败返回 false', () => {
      mockDb.queryOne.mockReturnValue({ lock_password_hash: 'HYBRID_ENC:corrupt' })
      mockIsHybridEncrypted.mockReturnValue(true)
      mockHybridDecrypt.mockImplementation(() => { throw new Error('fail') })
      expect(verifyLockPassword('123456')).toBe(false)
    })
    it('旧格式密码返回 false', () => {
      mockDb.queryOne.mockReturnValue({ lock_password_hash: 'old_format' })
      mockIsHybridEncrypted.mockReturnValue(false)
      expect(verifyLockPassword('anything')).toBe(false)
    })
  })

  describe('shouldLock', () => {
    it('启用且有密码返回 true', () => {
      mockDb.queryOne.mockReturnValue(makeRow({ is_enabled: 1, lock_password_hash: 'h' }))
      expect(shouldLock()).toBe(true)
    })
    it('未启用或没有密码返回 false', () => {
      mockDb.queryOne.mockReturnValue(makeRow({ is_enabled: 0, lock_password_hash: 'h' }))
      expect(shouldLock()).toBe(false)
      vi.clearAllMocks()
      mockDb.queryOne.mockReturnValue(makeRow({ is_enabled: 1, lock_password_hash: null }))
      expect(shouldLock()).toBe(false)
    })
  })

  describe('isLockEnabled / getLockDelay', () => {
    it('isLockEnabled', () => {
      mockDb.queryOne.mockReturnValue(makeRow({ is_enabled: 1 }))
      expect(isLockEnabled()).toBe(true)
    })
    it('getLockDelay 默认 5', () => {
      mockDb.queryOne.mockReturnValue(undefined)
      expect(getLockDelay()).toBe(5)
    })
  })

  describe('removeLockPassword', () => {
    it('成功移除密码', () => {
      const r = removeLockPassword()
      expect(r.success).toBe(true)
      expect(r.message).toBe('密码已移除')
    })
  })

  describe('lockApp / unlockApp', () => {
    it('lockApp 设置 is_locked = 1', () => {
      lockApp()
      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('SET is_locked = 1')
      )
    })
    it('unlockApp 设置 is_locked = 0', () => {
      unlockApp()
      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('SET is_locked = 0')
      )
    })
  })

  describe('isAppLocked', () => {
    it('锁定状态返回 true', () => {
      mockDb.queryOne.mockReturnValue({ is_locked: 1 })
      expect(isAppLocked()).toBe(true)
    })
    it('非锁定状态返回 false', () => {
      mockDb.queryOne.mockReturnValue({ is_locked: 0 })
      expect(isAppLocked()).toBe(false)
    })
    it('列不存在时返回 false 并自动添加', () => {
      mockDb.queryOne.mockImplementationOnce(() => { throw new Error('no such column: is_locked') })
      expect(isAppLocked()).toBe(false)
      expect(mockDb.run).toHaveBeenCalledWith('ALTER TABLE app_lock_settings ADD COLUMN is_locked INTEGER DEFAULT 0')
    })
  })

  describe('sendUnlockRequestEmail', () => {
    it('返回 Promise', () => {
      expect(sendUnlockRequestEmail('/some/path.db')).toBeInstanceOf(Promise)
    })
    it('返回结构包含 success 和 message', async () => {
      const r = await sendUnlockRequestEmail('/some/path.db')
      expect(r).toHaveProperty('success')
      expect(r).toHaveProperty('message')
    })
  })
})

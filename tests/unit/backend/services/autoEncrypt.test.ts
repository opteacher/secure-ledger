/**
 * 自动加密服务测试
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { queryOne, query, run, isHybridEncrypted, hybridEncrypt } = vi.hoisted(() => ({
  queryOne: vi.fn(),
  query: vi.fn(),
  run: vi.fn(),
  isHybridEncrypted: vi.fn(),
  hybridEncrypt: vi.fn(),
}))

vi.mock('../../../../electron/backend/database/init', () => ({ db: { queryOne, query, run } }))
vi.mock('../../../../electron/backend/crypto/hybrid', () => ({ isHybridEncrypted, hybridEncrypt }))

import { autoEncryptAppLockPassword, autoEncryptAllSlots, autoEncryptOnStartup } from '../../../../electron/backend/services/autoEncrypt'

describe('autoEncryptAppLockPassword', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('无密码时应返回 No password', () => {
    queryOne.mockReturnValue(null)
    expect(autoEncryptAppLockPassword()).toEqual({ success: true, message: 'No password' })
    expect(run).not.toHaveBeenCalled()
  })

  it('密码为空时应返回 No password', () => {
    queryOne.mockReturnValue({ lock_password_hash: '' })
    expect(autoEncryptAppLockPassword().message).toBe('No password')
  })

  it('已加密时应跳过', () => {
    queryOne.mockReturnValue({ lock_password_hash: 'x' })
    isHybridEncrypted.mockReturnValue(true)
    expect(autoEncryptAppLockPassword().message).toBe('Already encrypted')
    expect(run).not.toHaveBeenCalled()
  })

  it('旧数据格式(>250字节)应清除', () => {
    queryOne.mockReturnValue({ lock_password_hash: 'x'.repeat(300) })
    isHybridEncrypted.mockReturnValue(false)
    const r = autoEncryptAppLockPassword()
    expect(r.message).toBe('Legacy password cleared - please set new password')
    expect(run).toHaveBeenCalledWith('UPDATE app_lock_settings SET lock_password_hash = NULL WHERE id = 1')
  })

  it('短明文密码应加密并存库', () => {
    queryOne.mockReturnValue({ lock_password_hash: 'myPass' })
    isHybridEncrypted.mockReturnValue(false)
    hybridEncrypt.mockReturnValue('enc-result')
    const r = autoEncryptAppLockPassword()
    expect(r.success).toBe(true)
    expect(r.message).toBe('Password encrypted')
    expect(hybridEncrypt).toHaveBeenCalledWith('myPass')
    expect(run).toHaveBeenCalledWith(
      'UPDATE app_lock_settings SET lock_password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 1',
      ['enc-result']
    )
  })

  it('加密失败应返回错误', () => {
    queryOne.mockReturnValue({ lock_password_hash: 'p' })
    isHybridEncrypted.mockReturnValue(false)
    hybridEncrypt.mockImplementation(() => { throw new Error('fail') })
    expect(autoEncryptAppLockPassword()).toEqual({ success: false, message: 'fail' })
  })

  it('恰好250字节应尝试加密', () => {
    queryOne.mockReturnValue({ lock_password_hash: 'x'.repeat(250) })
    isHybridEncrypted.mockReturnValue(false)
    hybridEncrypt.mockReturnValue('ok')
    expect(autoEncryptAppLockPassword().message).toBe('Password encrypted')
  })
})

describe('autoEncryptAllSlots', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('无slot应返回零', () => {
    query.mockReturnValue([])
    const r = autoEncryptAllSlots()
    expect(r.total).toBe(0)
  })

  it('已加密全部跳过', () => {
    query.mockReturnValue([{ id: 1, value: 'a' }, { id: 2, value: 'b' }])
    isHybridEncrypted.mockReturnValue(true)
    const r = autoEncryptAllSlots()
    expect(r.total).toBe(2)
    expect(r.encrypted).toBe(0)
    expect(r.skipped).toBe(2)
  })

  it('未加密slot应被加密', () => {
    query.mockReturnValue([{ id: 10, value: 'plain' }])
    isHybridEncrypted.mockReturnValue(false)
    hybridEncrypt.mockReturnValue('new-enc')
    const r = autoEncryptAllSlots()
    expect(r.encrypted).toBe(1)
    expect(run).toHaveBeenCalledWith(
      'UPDATE slot SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      ['new-enc', 10]
    )
  })

  it('混合场景', () => {
    query.mockReturnValue([{ id: 1, value: 'enc' }, { id: 2, value: 'p1' }, { id: 3, value: 'p2' }])
    isHybridEncrypted.mockReturnValueOnce(true).mockReturnValueOnce(false).mockReturnValueOnce(false)
    hybridEncrypt.mockReturnValueOnce('e1').mockReturnValueOnce('e2')
    const r = autoEncryptAllSlots()
    expect(r.encrypted).toBe(2)
    expect(r.skipped).toBe(1)
    expect(run).toHaveBeenCalledTimes(2)
  })

  it('单个失败应继续处理', () => {
    query.mockReturnValue([{ id: 1, value: 'a' }, { id: 2, value: 'b' }, { id: 3, value: 'c' }])
    isHybridEncrypted.mockReturnValue(false)
    hybridEncrypt.mockReturnValueOnce('e1').mockImplementationOnce(() => { throw new Error('key err') }).mockReturnValueOnce('e3')
    const r = autoEncryptAllSlots()
    expect(r.encrypted).toBe(2)
    expect(r.skipped).toBe(1)
    expect(r.errors).toHaveLength(1)
    expect(r.errors[0]).toContain('Slot 2')
  })

  it('全部失败', () => {
    query.mockReturnValue([{ id: 1, value: 'a' }, { id: 2, value: 'b' }])
    isHybridEncrypted.mockReturnValue(false)
    hybridEncrypt.mockImplementation(() => { throw new Error('fatal') })
    const r = autoEncryptAllSlots()
    expect(r.encrypted).toBe(0)
    expect(r.skipped).toBe(2)
    expect(r.errors).toHaveLength(2)
  })
})

describe('autoEncryptOnStartup', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('合并两个子功能结果', () => {
    queryOne.mockReturnValue(null)
    query.mockReturnValue([])
    const r = autoEncryptOnStartup()
    expect(r.appLockPassword.message).toBe('No password')
    expect(r.slots.total).toBe(0)
  })

  it('有密码和slot时返回各自结果', () => {
    queryOne.mockReturnValue({ lock_password_hash: 'p' })
    isHybridEncrypted.mockReturnValueOnce(false)
    hybridEncrypt.mockReturnValue('ep')
    query.mockReturnValue([{ id: 1, value: 'ae' }])
    isHybridEncrypted.mockReturnValueOnce(true)
    const r = autoEncryptOnStartup()
    expect(r.appLockPassword.message).toBe('Password encrypted')
    expect(r.slots.skipped).toBe(1)
  })
})

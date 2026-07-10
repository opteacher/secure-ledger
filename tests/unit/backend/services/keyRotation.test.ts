/**
 * RSA 密钥轮换服务单元测试
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'

const { mockDb } = vi.hoisted(() => {
  const q = vi.fn()
  const q1 = vi.fn()
  const r = vi.fn()
  return { mockDb: { query: q, queryOne: q1, run: r, exec: vi.fn() } }
})

vi.mock('../../../../electron/backend/database/init', () => ({ db: mockDb }))

const { mockHybridEncrypt, mockHybridDecrypt, mockIsHybridEncrypted } = vi.hoisted(() => ({
  mockHybridEncrypt: vi.fn((v: string) => 'enc_' + v),
  mockHybridDecrypt: vi.fn((v: string) => 'dec_' + v),
  mockIsHybridEncrypted: vi.fn(() => true),
}))

vi.mock('../../../../electron/backend/crypto/hybrid', () => ({
  hybridEncrypt: mockHybridEncrypt, hybridDecrypt: mockHybridDecrypt, isHybridEncrypted: mockIsHybridEncrypted,
}))

const { mockRsaSetCachedPrivateKey, mockRsaSetCachedPublicKey } = vi.hoisted(() => ({
  mockRsaSetCachedPrivateKey: vi.fn(),
  mockRsaSetCachedPublicKey: vi.fn(),
}))

vi.mock('../../../../electron/backend/crypto/rsa', () => ({
  setCachedPrivateKey: mockRsaSetCachedPrivateKey, setCachedPublicKey: mockRsaSetCachedPublicKey,
}))

const { mockIsEncryptionAvailable, mockGenerateKeyPair, mockSaveKeyPair, mockLoadPrivateKey, mockLoadPublicKey } = vi.hoisted(() => ({
  mockIsEncryptionAvailable: vi.fn(() => Promise.resolve(true)),
  mockGenerateKeyPair: vi.fn(() => ({ privateKey: 'new-priv', publicKey: 'new-pub' })),
  mockSaveKeyPair: vi.fn(() => Promise.resolve()),
  mockLoadPrivateKey: vi.fn(() => Promise.resolve('old-priv')),
  mockLoadPublicKey: vi.fn(() => 'old-pub'),
}))

vi.mock('../../../../electron/backend/crypto/secureKeyStorage', () => ({
  getKeysDirectory: vi.fn(() => '/k'), generateKeyPair: mockGenerateKeyPair, saveKeyPair: mockSaveKeyPair,
  loadPrivateKey: mockLoadPrivateKey, loadPublicKey: mockLoadPublicKey,
  isEncryptionAvailable: mockIsEncryptionAvailable, hasKeyPair: vi.fn(() => true),
}))

vi.mock('fs', () => ({ existsSync: vi.fn(() => true), mkdirSync: vi.fn(), readdirSync: vi.fn(() => []), statSync: vi.fn(() => ({ mtime: new Date() })) }))

import { rotateKeys, startScheduledRotation, stopScheduledRotation, getRotationStatus } from '../../../../electron/backend/services/keyRotation'

describe('keyRotation 服务', () => {
  beforeEach(() => { vi.clearAllMocks(); mockDb.queryOne.mockReturnValue(null); mockDb.query.mockReturnValue([]); stopScheduledRotation() })
  afterEach(() => stopScheduledRotation())

  describe('rotateKeys', () => {
    it('成功执行密钥轮换', async () => {
      const r = await rotateKeys()
      expect(r.success).toBe(true)
      expect(mockGenerateKeyPair).toHaveBeenCalled()
      expect(mockSaveKeyPair).toHaveBeenCalledWith('new-priv', 'new-pub')
    })

    it('已有轮换进行中返回失败', async () => {
      const results = await Promise.all([rotateKeys(), rotateKeys()])
      expect(results.some((r: any) => r.message === 'Key rotation already in progress')).toBe(true)
    })

    it('加密服务不可用时报错', async () => {
      mockIsEncryptionAvailable.mockResolvedValueOnce(false)
      const r = await rotateKeys()
      expect(r.success).toBe(false)
      expect(r.message).toContain('not available')
    })

    it('无现有密钥时报错', async () => {
      mockLoadPrivateKey.mockResolvedValueOnce(null)
      mockIsEncryptionAvailable.mockResolvedValue(true)
      const r = await rotateKeys()
      expect(r.success).toBe(false)
      expect(r.message).toContain('No existing keys')
    })

    it('轮换时重新加密应用锁密码', async () => {
      mockDb.queryOne.mockReturnValueOnce({ lock_password_hash: 'enc_hash' })
      mockIsHybridEncrypted.mockReturnValueOnce(true)
      mockHybridDecrypt.mockReturnValueOnce('plaintext_password')
      const r = await rotateKeys()
      expect(r.success).toBe(true)
      expect(mockHybridEncrypt).toHaveBeenCalledWith('plaintext_password')
    })

    it('重新加密 slot 值', async () => {
      mockDb.query.mockReturnValue([{ id: 1, value: 'e1', is_encrypted: 1 }, { id: 2, value: 'e2', is_encrypted: 1 }])
      mockIsHybridEncrypted.mockReturnValue(true)
      mockHybridDecrypt.mockReturnValue('plain')
      const r = await rotateKeys()
      expect(r.details.slotsTotal).toBeGreaterThanOrEqual(2)
      expect(r.details.slotsReEncrypted).toBeGreaterThanOrEqual(2)
    })

    it('解密失败时记录错误', async () => {
      mockDb.query.mockReturnValue([{ id: 1, value: 'e1', is_encrypted: 1 }])
      mockIsHybridEncrypted.mockReturnValue(true)
      mockHybridDecrypt.mockImplementation(() => { throw new Error('decrypt failed') })
      const r = await rotateKeys()
      expect(r.success).toBe(true)
    })

    it('加密失败时记录错误', async () => {
      mockDb.query.mockReturnValue([{ id: 1, value: 'e1', is_encrypted: 1 }])
      mockIsHybridEncrypted.mockReturnValue(true)
      mockHybridDecrypt.mockReturnValue('plain')
      mockHybridEncrypt.mockImplementation(() => { throw new Error('encrypt failed') })
      const r = await rotateKeys()
      expect(r.details.errors.length).toBeGreaterThanOrEqual(1)
    })

    it('保存密钥失败', async () => {
      mockSaveKeyPair.mockRejectedValueOnce(new Error('save failed'))
      const r = await rotateKeys()
      expect(r.success).toBe(false)
    })
  })

  describe('定时轮换', () => {
    it('启动定时轮换', () => {
      startScheduledRotation(1000)
      expect(getRotationStatus().isScheduled).toBe(true)
    })
    it('停止定时轮换', () => {
      startScheduledRotation(1000)
      stopScheduledRotation()
      expect(getRotationStatus().isScheduled).toBe(false)
    })
  })

  describe('getRotationStatus', () => {
    it('返回初始状态', () => {
      const s = getRotationStatus()
      expect(s.isRotating).toBe(false)
      expect(s.isScheduled).toBe(false)
      expect(s.lastRotationTime).toBeNull()
    })
  })
})

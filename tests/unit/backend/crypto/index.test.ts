/**
 * 加密模块统一导出验证
 * 确保 crypto/index.ts 正确重导出所有子模块的公共 API
 */
import { describe, it, expect } from 'vitest'

describe('crypto 统一导出 (crypto/index.ts)', () => {
  describe('simple.ts 重导出', () => {
    it('hashPassword 应可导入', async () => {
      const { hashPassword } = await import('../../../../electron/backend/crypto/index')
      expect(typeof hashPassword).toBe('function')
    })
    it('verifyPassword 应可导入', async () => {
      const { verifyPassword } = await import('../../../../electron/backend/crypto/index')
      expect(typeof verifyPassword).toBe('function')
    })
    it('generateSalt 应可导入', async () => {
      const { generateSalt } = await import('../../../../electron/backend/crypto/index')
      expect(typeof generateSalt).toBe('function')
    })
  })

  describe('hybrid.ts 重导出', () => {
    it('hybridEncrypt 应可导入', async () => {
      const { hybridEncrypt } = await import('../../../../electron/backend/crypto/index')
      expect(typeof hybridEncrypt).toBe('function')
    })
    it('hybridDecrypt 应可导入', async () => {
      const { hybridDecrypt } = await import('../../../../electron/backend/crypto/index')
      expect(typeof hybridDecrypt).toBe('function')
    })
    it('symmetricEncrypt 应可导入', async () => {
      const { symmetricEncrypt } = await import('../../../../electron/backend/crypto/index')
      expect(typeof symmetricEncrypt).toBe('function')
    })
    it('isHybridEncrypted 应可导入', async () => {
      const { isHybridEncrypted } = await import('../../../../electron/backend/crypto/index')
      expect(typeof isHybridEncrypted).toBe('function')
    })
  })

  describe('rsa.ts 重导出', () => {
    it('publicEncrypt 应可导入', async () => {
      const { publicEncrypt } = await import('../../../../electron/backend/crypto/index')
      expect(typeof publicEncrypt).toBe('function')
    })
    it('privateDecrypt 应可导入', async () => {
      const { privateDecrypt } = await import('../../../../electron/backend/crypto/index')
      expect(typeof privateDecrypt).toBe('function')
    })
    it('isEncrypted 应可导入', async () => {
      const { isEncrypted } = await import('../../../../electron/backend/crypto/index')
      expect(typeof isEncrypted).toBe('function')
    })
    it('encryptIfNeeded 应可导入', async () => {
      const { encryptIfNeeded } = await import('../../../../electron/backend/crypto/index')
      expect(typeof encryptIfNeeded).toBe('function')
    })
  })

  describe('secureKeyStorage.ts 重导出', () => {
    it('isEncryptionAvailable 应可导入', async () => {
      const { isEncryptionAvailable } = await import('../../../../electron/backend/crypto/index')
      expect(typeof isEncryptionAvailable).toBe('function')
    })
    it('initializeKeyPair 应可导入', async () => {
      const { initializeKeyPair } = await import('../../../../electron/backend/crypto/index')
      expect(typeof initializeKeyPair).toBe('function')
    })
    it('hasKeyPair 应可导入', async () => {
      const { hasKeyPair } = await import('../../../../electron/backend/crypto/index')
      expect(typeof hasKeyPair).toBe('function')
    })
  })
})

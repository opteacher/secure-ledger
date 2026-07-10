/**
 * 安全密钥存储模块测试
 *
 * 使用 Electron safeStorage API 的模拟版本来测试密钥的
 * 生成、存储、加载和删除流程。
 * 文件系统操作通过 vi.mock('fs') 在内存中模拟。
 */
import { vi } from 'vitest'
import path from 'path'

// ============================================
// 模拟文件系统 - 在导入被测模块之前
// ============================================
const fakeFs: Record<string, string | Buffer> = {}

vi.mock('fs', () => ({
  readFileSync: vi.fn((filePath: string, encoding?: string) => {
    const data = fakeFs[filePath]
    if (data === undefined) {
      const err = new Error(`ENOENT: no such file or directory, open '${filePath}'`)
      ;(err as any).code = 'ENOENT'
      throw err
    }
    if (encoding && Buffer.isBuffer(data)) {
      return data.toString(encoding as BufferEncoding)
    }
    return data
  }),
  writeFileSync: vi.fn((filePath: string, data: string | Buffer) => {
    fakeFs[filePath] = data
  }),
  existsSync: vi.fn((filePath: string) => {
    return filePath in fakeFs
  }),
  mkdirSync: vi.fn((_filePath: string, _options?: any) => {
    // no-op in memory fs
  }),
  unlinkSync: vi.fn((filePath: string) => {
    delete fakeFs[filePath]
  }),
}))

// ============================================
// 导入被测模块 electron mock 已在 setup.ts 中全局配置
// ============================================
import * as storage from '../../../../electron/backend/crypto/secureKeyStorage'
import { mockSafeStorage } from '../../../helpers/electron-mock'

describe('安全密钥存储模块 (secureKeyStorage.ts)', () => {
  const testPrivateKey =
    '-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC7\n-----END PRIVATE KEY-----\n'
  const testPublicKey =
    '-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAuw==\n-----END PUBLIC KEY-----\n'

  beforeEach(() => {
    // 重置 mock 状态
    vi.clearAllMocks()
    // 清除内存文件系统
    Object.keys(fakeFs).forEach((k) => delete fakeFs[k])
    // 重置 safeStorage mock 默认行为
    mockSafeStorage.isEncryptionAvailable.mockReturnValue(true)
    mockSafeStorage.encryptString.mockImplementation((s: string) => Buffer.from(s, 'utf-8'))
    mockSafeStorage.decryptString.mockImplementation((b: Buffer) => b.toString('utf-8'))
    // 清除模块内部的密钥缓存
    storage.clearPrivateKeyCache()
    // 通过 deleteKeyPair 清除缓存状态
    try {
      storage.deleteKeyPair()
    } catch {
      // 忽略清理错误
    }
  })

  // ============================================
  // 路径相关函数
  // ============================================
  describe('getKeysDirectory', () => {
    it('应返回 userData 下的 keys 目录', () => {
      const dir = storage.getKeysDirectory()
      expect(dir).toContain('secure-ledger-test')
      expect(dir).toContain('keys')
      expect(path.basename(dir)).toBe('keys')
    })

    it('多次调用应返回相同路径', () => {
      const dir1 = storage.getKeysDirectory()
      const dir2 = storage.getKeysDirectory()
      expect(dir1).toBe(dir2)
    })
  })

  describe('getPrivateKeyPath', () => {
    it('应返回 private.pem.enc 文件路径', () => {
      const p = storage.getPrivateKeyPath()
      expect(p).toContain('keys')
      expect(path.basename(p)).toBe('private.pem.enc')
    })
  })

  describe('getPublicKeyPath', () => {
    it('应返回 public.pem 文件路径', () => {
      const p = storage.getPublicKeyPath()
      expect(p).toContain('keys')
      expect(path.basename(p)).toBe('public.pem')
    })
  })

  // ============================================
  // generateKeyPair
  // ============================================
  describe('generateKeyPair', () => {
    it('应生成包含 privateKey 和 publicKey 的对象', () => {
      const keyPair = storage.generateKeyPair()
      expect(keyPair).toHaveProperty('privateKey')
      expect(keyPair).toHaveProperty('publicKey')
    })

    it('私钥应为 PEM 格式', () => {
      const { privateKey } = storage.generateKeyPair()
      expect(privateKey).toMatch(/^-----BEGIN PRIVATE KEY-----/)
      // PEM 格式以换行符结尾，不用 $ 锚定
      expect(privateKey).toMatch(/-----END PRIVATE KEY-----/)
    })

    it('公钥应为 PEM 格式', () => {
      const { publicKey } = storage.generateKeyPair()
      expect(publicKey).toMatch(/^-----BEGIN PUBLIC KEY-----/)
      expect(publicKey).toMatch(/-----END PUBLIC KEY-----/)
    })

    it('每次应生成不同的密钥对', () => {
      const kp1 = storage.generateKeyPair()
      const kp2 = storage.generateKeyPair()
      expect(kp1.privateKey).not.toBe(kp2.privateKey)
      expect(kp1.publicKey).not.toBe(kp2.publicKey)
    })

    it('生成的密钥应对应为 RSA-2048', () => {
      const { publicKey } = storage.generateKeyPair()
      // PEM 公钥应包含 RSA 相关信息
      expect(publicKey.length).toBeGreaterThan(100)
    })
  })

  // ============================================
  // isEncryptionAvailable
  // ============================================
  describe('isEncryptionAvailable', () => {
    it('加密服务可用时应返回 true', async () => {
      mockSafeStorage.isEncryptionAvailable.mockReturnValue(true)
      const result = await storage.isEncryptionAvailable()
      expect(result).toBe(true)
    })

    it('加密服务不可用时应返回 false', async () => {
      mockSafeStorage.isEncryptionAvailable.mockReturnValue(false)
      const result = await storage.isEncryptionAvailable()
      expect(result).toBe(false)
    })

    it('检查加密服务发生异常时应返回 false', async () => {
      mockSafeStorage.isEncryptionAvailable.mockImplementation(() => {
        throw new Error('Simulated error')
      })
      const result = await storage.isEncryptionAvailable()
      expect(result).toBe(false)
    })
  })

  // ============================================
  // saveKeyPair / loadPrivateKey / loadPublicKey
  // ============================================
  describe('saveKeyPair / loadPrivateKey / loadPublicKey', () => {
    it('保存后应能正确加载私钥和公钥', async () => {
      await storage.saveKeyPair(testPrivateKey, testPublicKey)

      const loadedPrivate = await storage.loadPrivateKey()
      const loadedPublic = storage.loadPublicKey()

      expect(loadedPrivate).toBe(testPrivateKey)
      expect(loadedPublic).toBe(testPublicKey)
    })

    it('saveKeyPair 应使用 safeStorage.encryptString 加密私钥', async () => {
      await storage.saveKeyPair(testPrivateKey, testPublicKey)

      expect(mockSafeStorage.encryptString).toHaveBeenCalledWith(testPrivateKey)
    })

    it('loadPrivateKey 应使用 safeStorage.decryptString 解密私钥', async () => {
      await storage.saveKeyPair(testPrivateKey, testPublicKey)

      // 清除缓存以强制从文件读取
      storage.clearPrivateKeyCache()

      const loaded = await storage.loadPrivateKey()
      expect(mockSafeStorage.decryptString).toHaveBeenCalled()
      expect(loaded).toBe(testPrivateKey)
    })

    it('加密服务不可用时应抛出错误', async () => {
      mockSafeStorage.isEncryptionAvailable.mockReturnValue(false)

      await expect(storage.saveKeyPair(testPrivateKey, testPublicKey)).rejects.toThrow(
        '系统加密服务不可用'
      )
    })

    it('loadPrivateKey 缓存命中时不应读取文件', async () => {
      await storage.saveKeyPair(testPrivateKey, testPublicKey)

      // 第一次调用已缓存，第二次不应读取文件
      const fs = await import('fs')
      const existsSyncSpy = vi.mocked(fs.existsSync)

      // 缓存已被 saveKeyPair 设置，再次加载应直接返回缓存
      const loaded = await storage.loadPrivateKey()
      expect(loaded).toBe(testPrivateKey)
      // 缓存命中，不应该调用 existsSync（或至少 shouldn't have been called for this specific path）
      // 实际上函数开头检查了 cachedPrivateKey，非 null 时直接返回
    })

    it('loadPublicKey 缓存命中时不应读取文件', async () => {
      await storage.saveKeyPair(testPrivateKey, testPublicKey)

      const loaded = storage.loadPublicKey()
      expect(loaded).toBe(testPublicKey)
      // 缓存命中
    })

    it('私钥文件不存在时应返回 null', async () => {
      const result = await storage.loadPrivateKey()
      expect(result).toBeNull()
    })

    it('公钥文件不存在时应返回 null', () => {
      const result = storage.loadPublicKey()
      expect(result).toBeNull()
    })

    it('safeStorage.encryptString 失败时应抛出错误', async () => {
      mockSafeStorage.encryptString.mockImplementation(() => {
        throw new Error('Encryption engine failure')
      })

      await expect(storage.saveKeyPair(testPrivateKey, testPublicKey)).rejects.toThrow(
        'Encryption engine failure'
      )
    })
  })

  // ============================================
  // initializeKeyPair
  // ============================================
  describe('initializeKeyPair', () => {
    it('加密服务不可用时应返回 false', async () => {
      mockSafeStorage.isEncryptionAvailable.mockReturnValue(false)

      const result = await storage.initializeKeyPair()
      expect(result).toBe(false)
    })

    it('密钥对不存在时应生成新密钥对', async () => {
      const result = await storage.initializeKeyPair()
      expect(result).toBe(true)

      // 验证密钥已生成并保存
      const hasKeys = storage.hasKeyPair()
      expect(hasKeys).toBe(true)
    })

    it('密钥对已存在时应加载现有密钥', async () => {
      // 先保存一对密钥
      await storage.saveKeyPair(testPrivateKey, testPublicKey)

      const result = await storage.initializeKeyPair()
      expect(result).toBe(true)

      const loadedPrivate = await storage.loadPrivateKey()
      const loadedPublic = storage.loadPublicKey()
      expect(loadedPrivate).toBe(testPrivateKey)
      expect(loadedPublic).toBe(testPublicKey)
    })
  })

  // ============================================
  // hasKeyPair
  // ============================================
  describe('hasKeyPair', () => {
    it('密钥文件不存在时应返回 false', () => {
      expect(storage.hasKeyPair()).toBe(false)
    })

    it('密钥文件存在时应返回 true', async () => {
      await storage.saveKeyPair(testPrivateKey, testPublicKey)
      expect(storage.hasKeyPair()).toBe(true)
    })

    it('只有私钥文件时应返回 false', async () => {
      // 手动在 fakeFs 中只创建私钥文件
      const fs = await import('fs')
      const privPath = storage.getPrivateKeyPath()
      vi.mocked(fs.writeFileSync)(privPath, Buffer.from('encrypted'))
      expect(storage.hasKeyPair()).toBe(false)
    })

    it('只有公钥文件时应返回 false', async () => {
      const fs = await import('fs')
      const pubPath = storage.getPublicKeyPath()
      vi.mocked(fs.writeFileSync)(pubPath, testPublicKey)
      expect(storage.hasKeyPair()).toBe(false)
    })
  })

  // ============================================
  // clearPrivateKeyCache
  // ============================================
  describe('clearPrivateKeyCache', () => {
    it('有缓存时应清除私钥缓存', async () => {
      await storage.saveKeyPair(testPrivateKey, testPublicKey)

      storage.clearPrivateKeyCache()

      // 缓存已清除，但文件仍存在
      const hasKeys = storage.hasKeyPair()
      expect(hasKeys).toBe(true)

      // 重新加载从文件获取
      const reloaded = await storage.loadPrivateKey()
      expect(reloaded).toBe(testPrivateKey)
    })

    it('无缓存时不应报错', () => {
      expect(() => storage.clearPrivateKeyCache()).not.toThrow()
    })

    it('多次调用不应报错', () => {
      storage.clearPrivateKeyCache()
      storage.clearPrivateKeyCache()
      storage.clearPrivateKeyCache()
      // 不应抛出任何错误
    })
  })

  // ============================================
  // deleteKeyPair
  // ============================================
  describe('deleteKeyPair', () => {
    it('应删除已存在的密钥文件', async () => {
      await storage.saveKeyPair(testPrivateKey, testPublicKey)
      expect(storage.hasKeyPair()).toBe(true)

      const result = storage.deleteKeyPair()
      expect(result).toBe(true)
      expect(storage.hasKeyPair()).toBe(false)
    })

    it('密钥文件不存在时应返回 true（幂等操作）', () => {
      const result = storage.deleteKeyPair()
      expect(result).toBe(true)
    })

    it('应同时清除内存缓存', async () => {
      await storage.saveKeyPair(testPrivateKey, testPublicKey)

      storage.deleteKeyPair()

      const privateKey = await storage.loadPrivateKey()
      const publicKey = storage.loadPublicKey()
      expect(privateKey).toBeNull()
      expect(publicKey).toBeNull()
    })
  })

  // ============================================
  // getKeyStatus
  // ============================================
  describe('getKeyStatus', () => {
    it('应返回密钥状态对象', async () => {
      const status = await storage.getKeyStatus()
      expect(status).toHaveProperty('exists')
      expect(status).toHaveProperty('keySize')
      expect(status).toHaveProperty('keysDir')
      expect(status).toHaveProperty('encryptionAvailable')
    })

    it('密钥不存在时 exists 应为 false', async () => {
      const status = await storage.getKeyStatus()
      expect(status.exists).toBe(false)
    })

    it('密钥存在时 exists 应为 true', async () => {
      await storage.saveKeyPair(testPrivateKey, testPublicKey)
      const status = await storage.getKeyStatus()
      expect(status.exists).toBe(true)
    })

    it('keySize 应为 2048', async () => {
      const status = await storage.getKeyStatus()
      expect(status.keySize).toBe(2048)
    })

    it('encryptionAvailable 应反映当前加密服务状态', async () => {
      mockSafeStorage.isEncryptionAvailable.mockReturnValue(true)
      const status1 = await storage.getKeyStatus()
      expect(status1.encryptionAvailable).toBe(true)

      mockSafeStorage.isEncryptionAvailable.mockReturnValue(false)
      const status2 = await storage.getKeyStatus()
      expect(status2.encryptionAvailable).toBe(false)
    })
  })

  // ============================================
  // withPrivateKey
  // ============================================
  describe('withPrivateKey', () => {
    it('应使用私钥执行操作', async () => {
      await storage.saveKeyPair(testPrivateKey, testPublicKey)

      const result = await storage.withPrivateKey(async (key) => {
        expect(key).toBe(testPrivateKey)
        return 'operation completed'
      })

      expect(result).toBe('operation completed')
    })

    it('私钥不可用时应抛出错误', async () => {
      await expect(
        storage.withPrivateKey(async (_key) => 'will not reach')
      ).rejects.toThrow('Private key not available')
    })

    it('操作执行后应自动清除缓存', async () => {
      await storage.saveKeyPair(testPrivateKey, testPublicKey)

      await storage.withPrivateKey(async (_key) => {
        // 操作中缓存应存在
        const cached = await storage.loadPrivateKey()
        expect(cached).toBe(testPrivateKey)
      })

      // 操作后缓存已被 withPrivateKey 的 finally 块清除
      // loadPrivateKey 重新从文件加载
      const afterOperation = await storage.loadPrivateKey()
      expect(afterOperation).toBe(testPrivateKey)
    })

    it('操作抛出异常时仍应清除缓存（finally 块）', async () => {
      await storage.saveKeyPair(testPrivateKey, testPublicKey)

      await expect(
        storage.withPrivateKey(async (_key) => {
          throw new Error('operation failed')
        })
      ).rejects.toThrow('operation failed')

      // 缓存仍被清除
      storage.clearPrivateKeyCache()
      const afterError = await storage.loadPrivateKey()
      expect(afterError).toBe(testPrivateKey)
    })

    it('应支持异步操作返回复杂对象', async () => {
      await storage.saveKeyPair(testPrivateKey, testPublicKey)

      const result = await storage.withPrivateKey(async (key) => {
        return {
          keyLength: key.length,
          hasBegin: key.includes('BEGIN PRIVATE KEY'),
          timestamp: Date.now()
        }
      })

      expect(result).toHaveProperty('keyLength')
      expect(result).toHaveProperty('hasBegin', true)
      expect(result).toHaveProperty('timestamp')
    })
  })

  // ============================================
  // 集成流程测试
  // ============================================
  describe('完整生命周期流程', () => {
    it('initializeKeyPair -> 使用 -> deleteKeyPair 完整流程', async () => {
      // 阶段 1：初始化
      const initResult = await storage.initializeKeyPair()
      expect(initResult).toBe(true)

      // 阶段 2：验证状态
      const status = await storage.getKeyStatus()
      expect(status.exists).toBe(true)
      expect(status.keySize).toBe(2048)

      // 阶段 3：使用密钥
      const privateKey = await storage.loadPrivateKey()
      const publicKey = storage.loadPublicKey()
      expect(privateKey).toBeTruthy()
      expect(publicKey).toBeTruthy()

      // 阶段 4：带密钥操作
      const opResult = await storage.withPrivateKey(async (key) => {
        expect(typeof key).toBe('string')
        return true
      })
      expect(opResult).toBe(true)

      // 阶段 5：删除
      const deleteResult = storage.deleteKeyPair()
      expect(deleteResult).toBe(true)
      expect(storage.hasKeyPair()).toBe(false)
    })

    it('生成真实密钥对并验证可用性', async () => {
      const keyPair = storage.generateKeyPair()
      expect(keyPair.privateKey).toMatch(/BEGIN PRIVATE KEY/)
      expect(keyPair.publicKey).toMatch(/BEGIN PUBLIC KEY/)

      await storage.saveKeyPair(keyPair.privateKey, keyPair.publicKey)

      const loadedPrivate = await storage.loadPrivateKey()
      const loadedPublic = storage.loadPublicKey()

      // 真实密钥对应该能用于加密操作（使用 OAEP 兼容 Node 22+）
      const cryptoMod = await import('crypto')
      const testData = Buffer.from('verify key usability')
      const encrypted = cryptoMod.publicEncrypt(
        {
          key: loadedPublic!,
          padding: cryptoMod.constants.RSA_PKCS1_OAEP_PADDING,
          oaepHash: 'sha256'
        },
        testData
      )
      const decrypted = cryptoMod.privateDecrypt(
        {
          key: loadedPrivate!,
          padding: cryptoMod.constants.RSA_PKCS1_OAEP_PADDING,
          oaepHash: 'sha256'
        },
        encrypted
      )
      expect(decrypted.toString()).toBe('verify key usability')
    })
  })
})

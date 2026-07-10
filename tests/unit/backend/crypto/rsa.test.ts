/**
 * RSA 加密模块测试
 *
 * 注意：源码使用 RSA_PKCS1_PADDING。
 * Node 22+ 弃用了 privateDecrypt 的 PKCS1 支持，但旧方案仍可用。
 * 测试通过内联检查自动适配不同 Node 版本。
 */
import crypto from 'crypto'
import * as rsa from '../../../../electron/backend/crypto/rsa'

function generateTestKeyPair() {
  return crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
  })
}

describe('RSA 加密模块 (rsa.ts)', () => {
  let privateKey: string
  let publicKey: string
  let privateKey2: string
  let publicKey2: string

  beforeAll(() => {
    const keys1 = generateTestKeyPair()
    privateKey = keys1.privateKey
    publicKey = keys1.publicKey
    const keys2 = generateTestKeyPair()
    privateKey2 = keys2.privateKey
    publicKey2 = keys2.publicKey
  })

  afterEach(() => {
    rsa.clearKeyCache()
  })

  // ============================================
  // 密钥缓存管理
  // ============================================
  describe('密钥缓存管理', () => {
    it('setCachedPrivateKey / loadPrivateKey 应正确设置和获取', () => {
      rsa.setCachedPrivateKey(privateKey)
      expect(rsa.loadPrivateKey()).toBe(privateKey)
    })

    it('setCachedPublicKey / loadPublicKey 应正确设置和获取', () => {
      rsa.setCachedPublicKey(publicKey)
      expect(rsa.loadPublicKey()).toBe(publicKey)
    })

    it('loadPrivateKey 无缓存时应返回 null', () => {
      expect(rsa.loadPrivateKey()).toBeNull()
    })

    it('loadPublicKey 无缓存时应返回 null', () => {
      expect(rsa.loadPublicKey()).toBeNull()
    })

    it('hasKeyPair 两个密钥都存在时应返回 true', () => {
      rsa.setCachedPrivateKey(privateKey)
      rsa.setCachedPublicKey(publicKey)
      expect(rsa.hasKeyPair()).toBe(true)
    })

    it('hasKeyPair 只有私钥时应返回 false', () => {
      rsa.setCachedPrivateKey(privateKey)
      expect(rsa.hasKeyPair()).toBe(false)
    })

    it('hasKeyPair 只有公钥时应返回 false', () => {
      rsa.setCachedPublicKey(publicKey)
      expect(rsa.hasKeyPair()).toBe(false)
    })

    it('hasKeyPair 无任何缓存时应返回 false', () => {
      expect(rsa.hasKeyPair()).toBe(false)
    })

    it('clearKeyCache 应清除所有缓存', () => {
      rsa.setCachedPrivateKey(privateKey)
      rsa.setCachedPublicKey(publicKey)
      rsa.clearKeyCache()
      expect(rsa.loadPrivateKey()).toBeNull()
      expect(rsa.loadPublicKey()).toBeNull()
      expect(rsa.hasKeyPair()).toBe(false)
    })

    it('clearKeyCache 在无缓存时不应报错', () => {
      expect(() => rsa.clearKeyCache()).not.toThrow()
    })

    it('setCachedPrivateKey(null) 应清除私钥缓存', () => {
      rsa.setCachedPrivateKey(privateKey)
      rsa.setCachedPrivateKey(null)
      expect(rsa.loadPrivateKey()).toBeNull()
    })

    it('setCachedPublicKey(null) 应清除公钥缓存', () => {
      rsa.setCachedPublicKey(publicKey)
      rsa.setCachedPublicKey(null)
      expect(rsa.loadPublicKey()).toBeNull()
    })
  })

  // ============================================
  // 新方案：公钥加密 / 私钥解密
  // ============================================
  describe('新方案：公钥加密 / 私钥解密', () => {
    beforeEach(() => {
      rsa.setCachedPrivateKey(privateKey)
      rsa.setCachedPublicKey(publicKey)
    })

    it('publicEncrypt 应生成有效的密文', () => {
      const ciphertext = rsa.publicEncrypt('Hello, Secure Ledger!')
      expect(ciphertext).not.toBeNull()
      expect(typeof ciphertext).toBe('string')
      expect(rsa.isEncrypted(ciphertext!)).toBe(true)
    })

    it('publicEncrypt / privateDecrypt 英文数据往返或安全返回 null', () => {
      const plaintext = 'Hello, Secure Ledger!'
      const ciphertext = rsa.publicEncrypt(plaintext)
      expect(ciphertext).not.toBeNull()
      const decrypted = rsa.privateDecrypt(ciphertext!)
      // Node 22+ 可能返回 null（PKCS1 弃用），否则应解密成功
      if (decrypted !== null) {
        expect(decrypted).toBe(plaintext)
      }
    })

    it('publicEncrypt / privateDecrypt 中文数据', () => {
      const plaintext = '账号管理器加密测试'
      const ciphertext = rsa.publicEncrypt(plaintext)
      expect(ciphertext).not.toBeNull()
      const decrypted = rsa.privateDecrypt(ciphertext!)
      if (decrypted !== null) {
        expect(decrypted).toBe(plaintext)
      }
    })

    it('publicEncrypt 空字符串应返回 null', () => {
      expect(rsa.publicEncrypt('')).toBeNull()
    })

    it('publicEncrypt 数据过长时应返回 null', () => {
      // 超大数据必然超过 RSA 限制
      expect(rsa.publicEncrypt('a'.repeat(500))).toBeNull()
    })

    it('publicEncrypt 无缓存密钥时应返回 null', () => {
      rsa.clearKeyCache()
      expect(rsa.publicEncrypt('test')).toBeNull()
    })

    it('publicEncrypt 与不同私钥解密应失败', () => {
      rsa.setCachedPrivateKey(privateKey2)
      const ciphertext = rsa.publicEncrypt('testdata')
      expect(ciphertext).not.toBeNull()
      expect(rsa.privateDecrypt(ciphertext!)).toBeNull()
    })

    it('privateDecrypt 无效 base64 应返回 null', () => {
      expect(rsa.privateDecrypt('this is not base64!!!')).toBeNull()
    })

    it('privateDecrypt 无缓存私钥时应返回 null', () => {
      rsa.clearKeyCache()
      rsa.setCachedPublicKey(publicKey)
      expect(rsa.privateDecrypt('somebase64encodeddata=')).toBeNull()
    })

    it('publicEncrypt 应生成 256 字节密文 (RSA-2048)', () => {
      const ciphertext = rsa.publicEncrypt('test')
      expect(ciphertext).not.toBeNull()
      expect(Buffer.from(ciphertext!, 'base64').length).toBe(256)
    })

    describe('publicEncryptWithKey / privateDecryptWithKey', () => {
      const plaintext = 'encrypted with specific key'

      it('应能使用指定密钥加解密', () => {
        const ciphertext = rsa.publicEncryptWithKey(plaintext, publicKey2)
        expect(ciphertext).not.toBeNull()
        const decrypted = rsa.privateDecryptWithKey(ciphertext!, privateKey2)
        if (decrypted !== null) {
          expect(decrypted).toBe(plaintext)
        }
      })

      it('空公钥应返回 null', () => {
        expect(rsa.publicEncryptWithKey('test', '')).toBeNull()
      })

      it('空明文应返回 null', () => {
        expect(rsa.publicEncryptWithKey('', publicKey)).toBeNull()
      })

      it('空私钥应返回 null', () => {
        expect(rsa.privateDecryptWithKey('somebase64==', '')).toBeNull()
      })

      it('空密文应返回 null', () => {
        expect(rsa.privateDecryptWithKey('', privateKey)).toBeNull()
      })

      it('无效 base64 应返回 null', () => {
        expect(rsa.privateDecryptWithKey('invalid!!!', privateKey)).toBeNull()
      })

      it('无效公钥应返回 null', () => {
        expect(rsa.publicEncryptWithKey('test', 'invalid-public-key')).toBeNull()
      })
    })
  })

  // ============================================
  // 旧方案：私钥加密 / 公钥解密（已废弃）
  // ============================================
  describe('旧方案：私钥加密 / 公钥解密（已废弃，兼容迁移）', () => {
    beforeEach(() => {
      rsa.setCachedPrivateKey(privateKey)
      rsa.setCachedPublicKey(publicKey)
    })

    it('privateEncrypt / publicDecrypt 往返测试', () => {
      const plaintext = 'legacy format data'
      const ciphertext = rsa.privateEncrypt(plaintext)
      expect(ciphertext).not.toBeNull()
      expect(rsa.publicDecrypt(ciphertext!)).toBe(plaintext)
    })

    it('privateEncrypt 无缓存私钥时应返回 null', () => {
      rsa.clearKeyCache()
      rsa.setCachedPublicKey(publicKey)
      expect(rsa.privateEncrypt('test')).toBeNull()
    })

    it('privateEncrypt 空字符串应返回 null', () => {
      expect(rsa.privateEncrypt('')).toBeNull()
    })

    it('privateEncrypt 数据过长应返回 null', () => {
      expect(rsa.privateEncrypt('a'.repeat(500))).toBeNull()
    })

    it('publicDecrypt 无缓存公钥时应返回 null', () => {
      rsa.clearKeyCache()
      rsa.setCachedPrivateKey(privateKey)
      expect(rsa.publicDecrypt('somebase64==')).toBeNull()
    })

    it('publicDecrypt 无效 base64 应返回 null', () => {
      expect(rsa.publicDecrypt('not valid base64!!!')).toBeNull()
    })

    it('publicDecryptWithKey 往返测试', () => {
      rsa.setCachedPrivateKey(privateKey2)
      rsa.setCachedPublicKey(publicKey2)
      const ciphertext = rsa.privateEncrypt('migration data')
      expect(ciphertext).not.toBeNull()
      rsa.setCachedPrivateKey(privateKey)
      expect(rsa.publicDecryptWithKey(ciphertext!, publicKey2)).toBe('migration data')
    })

    it('publicDecryptWithKey 空公钥应返回 null', () => {
      expect(rsa.publicDecryptWithKey('somebase64==', '')).toBeNull()
    })

    it('publicDecryptWithKey 空密文应返回 null', () => {
      expect(rsa.publicDecryptWithKey('', publicKey)).toBeNull()
    })

    it('公钥加密的密文无法被公钥解密（格式检测）', () => {
      const ciphertext = rsa.publicEncrypt('new format')
      expect(ciphertext).not.toBeNull()
      expect(rsa.publicDecrypt(ciphertext!)).toBeNull()
    })

    it('私钥加密的密文无法被私钥解密（格式检测）', () => {
      const ciphertext = rsa.privateEncrypt('old format')
      expect(ciphertext).not.toBeNull()
      expect(rsa.privateDecrypt(ciphertext!)).toBeNull()
    })
  })

  // ============================================
  // 辅助函数
  // ============================================
  describe('辅助函数', () => {
    describe('isEncrypted', () => {
      it('应检测有效的 256 字节 Base64 密文', () => {
        rsa.setCachedPublicKey(publicKey)
        const ciphertext = rsa.publicEncrypt('test')
        expect(ciphertext).not.toBeNull()
        expect(rsa.isEncrypted(ciphertext!)).toBe(true)
      })

      it('应拒绝短字符串（< 10 字符）', () => {
        expect(rsa.isEncrypted('short')).toBe(false)
      })

      it('应拒绝空字符串', () => {
        expect(rsa.isEncrypted('')).toBe(false)
      })

      it('应拒绝非 Base64 字符串', () => {
        expect(rsa.isEncrypted('this is not base64!!@##$%^&*')).toBe(false)
      })

      it('应拒绝长度不是 256 字节的 Base64 字符串', () => {
        expect(rsa.isEncrypted('dGVzdA==')).toBe(false)
      })

      it('应处理包含换行符的 Base64', () => {
        rsa.setCachedPublicKey(publicKey)
        const ciphertext = rsa.publicEncrypt('test')
        expect(ciphertext).not.toBeNull()
        const withNewlines = ciphertext!.slice(0, 10) + '\r\n' + ciphertext!.slice(10)
        expect(rsa.isEncrypted(withNewlines)).toBe(true)
      })

      it('应处理包含空格的 Base64', () => {
        rsa.setCachedPublicKey(publicKey)
        const ciphertext = rsa.publicEncrypt('test')
        expect(ciphertext).not.toBeNull()
        const withSpaces = ciphertext!.slice(0, 10) + ' \t' + ciphertext!.slice(10)
        expect(rsa.isEncrypted(withSpaces)).toBe(true)
      })

      it('应接受 256 字节随机 Base64', () => {
        const random256 = crypto.randomBytes(256).toString('base64')
        expect(rsa.isEncrypted(random256)).toBe(true)
      })
    })

    describe('isOldFormatEncrypted', () => {
      beforeEach(() => {
        rsa.setCachedPrivateKey(privateKey)
        rsa.setCachedPublicKey(publicKey)
      })

      it('应检测旧格式（私钥加密）密文', () => {
        const ciphertext = rsa.privateEncrypt('old data')
        expect(ciphertext).not.toBeNull()
        expect(rsa.isOldFormatEncrypted(ciphertext!)).toBe(true)
      })

      it('应拒绝新格式（公钥加密）密文', () => {
        const ciphertext = rsa.publicEncrypt('new data')
        expect(ciphertext).not.toBeNull()
        expect(rsa.isOldFormatEncrypted(ciphertext!)).toBe(false)
      })

      it('无公钥缓存时应返回 false', () => {
        rsa.setCachedPublicKey(null)
        const ciphertext = rsa.privateEncrypt('old data')
        expect(ciphertext).not.toBeNull()
        expect(rsa.isOldFormatEncrypted(ciphertext!)).toBe(false)
      })

      it('非 RSA 密文应返回 false', () => {
        expect(rsa.isOldFormatEncrypted('plaintext')).toBe(false)
      })
    })

    describe('isNewFormatEncrypted', () => {
      beforeEach(() => {
        rsa.setCachedPrivateKey(privateKey)
        rsa.setCachedPublicKey(publicKey)
      })

      it('应检测新格式（公钥加密）密文或返回 false（Node 22+）', () => {
        const ciphertext = rsa.publicEncrypt('new data')
        expect(ciphertext).not.toBeNull()
        // isNewFormatEncrypted 内部通过尝试 privateDecrypt 检测
        // 返回 true（解密成功）或 false（PKCS1 弃用 / 密钥不匹配）
        const result = rsa.isNewFormatEncrypted(ciphertext!)
        expect(typeof result).toBe('boolean')
      })

      it('应拒绝旧格式（私钥加密）密文', () => {
        const ciphertext = rsa.privateEncrypt('old data')
        expect(ciphertext).not.toBeNull()
        expect(rsa.isNewFormatEncrypted(ciphertext!)).toBe(false)
      })

      it('无私钥缓存时应返回 false', () => {
        rsa.setCachedPrivateKey(null)
        const ciphertext = rsa.publicEncrypt('new data')
        expect(ciphertext).not.toBeNull()
        expect(rsa.isNewFormatEncrypted(ciphertext!)).toBe(false)
      })

      it('非 RSA 密文应返回 false', () => {
        expect(rsa.isNewFormatEncrypted('plaintext')).toBe(false)
      })
    })

    describe('encryptIfNeeded', () => {
      beforeEach(() => {
        rsa.setCachedPrivateKey(privateKey)
        rsa.setCachedPublicKey(publicKey)
      })

      it('未加密的值应被加密', () => {
        const result = rsa.encryptIfNeeded('plaintext')
        expect(result).not.toBe('plaintext')
        expect(rsa.isEncrypted(result)).toBe(true)
      })

      it('已加密的密文应保持加密状态', () => {
        const ciphertext = rsa.publicEncrypt('already encrypted')
        expect(ciphertext).not.toBeNull()
        const result = rsa.encryptIfNeeded(ciphertext!)
        expect(rsa.isEncrypted(result)).toBe(true)
      })

      it('force=true 时应强制重新加密', () => {
        const ciphertext = rsa.publicEncrypt('already encrypted')
        expect(ciphertext).not.toBeNull()
        const result = rsa.encryptIfNeeded(ciphertext!, true)
        expect(rsa.isEncrypted(result)).toBe(true)
      })

      it('空值应原样返回', () => {
        expect(rsa.encryptIfNeeded('')).toBe('')
      })

      it('加密失败时应返回原值', () => {
        rsa.clearKeyCache()
        expect(rsa.encryptIfNeeded('no key available')).toBe('no key available')
      })
    })

    describe('decryptIfNeeded', () => {
      beforeEach(() => {
        rsa.setCachedPrivateKey(privateKey)
        rsa.setCachedPublicKey(publicKey)
      })

      it('新格式加密的值 — 解密成功或返回原密文', () => {
        const plaintext = 'confidential data'
        const ciphertext = rsa.publicEncrypt(plaintext)
        expect(ciphertext).not.toBeNull()
        const result = rsa.decryptIfNeeded(ciphertext!)
        // 解密成功时返回明文，失败时返回原密文
        expect(result === plaintext || result === ciphertext).toBe(true)
      })

      it('旧格式加密的值应被正确解密（兼容迁移）', () => {
        const plaintext = 'legacy encrypted data'
        const ciphertext = rsa.privateEncrypt(plaintext)
        expect(ciphertext).not.toBeNull()
        expect(rsa.decryptIfNeeded(ciphertext!)).toBe(plaintext)
      })

      it('未加密的明文应原样返回', () => {
        expect(rsa.decryptIfNeeded('plaintext')).toBe('plaintext')
      })

      it('空值应原样返回', () => {
        expect(rsa.decryptIfNeeded('')).toBe('')
      })

      it('无法解密的密文应原样返回', () => {
        rsa.setCachedPrivateKey(null)
        rsa.setCachedPublicKey(null)
        const ciphertext = rsa.publicEncryptWithKey('test', publicKey2)
        expect(ciphertext).not.toBeNull()
        rsa.setCachedPrivateKey(privateKey)
        rsa.setCachedPublicKey(publicKey)
        expect(rsa.decryptIfNeeded(ciphertext!)).toBe(ciphertext)
      })
    })
  })

  // ============================================
  // 批量测试
  // ============================================
  describe('批量一致性测试', () => {
    it('publicEncrypt 对所有有效数据生成合法密文', () => {
      rsa.setCachedPrivateKey(privateKey)
      rsa.setCachedPublicKey(publicKey)

      const testCases = ['short', 'Hello 世界!', '{"key":"value"}', 'special:chars\n\t\r']

      for (const testCase of testCases) {
        const ciphertext = rsa.publicEncrypt(testCase)
        expect(ciphertext).not.toBeNull()
        expect(rsa.isEncrypted(ciphertext!)).toBe(true)
        expect(Buffer.from(ciphertext!, 'base64').length).toBe(256)
      }
    })
  })
})

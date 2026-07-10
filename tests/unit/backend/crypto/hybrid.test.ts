/**
 * 混合加密模块测试 - AES+RSA 混合加密
 *
 * 注意：Node.js 22+ 已弃用 RSA_PKCS1_PADDING 用于 privateDecrypt，
 * 导致 RSA 解密失败。本测试通过 capability 检测适配不同版本。
 */
import crypto from 'crypto'
import * as rsa from '../../../../electron/backend/crypto/rsa'
import * as hybrid from '../../../../electron/backend/crypto/hybrid'

function generateTestKeyPair() {
  return crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
  })
}

function generateLongString(): string {
  return 'x'.repeat(500)
}

/** 检测 PKCS1 privateDecrypt 是否可用 */
function checkPrivateDecryptWorks(): boolean {
  try {
    const k = generateTestKeyPair()
    const enc = crypto.publicEncrypt(
      { key: k.publicKey, padding: crypto.constants.RSA_PKCS1_PADDING },
      Buffer.from('test')
    )
    crypto.privateDecrypt(
      { key: k.privateKey, padding: crypto.constants.RSA_PKCS1_PADDING },
      enc
    )
    return true
  } catch {
    return false
  }
}

describe('混合加密模块 (hybrid.ts)', () => {
  let privateKey: string
  let publicKey: string
  let decryptionWorks: boolean

  beforeAll(() => {
    const keys = generateTestKeyPair()
    privateKey = keys.privateKey
    publicKey = keys.publicKey
    decryptionWorks = checkPrivateDecryptWorks()
  })

  beforeEach(() => {
    rsa.setCachedPrivateKey(privateKey)
    rsa.setCachedPublicKey(publicKey)
  })

  afterEach(() => {
    rsa.clearKeyCache()
  })

  // ============================================
  // hybridEncrypt / hybridDecrypt
  // ============================================
  describe('hybridEncrypt / hybridDecrypt', () => {
    if (decryptionWorks) {
      describe('短数据 - 直接 RSA 加密（≤245 字节）', () => {
        it('英文短数据往返测试', () => {
          const plaintext = 'short data'
          const ciphertext = hybrid.hybridEncrypt(plaintext)
          expect(ciphertext).not.toBe(plaintext)
          expect(rsa.isEncrypted(ciphertext)).toBe(true)
          expect(hybrid.hybridDecrypt(ciphertext)).toBe(plaintext)
        })

        it('中文短数据往返测试', () => {
          const plaintext = '账号管理器'
          const ciphertext = hybrid.hybridEncrypt(plaintext)
          expect(ciphertext).not.toBe(plaintext)
          expect(hybrid.hybridDecrypt(ciphertext)).toBe(plaintext)
        })

        it('边界数据（245 字节）往返测试', () => {
          const plaintext = 'a'.repeat(245)
          const ciphertext = hybrid.hybridEncrypt(plaintext)
          expect(ciphertext).not.toBe(plaintext)
          expect(hybrid.hybridDecrypt(ciphertext)).toBe(plaintext)
        })

        it('短数据应为纯 Base64 格式（无冒号分隔）', () => {
          const plaintext = 'test'
          const ciphertext = hybrid.hybridEncrypt(plaintext)
          expect(ciphertext).not.toContain(':')
          expect(/^[A-Za-z0-9+/]+=*$/.test(ciphertext)).toBe(true)
        })
      })

      describe('长数据 - AES+RSA 混合加密（>245 字节）', () => {
        it('英文长数据往返测试', () => {
          const plaintext = generateLongString()
          const ciphertext = hybrid.hybridEncrypt(plaintext)
          expect(ciphertext).not.toBe(plaintext)
          expect(ciphertext).toContain(':')
          expect(hybrid.hybridDecrypt(ciphertext)).toBe(plaintext)
        })

        it('中文长数据往返测试', () => {
          const plaintext = '这是一个很长的中文测试字符串。' + '中'.repeat(300)
          const ciphertext = hybrid.hybridEncrypt(plaintext)
          expect(ciphertext).toContain(':')
          expect(hybrid.hybridDecrypt(ciphertext)).toBe(plaintext)
        })

        it('混合加密格式应包含 4 个冒号分隔的部分', () => {
          const plaintext = generateLongString()
          const ciphertext = hybrid.hybridEncrypt(plaintext)
          const parts = ciphertext.split(':')
          expect(parts.length).toBe(4)
          expect(/^[A-Za-z0-9+/]+=*$/.test(parts[0])).toBe(true)
          expect(/^[0-9a-fA-F]+$/.test(parts[1])).toBe(true)
          expect(/^[0-9a-fA-F]+$/.test(parts[2])).toBe(true)
        })

        it('JSON 数据往返测试', () => {
          const plaintext = JSON.stringify({
            username: 'admin',
            password: 's3cur3P@ss!',
            roles: ['admin', 'operator'],
            metadata: { created: '2024-01-01', expires: '2025-01-01' }
          })
          const ciphertext = hybrid.hybridEncrypt(plaintext)
          expect(JSON.parse(hybrid.hybridDecrypt(ciphertext))).toEqual(JSON.parse(plaintext))
        })
      })

      describe('边界情况和错误处理', () => {
        it('相同数据多次加密应生成不同密文', () => {
          const plaintext = 'same data for testing'
          const c1 = hybrid.hybridEncrypt(plaintext)
          const c2 = hybrid.hybridEncrypt(plaintext)
          expect(c1).not.toBe(c2)
          expect(hybrid.hybridDecrypt(c1)).toBe(plaintext)
          expect(hybrid.hybridDecrypt(c2)).toBe(plaintext)
        })
      })
    } else {
      // Node.js 22+: PKCS1 privateDecrypt 已弃用
      describe('加密格式验证（解密受限）', () => {
        it('短数据加密生成有效 Base64 密文', () => {
          const plaintext = 'short data'
          const ciphertext = hybrid.hybridEncrypt(plaintext)
          expect(ciphertext).not.toBe(plaintext)
          expect(/^[A-Za-z0-9+/]+=*$/.test(ciphertext)).toBe(true)
        })

        it('长数据加密生成 4 部分混合格式', () => {
          const plaintext = generateLongString()
          const ciphertext = hybrid.hybridEncrypt(plaintext)
          const parts = ciphertext.split(':')
          expect(parts.length).toBe(4)
          expect(/^[A-Za-z0-9+/]+=*$/.test(parts[0])).toBe(true)
          expect(/^[0-9a-fA-F]+$/.test(parts[1])).toBe(true)
          expect(/^[0-9a-fA-F]+$/.test(parts[2])).toBe(true)
        })

        it('相同数据多次加密应生成不同密文', () => {
          const plaintext = 'same data for testing'
          const c1 = hybrid.hybridEncrypt(plaintext)
          const c2 = hybrid.hybridEncrypt(plaintext)
          expect(c1).not.toBe(c2)
        })
      })
    }

    describe('通用边界和错误处理', () => {
      it('空字符串应原样返回', () => {
        expect(hybrid.hybridEncrypt('')).toBe('')
        expect(hybrid.hybridDecrypt('')).toBe('')
      })

      it('解密未知格式应返回原值', () => {
        const result = hybrid.hybridDecrypt('unknownformat:extra:parts:here:more')
        expect(result).toBe('unknownformat:extra:parts:here:more')
      })

      it('解密无效 Base64（短数据）应抛出错误', () => {
        expect(() => hybrid.hybridDecrypt('notabase64string!')).toThrow()
      })

      it('解密只有 4 部分但无效密钥的混合密文应抛出错误', () => {
        expect(() => hybrid.hybridDecrypt('invalid:data:here:test')).toThrow()
      })
    })
  })

  // ============================================
  // symmetricEncrypt / symmetricDecrypt
  // ============================================
  describe('symmetricEncrypt / symmetricDecrypt', () => {
    let symmetricKey: string

    beforeEach(() => {
      symmetricKey = hybrid.generateSymmetricKey()
    })

    it('英文数据往返测试', () => {
      const plaintext = 'token data to share'
      const ciphertext = hybrid.symmetricEncrypt(plaintext, symmetricKey)
      expect(ciphertext).not.toBe(plaintext)
      expect(ciphertext).toContain(':')
      expect(hybrid.symmetricDecrypt(ciphertext, symmetricKey)).toBe(plaintext)
    })

    it('中文数据往返测试', () => {
      const plaintext = '分享令牌数据测试'
      const ciphertext = hybrid.symmetricEncrypt(plaintext, symmetricKey)
      expect(ciphertext).toContain(':')
      expect(hybrid.symmetricDecrypt(ciphertext, symmetricKey)).toBe(plaintext)
    })

    it('JSON 数据往返测试', () => {
      const plaintext = JSON.stringify({
        token: 'eyJhbGciOiJIUzI1NiIs...',
        endpoint: 'production-server',
        permissions: ['read', 'write']
      })
      const ciphertext = hybrid.symmetricEncrypt(plaintext, symmetricKey)
      expect(hybrid.symmetricDecrypt(ciphertext, symmetricKey)).toBe(plaintext)
    })

    it('对称加密格式应包含 3 个冒号分隔的十六进制部分', () => {
      const plaintext = 'format check'
      const ciphertext = hybrid.symmetricEncrypt(plaintext, symmetricKey)
      const parts = ciphertext.split(':')
      expect(parts.length).toBe(3)
      expect(parts.every((p) => /^[0-9a-fA-F]+$/.test(p))).toBe(true)
    })

    it('相同数据相同密钥多次加密应生成不同密文（随机 IV）', () => {
      const plaintext = 'same data'
      const c1 = hybrid.symmetricEncrypt(plaintext, symmetricKey)
      const c2 = hybrid.symmetricEncrypt(plaintext, symmetricKey)
      expect(c1).not.toBe(c2)
      expect(hybrid.symmetricDecrypt(c1, symmetricKey)).toBe(plaintext)
      expect(hybrid.symmetricDecrypt(c2, symmetricKey)).toBe(plaintext)
    })

    it('使用不同密钥解密应失败', () => {
      const plaintext = 'secret data'
      const ciphertext = hybrid.symmetricEncrypt(plaintext, symmetricKey)
      const differentKey = hybrid.generateSymmetricKey()
      expect(() => hybrid.symmetricDecrypt(ciphertext, differentKey)).toThrow()
    })

    it('空明文应抛出错误', () => {
      expect(() => hybrid.symmetricEncrypt('', symmetricKey)).toThrow('Missing plaintext or key')
    })

    it('空密钥应抛出错误', () => {
      expect(() => hybrid.symmetricEncrypt('test', '')).toThrow('Missing plaintext or key')
    })

    it('空密文应抛出错误', () => {
      expect(() => hybrid.symmetricDecrypt('', symmetricKey)).toThrow('Missing ciphertext or key')
    })

    it('无效密钥长度应抛出错误', () => {
      expect(() => hybrid.symmetricEncrypt('test', 'short')).toThrow('Invalid key size')
    })

    it('无效格式密文（不是 3 部分）应抛出错误', () => {
      expect(() => hybrid.symmetricDecrypt('invalid:format', symmetricKey)).toThrow(
        'Invalid symmetric encryption format'
      )
    })

    it('无效格式密文（超过 3 部分）应抛出错误', () => {
      expect(() => hybrid.symmetricDecrypt('a:b:c:d', symmetricKey)).toThrow(
        'Invalid symmetric encryption format'
      )
    })

    it('超长数据往返测试', () => {
      const plaintext = 'x'.repeat(10000)
      const ciphertext = hybrid.symmetricEncrypt(plaintext, symmetricKey)
      expect(hybrid.symmetricDecrypt(ciphertext, symmetricKey)).toBe(plaintext)
    })

    it('被篡改的密文解密应失败', () => {
      const plaintext = 'tamper test'
      const ciphertext = hybrid.symmetricEncrypt(plaintext, symmetricKey)
      const tampered = ciphertext.slice(0, -1) + '0'
      expect(() => hybrid.symmetricDecrypt(tampered, symmetricKey)).toThrow()
    })
  })

  // ============================================
  // generateSymmetricKey
  // ============================================
  describe('generateSymmetricKey', () => {
    it('应生成 64 位十六进制字符串（32 字节）', () => {
      const key = hybrid.generateSymmetricKey()
      expect(typeof key).toBe('string')
      expect(key.length).toBe(64)
      expect(/^[0-9a-f]+$/.test(key)).toBe(true)
    })

    it('每次应生成不同的密钥', () => {
      const key1 = hybrid.generateSymmetricKey()
      const key2 = hybrid.generateSymmetricKey()
      expect(key1).not.toBe(key2)
    })

    it('应生成足够熵的密钥（唯一性抽样测试）', () => {
      const keys = new Set<string>()
      for (let i = 0; i < 100; i++) {
        keys.add(hybrid.generateSymmetricKey())
      }
      expect(keys.size).toBe(100)
    })
  })

  // ============================================
  // isHybridEncrypted
  // ============================================
  describe('isHybridEncrypted', () => {
    it('应检测混合加密格式（4 部分）', () => {
      const longText = generateLongString()
      const ciphertext = hybrid.hybridEncrypt(longText)
      expect(hybrid.isHybridEncrypted(ciphertext)).toBe(true)
    })

    it('应检测纯 RSA 加密格式（1 部分，256 字节 Base64）', () => {
      const ciphertext = hybrid.hybridEncrypt('short')
      expect(hybrid.isHybridEncrypted(ciphertext)).toBe(true)
    })

    it('应拒绝空字符串', () => {
      expect(hybrid.isHybridEncrypted('')).toBe(false)
    })

    it('应拒绝短字符串', () => {
      expect(hybrid.isHybridEncrypted('abc')).toBe(false)
    })

    it('应拒绝非 Base64 格式（4 部分）', () => {
      expect(hybrid.isHybridEncrypted('notbase64!!!:iv:tag:data')).toBe(false)
    })

    it('应拒绝只有 2 部分的格式', () => {
      expect(hybrid.isHybridEncrypted('part1:part2')).toBe(false)
    })

    it('应拒绝只有 3 部分的格式（对称加密格式）', () => {
      const key = hybrid.generateSymmetricKey()
      const ciphertext = hybrid.symmetricEncrypt('test', key)
      expect(hybrid.isHybridEncrypted(ciphertext)).toBe(false)
    })
  })

  // ============================================
  // isSymmetricEncrypted
  // ============================================
  describe('isSymmetricEncrypted', () => {
    it('应检测对称加密格式（3 个十六进制部分）', () => {
      const key = hybrid.generateSymmetricKey()
      const ciphertext = hybrid.symmetricEncrypt('test', key)
      expect(hybrid.isSymmetricEncrypted(ciphertext)).toBe(true)
    })

    it('应拒绝不是 3 部分的格式', () => {
      expect(hybrid.isSymmetricEncrypted('a:b')).toBe(false)
      expect(hybrid.isSymmetricEncrypted('a:b:c:d')).toBe(false)
    })

    it('应拒绝空字符串', () => {
      expect(hybrid.isSymmetricEncrypted('')).toBe(false)
    })

    it('应拒绝短字符串', () => {
      expect(hybrid.isSymmetricEncrypted('abc')).toBe(false)
    })

    it('应拒绝 3 部分但包含非十六进制字符的字符串', () => {
      expect(hybrid.isSymmetricEncrypted('xyz:123:456')).toBe(false)
    })

    it('应拒绝纯 RSA 加密格式', () => {
      const ciphertext = hybrid.hybridEncrypt('short')
      expect(hybrid.isSymmetricEncrypted(ciphertext)).toBe(false)
    })
  })

  // ============================================
  // hybridEncryptWithKey / hybridDecryptWithKey（端点子密钥）
  // ============================================
  describe('hybridEncryptWithKey / hybridDecryptWithKey（端点子密钥）', () => {
    let testPublicKey: string
    let testPrivateKey: string
    let wrongPublicKey: string
    let wrongPrivateKey: string

    beforeAll(() => {
      const keys = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      })
      testPublicKey = keys.publicKey
      testPrivateKey = keys.privateKey

      const wrongKeys = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      })
      wrongPublicKey = wrongKeys.publicKey
      wrongPrivateKey = wrongKeys.privateKey
    })

    // ============================================
    // hybridEncryptWithKey
    // ============================================
    describe('hybridEncryptWithKey', () => {
      it('短文本使用指定公钥加密（≤245字节）', () => {
        const ct = hybrid.hybridEncryptWithKey('Hello', testPublicKey)
        expect(ct).not.toBe('Hello')
        expect(ct).not.toContain(':')
        expect(/^[A-Za-z0-9+/]+=*$/.test(ct)).toBe(true)
      })

      it('长文本使用混合加密（>245字节）', () => {
        const longText = 'A'.repeat(300)
        const ct = hybrid.hybridEncryptWithKey(longText, testPublicKey)
        expect(ct).toContain(':')
        const parts = ct.split(':')
        expect(parts.length).toBe(4)
      })

      it('空公钥回退到默认 hybridEncrypt', () => {
        const ct = hybrid.hybridEncryptWithKey('fallback', '')
        expect(ct).not.toBe('fallback')
        const pt = hybrid.hybridDecrypt(ct)
        expect(pt).toBe('fallback')
      })

      it('空明文返回空字符串', () => {
        expect(hybrid.hybridEncryptWithKey('', testPublicKey)).toBe('')
      })

      it('中文字符加密', () => {
        const ct = hybrid.hybridEncryptWithKey('账号管理器测试', testPublicKey)
        expect(ct).not.toBe('账号管理器测试')
      })

      it('特殊字符加密', () => {
        const special = '!@#$%^&*()_+-=[]{}|;:,.<>?/~`"\'\\'
        const ct = hybrid.hybridEncryptWithKey(special, testPublicKey)
        expect(ct).not.toBe(special)
      })

      it('相同数据多次加密生成不同密文', () => {
        const plaintext = 'same data for testing'
        const c1 = hybrid.hybridEncryptWithKey(plaintext, testPublicKey)
        const c2 = hybrid.hybridEncryptWithKey(plaintext, testPublicKey)
        expect(c1).not.toBe(c2)
      })
    })

    // ============================================
    // hybridDecryptWithKey
    // ============================================
    describe('hybridDecryptWithKey', () => {
      it('短文本解密（往返）', () => {
        const ct = hybrid.hybridEncryptWithKey('Hello World!', testPublicKey)
        const pt = hybrid.hybridDecryptWithKey(ct, testPrivateKey)
        expect(pt).toBe('Hello World!')
      })

      it('长文本解密（往返）', () => {
        const longText = 'A'.repeat(300) + '中文结尾'
        const ct = hybrid.hybridEncryptWithKey(longText, testPublicKey)
        const pt = hybrid.hybridDecryptWithKey(ct, testPrivateKey)
        expect(pt).toBe(longText)
      })

      it('空私钥回退到默认 hybridDecrypt', () => {
        const ct = hybrid.hybridEncrypt('fallback test')
        const pt = hybrid.hybridDecryptWithKey(ct, '')
        expect(pt).toBe('fallback test')
      })

      it('空密文返回空字符串', () => {
        expect(hybrid.hybridDecryptWithKey('', testPrivateKey)).toBe('')
      })

      it('错误私钥解密抛出错误', () => {
        const ct = hybrid.hybridEncryptWithKey('secret', testPublicKey)
        expect(() => hybrid.hybridDecryptWithKey(ct, wrongPrivateKey)).toThrow()
      })
    })

    // ============================================
    // 往返测试
    // ============================================
    describe('roundtrip 往返测试', () => {
      it('短文本往返加解密', () => {
        const ct = hybrid.hybridEncryptWithKey('Hello World!', testPublicKey)
        const pt = hybrid.hybridDecryptWithKey(ct, testPrivateKey)
        expect(pt).toBe('Hello World!')
      })

      it('长文本往返加解密', () => {
        const longText = 'A'.repeat(300) + '中文结尾'
        const ct = hybrid.hybridEncryptWithKey(longText, testPublicKey)
        const pt = hybrid.hybridDecryptWithKey(ct, testPrivateKey)
        expect(pt).toBe(longText)
      })

      it('边界245字节往返', () => {
        const text = 'a'.repeat(245)
        const ct = hybrid.hybridEncryptWithKey(text, testPublicKey)
        expect(hybrid.hybridDecryptWithKey(ct, testPrivateKey)).toBe(text)
      })

      it('246字节（刚好超过边界）往返', () => {
        const text = 'a'.repeat(246)
        const ct = hybrid.hybridEncryptWithKey(text, testPublicKey)
        expect(hybrid.hybridDecryptWithKey(ct, testPrivateKey)).toBe(text)
      })

      it('JSON 数据往返', () => {
        const data = JSON.stringify({ user: 'admin', roles: ['read', 'write'] })
        const ct = hybrid.hybridEncryptWithKey(data, testPublicKey)
        const pt = hybrid.hybridDecryptWithKey(ct, testPrivateKey)
        expect(JSON.parse(pt)).toEqual(JSON.parse(data))
      })
    })
  })
})

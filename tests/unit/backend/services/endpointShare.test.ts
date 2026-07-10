/**
 * Endpoint Share 服务单元测试
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

const { mockSignJWT, MockSignJWT, mockJwtVerify, mockImportPKCS8, mockImportSPKI } = vi.hoisted(() => {
  const signJWT = { setProtectedHeader: vi.fn().mockReturnThis(), setIssuedAt: vi.fn().mockReturnThis(), setJti: vi.fn().mockReturnThis(), sign: vi.fn(() => Promise.resolve('mocked.jwt.token')) }
  return {
    mockSignJWT: signJWT,
    MockSignJWT: vi.fn(function(this: any) { return signJWT }),
    mockJwtVerify: vi.fn(() => Promise.resolve({ payload: {} })),
    mockImportPKCS8: vi.fn(() => Promise.resolve({})),
    mockImportSPKI: vi.fn(() => Promise.resolve({})),
  }
})

vi.mock('jose', () => ({
  SignJWT: MockSignJWT, jwtVerify: mockJwtVerify, importPKCS8: mockImportPKCS8, importSPKI: mockImportSPKI,
}))

const { mockLoadPrivateKey, mockLoadPublicKey } = vi.hoisted(() => ({
  mockLoadPrivateKey: vi.fn(() => Promise.resolve('mock-priv')),
  mockLoadPublicKey: vi.fn(() => 'mock-pub'),
}))

vi.mock('../../../../electron/backend/crypto/secureKeyStorage', () => ({
  loadPrivateKey: mockLoadPrivateKey, loadPublicKey: mockLoadPublicKey,
}))

const { mockHybridDecrypt, mockHybridEncrypt, mockSymmetricEncrypt, mockSymmetricDecrypt, mockGenerateSymmetricKey, mockIsHybridEncrypted } = vi.hoisted(() => ({
  mockHybridDecrypt: vi.fn((v: string) => 'dec_' + v),
  mockHybridEncrypt: vi.fn((v: string) => v),
  mockSymmetricEncrypt: vi.fn((v: string) => 'sym_' + v),
  mockSymmetricDecrypt: vi.fn((v: string) => 'symdec_' + v),
  mockGenerateSymmetricKey: vi.fn(() => 'ab'.repeat(32)),
  mockIsHybridEncrypted: vi.fn(() => false),
}))

vi.mock('../../../../electron/backend/crypto/hybrid', () => ({
  hybridDecrypt: mockHybridDecrypt, hybridEncrypt: mockHybridEncrypt,
  symmetricEncrypt: mockSymmetricEncrypt, symmetricDecrypt: mockSymmetricDecrypt,
  generateSymmetricKey: mockGenerateSymmetricKey, isHybridEncrypted: mockIsHybridEncrypted,
}))

const { mockDbRun, mockDbQueryOne } = vi.hoisted(() => ({
  mockDbRun: vi.fn(() => ({ changes: 1, lastInsertRowid: 1 })),
  mockDbQueryOne: vi.fn(),
}))

vi.mock('../../../../electron/backend/database/index', () => ({
  run: mockDbRun, queryOne: mockDbQueryOne,
}))

vi.mock('../../../../electron/backend/utils/network', () => ({
  getLocalIPs: vi.fn(() => ['192.168.1.100']), isIPInCIDR: vi.fn(() => true),
  normalizeToCIDR: vi.fn((ip: string) => ip.includes('/') ? ip : ip + '/32'), isValidCIDR: vi.fn(() => true),
}))

import {
  generateShareToken, validateShareToken, validateImportConditions, importEndpointFromToken,
  checkTokenPermission, incrementTokenUsage, isTokenEndpoint, decodeTokenPages,
  getTokenStatus, clearEndpointToken, extractSymmetricKeyFromToken, extractPublicKeyFromToken,
} from '../../../../electron/backend/services/endpointShare'

function makeEp(overrides: any = {}) {
  return {
    id: 1, name: 'Test EP', icon: 'icon', login_type: 'web' as const,
    pages: [{
      id: 1, endpoint_id: 1, order_index: 0, url: 'https://ex.com',
      ssh_port: undefined,
      slots: [{ id: 1, page_id: 1, order_index: 0, name: 'u', element_xpath: '//i', action_type: 'input' as const, value: 'val', is_encrypted: false, timeout: 200 }],
    }], ...overrides,
  }
}

function makeToken(payload: any) {
  const h = Buffer.from(JSON.stringify({})).toString('base64url')
  const p = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return h + '.' + p + '.sig'
}

const validPayload = {
  iat: Math.floor(Date.now() / 1000) - 100, jti: 'jti', version: '2.0',
  endpoint: { name: 'T', icon: 'i', login_type: 'web', pages: [] },
  restrictions: { type: 'unlimited' }, usageCount: 0, publicKey: 'pk',
}

describe('endpointShare 服务', () => {
  beforeEach(() => { vi.clearAllMocks(); mockDbQueryOne.mockReturnValue(null) })

  describe('generateShareToken', () => {
    it('成功生成分享 Token', async () => {
      const token = await generateShareToken(makeEp(), { type: 'unlimited' })
      expect(token).toBe('mocked.jwt.token')
    })
    it('已分享的 endpoint 不能再分享', async () => {
      mockDbQueryOne.mockReturnValue({ share_token: 'existing' })
      await expect(generateShareToken(makeEp(), { type: 'unlimited' })).rejects.toThrow('已被分享')
    })
    it('密钥不可用时报错', async () => {
      mockLoadPrivateKey.mockResolvedValueOnce(null)
      await expect(generateShareToken(makeEp(), { type: 'unlimited' })).rejects.toThrow('密钥不可用')
    })
    it('count 限制设置 maxUsage', async () => {
      await generateShareToken(makeEp(), { type: 'count', maxUsage: 5 })
      expect(mockSignJWT.sign).toHaveBeenCalled()
    })
    it('含 targetIp 限制', async () => {
      await generateShareToken(makeEp(), { type: 'unlimited', targetIp: '192.168.1.0/24' })
      expect(mockSignJWT.sign).toHaveBeenCalled()
    })
  })

  describe('validateShareToken', () => {
    it('有效 Token 验证通过', async () => {
      mockJwtVerify.mockResolvedValueOnce({ payload: validPayload })
      mockImportSPKI.mockResolvedValueOnce({})
      const r = await validateShareToken(makeToken(validPayload))
      expect(r.valid).toBe(true)
    })
    it('Token 格式无效', async () => {
      const r = await validateShareToken('not-a-jwt')
      expect(r.valid).toBe(false)
      expect(r.error).toContain('格式无效')
    })
    it('Token 结构无效', async () => {
      const r = await validateShareToken(makeToken({ version: '2.0' }))
      expect(r.valid).toBe(false)
    })
    it('duration: Token 已过期', async () => {
      const ep = { ...validPayload, iat: Math.floor(Date.now() / 1000) - 200000, restrictions: { type: 'duration', durationHours: 1 } }
      mockJwtVerify.mockResolvedValueOnce({ payload: ep })
      mockImportSPKI.mockResolvedValueOnce({})
      const r = await validateShareToken(makeToken(ep))
      expect(r.valid).toBe(false)
      expect(r.isExpired).toBe(true)
    })
    it('count: 次数已用尽', async () => {
      const ep = { ...validPayload, restrictions: { type: 'count', maxUsage: 3 }, usageCount: 3 }
      mockJwtVerify.mockResolvedValueOnce({ payload: ep })
      mockImportSPKI.mockResolvedValueOnce({})
      const r = await validateShareToken(makeToken(ep))
      expect(r.valid).toBe(false)
      expect(r.isExhausted).toBe(true)
    })
  })

  describe('importEndpointFromToken', () => {
    it('已导入 Token 报错', async () => {
      mockJwtVerify.mockResolvedValueOnce({ payload: validPayload })
      mockImportSPKI.mockResolvedValueOnce({})
      mockDbQueryOne.mockReturnValueOnce(null).mockReturnValueOnce({ id: 5 })
      await expect(importEndpointFromToken(makeToken(validPayload))).rejects.toThrow('已被导入')
    })
  })

  describe('checkTokenPermission', () => {
    it('非 Token endpoint 直接允许', async () => {
      const r = await checkTokenPermission({ id: 1, share_token: null } as any)
      expect(r.allowed).toBe(true)
    })
    it('无效 Token 返回不允许', async () => {
      const r = await checkTokenPermission({ id: 1, share_token: 'a.b.c' } as any)
      expect(r.allowed).toBe(false)
    })
  })

  describe('incrementTokenUsage', () => {
    it('非 Token endpoint 返回 null', async () => {
      expect(await incrementTokenUsage({ id: 1, share_token: null } as any)).toBeNull()
    })
    it('非 count 类型返回 null', async () => {
      mockJwtVerify.mockResolvedValueOnce({ payload: validPayload })
      mockImportSPKI.mockResolvedValueOnce({})
      expect(await incrementTokenUsage({ id: 1, share_token: makeToken(validPayload) } as any)).toBeNull()
    })
  })

  describe('isTokenEndpoint', () => {
    it('有 share_token 返回 true', () => expect(isTokenEndpoint({ share_token: 'abc' } as any)).toBe(true))
    it('无 share_token 返回 false', () => expect(isTokenEndpoint({ share_token: null } as any)).toBe(false))
  })

  describe('decodeTokenPages', () => {
    it('Token 格式无效返回 null', () => expect(decodeTokenPages('bad')).toBeNull())
    it('无 symmetricKey 返回 null', () => {
      expect(decodeTokenPages(makeToken({ version: '2.0', endpoint: { name: 'T', icon: 'i', login_type: 'web', pages: [] } }))).toBeNull()
    })
    it('有效 Token 解码 pages 和 slots', () => {
      const pl = { version: '2.0', symmetricKey: 'ab'.repeat(32), endpoint: { name: 'T', icon: 'i', login_type: 'web', pages: [{ order_index: 0, url: 'https://ex.com', slots: [{ order_index: 0, name: 'u', element_xpath: '//i', action_type: 'input', value: 'plain', is_encrypted: false, timeout: 200 }] }] } }
      const pages = decodeTokenPages(makeToken(pl))
      expect(pages).not.toBeNull()
      expect(pages![0].slots[0].value).toBe('plain')
    })
  })

  describe('getTokenStatus', () => {
    it('非 Token endpoint', async () => {
      const r = await getTokenStatus({ share_token: null } as any)
      expect(r.isToken).toBe(false)
    })
    it('无效 Token', async () => {
      const r = await getTokenStatus({ share_token: 'a.b.c' } as any)
      expect(r.isToken).toBe(true)
      expect(r.isValid).toBe(false)
    })
  })

  describe('clearEndpointToken', () => {
    it('成功清除', () => expect(clearEndpointToken(1)).toBe(true))
    it('DB 异常返回 false', () => {
      mockDbRun.mockImplementationOnce(() => { throw new Error('err') })
      expect(clearEndpointToken(1)).toBe(false)
    })
  })

  describe('extractSymmetricKeyFromToken', () => {
    it('v2.0 Token 提取密钥', () => expect(extractSymmetricKeyFromToken(makeToken({ version: '2.0', symmetricKey: 'key' }))).toBe('key'))
    it('非 v2.0 返回 null', () => expect(extractSymmetricKeyFromToken(makeToken({ version: '1.0' }))).toBeNull())
    it('无效格式返回 null', () => expect(extractSymmetricKeyFromToken('bad')).toBeNull())
  })

  describe('extractPublicKeyFromToken', () => {
    it('提取公钥', () => expect(extractPublicKeyFromToken(makeToken({ publicKey: 'pk' }))).toBe('pk'))
    it('无公钥返回 null', () => expect(extractPublicKeyFromToken(makeToken({}))).toBeNull())
  })
})

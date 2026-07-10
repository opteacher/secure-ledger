/**
 * 密钥层级管理模块测试
 * 测试 keyHierarchy.ts 的所有导出函数
 */
import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest'
import crypto from 'crypto'
import path from 'path'
import os from 'os'

// ─── vi.hoisted 模拟对象 ────────────────────────────────

const mockDb = vi.hoisted(() => ({
  run: vi.fn(() => ({ changes: 1, lastInsertRowid: 1 })),
  query: vi.fn(() => []),
  queryOne: vi.fn(() => null),
}))

const mockExistsSync = vi.hoisted(() => vi.fn((_p: string) => false))
const mockReadFileSync = vi.hoisted(() => vi.fn((_p: string, _enc?: string) => ''))
const mockMkdirSync = vi.hoisted(() => vi.fn())

// ─── Mock 模块 ───────────────────────────────────────────

vi.mock('../../../../electron/backend/database/init', () => ({
  db: mockDb,
}))

vi.mock('fs', () => ({
  existsSync: mockExistsSync,
  readFileSync: mockReadFileSync,
  mkdirSync: mockMkdirSync,
}))

// electron 已在 setup.ts 中全局 mock，此处导入 helper 调整行为
import { mockSafeStorage, mockApp } from '../../../helpers/electron-mock'

// ─── 辅助函数 ────────────────────────────────────────────

function generateTestKeyPair() {
  return crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
  })
}

// ─── 测试套件 ────────────────────────────────────────────

describe('密钥层级管理模块 (keyHierarchy.ts)', () => {
  let rootKeyPair: { publicKey: string; privateKey: string }

  // 测试数据路径，匹配 mockApp.getPath 默认值 + keys/root_public.pem
  let testKeysDir: string
  let testRootPubPath: string

  beforeAll(() => {
    rootKeyPair = generateTestKeyPair()
  })

  beforeEach(async () => {
    // 每次测试重置模块缓存 → 获得全新的模块级状态变量
    vi.resetModules()
    vi.clearAllMocks()

    // 恢复 mock 默认行为
    mockDb.run.mockReturnValue({ changes: 1, lastInsertRowid: 1 })
    mockDb.query.mockReturnValue([])
    mockDb.queryOne.mockReturnValue(null)
    mockExistsSync.mockReturnValue(false)
    mockReadFileSync.mockReturnValue('')
    mockSafeStorage.encryptString.mockImplementation((s: string) => Buffer.from(s, 'utf-8'))
    mockSafeStorage.decryptString.mockImplementation((b: Buffer) => b.toString('utf-8'))
    mockApp.getPath.mockReturnValue(path.join(os.tmpdir(), 'sl-test-keys'))

    // 计算测试用路径
    testKeysDir = path.join(os.tmpdir(), 'sl-test-keys', 'keys')
    testRootPubPath = path.join(testKeysDir, 'root_public.pem')

    // 动态重新导入，获得干净模块状态
    const mod = await import('../../../../electron/backend/crypto/keyHierarchy')
    // 将导入挂到模块作用域供测试使用（通过闭包）
    ;(
      globalThis as Record<string, unknown>
    ).__keyHierarchyTestMod = mod
  })

  /** 获取当前测试的干净模块引用 */
  function mod(): typeof import('../../../../electron/backend/crypto/keyHierarchy') {
    return (globalThis as Record<string, unknown>).__keyHierarchyTestMod as typeof import('../../../../electron/backend/crypto/keyHierarchy')
  }

  // ============================================
  // 常量
  // ============================================
  describe('常量', () => {
    it('ENCRYPTION_VERSION 应为 v1.0', () => {
      expect(mod().ENCRYPTION_VERSION).toBe('v1.0')
    })

    it('ROOT_PUBLIC_KEY_FILE 应为 root_public.pem', () => {
      expect(mod().ROOT_PUBLIC_KEY_FILE).toBe('root_public.pem')
    })
  })

  // ============================================
  // 根公钥初始化
  // ============================================
  describe('initRootPublicKey', () => {
    it('文件存在时应返回 loaded: true 和路径', () => {
      mockExistsSync.mockReturnValue(true)
      mockReadFileSync.mockReturnValue(rootKeyPair.publicKey)

      const result = mod().initRootPublicKey()
      expect(result.loaded).toBe(true)
      expect(result.path).toBe(testRootPubPath)
    })

    it('文件不存在时应返回 loaded: false 和路径', () => {
      mockExistsSync.mockReturnValue(false)

      const result = mod().initRootPublicKey()
      expect(result.loaded).toBe(false)
      expect(result.path).toBe(testRootPubPath)
    })

    it('文件存在但格式无效（无 BEGIN PUBLIC KEY）时应返回 loaded: false', () => {
      mockExistsSync.mockReturnValue(true)
      mockReadFileSync.mockReturnValue('this is not a valid pem key')

      const result = mod().initRootPublicKey()
      expect(result.loaded).toBe(false)
      expect(result.path).toBe(testRootPubPath)
    })

    it('读取文件发生异常时应返回 loaded: false', () => {
      mockExistsSync.mockReturnValue(true)
      mockReadFileSync.mockImplementation(() => {
        throw new Error('Permission denied')
      })

      const result = mod().initRootPublicKey()
      expect(result.loaded).toBe(false)
      expect(result.path).toBe(testRootPubPath)
    })
  })

  // ============================================
  // 获取根公钥
  // ============================================
  describe('getRootPublicKey', () => {
    it('通过 initRootPublicKey 缓存后应返回缓存的公钥', () => {
      mockExistsSync.mockReturnValue(true)
      mockReadFileSync.mockReturnValue(rootKeyPair.publicKey)
      mod().initRootPublicKey()

      const result = mod().getRootPublicKey()
      expect(result).toBe(rootKeyPair.publicKey)
    })

    it('未初始化且文件存在时应自动加载并返回公钥', () => {
      mockExistsSync.mockReturnValue(true)
      mockReadFileSync.mockReturnValue(rootKeyPair.publicKey)

      const result = mod().getRootPublicKey()
      expect(result).toBe(rootKeyPair.publicKey)
    })

    it('未初始化且文件不存在时应返回 null', () => {
      mockExistsSync.mockReturnValue(false)

      const result = mod().getRootPublicKey()
      expect(result).toBeNull()
    })

    it('文件存在但格式无效时应返回 null', () => {
      mockExistsSync.mockReturnValue(true)
      mockReadFileSync.mockReturnValue('garbage data')

      const result = mod().getRootPublicKey()
      expect(result).toBeNull()
    })

    it('读取异常时应返回 null', () => {
      mockExistsSync.mockReturnValue(true)
      mockReadFileSync.mockImplementation(() => {
        throw new Error('Disk error')
      })

      const result = mod().getRootPublicKey()
      expect(result).toBeNull()
    })
  })

  // ============================================
  // 端点子密钥生成
  // ============================================
  describe('generateEndpointSubKeyPair', () => {
    it('应返回包含 publicKey 和 privateKey 的对象', () => {
      const pair = mod().generateEndpointSubKeyPair()
      expect(pair).toHaveProperty('publicKey')
      expect(pair).toHaveProperty('privateKey')
      expect(typeof pair.publicKey).toBe('string')
      expect(typeof pair.privateKey).toBe('string')
    })

    it('公钥应包含 BEGIN PUBLIC KEY 头', () => {
      const pair = mod().generateEndpointSubKeyPair()
      expect(pair.publicKey).toContain('-----BEGIN PUBLIC KEY-----')
      expect(pair.publicKey).toContain('-----END PUBLIC KEY-----')
    })

    it('私钥应包含 BEGIN PRIVATE KEY 头', () => {
      const pair = mod().generateEndpointSubKeyPair()
      expect(pair.privateKey).toContain('-----BEGIN PRIVATE KEY-----')
      expect(pair.privateKey).toContain('-----END PRIVATE KEY-----')
    })

    it('每次调用应生成不同的密钥对', () => {
      const pair1 = mod().generateEndpointSubKeyPair()
      const pair2 = mod().generateEndpointSubKeyPair()
      expect(pair1.publicKey).not.toBe(pair2.publicKey)
      expect(pair1.privateKey).not.toBe(pair2.privateKey)
    })

    it('生成的密钥对应该长度合理（RSA-2048）', () => {
      const pair = mod().generateEndpointSubKeyPair()
      expect(pair.publicKey.length).toBeGreaterThan(200)
      expect(pair.privateKey.length).toBeGreaterThan(1000)
    })
  })

  // ============================================
  // 备份加密
  // ============================================
  describe('createBackupEncryptedKey', () => {
    let subKeyPair: { publicKey: string; privateKey: string }

    beforeAll(() => {
      subKeyPair = generateTestKeyPair()
    })

    it('根公钥可用时应返回 base64 加密的备份字符串', () => {
      mockExistsSync.mockReturnValue(true)
      mockReadFileSync.mockReturnValue(rootKeyPair.publicKey)

      const backup = mod().createBackupEncryptedKey(subKeyPair.privateKey)
      expect(backup).not.toBeNull()
      expect(typeof backup).toBe('string')
      // 检查 v1: 格式前缀
      expect(backup).toMatch(/^v1:/)
    })

    it('根公钥不可用时应返回 null', () => {
      mockExistsSync.mockReturnValue(false)

      const backup = mod().createBackupEncryptedKey(subKeyPair.privateKey)
      expect(backup).toBeNull()
    })

    it('空字符串子私钥应返回 null', () => {
      mockExistsSync.mockReturnValue(true)
      mockReadFileSync.mockReturnValue(rootKeyPair.publicKey)

      const backup = mod().createBackupEncryptedKey('')
      expect(backup).toBeNull()
    })

    it('每次调用应生成不同的备份（不同 AES 密钥）', () => {
      mockExistsSync.mockReturnValue(true)
      mockReadFileSync.mockReturnValue(rootKeyPair.publicKey)

      const backup1 = mod().createBackupEncryptedKey(subKeyPair.privateKey)
      const backup2 = mod().createBackupEncryptedKey(subKeyPair.privateKey)
      expect(backup1).not.toBeNull()
      expect(backup2).not.toBeNull()
      // 备份密文应不同（不同随机 AES 密钥）
      expect(backup1).not.toBe(backup2)
    })
  })

  // ============================================
  // 备份恢复
  // ============================================
  describe('recoverSubPrivateKey', () => {
    let subKeyPair: { publicKey: string; privateKey: string }

    beforeAll(() => {
      subKeyPair = generateTestKeyPair()
    })

    it('正确密钥应能解密备份，恢复原始子私钥（往返测试）', () => {
      mockExistsSync.mockReturnValue(true)
      mockReadFileSync.mockReturnValue(rootKeyPair.publicKey)

      // 1. 创建备份
      const backup = mod().createBackupEncryptedKey(subKeyPair.privateKey)
      expect(backup).not.toBeNull()

      // 2. 使用根私钥恢复
      const recovered = mod().recoverSubPrivateKey(backup!, rootKeyPair.privateKey)
      expect(recovered).toBe(subKeyPair.privateKey)
    })

    it('错误的根私钥应返回 null', () => {
      mockExistsSync.mockReturnValue(true)
      mockReadFileSync.mockReturnValue(rootKeyPair.publicKey)

      const backup = mod().createBackupEncryptedKey(subKeyPair.privateKey)
      expect(backup).not.toBeNull()

      const wrongKeyPair = generateTestKeyPair()
      const recovered = mod().recoverSubPrivateKey(backup!, wrongKeyPair.privateKey)
      expect(recovered).toBeNull()
    })

    it('无效备份数据应返回 null', () => {
      const recovered = mod().recoverSubPrivateKey('garbage-data', rootKeyPair.privateKey)
      expect(recovered).toBeNull()
    })

    it('空备份字符串应返回 null', () => {
      const recovered = mod().recoverSubPrivateKey('', rootKeyPair.privateKey)
      expect(recovered).toBeNull()
    })

    it('空根私钥应返回 null', () => {
      const recovered = mod().recoverSubPrivateKey('v1:dummy', '')
      expect(recovered).toBeNull()
    })

    it('备份格式前缀不正确时应返回 null', () => {
      // 构造一个不带 v1: 前缀的假备份
      const fakeBackup = 'x1:abc:def:ghi:jkl'
      const recovered = mod().recoverSubPrivateKey(fakeBackup, rootKeyPair.privateKey)
      expect(recovered).toBeNull()
    })

    it('备份字段数量不正确时应返回 null', () => {
      // v1: 后面需要 4 个冒号分隔的字段
      const malformedBackup = 'v1:onlyThreeParts'
      const recovered = mod().recoverSubPrivateKey(malformedBackup, rootKeyPair.privateKey)
      expect(recovered).toBeNull()
    })
  })

  // ============================================
  // 保存端点密钥
  // ============================================
  describe('saveEndpointKeys', () => {
    let subKeyPair: { publicKey: string; privateKey: string }

    beforeAll(() => {
      subKeyPair = generateTestKeyPair()
    })

    it('成功保存应返回 EndpointKeyRecord', () => {
      mockDb.run.mockReturnValue({ changes: 1, lastInsertRowid: 42 })

      const record = mod().saveEndpointKeys(1, subKeyPair.publicKey, subKeyPair.privateKey)

      expect(record).not.toBeNull()
      expect(record!.endpoint_id).toBe(1)
      expect(record!.sub_public_key).toBe(subKeyPair.publicKey)
      expect(record!.encrypted_sub_private_key).toBeTruthy()
      expect(record!.key_id).toBeTruthy()
      // key_id 应为 UUID v4 格式
      expect(record!.key_id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      )
      expect(record!.id).toBe(42)
      expect(record!.created_at).toBeTruthy()
    })

    it('应使用 safeStorage.encryptString 加密子私钥', () => {
      mod().saveEndpointKeys(1, subKeyPair.publicKey, subKeyPair.privateKey)

      expect(mockSafeStorage.encryptString).toHaveBeenCalledWith(subKeyPair.privateKey)
    })

    it('应调用 db.run INSERT 语句', () => {
      mod().saveEndpointKeys(1, subKeyPair.publicKey, subKeyPair.privateKey)

      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('INTO endpoint_key'),
        expect.any(Array)
      )
    })

    it('INSERT 值应正确包含 endpoint_id', () => {
      mod().saveEndpointKeys(99, subKeyPair.publicKey, subKeyPair.privateKey)

      const callArgs = mockDb.run.mock.calls[0] as unknown[]
      const values = callArgs[1] as unknown[]
      expect(values[0]).toBe(99) // endpoint_id
    })

    it('即使根公钥不可用也不应崩溃（backup_encrypted_key 为空字符串）', () => {
      mockExistsSync.mockReturnValue(false)

      const record = mod().saveEndpointKeys(1, subKeyPair.publicKey, subKeyPair.privateKey)
      expect(record).not.toBeNull()
      expect(record!.backup_encrypted_key).toBe('')
    })

    it('多个端点使用不同 key_id', () => {
      const r1 = mod().saveEndpointKeys(1, subKeyPair.publicKey, subKeyPair.privateKey)
      const r2 = mod().saveEndpointKeys(2, subKeyPair.publicKey, subKeyPair.privateKey)
      expect(r1!.key_id).not.toBe(r2!.key_id)
    })

    it('DB 插入失败应返回 null', () => {
      mockDb.run.mockImplementation(() => {
        throw new Error('DB write error')
      })

      const record = mod().saveEndpointKeys(1, subKeyPair.publicKey, subKeyPair.privateKey)
      expect(record).toBeNull()
    })
  })

  // ============================================
  // 加载端点密钥记录
  // ============================================
  describe('loadEndpointKeys', () => {
    const fakeRecord = {
      id: 10,
      endpoint_id: 3,
      sub_public_key: 'FAKE_PUBLIC_KEY',
      encrypted_sub_private_key: 'FAKE_ENCRYPTED',
      backup_encrypted_key: 'FAKE_BACKUP',
      key_id: '550e8400-e29b-41d4-a716-446655440000',
      created_at: '2024-01-01T00:00:00.000Z'
    }

    it('记录存在时应返回完整 EndpointKeyRecord', () => {
      mockDb.queryOne.mockReturnValue(fakeRecord)

      const record = mod().loadEndpointKeys(3)
      expect(record).not.toBeNull()
      expect(record!.id).toBe(10)
      expect(record!.endpoint_id).toBe(3)
      expect(record!.sub_public_key).toBe('FAKE_PUBLIC_KEY')
      expect(record!.encrypted_sub_private_key).toBe('FAKE_ENCRYPTED')
      expect(record!.backup_encrypted_key).toBe('FAKE_BACKUP')
      expect(record!.key_id).toBe('550e8400-e29b-41d4-a716-446655440000')
      expect(record!.created_at).toBe('2024-01-01T00:00:00.000Z')
    })

    it('记录不存在时应返回 null', () => {
      mockDb.queryOne.mockReturnValue(null)

      const record = mod().loadEndpointKeys(999)
      expect(record).toBeNull()
    })

    it('db.queryOne 返回 undefined 时应返回 null', () => {
      mockDb.queryOne.mockReturnValue(undefined)

      const record = mod().loadEndpointKeys(1)
      expect(record).toBeNull()
    })

    it('DB 查询异常时应返回 null', () => {
      mockDb.queryOne.mockImplementation(() => {
        throw new Error('SQL error')
      })

      const record = mod().loadEndpointKeys(1)
      expect(record).toBeNull()
    })
  })

  // ============================================
  // 加载并解密子私钥
  // ============================================
  describe('loadSubPrivateKey', () => {
    let subKeyPair: { publicKey: string; privateKey: string }

    beforeAll(() => {
      subKeyPair = generateTestKeyPair()
    })

    it('记录存在且解密正常时应返回子私钥明文', () => {
      // 先保存以写入加密后的私钥
      const saved = mod().saveEndpointKeys(1, subKeyPair.publicKey, subKeyPair.privateKey)
      expect(saved).not.toBeNull()

      // mock queryOne 返回刚保存的记录
      mockDb.queryOne.mockReturnValue({
        id: saved!.id,
        endpoint_id: saved!.endpoint_id,
        sub_public_key: saved!.sub_public_key,
        encrypted_sub_private_key: saved!.encrypted_sub_private_key,
        backup_encrypted_key: saved!.backup_encrypted_key,
        key_id: saved!.key_id,
        created_at: saved!.created_at
      })

      const privateKey = mod().loadSubPrivateKey(1)
      expect(privateKey).toBe(subKeyPair.privateKey)
      expect(mockSafeStorage.decryptString).toHaveBeenCalled()
    })

    it('记录不存在时应返回 null', () => {
      mockDb.queryOne.mockReturnValue(null)

      const result = mod().loadSubPrivateKey(999)
      expect(result).toBeNull()
    })

    it('解密异常时应返回 null', () => {
      mockSafeStorage.decryptString.mockImplementation(() => {
        throw new Error('Decryption failed')
      })
      mockDb.queryOne.mockReturnValue({
        id: 1,
        endpoint_id: 1,
        sub_public_key: 'PUB',
        encrypted_sub_private_key: Buffer.from('bad').toString('base64'),
        backup_encrypted_key: '',
        key_id: 'k1',
        created_at: 'now'
      })

      const result = mod().loadSubPrivateKey(1)
      expect(result).toBeNull()
    })
  })

  // ============================================
  // 删除端点密钥
  // ============================================
  describe('deleteEndpointKeys', () => {
    it('删除成功（changes > 0）应返回 true', () => {
      mockDb.run.mockReturnValue({ changes: 1, lastInsertRowid: 0 })

      const result = mod().deleteEndpointKeys(5)
      expect(result).toBe(true)
      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM endpoint_key'),
        [5]
      )
    })

    it('无记录可删除（changes = 0）应返回 false', () => {
      mockDb.run.mockReturnValue({ changes: 0, lastInsertRowid: 0 })

      const result = mod().deleteEndpointKeys(999)
      expect(result).toBe(false)
    })

    it('DB 异常时应返回 false', () => {
      mockDb.run.mockImplementation(() => {
        throw new Error('DB locked')
      })

      const result = mod().deleteEndpointKeys(1)
      expect(result).toBe(false)
    })
  })

  // ============================================
  // 加密版本管理
  // ============================================
  describe('getEncryptionVersion', () => {
    it('system_config 中存在 encryption_version 时应返回版本字符串', () => {
      mockDb.queryOne.mockReturnValue({
        key: 'encryption_version',
        value: 'v1.0',
        updated_at: '2024-01-01'
      })

      const version = mod().getEncryptionVersion()
      expect(version).toBe('v1.0')
    })

    it('system_config 中无 encryption_version 时应返回 null（旧版本）', () => {
      mockDb.queryOne.mockReturnValue(null)

      const version = mod().getEncryptionVersion()
      expect(version).toBeNull()
    })

    it('DB 查询异常时应返回 null', () => {
      mockDb.queryOne.mockImplementation(() => {
        throw new Error('Table not found')
      })

      const version = mod().getEncryptionVersion()
      expect(version).toBeNull()
    })
  })

  describe('setEncryptionVersion', () => {
    it('应调用 db.run 执行 INSERT OR REPLACE', () => {
      mod().setEncryptionVersion()

      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('INSERT OR REPLACE INTO'),
        expect.any(Array)
      )
    })

    it('版本默认值应为 v1.0', () => {
      mod().setEncryptionVersion()

      const callArgs = mockDb.run.mock.calls[0] as unknown[]
      const values = callArgs[1] as unknown[]
      // 第二个参数是 ENCRYPTION_VERSION = 'v1.0'
      expect(values[0]).toBe('v1.0')
    })

    it('DB 异常不应抛出', () => {
      mockDb.run.mockImplementation(() => {
        throw new Error('DB write failed')
      })

      expect(() => mod().setEncryptionVersion()).not.toThrow()
    })
  })

  // ============================================
  // 边界条件与集成测试
  // ============================================
  describe('边界条件与集成测试', () => {
    it('往返测试：生成密钥对 → 备份 → 恢复', () => {
      // 1. 设置根公钥可用
      mockExistsSync.mockReturnValue(true)
      mockReadFileSync.mockReturnValue(rootKeyPair.publicKey)

      // 2. 生成端点子密钥对
      const subKeyPair = mod().generateEndpointSubKeyPair()

      // 3. 创建备份
      const backup = mod().createBackupEncryptedKey(subKeyPair.privateKey)
      expect(backup).not.toBeNull()

      // 4. 使用根私钥恢复
      const recovered = mod().recoverSubPrivateKey(backup!, rootKeyPair.privateKey)

      // 5. 验证恢复的私钥与原始一致
      expect(recovered).toBe(subKeyPair.privateKey)
    })

    it('往返测试：saveEndpointKeys → loadSubPrivateKey', () => {
      const subKeyPair = mod().generateEndpointSubKeyPair()

      // 保存
      const saved = mod().saveEndpointKeys(1, subKeyPair.publicKey, subKeyPair.privateKey)
      expect(saved).not.toBeNull()

      // 让 loadEndpointKeys 返回刚保存的数据
      mockDb.queryOne.mockReturnValue({
        id: saved!.id,
        endpoint_id: saved!.endpoint_id,
        sub_public_key: saved!.sub_public_key,
        encrypted_sub_private_key: saved!.encrypted_sub_private_key,
        backup_encrypted_key: saved!.backup_encrypted_key,
        key_id: saved!.key_id,
        created_at: saved!.created_at
      })

      // 加载解密
      const loaded = mod().loadSubPrivateKey(1)
      expect(loaded).toBe(subKeyPair.privateKey)
    })

    it('多端点各自独立：不同端点应有不同密钥', () => {
      const pair1 = mod().generateEndpointSubKeyPair()
      const pair2 = mod().generateEndpointSubKeyPair()

      const r1 = mod().saveEndpointKeys(1, pair1.publicKey, pair1.privateKey)
      const r2 = mod().saveEndpointKeys(2, pair2.publicKey, pair2.privateKey)

      expect(r1).not.toBeNull()
      expect(r2).not.toBeNull()
      expect(r1!.sub_public_key).not.toBe(r2!.sub_public_key)
      expect(r1!.encrypted_sub_private_key).not.toBe(r2!.encrypted_sub_private_key)
      expect(r1!.key_id).not.toBe(r2!.key_id)
      expect(r1!.endpoint_id).toBe(1)
      expect(r2!.endpoint_id).toBe(2)
    })

    it('删除后加载应返回 null', () => {
      const subKeyPair = mod().generateEndpointSubKeyPair()
      mod().saveEndpointKeys(1, subKeyPair.publicKey, subKeyPair.privateKey)

      // 模拟删除
      mockDb.run.mockReturnValue({ changes: 1, lastInsertRowid: 0 })
      const deleted = mod().deleteEndpointKeys(1)
      expect(deleted).toBe(true)

      // 加载应返回 null
      mockDb.queryOne.mockReturnValue(null)
      const loaded = mod().loadEndpointKeys(1)
      expect(loaded).toBeNull()
    })
  })
})

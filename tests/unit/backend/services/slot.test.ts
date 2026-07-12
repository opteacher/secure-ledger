/**
 * 操作槽服务单元测试
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

const mockDb = vi.hoisted(() => ({
  query: vi.fn(),
  queryOne: vi.fn(),
  run: vi.fn(() => ({ changes: 1, lastInsertRowid: 1 })),
  exec: vi.fn(),
  transaction: vi.fn((fn: () => unknown) => fn()),
}))

const mockHybridEncrypt = vi.hoisted(() => vi.fn((v: string) => `ENC:${v}`))
const mockHybridDecrypt = vi.hoisted(() => vi.fn((v: string) => v.replace('ENC:', '')))
const mockIsHybridEncrypted = vi.hoisted(
  () => vi.fn((v: string) => v.startsWith('ENC:') || (v.length > 100 && /^[A-Za-z0-9+/]+=*$/.test(v)))
)

vi.mock('../../../../electron/backend/database/init', () => ({ db: mockDb }))
vi.mock('../../../../electron/backend/crypto/hybrid', () => ({
  hybridEncrypt: mockHybridEncrypt,
  hybridDecrypt: mockHybridDecrypt,
  isHybridEncrypted: mockIsHybridEncrypted,
}))

import {
  listSlots, getSlot, createSlot, updateSlot, deleteSlot,
  reorderSlots, decryptValue, decryptSlotValue, decryptSlotValueAuto,
} from '../../../../electron/backend/services/slot'

function makeRawSlot(o: Record<string, unknown> = {}) {
  return {
    id: 1, page_id: 10, order_index: 0, name: '用户名', element_xpath: '//input',
    action_type: 'input' as const, value: 'testuser', is_encrypted: 0, timeout: 200,
    created_at: '2024-01-01T00:00:00.000Z', updated_at: '2024-01-01T00:00:00.000Z', ...o,
  }
}

describe('slot 服务', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDb.run.mockReturnValue({ changes: 1, lastInsertRowid: 1 })
  })

  describe('listSlots', () => {
    it('返回操作槽列表, is_encrypted 转为 boolean', () => {
      mockDb.query.mockReturnValue([makeRawSlot({ is_encrypted: 1 })])
      const r = listSlots(10)
      expect(r).toHaveLength(1)
      expect(r[0].is_encrypted).toBe(true)
    })
    it('无操作槽返回空数组', () => {
      mockDb.query.mockReturnValue([])
      expect(listSlots(999)).toEqual([])
    })
  })

  describe('getSlot', () => {
    it('返回指定操作槽', () => {
      mockDb.queryOne.mockReturnValue(makeRawSlot())
      expect(getSlot(1)!.id).toBe(1)
    })
    it('不存在返回 null', () => {
      mockDb.queryOne.mockReturnValue(undefined)
      expect(getSlot(999)).toBeNull()
    })
  })

  describe('createSlot', () => {
    it('创建未加密操作槽', () => {
      const r = createSlot({ page_id: 10, element_xpath: '//', action_type: 'input', value: 'plain', is_encrypted: false })
      expect(r.value).toBe('plain')
      expect(r.is_encrypted).toBe(false)
    })
    it('创建加密操作槽调用 hybridEncrypt', () => {
      const r = createSlot({ page_id: 10, element_xpath: '//', action_type: 'password', value: 'secret', is_encrypted: true })
      expect(mockHybridEncrypt).toHaveBeenCalledWith('secret')
      expect(r.value).toBe('ENC:secret')
    })
    it('加密但值为空时不调用 encrypt', () => {
      createSlot({ page_id: 10, element_xpath: '//', action_type: 'input', value: '', is_encrypted: true })
      expect(mockHybridEncrypt).not.toHaveBeenCalled()
    })
    it('未指定顺序时自动放到最后', () => {
      mockDb.queryOne.mockReturnValue({ max: 2 })
      expect(createSlot({ page_id: 10, element_xpath: '//', action_type: 'input', value: 'v' }).order_index).toBe(3)
    })
    it('自定义 timeout', () => {
      expect(createSlot({ page_id: 10, element_xpath: '//', action_type: 'input', value: 'v', timeout: 5000 }).timeout).toBe(5000)
    })
    it('创建带 output_key 的操作槽', () => {
      const r = createSlot({ page_id: 10, element_xpath: '//', action_type: 'captcha', value: '', output_key: 'captcha1' })
      expect(r.output_key).toBe('captcha1')
    })
    it('创建 captcha 类型操作槽', () => {
      const r = createSlot({ page_id: 10, element_xpath: '//', action_type: 'captcha', value: '' })
      expect(r.action_type).toBe('captcha')
    })
    it('未指定 output_key 时默认为空字符串', () => {
      const r = createSlot({ page_id: 10, element_xpath: '//', action_type: 'input', value: 'v' })
      expect(r.output_key).toBe('')
    })
  })

  describe('updateSlot', () => {
    it('更新 value 且 is_encrypted 为 true 时加密', () => {
      updateSlot(1, { value: 's', is_encrypted: true })
      expect(mockHybridEncrypt).toHaveBeenCalledWith('s')
    })
    it('更新 value 但 is_encrypted 为 false 时不加密', () => {
      updateSlot(1, { value: 'p', is_encrypted: false })
      expect(mockHybridEncrypt).not.toHaveBeenCalled()
    })
    it('无变更返回 false', () => {
      expect(updateSlot(1, {})).toBe(false)
    })
    it('更新 output_key 包含在 SQL 中', () => {
      expect(updateSlot(1, { output_key: 'captcha_result' })).toBe(true)
      expect(mockDb.run).toHaveBeenCalled()
      const sqlCall = mockDb.run.mock.calls[mockDb.run.mock.calls.length - 1]
      expect(sqlCall[0]).toContain('output_key')
      expect(sqlCall[1]).toContain('captcha_result')
    })
  })

  describe('deleteSlot', () => {
    it('成功删除返回 true', () => {
      mockDb.run.mockReturnValue({ changes: 1 })
      expect(deleteSlot(1)).toBe(true)
    })
    it('不存在返回 false', () => {
      mockDb.run.mockReturnValue({ changes: 0 })
      expect(deleteSlot(999)).toBe(false)
    })
  })

  describe('reorderSlots', () => {
    it('在事务中调整顺序', () => {
      expect(reorderSlots(10, [3, 1, 2])).toBe(true)
      expect(mockDb.transaction).toHaveBeenCalled()
    })
    it('空数组无操作', () => {
      expect(reorderSlots(10, [])).toBe(true)
      expect(mockDb.transaction).toHaveBeenCalled()
    })
  })

  describe('decryptValue', () => {
    it('空值直接返回', () => {
      expect(decryptValue('')).toBe('')
    })
    it('混合加密值正确解密', () => {
      mockIsHybridEncrypted.mockReturnValue(true)
      expect(decryptValue('ENC:data')).toBe('data')
      expect(mockHybridDecrypt).toHaveBeenCalled()
    })
    it('非加密值直接返回原值', () => {
      mockIsHybridEncrypted.mockReturnValue(false)
      expect(decryptValue('plain')).toBe('plain')
      expect(mockHybridDecrypt).not.toHaveBeenCalled()
    })
    it('解密失败返回原值', () => {
      mockIsHybridEncrypted.mockReturnValue(true)
      mockHybridDecrypt.mockImplementationOnce(() => { throw new Error('fail') })
      expect(decryptValue('ENC:bad')).toBe('ENC:bad')
    })
    it('清理换行符和空格', () => {
      mockIsHybridEncrypted.mockReturnValue(true)
      decryptValue('ENC:a\nb\r\nc ')
      expect(mockHybridDecrypt).toHaveBeenCalledWith('ENC:abc')
    })
  })

  describe('decryptSlotValue', () => {
    it('委托给 decryptValue', () => {
      mockIsHybridEncrypted.mockReturnValue(true)
      expect(decryptSlotValue('ENC:v')).toBe('v')
    })
  })

  describe('decryptSlotValueAuto', () => {
    it('委托给 decryptValue', () => {
      mockIsHybridEncrypted.mockReturnValue(false)
      expect(decryptSlotValueAuto('plain')).toBe('plain')
    })
  })
})

/**
 * 登录端服务单元测试
 * 测试 endpoint.ts 的所有导出函数
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

const mockDb = vi.hoisted(() => ({
  query: vi.fn(),
  queryOne: vi.fn(),
  run: vi.fn(() => ({ changes: 1, lastInsertRowid: 1 })),
  exec: vi.fn(),
  transaction: vi.fn((fn: () => unknown) => fn()),
}))

const mockListSlots = vi.hoisted(() => vi.fn())
const mockDecodeTokenPages = vi.hoisted(() => vi.fn())

vi.mock('../../../../electron/backend/database/init', () => ({ db: mockDb }))
vi.mock('../../../../electron/backend/services/slot', () => ({ listSlots: mockListSlots }))
vi.mock('../../../../electron/backend/services/endpointShare', () => ({
  decodeTokenPages: mockDecodeTokenPages,
}))

import {
  listEndpoints,
  getEndpoint,
  createEndpoint,
  updateEndpoint,
  deleteEndpoint,
  exportEndpoints,
  importEndpoints,
} from '../../../../electron/backend/services/endpoint'

function makeEndpoint(o: Record<string, unknown> = {}) {
  return {
    id: 1, name: '测试', icon: '', login_type: 'web' as const, share_token: '',
    created_at: '2024-01-01T00:00:00.000Z', updated_at: '2024-01-01T00:00:00.000Z', ...o,
  }
}
function makePage(o: Record<string, unknown> = {}) {
  return {
    id: 1, endpoint_id: 1, order_index: 0, url: 'https://example.com/login',
    ssh_port: null, created_at: '2024-01-01T00:00:00.000Z', updated_at: '2024-01-01T00:00:00.000Z', ...o,
  }
}
function makeSlot(o: Record<string, unknown> = {}) {
  return {
    id: 1, page_id: 1, order_index: 0, name: '用户名', element_xpath: '//input[@name="user"]',
    action_type: 'input' as const, value: 'plain', is_encrypted: false, timeout: 200,
    created_at: '2024-01-01T00:00:00.000Z', updated_at: '2024-01-01T00:00:00.000Z', ...o,
  }
}

describe('endpoint 服务', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDb.run.mockReturnValue({ changes: 1, lastInsertRowid: 1 })
  })

  describe('listEndpoints', () => {
    it('返回所有登录端（按创建时间倒序）', () => {
      const eps = [makeEndpoint({ id: 2 }), makeEndpoint({ id: 1 })]
      mockDb.query.mockReturnValue(eps)
      expect(listEndpoints()).toEqual(eps)
      expect(mockDb.query).toHaveBeenCalledWith('SELECT * FROM endpoint ORDER BY created_at DESC')
    })
    it('无登录端时返回空数组', () => {
      mockDb.query.mockReturnValue([])
      expect(listEndpoints()).toEqual([])
    })
  })

  describe('getEndpoint', () => {
    it('登录端不存在时返回 null', () => {
      mockDb.queryOne.mockReturnValue(undefined)
      expect(getEndpoint(999)).toBeNull()
    })
    it('普通登录端返回完整数据（含 pages/slots）', () => {
      mockDb.queryOne.mockReturnValue(makeEndpoint())
      mockDb.query.mockReturnValue([makePage()])
      mockListSlots.mockReturnValue([makeSlot()])
      const r = getEndpoint(1)
      expect(r).not.toBeNull()
      expect(r!.pages).toHaveLength(1)
      expect(r!.pages[0].slots).toHaveLength(1)
    })
    it('Token 登录端从 token 解码', () => {
      const ep = makeEndpoint({ share_token: 'fake.jwt.token' })
      const decoded = [{ ...makePage(), slots: [makeSlot()] }]
      mockDb.queryOne.mockReturnValue(ep)
      mockDecodeTokenPages.mockReturnValue(decoded)
      const r = getEndpoint(1)
      expect(r!.pages).toEqual(decoded)
      expect(mockDb.query).not.toHaveBeenCalled()
    })
    it('Token 解码失败时返回空 pages', () => {
      mockDb.queryOne.mockReturnValue(makeEndpoint({ share_token: 'bad.token' }))
      mockDecodeTokenPages.mockReturnValue(null)
      expect(getEndpoint(1)!.pages).toEqual([])
    })
  })

  describe('createEndpoint', () => {
    it('创建登录端并返回完整对象', () => {
      const r = createEndpoint({ name: '新网站', login_type: 'web' })
      expect(r.name).toBe('新网站')
      expect(r.login_type).toBe('web')
      expect(r.share_token).toBe('')
    })
    it('创建时包含 icon 和 login_type', () => {
      const r = createEndpoint({ name: 's', icon: 'globe', login_type: 'ssh' })
      expect(r.icon).toBe('globe')
      expect(r.login_type).toBe('ssh')
    })
  })

  describe('updateEndpoint', () => {
    it('更新成功返回 true', () => {
      expect(updateEndpoint(1, { name: '新名称' })).toBe(true)
    })
    it('无变更字段时返回 false', () => {
      expect(updateEndpoint(1, {})).toBe(false)
      expect(mockDb.run).not.toHaveBeenCalled()
    })
    it('只更新部分字段', () => {
      updateEndpoint(1, { name: 'only' })
      const sql: string = mockDb.run.mock.calls[0][0]
      expect(sql).toContain('name')
      expect(sql).not.toContain('icon')
    })
  })

  describe('deleteEndpoint', () => {
    it('级联删除', () => {
      mockDb.query.mockReturnValue([{ id: 10 }, { id: 11 }])
      mockDb.run.mockReturnValue({ changes: 1 })
      expect(deleteEndpoint(1)).toBe(true)
      expect(mockDb.run).toHaveBeenCalledWith('DELETE FROM slot WHERE page_id = ?', [10])
      expect(mockDb.run).toHaveBeenCalledWith('DELETE FROM page WHERE endpoint_id = ?', [1])
      expect(mockDb.run).toHaveBeenCalledWith('DELETE FROM endpoint WHERE id = ?', [1])
    })
    it('登录端不存在返回 false', () => {
      mockDb.query.mockReturnValue([])
      mockDb.run.mockReturnValue({ changes: 0 })
      expect(deleteEndpoint(999)).toBe(false)
    })
  })

  describe('exportEndpoints', () => {
    it('导出指定 ID', () => {
      mockDb.queryOne.mockReturnValue(makeEndpoint())
      mockDb.query.mockReturnValue([makePage()])
      mockListSlots.mockReturnValue([makeSlot()])
      expect(exportEndpoints([1])).toHaveLength(1)
    })
    it('过滤不存在的', () => {
      mockDb.queryOne.mockReturnValue(undefined)
      expect(exportEndpoints([999])).toEqual([])
    })
  })

  describe('importEndpoints', () => {
    function importData() {
      return [{ ...makeEndpoint(), pages: [{ ...makePage(), slots: [makeSlot()] }] }]
    }
    it('成功导入返回计数', () => {
      expect(importEndpoints(importData())).toEqual({ success: 1, failed: 0 })
    })
    it('导入失败计入 failed', () => {
      mockDb.transaction.mockImplementation(() => { throw new Error('DB error') })
      expect(importEndpoints(importData())).toEqual({ success: 0, failed: 1 })
    })
  })
})

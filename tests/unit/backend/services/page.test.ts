/**
 * 步骤页服务单元测试
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

const mockDb = vi.hoisted(() => ({
  query: vi.fn(),
  queryOne: vi.fn(),
  run: vi.fn(() => ({ changes: 1, lastInsertRowid: 1 })),
  exec: vi.fn(),
  transaction: vi.fn((fn: () => unknown) => {
    fn()
    return () => fn()
  }),
}))

const mockListSlots = vi.hoisted(() => vi.fn())

vi.mock('../../../../electron/backend/database/init', () => ({ db: mockDb }))
vi.mock('../../../../electron/backend/services/slot', () => ({ listSlots: mockListSlots }))

import {
  listPages, getPage, createPage, updatePage, deletePage, reorderPages,
} from '../../../../electron/backend/services/page'

function makePage(o: Record<string, unknown> = {}) {
  return {
    id: 1, endpoint_id: 10, order_index: 0, url: 'https://example.com/login',
    ssh_port: undefined, created_at: '2024-01-01T00:00:00.000Z', updated_at: '2024-01-01T00:00:00.000Z', ...o,
  }
}

describe('page 服务', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDb.run.mockReturnValue({ changes: 1, lastInsertRowid: 1 })
  })

  describe('listPages', () => {
    it('返回指定登录端的步骤页（按 order_index 排序）', () => {
      const pages = [makePage({ order_index: 0 }), makePage({ id: 2, order_index: 1 })]
      mockDb.query.mockReturnValue(pages)
      expect(listPages(10)).toEqual(pages)
    })
    it('无步骤页时返回空数组', () => {
      mockDb.query.mockReturnValue([])
      expect(listPages(999)).toEqual([])
    })
  })

  describe('getPage', () => {
    it('返回步骤页及其操作槽', () => {
      mockDb.queryOne.mockReturnValue(makePage())
      mockListSlots.mockReturnValue([{ id: 1, page_id: 1, order_index: 0, element_xpath: '//input', action_type: 'input', value: 'test', is_encrypted: false, timeout: 200 }])
      const r = getPage(1)
      expect(r).not.toBeNull()
      expect(r!.slots).toHaveLength(1)
    })
    it('步骤页不存在时返回 null', () => {
      mockDb.queryOne.mockReturnValue(undefined)
      expect(getPage(999)).toBeNull()
    })
  })

  describe('createPage', () => {
    it('指定顺序创建', () => {
      const r = createPage({ endpoint_id: 10, order_index: 5, url: 'https://example.com' })
      expect(r.order_index).toBe(5)
    })
    it('未指定顺序时自动放到最后', () => {
      mockDb.queryOne.mockReturnValue({ max: 3 })
      expect(createPage({ endpoint_id: 10, url: '' }).order_index).toBe(4)
    })
    it('第一个步骤页自动设为 0', () => {
      mockDb.queryOne.mockReturnValue({ max: -1 })
      expect(createPage({ endpoint_id: 10, url: '' }).order_index).toBe(0)
    })
    it('数据库返回 undefined 时默认为 0', () => {
      mockDb.queryOne.mockReturnValue(undefined)
      expect(createPage({ endpoint_id: 10, url: '' }).order_index).toBe(0)
    })
    it('创建时包含 ssh_port', () => {
      expect(createPage({ endpoint_id: 10, url: '', ssh_port: 22 }).ssh_port).toBe(22)
    })
  })

  describe('updatePage', () => {
    it('更新成功返回 true', () => {
      expect(updatePage(1, { url: 'https://new.com' })).toBe(true)
    })
    it('无变更返回 false', () => {
      expect(updatePage(1, {})).toBe(false)
      expect(mockDb.run).not.toHaveBeenCalled()
    })
    it('同时更新多个字段', () => {
      updatePage(1, { order_index: 3, url: 'x', ssh_port: 22 })
      const sql: string = mockDb.run.mock.calls[0][0]
      expect(sql).toContain('order_index')
      expect(sql).toContain('url')
      expect(sql).toContain('ssh_port')
    })
  })

  describe('deletePage', () => {
    it('级联删除操作槽', () => {
      mockDb.run.mockReturnValueOnce({ changes: 3 }).mockReturnValueOnce({ changes: 1 })
      expect(deletePage(1)).toBe(true)
      expect(mockDb.run).toHaveBeenCalledWith('DELETE FROM slot WHERE page_id = ?', [1])
      expect(mockDb.run).toHaveBeenCalledWith('DELETE FROM page WHERE id = ?', [1])
    })
    it('不存在返回 false', () => {
      mockDb.run.mockReturnValue({ changes: 0 })
      expect(deletePage(999)).toBe(false)
    })
  })

  describe('reorderPages', () => {
    it('在事务中调整顺序', () => {
      expect(reorderPages(10, [3, 1, 2])).toBe(true)
      expect(mockDb.transaction).toHaveBeenCalled()
      // run called twice per page (once by transaction mock, once by () invocation)
      // total: 3 pages × 2 = 6 calls, but the internal callback has 3 updates
    })
    it('空数组无操作', () => {
      const result = reorderPages(10, [])
      expect(result).toBe(true)
      expect(mockDb.transaction).toHaveBeenCalled()
    })
  })
})

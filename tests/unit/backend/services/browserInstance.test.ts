/**
 * 浏览器实例检测服务单元测试
 * 测试 browserInstance.ts 的所有导出函数
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

// ─── 使用 vi.hoisted 避免 hoisting 引用错误 ─────────────

const { mockFetch, mockAbortTimeout } = vi.hoisted(() => {
  return {
    mockFetch: vi.fn(),
    mockAbortTimeout: vi.fn(() => ({ aborted: false })),
  }
})

// ─── Mock 全局对象 ───────────────────────────────────────

vi.stubGlobal('fetch', mockFetch)
vi.stubGlobal('AbortSignal', { timeout: mockAbortTimeout })

// ─── 动态导入被测模块 ────────────────────────────────────

import {
  checkBrowserInstance,
  checkMultiplePorts,
  getBestInstance,
  validateWsEndpoint,
} from '../../../../electron/backend/services/browserInstance'

// ─── 辅助函数 ────────────────────────────────────────────

/** 创建带 ECONNREFUSED code 的错误 */
function createConnRefusedError(): Error {
  const err = new Error('connect ECONNREFUSED 127.0.0.1:9222')
  Object.assign(err, { code: 'ECONNREFUSED' })
  return err
}

/** 创建 AbortError */
function createAbortError(): Error {
  const err = new Error('The operation was aborted')
  err.name = 'AbortError'
  return err
}

/** 创建 ENOTFOUND 错误 */
function createNotFoundError(): Error {
  const err = new Error('getaddrinfo ENOTFOUND localhost')
  Object.assign(err, { code: 'ENOTFOUND' })
  return err
}

/** 创建成功的版本接口响应 */
function createVersionResponse(wsEndpoint?: string) {
  return {
    ok: true,
    json: () =>
      Promise.resolve({
        webSocketDebuggerUrl:
          wsEndpoint ?? 'ws://127.0.0.1:9222/devtools/browser/abc123',
      }),
  }
}

/** 创建是否有页面的 /json 响应 */
function createJsonResponse(hasPages: boolean) {
  return {
    ok: true,
    json: () =>
      Promise.resolve(
        hasPages
          ? [{ id: 'page1', url: 'https://example.com', title: 'Example', type: 'page' }]
          : []
      ),
  }
}

/** 创建非 200 响应 */
function createNonOkResponse(status = 404) {
  return { ok: false, status }
}

// ─── 测试套件 ────────────────────────────────────────────

describe('browserInstance 服务', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ─── checkBrowserInstance ──────────────────────────────

  describe('checkBrowserInstance', () => {
    it('成功检测到浏览器实例', async () => {
      mockFetch
        .mockResolvedValueOnce(createVersionResponse())
        .mockResolvedValueOnce(createJsonResponse(true))

      const result = await checkBrowserInstance(9222)

      expect(result.available).toBe(true)
      expect(result.port).toBe(9222)
      expect(result.wsEndpoint).toBe('ws://127.0.0.1:9222/devtools/browser/abc123')
      expect(result.pages).toHaveLength(1)
      expect(result.pages![0].title).toBe('Example')
      expect(result.pages![0].type).toBe('page')
      expect(mockAbortTimeout).toHaveBeenCalledWith(3000)
    })

    it('默认使用端口 9222', async () => {
      mockFetch
        .mockResolvedValueOnce(createVersionResponse())
        .mockResolvedValueOnce(createJsonResponse(false))

      await checkBrowserInstance()

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('127.0.0.1:9222/json/version'),
        expect.anything()
      )
    })

    it('端口未开放时返回不可用（ECONNREFUSED）', async () => {
      mockFetch.mockRejectedValue(createConnRefusedError())

      const result = await checkBrowserInstance(9222)

      expect(result.available).toBe(false)
      expect(result.port).toBe(9222)
      expect(result.error).toBe('No browser instance found')
    })

    it('DNS 解析失败时返回不可用（ENOTFOUND）', async () => {
      mockFetch.mockRejectedValue(createNotFoundError())

      const result = await checkBrowserInstance(9222)

      expect(result.available).toBe(false)
      expect(result.error).toBe('No browser instance found')
    })

    it('请求超时时返回不可用（AbortError）', async () => {
      mockFetch.mockRejectedValue(createAbortError())

      const result = await checkBrowserInstance(9222)

      expect(result.available).toBe(false)
      expect(result.error).toBe('No browser instance found')
    })

    it('版本接口返回非 200 时返回不可用', async () => {
      mockFetch.mockResolvedValue(createNonOkResponse(404))

      const result = await checkBrowserInstance(9222)

      expect(result.available).toBe(false)
      expect(result.port).toBe(9222)
      expect(result.error).toBe('Version endpoint not available')
    })

    it('版本信息中缺少 webSocketDebuggerUrl 时返回不可用', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ Browser: 'Chrome/120' }),
      })

      const result = await checkBrowserInstance(9222)

      expect(result.available).toBe(false)
      expect(result.error).toBe('No WebSocket URL found')
    })

    it('页面列表接口返回非 200 但版本成功时返回可用且 pages 为空', async () => {
      mockFetch
        .mockResolvedValueOnce(createVersionResponse())
        .mockResolvedValueOnce(createNonOkResponse(500))

      const result = await checkBrowserInstance(9222)

      expect(result.available).toBe(true)
      expect(result.wsEndpoint).toBe('ws://127.0.0.1:9222/devtools/browser/abc123')
      expect(result.pages).toEqual([])
    })

    it('版本接口成功但页面列表只提取 type 为 page 的目标', async () => {
      mockFetch
        .mockResolvedValueOnce(createVersionResponse())
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve([
              { id: 'p1', url: 'about:blank', title: 'New Tab', type: 'page' },
              { id: 'w1', url: 'ws://...', title: '', type: 'worker' },
              { id: 'p2', url: 'https://test.com', title: 'Test', type: 'page' },
            ]),
        })

      const result = await checkBrowserInstance(9222)

      expect(result.available).toBe(true)
      expect(result.pages).toHaveLength(2)
      // 只包含 page 类型
      expect(result.pages!.every((p) => p.type === 'page')).toBe(true)
    })

    it('目标缺少 id/url/title 时使用空字符串兜底', async () => {
      mockFetch
        .mockResolvedValueOnce(createVersionResponse())
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([{ type: 'page' }]),
        })

      const result = await checkBrowserInstance(9222)

      expect(result.available).toBe(true)
      expect(result.pages).toHaveLength(1)
      expect(result.pages![0].id).toBe('')
      expect(result.pages![0].url).toBe('')
      expect(result.pages![0].title).toBe('')
    })

    it('其他未知错误返回不可用并携带错误消息', async () => {
      mockFetch.mockRejectedValue(new Error('Some unexpected error'))

      const result = await checkBrowserInstance(9222)

      expect(result.available).toBe(false)
      expect(result.error).toBe('Some unexpected error')
    })
  })

  // ─── checkMultiplePorts ────────────────────────────────

  describe('checkMultiplePorts', () => {
    it('所有端口都关闭时返回空数组', async () => {
      mockFetch.mockRejectedValue(createConnRefusedError())

      const result = await checkMultiplePorts()

      expect(result).toEqual([])
      // 每个端口只调用了一次 fetch（第一次就失败）
      expect(mockFetch).toHaveBeenCalledTimes(4)
    })

    it('部分端口开放时只返回可用实例', async () => {
      mockFetch.mockImplementation((url: string) => {
        const match = url.match(/127\.0\.0\.1:(\d+)\//)
        const port = match ? parseInt(match[1]) : 0

        if (port === 9223 || port === 9229) {
          // 这两个端口正常响应
          const isVersion = url.includes('/json/version')
          if (isVersion) {
            return Promise.resolve(
              createVersionResponse(`ws://127.0.0.1:${port}/devtools/browser/xyz`)
            )
          }
          return Promise.resolve(createJsonResponse(false))
        }

        return Promise.reject(createConnRefusedError())
      })

      const result = await checkMultiplePorts()

      expect(result).toHaveLength(2)
      const ports = result.map((r) => r.port).sort()
      expect(ports).toEqual([9223, 9229])
      result.forEach((r) => {
        expect(r.available).toBe(true)
      })
    })

    it('所有端口都开放时返回全部实例', async () => {
      mockFetch.mockImplementation((url: string) => {
        const match = url.match(/127\.0\.0\.1:(\d+)\//)
        const port = match ? parseInt(match[1]) : 0
        const isVersion = url.includes('/json/version')
        if (isVersion) {
          return Promise.resolve(
            createVersionResponse(`ws://127.0.0.1:${port}/devtools/browser/xyz`)
          )
        }
        return Promise.resolve(createJsonResponse(false))
      })

      const result = await checkMultiplePorts()

      expect(result).toHaveLength(4)
      const ports = result.map((r) => r.port).sort()
      expect(ports).toEqual([9222, 9223, 9229, 9230])
    })
  })

  // ─── getBestInstance ───────────────────────────────────

  describe('getBestInstance', () => {
    it('指定端口可用时返回该实例', async () => {
      mockFetch
        .mockResolvedValueOnce(createVersionResponse())
        .mockResolvedValueOnce(createJsonResponse(false))

      const result = await getBestInstance(9222)

      expect(result).not.toBeNull()
      expect(result!.port).toBe(9222)
      expect(result!.available).toBe(true)
    })

    it('指定端口不可用时返回 null', async () => {
      mockFetch.mockRejectedValue(createConnRefusedError())

      const result = await getBestInstance(9222)

      expect(result).toBeNull()
    })

    it('自动检测时优先返回有页面的实例', async () => {
      mockFetch.mockImplementation((url: string) => {
        const match = url.match(/127\.0\.0\.1:(\d+)\//)
        const port = match ? parseInt(match[1]) : 0
        const isVersion = url.includes('/json/version')

        // 9222: 开放，无页面
        // 9223: 关闭
        // 9229: 开放，有页面 ← 应优先返回
        // 9230: 关闭
        if (port === 9223 || port === 9230) {
          return Promise.reject(createConnRefusedError())
        }

        if (isVersion) {
          return Promise.resolve(
            createVersionResponse(`ws://127.0.0.1:${port}/devtools/browser/xyz`)
          )
        }

        // /json 调用
        if (port === 9229) {
          return Promise.resolve(createJsonResponse(true))
        }
        return Promise.resolve(createJsonResponse(false))
      })

      const result = await getBestInstance()

      expect(result).not.toBeNull()
      // 应优先返回有页面的 9229
      expect(result!.port).toBe(9229)
      expect(result!.pages).toHaveLength(1)
    })

    it('自动检测无页面实例时返回第一个可用实例', async () => {
      mockFetch.mockImplementation((url: string) => {
        const match = url.match(/127\.0\.0\.1:(\d+)\//)
        const port = match ? parseInt(match[1]) : 0
        const isVersion = url.includes('/json/version')

        // 9222: 关闭
        // 9223: 开放，无页面 ← 应返回
        // 9229: 关闭
        // 9230: 开放，无页面
        if (port === 9222 || port === 9229) {
          return Promise.reject(createConnRefusedError())
        }

        if (isVersion) {
          return Promise.resolve(
            createVersionResponse(`ws://127.0.0.1:${port}/devtools/browser/xyz`)
          )
        }
        return Promise.resolve(createJsonResponse(false))
      })

      const result = await getBestInstance()

      expect(result).not.toBeNull()
      // 应返回第一个可用实例 9223
      expect(result!.port).toBe(9223)
      expect(result!.pages).toEqual([])
    })

    it('自动检测无任何实例时返回 null', async () => {
      mockFetch.mockRejectedValue(createConnRefusedError())

      const result = await getBestInstance()

      expect(result).toBeNull()
    })
  })

  // ─── validateWsEndpoint ────────────────────────────────

  describe('validateWsEndpoint', () => {
    it('有效 WebSocket 端点返回 true', async () => {
      mockFetch.mockResolvedValue({ ok: true })

      const result = await validateWsEndpoint(
        'ws://127.0.0.1:9222/devtools/browser/abc123'
      )

      expect(result).toBe(true)
      expect(mockFetch).toHaveBeenCalledWith(
        'http://127.0.0.1:9222/json/list',
        expect.objectContaining({ method: 'GET' })
      )
      expect(mockAbortTimeout).toHaveBeenCalledWith(2000)
    })

    it('无效 URL 格式返回 false', async () => {
      const result = await validateWsEndpoint('not-a-valid-url')

      expect(result).toBe(false)
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('URL 有效但连接失败时返回 false', async () => {
      mockFetch.mockRejectedValue(createConnRefusedError())

      const result = await validateWsEndpoint(
        'ws://127.0.0.1:9222/devtools/browser/abc123'
      )

      expect(result).toBe(false)
    })

    it('fetch 返回非 ok 时返回 false', async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 503 })

      const result = await validateWsEndpoint(
        'ws://127.0.0.1:9222/devtools/browser/abc123'
      )

      expect(result).toBe(false)
    })
  })
})

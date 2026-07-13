/**
 * captcha 服务单元测试 — OCR 验证码识别
 */
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'

// ── vi.hoisted 确保 vi.mock 工厂可访问变量 ──
const {
  mockRecognize,
  mockSetParameters,
  mockTerminate,
  mockFS,
  mockReinitialize,
  mockWorker,
  mockChain,
  mockSharp,
} = vi.hoisted(() => {
  const mockRecognize = vi.fn()
  const mockSetParameters = vi.fn()
  const mockTerminate = vi.fn()
  const mockFS = vi.fn()
  const mockReinitialize = vi.fn()
  const mockWorker = {
    recognize: mockRecognize,
    setParameters: mockSetParameters,
    terminate: mockTerminate,
    FS: mockFS,
    reinitialize: mockReinitialize,
  }
  const mockChain = {
    greyscale: vi.fn().mockReturnThis(),
    normalize: vi.fn().mockReturnThis(),
    resize: vi.fn().mockReturnThis(),
    threshold: vi.fn().mockReturnThis(),
    median: vi.fn().mockReturnThis(),
    sharpen: vi.fn().mockReturnThis(),
    trim: vi.fn().mockReturnThis(),
    png: vi.fn().mockReturnThis(),
    toBuffer: vi.fn().mockResolvedValue(Buffer.from('processed')),
    metadata: vi.fn().mockResolvedValue({ width: 100, height: 50 }),
  }
  const mockSharp = vi.fn(() => mockChain)
  return {
    mockRecognize,
    mockSetParameters,
    mockTerminate,
    mockFS,
    mockReinitialize,
    mockWorker,
    mockChain,
    mockSharp,
  }
})

vi.mock('tesseract.js', () => ({
  createWorker: vi.fn().mockResolvedValue(mockWorker),
}))

vi.mock('sharp', () => ({
  default: mockSharp,
}))

vi.mock('electron', () => ({
  app: {
    isPackaged: false,
  },
}))

vi.mock('fs', () => ({
  existsSync: vi.fn().mockReturnValue(true),
  readFileSync: vi.fn().mockReturnValue(Buffer.from('traineddata')),
}))

import { recognize, shutdownOcr } from '../../../../electron/backend/services/captcha'
import { createWorker } from 'tesseract.js'

describe('captcha 服务', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // 重置 sharp 链式调用
    mockChain.greyscale.mockReturnThis()
    mockChain.normalize.mockReturnThis()
    mockChain.resize.mockReturnThis()
    mockChain.threshold.mockReturnThis()
    mockChain.median.mockReturnThis()
    mockChain.sharpen.mockReturnThis()
    mockChain.trim.mockReturnThis()
    mockChain.png.mockReturnThis()
    mockChain.toBuffer.mockResolvedValue(Buffer.from('processed'))
    mockChain.metadata.mockResolvedValue({ width: 100, height: 50 })
    // 重置 worker mock
    mockRecognize.mockResolvedValue({
      data: { text: 'AB12', confidence: 95 },
    })
    mockSetParameters.mockResolvedValue(undefined)
    mockTerminate.mockResolvedValue(undefined)
    ;(createWorker as any).mockResolvedValue(mockWorker)
  })

  afterEach(async () => {
    await shutdownOcr()
  })

  describe('recognize', () => {
    it('返回识别结果文本和置信度', async () => {
      mockRecognize.mockResolvedValue({
        data: { text: 'AB12', confidence: 95 },
      })

      const result = await recognize(Buffer.from('image'))

      expect(result.text).toBe('AB12')
      expect(result.confidence).toBe(95)
    })

    it('调用 worker.recognize 处理预处理后的图像', async () => {
      mockRecognize.mockResolvedValue({
        data: { text: 'XYZ', confidence: 80 },
      })

      await recognize(Buffer.from('image'))

      expect(mockRecognize).toHaveBeenCalledTimes(1)
      expect(mockRecognize).toHaveBeenCalledWith(Buffer.from('processed'))
    })

    it('使用 whitelist 时调用 setParameters', async () => {
      mockRecognize.mockResolvedValue({
        data: { text: '1234', confidence: 90 },
      })

      await recognize(Buffer.from('image'), { whitelist: '0123456789' })

      expect(mockSetParameters).toHaveBeenCalledWith({
        tessedit_char_whitelist: '0123456789',
        tessedit_pageseg_mode: '7',
      })
    })

    it('默认使用大写字母+数字白名单和 PSM 7', async () => {
      mockRecognize.mockResolvedValue({
        data: { text: 'AB12', confidence: 95 },
      })

      await recognize(Buffer.from('image'))

      expect(mockSetParameters).toHaveBeenCalledWith({
        tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
        tessedit_pageseg_mode: '7',
      })
    })

    it('默认 postProcess 移除非字母数字字符', async () => {
      mockRecognize.mockResolvedValue({
        data: { text: 'A B-1!2@', confidence: 70 },
      })

      const result = await recognize(Buffer.from('image'))

      expect(result.text).toBe('AB12')
    })

    it('postProcess 尊重 whitelist 过滤', async () => {
      mockRecognize.mockResolvedValue({
        data: { text: 'A1B2C3', confidence: 85 },
      })

      const result = await recognize(Buffer.from('image'), { whitelist: '0123456789' })

      expect(result.text).toBe('123')
    })

    it('confidence 非数字时返回 0', async () => {
      mockRecognize.mockResolvedValue({
        data: { text: 'AB', confidence: undefined },
      })

      const result = await recognize(Buffer.from('image'))

      expect(result.confidence).toBe(0)
    })

    it('data.text 为空时返回空字符串', async () => {
      mockRecognize.mockResolvedValue({
        data: { text: undefined, confidence: 0 },
      })

      const result = await recognize(Buffer.from('image'))

      expect(result.text).toBe('')
    })

    it('trim 文本首尾空白', async () => {
      mockRecognize.mockResolvedValue({
        data: { text: '  AB12  ', confidence: 90 },
      })

      const result = await recognize(Buffer.from('image'))

      expect(result.text).toBe('AB12')
    })
  })

  describe('preprocess (sharp pipeline)', () => {
    it('调用 sharp 进行图像预处理', async () => {
      mockRecognize.mockResolvedValue({
        data: { text: 'AB', confidence: 90 },
      })

      await recognize(Buffer.from('image'))

      expect(mockSharp).toHaveBeenCalled()
      expect(mockChain.greyscale).toHaveBeenCalled()
      expect(mockChain.resize).toHaveBeenCalled()
      expect(mockChain.normalize).toHaveBeenCalled()
      expect(mockChain.threshold).toHaveBeenCalled()
      expect(mockChain.median).toHaveBeenCalled()
      expect(mockChain.sharpen).toHaveBeenCalled()
      expect(mockChain.trim).toHaveBeenCalled()
      expect(mockChain.png).toHaveBeenCalled()
      expect(mockChain.toBuffer).toHaveBeenCalled()
    })

    it('调用 metadata 获取图像尺寸', async () => {
      mockRecognize.mockResolvedValue({
        data: { text: 'AB', confidence: 90 },
      })

      await recognize(Buffer.from('image'))

      expect(mockChain.metadata).toHaveBeenCalled()
    })

    it('调用 resize 智能放大图像 (minDim < 60 → 2x)', async () => {
      mockChain.metadata.mockResolvedValue({ width: 100, height: 50 })
      mockRecognize.mockResolvedValue({
        data: { text: 'AB', confidence: 90 },
      })

      await recognize(Buffer.from('image'))

      expect(mockChain.resize).toHaveBeenCalled()
      const resizeArgs = mockChain.resize.mock.calls[0]
      // minDim = 50 (< 60) → scale = 2, targetWidth = 200, targetHeight = 100
      expect(resizeArgs[0]).toBe(200)
      expect(resizeArgs[1]).toBe(100)
    })
  })

  describe('shutdownOcr', () => {
    it('终止已初始化的 worker', async () => {
      mockRecognize.mockResolvedValue({
        data: { text: 'AB', confidence: 90 },
      })

      // 先初始化 worker
      await recognize(Buffer.from('image'))

      // 然后关闭
      await shutdownOcr()

      expect(mockTerminate).toHaveBeenCalled()
    })

    it('无 worker 时不抛出错误', async () => {
      await expect(shutdownOcr()).resolves.not.toThrow()
    })

    it('关闭后再次 recognize 会重新初始化 worker', async () => {
      mockRecognize.mockResolvedValue({
        data: { text: 'AB', confidence: 90 },
      })

      await recognize(Buffer.from('image'))
      await shutdownOcr()
      expect(mockTerminate).toHaveBeenCalledTimes(1)

      // 重新识别应再次调用 createWorker
      await recognize(Buffer.from('image'))
      expect(createWorker).toHaveBeenCalledTimes(2)
    })
  })
})
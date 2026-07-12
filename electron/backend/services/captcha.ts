import { createWorker, type Worker } from 'tesseract.js'
import { app } from 'electron'
import type sharp from 'sharp'
import { existsSync, readFileSync } from 'fs'
import { join, resolve } from 'path'

export interface RecognizeOptions {
  whitelist?: string
}

export interface RecognizeResult {
  text: string
  confidence: number
}

let workerInstance: Worker | null = null
let workerInitPromise: Promise<Worker> | null = null

function resolveTessdataDir(): string {
  try {
    if (app?.isPackaged) {
      return join(process.resourcesPath, 'tessdata')
    }
  } catch {
    // app 不可用时回退到开发环境路径
  }
  return resolve(__dirname, '../../../resources/tessdata')
}

function resolveTraineddataPath(): string {
  const dir = resolveTessdataDir()
  const file = join(dir, 'eng.traineddata')
  if (!existsSync(file)) {
    throw new Error(`Traineddata file not found: ${file}`)
  }
  return file
}

async function initWorkerWithLangPath(): Promise<Worker> {
  const tessdataDir = resolveTessdataDir()
  const worker = await createWorker('eng', 1, {
    langPath: tessdataDir,
    cacheMethod: 'readOnly',
    gzip: false,
  })
  return worker
}

// Electron v5 主进程中 langPath 本地路径可能失败，
// 改为读取 traineddata 文件并写入 worker 虚拟文件系统
async function initWorkerWithFSWrite(): Promise<Worker> {
  const traineddataPath = resolveTraineddataPath()
  const data = readFileSync(traineddataPath)
  const worker = await createWorker([], 1, {
    cacheMethod: 'readOnly',
  })
  await worker.FS('writeFile', ['eng.traineddata', data])
  await worker.reinitialize('eng', 1)
  return worker
}

async function getWorker(): Promise<Worker> {
  if (workerInstance) return workerInstance
  if (workerInitPromise) return workerInitPromise

  workerInitPromise = (async () => {
    try {
      workerInstance = await initWorkerWithLangPath()
      return workerInstance
    } catch (err) {
      try {
        workerInstance = await initWorkerWithFSWrite()
        return workerInstance
      } catch (fallbackErr) {
        workerInitPromise = null
        throw new Error(
          `OCR worker init failed. langPath: ${getErrorMessage(err)}; fallback: ${getErrorMessage(fallbackErr)}`
        )
      }
    }
  })()

  return workerInitPromise
}

function getErrorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

async function preprocess(imageBuffer: Buffer): Promise<Buffer> {
  // Dynamic import to avoid Vite bundling the native module
  const sharp = (await import('sharp')).default
  const meta = await sharp(imageBuffer).metadata()
  const width = meta.width ?? 0
  const height = meta.height ?? 0
  const targetWidth = width > 0 ? width * 4 : undefined
  const targetHeight = height > 0 ? height * 4 : undefined

  const pipeline = sharp(imageBuffer).greyscale().normalize()

  const resized =
    targetWidth && targetHeight
      ? pipeline.resize(targetWidth, targetHeight, {
          kernel: 'lanczos3',
          fit: 'fill',
        })
      : pipeline.resize(4, 4, { kernel: 'lanczos3', fit: 'inside' })

  return resized
    .sharpen()
    .linear(1.5, -128) // slope=1.5 增加对比度，偏移居中
    .png()
    .toBuffer()
}

function postProcess(text: string, options?: RecognizeOptions): string {
  let result = text.trim()
  if (options?.whitelist) {
    const allowed = new Set(options.whitelist)
    result = Array.from(result)
      .filter((ch) => allowed.has(ch))
      .join('')
  } else {
    result = result.replace(/[^A-Za-z0-9]/g, '')
  }
  return result
}

export async function recognize(
  imageBuffer: Buffer,
  options?: RecognizeOptions
): Promise<RecognizeResult> {
  const worker = await getWorker()

  if (options?.whitelist) {
    await worker.setParameters({
      tessedit_char_whitelist: options.whitelist,
    })
  }

  const processed = await preprocess(imageBuffer)
  const { data } = await worker.recognize(processed)
  const text = postProcess(data.text ?? '', options)
  const confidence = typeof data.confidence === 'number' ? data.confidence : 0

  return { text, confidence }
}

export async function shutdownOcr(): Promise<void> {
  if (workerInitPromise) {
    try {
      await workerInitPromise
    } catch {
      // 初始化失败也继续清理
    }
  }
  if (workerInstance) {
    try {
      await workerInstance.terminate()
    } catch {
      // 忽略终止错误
    }
    workerInstance = null
    workerInitPromise = null
  }
}
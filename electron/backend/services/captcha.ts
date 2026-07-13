import { createWorker, type Worker } from 'tesseract.js'
import { app } from 'electron'
import type sharp from 'sharp'
import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'fs'
import { join, resolve } from 'path'
import { execFileSync } from 'child_process'
import { tmpdir } from 'os'
import { getOcrMethod, getMugglePythonPath } from './ocrConfig'

export interface RecognizeOptions {
  whitelist?: string
}

export interface RecognizeResult {
  text: string
  confidence: number
  engine?: 'tesseract' | 'muggle'
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
  // Bundled: __dirname=dist-electron/, need ../resources/tessdata
  const fromBundle = resolve(__dirname, '../resources/tessdata')
  if (existsSync(fromBundle)) return fromBundle
  // Unbundled dev: __dirname=electron/backend/services/, need ../../../resources/tessdata
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

function resolveWorkerScriptPath(): string {
  // Try 1: from project root (__dirname=dist-electron/ in bundled, or electron/backend/services/ in dev)
  const fromProjectRoot = resolve(__dirname, '../node_modules/tesseract.js/src/worker-script/node/index.js')
  if (existsSync(fromProjectRoot)) return fromProjectRoot

  // Try 2: unbundled dev mode — __dirname is electron/backend/services/
  const fromDevRoot = resolve(__dirname, '../../..', 'node_modules', 'tesseract.js', 'src', 'worker-script', 'node', 'index.js')
  if (existsSync(fromDevRoot)) return fromDevRoot

  // Try 3: asar-unpacked production
  try {
    if (app?.isPackaged) {
      const prodPath = join(process.resourcesPath, 'app.asar.unpacked', 'node_modules', 'tesseract.js', 'src', 'worker-script', 'node', 'index.js')
      if (existsSync(prodPath)) return prodPath
    }
  } catch {}

  // Return best guess so error message is informative
  return fromProjectRoot
}

function toFileUrl(dirPath: string): string {
  // Convert Windows path to file:// URL for tesseract.js Electron compatibility
  // D:\foo\bar → file:///D:/foo/bar
  return 'file://' + dirPath.replace(/\\/g, '/').replace(/^([A-Za-z]):/, '/$1:')
}

async function initWorkerWithLangPath(): Promise<Worker> {
  const tessdataDir = resolveTessdataDir()
  const workerPath = resolveWorkerScriptPath()
  console.log('[Captcha] Creating worker (langPath fallback), langPath=' + tessdataDir + ', workerPath=' + workerPath)
  const worker = await createWorker('eng', 1, {
    langPath: tessdataDir,
    workerPath,
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
  const workerPath = resolveWorkerScriptPath()
  console.log('[Captcha] Creating worker (FS fallback), workerPath=' + workerPath)
  const worker = await createWorker([], 1, {
    workerPath,
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
      workerInstance = await initWorkerWithFSWrite()
      return workerInstance
    } catch (err) {
      try {
        workerInstance = await initWorkerWithLangPath()
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
  const sharp = (await import('sharp')).default
  const meta = await sharp(imageBuffer).metadata()
  const width = meta.width ?? 0
  const height = meta.height ?? 0

  if (width === 0 || height === 0) return imageBuffer

  // 智能缩放：小图 3x，中等 2x，大图保持
  const minDim = Math.min(width, height)
  let scale: number
  if (minDim < 30) scale = 3
  else if (minDim < 60) scale = 2
  else scale = 1

  const targetWidth = Math.round(width * scale)
  const targetHeight = Math.round(height * scale)

  return sharp(imageBuffer)
    // 1. 转灰度
    .greyscale()
    // 2. 放大（lanczos3 保持细节）
    .resize(targetWidth, targetHeight, { kernel: 'lanczos3', fit: 'fill' })
    // 3. 自适应阈值二值化（关键：纯黑白，去除背景噪声）
    .normalize()
    .threshold(128)
    // 4. 中值滤波去除椒盐噪声
    .median(1)
    // 5. 轻微锐化使字符边缘清晰
    .sharpen({ sigma: 0.5 })
    // 6. 裁切白边
    .trim({ threshold: 10 })
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

// ============ muggle_ocr (Python) 验证码识别 ============

function resolveMuggleScriptPath(): string {
  try {
    if (app?.isPackaged) {
      return join(process.resourcesPath, 'python', 'muggleOCR.py')
    }
  } catch {}
  // Bundled: __dirname=dist-electron/, need ../resources/python/muggleOCR.py
  const fromBundle = resolve(__dirname, '../resources/python/muggleOCR.py')
  if (existsSync(fromBundle)) return fromBundle
  // Unbundled dev: __dirname=electron/backend/services/
  return resolve(__dirname, '../../../resources/python/muggleOCR.py')
}

/**
 * 使用 muggle_ocr (Python) 识别验证码
 *
 * 将图片写入临时文件，调用 Python 脚本，解析输出。
 * 输出格式: <path> [|code|] <text>
 */
export function recognizeMuggle(
  imageBuffer: Buffer,
  options?: RecognizeOptions
): RecognizeResult {
  const scriptPath = resolveMuggleScriptPath()
  if (!existsSync(scriptPath)) {
    throw new Error(`muggleOCR.py not found: ${scriptPath}`)
  }

  const pythonCmd = getMugglePythonPath()
  if (!pythonCmd) {
    throw new Error(
      'muggle_ocr (Python) 不可用。请安装 Python 和 muggle_ocr 包。\n' +
      '安装: pip install muggle_ocr'
    )
  }

  const tmpFile = join(tmpdir(), `captcha_${Date.now()}_${Math.random().toString(36).slice(2)}.png`)
  writeFileSync(tmpFile, imageBuffer)

  try {
    const output = execFileSync(pythonCmd, [scriptPath, tmpFile], {
      encoding: 'utf-8',
      timeout: 15000,
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    const stdout = typeof output === 'string' ? output : output.toString('utf-8')
    const codeIdx = stdout.indexOf('[|code|]')

    if (codeIdx === -1) {
      throw new Error('muggle_ocr 输出解析失败: ' + stdout.trim())
    }

    const rawText = stdout
      .slice(codeIdx + '[|code|]'.length)
      .split('\n')[0]
      .trim()
      .toUpperCase()

    const text = postProcess(rawText, options)
    const confidence = text.length > 0 ? 85 : 0

    return { text, confidence, engine: 'muggle' }
  } finally {
    try { unlinkSync(tmpFile) } catch {
      // 清理临时文件失败不影响
    }
  }
}

export async function recognize(
  imageBuffer: Buffer,
  options?: RecognizeOptions
): Promise<RecognizeResult> {
  const method = getOcrMethod()

  if (method === 'muggle') {
    try {
      const result = recognizeMuggle(imageBuffer, options)
      console.log('[Captcha] Recognized via muggle_ocr: "' + result.text + '"')
      return result
    } catch (muggleErr: any) {
      console.warn('[Captcha] muggle_ocr failed, falling back to tesseract:', muggleErr.message)
      // fall through to tesseract
    }
  }

  const worker = await getWorker()

  const whitelist = options?.whitelist || 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  await worker.setParameters({
    tessedit_char_whitelist: whitelist,
    tessedit_pageseg_mode: '7',
  })

  const processed = await preprocess(imageBuffer)
  const { data } = await worker.recognize(processed)
  const text = postProcess(data.text ?? '', options)
  const confidence = typeof data.confidence === 'number' ? data.confidence : 0

  console.log('[Captcha] Recognized via tesseract: "' + text + '", confidence=' + confidence)
  return { text, confidence, engine: 'tesseract' }
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
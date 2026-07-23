/**
 * OCR 方法配置服务 — 管理用户验证码识别方案的偏好
 *
 * 使用 system_config 表存储: key='ocr_method', value='tesseract'|'muggle'
 */
import { db } from '../database/init'

export type OcrMethod = 'tesseract' | 'muggle'
export const DEFAULT_OCR_METHOD: OcrMethod = 'tesseract'

export interface OcrConfig {
  method: OcrMethod
  muggleAvailable: boolean
  mugglePythonPath: string | null
  /** 不可用时的人类可读诊断信息（可用时为 null） */
  muggleDiagnostics: string | null
}

/**
 * 获取当前 OCR 方法配置
 */
export function getOcrMethod(): OcrMethod {
  try {
    const row = db.queryOne(
      "SELECT value FROM system_config WHERE key = 'ocr_method'"
    ) as { value: string } | null
    if (row && (row.value === 'tesseract' || row.value === 'muggle')) {
      return row.value as OcrMethod
    }
  } catch {
    // 表可能还未初始化，返回默认
  }
  return DEFAULT_OCR_METHOD
}

/**
 * 设置 OCR 方法
 */
export function setOcrMethod(method: OcrMethod): void {
  db.run(
    "INSERT OR REPLACE INTO system_config (key, value, updated_at) VALUES ('ocr_method', ?, datetime('now'))",
    [method]
  )
  // 切换方法时刷新 muggle 检测缓存
  refreshMuggleCache()
}

/**
 * 获取完整 OCR 配置（含可用性检测 + 诊断信息）
 */
export function getOcrConfig(): OcrConfig {
  const method = getOcrMethod()
  const result = getMuggleDetectionResult()
  return {
    method,
    muggleAvailable: result.path !== null,
    mugglePythonPath: result.path,
    muggleDiagnostics: result.diagnostics,
  }
}

/**
 * 检测 muggle_ocr 是否可用
 */
export function isMuggleAvailable(): boolean {
  return getMuggleDetectionResult().path !== null
}

/**
 * 获取 muggle_ocr Python 路径（或 null 如果不可用）
 */
export function getMugglePythonPath(): string | null {
  return getMuggleDetectionResult().path
}

interface MuggleDetectionResult {
  path: string | null
  diagnostics: string | null
}

/**
 * 统一的 muggle_ocr 检测结果缓存（成功和失败都缓存，避免重复执行昂贵的 execSync）
 * 缓存时长: 成功 30s / 失败 120s（失败重试间隔更长，避免频繁阻塞）
 */
let _muggleDetectionCache: {
  result: MuggleDetectionResult
  ts: number
} | null = null

function getMuggleDetectionResult(): MuggleDetectionResult {
  const cacheTtl = _muggleDetectionCache?.result.path ? 30000 : 120000
  if (_muggleDetectionCache && Date.now() - _muggleDetectionCache.ts < cacheTtl) {
    return _muggleDetectionCache.result
  }

  const result = detectMuggleOcr()
  _muggleDetectionCache = { result, ts: Date.now() }

  if (result.path) {
    console.log('[muggle_ocr] 可用:', result.path)
  } else {
    console.warn('[muggle_ocr] 不可用:', result.diagnostics)
  }
  return result
}

/**
 * 执行实际的 muggle_ocr 可用性检测
 * 返回 path + diagnostics，上层负责缓存
 */
function detectMuggleOcr(): MuggleDetectionResult {
  // Step 1: 找 Python
  const pythonCmd = getPythonCommand()
  if (!pythonCmd) {
    return {
      path: null,
      diagnostics: buildPythonNotFoundDiagnostics(),
    }
  }

  // Step 2: 尝试 import muggle_ocr
  try {
    const { execSync } = require('child_process')
    console.log(`[muggle_ocr] 检测: "${pythonCmd}" -c "import muggle_ocr"`)
    execSync(`"${pythonCmd}" -c "import muggle_ocr"`, { timeout: 60000, stdio: 'pipe' })
    return {
      path: pythonCmd,
      diagnostics: null,
    }
  } catch (err: any) {
    const stderr = extractStderr(err)
    const isExecNotFound = isShellNotFound(stderr, pythonCmd)

    if (isExecNotFound) {
      return {
        path: null,
        diagnostics: buildExecNotFoundDiagnostics(pythonCmd, stderr),
      }
    }

    return {
      path: null,
      diagnostics: buildImportFailedDiagnostics(pythonCmd, stderr),
    }
  }
}

/** 检测 shell 报错是否为「可执行文件不存在」（而非 Python import 失败） */
function isShellNotFound(stderr: string, pythonCmd: string): boolean {
  const lower = stderr.toLowerCase()
  return (
    lower.includes('not found') ||
    lower.includes('no such file') ||
    lower.includes('cannot find') ||
    lower.includes('does not exist') ||
    (lower.includes('cannot execute') && lower.includes('binary file'))
  )
}

function buildExecNotFoundDiagnostics(pythonCmd: string, stderr: string): string {
  return [
    `Python 路径无效: ${pythonCmd}`,
    '该路径指向 asar 归档内部或已删除的位置，无法执行。',
    '请确认 python-runtime 已正确部署。如在打包模式下首次启动，等待自动部署完成后重新打开设置面板。',
    `原始错误: ${stderr.split('\n')[0]}`,
  ].join(' ')
}

function extractStderr(err: any): string {
  if (err.stderr) {
    const s = typeof err.stderr === 'string' ? err.stderr : err.stderr.toString('utf-8')
    return s.trim().split('\n').slice(-5).join('\n')
  }
  return err.message || String(err)
}

function buildPythonNotFoundDiagnostics(): string {
  const parts: string[] = ['未找到可用的 Python 运行环境。']
  try {
    const { app } = require('electron')
    if (app?.isPackaged) {
      parts.push('（当前处于打包模式，自动部署可能未触发或失败）')
    }
  } catch {}
  parts.push('请安装 Python 3.8+ 并执行: pip install muggle_ocr')
  return parts.join(' ')
}

function buildImportFailedDiagnostics(pythonCmd: string, stderr: string): string {
  const parts: string[] = [
    `Python 已找到 (${pythonCmd})，但无法导入 muggle_ocr 模块。`,
  ]

  // 解析常见错误模式
  if (stderr.includes('ModuleNotFoundError') || stderr.includes('No module named')) {
    parts.push('muggle_ocr 未安装。请执行: pip install muggle_ocr')
  } else if (stderr.includes('DLL load failed') || stderr.includes('ImportError: DLL')) {
    parts.push('缺少系统依赖库（如 MSVC 运行时）。请安装 Visual C++ Redistributable。')
  } else if (stderr.includes('Illegal instruction') || stderr.includes('core dumped')) {
    parts.push('CPU 不支持 TensorFlow 所需指令集（需 AVX）。请使用旧版 TensorFlow，或切换到 Tesseract。')
  } else if (stderr.includes('GLIBC') || stderr.includes('version `GLIBC')) {
    parts.push('系统 GLIBC 版本过低，不满足 TensorFlow 运行要求。请升级系统或切换到 Tesseract。')
  } else {
    const snippet = stderr.substring(0, 200)
    parts.push(`导入失败: ${snippet}`)
  }

  return parts.join(' ')
}

/**
 * 刷新 muggle_ocr 缓存（用户安装/卸载后调用）
 */
export function refreshMuggleCache(): void {
  _muggleDetectionCache = null
}

function getBundledPythonPath(): string | null {
  try {
    const { resolve, join } = require('path')
    const { existsSync } = require('fs')
    const { app } = require('electron')

    const isWin = process.platform === 'win32'
    const pyExe = isWin ? 'python.exe' : 'bin/python3'

    // 1. 打包模式 — 优先处理，避免 asar 内 __dirname 路径污染
    if (app?.isPackaged) {
      // 1a. 检查安装目录（如 resources/python-runtime/）
      const appRuntime = join(process.resourcesPath, '..', 'resources', 'python-runtime', pyExe)
      if (existsSync(appRuntime)) return appRuntime

      // 1b. 检查 userData（之前自动部署的结果）
      const userDataRuntime = join(app.getPath('userData'), 'python-runtime', pyExe)
      if (existsSync(userDataRuntime)) return userDataRuntime

      // 1c. 自动部署到 userData
      return deployBundledPython(pyExe, isWin)
    }

    // 2. 开发模式 — 两套路径（__dirname 取决于是否编译到 dist-electron/）
    //    Bundled: __dirname=dist-electron/
    const fromBundle = resolve(__dirname, '../resources/python-runtime', pyExe)
    if (existsSync(fromBundle)) return fromBundle
    //    Unbundled: __dirname=electron/backend/services/
    const fromDev = resolve(__dirname, '../../../resources/python-runtime', pyExe)
    if (existsSync(fromDev)) return fromDev

    return null
  } catch {
    return null
  }
}

/**
 * 在打包模式下自动部署便携 Python 运行时到 userData
 * 仅当安装包携带了 Python zip + whls 素材时执行
 */
function deployBundledPython(pyExe: string, isWin: boolean): string | null {
  try {
    const { join } = require('path')
    const { existsSync, mkdirSync, writeFileSync } = require('fs')
    const { execSync } = require('child_process')
    const { app } = require('electron')

    const pythonArchive = join(process.resourcesPath, 'python',
      isWin ? 'python-3.10.11-embed-amd64.zip' : 'cpython-3.10.15-x86_64-linux.tar.gz')
    const whlsDir = join(process.resourcesPath, 'python', 'whls')

    if (!existsSync(pythonArchive) || !existsSync(whlsDir)) {
      console.log('[python-runtime] 安装包未携带 Python 素材，跳过自动部署')
      return null
    }

    const userDataDir = join(app.getPath('userData'), 'python-runtime')
    const userDataPython = join(userDataDir, pyExe)

    // 避免重复部署
    if (existsSync(userDataPython)) return userDataPython

    console.log('[python-runtime] 开始自动部署到', userDataDir)
    mkdirSync(userDataDir, { recursive: true })

    if (isWin) {
      execSync(`powershell -Command "Expand-Archive -Path '${pythonArchive}' -DestinationPath '${userDataDir}' -Force"`, { stdio: 'pipe', timeout: 60000 })
      const pthFile = join(userDataDir, 'python310._pth')
      writeFileSync(pthFile, 'python310.zip\n.\nLib/site-packages\n\nimport site\n')
      const getPip = join(process.resourcesPath, 'python', 'get-pip.py')
      if (existsSync(getPip)) {
        execSync(`"${userDataPython}" "${getPip}" --no-index --find-links "${whlsDir}" --no-warn-script-location`, { stdio: 'pipe', timeout: 60000 })
      }
    } else {
      execSync(`tar xzf "${pythonArchive}" -C "${userDataDir}" --strip-components=1`, { stdio: 'pipe', timeout: 60000 })
      // cpython-standalone install_only 无 pip，离线引导
      try {
        execSync(`"${userDataPython}" -m ensurepip --default-pip`, { stdio: 'pipe', timeout: 30000 })
      } catch {
        const getPip = join(process.resourcesPath, 'python', 'get-pip.py')
        if (existsSync(getPip)) {
          execSync(`"${userDataPython}" "${getPip}" --no-index --find-links "${whlsDir}" --no-warn-script-location`, { stdio: 'pipe', timeout: 60000 })
        }
      }
    }

    execSync(`"${userDataPython}" -m pip install --no-index --find-links "${whlsDir}" numpy pillow opencv-python pyyaml tensorflow muggle_ocr`, { stdio: 'pipe', timeout: 300000 })

    if (existsSync(userDataPython)) {
      console.log('[python-runtime] 自动部署完成:', userDataPython)
      return userDataPython
    }

    return null
  } catch (e: any) {
    console.error('[python-runtime] 自动部署失败:', e.message || e)
    return null
  }
}

function getPythonCommand(): string | null {
  // 优先使用便携 Python 运行时（内网部署无需用户安装）
  const bundled = getBundledPythonPath()
  if (bundled) return bundled

  // 回退到系统 Python
  for (const cmd of ['python', 'python3']) {
    try {
      const { execSync } = require('child_process')
      execSync(`"${cmd}" --version`, { timeout: 3000, stdio: 'ignore' })
      return cmd
    } catch {
      // 继续尝试下一个
    }
  }
  return null
}

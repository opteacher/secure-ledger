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
 * 获取完整 OCR 配置（含可用性检测）
 */
export function getOcrConfig(): OcrConfig {
  const method = getOcrMethod()
  return {
    method,
    muggleAvailable: isMuggleAvailable(),
    mugglePythonPath: getMugglePythonPath(),
  }
}

/**
 * 检测 muggle_ocr 是否可用
 */
export function isMuggleAvailable(): boolean {
  return getMugglePythonPath() !== null
}

/**
 * 获取 muggle_ocr Python 路径（或 null 如果不可用）
 * 结果会缓存，避免每次识别都启动 Python 进程检测
 */
let _mugglePythonPathCache: { path: string; ts: number } | null = null

export function getMugglePythonPath(): string | null {
  // 命中缓存（30 秒内）直接返回
  if (_mugglePythonPathCache && Date.now() - _mugglePythonPathCache.ts < 30000) {
    return _mugglePythonPathCache.path
  }

  try {
    const { execSync } = require('child_process')
    const pythonCmd = getPythonCommand()
    if (!pythonCmd) return null

    execSync(`"${pythonCmd}" -c "import muggle_ocr"`, { timeout: 5000, stdio: 'ignore' })
    _mugglePythonPathCache = { path: pythonCmd, ts: Date.now() }
    return pythonCmd
  } catch {
    return null
  }
}

/**
 * 刷新 muggle_ocr 缓存（用户安装/卸载后调用）
 */
export function refreshMuggleCache(): void {
  _mugglePythonPathCache = null
}

function getBundledPythonPath(): string | null {
  try {
    const { resolve, join } = require('path')
    const { existsSync } = require('fs')
    const { app } = require('electron')

    const isWin = process.platform === 'win32'
    const pyExe = isWin ? 'python.exe' : 'bin/python3'

    // 1. 开发模式: 项目根 resources/python-runtime/
    const fromDev = resolve(__dirname, '../../../resources/python-runtime', pyExe)
    if (existsSync(fromDev)) return fromDev

    // 2. 打包后: 检查 app 目录 / userData，都没有则从素材自动部署
    if (app?.isPackaged) {
      const appRuntime = join(process.resourcesPath, '..', 'resources', 'python-runtime', pyExe)
      if (existsSync(appRuntime)) return appRuntime

      const userDataRuntime = join(app.getPath('userData'), 'python-runtime', pyExe)
      if (existsSync(userDataRuntime)) return userDataRuntime

      // 以上都没有 → 从安装包素材自动部署到 userData（仅一次）
      const pythonArchive = join(process.resourcesPath, 'python',
        isWin ? 'python-3.10.11-embed-amd64.zip' : 'cpython-3.10.15-x86_64-linux.tar.gz')
      const whlsDir = join(process.resourcesPath, 'python', 'whls')
      if (existsSync(pythonArchive) && existsSync(whlsDir)) {
        try {
          const { execSync } = require('child_process')
          const userDataDir = join(app.getPath('userData'), 'python-runtime')
          const userDataPython = join(userDataDir, pyExe)
          require('fs').mkdirSync(userDataDir, { recursive: true })

          if (isWin) {
            execSync(`powershell -Command "Expand-Archive -Path '${pythonArchive}' -DestinationPath '${userDataDir}' -Force"`, { stdio: 'ignore', timeout: 60000 })
            const pthFile = join(userDataDir, 'python310._pth')
            require('fs').writeFileSync(pthFile, 'python310.zip\n.\nLib/site-packages\n\nimport site\n')
            const getPip = join(process.resourcesPath, 'python', 'get-pip.py')
            if (existsSync(getPip)) {
              execSync(`"${userDataPython}" "${getPip}" --no-warn-script-location`, { stdio: 'ignore', timeout: 60000 })
            }
          } else {
            execSync(`tar xzf "${pythonArchive}" -C "${userDataDir}" --strip-components=1`, { stdio: 'ignore', timeout: 60000 })
          }
          execSync(`"${userDataPython}" -m pip install --no-index --find-links "${whlsDir}" numpy pillow opencv-python pyyaml tensorflow muggle_ocr`, { stdio: 'ignore', timeout: 300000 })

          if (existsSync(userDataPython)) return userDataPython
        } catch {
          // 静默回退
        }
      }
    }

    return null
  } catch {
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

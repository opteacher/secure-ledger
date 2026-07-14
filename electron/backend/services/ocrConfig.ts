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
let _mugglePythonPathCache: string | null | undefined = undefined

export function getMugglePythonPath(): string | null {
  if (_mugglePythonPathCache !== undefined) return _mugglePythonPathCache

  try {
    const { execSync } = require('child_process')
    const pythonCmd = getPythonCommand()
    if (!pythonCmd) {
      _mugglePythonPathCache = null
      return null
    }

    execSync(`"${pythonCmd}" -c "import muggle_ocr"`, { timeout: 5000, stdio: 'ignore' })
    _mugglePythonPathCache = pythonCmd
    return pythonCmd
  } catch {
    _mugglePythonPathCache = null
    return null
  }
}

/**
 * 刷新 muggle_ocr 缓存（用户安装/卸载后调用）
 */
export function refreshMuggleCache(): void {
  _mugglePythonPathCache = undefined
}

function getBundledPythonPath(): string | null {
  try {
    const { resolve, join } = require('path')
    const { existsSync } = require('fs')
    const { app } = require('electron')

    // 1. 开发模式: 项目根 resources/python-runtime/
    const fromDev = resolve(__dirname, '../resources/python-runtime/python.exe')
    if (existsSync(fromDev)) return fromDev

    // 2. 打包后: userData 目录下的 python-runtime/（首次启动时部署）
    if (app?.isPackaged) {
      const userDataRuntime = join(app.getPath('userData'), 'python-runtime', 'python.exe')
      if (existsSync(userDataRuntime)) return userDataRuntime

      // 3. 未部署 → 尝试从安装包素材自动部署到 userData
      const pythonZip = join(process.resourcesPath, 'python', 'python-3.10.11-embed-amd64.zip')
      const getPip = join(process.resourcesPath, 'python', 'get-pip.py')
      const whlsDir = join(process.resourcesPath, 'python', 'whls')
      if (existsSync(pythonZip) && existsSync(getPip) && existsSync(whlsDir)) {
        try {
          const { execSync } = require('child_process')
          const userDataDir = join(app.getPath('userData'), 'python-runtime')
          const userDataPython = join(userDataDir, 'python.exe')

          // 解压 Python
          require('fs').mkdirSync(userDataDir, { recursive: true })
          if (process.platform === 'win32') {
            execSync(`powershell -Command "Expand-Archive -Path '${pythonZip}' -DestinationPath '${userDataDir}' -Force"`, { stdio: 'ignore' })
          }
          // 配置 site
          require('fs').writeFileSync(join(userDataDir, 'python310._pth'), 'python310.zip\n.\nLib\\site-packages\n\nimport site\n')
          // 安装 pip + whl
          execSync(`"${userDataPython}" "${getPip}" --no-warn-script-location`, { stdio: 'ignore' })
          execSync(`"${userDataPython}" -m pip install --no-index --find-links "${whlsDir}" numpy pillow opencv-python pyyaml tensorflow muggle_ocr`, { stdio: 'ignore' })

          if (existsSync(userDataPython)) return userDataPython
        } catch {
          // 部署失败静默回退
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

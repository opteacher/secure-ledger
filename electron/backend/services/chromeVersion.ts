/**
 * Chrome 版本检测服务
 * 用于从浏览器可执行文件获取 Chrome 内核版本
 */
import { platform } from 'os'
import { execSync } from 'child_process'
import { existsSync } from 'fs'

export interface BrowserVersionInfo {
  path: string
  version: string | null
  majorVersion: number | null
  error?: string
}

// Chrome 版本切换阈值（低于此版本使用低版本 Puppeteer）
const CHROME_VERSION_THRESHOLD = 112

/**
 * 从浏览器可执行文件路径获取版本
 * 跨平台支持 Windows、Linux、macOS
 */
export function getBrowserVersion(browserPath: string): BrowserVersionInfo {
  if (!existsSync(browserPath)) {
    return {
      path: browserPath,
      version: null,
      majorVersion: null,
      error: 'Browser executable not found'
    }
  }

  const currentPlatform = platform()
  let version: string | null = null

  try {
    switch (currentPlatform) {
      case 'win32':
        version = getWindowsBrowserVersion(browserPath)
        break
      case 'darwin':
        version = getMacBrowserVersion(browserPath)
        break
      case 'linux':
        version = getLinuxBrowserVersion(browserPath)
        break
      default:
        return {
          path: browserPath,
          version: null,
          majorVersion: null,
          error: `Unsupported platform: ${currentPlatform}`
        }
    }
  } catch (e: any) {
    return {
      path: browserPath,
      version: null,
      majorVersion: null,
      error: e.message
    }
  }

  const majorVersion = parseMajorVersion(version)

  return {
    path: browserPath,
    version,
    majorVersion
  }
}

/**
 * Windows: 使用 wmic 或读取文件版本资源
 */
function getWindowsBrowserVersion(browserPath: string): string | null {
  try {
    // 方法1: 使用 wmic 获取文件版本
    const result = execSync(
      `wmic datafile where name="${browserPath.replace(/\\/g, '\\\\')}" get Version /value`,
      { encoding: 'utf-8', timeout: 10000 }
    )
    
    const match = result.match(/Version=([\d.]+)/)
    if (match) {
      return match[1]
    }
  } catch {
    // wmic 失败，尝试其他方法
  }

  try {
    // 方法2: 使用 PowerShell 读取文件版本
    const result = execSync(
      `powershell -Command "(Get-Item '${browserPath}').VersionInfo.FileVersion"`,
      { encoding: 'utf-8', timeout: 10000 }
    )
    
    const version = result.trim()
    if (version && version !== '0.0.0.0') {
      return version
    }
  } catch {
    // PowerShell 也失败了
  }

  try {
    // 方法3: 使用 --version 参数（某些浏览器支持）
    const result = execSync(
      `"${browserPath}" --version`,
      { encoding: 'utf-8', timeout: 5000 }
    )
    
    const match = result.match(/[\d.]+/)
    if (match) {
      return match[0]
    }
  } catch {
    // 所有方法都失败
  }

  return null
}

/**
 * macOS: 使用 mdls 或 --version
 */
function getMacBrowserVersion(browserPath: string): string | null {
  try {
    // 方法1: 使用 mdls 获取版本
    const result = execSync(
      `mdls -name kMDItemVersion "${browserPath}"`,
      { encoding: 'utf-8', timeout: 10000 }
    )
    
    const match = result.match(/kMDItemVersion = "(.+?)"/)
    if (match) {
      return match[1]
    }
  } catch {
    // mdls 失败
  }

  try {
    // 方法2: 读取 Info.plist
    // 对于 .app bundle，读取 Contents/Info.plist
    if (browserPath.endsWith('.app')) {
      const plistPath = `${browserPath}/Contents/Info.plist`
      const result = execSync(
        `/usr/libexec/PlistBuddy -c "Print CFBundleShortVersionString" "${plistPath}"`,
        { encoding: 'utf-8', timeout: 10000 }
      )
      
      const version = result.trim()
      if (version) {
        return version
      }
    }
  } catch {
    // PlistBuddy 失败
  }

  try {
    // 方法3: 使用 --version
    const result = execSync(
      `"${browserPath}" --version`,
      { encoding: 'utf-8', timeout: 5000 }
    )
    
    const match = result.match(/[\d.]+/)
    if (match) {
      return match[0]
    }
  } catch {
    // 所有方法都失败
  }

  return null
}

/**
 * Linux: 使用 --version 或解析包管理器信息
 */
function getLinuxBrowserVersion(browserPath: string): string | null {
  try {
    // 方法1: 使用 --version
    const result = execSync(
      `"${browserPath}" --version`,
      { encoding: 'utf-8', timeout: 5000 }
    )
    
    // Chrome/Chromium 通常输出类似: Google Chrome 127.0.6533.88
    const match = result.match(/[\d.]+/)
    if (match) {
      return match[0]
    }
  } catch {
    // --version 失败
  }

  try {
    // 方法2: 对于 snap 安装的浏览器
    if (browserPath.startsWith('/snap/')) {
      const snapName = browserPath.split('/')[2]
      const result = execSync(
        `snap info ${snapName} | grep installed`,
        { encoding: 'utf-8', timeout: 5000 }
      )
      
      const match = result.match(/installed:\s*([\d.]+)/)
      if (match) {
        return match[1]
      }
    }
  } catch {
    // snap info 失败
  }

  return null
}

/**
 * 解析主版本号
 */
function parseMajorVersion(version: string | null): number | null {
  if (!version) return null
  
  const parts = version.split('.')
  if (parts.length > 0) {
    const major = parseInt(parts[0], 10)
    return isNaN(major) ? null : major
  }
  
  return null
}

/**
 * 根据版本决定使用哪个 Puppeteer 版本
 * @returns 'high' | 'low'
 */
export function decidePuppeteerVersion(
  majorVersion: number | null,
  userPreference: 'auto' | 'high' | 'low' = 'auto'
): 'high' | 'low' {
  // 用户明确指定，优先使用用户选择
  if (userPreference === 'high') return 'high'
  if (userPreference === 'low') return 'low'
  
  // 自动模式：根据版本判断
  if (majorVersion === null) {
    // 无法检测版本，默认使用高版本
    console.log('[PuppeteerManager] Cannot detect Chrome version, using high version by default')
    return 'high'
  }
  
  if (majorVersion < CHROME_VERSION_THRESHOLD) {
    console.log(`[PuppeteerManager] Chrome ${majorVersion} < ${CHROME_VERSION_THRESHOLD}, using low version Puppeteer`)
    return 'low'
  }
  
  console.log(`[PuppeteerManager] Chrome ${majorVersion} >= ${CHROME_VERSION_THRESHOLD}, using high version Puppeteer`)
  return 'high'
}

/**
 * 批量检测浏览器版本
 */
export function detectBrowserVersions(browserPaths: string[]): Map<string, BrowserVersionInfo> {
  const results = new Map<string, BrowserVersionInfo>()
  
  for (const path of browserPaths) {
    results.set(path, getBrowserVersion(path))
  }
  
  return results
}

// 导出阈值常量供其他模块使用
export { CHROME_VERSION_THRESHOLD }
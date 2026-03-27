import { platform } from 'os'
import * as fs from 'fs'
import { execSync } from 'child_process'

// Chrome 安装路径映射（静态路径作为后备）
const CHROME_PATHS: Record<string, string[]> = {
  win32: [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  ],
  darwin: [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
  ],
  linux: [
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/google-chrome-beta',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/microsoft-edge-stable',
    '/usr/bin/microsoft-edge',
    '/opt/microsoft/msedge/msedge',
    '/snap/bin/chromium',
    '/snap/bin/google-chrome',
    // Flatpak 路径
    '/var/lib/flatpak/exports/bin/com.google.Chrome',
    '/var/lib/flatpak/exports/bin/org.chromium.Chromium',
    '/var/lib/flatpak/exports/bin/com.microsoft.Edge',
    // Chrome 特定安装路径（国产系统应用商店安装）
    '/opt/apps/cn.google.chrome/files/google-chrome',
  ]
}

export interface ChromeInfo {
  name: string
  path: string
  version?: string
}

// Linux 浏览器命令名列表（使用精确的命令名，避免误判）
const LINUX_BROWSER_COMMANDS = [
  'google-chrome',
  'google-chrome-stable',
  'google-chrome-beta',
  'chromium',
  'chromium-browser',
  'microsoft-edge-stable',
  'microsoft-edge-beta',
  'microsoft-edge',
]

// 通过 which 命令查找浏览器
function findBrowserByWhich(browserName: string): string | null {
  try {
    const result = execSync(`which ${browserName} 2>/dev/null`, { 
      encoding: 'utf-8',
      timeout: 5000 
    }).trim()
    if (result && fs.existsSync(result)) {
      // 验证是否为真正的浏览器（检查是否为符号链接指向真实浏览器）
      return validateBrowserPath(result)
    }
  } catch {
    // 未找到
  }
  return null
}

// 验证浏览器路径是否有效
function validateBrowserPath(path: string): string | null {
  try {
    // 检查文件是否存在且可执行
    if (!fs.existsSync(path)) return null
    
    // 获取实际路径（解析符号链接）
    let realPath = path
    try {
      const fsStat = fs.lstatSync(path)
      if (fsStat.isSymbolicLink()) {
        realPath = fs.realpathSync(path)
      }
    } catch {
      // 忽略错误
    }
    
    // 检查文件名是否包含浏览器关键词
    const lowerPath = realPath.toLowerCase()
    const validBrowserKeywords = ['chrome', 'chromium', 'edge', 'msedge']
    const isValidBrowser = validBrowserKeywords.some(keyword => lowerPath.includes(keyword))
    
    if (!isValidBrowser) {
      return null
    }
    
    return path
  } catch {
    return null
  }
}

// Windows: 通过 where 命令查找浏览器
function findBrowserByWhere(browserName: string): string | null {
  try {
    const result = execSync(`where ${browserName} 2>nul`, { 
      encoding: 'utf-8',
      timeout: 5000 
    }).trim().split('\n')[0]
    if (result && fs.existsSync(result)) {
      return result
    }
  } catch {
    // 未找到
  }
  return null
}

// 获取浏览器名称
function getBrowserName(path: string): string {
  const lowerPath = path.toLowerCase()
  if (lowerPath.includes('edge') || lowerPath.includes('msedge')) {
    return 'Microsoft Edge'
  } else if (lowerPath.includes('chromium')) {
    return 'Chromium'
  } else if (lowerPath.includes('chrome')) {
    return 'Google Chrome'
  }
  return 'Browser'
}

// 检测已安装的 Chrome/Edge/Chromium
export function detectChrome(): ChromeInfo[] {
  const currentPlatform = platform()
  const results: ChromeInfo[] = []
  const foundPaths = new Set<string>()

  // Windows 特殊处理
  if (currentPlatform === 'win32') {
    // 通过 where 命令动态查找
    const whereCommands = ['chrome.exe', 'msedge.exe']
    for (const cmd of whereCommands) {
      const found = findBrowserByWhere(cmd)
      if (found && !foundPaths.has(found)) {
        foundPaths.add(found)
        results.push({
          name: getBrowserName(found),
          path: found,
          version: undefined
        })
      }
    }
    
    // 检查 LOCALAPPDATA 路径
    const localAppData = process.env.LOCALAPPDATA
    if (localAppData) {
      const localPaths = [
        `${localAppData}\\Google\\Chrome\\Application\\chrome.exe`,
        `${localAppData}\\Microsoft\\Edge\\Application\\msedge.exe`
      ]
      for (const localPath of localPaths) {
        if (fs.existsSync(localPath) && !foundPaths.has(localPath)) {
          foundPaths.add(localPath)
          results.push({
            name: getBrowserName(localPath),
            path: localPath,
            version: undefined
          })
        }
      }
    }
  }
  
  // Linux 特殊处理：通过 which 命令动态查找
  if (currentPlatform === 'linux') {
    // 通过 which 查找
    for (const cmd of LINUX_BROWSER_COMMANDS) {
      const found = findBrowserByWhich(cmd)
      if (found && !foundPaths.has(found)) {
        foundPaths.add(found)
        results.push({
          name: getBrowserName(found),
          path: found,
          version: undefined
        })
      }
    }
    
    // 检查用户目录下的浏览器
    const home = process.env.HOME
    if (home) {
      const userPaths = [
        `${home}/.local/bin/google-chrome`,
        `${home}/.local/bin/chromium`,
        `${home}/.local/bin/microsoft-edge`,
        // Flatpak 用户安装
        `${home}/.local/share/flatpak/exports/bin/com.google.Chrome`,
        `${home}/.local/share/flatpak/exports/bin/org.chromium.Chromium`,
        `${home}/.local/share/flatpak/exports/bin/com.microsoft.Edge`,
      ]
      
      for (const userPath of userPaths) {
        if (fs.existsSync(userPath) && !foundPaths.has(userPath)) {
          foundPaths.add(userPath)
          results.push({
            name: getBrowserName(userPath),
            path: userPath,
            version: undefined
          })
        }
      }
    }
  }

  // 检查静态路径
  const paths = CHROME_PATHS[currentPlatform] || []
  for (const chromePath of paths) {
    try {
      // 跳过包含 undefined 的路径
      if (!chromePath || chromePath.includes('undefined')) continue
      
      // 检查文件是否存在
      if (!fs.existsSync(chromePath)) continue
      
      // 去重
      if (foundPaths.has(chromePath)) continue
      foundPaths.add(chromePath)

      results.push({
        name: getBrowserName(chromePath),
        path: chromePath,
        version: undefined
      })
    } catch {
      // 忽略错误，继续检查下一个
    }
  }

  return results
}
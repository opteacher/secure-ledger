/**
 * Chromium 便携版管理服务
 * 负责解压、注册 Chromium 浏览器
 * 
 * 使用 Chrome for Testing（Puppeteer 22+ 兼容版本）
 */
import { app, BrowserWindow } from 'electron'
import { join } from 'path'
import { existsSync, mkdirSync } from 'fs'
import { platform, arch } from 'os'
import { execSync } from 'child_process'
import { addBrowser, getBrowserList, deleteBrowser } from './browser'

// Chrome for Testing 版本
const CHROME_VERSION = '127.0.6533.88'

// Chrome for Testing 配置（匹配实际下载的文件结构）
const CHROME_CONFIGS: Record<string, { fileName: string; exePath: string }> = {
  'win32-x64': {
    fileName: 'chrome-win64.zip',
    exePath: 'chrome-win64/chrome.exe'
  },
  'linux-x64': {
    fileName: 'chrome-linux64.zip',
    exePath: 'chrome-linux64/chrome'
  },
  'darwin-x64': {
    fileName: 'chrome-mac-x64.zip',
    exePath: 'chrome-mac-x64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'
  },
  'darwin-arm64': {
    fileName: 'chrome-mac-arm64.zip',
    exePath: 'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'
  }
}

// 安装进度
export interface InstallProgress {
  stage: 'extracting' | 'registering' | 'done' | 'error'
  percent: number
  message: string
}

/**
 * 获取当前平台的 Chrome 配置
 */
function getPlatformConfig(): { fileName: string; exePath: string } | null {
  const currentPlatform = platform()
  const currentArch = arch()
  const key = `${currentPlatform}-${currentArch}`
  return CHROME_CONFIGS[key] || null
}

/**
 * 获取打包的 Chrome 压缩包路径
 */
function getBundledChromePath(): string | null {
  const config = getPlatformConfig()
  if (!config) return null
  
  const isDev = process.env['VITE_DEV_SERVER_URL']
  
  // 开发环境：从项目根目录的 chromiums 文件夹读取
  // 打包后：从 resources/chromiums 读取
  const possiblePaths: string[] = []
  
  if (isDev) {
    // 开发环境，多种可能的路径
    possiblePaths.push(
      join(__dirname, '..', '..', '..', 'chromiums', config.fileName),
      join(process.cwd(), 'chromiums', config.fileName)
    )
  } else {
    possiblePaths.push(
      join(process.resourcesPath, 'chromiums', config.fileName)
    )
  }
  
  for (const p of possiblePaths) {
    console.log('Checking Chrome bundle path:', p)
    if (existsSync(p)) {
      console.log('Found Chrome bundle:', p)
      return p
    }
  }
  
  return null
}

/**
 * 获取用户数据目录中的 Chrome 路径（安装目标）
 */
function getUserDataChromePath(): string {
  const config = getPlatformConfig()
  if (!config) {
    throw new Error(`Unsupported platform: ${platform()}-${arch()}`)
  }
  
  return join(app.getPath('userData'), 'chromium', config.exePath)
}

/**
 * 获取已安装的 Chrome 可执行文件路径
 */
export function getInstalledChromePath(): string | null {
  const chromePath = getUserDataChromePath()
  if (existsSync(chromePath)) {
    return chromePath
  }
  return null
}

/**
 * 检查 Chrome 是否已安装
 */
export function isChromeInstalled(): boolean {
  return getInstalledChromePath() !== null
}

/**
 * 解压 ZIP 文件
 */
async function extractZip(zipPath: string, destDir: string): Promise<void> {
  const extract = require('extract-zip')
  
  try {
    await extract(zipPath, { dir: destDir })
  } catch (e: any) {
    // 如果 extract-zip 失败，尝试使用系统工具
    if (platform() === 'win32') {
      // Windows: 使用 PowerShell
      execSync(`powershell -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${destDir}' -Force"`, {
        timeout: 300000 // 5分钟超时
      })
    } else {
      // Linux/macOS: 使用 unzip
      execSync(`unzip -o "${zipPath}" -d "${destDir}"`, { timeout: 300000 })
    }
  }
}

/**
 * 设置文件可执行权限（Linux/macOS）
 */
function setExecutablePermissions(dir: string): void {
  if (platform() === 'win32') return
  
  try {
    execSync(`chmod -R +x "${dir}"`)
  } catch (e) {
    console.warn('Failed to set executable permissions:', e)
  }
}

/**
 * 发送进度事件到渲染进程
 */
function sendProgress(progress: InstallProgress): void {
  const win = BrowserWindow.getFocusedWindow()
  if (win && !win.isDestroyed()) {
    win.webContents.send('chromium:install:progress', progress)
  }
  console.log(`Chrome install: ${progress.stage} - ${progress.percent}% - ${progress.message}`)
}

/**
 * 注册 Chrome 到浏览器列表
 */
export function registerChrome(): { success: boolean; message: string } {
  const chromePath = getInstalledChromePath()
  
  if (!chromePath) {
    return { success: false, message: 'Chrome 未安装' }
  }
  
  // 检查是否已注册
  const existing = getBrowserList()
  const alreadyRegistered = existing.some(b => b.path === chromePath)
  
  if (alreadyRegistered) {
    return { success: true, message: 'Chrome 已在浏览器列表中' }
  }
  
  // 添加到数据库
  try {
    addBrowser('Chromium', chromePath)
    return { success: true, message: 'Chrome 已添加到浏览器列表' }
  } catch (e: any) {
    return { success: false, message: `注册失败: ${e.message}` }
  }
}

/**
 * 从浏览器列表移除 Chrome
 */
export function unregisterChrome(): { success: boolean; message: string } {
  const chromePath = getInstalledChromePath()
  
  if (!chromePath) {
    return { success: false, message: 'Chrome 未安装' }
  }
  
  const existing = getBrowserList()
  const chromeBrowser = existing.find(b => b.path === chromePath)
  
  if (!chromeBrowser) {
    return { success: true, message: 'Chrome 不在浏览器列表中' }
  }
  
  try {
    deleteBrowser(chromeBrowser.id)
    return { success: true, message: 'Chrome 已从浏览器列表移除' }
  } catch (e: any) {
    return { success: false, message: `移除失败: ${e.message}` }
  }
}

/**
 * 安装 Chrome（从打包的压缩包解压）
 */
export async function installChrome(): Promise<{ success: boolean; message: string }> {
  const config = getPlatformConfig()
  
  if (!config) {
    return { success: false, message: `不支持的平台: ${platform()}-${arch()}` }
  }
  
  try {
    // 检查是否已安装
    if (isChromeInstalled()) {
      sendProgress({ stage: 'done', percent: 100, message: 'Chrome 已安装' })
      registerChrome()
      return { success: true, message: 'Chrome 已安装' }
    }
    
    // 获取压缩包路径
    const zipPath = getBundledChromePath()
    
    if (!zipPath) {
      return { success: false, message: '未找到 Chrome 安装包，请确保 chromiums 目录中存在对应的 zip 文件' }
    }
    
    // 准备目录
    const userDataDir = join(app.getPath('userData'), 'chromium')
    if (!existsSync(userDataDir)) {
      mkdirSync(userDataDir, { recursive: true })
    }
    
    // 解压
    sendProgress({ stage: 'extracting', percent: 0, message: '正在解压 Chrome...' })
    
    try {
      await extractZip(zipPath, userDataDir)
      sendProgress({ stage: 'extracting', percent: 100, message: '解压完成' })
    } catch (extractError: any) {
      sendProgress({ stage: 'error', percent: 0, message: extractError.message })
      return { success: false, message: `解压失败: ${extractError.message}` }
    }
    
    // 设置可执行权限
    setExecutablePermissions(userDataDir)
    
    // 注册到浏览器列表
    sendProgress({ stage: 'registering', percent: 0, message: '正在注册 Chrome...' })
    
    const registerResult = registerChrome()
    
    sendProgress({ stage: 'done', percent: 100, message: 'Chrome 安装完成' })
    
    return { success: true, message: 'Chrome 安装成功' }
  } catch (error: any) {
    sendProgress({ stage: 'error', percent: 0, message: error.message })
    return { success: false, message: `安装失败: ${error.message}` }
  }
}

/**
 * 卸载 Chrome
 */
export function uninstallChrome(): { success: boolean; message: string } {
  try {
    // 先从浏览器列表移除
    unregisterChrome()
    
    // 删除文件
    const chromeDir = join(app.getPath('userData'), 'chromium')
    if (existsSync(chromeDir)) {
      if (platform() === 'win32') {
        execSync(`rmdir /s /q "${chromeDir}"`, { timeout: 60000 })
      } else {
        execSync(`rm -rf "${chromeDir}"`, { timeout: 60000 })
      }
    }
    
    return { success: true, message: 'Chrome 已卸载' }
  } catch (error: any) {
    return { success: false, message: `卸载失败: ${error.message}` }
  }
}

/**
 * 获取 Chrome 安装状态
 */
export function getChromeStatus(): {
  installed: boolean
  path: string | null
  registered: boolean
  platform: string
} {
  const path = getInstalledChromePath()
  const installed = path !== null
  
  let registered = false
  if (installed) {
    const existing = getBrowserList()
    registered = existing.some(b => b.path === path)
  }
  
  return {
    installed,
    path,
    registered,
    platform: `${platform()}-${arch()}`
  }
}

/**
 * 确保 Chrome 可用（检测并安装）
 */
export async function ensureChrome(): Promise<{ installed: boolean; message: string }> {
  const status = getChromeStatus()
  
  if (status.installed) {
    if (!status.registered) {
      registerChrome()
    }
    return { installed: true, message: 'Chrome 已就绪' }
  }
  
  // 需要安装
  const result = await installChrome()
  return { installed: result.success, message: result.message }
}

// 兼容旧名称
export const getInstalledChromiumPath = getInstalledChromePath
export const isChromiumInstalled = isChromeInstalled
export const registerChromium = registerChrome
export const unregisterChromium = unregisterChrome
export const installChromium = installChrome
export const uninstallChromium = uninstallChrome
export const getChromiumStatus = getChromeStatus
export const ensureChromium = ensureChrome
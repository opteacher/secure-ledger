/**
 * Puppeteer 版本管理服务
 * 负责动态加载和切换不同版本的 Puppeteer
 */
import { getBrowserVersion, decidePuppeteerVersion, type BrowserVersionInfo } from './chromeVersion'

// Puppeteer 版本类型
export type PuppeteerVersion = 'high' | 'low'

// 缓存已加载的 Puppeteer 实例
const puppeteerCache: Map<PuppeteerVersion, any> = new Map()

// 版本信息
export const PUPPETEER_VERSIONS = {
  high: {
    package: 'puppeteer-core',
    minChrome: 112,
    description: 'Puppeteer 22.x (Chrome 112+)'
  },
  low: {
    package: 'puppeteer-core-legacy',
    minChrome: 90,
    description: 'Puppeteer 13.7.0 (Chrome 90-111)'
  }
} as const

/**
 * 获取指定版本的 Puppeteer
 */
export async function getPuppeteer(version: PuppeteerVersion): Promise<any> {
  // 检查缓存
  if (puppeteerCache.has(version)) {
    return puppeteerCache.get(version)!
  }
  
  const packageName = PUPPETEER_VERSIONS[version].package
  
  try {
    // 动态导入
    const puppeteer = await import(packageName)
    puppeteerCache.set(version, puppeteer.default || puppeteer)
    console.log(`[PuppeteerManager] Loaded ${packageName}`)
    return puppeteerCache.get(version)!
  } catch (e: any) {
    console.error(`[PuppeteerManager] Failed to load ${packageName}:`, e.message)
    throw new Error(`Failed to load ${packageName}: ${e.message}`)
  }
}

/**
 * 获取浏览器版本并决定使用的 Puppeteer 版本
 */
export function analyzeBrowserForPuppeteer(
  browserPath: string,
  userPreference: 'auto' | 'high' | 'low' = 'auto'
): {
  versionInfo: BrowserVersionInfo
  puppeteerVersion: PuppeteerVersion
  decision: string
} {
  // 获取浏览器版本
  const versionInfo = getBrowserVersion(browserPath)
  
  // 决定使用的 Puppeteer 版本
  const puppeteerVersion = decidePuppeteerVersion(
    versionInfo.majorVersion,
    userPreference
  )
  
  // 生成决策说明
  let decision = ''
  if (userPreference !== 'auto') {
    decision = `用户指定使用${userPreference === 'high' ? '高' : '低'}版本 Puppeteer`
  } else if (versionInfo.majorVersion === null) {
    decision = `无法检测浏览器版本，默认使用高版本 Puppeteer`
  } else if (puppeteerVersion === 'low') {
    decision = `Chrome ${versionInfo.majorVersion} < 112，使用低版本 Puppeteer (13.7.0)`
  } else {
    decision = `Chrome ${versionInfo.majorVersion} >= 112，使用高版本 Puppeteer (22.x)`
  }
  
  return {
    versionInfo,
    puppeteerVersion,
    decision
  }
}

/**
 * 连接到现有浏览器实例（通过 WebSocket endpoint）
 * 用于复用已开启的浏览器
 */
export async function connectToExistingBrowser(
  wsEndpoint: string,
  options: any = {}
): Promise<{
  browser: any
  puppeteerVersion: PuppeteerVersion
  isConnected: boolean
}> {
  console.log(`[PuppeteerManager] Connecting to existing browser: ${wsEndpoint}`)
  
  // 从 WebSocket URL 提取浏览器 URL
  let browserUrl: string | undefined
  try {
    const url = new URL(wsEndpoint)
    browserUrl = `http://${url.host}`
    console.log(`[PuppeteerManager] Extracted browser URL: ${browserUrl}`)
  } catch (e) {
    console.log(`[PuppeteerManager] Failed to parse WebSocket URL, using as-is`)
  }
  
  // 尝试高版本 Puppeteer
  try {
    const puppeteer = await getPuppeteer('high')
    console.log(`[PuppeteerManager] Trying high version Puppeteer...`)
    
    // 方式1: 使用 browserWSEndpoint
    try {
      const browser = await puppeteer.connect({
        browserWSEndpoint: wsEndpoint,
        defaultViewport: null,
        ignoreHTTPSErrors: true,
        ...options
      })
      
      console.log(`[PuppeteerManager] Connected successfully with browserWSEndpoint`)
      return {
        browser,
        puppeteerVersion: 'high',
        isConnected: true
      }
    } catch (wsError: any) {
      console.log(`[PuppeteerManager] browserWSEndpoint failed: ${wsError.message}`)
      
      // 方式2: 尝试使用 browserURL
      if (browserUrl) {
        console.log(`[PuppeteerManager] Trying browserURL: ${browserUrl}`)
        const browser = await puppeteer.connect({
          browserURL: browserUrl,
          defaultViewport: null,
          ignoreHTTPSErrors: true,
          ...options
        })
        
        console.log(`[PuppeteerManager] Connected successfully with browserURL`)
        return {
          browser,
          puppeteerVersion: 'high',
          isConnected: true
        }
      }
      
      throw wsError
    }
  } catch (highVersionError: any) {
    console.log(`[PuppeteerManager] High version connect failed: ${highVersionError.message}`)
    
    // 尝试低版本 Puppeteer
    try {
      const puppeteer = await getPuppeteer('low')
      console.log(`[PuppeteerManager] Trying low version Puppeteer...`)
      
      const browser = await puppeteer.connect({
        browserWSEndpoint: wsEndpoint,
        defaultViewport: null,
        ignoreHTTPSErrors: true,
        ...options
      })
      
      console.log(`[PuppeteerManager] Connected successfully with low version Puppeteer`)
      return {
        browser,
        puppeteerVersion: 'low',
        isConnected: true
      }
    } catch (lowVersionError: any) {
      console.error(`[PuppeteerManager] Low version also failed: ${lowVersionError.message}`)
      
      // 提供更详细的错误信息
      const isNotAllowed = highVersionError.message.includes('Not allowed') || 
                          highVersionError.message.includes('Protocol error')
      const errorMsg = isNotAllowed
        ? `无法连接浏览器：${highVersionError.message}\n\n请确保浏览器启动时包含参数：--remote-allow-origins=*`
        : `连接浏览器失败: ${highVersionError.message}`
      
      throw new Error(errorMsg)
    }
  }
}

/**
 * 启动浏览器（自动选择合适的 Puppeteer 版本）
 */
export async function launchBrowser(
  browserPath: string,
  userPreference: 'auto' | 'high' | 'low' = 'auto',
  options: any = {}
): Promise<{
  browser: any
  puppeteerVersion: PuppeteerVersion
  versionInfo: BrowserVersionInfo
}> {
  // 分析浏览器版本
  const { versionInfo, puppeteerVersion } = analyzeBrowserForPuppeteer(
    browserPath,
    userPreference
  )
  
  console.log(`[PuppeteerManager] Launching browser with Puppeteer ${puppeteerVersion}`)
  console.log(`[PuppeteerManager] Browser: ${browserPath}`)
  console.log(`[PuppeteerManager] Chrome version: ${versionInfo.version || 'unknown'}`)
  
  // 获取对应的 Puppeteer
  const puppeteer = await getPuppeteer(puppeteerVersion)
  
  // 使用传入的 args 或默认 args
  const launchArgs = options.args || [
    '--start-maximized',
    '--disable-blink-features=AutomationControlled',
  ]
  
  // 默认启动选项
  const launchOptions = {
    executablePath: browserPath,
    headless: false,
    defaultViewport: null,
    args: launchArgs,
    ignoreDefaultArgs: ['--enable-automation'],
    ignoreHTTPSErrors: true,
  }
  
  // 打印完整启动参数用于调试
  console.log(`[PuppeteerManager] Launch args:`, launchArgs)
  
  // 启动浏览器
  const browser = await puppeteer.launch(launchOptions)
  
  return {
    browser,
    puppeteerVersion,
    versionInfo
  }
}

/**
 * 清除 Puppeteer 缓存
 */
export function clearPuppeteerCache(): void {
  puppeteerCache.clear()
  console.log('[PuppeteerManager] Cache cleared')
}

/**
 * 获取已加载的版本
 */
export function getLoadedVersions(): PuppeteerVersion[] {
  return Array.from(puppeteerCache.keys())
}
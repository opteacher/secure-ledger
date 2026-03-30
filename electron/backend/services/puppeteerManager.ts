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
  
  // 默认启动选项
  const launchOptions = {
    executablePath: browserPath,
    headless: false,
    defaultViewport: null,
    args: [
      '--start-maximized',
      '--disable-blink-features=AutomationControlled',
    ],
    ignoreDefaultArgs: ['--enable-automation'],
    ignoreHTTPSErrors: true,
    ...options
  }
  
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
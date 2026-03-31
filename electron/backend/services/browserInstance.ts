/**
 * 浏览器实例检测服务
 * 通过 Chrome DevTools Protocol 检测现有浏览器实例
 */

// Chrome DevTools Protocol 默认端口
const DEFAULT_DEBUG_PORT = 9222

// 实例信息接口
export interface BrowserInstanceInfo {
  available: boolean
  port: number
  wsEndpoint?: string
  pages?: BrowserPageInfo[]
  error?: string
}

// 页面信息接口
export interface BrowserPageInfo {
  id: string
  url: string
  title: string
  type: string
}

/**
 * 检测指定端口是否有 Chrome DevTools Protocol 实例
 * @param port Chrome 调试端口，默认 9222
 * @returns 浏览器实例信息
 */
export async function checkBrowserInstance(port: number = DEFAULT_DEBUG_PORT): Promise<BrowserInstanceInfo> {
  const debugUrl = `http://127.0.0.1:${port}/json`
  const versionUrl = `http://127.0.0.1:${port}/json/version`
  
  try {
    console.log(`[BrowserInstance] Checking instance at ${debugUrl}`)
    
    // 先获取浏览器版本信息（包含 WebSocket URL）
    const versionResponse = await fetch(versionUrl, {
      method: 'GET',
      signal: AbortSignal.timeout(3000)
    })
    
    if (!versionResponse.ok) {
      console.log(`[BrowserInstance] Version endpoint failed: ${versionResponse.status}`)
      return {
        available: false,
        port,
        error: `Version endpoint not available`
      }
    }
    
    const versionInfo = await versionResponse.json()
    console.log(`[BrowserInstance] Version info:`, versionInfo)
    
    // 从 version 接口获取 WebSocket URL（这是连接 browser 的正确 URL）
    const wsEndpoint = versionInfo.webSocketDebuggerUrl
    
    if (!wsEndpoint) {
      console.log(`[BrowserInstance] No WebSocket URL in version response`)
      return {
        available: false,
        port,
        error: 'No WebSocket URL found'
      }
    }
    
    // 获取页面列表
    const targetsResponse = await fetch(debugUrl, {
      method: 'GET',
      signal: AbortSignal.timeout(3000)
    })
    
    const pages: BrowserPageInfo[] = []
    if (targetsResponse.ok) {
      const targets = await targetsResponse.json()
      for (const target of targets) {
        if (target.type === 'page') {
          pages.push({
            id: target.id || '',
            url: target.url || '',
            title: target.title || '',
            type: target.type
          })
        }
      }
    }
    
    console.log(`[BrowserInstance] Found instance at port ${port} with ${pages.length} pages, wsEndpoint: ${wsEndpoint}`)
    
    return {
      available: true,
      port,
      wsEndpoint,
      pages
    }
    
  } catch (error: any) {
    // 连接失败表示没有实例
    if (error.name === 'AbortError' || error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      console.log(`[BrowserInstance] No instance at port ${port}: ${error.message}`)
      return {
        available: false,
        port,
        error: 'No browser instance found'
      }
    }
    
    // 其他错误
    console.error(`[BrowserInstance] Check failed: ${error.message}`)
    return {
      available: false,
      port,
      error: error.message
    }
  }
}

/**
 * 检测多个常见端口
 * Chrome 通常使用 9222, 9223, 9229 等
 * @returns 所有可用实例列表
 */
export async function checkMultiplePorts(): Promise<BrowserInstanceInfo[]> {
  const commonPorts = [9222, 9223, 9229, 9230]
  const results: BrowserInstanceInfo[] = []
  
  for (const port of commonPorts) {
    const info = await checkBrowserInstance(port)
    if (info.available) {
      results.push(info)
    }
  }
  
  return results
}

/**
 * 获取最优实例（优先选择有页面的实例）
 * @param port 指定端口，或自动检测
 * @returns 最优实例信息
 */
export async function getBestInstance(port?: number): Promise<BrowserInstanceInfo | null> {
  if (port) {
    const info = await checkBrowserInstance(port)
    return info.available ? info : null
  }
  
  // 自动检测多个端口
  const instances = await checkMultiplePorts()
  
  if (instances.length === 0) {
    return null
  }
  
  // 优先选择有页面的实例
  const withPages = instances.filter(i => i.pages && i.pages.length > 0)
  if (withPages.length > 0) {
    return withPages[0]
  }
  
  // 否则返回第一个可用实例
  return instances[0]
}

/**
 * 验证 WebSocket endpoint 是否可用
 * @param wsEndpoint WebSocket URL
 * @returns 是否可用
 */
export async function validateWsEndpoint(wsEndpoint: string): Promise<boolean> {
  try {
    // 尝试连接 WebSocket（使用简单 ping）
    const url = new URL(wsEndpoint)
    const testUrl = `http://${url.host}/json/list`
    
    const response = await fetch(testUrl, {
      method: 'GET',
      signal: AbortSignal.timeout(2000)
    })
    
    return response.ok
  } catch {
    return false
  }
}
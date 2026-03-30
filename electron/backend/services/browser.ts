import { run, query } from '../database'
import { detectChrome, type ChromeInfo } from './chrome'
import { getInstalledChromePath, registerChrome } from './chromium'
import { getBrowserVersion, type BrowserVersionInfo } from './chromeVersion'

export interface BrowserConfig {
  id: number
  name: string
  path: string
  is_enabled: boolean
  puppeteer_version: 'auto' | 'high' | 'low'  // 'auto' | 'high' | 'low'
  chrome_version: string | null  // 检测到的 Chrome 内核版本
  created_at: string
  updated_at: string
}

// 获取用户配置的浏览器列表
export function getBrowserList(): BrowserConfig[] {
  return query<BrowserConfig>('SELECT * FROM browser ORDER BY created_at ASC')
}

// 获取启用的浏览器列表
export function getEnabledBrowsers(): BrowserConfig[] {
  return query<BrowserConfig>('SELECT * FROM browser WHERE is_enabled = 1 ORDER BY created_at ASC')
}

// 添加浏览器
export function addBrowser(name: string, path: string): BrowserConfig {
  // 尝试检测浏览器版本
  const versionInfo = getBrowserVersion(path)
  
  const result = run(
    'INSERT INTO browser (name, path, is_enabled, puppeteer_version, chrome_version) VALUES (?, ?, 1, ?, ?)',
    [name, path, 'auto', versionInfo.version || null]
  )
  return {
    id: result.lastInsertRowid,
    name,
    path,
    is_enabled: true,
    puppeteer_version: 'auto',
    chrome_version: versionInfo.version || null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
}

// 删除浏览器
export function deleteBrowser(id: number): boolean {
  const result = run('DELETE FROM browser WHERE id = ?', [id])
  return result.changes > 0
}

// 更新浏览器状态
export function updateBrowserStatus(id: number, isEnabled: boolean): boolean {
  const result = run(
    'UPDATE browser SET is_enabled = ?, updated_at = ? WHERE id = ?',
    [isEnabled ? 1 : 0, new Date().toISOString(), id]
  )
  return result.changes > 0
}

// 更新浏览器信息
export function updateBrowser(id: number, name: string, path: string): boolean {
  // 重新检测版本
  const versionInfo = getBrowserVersion(path)
  
  const result = run(
    'UPDATE browser SET name = ?, path = ?, chrome_version = ?, updated_at = ? WHERE id = ?',
    [name, path, versionInfo.version || null, new Date().toISOString(), id]
  )
  return result.changes > 0
}

// 更新浏览器的 Puppeteer 版本设置
export function updateBrowserPuppeteerVersion(id: number, version: 'auto' | 'high' | 'low'): boolean {
  const result = run(
    'UPDATE browser SET puppeteer_version = ?, updated_at = ? WHERE id = ?',
    [version, new Date().toISOString(), id]
  )
  return result.changes > 0
}

// 检测并更新浏览器版本
export function detectAndUpdateBrowserVersion(id: number): { version: string | null; majorVersion: number | null } {
  const browsers = query<BrowserConfig>('SELECT * FROM browser WHERE id = ?', [id])
  if (browsers.length === 0) {
    return { version: null, majorVersion: null }
  }
  
  const browser = browsers[0]
  const versionInfo = getBrowserVersion(browser.path)
  
  run(
    'UPDATE browser SET chrome_version = ?, updated_at = ? WHERE id = ?',
    [versionInfo.version || null, new Date().toISOString(), id]
  )
  
  return {
    version: versionInfo.version,
    majorVersion: versionInfo.majorVersion
  }
}

// 检测系统浏览器并返回（用于添加）
export function detectSystemBrowsers(): ChromeInfo[] {
  return detectChrome()
}

// 初始化默认浏览器列表（从系统检测）
export function initDefaultBrowsers(): void {
  const existing = getBrowserList()
  if (existing.length === 0) {
    // 1. 首先检查并注册 Chromium（优先）
    const chromiumPath = getInstalledChromePath()
    if (chromiumPath) {
      try {
        const versionInfo = getBrowserVersion(chromiumPath)
        run(
          'INSERT INTO browser (name, path, is_enabled, puppeteer_version, chrome_version) VALUES (?, ?, 1, ?, ?)',
          ['Chromium', chromiumPath, 'auto', versionInfo.version || null]
        )
        console.log('Registered bundled Chromium:', chromiumPath)
      } catch {
        // 忽略重复
      }
    }
    
    // 2. 然后添加系统检测到的浏览器
    const detected = detectChrome()
    for (const browser of detected) {
      try {
        const versionInfo = getBrowserVersion(browser.path)
        run(
          'INSERT INTO browser (name, path, is_enabled, puppeteer_version, chrome_version) VALUES (?, ?, 1, ?, ?)',
          [browser.name, browser.path, 'auto', versionInfo.version || null]
        )
      } catch {
        // 忽略重复
      }
    }
  }
}

// 检测并添加新浏览器（只添加数据库中不存在的）
export function detectAndAddNewBrowsers(): { added: number; skipped: number; total: number } {
  const existing = getBrowserList()
  const existingPaths = new Set(existing.map(b => b.path.toLowerCase()))
  
  let added = 0
  let skipped = 0
  
  // 1. 首先检查并注册 Chromium（优先）
  const chromiumPath = getInstalledChromePath()
  if (chromiumPath && !existingPaths.has(chromiumPath.toLowerCase())) {
    try {
      const versionInfo = getBrowserVersion(chromiumPath)
      run(
        'INSERT INTO browser (name, path, is_enabled, puppeteer_version, chrome_version) VALUES (?, ?, 1, ?, ?)',
        ['Chromium', chromiumPath, 'auto', versionInfo.version || null]
      )
      added++
      existingPaths.add(chromiumPath.toLowerCase())
      console.log('Registered bundled Chromium:', chromiumPath)
    } catch {
      skipped++
    }
  }
  
  // 2. 然后添加系统检测到的浏览器
  const detected = detectChrome()
  
  for (const browser of detected) {
    // 检查路径是否已存在（不区分大小写）
    if (existingPaths.has(browser.path.toLowerCase())) {
      skipped++
      continue
    }
    
    try {
      const versionInfo = getBrowserVersion(browser.path)
      run(
        'INSERT INTO browser (name, path, is_enabled, puppeteer_version, chrome_version) VALUES (?, ?, 1, ?, ?)',
        [browser.name, browser.path, 'auto', versionInfo.version || null]
      )
      added++
    } catch {
      // 忽略插入错误
      skipped++
    }
  }
  
  return { added, skipped, total: detected.length + (chromiumPath ? 1 : 0) }
}

// 获取可用浏览器
// 优先级：数据库配置 > 系统检测
export function getAvailableBrowsers(): BrowserConfig[] {
  const fs = require('fs')
  
  // 1. 先从数据库获取启用的浏览器
  const enabled = getEnabledBrowsers()
  const validDbBrowsers = enabled.filter(browser => {
    try {
      return fs.existsSync(browser.path)
    } catch {
      return false
    }
  })
  
  // 如果数据库有有效配置，直接返回
  if (validDbBrowsers.length > 0) {
    return validDbBrowsers
  }
  
  // 2. 数据库没有配置，返回检测到的系统浏览器
  const detected = detectChrome()
  return detected.map(browser => ({
    id: 0,  // 临时ID，表示来自检测而非数据库
    name: browser.name,
    path: browser.path,
    is_enabled: true,
    puppeteer_version: 'auto' as const,
    chrome_version: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }))
}
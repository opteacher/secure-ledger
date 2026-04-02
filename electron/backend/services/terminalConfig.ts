/**
 * 终端工具配置服务
 * 数据库操作层，依赖 terminal.ts 进行系统检测
 */
import { run, query } from '../database'
import { detectTerminals, type TerminalTool } from './terminal'

export interface TerminalConfig {
  id: number
  name: string
  path: string
  terminal_type: string  // 终端类型标识符 (e.g., 'wt', 'powershell', 'gnome-terminal')
  is_enabled: boolean
  created_at: string
  updated_at: string
}

/**
 * 获取用户配置的终端列表
 */
export function getTerminalList(): TerminalConfig[] {
  return query<TerminalConfig>('SELECT * FROM terminal ORDER BY created_at ASC')
}

/**
 * 获取启用的终端列表
 */
export function getEnabledTerminals(): TerminalConfig[] {
  return query<TerminalConfig>('SELECT * FROM terminal WHERE is_enabled = 1 ORDER BY created_at ASC')
}

/**
 * 添加终端
 */
export function addTerminal(name: string, path: string, terminalType: string = ''): TerminalConfig {
  const result = run(
    'INSERT INTO terminal (name, path, terminal_type) VALUES (?, ?, ?)',
    [name, path, terminalType]
  )
  return {
    id: result.lastInsertRowid,
    name,
    path,
    terminal_type: terminalType,
    is_enabled: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
}

/**
 * 删除终端
 */
export function deleteTerminal(id: number): boolean {
  const result = run('DELETE FROM terminal WHERE id = ?', [id])
  return result.changes > 0
}

/**
 * 更新终端状态
 */
export function updateTerminalStatus(id: number, isEnabled: boolean): boolean {
  const result = run(
    'UPDATE terminal SET is_enabled = ?, updated_at = ? WHERE id = ?',
    [isEnabled ? 1 : 0, new Date().toISOString(), id]
  )
  return result.changes > 0
}

/**
 * 更新终端信息
 */
export function updateTerminal(id: number, name: string, path: string, terminalType?: string): boolean {
  if (terminalType !== undefined) {
    const result = run(
      'UPDATE terminal SET name = ?, path = ?, terminal_type = ?, updated_at = ? WHERE id = ?',
      [name, path, terminalType, new Date().toISOString(), id]
    )
    return result.changes > 0
  }
  const result = run(
    'UPDATE terminal SET name = ?, path = ?, updated_at = ? WHERE id = ?',
    [name, path, new Date().toISOString(), id]
  )
  return result.changes > 0
}

/**
 * 检测系统终端并返回（用于添加对话框）
 * 直接调用 terminal.ts 的检测函数，不涉及数据库
 */
export function detectSystemTerminals(): TerminalTool[] {
  return detectTerminals()
}

/**
 * 根据路径检测终端类型
 * 通过匹配系统检测的终端路径来确定类型标识符
 */
export function detectTerminalType(path: string): string {
  const detected = detectTerminals()
  const match = detected.find(t => t.path === path)
  return match?.id || ''
}

/**
 * 初始化默认终端列表（从系统检测）
 * 与 browser.ts 的 initDefaultBrowsers 保持一致的设计
 */
export function initDefaultTerminals(): { success: boolean; message: string; count: number } {
  const existing = getTerminalList()
  if (existing.length === 0) {
    const detected = detectTerminals()
    let count = 0
    for (const terminal of detected) {
      try {
        run(
          'INSERT INTO terminal (name, path, terminal_type, is_enabled) VALUES (?, ?, ?, 1)',
          [terminal.name, terminal.path, terminal.id]  // 保存 terminal.id 作为 terminal_type
        )
        count++
      } catch {
        // 忽略重复
      }
    }
    console.log(`terminalConfig: initialized ${count} terminals`)
    return { success: true, message: `已添加 ${count} 个终端工具`, count }
  }
  return { success: true, message: '终端列表已存在', count: existing.length }
}

/**
 * 检测并添加新终端（只添加数据库中不存在的）
 */
export function detectAndAddNewTerminals(): { added: number; skipped: number; total: number } {
  const existing = getTerminalList()
  const existingPaths = new Set(existing.map(t => t.path.toLowerCase()))
  
  const detected = detectTerminals()
  let added = 0
  let skipped = 0
  
  for (const terminal of detected) {
    // 检查路径是否已存在（不区分大小写）
    if (existingPaths.has(terminal.path.toLowerCase())) {
      skipped++
      continue
    }
    
    try {
      run(
        'INSERT INTO terminal (name, path, terminal_type, is_enabled) VALUES (?, ?, ?, 1)',
        [terminal.name, terminal.path, terminal.id]
      )
      added++
    } catch {
      // 忽略插入错误
      skipped++
    }
  }
  
  return { added, skipped, total: detected.length }
}

/**
 * 获取可用终端
 * 优先级：数据库配置 > 系统检测
 * 
 * 注意：Windows Store 应用（如 Windows Terminal）的路径是特殊的重新解析点，
 * fs.existsSync 无法正确检测，所以不再进行文件存在性验证。
 * 既然终端是通过 detectTerminals() 检测到的，说明它是可用的。
 */
export function getAvailableTerminals(): TerminalConfig[] {
  // 1. 先从数据库获取启用的终端
  const enabled = getEnabledTerminals()
  
  // 如果数据库有配置，直接返回（不再验证文件存在性）
  if (enabled.length > 0) {
    return enabled
  }
  
  // 2. 数据库没有配置，返回检测到的系统终端
  const detected = detectTerminals()
  return detected.map(terminal => ({
    id: 0,  // 临时ID，表示来自检测而非数据库
    name: terminal.name,
    path: terminal.path,
    terminal_type: terminal.id,  // 使用检测到的终端类型标识符
    is_enabled: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }))
}
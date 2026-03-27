import { app } from 'electron'
import { join } from 'path'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { createRequire } from 'module'
import type { Database as SqlJsDatabase, QueryExecResult } from 'sql.js'

// 使用 createRequire 在 ESM 环境中获取 require
const require = createRequire(import.meta.url)

let db: SqlJsDatabase | null = null
let dbPath: string = ''
let saveTimeout: NodeJS.Timeout | null = null
let isDirty = false

// 日志函数（避免循环依赖）
function log(level: string, ...args: any[]): void {
  const timestamp = new Date().toISOString()
  const prefix = `[${timestamp}] [${level}] [Database]`
  console.log(prefix, ...args)
}

// 获取数据库路径
export function getDatabasePath(): string {
  const userDataPath = app.getPath('userData')
  return join(userDataPath, 'secure-ledger.db')
}

// 保存数据库到文件（带防抖）
function saveDatabase(immediate = false): void {
  if (!db || !isDirty) return
  
  if (immediate) {
    doSave()
    return
  }
  
  // 防抖保存，避免频繁 IO
  if (saveTimeout) {
    clearTimeout(saveTimeout)
  }
  saveTimeout = setTimeout(() => {
    doSave()
  }, 500)
}

// 执行保存
function doSave(): void {
  if (!db) return
  
  try {
    const data = db.export()
    const buffer = Buffer.from(data)
    writeFileSync(dbPath, buffer)
    isDirty = false
    log('DEBUG', 'Database saved to file')
  } catch (error: any) {
    log('ERROR', 'Failed to save database:', error)
  }
}

// 初始化数据库
export async function initializeDatabase(): Promise<void> {
  dbPath = getDatabasePath()
  
  log('INFO', '=== Database Initialization Start ===')
  log('INFO', 'Database path:', dbPath)
  log('INFO', 'User data path:', app.getPath('userData'))
  log('INFO', 'Platform:', process.platform)
  log('INFO', 'Node version:', process.version)
  log('INFO', 'Working directory:', process.cwd())
  
  try {
    log('INFO', 'Loading sql.js...')
    
    // 使用 require 加载 sql.js（绕过 Vite 打包问题）
    const initSqlJs = require('sql.js')
    
    const SQL = await initSqlJs()
    log('INFO', 'sql.js loaded successfully')
    
    // 确保用户数据目录存在
    const userDataPath = app.getPath('userData')
    if (!existsSync(userDataPath)) {
      log('INFO', 'Creating user data directory:', userDataPath)
      mkdirSync(userDataPath, { recursive: true })
    }
    
    // 检查是否存在数据库文件
    if (existsSync(dbPath)) {
      log('INFO', 'Loading existing database from file...')
      const fileBuffer = readFileSync(dbPath)
      db = new SQL.Database(new Uint8Array(fileBuffer))
      log('INFO', 'Database loaded from file')
    } else {
      log('INFO', 'Creating new database...')
      db = new SQL.Database()
      // 新数据库立即保存
      isDirty = true
      saveDatabase(true)
      log('INFO', 'New database created and saved')
    }
    
    // 注册应用退出时保存
    app.on('before-quit', () => {
      if (saveTimeout) {
        clearTimeout(saveTimeout)
      }
      doSave()
      log('INFO', 'Database saved on app quit')
    })
    
    log('INFO', '=== Database Initialization Complete ===')
    log('INFO', 'Database initialized:', dbPath)
  } catch (error: any) {
    log('ERROR', '=== Database Initialization FAILED ===')
    log('ERROR', 'Error:', error)
    log('ERROR', 'Error message:', error?.message)
    log('ERROR', 'Error stack:', error?.stack)
    throw error
  }
}

// 获取数据库实例
export function getDatabase(): SqlJsDatabase {
  if (!db) {
    throw new Error('Database not initialized')
  }
  return db
}

// 关闭数据库
export function closeDatabase(): void {
  if (saveTimeout) {
    clearTimeout(saveTimeout)
  }
  doSave()
  if (db) {
    db.close()
    db = null
    log('INFO', 'Database closed')
  }
}

// 解析查询结果
function parseResults<T>(results: QueryExecResult[]): T[] {
  if (!results || results.length === 0) return []
  
  const result = results[0]
  if (!result.columns || !result.values) return []
  
  return result.values.map(row => {
    const obj: Record<string, any> = {}
    result.columns.forEach((col, i) => {
      obj[col] = row[i]
    })
    return obj as T
  })
}

// 执行 SQL（多条语句）
export function exec(sql: string): void {
  const database = getDatabase()
  database.run(sql)
  isDirty = true
  saveDatabase()
}

// 查询
export function query<T = any>(sql: string, params: any[] = []): T[] {
  const database = getDatabase()
  const stmt = database.prepare(sql)
  
  if (params.length > 0) {
    stmt.bind(params)
  }
  
  const results: QueryExecResult[] = []
  while (stmt.step()) {
    const row = stmt.get()
    results.push({
      columns: stmt.getColumnNames(),
      values: [row]
    })
  }
  stmt.free()
  
  // 重新执行以获取所有结果
  const allResults = database.exec(sql, params)
  return parseResults<T>(allResults)
}

// 查询单条
export function queryOne<T = any>(sql: string, params: any[] = []): T | undefined {
  const results = query<T>(sql, params)
  return results.length > 0 ? results[0] : undefined
}

// 执行结果类型
export interface RunResult {
  changes: number
  lastInsertRowid: number
}

// 执行更新/插入/删除
export function run(sql: string, params: any[] = []): RunResult {
  const database = getDatabase()
  
  // 获取执行前的行数
  const beforeCount = database.exec('SELECT changes()')[0]?.values?.[0]?.[0] || 0
  
  // 执行 SQL
  database.run(sql, params)
  
  // 获取最后插入的 ID
  const lastIdResult = database.exec('SELECT last_insert_rowid()')
  const lastInsertRowid = lastIdResult[0]?.values?.[0]?.[0] || 0
  
  // 获取影响的行数
  const changesResult = database.exec('SELECT changes()')
  const changes = changesResult[0]?.values?.[0]?.[0] || 0
  
  isDirty = true
  saveDatabase()
  
  return {
    changes: Number(changes),
    lastInsertRowid: Number(lastInsertRowid)
  }
}

// 事务执行
export function transaction<T>(fn: () => T): T {
  const database = getDatabase()
  
  // 开始事务
  database.run('BEGIN TRANSACTION')
  
  try {
    const result = fn()
    database.run('COMMIT')
    isDirty = true
    saveDatabase()
    return result
  } catch (error) {
    database.run('ROLLBACK')
    throw error
  }
}

// 强制保存（用于手动触发保存）
export function flushDatabase(): void {
  if (saveTimeout) {
    clearTimeout(saveTimeout)
  }
  doSave()
}
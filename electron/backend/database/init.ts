import { exec, run, query, queryOne, transaction, initializeDatabase as initDbCore } from './index'

// 表结构类型定义
export interface Account {
  id: number
  username: string
  password_hash: string
  created_at: string
  updated_at: string
}

export interface Endpoint {
  id: number
  name: string
  icon: string
  login_type: 'web' | 'ssh'
  created_at: string
  updated_at: string
}

export interface Page {
  id: number
  endpoint_id: number
  order_index: number // 步骤顺序
  url: string // 网页地址或SSH地址
  ssh_port?: number // SSH端口
  created_at: string
  updated_at: string
}

export interface Slot {
  id: number
  page_id: number
  order_index: number // 操作顺序
  name?: string
  element_xpath: string
  action_type: 'input' | 'click' | 'select' | 'password' | 'keyfile'
  value: string
  is_encrypted: boolean
  timeout: number
  created_at: string
  updated_at: string
}

// 初始化表结构
export function initTables(): void {
  exec(`
    -- 账户表
    CREATE TABLE IF NOT EXISTS account (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- 登录端表
    CREATE TABLE IF NOT EXISTS endpoint (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      icon TEXT DEFAULT '',
      login_type TEXT CHECK(login_type IN ('web', 'ssh')) DEFAULT 'web',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- 步骤页表
    CREATE TABLE IF NOT EXISTS page (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      endpoint_id INTEGER NOT NULL,
      order_index INTEGER DEFAULT 0,
      url TEXT NOT NULL,
      ssh_port INTEGER,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (endpoint_id) REFERENCES endpoint(id) ON DELETE CASCADE
    );

    -- 操作槽表
    CREATE TABLE IF NOT EXISTS slot (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      page_id INTEGER NOT NULL,
      order_index INTEGER DEFAULT 0,
      name TEXT DEFAULT '',
      element_xpath TEXT NOT NULL,
      action_type TEXT CHECK(action_type IN ('input', 'click', 'select', 'password', 'keyfile')) DEFAULT 'input',
      value TEXT DEFAULT '',
      is_encrypted INTEGER DEFAULT 0,
      timeout INTEGER DEFAULT 200,
      username TEXT,
      keyfile TEXT,
      passphrase TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (page_id) REFERENCES page(id) ON DELETE CASCADE
    );

    -- 创建索引
    CREATE INDEX IF NOT EXISTS idx_page_endpoint ON page(endpoint_id);
    CREATE INDEX IF NOT EXISTS idx_slot_page ON slot(page_id);
    CREATE INDEX IF NOT EXISTS idx_page_order ON page(endpoint_id, order_index);
    CREATE INDEX IF NOT EXISTS idx_slot_order ON slot(page_id, order_index);
    
    -- 浏览器配置表
    CREATE TABLE IF NOT EXISTS browser (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      path TEXT NOT NULL UNIQUE,
      is_enabled INTEGER DEFAULT 1,
      puppeteer_version TEXT DEFAULT 'auto',  -- 'auto' | 'high' | 'low'
      chrome_version TEXT,  -- 检测到的 Chrome 内核版本
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    
    -- 终端工具配置表
    CREATE TABLE IF NOT EXISTS terminal (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      path TEXT NOT NULL UNIQUE,
      is_enabled INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    
    -- 应用锁定设置表
    CREATE TABLE IF NOT EXISTS app_lock_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),  -- 只允许一行记录
      is_enabled INTEGER DEFAULT 0,
      is_locked INTEGER DEFAULT 0,             -- 应用是否处于锁定状态
      lock_delay_minutes INTEGER DEFAULT 5,   -- 延时锁定时长（分钟）
      lock_password_hash TEXT,               -- 锁定密码哈希
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    
    -- 初始化默认锁定设置
    INSERT OR IGNORE INTO app_lock_settings (id, is_enabled, is_locked, lock_delay_minutes) 
    VALUES (1, 0, 0, 5);
  `)

  // 迁移：添加新字段（如果不存在）
  try {
    run(`ALTER TABLE slot ADD COLUMN name TEXT DEFAULT ''`)
  } catch {}
  try {
    run(`ALTER TABLE slot ADD COLUMN username TEXT`)
  } catch {}
  try {
    run(`ALTER TABLE slot ADD COLUMN keyfile TEXT`)
  } catch {}
  try {
    run(`ALTER TABLE slot ADD COLUMN passphrase TEXT`)
  } catch {}
  
  // 迁移：terminal 表添加 terminal_type 字段（终端类型标识符）
  try {
    run(`ALTER TABLE terminal ADD COLUMN terminal_type TEXT DEFAULT ''`)
  } catch {}
  
  // 迁移：browser 表添加 puppeteer_version 和 chrome_version 字段
  try {
    run(`ALTER TABLE browser ADD COLUMN puppeteer_version TEXT DEFAULT 'auto'`)
  } catch {}
  try {
    run(`ALTER TABLE browser ADD COLUMN chrome_version TEXT`)
  } catch {}
  
  // 迁移：app_lock_settings 表添加 is_locked 字段
  try {
    run(`ALTER TABLE app_lock_settings ADD COLUMN is_locked INTEGER DEFAULT 0`)
    console.log('Added is_locked column to app_lock_settings')
  } catch (e) {
    // 列可能已存在，忽略错误
    console.log('is_locked column already exists or table not found')
  }

  console.log('Database tables initialized')
}

// 数据库初始化入口
export async function initializeDatabase(): Promise<void> {
  await initDbCore()
  initTables()
}

// 通用 CRUD 操作
export const db = {
  exec,
  run,
  query,
  queryOne,
  transaction
}
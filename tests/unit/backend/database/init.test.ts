/**
 * init.ts 单元测试 — 表初始化与数据库迁移
 *
 * 测试 initTables() 创建所有表、列类型正确性、
 * ALTER TABLE 迁移语句、以及 app_lock_settings INTEGER→REAL 迁移路径。
 */
import { vi, describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import path from 'path'

// ── 内存文件系统（vi.hoisted 确保 vi.mock 工厂可访问变量）──
const { inMemFiles, mockExistsSync, mockMkdirSync, mockReadFileSync, mockWriteFileSync } =
  vi.hoisted(() => {
    const inMemFiles = new Map<string, Uint8Array>()
    return {
      inMemFiles,
      mockExistsSync: vi.fn((p: string): boolean => inMemFiles.has(p)),
      mockMkdirSync: vi.fn(),
      mockReadFileSync: vi.fn((p: string): Buffer => {
        const data = inMemFiles.get(p)
        if (data !== undefined) return Buffer.from(data)
        throw new Error(`ENOENT: no such file or directory, open '${p}'`)
      }),
      mockWriteFileSync: vi.fn((p: string, data: Buffer) => {
        inMemFiles.set(p, new Uint8Array(data))
      }),
    }
  })

vi.mock('fs', () => ({
  existsSync: mockExistsSync,
  mkdirSync: mockMkdirSync,
  readFileSync: mockReadFileSync,
  writeFileSync: mockWriteFileSync,
}))

// ── 拦截 createRequire 以加载真实 sql.js ──
vi.mock('module', async () => {
  const sqljs = await import('sql.js')
  const initSqlJs = sqljs.default
  return {
    createRequire: vi.fn().mockReturnValue((specifier: string) => {
      if (specifier === 'sql.js') return initSqlJs
      throw new Error(`未模拟的 require 调用: ${specifier}`)
    }),
  }
})

// ── 从底层导入原始数据库操作 ──
import * as database from '../../../../electron/backend/database/index'
// ── 导入待测模块 ──
import {
  initTables,
  initializeDatabase as initDbWithTables,
  db,
} from '../../../../electron/backend/database/init'

// ── 辅助：获取列信息 ──
function getColumns(tableName: string): { cid: number; name: string; type: string; notnull: number; dflt_value: string | null; pk: number }[] {
  return database.query(
    `SELECT cid, name, type, "notnull", dflt_value, pk FROM pragma_table_info(?)`,
    [tableName]
  )
}

// ── 辅助：提取列名集合 ──
function columnNames(tableName: string): Set<string> {
  return new Set(getColumns(tableName).map((c) => c.name))
}

// ── 辅助：获取指定列的类型 ──
function columnType(tableName: string, columnName: string): string | undefined {
  const cols = getColumns(tableName)
  return cols.find((c) => c.name === columnName)?.type
}

// ── 辅助：获取所有表名 ──
function getAllTables(): string[] {
  return database
    .query<{ name: string }>("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
    .map((r) => r.name)
}

// ── 辅助：表是否存在 ──
function tableExists(tableName: string): boolean {
  const rows = database.query<{ cnt: number }>(
    "SELECT COUNT(*) AS cnt FROM sqlite_master WHERE type='table' AND name=?",
    [tableName]
  )
  return rows[0]?.cnt > 0
}

describe('表初始化与迁移 (database/init)', () => {
  beforeAll(async () => {
    await initDbWithTables()
  })

  afterAll(() => {
    database.closeDatabase()
    inMemFiles.clear()
    vi.restoreAllMocks()
  })

  // ──────────────────────────────────────────────
  // 所有表均已创建
  // ──────────────────────────────────────────────
  describe('initTables() 应创建所有表', () => {
    const expectedTables = [
      'account',
      'endpoint',
      'page',
      'slot',
      'browser',
      'terminal',
      'app_lock_settings',
    ]

    it.each(expectedTables)('应包含 %s 表', (tableName) => {
      expect(tableExists(tableName)).toBe(true)
    })

    it('应包含 7 张业务表（不含 sqlite_ 系统表）', () => {
      const bizTables = getAllTables().filter((t) => !t.startsWith('sqlite_'))
      // 迁移过程中可能产生 app_lock_settings_new 临时表，仅检查核心表
      const coreTables = bizTables.filter((t) => !t.endsWith('_new') && !t.endsWith('_old'))
      for (const t of expectedTables) {
        expect(coreTables).toContain(t)
      }
    })
  })

  // ──────────────────────────────────────────────
  // account 表列校验
  // ──────────────────────────────────────────────
  describe('account 表', () => {
    it('应包含全部必要列', () => {
      const cols = columnNames('account')
      expect(cols.has('id')).toBe(true)
      expect(cols.has('username')).toBe(true)
      expect(cols.has('password_hash')).toBe(true)
      expect(cols.has('created_at')).toBe(true)
      expect(cols.has('updated_at')).toBe(true)
    })

    it('id 应为主键且自增', () => {
      const cols = getColumns('account')
      const idCol = cols.find((c) => c.name === 'id')
      expect(idCol).toBeDefined()
      expect(idCol!.pk).toBe(1)
    })

    it('username 应有 UNIQUE 约束（通过插入重复值验证）', () => {
      database.run("INSERT INTO account (username, password_hash) VALUES (?, ?)", [
        'unique_test_user',
        'hash123',
      ])
      expect(() =>
        database.run("INSERT INTO account (username, password_hash) VALUES (?, ?)", [
          'unique_test_user',
          'hash456',
        ])
      ).toThrow()
    })
  })

  // ──────────────────────────────────────────────
  // endpoint 表列校验
  // ──────────────────────────────────────────────
  describe('endpoint 表', () => {
    it('应包含全部必要列', () => {
      const cols = columnNames('endpoint')
      expect(cols.has('id')).toBe(true)
      expect(cols.has('name')).toBe(true)
      expect(cols.has('icon')).toBe(true)
      expect(cols.has('login_type')).toBe(true)
      expect(cols.has('share_token')).toBe(true)
      expect(cols.has('created_at')).toBe(true)
      expect(cols.has('updated_at')).toBe(true)
    })

    it('login_type CHECK 约束应只允许 web 和 ssh', () => {
      // 有效值应通过
      database.run("INSERT INTO endpoint (name, login_type) VALUES (?, 'web')", ['test_web'])
      database.run("INSERT INTO endpoint (name, login_type) VALUES (?, 'ssh')", ['test_ssh'])
      // 无效值应拒绝
      expect(() =>
        database.run("INSERT INTO endpoint (name, login_type) VALUES (?, 'ftp')", ['test_ftp'])
      ).toThrow()
    })

    it('icon 默认值应为空字符串', () => {
      const cols = getColumns('endpoint')
      const iconCol = cols.find((c) => c.name === 'icon')
      expect(iconCol).toBeDefined()
      expect(iconCol!.dflt_value).toBe("''")
    })
  })

  // ──────────────────────────────────────────────
  // page 表列校验
  // ──────────────────────────────────────────────
  describe('page 表', () => {
    it('应包含全部必要列', () => {
      const cols = columnNames('page')
      expect(cols.has('id')).toBe(true)
      expect(cols.has('endpoint_id')).toBe(true)
      expect(cols.has('order_index')).toBe(true)
      expect(cols.has('url')).toBe(true)
      expect(cols.has('ssh_port')).toBe(true)
      expect(cols.has('created_at')).toBe(true)
      expect(cols.has('updated_at')).toBe(true)
    })

    it('外键约束应拒绝引用不存在的 endpoint', () => {
      // SQLite 默认不启用外键约束，需要显式开启
      database.exec('PRAGMA foreign_keys = ON')
      // 引用一个不存在的 endpoint_id=99999 应该失败
      expect(() =>
        database.run("INSERT INTO page (endpoint_id, url) VALUES (?, 'http://test.com')", [99999])
      ).toThrow()
    })
  })

  // ──────────────────────────────────────────────
  // slot 表列校验
  // ──────────────────────────────────────────────
  describe('slot 表', () => {
    it('应包含全部必要列（含迁移添加的列）', () => {
      const cols = columnNames('slot')
      expect(cols.has('id')).toBe(true)
      expect(cols.has('page_id')).toBe(true)
      expect(cols.has('order_index')).toBe(true)
      expect(cols.has('name')).toBe(true)
      expect(cols.has('element_xpath')).toBe(true)
      expect(cols.has('action_type')).toBe(true)
      expect(cols.has('value')).toBe(true)
      expect(cols.has('is_encrypted')).toBe(true)
      expect(cols.has('timeout')).toBe(true)
      expect(cols.has('username')).toBe(true)
      expect(cols.has('keyfile')).toBe(true)
      expect(cols.has('passphrase')).toBe(true)
      expect(cols.has('output_key')).toBe(true)
      expect(cols.has('created_at')).toBe(true)
      expect(cols.has('updated_at')).toBe(true)
    })

    it('action_type CHECK 约束应限制允许的类型', () => {
      // 需要先创建有效的 endpoint 和 page 以满足外键约束
      database.run("INSERT INTO endpoint (name, login_type) VALUES ('fk_test', 'web')")
      const epResult = database.queryOne<{ id: number }>('SELECT MAX(id) AS id FROM endpoint')!
      database.run('INSERT INTO page (endpoint_id, url) VALUES (?, ?)', [epResult.id, 'http://test.com'])
      const pageResult = database.queryOne<{ id: number }>('SELECT MAX(id) AS id FROM page')!
      const pageId = pageResult.id

      // 有效值
      database.run('INSERT INTO slot (page_id, element_xpath, action_type) VALUES (?, ?, ?)', [pageId, '/xpath', 'input'])
      database.run('INSERT INTO slot (page_id, element_xpath, action_type) VALUES (?, ?, ?)', [pageId, '/xpath', 'click'])
      database.run('INSERT INTO slot (page_id, element_xpath, action_type) VALUES (?, ?, ?)', [pageId, '/xpath', 'captcha'])
      // 无效值
      expect(() =>
        database.run('INSERT INTO slot (page_id, element_xpath, action_type) VALUES (?, ?, ?)', [pageId, '/xpath', 'hover'])
      ).toThrow()
    })

    it('is_encrypted 默认值应为 0', () => {
      const cols = getColumns('slot')
      const col = cols.find((c) => c.name === 'is_encrypted')
      expect(col).toBeDefined()
      expect(col!.dflt_value).toBe('0')
    })

    it('timeout 默认值应为 200', () => {
      const cols = getColumns('slot')
      const col = cols.find((c) => c.name === 'timeout')
      expect(col).toBeDefined()
      expect(col!.dflt_value).toBe('200')
    })
  })

  // ──────────────────────────────────────────────
  // browser 表列校验
  // ──────────────────────────────────────────────
  describe('browser 表', () => {
    it('应包含全部必要列（含迁移添加的列）', () => {
      const cols = columnNames('browser')
      expect(cols.has('id')).toBe(true)
      expect(cols.has('name')).toBe(true)
      expect(cols.has('path')).toBe(true)
      expect(cols.has('is_enabled')).toBe(true)
      expect(cols.has('puppeteer_version')).toBe(true)
      expect(cols.has('chrome_version')).toBe(true)
      expect(cols.has('created_at')).toBe(true)
      expect(cols.has('updated_at')).toBe(true)
    })

    it('path 应有 UNIQUE 约束', () => {
      database.run("INSERT INTO browser (name, path) VALUES ('Chrome A', '/path/a')")
      expect(() =>
        database.run("INSERT INTO browser (name, path) VALUES ('Chrome A Dupe', '/path/a')")
      ).toThrow()
    })
  })

  // ──────────────────────────────────────────────
  // terminal 表列校验
  // ──────────────────────────────────────────────
  describe('terminal 表', () => {
    it('应包含全部必要列（含迁移添加的 terminal_type）', () => {
      const cols = columnNames('terminal')
      expect(cols.has('id')).toBe(true)
      expect(cols.has('name')).toBe(true)
      expect(cols.has('path')).toBe(true)
      expect(cols.has('is_enabled')).toBe(true)
      expect(cols.has('terminal_type')).toBe(true)
      expect(cols.has('created_at')).toBe(true)
      expect(cols.has('updated_at')).toBe(true)
    })

    it('terminal_type 默认值应为空字符串', () => {
      const cols = getColumns('terminal')
      const col = cols.find((c) => c.name === 'terminal_type')
      expect(col).toBeDefined()
      expect(col!.dflt_value).toBe("''")
    })
  })

  // ──────────────────────────────────────────────
  // app_lock_settings 表列校验
  // ──────────────────────────────────────────────
  describe('app_lock_settings 表', () => {
    it('应包含全部必要列', () => {
      const cols = columnNames('app_lock_settings')
      expect(cols.has('id')).toBe(true)
      expect(cols.has('is_enabled')).toBe(true)
      expect(cols.has('is_locked')).toBe(true)
      expect(cols.has('lock_delay_minutes')).toBe(true)
      expect(cols.has('lock_password_hash')).toBe(true)
      expect(cols.has('created_at')).toBe(true)
      expect(cols.has('updated_at')).toBe(true)
    })

    it('id 应有 CHECK(id = 1) 约束以确保单行', () => {
      // 尝试插入 id=2 应失败
      expect(() =>
        database.run(
          "INSERT INTO app_lock_settings (id, is_enabled, lock_delay_minutes) VALUES (2, 0, 5)"
        )
      ).toThrow()
    })

    it('应有一条默认记录且 is_enabled=0', () => {
      const row = database.queryOne<{ is_enabled: number }>(
        'SELECT is_enabled FROM app_lock_settings WHERE id = 1'
      )
      expect(row).toBeDefined()
      expect(row!.is_enabled).toBe(0)
    })

    it('lock_delay_minutes 默认值应为 5', () => {
      const row = database.queryOne<{ lock_delay_minutes: number }>(
        'SELECT lock_delay_minutes FROM app_lock_settings WHERE id = 1'
      )
      expect(row).toBeDefined()
      expect(row!.lock_delay_minutes).toBe(5)
    })
  })

  // ──────────────────────────────────────────────
  // 索引校验
  // ──────────────────────────────────────────────
  describe('索引', () => {
    it('应创建 idx_page_endpoint 索引', () => {
      const rows = database.query<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type='index' AND name='idx_page_endpoint'"
      )
      expect(rows).toHaveLength(1)
    })

    it('应创建 idx_slot_page 索引', () => {
      const rows = database.query<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type='index' AND name='idx_slot_page'"
      )
      expect(rows).toHaveLength(1)
    })

    it('应创建 idx_page_order 复合索引', () => {
      const rows = database.query<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type='index' AND name='idx_page_order'"
      )
      expect(rows).toHaveLength(1)
    })

    it('应创建 idx_slot_order 复合索引', () => {
      const rows = database.query<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type='index' AND name='idx_slot_order'"
      )
      expect(rows).toHaveLength(1)
    })
  })

  // ──────────────────────────────────────────────
  // 迁移：ALTER TABLE ADD COLUMN（幂等性测试）
  // ──────────────────────────────────────────────
  describe('迁移 — ALTER TABLE ADD COLUMN 幂等性', () => {
    it('重复调用 initTables 不应抛出错误（迁移列已存在时静默跳过）', () => {
      // 第二次调用 initTables() 不应崩溃
      expect(() => initTables()).not.toThrow()
    })

    it('slot 迁移列 name 应存在', () => {
      expect(columnNames('slot').has('name')).toBe(true)
    })

    it('slot 迁移列 username 应存在', () => {
      expect(columnNames('slot').has('username')).toBe(true)
    })

    it('slot 迁移列 keyfile 应存在', () => {
      expect(columnNames('slot').has('keyfile')).toBe(true)
    })

    it('slot 迁移列 passphrase 应存在', () => {
      expect(columnNames('slot').has('passphrase')).toBe(true)
    })

    it('terminal 迁移列 terminal_type 应存在', () => {
      expect(columnNames('terminal').has('terminal_type')).toBe(true)
    })

    it('browser 迁移列 puppeteer_version 应存在', () => {
      expect(columnNames('browser').has('puppeteer_version')).toBe(true)
    })

    it('browser 迁移列 chrome_version 应存在', () => {
      expect(columnNames('browser').has('chrome_version')).toBe(true)
    })

    it('app_lock_settings 迁移列 is_locked 应存在', () => {
      expect(columnNames('app_lock_settings').has('is_locked')).toBe(true)
    })

    it('endpoint 迁移列 share_token 应存在', () => {
      expect(columnNames('endpoint').has('share_token')).toBe(true)
    })
  })

  // ──────────────────────────────────────────────
  // 迁移：lock_delay_minutes INTEGER → REAL
  // ──────────────────────────────────────────────
  describe('迁移 — app_lock_settings.lock_delay_minutes INTEGER→REAL', () => {
    // 该测试模拟旧 schema：lock_delay_minutes 为 INTEGER 类型
    // 然后调用 initTables() 触发迁移逻辑，验证类型变为 REAL 且数据保留。

    it('应将 INTEGER 类型的 lock_delay_minutes 迁移为 REAL 并保留数据', () => {
      // 步骤 1：删除现有表并手动创建旧版 schema（INTEGER 类型）
      database.exec('DROP TABLE IF EXISTS app_lock_settings')

      database.exec(`
        CREATE TABLE app_lock_settings (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          is_enabled INTEGER DEFAULT 0,
          is_locked INTEGER DEFAULT 0,
          lock_delay_minutes INTEGER DEFAULT 5,
          lock_password_hash TEXT,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
      `)

      // 插入测试数据：lock_delay_minutes 使用非默认值
      database.run(
        `INSERT INTO app_lock_settings (id, is_enabled, is_locked, lock_delay_minutes) VALUES (1, 1, 0, 10)`
      )

      // 验证迁移前类型为 INTEGER 且值为整数 10
      const typeBefore = columnType('app_lock_settings', 'lock_delay_minutes')
      expect(typeBefore).toBe('INTEGER')

      const valBefore = database.queryOne<{ lock_delay_minutes: number }>(
        'SELECT lock_delay_minutes FROM app_lock_settings WHERE id = 1'
      )
      expect(valBefore!.lock_delay_minutes).toBe(10)

      // 步骤 2：调用 initTables() 触发迁移
      initTables()

      // 步骤 3：验证迁移后类型变为 REAL，数据依然为 10
      const typeAfter = columnType('app_lock_settings', 'lock_delay_minutes')
      expect(typeAfter).toBe('REAL')

      const valAfter = database.queryOne<{ lock_delay_minutes: number }>(
        'SELECT lock_delay_minutes FROM app_lock_settings WHERE id = 1'
      )
      expect(valAfter!.lock_delay_minutes).toBe(10)
    })

    it('已为 REAL 类型时不应重复迁移', () => {
      // 此时 lock_delay_minutes 已经是 REAL（上个测试迁移完毕）
      const typeNow = columnType('app_lock_settings', 'lock_delay_minutes')
      expect(typeNow).toBe('REAL')

      // 再次调用 initTables() 应正常返回，不崩溃
      expect(() => initTables()).not.toThrow()

      // 类型应仍然为 REAL
      const typeAfter = columnType('app_lock_settings', 'lock_delay_minutes')
      expect(typeAfter).toBe('REAL')
    })
  })

  // ──────────────────────────────────────────────
  // db 对象 — 重新导出验证
  // ──────────────────────────────────────────────
  describe('db 对象（CRUD 重新导出）', () => {
    it('应导出 exec 函数', () => {
      expect(typeof db.exec).toBe('function')
    })

    it('应导出 run 函数', () => {
      expect(typeof db.run).toBe('function')
    })

    it('应导出 query 函数', () => {
      expect(typeof db.query).toBe('function')
    })

    it('应导出 queryOne 函数', () => {
      expect(typeof db.queryOne).toBe('function')
    })

    it('应导出 transaction 函数', () => {
      expect(typeof db.transaction).toBe('function')
    })

    it('db.query 应与 database.query 返回相同结果', () => {
      const viaDb = db.query<{ name: string }>("SELECT name FROM sqlite_master WHERE type='table' AND name='account'")
      const viaDatabase = database.query<{ name: string }>("SELECT name FROM sqlite_master WHERE type='table' AND name='account'")
      expect(viaDb).toEqual(viaDatabase)
    })
  })
})

/**
 * index.ts 单元测试 — SQLite 数据库包装器
 * 
 * 测试所有导出函数：initializeDatabase, getDatabase, closeDatabase,
 * exec, query, queryOne, run, transaction, flushDatabase, getDatabasePath
 */
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import path from 'path'
import os from 'os'

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

// ── 导入待测模块 ──
import * as database from '../../../../electron/backend/database/index'

function getDb() {
  try {
    return database.getDatabase()
  } catch {
    return null
  }
}

async function initForTest() {
  mockExistsSync.mockReturnValue(false)
  await database.initializeDatabase()
  mockExistsSync.mockReset()
}

describe('数据库模块 (database/index)', () => {
  beforeEach(async () => {
    inMemFiles.clear()
    vi.clearAllMocks()
    try { database.closeDatabase() } catch { /* ignore */ }
  })

  // ===== getDatabasePath =====
  describe('getDatabasePath', () => {
    it('应返回 userData 目录下的 secure-ledger.db', () => {
      const dbPath = database.getDatabasePath()
      expect(dbPath).toContain('secure-ledger.db')
      expect(dbPath).toContain('secure-ledger-test')
    })
  })

  // ===== initializeDatabase & getDatabase =====
  describe('initializeDatabase / getDatabase', () => {
    it('新数据库应成功初始化', async () => {
      await initForTest()
      expect(getDb()).not.toBeNull()
    })

    it('未初始化时 getDatabase 应抛出错误', () => {
      expect(() => database.getDatabase()).toThrow('Database not initialized')
    })

    it('已存在的数据库应成功加载', async () => {
      // 先初始化一次，创建 db 文件
      await initForTest()
      database.exec('CREATE TABLE test (id INTEGER PRIMARY KEY, value TEXT)')
      database.run('INSERT INTO test VALUES (1, "hello")')
      // 触发保存
      database.flushDatabase()
      // 关闭
      database.closeDatabase()
      expect(getDb()).toBeNull()

      // 模拟文件已存在
      mockExistsSync.mockReturnValue(true)
      await database.initializeDatabase()
      expect(getDb()).not.toBeNull()
      const rows = database.query<{ id: number; value: string }>('SELECT * FROM test')
      expect(rows).toHaveLength(1)
      expect(rows[0].value).toBe('hello')
    })
  })

  // ===== closeDatabase =====
  describe('closeDatabase', () => {
    it('初始化后关闭应释放数据库', async () => {
      await initForTest()
      database.closeDatabase()
      expect(getDb()).toBeNull()
    })

    it('多次关闭不应报错', async () => {
      await initForTest()
      database.closeDatabase()
      database.closeDatabase() // 第二次不抛异常
      expect(getDb()).toBeNull()
    })
  })

  // ===== exec =====
  describe('exec', () => {
    beforeEach(async () => { await initForTest() })

    it('执行 CREATE TABLE 应成功', () => {
      expect(() => database.exec('CREATE TABLE t (id INTEGER)')).not.toThrow()
    })

    it('执行多条 SQL 应成功', () => {
      database.exec('CREATE TABLE t (id INTEGER); INSERT INTO t VALUES (1)')
      const rows = database.query('SELECT * FROM t')
      expect(rows).toHaveLength(1)
    })
  })

  // ===== query =====
  describe('query', () => {
    beforeEach(async () => {
      await initForTest()
      database.exec('CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT)')
      database.run('INSERT INTO users VALUES (1, "Alice")')
      database.run('INSERT INTO users VALUES (2, "Bob")')
    })

    it('查询所有记录应返回完整结果', () => {
      const rows = database.query<{ id: number; name: string }>('SELECT * FROM users ORDER BY id')
      expect(rows).toHaveLength(2)
      expect(rows[0].name).toBe('Alice')
      expect(rows[1].name).toBe('Bob')
    })

    it('带参数的查询应正确过滤', () => {
      const rows = database.query<{ name: string }>('SELECT name FROM users WHERE id = ?', [1])
      expect(rows).toHaveLength(1)
      expect(rows[0].name).toBe('Alice')
    })

    it('无匹配结果的查询应返回空数组', () => {
      const rows = database.query('SELECT * FROM users WHERE id = 999')
      expect(rows).toHaveLength(0)
    })

    it('空表查询应返回空数组', () => {
      database.exec('CREATE TABLE empty (id INTEGER)')
      const rows = database.query('SELECT * FROM empty')
      expect(rows).toHaveLength(0)
    })
  })

  // ===== queryOne =====
  describe('queryOne', () => {
    beforeEach(async () => {
      await initForTest()
      database.exec('CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT)')
      database.run('INSERT INTO users VALUES (1, "Alice")')
    })

    it('存在记录时应返回第一条', () => {
      const row = database.queryOne<{ id: number; name: string }>('SELECT * FROM users')
      expect(row).not.toBeUndefined()
      expect(row!.name).toBe('Alice')
    })

    it('无匹配时应返回 undefined', () => {
      const row = database.queryOne('SELECT * FROM users WHERE id = 999')
      expect(row).toBeUndefined()
    })
  })

  // ===== run =====
  describe('run', () => {
    beforeEach(async () => { await initForTest() })

    it('INSERT 应返回 lastInsertRowid', () => {
      database.exec('CREATE TABLE t (id INTEGER PRIMARY KEY, v TEXT)')
      const result = database.run('INSERT INTO t (v) VALUES (?)', ['test'])
      expect(result.lastInsertRowid).toBe(1)
      expect(result.changes).toBe(1)
    })

    it('UPDATE 应返回 changes', () => {
      database.exec('CREATE TABLE t (id INTEGER PRIMARY KEY, v TEXT)')
      database.run('INSERT INTO t VALUES (1, "a")')
      const result = database.run('UPDATE t SET v = ? WHERE id = ?', ['b', 1])
      expect(result.changes).toBe(1)
    })

    it('DELETE 应返回正确的 changes', () => {
      database.exec('CREATE TABLE t (id INTEGER PRIMARY KEY, v TEXT)')
      database.run('INSERT INTO t VALUES (1, "a")')
      database.run('INSERT INTO t VALUES (2, "b")')
      const result = database.run('DELETE FROM t WHERE id = ?', [1])
      expect(result.changes).toBe(1)
    })
  })

  // ===== transaction =====
  describe('transaction', () => {
    beforeEach(async () => { await initForTest() })

    it('成功的事务应提交更改', () => {
      database.exec('CREATE TABLE t (id INTEGER PRIMARY KEY, v TEXT)')
      database.transaction(() => {
        database.run('INSERT INTO t VALUES (1, "txn")')
      })
      const rows = database.query('SELECT * FROM t')
      expect(rows).toHaveLength(1)
    })

    it('失败的事务应回滚更改', () => {
      database.exec('CREATE TABLE t (id INTEGER PRIMARY KEY, v TEXT)')
      database.run('INSERT INTO t VALUES (1, "before")')
      expect(() => {
        database.transaction(() => {
          database.run('INSERT INTO t VALUES (2, "in-txn")')
          throw new Error('rollback')
        })
      }).toThrow('rollback')
      const rows = database.query('SELECT * FROM t')
      expect(rows).toHaveLength(1) // 只有 before
    })

    it('事务应返回回调值', () => {
      const result = database.transaction(() => 42)
      expect(result).toBe(42)
    })
  })

  // ===== flushDatabase =====
  describe('flushDatabase', () => {
    beforeEach(async () => { await initForTest() })

    it('应触发文件写入', () => {
      mockWriteFileSync.mockClear()
      inMemFiles.clear()
      database.exec('CREATE TABLE t (id INTEGER)')
      database.flushDatabase()
      // 写入操作应该有调用
      expect(mockWriteFileSync).toHaveBeenCalled()
    })
  })
})

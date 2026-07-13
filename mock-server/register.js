/**
 * 注册 Mock 登录网站到 secure-ledger 数据库
 *
 * 运行: npm run mock-register
 * 前提: mock-server 已启动 (npm run mock-server)
 */
const Database = require('better-sqlite3')
const path = require('path')
const os = require('os')

// 数据库路径 (与 Electron app.getPath('userData') 一致)
const DB_PATH = path.join(os.homedir(), 'AppData', 'Roaming', 'secure-ledger', 'secure-ledger.db')

console.log('[MockRegister] Opening database:', DB_PATH)

const db = new Database(DB_PATH)
db.pragma('foreign_keys = ON')

// Migrate: add 'captcha' to action_type CHECK constraint if missing
const slotCreateSQL = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='slot'").get()
if (slotCreateSQL && !slotCreateSQL.sql.includes("'captcha'")) {
  console.log('[MockRegister] Migrating slot table: adding captcha action_type...')
  db.exec(`
    CREATE TABLE IF NOT EXISTS slot_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      page_id INTEGER NOT NULL,
      order_index INTEGER DEFAULT 0,
      name TEXT DEFAULT '',
      element_xpath TEXT NOT NULL DEFAULT '',
      action_type TEXT CHECK(action_type IN ('input', 'click', 'select', 'password', 'keyfile', 'captcha')) DEFAULT 'input',
      value TEXT DEFAULT '',
      is_encrypted INTEGER CHECK(is_encrypted IN (0, 1)) DEFAULT 0,
      timeout INTEGER DEFAULT 200,
      output_key TEXT DEFAULT NULL,
      username TEXT DEFAULT '',
      keyfile TEXT DEFAULT '',
      passphrase TEXT DEFAULT '',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (page_id) REFERENCES page(id) ON DELETE CASCADE
    );
    INSERT INTO slot_new SELECT * FROM slot;
    DROP TABLE slot;
    ALTER TABLE slot_new RENAME TO slot;
  `)
  console.log('[MockRegister] Migration complete')
}

// Check if already registered
const existing = db.prepare("SELECT id FROM endpoint WHERE name = 'Mock Login Test'").get()
if (existing) {
  console.log('[MockRegister] Mock endpoint already exists (id=' + existing.id + '). Deleting old records...')
  db.prepare('DELETE FROM slot WHERE page_id IN (SELECT id FROM page WHERE endpoint_id = ?)').run(existing.id)
  db.prepare('DELETE FROM page WHERE endpoint_id = ?').run(existing.id)
  db.prepare('DELETE FROM endpoint WHERE id = ?').run(existing.id)
}

// Insert endpoint
const endpointResult = db.prepare(
  "INSERT INTO endpoint (name, icon, login_type) VALUES ('Mock Login Test', '🧪', 'web')"
).run()
const endpointId = endpointResult.lastInsertRowid
console.log('[MockRegister] Endpoint created, id=' + endpointId)

// Insert page
const pageResult = db.prepare(
  'INSERT INTO page (endpoint_id, order_index, url) VALUES (?, 0, ?)'
).run(endpointId, 'http://localhost:3456')
const pageId = pageResult.lastInsertRowid
console.log('[MockRegister] Page created, id=' + pageId)

// Insert slots
const slots = [
  { order: 0, xpath: "//*[@id='username']", action: 'input', value: 'admin', output_key: null },
  { order: 1, xpath: "//*[@id='password']", action: 'input', value: 'admin123', output_key: null },
  { order: 2, xpath: "//*[@id='captcha-img']", action: 'captcha', value: '', output_key: 'result' },
  { order: 3, xpath: "//*[@id='captcha']", action: 'input', value: '{{result}}', output_key: null },
  { order: 4, xpath: "//*[@id='login-btn']", action: 'click', value: '', output_key: null },
]

const insertSlot = db.prepare(
  'INSERT INTO slot (page_id, order_index, element_xpath, action_type, value, is_encrypted, timeout, output_key) VALUES (?, ?, ?, ?, ?, 0, 200, ?)'
)

const insertMany = db.transaction((slots) => {
  for (const s of slots) {
    insertSlot.run(pageId, s.order, s.xpath, s.action, s.value, s.output_key)
  }
})

insertMany(slots)
console.log('[MockRegister] ' + slots.length + ' slots created')

// Verify
const verifyEndpoint = db.prepare('SELECT e.id, e.name, p.url, COUNT(s.id) as slot_count FROM endpoint e JOIN page p ON p.endpoint_id = e.id JOIN slot s ON s.page_id = p.id WHERE e.id = ? GROUP BY e.id').get(endpointId)
console.log('[MockRegister] Verify:', JSON.stringify(verifyEndpoint))

db.close()
console.log('[MockRegister] Done! 重启应用后在端点列表可看到 "Mock Login Test"')

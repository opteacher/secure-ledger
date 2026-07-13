const Database = require('better-sqlite3')
const path = require('path')
const os = require('os')
const DB_PATH = path.join(os.homedir(), 'AppData', 'Roaming', 'secure-ledger', 'secure-ledger.db')
const db = new Database(DB_PATH)
const rows = db.prepare(`
  SELECT s.order_index, s.action_type, s.element_xpath, s.value, s.output_key
  FROM slot s
  JOIN page p ON p.id = s.page_id
  WHERE p.endpoint_id = (SELECT id FROM endpoint WHERE name = 'Mock Login Test')
  ORDER BY s.order_index
`).all()
console.log(JSON.stringify(rows, null, 2))
db.close()

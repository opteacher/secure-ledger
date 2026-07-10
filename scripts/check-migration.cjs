const initSqlJs = require('sql.js')
const fs = require('fs')
const path = require('path')
const dbPath = path.join(process.env.APPDATA, 'secure-ledger', 'secure-ledger.db')

if (!fs.existsSync(dbPath)) { console.log('DB NOT FOUND:', dbPath); process.exit(1) }

initSqlJs().then(SQL => {
  const db = new SQL.Database(fs.readFileSync(dbPath))

  console.log('=== system_config ===')
  try {
    const rows = []
    db.each('SELECT * FROM system_config', (r) => rows.push(r))
    if (rows.length === 0) console.log('  (empty)')
    else rows.forEach(r => console.log(' ', JSON.stringify(r)))
  } catch(e) { console.log('  TABLE MISSING:', e.message) }

  console.log('\n=== endpoints ===')
  const ep = []
  db.each('SELECT id, name, login_type FROM endpoint', (r) => ep.push(r))
  console.log('  count:', ep.length)
  ep.forEach(e => console.log(' ', e.id, e.name, e.login_type))

  console.log('\n=== endpoint_key (migration status) ===')
  try {
    const ek = []
    db.each('SELECT endpoint_id, key_id, CASE WHEN backup_encrypted_key != "" THEN "HAS_BACKUP" ELSE "NO_BACKUP" END as b FROM endpoint_key', (r) => ek.push(r))
    if (ek.length === 0) console.log('  (empty - NOT migrated)')
    else ek.forEach(e => console.log(' ', JSON.stringify(e)))
  } catch(e) { console.log('  TABLE MISSING:', e.message) }

  console.log('\n=== encrypted slots ===')
  const sc = []
  db.each("SELECT COUNT(*) as cnt FROM slot WHERE is_encrypted=1 AND value IS NOT NULL AND value!=''", (r) => sc.push(r))
  console.log('  count:', sc[0]?.cnt || 0)

  db.close()
})

/**
 * 测试 ssh2 上传进度效果
 * 用法: node scripts/test-upload-progress.cjs
 */
const { Client } = require('ssh2')
const fs = require('fs')
const path = require('path')
const os = require('os')

const host = process.argv[2] || '192.168.1.11'
const port = parseInt(process.argv[3]) || 22
const user = process.argv[4] || 'op'

// 读取默认 SSH 密钥
const defaultKeys = [
  path.join(os.homedir(), '.ssh', 'id_ed25519'),
  path.join(os.homedir(), '.ssh', 'id_rsa'),
]
let privateKey = null
let keyPath = null
for (const k of defaultKeys) {
  if (fs.existsSync(k)) {
    privateKey = fs.readFileSync(k)
    keyPath = k
    console.log('Using key:', k)
    break
  }
}
if (!privateKey) {
  console.error('No SSH key found at ~/.ssh/id_rsa or ~/.ssh/id_ed25519')
  console.log('Usage: node scripts/test-upload-progress.cjs [host] [port] [user]')
  process.exit(1)
}

const remotePath = '/tmp/'
const connConfig = { host, port, username: user, privateKey, readyTimeout: 10000 }

// 生成测试文件
const testFile = path.join(os.tmpdir(), 'sl-upload-test.bin')
console.log('Creating 50MB test file...')
const buf = Buffer.alloc(1024 * 1024, 'A')
const fd = fs.openSync(testFile, 'w')
for (let i = 0; i < 50; i++) fs.writeSync(fd, buf)
fs.closeSync(fd)
console.log('Test file:', (fs.statSync(testFile).size / 1024 / 1024).toFixed(0) + 'MB\n')

console.log('\n=== Test 1: fastPut (current method) ===')
console.log(`Target: ${user}@${host}:${port}${remotePath}`)
console.log('Progress: per-file only, no chunk-level updates\n')

const conn1 = new Client()
const start1 = Date.now()

conn1.on('ready', () => {
  conn1.sftp((err, sftp) => {
    if (err) { console.error('SFTP failed:', err.message); conn1.end(); return }
    console.log('[fastPut] Connected, uploading...')
    sftp.fastPut(testFile, remotePath + 'test-fastput.bin', {
      step: (transferred, chunk, total) => {
        // fastPut step callback - DOES provide chunk progress!
        const pct = Math.round((transferred / total) * 100)
        const elapsed = ((Date.now() - start1) / 1000).toFixed(1)
        const speed = (transferred / 1024 / 1024 / (Date.now() - start1) * 1000).toFixed(1)
        process.stdout.write(`\r  [fastPut] ${pct}% | ${(transferred/1024/1024).toFixed(1)}/${(total/1024/1024).toFixed(1)} MB | ${speed} MB/s | ${elapsed}s`)
      }
    }, (err) => {
      const elapsed = ((Date.now() - start1) / 1000).toFixed(1)
      console.log('\n  [fastPut] ' + (err ? 'FAILED: ' + err.message : 'DONE') + ' | ' + elapsed + 's')
      conn1.end()
      // Run test 2
      testStreaming()
    })
  })
})

conn1.on('error', (err) => {
  console.error('\n[fastPut] Connection failed:', err.message)
  console.log('Make sure SSH is accessible at', host + ':' + port)
  process.exit(1)
})

conn1.connect(connConfig)

// Test 2: streaming upload with manual progress
function testStreaming() {
  console.log('\n=== Test 2: createWriteStream (streaming) ===')
  const conn2 = new Client()
  const start2 = Date.now()
  let transferred = 0
  const total = fs.statSync(testFile).size

  conn2.on('ready', () => {
    conn2.sftp((err, sftp) => {
      if (err) { console.error('SFTP failed:', err.message); conn2.end(); cleanup(); return }
      console.log('[stream] Connected, uploading...')

      const readStream = fs.createReadStream(testFile, { highWaterMark: 256 * 1024 })
      const writeStream = sftp.createWriteStream(remotePath + 'test-stream.bin')

      readStream.on('data', (chunk) => {
        transferred += chunk.length
        const pct = Math.round((transferred / total) * 100)
        const elapsed = ((Date.now() - start2) / 1000).toFixed(1)
        const speed = (transferred / 1024 / 1024 / (Date.now() - start2) * 1000).toFixed(1)
        process.stdout.write(`\r  [stream] ${pct}% | ${(transferred/1024/1024).toFixed(1)}/${(total/1024/1024).toFixed(1)} MB | ${speed} MB/s | ${elapsed}s`)
      })

      writeStream.on('close', () => {
        const elapsed = ((Date.now() - start2) / 1000).toFixed(1)
        console.log('\n  [stream] DONE | ' + elapsed + 's')
        conn2.end()
        cleanup()
      })

      writeStream.on('error', (err) => {
        console.error('\n  [stream] FAILED:', err.message)
        conn2.end()
        cleanup()
      })

      readStream.pipe(writeStream)
    })
  })

  conn2.on('error', (err) => {
    console.error('\n[stream] Connection failed:', err.message)
    cleanup()
  })

  conn2.connect(connConfig)
}

function cleanup() {
  try { fs.unlinkSync(testFile) } catch (_) {}
  console.log('\nCleaned up test file')
}

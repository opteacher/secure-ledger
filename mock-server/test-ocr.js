/**
 * Standalone OCR 测试 — 验证 tesseract.js worker 能否正常加载和使用
 * 
 * 用法: node mock-server/test-ocr.js
 * 前提: mock-server 已启动 (npm run mock-server)
 */
const http = require('http')
const { createWorker } = require('tesseract.js')
const path = require('path')
const { existsSync } = require('fs')

const TESSSDATA_DIR = path.resolve(__dirname, '../resources/tessdata')
const WORKER_SCRIPT = path.resolve(__dirname, '../node_modules/tesseract.js/src/worker-script/node/index.js')

console.log('=== OCR Test ===')
console.log('tessdata dir:', TESSSDATA_DIR, existsSync(TESSSDATA_DIR) ? '(exists)' : '(NOT FOUND)')
console.log('eng.traineddata:', existsSync(path.join(TESSSDATA_DIR, 'eng.traineddata')) ? '(exists)' : '(NOT FOUND)')
console.log('worker script:', WORKER_SCRIPT, existsSync(WORKER_SCRIPT) ? '(exists)' : '(NOT FOUND)')

async function fetchCaptchaBase64() {
  return new Promise((resolve, reject) => {
    http.get('http://localhost:3456/captcha?v=test', (res) => {
      const chunks = []
      res.on('data', chunk => chunks.push(chunk))
      res.on('end', () => {
        const buffer = Buffer.concat(chunks)
        resolve(buffer.toString('base64'))
      })
    }).on('error', reject)
  })
}

async function main() {
  console.log('\n[1] Fetching captcha from mock server...')
  const base64 = await fetchCaptchaBase64()
  console.log('[1] Captcha fetched, base64 length:', base64.length)

  console.log('\n[2] Creating tesseract.js worker...')
  const worker = await createWorker('eng', 1, {
    langPath: TESSSDATA_DIR,
    workerPath: WORKER_SCRIPT,
    cacheMethod: 'readOnly',
    gzip: false,
  })
  console.log('[2] Worker created successfully!')

  console.log('\n[3] Recognizing captcha...')
  const imgBuffer = Buffer.from(base64, 'base64')
  const { data } = await worker.recognize(imgBuffer)
  const text = (data.text || '').trim().replace(/[^A-Za-z0-9]/g, '')
  console.log('[3] OCR result:', JSON.stringify(data.text), '→ cleaned:', JSON.stringify(text))
  console.log('[3] Confidence:', data.confidence)

  console.log('\n[4] Cleaning up...')
  await worker.terminate()
  console.log('[4] Worker terminated')
  
  console.log('\n=== OCR Test PASSED ===')
}

main().catch(err => {
  console.error('\n=== OCR Test FAILED ===')
  console.error(err)
  process.exit(1)
})

/**
 * Download Tesseract.js language data for offline use.
 *
 * In production builds, eng.traineddata must be bundled in resources/tessdata/.
 * Run this script when network access is available:
 *   npx tsx scripts/download-tessdata.ts
 *
 * This is invoked automatically by prepare-build.js during packaging.
 */
import { existsSync, writeFileSync } from 'fs'
import { join } from 'path'
import { platform } from 'os'

const TESSDATA_DIR = join(__dirname, '..', 'resources', 'tessdata')
const TARGET = join(TESSDATA_DIR, 'eng.traineddata')

// Mirrors in priority order (try each until one works)
const MIRRORS = [
  'https://github.com/tesseract-ocr/tessdata/raw/main/eng.traineddata',
  'https://github.com/naptha/tessdata/raw/main/eng.traineddata',
  'https://tessdata.projectnaptha.com/4.0.0/eng.traineddata',
]

async function download(url: string): Promise<Buffer | null> {
  try {
    // Use node built-in fetch (Node 18+) or fall back to http.request
    const resp = await fetch(url)
    if (!resp.ok) {
      console.warn(`[download-tessdata] ${url} returned ${resp.status}`)
      return null
    }
    const buffer = Buffer.from(await resp.arrayBuffer())
    if (buffer.length < 100_000) {
      console.warn(`[download-tessdata] ${url} returned only ${buffer.length} bytes (too small, likely error page)`)
      return null
    }
    return buffer
  } catch (err) {
    console.warn(`[download-tessdata] ${url} failed: ${(err as Error).message}`)
    return null
  }
}

async function main() {
  if (existsSync(TARGET)) {
    const stats = require('fs').statSync(TARGET)
    if (stats.size > 100_000) {
      console.log(`[download-tessdata] ${TARGET} already exists (${stats.size} bytes), skipping`)
      process.exit(0)
    }
    console.warn(`[download-tessdata] ${TARGET} is too small (${stats.size} bytes), re-downloading`)
  }

  for (const mirror of MIRRORS) {
    console.log(`[download-tessdata] Trying: ${mirror}`)
    const data = await download(mirror)
    if (data) {
      writeFileSync(TARGET, data)
      console.log(`[download-tessdata] Downloaded ${data.length} bytes to ${TARGET}`)
      process.exit(0)
    }
  }

  console.error(
    '[download-tessdata] FAILED: Could not download eng.traineddata from any mirror.\n' +
    '  Manual download: place eng.traineddata (~18MB) from https://github.com/tesseract-ocr/tessdata\n' +
    `  into ${TARGET}\n` +
    '  On Windows with PowerShell:\n' +
    '    Invoke-WebRequest -Uri "https://github.com/tesseract-ocr/tessdata/raw/main/eng.traineddata" -OutFile "' + TARGET + '"\n' +
    '  On Linux/macOS:\n' +
    '    wget -O "' + TARGET + '" https://github.com/tesseract-ocr/tessdata/raw/main/eng.traineddata'
  )
  process.exit(1)
}

main()

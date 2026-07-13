/**
 * 便携 Python 运行时安装脚本
 *
 * 用法: node scripts/setup-python-runtime.js [--platform win32|linux|darwin]
 *
 * 下载 embeddable Python 并安装 muggle_ocr 及其依赖到 resources/python-runtime/
 * 用于内网部署 — 用户无需单独安装 Python
 */
const https = require('https')
const http = require('http')
const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')
const { createWriteStream, existsSync, mkdirSync, rmSync } = require('fs')

const PLATFORM = process.argv.includes('--linux') ? 'linux' :
                 process.argv.includes('--darwin') ? 'darwin' : 'win32'

// ============================================================
// 配置
// ============================================================
const PYTHON_VERSION = '3.10.11'
const RUNTIME_DIR = path.resolve(__dirname, '../resources/python-runtime')
const TEMP_DIR = path.resolve(__dirname, '../temp')

const PYTHON_DOWNLOADS = {
  win32: {
    url: `https://www.python.org/ftp/python/${PYTHON_VERSION}/python-${PYTHON_VERSION}-embed-amd64.zip`,
    exeName: 'python.exe',
    sha256: null, // skip verification for simplicity
  },
  linux: {
    url: `https://github.com/niess/python-build-standalone/releases/download/20241002/cpython-3.10.15+20241002-x86_64-unknown-linux-gnu-install_only.tar.gz`,
    exeName: 'bin/python3',
    sha256: null,
  },
  darwin: {
    url: `https://github.com/niess/python-build-standalone/releases/download/20241002/cpython-3.10.15+20241002-x86_64-apple-darwin-install_only.tar.gz`,
    exeName: 'bin/python3',
    sha256: null,
  },
}

const MUGGLE_OCR_REPO = 'https://github.com/litongjava/muggle_ocr.git'

// ============================================================
// 工具函数
// ============================================================
function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const proto = url.startsWith('https') ? https : http
    console.log(`  Downloading: ${url}`)
    const file = createWriteStream(dest)
    proto.get(url, (response) => {
      if (response.statusCode === 302 || response.statusCode === 301) {
        file.close()
        fs.unlinkSync(dest)
        return downloadFile(response.headers.location, dest).then(resolve).catch(reject)
      }
      if (response.statusCode !== 200) {
        file.close()
        fs.unlinkSync(dest)
        return reject(new Error(`HTTP ${response.statusCode}`))
      }
      const total = parseInt(response.headers['content-length'] || '0', 10)
      let downloaded = 0
      response.on('data', (chunk) => {
        downloaded += chunk.length
        if (total > 0) process.stdout.write(`\r    ${Math.round(downloaded / total * 100)}% (${(downloaded / 1024 / 1024).toFixed(1)}MB)`)
      })
      response.pipe(file)
      file.on('finish', () => {
        file.close()
        process.stdout.write('\n')
        resolve()
      })
    }).on('error', reject)
  })
}

function exec(cmd, opts = {}) {
  console.log(`  > ${cmd}`)
  return execSync(cmd, { stdio: 'inherit', ...opts })
}

// ============================================================
// 主流程
// ============================================================
async function main() {
  console.log(`\n=== Portable Python Runtime Setup (${PLATFORM}) ===\n`)

  // 0. 清理
  if (process.argv.includes('--clean')) {
    console.log('[0] Cleaning existing runtime...')
    if (existsSync(RUNTIME_DIR)) rmSync(RUNTIME_DIR, { recursive: true })
  }

  if (!existsSync(TEMP_DIR)) mkdirSync(TEMP_DIR, { recursive: true })

  const cfg = PYTHON_DOWNLOADS[PLATFORM]
  if (!cfg) {
    console.error(`Unsupported platform: ${PLATFORM}`)
    process.exit(1)
  }

  // 1. 检测现有的 Python
  console.log('[1] Checking Python...')
  let pythonExe = path.join(RUNTIME_DIR, cfg.exeName)
  let hasPython = existsSync(pythonExe)

  if (!hasPython) {
    // 2. 下载 embeddable Python
    console.log('[2] Downloading embeddable Python...')
    const ext = PLATFORM === 'win32' ? '.zip' : '.tar.gz'
    const archive = path.join(TEMP_DIR, `python-embed${ext}`)
    if (!existsSync(archive)) {
      await downloadFile(cfg.url, archive)
    } else {
      console.log('  Archive already exists, skipping download')
    }

    // 3. 解压
    console.log('[3] Extracting Python...')
    if (!existsSync(RUNTIME_DIR)) mkdirSync(RUNTIME_DIR, { recursive: true })
    if (PLATFORM === 'win32') {
      // Windows: PowerShell Expand-Archive
      exec(`powershell -Command "Expand-Archive -Path '${archive}' -DestinationPath '${RUNTIME_DIR}' -Force"`)
      // Enable pip for embeddable Python
      const pythonPth = path.join(RUNTIME_DIR, 'python310._pth')
      if (existsSync(pythonPth)) {
        let content = fs.readFileSync(pythonPth, 'utf-8')
        if (content.includes('#import site')) {
          content = content.replace('#import site', 'import site')
          fs.writeFileSync(pythonPth, content)
        }
      }
      // Install pip
      const getPipUrl = 'https://bootstrap.pypa.io/get-pip.py'
      const getPipPath = path.join(TEMP_DIR, 'get-pip.py')
      if (!existsSync(getPipPath)) await downloadFile(getPipUrl, getPipPath)
      exec(`"${pythonExe}" "${getPipPath}" --no-warn-script-location`)
    } else {
      exec(`tar -xzf "${archive}" -C "${RUNTIME_DIR}" --strip-components=1`)
    }
  } else {
    console.log('  Python already installed')
  }

  // 4. 安装 muggle_ocr 依赖
  console.log('[4] Installing muggle_ocr dependencies...')
  const pythonExe = path.join(RUNTIME_DIR, cfg.exeName)
  const pipArgs = ['-m', 'pip', 'install', '--no-warn-script-location']

  // 离线模式：从本地 whls 目录安装
  if (process.argv.includes('--offline')) {
    const whlsDir = path.resolve(__dirname, '../temp/whls')
    if (existsSync(whlsDir)) {
      console.log('  Offline mode: installing from ' + whlsDir)
      exec(`"${pythonExe}" ${pipArgs.join(' ')} --no-index --find-links "${whlsDir}" numpy pillow opencv-python pyyaml tensorflow muggle_ocr`)
    } else {
      console.error('  whls dir not found: ' + whlsDir)
      process.exit(1)
    }
  } else {
    // 在线模式
    exec(`"${pythonExe}" ${pipArgs.join(' ')} numpy pillow opencv-python pyyaml tensorflow`)
    const muggleDir = path.join(TEMP_DIR, 'muggle_ocr')
    if (!existsSync(muggleDir)) {
      exec(`git clone --depth 1 ${MUGGLE_OCR_REPO} "${muggleDir}"`)
    }
    exec(`"${pythonExe}" -m pip install "${muggleDir}"`)
  }

  // 5. 验证
  console.log('[5] Verifying...')
  try {
    execSync(`"${pythonExe}" -c "import muggle_ocr; s=muggle_ocr.SDK(model_type=muggle_ocr.ModelType.Captcha); print('muggle_ocr OK')"`, { stdio: 'pipe' })
    console.log('  ✓ muggle_ocr working!')
  } catch (e) {
    console.error('  ✗ muggle_ocr verification failed:', e.message)
    console.error('  This may be OK if TensorFlow needs platform-specific setup.')
  }

  console.log(`\n=== Done! Runtime at: ${RUNTIME_DIR} ===`)
  console.log(`Python: ${pythonExe}`)
  console.log(`Size: ${getDirSize(RUNTIME_DIR)}`)
}

function getDirSize(dir) {
  if (!existsSync(dir)) return 'N/A'
  let size = 0
  function walk(d) {
    for (const f of fs.readdirSync(d, { withFileTypes: true })) {
      if (f.isDirectory()) walk(path.join(d, f.name))
      else size += fs.statSync(path.join(d, f.name)).size
    }
  }
  walk(dir)
  return `${(size / 1024 / 1024).toFixed(1)} MB`
}

main().catch(e => { console.error(e); process.exit(1) })

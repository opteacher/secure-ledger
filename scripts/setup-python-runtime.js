/**
 * muggle_ocr 一键部署脚本
 *
 * 根据当前系统自动：
 *   1. 下载便携 Python
 *   2. 安装 pip（Windows 需要）
 *   3. 用国内源下载 whl 依赖
 *   4. 打包 muggle_ocr 为 whl
 *
 * 用法: node scripts/setup-python-runtime.js
 */
const https = require('https')
const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

const PROJECT = path.resolve(__dirname, '..')
const PYTHON_DIR = path.join(PROJECT, 'resources', 'python')
const WHLS_DIR = path.join(PYTHON_DIR, 'whls')
const RUNTIME_DIR = path.join(PROJECT, 'resources', 'python-runtime')
const TEMP_DIR = path.join(PROJECT, 'temp')
const PIP_MIRROR = 'https://pypi.tuna.tsinghua.edu.cn/simple'

const IS_WIN = process.platform === 'win32'

// ============================================================
const CONFIG = IS_WIN ? {
  pythonUrl: 'https://www.python.org/ftp/python/3.10.11/python-3.10.11-embed-amd64.zip',
  pythonFile: 'python-3.10.11-embed-amd64.zip',
  pythonExe: path.join(RUNTIME_DIR, 'python.exe'),
  pipInstall: true,  // embeddable 需要 get-pip.py
  libDir: path.join(RUNTIME_DIR, 'Lib', 'site-packages'),
  pthFile: path.join(RUNTIME_DIR, 'python310._pth'),
} : {
  pythonUrl: 'https://github.com/indygreg/python-build-standalone/releases/download/20241002/cpython-3.10.15+20241002-x86_64-unknown-linux-gnu-install_only.tar.gz',
  pythonFile: 'cpython-3.10.15-x86_64-linux.tar.gz',
  pythonExe: path.join(RUNTIME_DIR, 'bin', 'python3'),
  pipInstall: false,  // 自带 pip
  libDir: null,
  pthFile: null,
}

// ============================================================
function download(url, dest, label) {
  return new Promise((resolve, reject) => {
    if (fs.existsSync(dest)) { console.log(`  ✓ ${label} (cached)`); return resolve() }
    console.log(`  ↓ ${label}`)
    const file = fs.createWriteStream(dest)
    https.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        file.close(); fs.unlinkSync(dest)
        return download(res.headers.location, dest, label).then(resolve).catch(reject)
      }
      const total = parseInt(res.headers['content-length'] || '0')
      let done = 0
      res.on('data', c => { done += c.length; if (total) process.stdout.write(`\r    ${Math.round(done/total*100)}%`) })
      res.pipe(file)
      file.on('finish', () => { file.close(); process.stdout.write('\n'); resolve() })
    }).on('error', reject)
  })
}

function run(cmd, label) {
  console.log(`  > ${label || cmd}`)
  execSync(cmd, { cwd: PROJECT, stdio: 'inherit' })
}

// ============================================================
async function main() {
  console.log(`\n=== muggle_ocr 部署 (${IS_WIN ? 'Windows' : 'Linux'}) ===\n`)
  fs.mkdirSync(PYTHON_DIR, { recursive: true })
  fs.mkdirSync(TEMP_DIR, { recursive: true })

  // 1. 下载便携 Python
  console.log('[1] 便携 Python')
  await download(CONFIG.pythonUrl, path.join(PYTHON_DIR, CONFIG.pythonFile), CONFIG.pythonFile)

  // 2. 解压
  console.log('[2] 解压 Python')
  if (fs.existsSync(CONFIG.pythonExe)) {
    console.log('  ✓ 已解压')
  } else {
    fs.mkdirSync(RUNTIME_DIR, { recursive: true })
    if (IS_WIN) {
      run(`powershell -Command "Expand-Archive '${path.join(PYTHON_DIR, CONFIG.pythonFile)}' '${RUNTIME_DIR}' -Force"`)
      // 修改 _pth 启用 site
      const pth = path.join(RUNTIME_DIR, 'python310._pth')
      fs.writeFileSync(pth, 'python310.zip\n.\nLib\\site-packages\n\nimport site\n')
    } else {
      run(`tar xzf "${path.join(PYTHON_DIR, CONFIG.pythonFile)}" -C "${RUNTIME_DIR}" --strip-components=1`)
    }
    console.log('  ✓ 解压完成')
  }

  // 3. pip
  if (CONFIG.pipInstall) {
    console.log('[3] 安装 pip')
    await download('https://bootstrap.pypa.io/get-pip.py', path.join(PYTHON_DIR, 'get-pip.py'), 'get-pip.py')
    run(`"${CONFIG.pythonExe}" "${path.join(PYTHON_DIR, 'get-pip.py')}" --no-warn-script-location`)
  } else {
    console.log('[3] 升级 pip')
    run(`"${CONFIG.pythonExe}" -m pip install --upgrade pip -i ${PIP_MIRROR}`)
  }

  // 4. 下载 whl
  console.log('[4] 下载 whl（国内源，耐心等待）')
  fs.mkdirSync(WHLS_DIR, { recursive: true })
  // 清旧 whl
  for (const f of fs.readdirSync(WHLS_DIR)) { if (f.endsWith('.whl')) fs.unlinkSync(path.join(WHLS_DIR, f)) }
  run(`"${CONFIG.pythonExe}" -m pip download -d "${WHLS_DIR}" -i ${PIP_MIRROR} numpy pillow opencv-python pyyaml tensorflow`)

  // 5. muggle_ocr → whl
  console.log('[5] 打包 muggle_ocr')
  const muggleDir = path.join(TEMP_DIR, 'muggle_ocr')
  const muggleZip = path.join(PROJECT, 'resources', 'muggle_ocr-main.zip')

  if (!fs.existsSync(muggleZip)) {
    console.log('  ⚠ muggle_ocr-main.zip 未找到，跳过打包')
    console.log('  请将 muggle_ocr 源码 zip 放到 resources/muggle_ocr-main.zip')
    return  // skip pip wheel below
  }

  // 清掉上次失败残留，重新解压
  if (fs.existsSync(muggleDir)) {
    fs.rmSync(muggleDir, { recursive: true, force: true })
  }
  run(IS_WIN
    ? `powershell -Command "Expand-Archive '${muggleZip}' '${muggleDir}' -Force"`
    : `unzip -o "${muggleZip}" -d "${muggleDir}"`)

  // GitHub zip 解压后多一层目录（如 muggle_ocr-main/），上移内容
  const topEntries = fs.readdirSync(muggleDir).filter(f => !f.startsWith('.'))
  if (topEntries.length === 1 && fs.statSync(path.join(muggleDir, topEntries[0])).isDirectory()) {
    const nested = path.join(muggleDir, topEntries[0])
    for (const f of fs.readdirSync(nested)) {
      fs.renameSync(path.join(nested, f), path.join(muggleDir, f))
    }
    fs.rmdirSync(nested)
    console.log('  ✓ 已展开嵌套目录')
  }

  run(`"${CONFIG.pythonExe}" -m pip wheel -w "${WHLS_DIR}" "${muggleDir}"`)

  console.log('\n=== 完成 ===')
  console.log(`whls: ${WHLS_DIR}`)
  console.log(`python: ${CONFIG.pythonExe}`)
}

main().catch(e => { console.error(e); process.exit(1) })

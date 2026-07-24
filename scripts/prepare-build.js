/**
 * 构建前准备脚本
 * 1. 验证根密钥（必须存在 root-keys/root_public.pem）
 * 2. 复制 Chromium 到构建目录
 */

const fs = require('fs')
const path = require('path')
const { platform, arch } = require('os')

// Chromium 文件映射
const CHROMIUM_FILES = {
  'win32-x64': 'chrome-win64.zip',
  'linux-x64': 'chrome-linux64.zip',
  'darwin-x64': 'chrome-mac-x64.zip',
  'darwin-arm64': 'chrome-mac-arm64.zip'
}

// 低版本 Chromium（用于 Win7 或旧系统）
const CHROMIUM_LEGACY_FILES = {
  'win32-x64': 'ungoogled-chromium_109.0.5414.120-1.1_windows_x64.zip'
}

const PROJECT_ROOT = path.resolve(__dirname, '..')
const CHROMIUMS_DIR = path.join(PROJECT_ROOT, 'chromiums')
const BUILD_CHROMIUM_DIR = path.join(PROJECT_ROOT, 'build-chromium')

function getTargetPlatform(targetArg) {
  // 解析命令行参数
  if (targetArg) {
    const validPlatforms = ['win32', 'darwin', 'linux', 'win', 'mac', 'windows', 'macos']
    const normalized = targetArg.toLowerCase().replace('windows', 'win32').replace('mac', 'darwin').replace('macos', 'darwin')
    if (normalized === 'win') return 'win32'
    if (validPlatforms.includes(normalized)) return normalized
  }
  
  // 默认使用当前系统
  return platform()
}

function getTargetArch(archArg) {
  if (archArg) {
    const normalized = archArg.toLowerCase()
    if (normalized === 'x64' || normalized === 'x86_64' || normalized === 'amd64') return 'x64'
    if (normalized === 'arm64' || normalized === 'aarch64') return 'arm64'
  }
  
  // 默认使用当前架构
  const currentArch = arch()
  return currentArch === 'arm64' ? 'arm64' : 'x64'
}

function prepareChromium(targetPlatform, targetArch, useLegacy = false) {
  const platformKey = `${targetPlatform}-${targetArch}`
  
  console.log('========================================')
  console.log('准备构建资源')
  console.log('========================================')
  console.log(`目标平台: ${targetPlatform}`)
  console.log(`目标架构: ${targetArch}`)
  console.log(`平台标识: ${platformKey}`)
  
  // 确定要使用的 Chromium 文件
  let chromiumFile = useLegacy 
    ? CHROMIUM_LEGACY_FILES[platformKey]
    : CHROMIUM_FILES[platformKey]
  
  if (!chromiumFile) {
    console.error(`错误: 不支持的平台 ${platformKey}`)
    console.log('支持的平台:')
    Object.keys(CHROMIUM_FILES).forEach(key => console.log(`  - ${key}`))
    process.exit(1)
  }
  
  const sourcePath = path.join(CHROMIUMS_DIR, chromiumFile)
  
  // 检查源文件是否存在
  if (!fs.existsSync(sourcePath)) {
    console.error(`错误: Chromium 文件不存在: ${sourcePath}`)
    console.log('请确保 chromiums 目录中包含对应的文件')
    process.exit(1)
  }
  
  // 获取文件大小
  const stats = fs.statSync(sourcePath)
  const sizeMB = (stats.size / 1024 / 1024).toFixed(2)
  
  console.log(`Chromium 文件: ${chromiumFile}`)
  console.log(`文件大小: ${sizeMB} MB`)
  
  // 创建构建目录
  if (!fs.existsSync(BUILD_CHROMIUM_DIR)) {
    fs.mkdirSync(BUILD_CHROMIUM_DIR, { recursive: true })
  }
  
  // 清理旧文件
  const existingFiles = fs.readdirSync(BUILD_CHROMIUM_DIR)
  existingFiles.forEach(file => {
    if (file !== chromiumFile) {
      const filePath = path.join(BUILD_CHROMIUM_DIR, file)
      console.log(`删除旧文件: ${file}`)
      fs.rmSync(filePath, { recursive: true, force: true })
    }
  })
  
  // 检查目标文件是否已存在（避免重复复制）
  const destPath = path.join(BUILD_CHROMIUM_DIR, chromiumFile)
  if (fs.existsSync(destPath)) {
    console.log(`文件已存在，跳过复制: ${chromiumFile}`)
  } else {
    // 复制文件（使用硬链接或符号链接提高速度，失败则复制）
    console.log(`复制文件到构建目录...`)
    try {
      // 尝试硬链接（更快）
      fs.linkSync(sourcePath, destPath)
      console.log('使用硬链接复制')
    } catch (e) {
      // 硬链接失败，使用普通复制
      fs.copyFileSync(sourcePath, destPath)
      console.log('使用文件复制')
    }
  }
  
  console.log('========================================')
  console.log('构建资源准备完成!')
  console.log(`打包文件: build-chromium/${chromiumFile}`)
  console.log('========================================')
  
  return chromiumFile
}

// 解析命令行参数
const args = process.argv.slice(2)
let targetPlatform = null
let targetArch = null
let useLegacy = false

args.forEach(arg => {
  if (arg === '--legacy' || arg === '--win7') {
    useLegacy = true
  } else if (arg.startsWith('--arch=')) {
    targetArch = arg.split('=')[1]
  } else if (!arg.startsWith('--')) {
    targetPlatform = arg
  }
})

targetPlatform = getTargetPlatform(targetPlatform)
targetArch = getTargetArch(targetArch)

// ─── 验证根密钥（v1.0 必须） ─────────────────────────────
function validateRootKeys() {
  const rootKeysDir = path.join(PROJECT_ROOT, 'root-keys')
  const publicKeyPath = path.join(rootKeysDir, 'root_public.pem')
  const privateKeyPath = path.join(rootKeysDir, 'root_private.pem')

  console.log('\n========================================')
  console.log('验证根密钥')
  console.log('========================================')

  if (!fs.existsSync(publicKeyPath)) {
    console.error('错误: 根公钥不存在!')
    console.error(`  路径: ${publicKeyPath}`)
    console.error('')
    console.error('请先生成根密钥对:')
    console.error('  node -e "const c=require(\'crypto\');const f=require(\'fs\');')
    console.error('    f.mkdirSync(\'root-keys\',{recursive:true});')
    console.error('    const k=c.generateKeyPairSync(\'rsa\',{modulusLength:4096,')
    console.error('      publicKeyEncoding:{type:\'spki\',format:\'pem\'},')
    console.error('      privateKeyEncoding:{type:\'pkcs8\',format:\'pem\'}});')
    console.error('    f.writeFileSync(\'root-keys/root_private.pem\',k.privateKey);')
    console.error('    f.writeFileSync(\'root-keys/root_public.pem\',k.publicKey)"')
    console.error('')
    process.exit(1)
  }

  if (!fs.existsSync(privateKeyPath)) {
    console.warn('警告: 根私钥不存在 (仅影响离线恢复功能)')
    console.warn(`  路径: ${privateKeyPath}`)
  }

  console.log(`  ✓ 根公钥: ${publicKeyPath}`)
  if (fs.existsSync(privateKeyPath)) {
    console.log(`  ✓ 根私钥: ${privateKeyPath}`)
  }
  console.log('========================================\n')
}

validateRootKeys()

// ─── 验证 Tesseract 语言数据 ────────────────────────────
function validateTessdata() {
  const tessdataDir = path.join(PROJECT_ROOT, 'resources', 'tessdata')
  const traineddataPath = path.join(tessdataDir, 'eng.traineddata')

  console.log('\n========================================')
  console.log('验证 Tesseract 语言数据')
  console.log('========================================')

  if (!fs.existsSync(traineddataPath)) {
    console.error('错误: Tesseract 语言数据不存在!')
    console.error(`  路径: ${traineddataPath}`)
    console.error('')
    console.error('请下载 eng.traineddata (~18MB):')
    console.error('  curl -L -o "' + traineddataPath + '" https://github.com/tesseract-ocr/tessdata/raw/main/eng.traineddata')
    console.error('  # 或运行: npx tsx scripts/download-tessdata.ts')
    console.error('')
    process.exit(1)
  }

  const sizeMB = (fs.statSync(traineddataPath).size / 1024 / 1024).toFixed(2)
  console.log(`  ✓ eng.traineddata (${sizeMB} MB)`)
  console.log('========================================\n')
}

validateTessdata()

// ─── 便携 Python 运行时 (muggle_ocr) ─────────────────────
// 用户提供: python zip + muggle_ocr-main.zip → 本函数自动下载 whl 并打包
function setupPythonRuntime(targetPlatform) {
  const isWin = targetPlatform === 'win32'
  const PYTHON_SRC = path.join(PROJECT_ROOT, 'resources', 'python')
  const RUNTIME_DIR = path.join(PROJECT_ROOT, 'resources', 'python-runtime')
  const WHLS_DIR = path.join(PYTHON_SRC, 'whls')
  const PIP_MIRROR = 'https://pypi.tuna.tsinghua.edu.cn/simple'

  let pythonExe, pythonArchive

  if (isWin) {
    pythonArchive = path.join(PYTHON_SRC, 'python-3.10.11-embed-amd64.zip')
    pythonExe = path.join(RUNTIME_DIR, 'python.exe')
  } else {
    pythonArchive = path.join(PYTHON_SRC, 'cpython-3.10.15-x86_64-linux.tar.gz')
    pythonExe = path.join(RUNTIME_DIR, 'bin', 'python3')
  }

  const muggleZip = path.join(PROJECT_ROOT, 'resources', 'muggle_ocr-main.zip')

  console.log('\n========================================')
  console.log(`muggle_ocr 运行时 (${isWin ? 'Windows' : 'Linux'})`)
  console.log('========================================')

  // 1. 解压 Python
  if (fs.existsSync(pythonExe)) {
    console.log('  ✓ Python 已就绪')
  } else if (!fs.existsSync(pythonArchive)) {
    console.log('  ⚠ 未找到便携 Python，跳过')
    console.log('========================================\n')
    return
  } else {
    console.log('  解压 Python...')
    fs.mkdirSync(RUNTIME_DIR, { recursive: true })
    if (isWin) {
      require('child_process').execSync(`powershell -Command "Expand-Archive '${pythonArchive}' '${RUNTIME_DIR}' -Force"`, { stdio: 'inherit' })
      fs.writeFileSync(path.join(RUNTIME_DIR, 'python310._pth'), 'python310.zip\n.\nLib\\site-packages\n\nimport site\n')
    } else {
      require('child_process').execSync(`tar xzf "${pythonArchive}" -C "${RUNTIME_DIR}" --strip-components=1`, { stdio: 'inherit' })
    }
    console.log('  ✓ 解压完成')
  }

  // 2. pip（install_only 不带 pip，需引导）
  const getPipPath = path.join(PYTHON_SRC, 'get-pip.py')
  if (!fs.existsSync(getPipPath)) {
    // 自动下载 get-pip.py
    console.log('  下载 get-pip.py...')
    try {
      require('child_process').execSync(
        `"${pythonExe}" -c "import urllib.request; urllib.request.urlretrieve('https://bootstrap.pypa.io/get-pip.py', '${getPipPath.replace(/\\/g, '\\\\')}')"`,
        { stdio: 'inherit', timeout: 30000 }
      )
    } catch {
      console.log('  ⚠ get-pip.py 下载失败，请手动放入 resources/python/get-pip.py')
      console.log('========================================\n')
      return
    }
  }
  if (isWin) {
    require('child_process').execSync(`"${pythonExe}" "${getPipPath}" --no-warn-script-location`, { stdio: 'inherit' })
  } else {
    // cpython-standalone install_only 无 pip，用 get-pip.py 引导
    require('child_process').execSync(`"${pythonExe}" "${getPipPath}" --no-warn-script-location`, { stdio: 'inherit' })
  }

  // 3. 下载 whl（国内源，解析目标平台依赖）
  console.log('  下载 whl (目标平台: ' + targetPlatform + ')...')
  fs.mkdirSync(WHLS_DIR, { recursive: true })
  for (const f of fs.readdirSync(WHLS_DIR)) { if (f.endsWith('.whl')) fs.unlinkSync(path.join(WHLS_DIR, f)) }
  require('child_process').execSync(
    `"${pythonExe}" -m pip download -d "${WHLS_DIR}" -i ${PIP_MIRROR} pip setuptools wheel numpy pillow opencv-python pyyaml tensorflow`,
    { stdio: 'inherit' }
  )

  // 4. muggle_ocr → whl
  if (!fs.existsSync(muggleZip)) {
    console.log('  ⚠ muggle_ocr-main.zip 未找到，放入 resources/')
    console.log('========================================\n')
    return
  }
  const muggleDir = path.join(PROJECT_ROOT, 'temp', 'muggle_ocr')
  console.log('  打包 muggle_ocr → whl...')

  // 清上次残留 + 解压
  if (fs.existsSync(muggleDir)) fs.rmSync(muggleDir, { recursive: true, force: true })
  require('child_process').execSync(
    isWin
      ? `powershell -Command "Expand-Archive '${muggleZip}' '${muggleDir}' -Force"`
      : `unzip -o "${muggleZip}" -d "${muggleDir}"`,
    { stdio: 'inherit' }
  )

  // GitHub zip 解压后多一层目录，上移内容
  const topEntries = fs.readdirSync(muggleDir).filter(f => !f.startsWith('.'))
  if (topEntries.length === 1 && fs.statSync(path.join(muggleDir, topEntries[0])).isDirectory()) {
    const nested = path.join(muggleDir, topEntries[0])
    for (const f of fs.readdirSync(nested)) {
      const src = path.join(nested, f)
      const dst = path.join(muggleDir, f)
      try { fs.renameSync(src, dst) } catch {
        fs.cpSync(src, dst, { recursive: true })
        fs.rmSync(src, { recursive: true, force: true })
      }
    }
    fs.rmdirSync(nested)
    console.log('  ✓ 已展开嵌套目录')
  }

  require('child_process').execSync(`"${pythonExe}" -m pip wheel -w "${WHLS_DIR}" --no-index --find-links "${WHLS_DIR}" "${muggleDir}"`, { stdio: 'inherit' })

  // 5. 安装到 runtime（开发模式需要，否则 import muggle_ocr 失败）
  console.log('  安装到 runtime...')
  require('child_process').execSync(
    `"${pythonExe}" -m pip install --no-index --find-links "${WHLS_DIR}" numpy pillow opencv-python pyyaml tensorflow muggle_ocr`,
    { stdio: 'inherit', timeout: 300000 }
  )
  console.log('  ✓ muggle_ocr 已安装到 runtime')
  console.log('========================================\n')
}

setupPythonRuntime(targetPlatform)

// 复制 Python 素材到 dist-electron/（electron-builder 打包用）
const PYTHON_SRC = path.join(PROJECT_ROOT, 'resources', 'python')
const PYTHON_DST = path.join(PROJECT_ROOT, 'dist-electron', 'python-resources')
console.log('\n复制 Python 素材到 dist-electron/')
if (!fs.existsSync(PYTHON_DST)) fs.mkdirSync(PYTHON_DST, { recursive: true })

const copyItems = ['whls', 'muggleOCR.py', 'get-pip.py']
if (targetPlatform === 'win32') copyItems.push('python-3.10.11-embed-amd64.zip')
if (targetPlatform === 'linux') copyItems.push('cpython-3.10.15-x86_64-linux.tar.gz')

for (const item of copyItems) {
  const s = path.join(PYTHON_SRC, item)
  const d = path.join(PYTHON_DST, item)
  if (!fs.existsSync(s)) { console.log('  ⚠', item, 'not found'); continue }
  if (fs.statSync(s).isDirectory()) {
    require('child_process').execSync(
      process.platform === 'win32' ? `xcopy /E /Y /Q "${s}" "${d}\\"` : `cp -r "${s}/." "${d}"`,
      { stdio: 'ignore' }
    )
  } else {
    fs.copyFileSync(s, d)
  }
  console.log('  ✓', item)
}

// 执行准备
prepareChromium(targetPlatform, targetArch, useLegacy)
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

// 执行准备
prepareChromium(targetPlatform, targetArch, useLegacy)
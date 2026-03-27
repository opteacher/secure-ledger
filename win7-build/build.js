/**
 * Windows 7 构建脚本
 * 
 * 此脚本用于构建 Windows 7 兼容版本：
 * 1. 备份原始 package.json 和 package-lock.json
 * 2. 切换到 Win7 兼容的依赖版本
 * 3. 安装依赖
 * 4. 构建
 * 5. 恢复原始配置
 */

const { execSync } = require('child_process')
const { copyFileSync, renameSync, existsSync, unlinkSync, readFileSync, writeFileSync } = require('fs')
const { join } = require('path')

const ROOT_DIR = join(__dirname, '..')
const WIN7_DIR = join(ROOT_DIR, 'win7-build')

// 文件路径
const PACKAGE_JSON = join(ROOT_DIR, 'package.json')
const PACKAGE_LOCK = join(ROOT_DIR, 'package-lock.json')
const PACKAGE_JSON_BAK = join(ROOT_DIR, 'package.json.bak')
const PACKAGE_LOCK_BAK = join(ROOT_DIR, 'package-lock.json.bak')
const WIN7_PACKAGE = join(WIN7_DIR, 'package.json')

// Chromium 文件路径
const CHROMIUMS_DIR = join(ROOT_DIR, 'chromiums')
const CHROMIUM_WIN7 = join(CHROMIUMS_DIR, 'ungoogled-chromium_109.0.5414.120-1.1_windows_x64.zip')
const CHROMIUM_NORMAL = join(CHROMIUMS_DIR, 'chrome-win64.zip')
const CHROMIUM_NORMAL_BAK = join(CHROMIUMS_DIR, 'chrome-win64-normal.zip')

// chromium.ts 路径
const CHROMIUM_TS = join(ROOT_DIR, 'electron', 'backend', 'services', 'chromium.ts')
const CHROMIUM_TS_BAK = join(ROOT_DIR, 'electron', 'backend', 'services', 'chromium.ts.bak')

console.log('========================================')
console.log('Windows 7 兼容版本构建脚本')
console.log('========================================\n')

try {
  // Step 1: 备份原始配置
  console.log('[1/7] 备份原始配置...')
  if (existsSync(PACKAGE_JSON)) {
    copyFileSync(PACKAGE_JSON, PACKAGE_JSON_BAK)
  }
  if (existsSync(PACKAGE_LOCK)) {
    copyFileSync(PACKAGE_LOCK, PACKAGE_LOCK_BAK)
  }
  if (existsSync(CHROMIUM_TS)) {
    copyFileSync(CHROMIUM_TS, CHROMIUM_TS_BAK)
  }
  
  // Step 2: 切换到 Win7 配置
  console.log('[2/7] 切换到 Win7 依赖配置...')
  copyFileSync(WIN7_PACKAGE, PACKAGE_JSON)
  
  // 删除旧的 lock 文件以重新生成
  if (existsSync(PACKAGE_LOCK)) {
    unlinkSync(PACKAGE_LOCK)
  }
  
  // Step 3: 备份并切换 Chromium
  console.log('[3/7] 切换 Chromium 到 Win7 兼容版本...')
  if (existsSync(CHROMIUM_NORMAL)) {
    renameSync(CHROMIUM_NORMAL, CHROMIUM_NORMAL_BAK)
  }
  if (existsSync(CHROMIUM_WIN7)) {
    // 复制并重命名为 chrome-win64.zip（chromium.ts 期望的文件名）
    copyFileSync(CHROMIUM_WIN7, CHROMIUM_NORMAL)
    console.log('  已切换到 Chromium 109 for Win7')
  } else {
    console.error('  错误: 未找到 Chromium 109 文件!')
    console.error(`  期望路径: ${CHROMIUM_WIN7}`)
    process.exit(1)
  }
  
  // Step 4: 修改 chromium.ts 的 exePath（Win7 版本目录结构不同）
  console.log('[4/7] 修改 chromium.ts 配置...')
  let chromiumTs = readFileSync(CHROMIUM_TS, 'utf-8')
  // 替换 Windows 配置的 exePath
  chromiumTs = chromiumTs.replace(
    /'win32-x64':\s*\{\s*fileName:\s*'chrome-win64\.zip',\s*exePath:\s*'chrome-win64\/chrome\.exe'\s*\}/,
    `'win32-x64': {
    fileName: 'chrome-win64.zip',
    exePath: 'ungoogled-chromium_109.0.5414.120-1.1_windows/chrome.exe'
  }`
  )
  writeFileSync(CHROMIUM_TS, chromiumTs)
  
  // Step 5: 安装依赖
  console.log('[5/7] 安装 Win7 兼容依赖...')
  execSync('npm install', { stdio: 'inherit', cwd: ROOT_DIR })
  
  // Step 6: 构建
  console.log('[6/7] 构建 Win7 版本...')
  execSync('npm run build:win7', { stdio: 'inherit', cwd: ROOT_DIR })
  
  console.log('\n========================================')
  console.log('Win7 构建完成!')
  console.log('输出: release/密钥终端-1.0.0-win7-setup.exe')
  console.log('========================================')
  
} catch (error) {
  console.error('构建失败:', error.message)
  process.exit(1)
} finally {
  // Step 7: 恢复原始配置
  console.log('\n[7/7] 恢复原始配置...')
  
  // 恢复 package.json
  if (existsSync(PACKAGE_JSON_BAK)) {
    copyFileSync(PACKAGE_JSON_BAK, PACKAGE_JSON)
    unlinkSync(PACKAGE_JSON_BAK)
  }
  
  // 恢复 package-lock.json
  if (existsSync(PACKAGE_LOCK_BAK)) {
    copyFileSync(PACKAGE_LOCK_BAK, PACKAGE_LOCK)
    unlinkSync(PACKAGE_LOCK_BAK)
  } else if (existsSync(PACKAGE_LOCK)) {
    unlinkSync(PACKAGE_LOCK)
  }
  
  // 恢复 Chromium 文件
  if (existsSync(CHROMIUM_NORMAL_BAK)) {
    if (existsSync(CHROMIUM_NORMAL)) {
      unlinkSync(CHROMIUM_NORMAL)
    }
    renameSync(CHROMIUM_NORMAL_BAK, CHROMIUM_NORMAL)
  }
  
  // 恢复 chromium.ts
  if (existsSync(CHROMIUM_TS_BAK)) {
    copyFileSync(CHROMIUM_TS_BAK, CHROMIUM_TS)
    unlinkSync(CHROMIUM_TS_BAK)
  }
  
  // 重新安装原始依赖
  console.log('重新安装原始依赖...')
  execSync('npm install', { stdio: 'inherit', cwd: ROOT_DIR })
  
  console.log('原始配置已恢复!')
}
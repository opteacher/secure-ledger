/**
 * Windows 7 构建脚本
 * 
 * 此脚本用于构建 Windows 7 兼容版本：
 * 1. 使用 git stash 保存当前修改
 * 2. 切换到 Win7 兼容的依赖版本
 * 3. 替换 automation.ts 为 Win7 兼容版本
 * 4. 安装依赖
 * 5. 构建
 * 6. 使用 git stash 恢复原始配置
 */

const { execSync } = require('child_process')
const { copyFileSync, renameSync, existsSync, unlinkSync, readFileSync, writeFileSync } = require('fs')
const { join } = require('path')

const ROOT_DIR = join(__dirname, '..')
const WIN7_DIR = join(ROOT_DIR, 'win7-build')

// 文件路径
const PACKAGE_JSON = join(ROOT_DIR, 'package.json')
const PACKAGE_LOCK = join(ROOT_DIR, 'package-lock.json')
const WIN7_PACKAGE = join(WIN7_DIR, 'package.json')

// Chromium 文件路径
const CHROMIUMS_DIR = join(ROOT_DIR, 'chromiums')
const CHROMIUM_WIN7 = join(CHROMIUMS_DIR, 'ungoogled-chromium_109.0.5414.120-1.1_windows_x64.zip')
const CHROMIUM_NORMAL = join(CHROMIUMS_DIR, 'chrome-win64.zip')
const CHROMIUM_NORMAL_BAK = join(CHROMIUMS_DIR, 'chrome-win64-normal.zip')

// chromium.ts 路径
const CHROMIUM_TS = join(ROOT_DIR, 'electron', 'backend', 'services', 'chromium.ts')

// automation.ts 路径（Win7 兼容版）
const AUTOMATION_TS = join(ROOT_DIR, 'electron', 'backend', 'services', 'automation.ts')
const AUTOMATION_WIN7 = join(WIN7_DIR, 'automation-win7.ts')

// 执行命令
function run(cmd, options = {}) {
  console.log(`  > ${cmd}`)
  execSync(cmd, { stdio: 'inherit', cwd: ROOT_DIR, ...options })
}

console.log('========================================')
console.log('Windows 7 兼容版本构建脚本')
console.log('========================================\n')

let stashCreated = false
let needRestore = false

try {
  // Step 1: 不再使用 git stash，因为前端代码需要保留新功能
  console.log('[1/8] 准备 Win7 构建环境...')
  console.log('  前端代码保持当前状态（包含应用锁定功能）')
  
  // Step 2: 切换到 Win7 配置
  console.log('[2/8] 切换到 Win7 依赖配置...')
  copyFileSync(WIN7_PACKAGE, PACKAGE_JSON)
  
  // 删除旧的 lock 文件以重新生成
  if (existsSync(PACKAGE_LOCK)) {
    unlinkSync(PACKAGE_LOCK)
  }
  
  // Step 3: 备份并切换 Chromium
  console.log('[3/8] 切换 Chromium 到 Win7 兼容版本...')
  if (existsSync(CHROMIUM_NORMAL)) {
    renameSync(CHROMIUM_NORMAL, CHROMIUM_NORMAL_BAK)
  }
  if (existsSync(CHROMIUM_WIN7)) {
    copyFileSync(CHROMIUM_WIN7, CHROMIUM_NORMAL)
    console.log('  已切换到 Chromium 109 for Win7')
  } else {
    console.error('  错误: 未找到 Chromium 109 文件!')
    console.error(`  期望路径: ${CHROMIUM_WIN7}`)
    process.exit(1)
  }
  
  // Step 4: 修改 chromium.ts 的 exePath
  console.log('[4/8] 修改 chromium.ts 配置...')
  let chromiumTs = readFileSync(CHROMIUM_TS, 'utf-8')
  chromiumTs = chromiumTs.replace(
    /'win32-x64':\s*\{\s*fileName:\s*'chrome-win64\.zip',\s*exePath:\s*'chrome-win64\/chrome\.exe'\s*\}/,
    `'win32-x64': {
    fileName: 'chrome-win64.zip',
    exePath: 'ungoogled-chromium_109.0.5414.120-1.1_windows/chrome.exe'
  }`
  )
  writeFileSync(CHROMIUM_TS, chromiumTs)
  
  // Step 5: 替换 automation.ts 为 Win7 兼容版本
  console.log('[5/8] 替换 automation.ts 为 Win7 兼容版本...')
  if (existsSync(AUTOMATION_WIN7)) {
    copyFileSync(AUTOMATION_WIN7, AUTOMATION_TS)
    console.log('  已使用 puppeteer 19.x 兼容的 automation.ts')
  } else {
    console.error('  错误: 未找到 Win7 兼容版 automation.ts!')
    console.error(`  期望路径: ${AUTOMATION_WIN7}`)
    process.exit(1)
  }
  
  needRestore = true
  
  // Step 6: 安装依赖
  console.log('[6/8] 安装 Win7 兼容依赖...')
  run('npm install')
  
  // Step 7: 构建
  console.log('[7/8] 构建 Win7 版本...')
  run('npm run build:win7')
  
  console.log('\n========================================')
  console.log('Win7 构建完成!')
  console.log('输出: release/密钥终端-1.0.3-win7-setup.exe')
  console.log('========================================')
  
} catch (error) {
  console.error('构建失败:', error.message)
  process.exitCode = 1
} finally {
  if (needRestore) {
    // Step 8: 恢复原始配置
    console.log('\n[8/8] 恢复原始配置...')
    
    // 恢复 Chromium 文件
    if (existsSync(CHROMIUM_NORMAL_BAK)) {
      if (existsSync(CHROMIUM_NORMAL)) {
        unlinkSync(CHROMIUM_NORMAL)
      }
      renameSync(CHROMIUM_NORMAL_BAK, CHROMIUM_NORMAL)
    }
    
    // 使用 git checkout 只恢复后端文件，不恢复前端代码
    try {
      run('git checkout -- package.json package-lock.json electron/backend/services/chromium.ts electron/backend/services/automation.ts')
    } catch (e) {
      console.log('  git checkout 失败，尝试其他方式...')
    }
    
    // 重新安装原始依赖
    console.log('  重新安装原始依赖...')
    try {
      run('npm install')
    } catch (e) {
      console.log('  npm install 失败，请手动执行')
    }
  }
  
  console.log('原始配置已恢复!')
}
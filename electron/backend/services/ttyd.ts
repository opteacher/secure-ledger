import { app } from 'electron'
import { join } from 'path'
import { existsSync, chmodSync, mkdirSync, createWriteStream, unlinkSync } from 'fs'
import { platform, arch } from 'os'
import { spawn, ChildProcess, execSync } from 'child_process'
import https from 'https'

// ttyd 版本
const TTYD_VERSION = '1.7.7'

// PuTTY 版本
const PUTTY_VERSION = '0.83'

// ttyd 可执行文件名映射
const TTYD_BINARIES: Record<string, string> = {
  'win32-x64': 'ttyd.win32.exe',
  'win32-ia32': 'ttyd.win32.exe',
  'linux-x64': 'ttyd.x86_64',
  'linux-arm64': 'ttyd.aarch64',
  'linux-arm': 'ttyd.arm',
  'linux-armhf': 'ttyd.armhf',
  'linux-ia32': 'ttyd.i686',
  'darwin-x64': 'ttyd.x86_64',
  'darwin-arm64': 'ttyd.aarch64',
}

// ttyd 下载 URL 映射 (GitHub Releases) - 用于备用下载
const TTYD_DOWNLOAD_URLS: Record<string, string> = {
  'win32-x64': `https://github.com/tsl0922/ttyd/releases/download/${TTYD_VERSION}/ttyd.win32.exe`,
  'win32-ia32': `https://github.com/tsl0922/ttyd/releases/download/${TTYD_VERSION}/ttyd.win32.exe`,
  'linux-x64': `https://github.com/tsl0922/ttyd/releases/download/${TTYD_VERSION}/ttyd.x86_64`,
  'linux-arm64': `https://github.com/tsl0922/ttyd/releases/download/${TTYD_VERSION}/ttyd.aarch64`,
  'linux-arm': `https://github.com/tsl0922/ttyd/releases/download/${TTYD_VERSION}/ttyd.arm`,
  'linux-armhf': `https://github.com/tsl0922/ttyd/releases/download/${TTYD_VERSION}/ttyd.armhf`,
  'linux-ia32': `https://github.com/tsl0922/ttyd/releases/download/${TTYD_VERSION}/ttyd.i686`,
  'darwin-x64': `https://github.com/tsl0922/ttyd/releases/download/${TTYD_VERSION}/ttyd.x86_64`,
  'darwin-arm64': `https://github.com/tsl0922/ttyd/releases/download/${TTYD_VERSION}/ttyd.aarch64`,
}

// SSH 配置类型
export interface SSHConfig {
  host: string
  port: number
  username?: string
  password?: string
  keyfilePath?: string
  passphrase?: string
}

// 当前 ttyd 进程
let currentTtydProcess: ChildProcess | null = null

// 获取当前平台的 ttyd 二进制文件名
function getTtydBinaryName(): string | null {
  const currentPlatform = platform()
  const currentArch = arch()
  const key = `${currentPlatform}-${currentArch}`
  return TTYD_BINARIES[key] || null
}

// 获取打包的 ttyd 路径（从 resources/ttyd 目录）
function getBundledTtydPath(): string | null {
  const binaryName = getTtydBinaryName()
  if (!binaryName) {
    return null
  }
  
  // 打包后: resources/ttyd/xxx
  // 开发环境: 项目根目录/ttyd/xxx
  const isDev = process.env['VITE_DEV_SERVER_URL']
  
  if (isDev) {
    // 开发环境
    const devPath = join(__dirname, '..', '..', '..', 'ttyd', binaryName)
    if (existsSync(devPath)) {
      return devPath
    }
  } else {
    // 打包后
    const bundledPath = join(process.resourcesPath, 'ttyd', binaryName)
    if (existsSync(bundledPath)) {
      return bundledPath
    }
  }
  
  return null
}

// 获取用户数据目录中的 ttyd 路径（用于安装/复制）
function getUserDataTtydPath(): string {
  const binaryName = getTtydBinaryName()
  if (!binaryName) {
    throw new Error(`Unsupported platform: ${platform()}-${arch()}`)
  }
  
  // Windows 使用 .exe 后缀
  if (platform() === 'win32') {
    return join(app.getPath('userData'), 'bin', 'ttyd.exe')
  }
  
  return join(app.getPath('userData'), 'bin', 'ttyd')
}

// 检测 PuTTY 是否已安装
export function isPuTTYInstalled(): boolean {
  if (platform() !== 'win32') {
    return false
  }
  
  const puttyPaths = [
    'C:\\Program Files\\PuTTY\\plink.exe',
    'C:\\Program Files (x86)\\PuTTY\\plink.exe',
  ]
  
  for (const p of puttyPaths) {
    if (existsSync(p)) {
      return true
    }
  }
  
  return false
}

// 获取 plink 路径 (Windows) - 优先级：自定义 > 打包版本 > 系统
function getPlinkPath(): string | null {
  if (platform() !== 'win32') {
    return null
  }
  
  // 1. 优先使用自定义路径
  if (customPlinkPath && existsSync(customPlinkPath)) {
    return customPlinkPath
  }
  
  // 2. 系统 PuTTY 安装
  const puttyPaths = [
    'C:\\Program Files\\PuTTY\\plink.exe',
    'C:\\Program Files (x86)\\PuTTY\\plink.exe',
  ]
  
  for (const p of puttyPaths) {
    if (existsSync(p)) {
      return p
    }
  }
  
  // 3. 使用打包的 plink.exe
  const bundledPath = getBundledPlinkPath()
  if (bundledPath) {
    return bundledPath
  }
  
  return null
}

// 导出获取可用 plink 路径（供其他模块使用）
export function getAvailablePlinkPath(): string | null {
  return getPlinkPath()
}

// 获取打包的 sshpass 路径（Linux/macOS）
function getBundledSshpassPath(): string | null {
  if (platform() === 'win32') {
    return null
  }
  
  const binaryName = platform() === 'darwin' ? 'sshpass.darwin' : 'sshpass.linux'
  
  const isDev = process.env['VITE_DEV_SERVER_URL']
  
  if (isDev) {
    const devPath = join(__dirname, '..', '..', '..', 'ttyd', binaryName)
    if (existsSync(devPath)) {
      return devPath
    }
  } else {
    const bundledPath = join(process.resourcesPath, 'ttyd', binaryName)
    if (existsSync(bundledPath)) {
      return bundledPath
    }
  }
  
  return null
}

// 获取打包的 plink.exe 路径（Windows）
function getBundledPlinkPath(): string | null {
  if (platform() !== 'win32') {
    return null
  }
  
  const isDev = process.env['VITE_DEV_SERVER_URL']
  
  if (isDev) {
    const devPath = join(__dirname, '..', '..', '..', 'ttyd', 'plink.exe')
    if (existsSync(devPath)) {
      return devPath
    }
  } else {
    const bundledPath = join(process.resourcesPath, 'ttyd', 'plink.exe')
    if (existsSync(bundledPath)) {
      return bundledPath
    }
  }
  
  return null
}

// 导出获取可用 sshpass 路径（供其他模块使用）
export function getAvailableSshpassPath(): string | null {
  if (platform() === 'win32') {
    return null
  }
  
  // 1. 优先使用自定义路径
  if (customSshpassPath && existsSync(customSshpassPath)) {
    return customSshpassPath
  }
  
  // 2. 系统路径
  try {
    const sshpassPath = execSync('which sshpass', { encoding: 'utf-8' }).trim()
    if (sshpassPath && existsSync(sshpassPath)) {
      return sshpassPath
    }
  } catch {}
  
  // 3. 使用打包的 sshpass
  const bundledPath = getBundledSshpassPath()
  if (bundledPath) {
    return bundledPath
  }
  
  return null
}

// 获取打包的 PuTTY 安装包路径
function getBundledPuTTYPath(): string | null {
  const isDev = process.env['VITE_DEV_SERVER_URL']
  
  if (isDev) {
    const devPath = join(__dirname, '..', '..', '..', 'ttyd', `putty-64bit-${PUTTY_VERSION}-installer.msi`)
    if (existsSync(devPath)) {
      return devPath
    }
  } else {
    const bundledPath = join(process.resourcesPath, 'ttyd', `putty-64bit-${PUTTY_VERSION}-installer.msi`)
    if (existsSync(bundledPath)) {
      return bundledPath
    }
  }
  
  return null
}

// 安装 PuTTY
export async function installPuTTY(): Promise<{ success: boolean; message: string }> {
  if (platform() !== 'win32') {
    return { success: false, message: 'PuTTY only supports Windows' }
  }
  
  // 检查是否已安装
  if (isPuTTYInstalled()) {
    return { success: true, message: 'PuTTY is already installed' }
  }
  
  // 获取安装包路径
  const msiPath = getBundledPuTTYPath()
  if (!msiPath) {
    return { success: false, message: 'PuTTY installer not found' }
  }
  
  console.log('Installing PuTTY:', msiPath)
  
  return new Promise((resolve) => {
    // 使用 msiexec 静默安装
    const installer = spawn('msiexec', [
      '/i', msiPath,
      '/quiet',
      '/norestart'
    ], {
      detached: true,
      stdio: 'ignore'
    })
    
    installer.on('error', (err) => {
      console.error('PuTTY installation failed:', err)
      resolve({ success: false, message: `Installation failed: ${err.message}` })
    })
    
    installer.unref()
    
    // 给安装程序一些时间完成
    setTimeout(() => {
      if (isPuTTYInstalled()) {
        console.log('PuTTY installed successfully')
        resolve({ success: true, message: 'PuTTY installed successfully' })
      } else {
        console.log('PuTTY is being installed, please try again later')
        resolve({ success: true, message: 'PuTTY is being installed, please try again later' })
      }
    }, 5000)
  })
}

// 检查 ttyd 是否可用（可以运行）
export function isTtydAvailable(): boolean {
  const ttydPath = getAvailableTtydPath()
  return ttydPath !== null
}

// 检查 ttyd 是否存在（仅检查文件存在，不验证能否运行）
export function isTtydInstalled(): boolean {
  return getAvailableTtydPath() !== null
}

// 检查 ttyd 是否有 GLIBC 兼容性问题
export function checkTtydCompatibility(): { compatible: boolean; error?: string } {
  const ttydPath = getAvailableTtydPath()
  
  if (!ttydPath) {
    return { compatible: false, error: 'ttyd not installed' }
  }
  
  try {
    // 尝试执行 ttyd --version
    execSync(`"${ttydPath}" --version`, {
      encoding: 'utf-8',
      timeout: 5000
    })
    
    return { compatible: true }
  } catch (e: any) {
    const errorMsg = e.message || ''
    
    // GLIBC 版本不兼容
    if (errorMsg.includes('GLIBC')) {
      const match = errorMsg.match(/GLIBC_(\d+\.\d+)/)
      const requiredVersion = match ? match[1] : 'unknown'
      return { 
        compatible: false, 
        error: `System GLIBC version too low, ttyd requires GLIBC ${requiredVersion}+. Run: sudo apt install ttyd` 
      }
    }
    
    return { compatible: false, error: errorMsg }
  }
}

// 获取可用的 ttyd 路径（优先级：自定义 > 系统版本 > 打包版本）
function getAvailableTtydPath(): string | null {
  // 1. 最优先使用用户自定义的 ttyd 路径
  if (customTtydPath && existsSync(customTtydPath)) {
    try {
      execSync(`"${customTtydPath}" --version`, {
        encoding: 'utf-8',
        timeout: 5000
      })
      console.log('Using custom ttyd:', customTtydPath)
      return customTtydPath
    } catch (e: any) {
      console.warn('Custom ttyd cannot run:', e.message)
    }
  }
  
  // 2. 系统安装的 ttyd
  if (platform() !== 'win32') {
    try {
      const systemTtyd = execSync('which ttyd', { encoding: 'utf-8' }).trim()
      if (systemTtyd && existsSync(systemTtyd)) {
        console.log('Using system ttyd:', systemTtyd)
        return systemTtyd
      }
    } catch {
      // 系统没有安装 ttyd
    }
  }
  
  // 3. 使用打包的 ttyd
  const bundledPath = getBundledTtydPath()
  if (bundledPath) {
    // 验证是否可以运行
    try {
      execSync(`"${bundledPath}" --version`, {
        encoding: 'utf-8',
        timeout: 5000
      })
      console.log('Using bundled ttyd:', bundledPath)
      return bundledPath
    } catch (e: any) {
      if (e.message && e.message.includes('GLIBC')) {
        console.warn('Bundled ttyd GLIBC incompatible')
      } else {
        console.warn('Bundled ttyd cannot run:', e.message)
      }
    }
  }
  
  return null
}

// 下载文件
async function downloadFile(url: string, destPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = createWriteStream(destPath)
    
    const request = (url: string) => {
      https.get(url, (response) => {
        // 处理重定向
        if (response.statusCode === 301 || response.statusCode === 302) {
          const redirectUrl = response.headers.location
          if (redirectUrl) {
            file.close()
            request(redirectUrl)
            return
          }
        }
        
        if (response.statusCode !== 200) {
          file.close()
          unlinkSync(destPath)
          reject(new Error(`Download failed: HTTP ${response.statusCode}`))
          return
        }
        
        response.pipe(file)
        
        file.on('finish', () => {
          file.close()
          resolve()
        })
      }).on('error', (err) => {
        file.close()
        if (existsSync(destPath)) {
          unlinkSync(destPath)
        }
        reject(err)
      })
    }
    
    request(url)
  })
}

// 安装 ttyd（从打包文件复制或从网络下载）
export async function installTtyd(): Promise<{ success: boolean; message: string }> {
  try {
    const platformKey = `${platform()}-${arch()}`
    const binaryName = getTtydBinaryName()
    if (!binaryName) {
      return { success: false, message: `Unsupported platform: ${platform()}-${arch()}` }
    }
    
    const ttydPath = getUserDataTtydPath()
    const ttydDir = join(ttydPath, '..')
    
    // 确保目录存在
    if (!existsSync(ttydDir)) {
      mkdirSync(ttydDir, { recursive: true })
    }
    
    // 1. 首先尝试从打包的 ttyd 复制
    const bundledPath = getBundledTtydPath()
    if (bundledPath) {
      try {
        const { copyFileSync } = await import('fs')
        copyFileSync(bundledPath, ttydPath)
        
        // Linux/macOS 设置可执行权限
        if (platform() !== 'win32') {
          chmodSync(ttydPath, 0o755)
        }
        
        console.log(`ttyd copied from bundled file: ${ttydPath}`)
        return { success: true, message: 'ttyd installed successfully' }
      } catch (copyError: any) {
        console.warn('Failed to copy from bundled file:', copyError.message)
      }
    }
    
    // 2. 从 GitHub 下载
    const downloadUrl = TTYD_DOWNLOAD_URLS[platformKey]
    if (!downloadUrl) {
      return { success: false, message: `Unsupported platform: ${platform()}-${arch()}, please install ttyd manually` }
    }
    
    console.log(`Downloading ttyd: ${downloadUrl}`)
    
    try {
      await downloadFile(downloadUrl, ttydPath)
      console.log(`ttyd downloaded: ${ttydPath}`)
      
      // Linux/macOS 设置可执行权限
      if (platform() !== 'win32') {
        chmodSync(ttydPath, 0o755)
      }
      
      return { success: true, message: 'ttyd installed successfully' }
    } catch (downloadError: any) {
      return { success: false, message: `Failed to download ttyd: ${downloadError.message}, please check network or install manually` }
    }
  } catch (error: any) {
    console.error('ttyd installation failed:', error)
    return { success: false, message: `ttyd installation failed: ${error.message}` }
  }
}

// 确保 ttyd 可用（检测并安装）
export async function ensureTtyd(): Promise<{ installed: boolean; message: string }> {
  // 1. 首先检查是否有可用的 ttyd
  const availablePath = getAvailableTtydPath()
  if (availablePath) {
    return { installed: true, message: 'ttyd is ready' }
  }
  
  // 2. 检查是否是 GLIBC 兼容性问题
  const compat = checkTtydCompatibility()
  if (compat.error && compat.error.includes('GLIBC')) {
    return { 
      installed: false, 
      message: `Bundled ttyd incompatible with system: ${compat.error}` 
    }
  }
  
  // 3. 尝试安装
  const result = await installTtyd()
  if (result.success) {
    // 再次验证
    const afterPath = getAvailableTtydPath()
    if (afterPath) {
      return { installed: true, message: 'ttyd installed successfully' }
    }
    // 安装成功但运行失败，可能是 GLIBC 问题
    const compatAfter = checkTtydCompatibility()
    if (compatAfter.error) {
      return { installed: false, message: compatAfter.error }
    }
    return { installed: false, message: 'ttyd verification failed after installation' }
  }
  
  return { installed: false, message: result.message }
}

// 停止当前 ttyd 进程
export function stopTtyd(): { success: boolean; message: string } {
  if (currentTtydProcess) {
    try {
      currentTtydProcess.kill()
      currentTtydProcess = null
      console.log('ttyd process stopped')
      return { success: true, message: 'ttyd process stopped' }
    } catch (error: any) {
      console.error('Failed to stop ttyd process:', error)
      return { success: false, message: `Failed to stop ttyd process: ${error.message}` }
    }
  }
  return { success: true, message: 'No running ttyd process' }
}

// 启动 ttyd 进程
export function startTtyd(port: number = 7681): { success: boolean; message: string; process?: any } {
  try {
    const ttydPath = getAvailableTtydPath()
    
    if (!ttydPath) {
      const compat = checkTtydCompatibility()
      if (compat.error && compat.error.includes('GLIBC')) {
        return { success: false, message: compat.error }
      }
      return { success: false, message: 'ttyd 未安装，请在设置中安装或运行: sudo apt install ttyd' }
    }
    
    // 停止现有进程
    stopTtyd()
    
    // 启动 ttyd
    const ttydProcess = spawn(ttydPath, ['-p', String(port), '-W', 'bash'], {
      detached: true,
      stdio: 'ignore'
    })
    
    currentTtydProcess = ttydProcess
    ttydProcess.unref()
    
    console.log(`ttyd started on port ${port}`)
    return { success: true, message: `ttyd started on port ${port}` }
  } catch (error: any) {
    console.error('ttyd startup failed:', error)
    return { success: false, message: `ttyd startup failed: ${error.message}` }
  }
}

// 启动 ttyd 并连接 SSH
export function startTtydWithSSH(config: SSHConfig): { success: boolean; message: string; port?: number } {
  try {
    const ttydPath = getAvailableTtydPath()
    
    if (!ttydPath) {
      const compat = checkTtydCompatibility()
      if (compat.error && compat.error.includes('GLIBC')) {
        return { success: false, message: compat.error }
      }
      return { success: false, message: 'ttyd not installed, please install in settings or run: sudo apt install ttyd' }
    }
    
    // 验证配置 - 只需要主机地址
    if (!config.host) {
      return { success: false, message: 'Missing host address' }
    }
    
    // 停止现有进程
    stopTtyd()
    
    const port = 7681
    const sshPort = config.port || 22
    const currentPlatform = platform()
    
    // ttyd 基础参数
    const ttydArgs: string[] = [
      '-p', String(port),
      '-W',  // 允许用户输入
      '--once'
    ]
    
    if (currentPlatform === 'win32') {
      // ========== Windows: 使用 plink ==========
      const plinkPath = getPlinkPath()
      
      // 如果需要密码认证且没有密钥文件，检查 plink
      if ((config.password || config.passphrase) && !config.keyfilePath) {
        if (!plinkPath) {
          return { 
            success: false, 
            message: 'NEED_PUTTY:Password login requires PuTTY (includes plink tool), or use key file for login',
            port: undefined
          }
        }
        
        // 使用 plink 命令（直接使用 plink，假设已在 PATH 中）
        const plinkArgs: string[] = [
          'plink',
          '-ssh',
          config.username ? `${config.username}@${config.host}` : config.host,
          '-P', String(sshPort),
          '-pw', config.passphrase || config.password || '',
          '-batch' // 批处理模式，不提示
        ]
        
        ttydArgs.push(...plinkArgs)
        console.log('Windows: Using plink for password login')
      } else {
        // 使用 OpenSSH ssh 命令（密钥文件或无密码）
        const sshArgs: string[] = ['ssh']
        sshArgs.push('-o', 'StrictHostKeyChecking=no')
        sshArgs.push('-o', 'UserKnownHostsFile=NUL')
        
        if (config.keyfilePath) {
          sshArgs.push('-i', config.keyfilePath)
        }
        
        sshArgs.push('-p', String(sshPort))
        sshArgs.push(config.username ? `${config.username}@${config.host}` : config.host)
        
        ttydArgs.push(...sshArgs)
        console.log('Windows: Using OpenSSH ssh command')
      }
    } else {
      // ========== Linux/macOS: 使用 sshpass ==========
      const sshTarget = config.username ? `${config.username}@${config.host}` : config.host
      const needSshpass = config.password || config.passphrase
      
      if (needSshpass && !config.keyfilePath) {
        // 使用 sshpass 传递密码 - 获取可用路径
        const sshpassPath = getAvailableSshpassPath()
        if (!sshpassPath) {
          return { 
            success: false, 
            message: 'sshpass not installed, please install: sudo apt install sshpass or brew install sshpass',
            port: undefined
          }
        }
        ttydArgs.push(sshpassPath, '-p', config.passphrase || config.password || '')
      }
      
      // SSH 命令
      ttydArgs.push('ssh')
      ttydArgs.push('-o', 'StrictHostKeyChecking=no')
      ttydArgs.push('-o', 'UserKnownHostsFile=/dev/null')
      
      // 密钥文件
      if (config.keyfilePath) {
        ttydArgs.push('-i', config.keyfilePath)
      }
      
      // 端口和目标
      ttydArgs.push('-p', String(sshPort))
      ttydArgs.push(sshTarget)
      
      console.log('Linux/macOS: Using sshpass + ssh')
    }
    
    console.log('Starting ttyd command:', ttydPath, ttydArgs.join(' '))
    
    const ttydProcess = spawn(ttydPath, ttydArgs, {
      detached: true,
      stdio: 'ignore'
    })
    
    currentTtydProcess = ttydProcess
    ttydProcess.unref()
    
    console.log(`ttyd SSH session started on port ${port}`)
    return { success: true, message: `SSH connection established`, port }
  } catch (error: any) {
    console.error('ttyd SSH startup failed:', error)
    return { success: false, message: `SSH startup failed: ${error.message}` }
  }
}

// ============ 配置管理 ============

// 自定义路径存储
let customTtydPath: string | null = null
let customPlinkPath: string | null = null

// 获取 ttyd 路径（用于设置显示）
export function getTtydPath(): { path: string | null; source: 'custom' | 'bundled' | 'system' | 'none' } {
  if (customTtydPath && existsSync(customTtydPath)) {
    return { path: customTtydPath, source: 'custom' }
  }
  
  const bundledPath = getBundledTtydPath()
  if (bundledPath) {
    return { path: bundledPath, source: 'bundled' }
  }
  
  if (platform() !== 'win32') {
    try {
      const systemTtyd = execSync('which ttyd', { encoding: 'utf-8' }).trim()
      if (systemTtyd && existsSync(systemTtyd)) {
        return { path: systemTtyd, source: 'system' }
      }
    } catch {}
  }
  
  return { path: null, source: 'none' }
}

// 设置自定义 ttyd 路径
export function setCustomTtydPath(path: string | null): { success: boolean; message: string } {
  if (path && !existsSync(path)) {
    return { success: false, message: 'File does not exist' }
  }
  customTtydPath = path
  return { success: true, message: 'ttyd path updated' }
}

// 获取 plink 路径（用于设置显示）
export function getPlinkPathForDisplay(): { path: string | null; source: 'custom' | 'system' | 'none' } {
  if (customPlinkPath && existsSync(customPlinkPath)) {
    return { path: customPlinkPath, source: 'custom' }
  }
  
  const systemPlink = getPlinkPath()
  if (systemPlink) {
    return { path: systemPlink, source: 'system' }
  }
  
  return { path: null, source: 'none' }
}

// 设置自定义 plink 路径
export function setCustomPlinkPath(path: string | null): { success: boolean; message: string } {
  if (path && !existsSync(path)) {
    return { success: false, message: 'File does not exist' }
  }
  customPlinkPath = path
  return { success: true, message: 'Plink path updated' }
}

// ============ sshpass 配置 (Linux/macOS) ============

// 自定义 sshpass 路径存储
let customSshpassPath: string | null = null

// 获取系统 sshpass 路径
function getSshpassPath(): string | null {
  if (platform() === 'win32') {
    return null // Windows 不支持 sshpass
  }
  try {
    const sshpassPath = execSync('which sshpass', { encoding: 'utf-8' }).trim()
    if (sshpassPath && existsSync(sshpassPath)) {
      return sshpassPath
    }
  } catch {}
  return null
}

// 获取 sshpass 路径（用于设置显示）
export function getSshpassPathForDisplay(): { path: string | null; source: 'custom' | 'system' | 'none' } {
  if (platform() === 'win32') {
    return { path: null, source: 'none' }
  }
  
  if (customSshpassPath && existsSync(customSshpassPath)) {
    return { path: customSshpassPath, source: 'custom' }
  }
  
  const systemSshpass = getSshpassPath()
  if (systemSshpass) {
    return { path: systemSshpass, source: 'system' }
  }
  
  return { path: null, source: 'none' }
}

// 设置自定义 sshpass 路径
export function setCustomSshpassPath(path: string | null): { success: boolean; message: string } {
  if (path && !existsSync(path)) {
    return { success: false, message: 'File does not exist' }
  }
  customSshpassPath = path
  return { success: true, message: 'Sshpass path updated' }
}

// 获取当前平台信息
export function getPlatformInfo(): { 
  platform: 'win32' | 'darwin' | 'linux'
  isWindows: boolean
  isMac: boolean
  isLinux: boolean
} {
  const currentPlatform = platform() as 'win32' | 'darwin' | 'linux'
  return {
    platform: currentPlatform,
    isWindows: currentPlatform === 'win32',
    isMac: currentPlatform === 'darwin',
    isLinux: currentPlatform === 'linux'
  }
}

// 检查 ttyd 服务状态
export function getTtydStatus(): { 
  running: boolean
  port: number | null
  pid: number | null
} {
  if (currentTtydProcess && !currentTtydProcess.killed) {
    return {
      running: true,
      port: 7681, // 默认端口
      pid: currentTtydProcess.pid || null
    }
  }
  return { running: false, port: null, pid: null }
}

// 检查端口占用
export function checkPort(port: number): { 
  inUse: boolean
  process?: { pid: number; name: string }
} {
  try {
    if (platform() === 'win32') {
      // Windows: 使用 netstat
      const output = execSync(`netstat -ano | findstr :${port}`, { encoding: 'utf-8' })
      if (output && output.includes(`:${port}`)) {
        const lines = output.trim().split('\n')
        for (const line of lines) {
          if (line.includes('LISTENING')) {
            const parts = line.trim().split(/\s+/)
            const pid = parseInt(parts[parts.length - 1], 10)
            if (!isNaN(pid)) {
              // 获取进程名
              try {
                const procOutput = execSync(`tasklist /FI "PID eq ${pid}" /NH`, { encoding: 'utf-8' })
                const procParts = procOutput.trim().split(/\s+/)
                const name = procParts[0] || 'unknown'
                return { inUse: true, process: { pid, name } }
              } catch {
                return { inUse: true, process: { pid, name: 'unknown' } }
              }
            }
          }
        }
        return { inUse: true }
      }
    } else {
      // Linux/macOS: 使用 lsof
      const output = execSync(`lsof -i :${port} -t`, { encoding: 'utf-8' })
      if (output.trim()) {
        const pid = parseInt(output.trim().split('\n')[0], 10)
        if (!isNaN(pid)) {
          try {
            const name = execSync(`ps -p ${pid} -o comm=`, { encoding: 'utf-8' }).trim()
            return { inUse: true, process: { pid, name } }
          } catch {
            return { inUse: true, process: { pid, name: 'unknown' } }
          }
        }
        return { inUse: true }
      }
    }
  } catch {
    // 端口未被占用
  }
  return { inUse: false }
}

// 杀掉占用端口的进程
export function killPortProcess(port: number): { success: boolean; message: string } {
  try {
    const portCheck = checkPort(port)
    
    if (!portCheck.inUse) {
      return { success: true, message: '端口未被占用' }
    }
    
    if (!portCheck.process?.pid) {
      return { success: false, message: '无法获取占用端口的进程 PID' }
    }
    
    const pid = portCheck.process.pid
    const procName = portCheck.process.name || 'unknown'
    
    console.log(`Killing process ${procName} (PID: ${pid}) on port ${port}`)
    
    if (platform() === 'win32') {
      // Windows: 使用 taskkill
      execSync(`taskkill /F /PID ${pid}`, { encoding: 'utf-8' })
    } else {
      // Linux/macOS: 使用 kill
      execSync(`kill -9 ${pid}`, { encoding: 'utf-8' })
    }
    
    return { success: true, message: `已终止进程 ${procName} (PID: ${pid})` }
  } catch (e: any) {
    console.error('Failed to kill port process:', e)
    return { success: false, message: `终止进程失败: ${e.message}` }
  }
}
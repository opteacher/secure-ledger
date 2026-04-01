import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'
import { initLogger, logger } from './backend/services/logger'
import { registerAllIPCHandlers } from './backend/ipc'
import { ensureTtyd } from './backend/services/ttyd'
import { ensureChrome, isChromeInstalled } from './backend/services/chromium'


const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// 开发环境检测
const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
const RENDERER_DIST = join(__dirname, '..')

let win: BrowserWindow | null = null
let splashWindow: BrowserWindow | null = null

// 初始化日志系统（必须在最前面）
initLogger()
logger.info('Application starting...')

// 发送启动进度到 splash 窗口
function sendSplashProgress(message: string, progress?: number) {
  if (splashWindow && !splashWindow.isDestroyed()) {
    splashWindow.webContents.send('splash:progress', { message, progress })
  }
}

// 检测数据库模块兼容性
async function checkDatabaseModule(): Promise<{ ok: boolean; error?: string }> {
  try {
    // sql.js 是纯 JS 实现，无需检查原生兼容性
    // 只需验证能否正常加载
    await import('sql.js')
    return { ok: true }
  } catch (error: any) {
    const errorMsg = error?.message || String(error)
    return {
      ok: false,
      error: `Failed to load database module: ${errorMsg}`
    }
  }
}

// 显示错误对话框并退出
async function showFatalError(title: string, message: string) {
  await dialog.showErrorBox(title, message)
  app.quit()
}

// 创建启动界面窗口
function createSplashWindow(): BrowserWindow {
  const splash = new BrowserWindow({
    width: 400,
    height: 300,
    frame: false,
    transparent: true,
    resizable: false,
    center: true,
    alwaysOnTop: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  })
  
  // 加载启动界面
  // 开发环境：从 public 目录加载
  // 生产环境：从 dist 目录加载（vite 会复制 public 文件到 dist）
  if (VITE_DEV_SERVER_URL) {
    splash.loadFile(join(RENDERER_DIST, 'public', 'splash.html'))
  } else {
    splash.loadFile(join(RENDERER_DIST, 'dist', 'splash.html'))
  }
  
  return splash
}

async function createWindow() {
  logger.info('Creating main window...')
  
  // 检测数据库模块兼容性
  const dbCheck = await checkDatabaseModule()
  if (!dbCheck.ok) {
    logger.error('Database module check failed:', dbCheck.error)
    await showFatalError('Secure Ledger - Startup Failed', dbCheck.error || 'Unknown error')
    return
  }
  
  win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    icon: join(RENDERER_DIST, 'public', 'logo.svg'),
    title: '密钥终端 - Secure Ledger',
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: false,
      webviewTag: true
    },
    frame: true,
    backgroundColor: '#0f172a', // dark-900
    show: false
  })

  // 窗口准备好后显示（关闭 splash）
  win.once('ready-to-show', () => {
    // 关闭启动界面
    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.close()
      splashWindow = null
    }
    win?.maximize()
    win?.show()
    logger.info('Main window shown')
  })

  // 加载页面
  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
    win.webContents.openDevTools()
  } else {
    win.loadFile(join(RENDERER_DIST, 'dist', 'index.html'))
  }

  // 修复 Electron 在 Windows 上 alert/confirm 后焦点丢失的问题
  // https://github.com/electron/electron/issues/19977
  ipcMain.on('fix-focus', () => {
    if (win && process.platform === 'win32') {
      win.blur()
      win.focus()
    }
  })
}

// 后台初始化任务（不阻塞窗口显示）
async function backgroundInit() {
  // 初始化数据库
  try {
    sendSplashProgress('正在初始化数据库...', 20)
    logger.info('Initializing database...')
    const { initializeDatabase } = await import('./backend/database/init')
    await initializeDatabase()
    logger.info('Database initialized successfully')
    sendSplashProgress('数据库初始化完成', 30)
  } catch (error: any) {
    logger.error('Database initialization failed:', error)
    sendSplashProgress('数据库初始化失败', 30)
  }

  // 初始化 RSA 密钥对并自动加密未加密数据
  try {
    sendSplashProgress('正在初始化加密密钥...', 40)
    logger.info('Initializing RSA key pair...')
    const { initializeKeyPair, isEncryptionAvailable } = await import('./backend/crypto/secureKeyStorage')
    
    // 检查加密服务可用性
    const encryptionAvailable = await isEncryptionAvailable()
    if (!encryptionAvailable) {
      logger.error('System encryption service not available')
      if (process.platform === 'linux') {
        sendSplashProgress('请解锁密钥环', 50)
      } else {
        sendSplashProgress('加密服务不可用', 50)
      }
    } else {
      const keyInitResult = await initializeKeyPair()
      if (keyInitResult) {
        logger.info('RSA key pair initialized successfully')
        
        // 同步密钥到 rsa.ts 缓存（供同步加密函数使用）
        const { loadPrivateKey, loadPublicKey, setCachedPrivateKey, setCachedPublicKey } = await import('./backend/crypto/rsa')
        const secureStorage = await import('./backend/crypto/secureKeyStorage')
        const privateKey = await secureStorage.loadPrivateKey()
        const publicKey = secureStorage.loadPublicKey()
        if (privateKey) setCachedPrivateKey(privateKey)
        if (publicKey) setCachedPublicKey(publicKey)
        
        // 自动加密未加密的敏感数据
        sendSplashProgress('正在加密敏感数据...', 48)
        logger.info('Auto-encrypting sensitive data...')
        const { autoEncryptOnStartup } = await import('./backend/services/autoEncrypt')
        const encryptResult = autoEncryptOnStartup()
        logger.info('Auto-encryption result:', encryptResult)
        
        // 启动定时密钥轮换（默认7天轮换一次）
        const { startScheduledRotation } = await import('./backend/services/keyRotation')
        startScheduledRotation()
        logger.info('Scheduled key rotation started')
      } else {
        logger.warn('RSA key pair initialization returned false')
      }
    }
    sendSplashProgress('加密密钥就绪', 50)
  } catch (error: any) {
    logger.error('RSA key pair initialization failed:', error)
    sendSplashProgress('加密密钥初始化失败', 50)
  }

  // 确保 Chromium 可用（解压并注册）
  // 只在首次启动时解压，后续启动很快
  try {
    if (isChromeInstalled()) {
      sendSplashProgress('检查浏览器环境...', 60)
    } else {
      sendSplashProgress('正在安装浏览器组件...', 60)
    }
    logger.info('Checking Chrome availability...')
    const result = await ensureChrome()
    if (result.installed) {
      console.log('Chrome check success:', result.message)
    } else {
      console.warn('Chrome check failed:', result.message)
    }
    sendSplashProgress('浏览器环境就绪', 70)
  } catch (error) {
    console.error('Chrome check error:', error)
    sendSplashProgress('浏览器环境检查失败', 70)
  }

  // 确保 ttyd 可用
  try {
    sendSplashProgress('检查终端组件...', 80)
    const result = await ensureTtyd()
    if (result.installed) {
      console.log('ttyd check success:', result.message)
    } else {
      console.warn('ttyd check failed:', result.message)
    }
    sendSplashProgress('终端组件就绪', 90)
  } catch (error) {
    console.error('ttyd check error:', error)
  }
  
  sendSplashProgress('启动完成', 100)
}

// 窗口关闭事件
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
  }
})

// 应用激活事件 (macOS)
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

// 应用准备就绪
app.whenReady().then(async () => {
  // 处理证书错误 - 忽略所有证书验证（用于测试环境和内网环境）
  const ses = require('electron').session.defaultSession
  ses.setCertificateVerifyProc((request: any, callback: (verificationResult: number) => void) => {
    callback(0) // 0 表示信任该证书
  })
  
  // 先注册 IPC 处理器，再创建窗口
  try {
    registerAllIPCHandlers()
    logger.info('IPC handlers registered')
  } catch (error) {
    logger.error('IPC handler registration failed:', error)
  }
  
  // 显示启动界面
  splashWindow = createSplashWindow()
  
  // 创建主窗口（但不显示）
  await createWindow()
  
  // 后台初始化（不阻塞窗口显示）
  backgroundInit().catch(err => {
    logger.error('Background init error:', err)
  })
})

// 安全策略
app.setAppUserModelId('com.secure-ledger.app')

// 处理证书错误 - 始终忽略（用于测试环境和内网环境）
app.commandLine.appendSwitch('ignore-certificate-errors')
app.commandLine.appendSwitch('allow-insecure-localhost', 'true')
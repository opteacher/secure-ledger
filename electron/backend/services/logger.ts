import { app } from 'electron'
import { join } from 'path'
import { appendFileSync, existsSync, mkdirSync, readFileSync, statSync, renameSync, readdirSync, unlinkSync, rmSync, writeFileSync } from 'fs'

// 日志级别
type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR'

// 日志配置
interface LogConfig {
  logDir: string
  maxFileSize: number // 最大文件大小（字节）
  maxFiles: number // 最大文件数量
}

let logConfig: LogConfig = {
  logDir: '',
  maxFileSize: 5 * 1024 * 1024, // 5MB - 超过此大小触发轮转
  maxFiles: 10 // 保留最多10个日志文件
}

// 版本标记文件名
const VERSION_FILE = '.version'

// 检测版本变化，如果变化则清理日志
function checkVersionAndClearLogs(): void {
  try {
    const userDataPath = app.getPath('userData')
    const versionFile = join(userDataPath, VERSION_FILE)
    const currentVersion = app.getVersion()
    
    if (existsSync(versionFile)) {
      const storedVersion = readFileSync(versionFile, 'utf-8').trim()
      if (storedVersion !== currentVersion) {
        // 版本变化（升级或降级），清理日志
        if (existsSync(logConfig.logDir)) {
          rmSync(logConfig.logDir, { recursive: true, force: true })
        }
        // 更新版本文件
        writeFileSync(versionFile, currentVersion, 'utf-8')
      }
    } else {
      // 首次安装，清理日志并创建版本文件
      if (existsSync(logConfig.logDir)) {
        rmSync(logConfig.logDir, { recursive: true, force: true })
      }
      writeFileSync(versionFile, currentVersion, 'utf-8')
    }
  } catch (e) {
    // 忽略错误
  }
}

// 初始化日志系统
export function initLogger(): void {
  // 设置日志目录
  logConfig.logDir = join(app.getPath('userData'), 'logs')
  
  // 检测版本变化，新安装或版本升级时清理日志
  checkVersionAndClearLogs()
  
  // 创建日志目录
  if (!existsSync(logConfig.logDir)) {
    mkdirSync(logConfig.logDir, { recursive: true })
  }
  
  // 重定向控制台输出到日志文件
  redirectConsole()
  
  // 捕获未处理的异常
  process.on('uncaughtException', (error) => {
    log('ERROR', 'Uncaught Exception', error)
  })
  
  process.on('unhandledRejection', (reason) => {
    log('ERROR', 'Unhandled Rejection', reason)
  })
  
  log('INFO', 'Logger initialized', { logDir: logConfig.logDir })
}

// 重定向控制台输出
function redirectConsole(): void {
  const originalConsole = {
    log: console.log,
    info: console.info,
    warn: console.warn,
    error: console.error
  }
  
  console.log = (...args: any[]) => {
    originalConsole.log(...args)
    log('INFO', ...args)
  }
  
  console.info = (...args: any[]) => {
    originalConsole.info(...args)
    log('INFO', ...args)
  }
  
  console.warn = (...args: any[]) => {
    originalConsole.warn(...args)
    log('WARN', ...args)
  }
  
  console.error = (...args: any[]) => {
    originalConsole.error(...args)
    log('ERROR', ...args)
  }
}

// 核心日志函数
function log(level: LogLevel, ...args: any[]): void {
  try {
    const timestamp = new Date().toISOString()
    const message = args.map(arg => {
      if (arg instanceof Error) {
        return `${arg.message}\n${arg.stack}`
      }
      if (typeof arg === 'object') {
        return JSON.stringify(arg, null, 2)
      }
      return String(arg)
    }).join(' ')
    
    const logLine = `[${timestamp}] [${level}] ${message}\n`
    
    const logFile = getLogFilePath()
    
    // 检查文件大小，必要时轮转
    if (existsSync(logFile)) {
      const stats = statSync(logFile)
      if (stats.size > logConfig.maxFileSize) {
        rotateLogs()
      }
    }
    
    appendFileSync(logFile, logLine, 'utf-8')
  } catch (e) {
    // 日志系统本身的错误不抛出
  }
}

// 获取当前日志文件路径
function getLogFilePath(): string {
  const date = new Date().toISOString().split('T')[0]
  return join(logConfig.logDir, `app-${date}.log`)
}

// 轮转日志文件
function rotateLogs(): void {
  const date = new Date().toISOString().split('T')[0]
  const logFile = join(logConfig.logDir, `app-${date}.log`)
  
  if (!existsSync(logFile)) return
  
  const timestamp = Date.now()
  const rotatedFile = join(logConfig.logDir, `app-${date}-${timestamp}.log`)
  
  try {
    renameSync(logFile, rotatedFile)
  } catch (e) {
    // 忽略轮转错误
  }
  
  // 清理旧日志文件
  cleanOldLogs()
}

// 清理旧日志文件
function cleanOldLogs(): void {
  try {
    const files = readdirSync(logConfig.logDir)
      .filter((f: string) => f.startsWith('app-') && f.endsWith('.log'))
      .map((f: string) => ({
        name: f,
        path: join(logConfig.logDir, f),
        time: statSync(join(logConfig.logDir, f)).mtime.getTime()
      }))
      .sort((a, b) => b.time - a.time)
    
    // 保留最新的 N 个文件
    if (files.length > logConfig.maxFiles) {
      files.slice(logConfig.maxFiles).forEach((f) => {
        try {
          unlinkSync(f.path)
        } catch (e) {
          // 忽略删除错误
        }
      })
    }
  } catch (e) {
    // 忽略清理错误
  }
}

// 获取日志目录路径
export function getLogDir(): string {
  return logConfig.logDir
}

// 获取日志内容
export function getLogContent(maxLines: number = 500): string {
  try {
    // 获取所有日志文件，按时间排序（最新的在前）
    const files = readdirSync(logConfig.logDir)
      .filter((f: string) => f.startsWith('app-') && f.endsWith('.log'))
      .map((f: string) => ({
        name: f,
        path: join(logConfig.logDir, f),
        time: statSync(join(logConfig.logDir, f)).mtime.getTime()
      }))
      .sort((a, b) => b.time - a.time)
    
    if (files.length === 0) {
      return 'No logs available'
    }
    
    // 读取最新的日志文件
    const latestFile = files[0]
    const content = readFileSync(latestFile.path, 'utf-8')
    const lines = content.split('\n')
    
    let result = ''
    
    // 如果日志文件数量超过1个，显示文件列表
    if (files.length > 1) {
      result += `Log files (${files.length} total):\n`
      files.slice(0, 5).forEach((f, i) => {
        const size = (statSync(f.path).size / 1024).toFixed(2)
        result += `  ${i + 1}. ${f.name} (${size} KB)\n`
      })
      if (files.length > 5) {
        result += `  ... and ${files.length - 5} more files\n`
      }
      result += '\n' + '='.repeat(50) + '\n\n'
    }
    
    // 显示日志内容
    if (lines.length > maxLines) {
      result += `... (log too long, showing last ${maxLines} lines)\n\n` + lines.slice(-maxLines).join('\n')
    } else {
      result += content
    }
    
    return result
  } catch (e: any) {
    return 'Failed to read logs: ' + e.message
  }
}

// 清空日志
export function clearLogs(): { success: boolean; message: string } {
  try {
    if (existsSync(logConfig.logDir)) {
      // 删除整个 logs 目录
      rmSync(logConfig.logDir, { recursive: true, force: true })
      // 重新创建目录
      mkdirSync(logConfig.logDir, { recursive: true })
    }
    
    log('INFO', 'Logs cleared')
    return { success: true, message: 'Logs cleared' }
  } catch (e: any) {
    return { success: false, message: e.message }
  }
}

// 导出日志函数
export const logger = {
  debug: (...args: any[]) => log('DEBUG', ...args),
  info: (...args: any[]) => log('INFO', ...args),
  warn: (...args: any[]) => log('WARN', ...args),
  error: (...args: any[]) => log('ERROR', ...args)
}
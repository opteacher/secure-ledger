import { app } from 'electron'
import { join } from 'path'
import { appendFileSync, existsSync, mkdirSync, readFileSync, statSync, renameSync } from 'fs'

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
  maxFileSize: 10 * 1024 * 1024, // 10MB
  maxFiles: 5
}

// 初始化日志系统
export function initLogger(): void {
  // 设置日志目录
  logConfig.logDir = join(app.getPath('userData'), 'logs')
  
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
  const fs = require('fs')
  const path = require('path')
  
  try {
    const files = fs.readdirSync(logConfig.logDir)
      .filter((f: string) => f.startsWith('app-') && f.endsWith('.log'))
      .map((f: string) => ({
        name: f,
        path: path.join(logConfig.logDir, f),
        time: fs.statSync(path.join(logConfig.logDir, f)).mtime.getTime()
      }))
      .sort((a: any, b: any) => b.time - a.time)
    
    // 保留最新的 N 个文件
    if (files.length > logConfig.maxFiles) {
      files.slice(logConfig.maxFiles).forEach((f: any) => {
        try {
          fs.unlinkSync(f.path)
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
    const logFile = getLogFilePath()
    if (!existsSync(logFile)) {
      return 'No logs available'
    }
    
    const content = readFileSync(logFile, 'utf-8')
    const lines = content.split('\n')
    
    if (lines.length > maxLines) {
      return '... (Log too long, showing last ' + maxLines + ' lines)\n\n' + lines.slice(-maxLines).join('\n')
    }
    
    return content
  } catch (e: any) {
    return 'Failed to read logs: ' + e.message
  }
}

// 清空日志
export function clearLogs(): { success: boolean; message: string } {
  try {
    const fs = require('fs')
    const files = fs.readdirSync(logConfig.logDir)
      .filter((f: string) => f.endsWith('.log'))
    
    for (const file of files) {
      fs.unlinkSync(join(logConfig.logDir, file))
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
import { Client } from 'ssh2'
import { readFileSync, existsSync, statSync, readdirSync, mkdirSync } from 'fs'
import { basename, join, relative, sep } from 'path'
import { BrowserWindow } from 'electron'

export interface SSHConfig {
  host: string
  port: number
  username: string
  password?: string
  privateKey?: string
  keyfilePath?: string
  passphrase?: string
}

export interface UploadConfig extends SSHConfig {
  localPath: string
  remotePath: string
  isFolder: boolean
  overwrite: boolean
}

export interface RemoteFile {
  name: string
  isDirectory: boolean
  size: number
  modifiedTime: string
  rights?: string
}

export interface UploadProgress {
  fileName: string
  fileIndex: number
  totalFiles: number
  bytesTransferred: number
  totalBytes: number
  percent: number
}

// 获取连接配置
function getConnectionConfig(config: SSHConfig): any {
  const connectionConfig: any = {
    host: config.host,
    port: config.port || 22,
    username: config.username,
  }
  
  console.log('SSH连接配置:', {
    host: config.host,
    port: config.port || 22,
    username: config.username,
    hasPassword: !!config.password,
    hasKeyfilePath: !!config.keyfilePath,
    hasPrivateKey: !!config.privateKey
  })
  
  // 优先使用密钥文件
  if (config.keyfilePath && existsSync(config.keyfilePath)) {
    try {
      connectionConfig.privateKey = readFileSync(config.keyfilePath)
      if (config.passphrase) {
        connectionConfig.passphrase = config.passphrase
      }
      console.log('使用密钥文件认证:', config.keyfilePath)
    } catch (e) {
      console.error('读取密钥文件失败:', e)
    }
  } else if (config.privateKey) {
    connectionConfig.privateKey = config.privateKey
    console.log('使用 privateKey 认证')
  } else if (config.password) {
    connectionConfig.password = config.password
    console.log('使用密码认证')
  } else {
    console.warn('未配置任何认证方式!')
  }
  
  return connectionConfig
}

// 发送进度事件
function emitProgress(progress: UploadProgress) {
  const win = BrowserWindow.getFocusedWindow()
  if (win && !win.isDestroyed()) {
    win.webContents.send('ssh:upload:progress', progress)
  }
}

// 测试 SSH 连接
export function testConnection(config: SSHConfig): Promise<{ success: boolean; message: string }> {
  return new Promise((resolve) => {
    const client = new Client()

    const connectionConfig: any = {
      host: config.host,
      port: config.port || 22,
      username: config.username,
    }

    if (config.privateKey) {
      connectionConfig.privateKey = config.privateKey
    } else if (config.password) {
      connectionConfig.password = config.password
    }

    client.on('ready', () => {
      client.end()
      resolve({ success: true, message: '连接成功' })
    })

    client.on('error', (err) => {
      resolve({ success: false, message: err.message })
    })

    client.connect(connectionConfig)
  })
}

// 执行 SSH 命令
export function executeCommand(config: SSHConfig & { command: string }): Promise<{ success: boolean; output: string; error?: string }> {
  return new Promise((resolve) => {
    const client = new Client()

    const connectionConfig: any = {
      host: config.host,
      port: config.port || 22,
      username: config.username,
    }

    if (config.privateKey) {
      connectionConfig.privateKey = config.privateKey
    } else if (config.password) {
      connectionConfig.password = config.password
    }

    client.on('ready', () => {
      client.exec(config.command, (err, stream) => {
        if (err) {
          client.end()
          resolve({ success: false, output: '', error: err.message })
          return
        }

        let output = ''
        let errorOutput = ''

        stream.on('close', () => {
          client.end()
          resolve({ success: true, output, error: errorOutput || undefined })
        })

        stream.on('data', (data: Buffer) => {
          output += data.toString()
        })

        stream.stderr.on('data', (data: Buffer) => {
          errorOutput += data.toString()
        })
      })
    })

    client.on('error', (err) => {
      resolve({ success: false, output: '', error: err.message })
    })

    client.connect(connectionConfig)
  })
}

// 上传文件/文件夹
export function uploadFile(config: UploadConfig): Promise<{ success: boolean; message: string }> {
  return new Promise((resolve) => {
    // 检查本地文件是否存在
    if (!existsSync(config.localPath)) {
      resolve({ success: false, message: '本地文件不存在' })
      return
    }

    const client = new Client()

    const connectionConfig: any = {
      host: config.host,
      port: config.port || 22,
      username: config.username,
    }

    if (config.privateKey) {
      connectionConfig.privateKey = config.privateKey
    } else if (config.password) {
      connectionConfig.password = config.password
    }

    client.on('ready', () => {
      client.sftp((err, sftp) => {
        if (err) {
          client.end()
          resolve({ success: false, message: err.message })
          return
        }

        const remoteFile = config.remotePath + '/' + basename(config.localPath)

        // 如果需要覆盖，先删除
        if (config.overwrite) {
          sftp.unlink(remoteFile, () => {
            // 忽略删除错误（文件可能不存在）
            doUpload()
          })
        } else {
          doUpload()
        }

        function doUpload() {
          if (config.isFolder) {
            // 上传文件夹
            sftp.mkdir(remoteFile, () => {
              // 简化版：只创建目录
              client.end()
              resolve({ success: true, message: '文件夹创建成功' })
            })
          } else {
            // 上传文件
            sftp.fastPut(config.localPath, remoteFile, (err) => {
              client.end()
              if (err) {
                resolve({ success: false, message: err.message })
              } else {
                resolve({ success: true, message: '文件上传成功' })
              }
            })
          }
        }
      })
    })

    client.on('error', (err) => {
      resolve({ success: false, message: err.message })
    })

    client.connect(connectionConfig)
  })
}

// 列出远程目录内容
export function listRemoteDirectory(config: SSHConfig, remotePath: string): Promise<{ success: boolean; files: RemoteFile[]; message?: string }> {
  return new Promise((resolve) => {
    const client = new Client()
    const connectionConfig = getConnectionConfig(config)
    
    client.on('ready', () => {
      client.sftp((err, sftp) => {
        if (err) {
          client.end()
          resolve({ success: false, files: [], message: err.message })
          return
        }
        
        sftp.readdir(remotePath, (err, list) => {
          client.end()
          
          if (err) {
            resolve({ success: false, files: [], message: err.message })
            return
          }
          
          const files: RemoteFile[] = list.map(item => ({
            name: item.filename,
            isDirectory: item.longname.startsWith('d'),
            size: item.attrs.size,
            modifiedTime: new Date(item.attrs.mtime * 1000).toISOString(),
            rights: item.longname.substring(0, 10)
          }))
          
          // 排序：目录在前，然后按名称排序
          files.sort((a, b) => {
            if (a.isDirectory && !b.isDirectory) return -1
            if (!a.isDirectory && b.isDirectory) return 1
            return a.name.localeCompare(b.name)
          })
          
          resolve({ success: true, files })
        })
      })
    })
    
    client.on('error', (err) => {
      resolve({ success: false, files: [], message: err.message })
    })
    
    client.connect(connectionConfig)
  })
}

// 递归获取本地文件夹中的所有文件
function getAllFiles(dirPath: string, basePath: string): { path: string; relativePath: string; size: number }[] {
  const files: { path: string; relativePath: string; size: number }[] = []
  
  const entries = readdirSync(dirPath, { withFileTypes: true })
  
  for (const entry of entries) {
    const fullPath = join(dirPath, entry.name)
    const relPath = relative(basePath, fullPath).split(sep).join('/')
    
    if (entry.isDirectory()) {
      files.push(...getAllFiles(fullPath, basePath))
    } else if (entry.isFile()) {
      const stat = statSync(fullPath)
      files.push({ path: fullPath, relativePath: relPath, size: stat.size })
    }
  }
  
  return files
}

// 上传文件/文件夹（带进度）
export function uploadWithProgress(config: UploadConfig): Promise<{ success: boolean; message: string; filesUploaded: number; totalFiles: number }> {
  return new Promise((resolve) => {
    // 检查本地路径是否存在
    if (!existsSync(config.localPath)) {
      resolve({ success: false, message: '本地路径不存在', filesUploaded: 0, totalFiles: 0 })
      return
    }
    
    const client = new Client()
    const connectionConfig = getConnectionConfig(config)
    
    // 获取要上传的所有文件
    let filesToUpload: { path: string; relativePath: string; size: number }[] = []
    let totalBytes = 0
    
    if (config.isFolder) {
      filesToUpload = getAllFiles(config.localPath, config.localPath)
    } else {
      const stat = statSync(config.localPath)
      filesToUpload = [{ path: config.localPath, relativePath: basename(config.localPath), size: stat.size }]
    }
    
    totalBytes = filesToUpload.reduce((sum, f) => sum + f.size, 0)
    
    if (filesToUpload.length === 0) {
      resolve({ success: false, message: '没有文件需要上传', filesUploaded: 0, totalFiles: 0 })
      return
    }
    
    client.on('ready', () => {
      client.sftp((err, sftp) => {
        if (err) {
          client.end()
          resolve({ success: false, message: err.message, filesUploaded: 0, totalFiles: filesToUpload.length })
          return
        }
        
        let bytesTransferred = 0
        let filesUploaded = 0
        
        // 上传文件函数
        const uploadNextFile = (index: number) => {
          if (index >= filesToUpload.length) {
            client.end()
            resolve({ 
              success: true, 
              message: `成功上传 ${filesUploaded} 个文件`, 
              filesUploaded, 
              totalFiles: filesToUpload.length 
            })
            return
          }
          
          const file = filesToUpload[index]
          const remoteFilePath = config.remotePath + '/' + file.relativePath
          const remoteDir = remoteFilePath.substring(0, remoteFilePath.lastIndexOf('/'))
          
          // 创建远程目录
          const createDirAndUpload = () => {
            sftp.mkdir(remoteDir, (mkdirErr) => {
              // 忽略目录已存在的错误
              
              // 上传文件
              sftp.fastPut(file.path, remoteFilePath, (putErr) => {
                if (putErr) {
                  console.error(`上传失败: ${file.relativePath}`, putErr.message)
                } else {
                  filesUploaded++
                  bytesTransferred += file.size
                  
                  // 发送进度
                  emitProgress({
                    fileName: file.relativePath,
                    fileIndex: index + 1,
                    totalFiles: filesToUpload.length,
                    bytesTransferred,
                    totalBytes,
                    percent: Math.round((bytesTransferred / totalBytes) * 100)
                  })
                }
                
                // 上传下一个文件
                uploadNextFile(index + 1)
              })
            })
          }
          
          // 如果需要覆盖，先删除远程文件
          if (config.overwrite) {
            sftp.unlink(remoteFilePath, () => {
              createDirAndUpload()
            })
          } else {
            createDirAndUpload()
          }
        }
        
        // 开始上传
        uploadNextFile(0)
      })
    })
    
    client.on('error', (err) => {
      resolve({ success: false, message: err.message, filesUploaded: 0, totalFiles: filesToUpload.length })
    })
    
    client.connect(connectionConfig)
  })
}
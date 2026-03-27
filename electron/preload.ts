import { contextBridge, ipcRenderer } from 'electron'

// 类型定义
export interface IPCResponse<T = any> {
  success: boolean
  data?: T
  error?: string
}

// IPC API 接口
export interface IPCAPI {
  invoke: <T = any>(channel: string, ...args: any[]) => Promise<T>
  send: (channel: string, ...args: any[]) => void
  on: (channel: string, callback: (...args: any[]) => void) => () => void
}

// 暴露给渲染进程的 API
const api: IPCAPI = {
  invoke: async <T = any>(channel: string, ...args: any[]): Promise<T> => {
    const response = await ipcRenderer.invoke(channel, ...args) as IPCResponse<T>
    
    if (!response.success) {
      throw new Error(response.error || '请求失败')
    }
    
    return response.data as T
  },

  send: (channel: string, ...args: any[]) => {
    ipcRenderer.send(channel, ...args)
  },

  on: (channel: string, callback: (...args: any[]) => void) => {
    const handler = (_event: any, ...args: any[]) => callback(...args)
    ipcRenderer.on(channel, handler)
    
    // 返回取消订阅函数
    return () => {
      ipcRenderer.removeListener(channel, handler)
    }
  }
}

// 使用 contextBridge 安全暴露 API
contextBridge.exposeInMainWorld('ipc', api)
// 类型声明
declare global {
  interface Window {
    ipc: {
      invoke: <T = any>(channel: string, ...args: any[]) => Promise<T>
      send: (channel: string, ...args: any[]) => void
      on: (channel: string, callback: (...args: any[]) => void) => () => void
    }
  }
}

export {}
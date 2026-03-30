// IPC API 封装

// 通用调用函数
async function invoke<T>(channel: string, ...args: any[]): Promise<T> {
  return window.ipc.invoke<T>(channel, ...args)
}

// ============ 账户 API ============
export const accountApi = {
  hasAccount: () => invoke<boolean>('account:hasAccount'),
  
  create: (username: string, password: string) => 
    invoke<{ success: boolean; message: string }>('account:create', { username, password }),
  
  login: (username: string, password: string) =>
    invoke<{ token: string; username: string }>('account:login', { username, password }),
  
  verify: (token: string) =>
    invoke<{ valid: boolean; username?: string }>('account:verify', token),
  
  changePassword: (oldPassword: string, newPassword: string) =>
    invoke<{ success: boolean }>('account:changePassword', { oldPassword, newPassword })
}

// ============ 登录端 API ============
export interface Endpoint {
  id: number
  name: string
  icon: string
  login_type: 'web' | 'ssh'
  created_at: string
  updated_at: string
}

export interface Slot {
  id: number
  page_id: number
  order_index: number
  name?: string
  element_xpath: string
  action_type: 'input' | 'click' | 'select' | 'password' | 'keyfile'
  value: string
  is_encrypted: boolean
  timeout: number
  created_at: string
  updated_at: string
}

export interface Page {
  id: number
  endpoint_id: number
  order_index: number
  url: string
  slots: Slot[]
  created_at: string
  updated_at: string
}

export interface EndpointFull extends Endpoint {
  pages: Page[]
}

export const endpointApi = {
  list: () => invoke<Endpoint[]>('endpoint:list'),
  
  get: (id: number) => invoke<EndpointFull | null>('endpoint:get', id),
  
  create: (data: Partial<Endpoint>) => invoke<Endpoint>('endpoint:create', data),
  
  update: (id: number, updates: Partial<Endpoint>) => 
    invoke<boolean>('endpoint:update', { id, updates }),
  
  delete: (id: number) => invoke<boolean>('endpoint:delete', id),
  
  export: (ids: number[]) => invoke<EndpointFull[]>('endpoint:export', ids),
  
  import: (data: EndpointFull[]) => 
    invoke<{ success: number; failed: number }>('endpoint:import', data)
}

// ============ 步骤页 API ============
export const pageApi = {
  list: (endpointId: number) => invoke<Page[]>('page:list', endpointId),
  
  get: (id: number) => invoke<Page | null>('page:get', id),
  
  create: (data: Partial<Page>) => invoke<Page>('page:create', data),
  
  update: (id: number, updates: Partial<Page>) =>
    invoke<boolean>('page:update', { id, updates }),
  
  delete: (id: number) => invoke<boolean>('page:delete', id)
}

// ============ 操作槽 API ============
export const slotApi = {
  list: (pageId: number) => invoke<Slot[]>('slot:list', pageId),
  
  get: (id: number) => invoke<Slot | null>('slot:get', id),
  
  create: (data: Partial<Slot> & { masterKey?: string }) =>
    invoke<Slot>('slot:create', data),
  
  update: (id: number, updates: Partial<Slot> & { masterKey?: string }) =>
    invoke<boolean>('slot:update', { id, updates }),
  
  delete: (id: number) => invoke<boolean>('slot:delete', id)
}

// ============ Chrome 检测 API ============
export interface ChromeInfo {
  name: string
  path: string
  version?: string
}

export const chromeApi = {
  detect: () => invoke<ChromeInfo[]>('chrome:detect')
}

// ============ 登录执行 API ============
export const loginApi = {
  execute: (endpointId: number, chromePath: string) =>
    invoke<{ success: boolean; message: string }>('login:execute', { endpointId, chromePath })
}

// ============ SSH API ============
export interface SSHConfig {
  host: string
  port: number
  username: string
  password?: string
  keyfilePath?: string
  passphrase?: string
}

export interface SSHTtydConfig {
  host: string
  port: number
  username?: string
  password?: string
  keyfilePath?: string
  passphrase?: string
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

export interface UploadConfig extends SSHConfig {
  localPath: string
  remotePath: string
  isFolder: boolean
  overwrite: boolean
}

export const sshApi = {
  upload: (config: SSHConfig & { localPath: string; remotePath: string; isFolder: boolean; overwrite: boolean }) =>
    invoke<{ success: boolean; message: string }>('ssh:upload', config),
  
  execute: (config: SSHConfig & { command: string }) =>
    invoke<{ success: boolean; output: string; error?: string }>('ssh:execute', config),
  
  startTtyd: (config: SSHTtydConfig) =>
    invoke<{ success: boolean; message: string; port?: number }>('ssh:startTtyd', config),
  
  stopTtyd: () =>
    invoke<{ success: boolean; message: string }>('ssh:stopTtyd'),
  
  selectKeyfile: () =>
    invoke<{ canceled: boolean; filePaths: string[] }>('ssh:selectKeyfile'),
  
  checkTtyd: () =>
    invoke<{ installed: boolean; available: boolean; error: string | null }>('ssh:checkTtyd'),
  
  installTtyd: () =>
    invoke<{ success: boolean; message: string }>('ssh:installTtyd'),
  
  // 列出远程目录
  listDir: (config: SSHConfig, remotePath: string) =>
    invoke<{ success: boolean; files: RemoteFile[]; message?: string }>('ssh:listDir', { config, remotePath }),
  
  // 选择上传文件/文件夹
  selectUploadFiles: (isFolder: boolean) =>
    invoke<{ canceled: boolean; filePaths: string[] }>('ssh:selectUploadFiles', { isFolder }),
  
  // 带进度的上传
  uploadWithProgress: (config: UploadConfig) =>
    invoke<{ success: boolean; message: string; filesUploaded: number; totalFiles: number }>('ssh:uploadWithProgress', { config }),
  
  // 监听上传进度事件
  onUploadProgress: (callback: (progress: UploadProgress) => void) => {
    return window.ipc.on('ssh:upload:progress', callback)
  },
  
  // PuTTY 相关
  checkPuTTY: () =>
    invoke<{ installed: boolean }>('ssh:checkPuTTY'),
  
  installPuTTY: () =>
    invoke<{ success: boolean; message: string }>('ssh:installPuTTY')
}

// ============ Terminal API ============
export interface TerminalTool {
  id: string
  name: string
  path: string
}

export const terminalApi = {
  detect: () =>
    invoke<TerminalTool[]>('terminal:detect'),
  
  launchSSH: (config: {
    terminalId: string
    terminalPath: string
    terminalName: string
    host: string
    port: number
    username?: string
    keyfilePath?: string
    password?: string
  }) =>
    invoke<{ success: boolean; message: string }>('terminal:launchSSH', config)
}

// ============ App API ============
export const appApi = {
  getDatabasePath: () =>
    invoke<{ path: string }>('app:getDatabasePath'),
  
  openDatabaseFolder: () =>
    invoke<{ success: boolean; path: string }>('app:openDatabaseFolder'),
  
  // 选择可执行文件
  selectExecutable: (title?: string) =>
    invoke<{ canceled: boolean; filePaths: string[] }>('app:selectExecutable', { title }),
  
  // 日志相关
  getLogPath: () =>
    invoke<{ path: string }>('app:getLogPath'),
  
  getLogContent: (maxLines?: number) =>
    invoke<{ content: string }>('app:getLogContent', { maxLines }),
  
  clearLogs: () =>
    invoke<{ success: boolean; message: string }>('app:clearLogs'),
  
  openLogFolder: () =>
    invoke<{ success: boolean; path: string }>('app:openLogFolder')
}

// ============ ttyd 配置 API ============
export interface TtydPathInfo {
  path: string | null
  source: 'custom' | 'bundled' | 'system' | 'none'
}

export interface TtydStatus {
  running: boolean
  port: number | null
  pid: number | null
}

export interface PortCheckResult {
  inUse: boolean
  process?: { pid: number; name: string }
}

export interface PlinkPathInfo {
  path: string | null
  source: 'custom' | 'system' | 'none'
}

export const ttydApi = {
  getPath: () =>
    invoke<TtydPathInfo>('ttyd:getPath'),
  
  setPath: (path: string | null) =>
    invoke<{ success: boolean; message: string }>('ttyd:setPath', { path }),
  
  getStatus: () =>
    invoke<TtydStatus>('ttyd:getStatus'),
  
  checkPort: (port: number) =>
    invoke<PortCheckResult>('ttyd:checkPort', { port }),
  
  killPort: (port: number) =>
    invoke<{ success: boolean; message: string }>('ttyd:killPort', { port })
}

export const plinkApi = {
  getPath: () =>
    invoke<PlinkPathInfo>('plink:getPath'),
  
  setPath: (path: string | null) =>
    invoke<{ success: boolean; message: string }>('plink:setPath', { path })
}

// ============ sshpass 配置 API (Linux/macOS) ============
export interface SshpassPathInfo {
  path: string | null
  source: 'custom' | 'system' | 'none'
}

export const sshpassApi = {
  getPath: () =>
    invoke<SshpassPathInfo>('sshpass:getPath'),
  
  setPath: (path: string | null) =>
    invoke<{ success: boolean; message: string }>('sshpass:setPath', { path })
}

// ============ 平台信息 API ============
export interface PlatformInfo {
  platform: 'win32' | 'darwin' | 'linux'
  isWindows: boolean
  isMac: boolean
  isLinux: boolean
}

export const platformApi = {
  getInfo: () =>
    invoke<PlatformInfo>('platform:getInfo')
}

// ============ 浏览器管理 API ============
export interface BrowserConfig {
  id: number
  name: string
  path: string
  is_enabled: boolean
  puppeteer_version: 'auto' | 'high' | 'low'  // Puppeteer 版本选择
  chrome_version: string | null  // 检测到的 Chrome 内核版本
  created_at: string
  updated_at: string
}

export interface BrowserVersionAnalysis {
  versionInfo: {
    path: string
    version: string | null
    majorVersion: number | null
    error?: string
  }
  puppeteerVersion: 'high' | 'low'
  decision: string
}

export const browserApi = {
  // 获取所有浏览器配置
  getList: () =>
    invoke<BrowserConfig[]>('browser:getList'),
  
  // 获取可用浏览器（启用的 + 路径存在）
  getAvailable: () =>
    invoke<BrowserConfig[]>('browser:getAvailable'),
  
  // 添加浏览器
  add: (name: string, path: string) =>
    invoke<BrowserConfig>('browser:add', { name, path }),
  
  // 删除浏览器
  delete: (id: number) =>
    invoke<boolean>('browser:delete', { id }),
  
  // 更新浏览器启用状态
  updateStatus: (id: number, isEnabled: boolean) =>
    invoke<boolean>('browser:updateStatus', { id, isEnabled }),
  
  // 更新 Puppeteer 版本设置
  updatePuppeteerVersion: (id: number, version: 'auto' | 'high' | 'low') =>
    invoke<boolean>('browser:updatePuppeteerVersion', { id, version }),
  
  // 检测浏览器版本
  detectVersion: (id: number) =>
    invoke<{ version: string | null; majorVersion: number | null }>('browser:detectVersion', { id }),
  
  // 分析浏览器版本（确定应使用的 Puppeteer 版本）
  analyzeVersion: (path: string, preference?: 'auto' | 'high' | 'low') =>
    invoke<BrowserVersionAnalysis>('browser:analyzeVersion', { path, preference }),
  
  // 检测系统浏览器
  detect: () =>
    invoke<ChromeInfo[]>('browser:detect'),
  
  // 初始化默认浏览器
  initDefault: () =>
    invoke<void>('browser:initDefault'),
  
  // 检测并添加新浏览器（只添加数据库中不存在的）
  detectAndAdd: () =>
    invoke<{ added: number; skipped: number; total: number }>('browser:detectAndAdd')
}

// ============ 终端工具管理 API ============
export interface TerminalConfig {
  id: number
  name: string
  path: string
  terminal_type: string  // 终端类型标识符 (e.g., 'wt', 'powershell', 'gnome-terminal')
  is_enabled: boolean
  created_at: string
  updated_at: string
}

export const terminalConfigApi = {
  // 获取所有终端配置
  getList: () =>
    invoke<TerminalConfig[]>('terminalConfig:getList'),
  
  // 获取可用终端（启用的 + 路径存在）
  getAvailable: () =>
    invoke<TerminalConfig[]>('terminalConfig:getAvailable'),
  
  // 添加终端
  add: (name: string, path: string, terminalType?: string) =>
    invoke<TerminalConfig>('terminalConfig:add', { name, path, terminalType }),
  
  // 删除终端
  delete: (id: number) =>
    invoke<boolean>('terminalConfig:delete', { id }),
  
  // 更新终端启用状态
  updateStatus: (id: number, isEnabled: boolean) =>
    invoke<boolean>('terminalConfig:updateStatus', { id, isEnabled }),
  
  // 检测系统终端
  detect: () =>
    invoke<TerminalTool[]>('terminalConfig:detect'),
  
  // 初始化默认终端
  initDefault: () =>
    invoke<{ success: boolean; message: string; count: number }>('terminalConfig:initDefault'),
  
  // 检测并添加新终端（只添加数据库中不存在的）
  detectAndAdd: () =>
    invoke<{ added: number; skipped: number; total: number }>('terminalConfig:detectAndAdd')
}

// ============ 应用锁定 API ============
export interface AppLockSettings {
  id: number
  is_enabled: boolean
  is_locked: boolean      // 应用是否处于锁定状态
  lock_delay_minutes: number
  has_password: boolean
  created_at: string
  updated_at: string
}

export const appLockApi = {
  // 获取锁定设置
  getSettings: () =>
    invoke<AppLockSettings>('appLock:getSettings'),
  
  // 更新锁定设置
  updateSettings: (settings: { is_enabled?: boolean; lock_delay_minutes?: number }) =>
    invoke<AppLockSettings>('appLock:updateSettings', settings),
  
  // 设置锁定密码
  setPassword: (password: string) =>
    invoke<{ success: boolean; message: string }>('appLock:setPassword', { password }),
  
  // 验证锁定密码
  verifyPassword: (password: string) =>
    invoke<{ valid: boolean }>('appLock:verifyPassword', { password }),
  
  // 移除锁定密码
  removePassword: () =>
    invoke<{ success: boolean; message: string }>('appLock:removePassword'),
  
  // 锁定应用
  lock: () =>
    invoke<void>('appLock:lock'),
  
  // 解锁应用
  unlock: () =>
    invoke<void>('appLock:unlock'),
  
  // 检查是否锁定
  isLocked: () =>
    invoke<{ is_locked: boolean }>('appLock:isLocked')
}
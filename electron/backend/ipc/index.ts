import { ipcMain, dialog, app, shell } from 'electron'
import { dirname } from 'path'

// 服务导入 - 静态导入避免动态加载问题
import * as accountService from '../services/account'
import * as endpointService from '../services/endpoint'
import * as pageService from '../services/page'
import * as slotService from '../services/slot'
import * as chromeService from '../services/chrome'
import * as automationService from '../services/automation'
import * as sshService from '../services/ssh'
import * as ttydService from '../services/ttyd'
import * as terminalService from '../services/terminal'
import * as terminalConfigService from '../services/terminalConfig'
import * as browserService from '../services/browser'
import * as loggerService from '../services/logger'
import * as chromiumService from '../services/chromium'
import * as appLockService from '../services/appLock'
import * as database from '../database/index'

interface IPCResponse<T = any> {
  success: boolean
  data?: T
  error?: string
}

/**
 * 注册 IPC 处理器
 * 所有 handler 直接调用已导入的服务，避免动态 import 的竞态条件
 */
export function registerAllIPCHandlers(): void {
  // 账户相关
  registerHandler('account:hasAccount', handleAccountHasAccount)
  registerHandler('account:create', handleAccountCreate)
  registerHandler('account:login', handleAccountLogin)
  registerHandler('account:verify', handleAccountVerify)
  registerHandler('account:changePassword', handleAccountChangePassword)
  
  // 登录端相关
  registerHandler('endpoint:list', handleEndpointList)
  registerHandler('endpoint:get', handleEndpointGet)
  registerHandler('endpoint:create', handleEndpointCreate)
  registerHandler('endpoint:update', handleEndpointUpdate)
  registerHandler('endpoint:delete', handleEndpointDelete)
  registerHandler('endpoint:export', handleEndpointExport)
  registerHandler('endpoint:import', handleEndpointImport)
  
  // 步骤页相关
  registerHandler('page:list', handlePageList)
  registerHandler('page:get', handlePageGet)
  registerHandler('page:create', handlePageCreate)
  registerHandler('page:update', handlePageUpdate)
  registerHandler('page:delete', handlePageDelete)
  
  // 操作槽相关
  registerHandler('slot:list', handleSlotList)
  registerHandler('slot:get', handleSlotGet)
  registerHandler('slot:create', handleSlotCreate)
  registerHandler('slot:update', handleSlotUpdate)
  registerHandler('slot:delete', handleSlotDelete)
  
  // Chrome 检测
  registerHandler('chrome:detect', handleChromeDetect)
  
  // 登录执行
  registerHandler('login:execute', handleLoginExecute)
  
  // SSH 文件上传
  registerHandler('ssh:upload', handleSSHUpload)
  registerHandler('ssh:execute', handleSSHExecute)
  registerHandler('ssh:startTtyd', handleSSHStartTtyd)
  registerHandler('ssh:stopTtyd', handleSSHStopTtyd)
  registerHandler('ssh:selectKeyfile', handleSSHSelectKeyfile)
  registerHandler('ssh:checkTtyd', handleSSHCheckTtyd)
  registerHandler('ssh:installTtyd', handleSSHInstallTtyd)
  registerHandler('ssh:listDir', handleSSHListDir)
  registerHandler('ssh:selectUploadFiles', handleSSHSelectUploadFiles)
  registerHandler('ssh:uploadWithProgress', handleSSHUploadWithProgress)
  registerHandler('ssh:checkPuTTY', handleSSHCheckPuTTY)
  registerHandler('ssh:installPuTTY', handleSSHInstallPuTTY)
  
  // 终端工具（旧版兼容）
  registerHandler('terminal:detect', handleTerminalDetect)
  registerHandler('terminal:launchSSH', handleTerminalLaunchSSH)
  
  // 应用配置
  registerHandler('app:getDatabasePath', handleAppGetDatabasePath)
  registerHandler('app:openDatabaseFolder', handleAppOpenDatabaseFolder)
  registerHandler('app:selectExecutable', handleAppSelectExecutable)
  
  // 日志管理
  registerHandler('app:getLogPath', handleAppGetLogPath)
  registerHandler('app:getLogContent', handleAppGetLogContent)
  registerHandler('app:clearLogs', handleAppClearLogs)
  registerHandler('app:openLogFolder', handleAppOpenLogFolder)
  
  // ttyd 配置管理
  registerHandler('ttyd:getPath', handleTtydGetPath)
  registerHandler('ttyd:setPath', handleTtydSetPath)
  registerHandler('ttyd:getStatus', handleTtydGetStatus)
  registerHandler('ttyd:checkPort', handleTtydCheckPort)
  registerHandler('ttyd:killPort', handleTtydKillPort)
  
  // plink 配置管理 (Windows)
  registerHandler('plink:getPath', handlePlinkGetPath)
  registerHandler('plink:setPath', handlePlinkSetPath)
  
  // sshpass 配置管理 (Linux/macOS)
  registerHandler('sshpass:getPath', handleSshpassGetPath)
  registerHandler('sshpass:setPath', handleSshpassSetPath)
  
  // 平台信息
  registerHandler('platform:getInfo', handlePlatformGetInfo)
  
  // 浏览器管理
  registerHandler('browser:getList', handleBrowserGetList)
  registerHandler('browser:getAvailable', handleBrowserGetAvailable)
  registerHandler('browser:add', handleBrowserAdd)
  registerHandler('browser:delete', handleBrowserDelete)
  registerHandler('browser:updateStatus', handleBrowserUpdateStatus)
  registerHandler('browser:detect', handleBrowserDetect)
  registerHandler('browser:initDefault', handleBrowserInitDefault)
  registerHandler('browser:detectAndAdd', handleBrowserDetectAndAdd)
  registerHandler('browser:updatePuppeteerVersion', handleBrowserUpdatePuppeteerVersion)
  registerHandler('browser:detectVersion', handleBrowserDetectVersion)
  registerHandler('browser:analyzeVersion', handleBrowserAnalyzeVersion)
  
  // 终端工具管理
  registerHandler('terminalConfig:getList', handleTerminalConfigGetList)
  registerHandler('terminalConfig:getAvailable', handleTerminalConfigGetAvailable)
  registerHandler('terminalConfig:add', handleTerminalConfigAdd)
  registerHandler('terminalConfig:delete', handleTerminalConfigDelete)
  registerHandler('terminalConfig:updateStatus', handleTerminalConfigUpdateStatus)
  registerHandler('terminalConfig:detect', handleTerminalConfigDetect)
  registerHandler('terminalConfig:initDefault', handleTerminalConfigInitDefault)
  registerHandler('terminalConfig:detectAndAdd', handleTerminalConfigDetectAndAdd)
  
  // Chromium 管理
  registerHandler('chromium:getStatus', handleChromiumGetStatus)
  registerHandler('chromium:install', handleChromiumInstall)
  registerHandler('chromium:uninstall', handleChromiumUninstall)
  registerHandler('chromium:register', handleChromiumRegister)
  registerHandler('chromium:unregister', handleChromiumUnregister)
  
  // 应用锁定
  registerHandler('appLock:getSettings', handleAppLockGetSettings)
  registerHandler('appLock:updateSettings', handleAppLockUpdateSettings)
  registerHandler('appLock:setPassword', handleAppLockSetPassword)
  registerHandler('appLock:verifyPassword', handleAppLockVerifyPassword)
  registerHandler('appLock:removePassword', handleAppLockRemovePassword)
  registerHandler('appLock:lock', handleAppLockLock)
  registerHandler('appLock:unlock', handleAppLockUnlock)
  registerHandler('appLock:isLocked', handleAppLockIsLocked)
  
  console.log('All IPC handlers registered')
}

// 通用注册函数
function registerHandler<T>(
  channel: string,
  handler: (...args: any[]) => Promise<T> | T
): void {
  ipcMain.handle(channel, async (_event, ...args) => {
    try {
      const result = await handler(...args)
      return { success: true, data: result } as IPCResponse<T>
    } catch (error: any) {
      console.error(`IPC 错误 [${channel}]:`, error)
      return { success: false, error: error.message } as IPCResponse
    }
  })
}

// ============ 账户处理器 ============
function handleAccountHasAccount() {
  return accountService.hasAccount()
}

function handleAccountCreate(data: { username: string; password: string }) {
  return accountService.createAccount(data.username, data.password)
}

function handleAccountLogin(data: { username: string; password: string }) {
  return accountService.loginAccount(data.username, data.password)
}

function handleAccountVerify(token: string) {
  return accountService.verifyToken(token)
}

function handleAccountChangePassword(data: { oldPassword: string; newPassword: string }) {
  return accountService.changePassword(data.oldPassword, data.newPassword)
}

// ============ 登录端处理器 ============
function handleEndpointList() {
  return endpointService.listEndpoints()
}

function handleEndpointGet(id: number) {
  return endpointService.getEndpoint(id)
}

function handleEndpointCreate(data: any) {
  return endpointService.createEndpoint(data)
}

function handleEndpointUpdate(data: { id: number; updates: any }) {
  return endpointService.updateEndpoint(data.id, data.updates)
}

function handleEndpointDelete(id: number) {
  return endpointService.deleteEndpoint(id)
}

function handleEndpointExport(ids: number[]) {
  return endpointService.exportEndpoints(ids)
}

function handleEndpointImport(data: any[]) {
  return endpointService.importEndpoints(data)
}

// ============ 步骤页处理器 ============
function handlePageList(endpointId: number) {
  return pageService.listPages(endpointId)
}

function handlePageGet(id: number) {
  return pageService.getPage(id)
}

function handlePageCreate(data: any) {
  return pageService.createPage(data)
}

function handlePageUpdate(data: { id: number; updates: any }) {
  return pageService.updatePage(data.id, data.updates)
}

function handlePageDelete(id: number) {
  return pageService.deletePage(id)
}

// ============ 操作槽处理器 ============
function handleSlotList(pageId: number) {
  return slotService.listSlots(pageId)
}

function handleSlotGet(id: number) {
  return slotService.getSlot(id)
}

function handleSlotCreate(data: any) {
  return slotService.createSlot(data)
}

function handleSlotUpdate(data: { id: number; updates: any }) {
  return slotService.updateSlot(data.id, data.updates)
}

function handleSlotDelete(id: number) {
  return slotService.deleteSlot(id)
}

// ============ Chrome 检测处理器 ============
function handleChromeDetect() {
  return chromeService.detectChrome()
}

// ============ 登录执行处理器 ============
function handleLoginExecute(data: { endpointId: number; chromePath: string }) {
  return automationService.executeLogin(data.endpointId, data.chromePath)
}

// ============ SSH 处理器 ============
function handleSSHUpload(data: any) {
  return sshService.uploadFile(data)
}

function handleSSHExecute(data: any) {
  return sshService.executeCommand(data)
}

// ============ SSH TTYD 处理器 ============
function handleSSHStartTtyd(data: any) {
  return ttydService.startTtydWithSSH(data)
}

function handleSSHStopTtyd() {
  return ttydService.stopTtyd()
}

async function handleSSHSelectKeyfile() {
  const result = await dialog.showOpenDialog({
    title: '选择 SSH 密钥文件',
    filters: [
      { name: 'SSH Keys', extensions: ['pem', 'key', 'pub', 'id_rsa', 'id_ed25519'] },
      { name: 'All Files', extensions: ['*'] }
    ],
    properties: ['openFile']
  })
  return result
}

function handleSSHCheckTtyd() {
  const installed = ttydService.isTtydInstalled()
  const available = ttydService.isTtydAvailable()
  
  if (!installed) {
    return { installed: false, available: false, error: null }
  }
  
  if (!available) {
    const compat = ttydService.checkTtydCompatibility()
    return { installed: true, available: false, error: compat.error || null }
  }
  
  return { installed: true, available: true, error: null }
}

function handleSSHInstallTtyd() {
  return ttydService.installTtyd()
}

// ============ 终端处理器 ============
function handleTerminalDetect() {
  return terminalService.detectTerminals()
}

async function handleTerminalLaunchSSH(data: {
  terminalId: string
  terminalPath: string
  terminalName: string
  host: string
  port: number
  username?: string
  keyfilePath?: string
  password?: string
}) {
  const terminals = terminalService.detectTerminals()
  const terminal = terminals.find(t => t.id === data.terminalId) || {
    id: data.terminalId,
    name: data.terminalName,
    path: data.terminalPath
  }
  return terminalService.launchSSHTerminal(terminal, data.host, data.port, data.username, data.keyfilePath, data.password)
}

// ============ SSH 上传处理器 ============
function handleSSHListDir(data: { config: any; remotePath: string }) {
  return sshService.listRemoteDirectory(data.config, data.remotePath)
}

async function handleSSHSelectUploadFiles(data: { isFolder: boolean }) {
  const properties: ('openFile' | 'openDirectory' | 'multiSelections')[] = data.isFolder 
    ? ['openDirectory'] 
    : ['openFile', 'multiSelections']
  
  const result = await dialog.showOpenDialog({
    title: data.isFolder ? '选择要上传的文件夹' : '选择要上传的文件',
    properties
  })
  
  return result
}

function handleSSHUploadWithProgress(data: { config: any }) {
  return sshService.uploadWithProgress(data.config)
}

// ============ PuTTY 处理器 ============
function handleSSHCheckPuTTY() {
  return { installed: ttydService.isPuTTYInstalled() }
}

function handleSSHInstallPuTTY() {
  return ttydService.installPuTTY()
}

// ============ 应用配置处理器 ============
function handleAppGetDatabasePath() {
  return { path: database.getDatabasePath() }
}

async function handleAppOpenDatabaseFolder() {
  const dbPath = database.getDatabasePath()
  const folderPath = dirname(dbPath)
  await shell.openPath(folderPath)
  return { success: true, path: folderPath }
}

async function handleAppSelectExecutable(data?: { title?: string }) {
  const result = await dialog.showOpenDialog({
    title: data?.title || '选择可执行文件',
    filters: [
      { name: 'Executable Files', extensions: ['exe', 'bat', 'cmd', 'sh'] },
      { name: 'All Files', extensions: ['*'] }
    ],
    properties: ['openFile']
  })
  return result
}

// ============ 日志管理处理器 ============
function handleAppGetLogPath() {
  return { path: loggerService.getLogDir() }
}

function handleAppGetLogContent(data: { maxLines?: number }) {
  const content = loggerService.getLogContent(data.maxLines || 500)
  return { content }
}

function handleAppClearLogs() {
  return loggerService.clearLogs()
}

async function handleAppOpenLogFolder() {
  const logDir = loggerService.getLogDir()
  await shell.openPath(logDir)
  return { success: true, path: logDir }
}

// ============ ttyd 配置处理器 ============
function handleTtydGetPath() {
  return ttydService.getTtydPath()
}

function handleTtydSetPath(data: { path: string | null }) {
  return ttydService.setCustomTtydPath(data.path)
}

function handleTtydGetStatus() {
  return ttydService.getTtydStatus()
}

function handleTtydCheckPort(data: { port: number }) {
  return ttydService.checkPort(data.port)
}

function handleTtydKillPort(data: { port: number }) {
  return ttydService.killPortProcess(data.port)
}

// ============ plink 配置处理器 ============
function handlePlinkGetPath() {
  return ttydService.getPlinkPathForDisplay()
}

function handlePlinkSetPath(data: { path: string | null }) {
  return ttydService.setCustomPlinkPath(data.path)
}

// ============ sshpass 配置处理器 ============
function handleSshpassGetPath() {
  return ttydService.getSshpassPathForDisplay()
}

function handleSshpassSetPath(data: { path: string | null }) {
  return ttydService.setCustomSshpassPath(data.path)
}

// ============ 平台信息处理器 ============
function handlePlatformGetInfo() {
  return ttydService.getPlatformInfo()
}

// ============ 浏览器管理处理器 ============
function handleBrowserGetList() {
  return browserService.getBrowserList()
}

function handleBrowserGetAvailable() {
  return browserService.getAvailableBrowsers()
}

function handleBrowserAdd(data: { name: string; path: string }) {
  return browserService.addBrowser(data.name, data.path)
}

function handleBrowserDelete(data: { id: number }) {
  return browserService.deleteBrowser(data.id)
}

function handleBrowserUpdateStatus(data: { id: number; isEnabled: boolean }) {
  return browserService.updateBrowserStatus(data.id, data.isEnabled)
}

function handleBrowserDetect() {
  return browserService.detectSystemBrowsers()
}

function handleBrowserInitDefault() {
  browserService.initDefaultBrowsers()
}

function handleBrowserDetectAndAdd() {
  return browserService.detectAndAddNewBrowsers()
}

function handleBrowserUpdatePuppeteerVersion(data: { id: number; version: 'auto' | 'high' | 'low' }) {
  return browserService.updateBrowserPuppeteerVersion(data.id, data.version)
}

function handleBrowserDetectVersion(data: { id: number }) {
  return browserService.detectAndUpdateBrowserVersion(data.id)
}

function handleBrowserAnalyzeVersion(data: { path: string; preference?: 'auto' | 'high' | 'low' }) {
  // 导入分析函数
  const { analyzeBrowserForPuppeteer } = require('../services/puppeteerManager')
  return analyzeBrowserForPuppeteer(data.path, data.preference || 'auto')
}

// ============ 终端工具管理处理器 ============
function handleTerminalConfigGetList() {
  return terminalConfigService.getTerminalList()
}

function handleTerminalConfigGetAvailable() {
  return terminalConfigService.getAvailableTerminals()
}

function handleTerminalConfigAdd(data: { name: string; path: string; terminalType?: string }) {
  return terminalConfigService.addTerminal(data.name, data.path, data.terminalType || '')
}

function handleTerminalConfigDelete(data: { id: number }) {
  return terminalConfigService.deleteTerminal(data.id)
}

function handleTerminalConfigUpdateStatus(data: { id: number; isEnabled: boolean }) {
  return terminalConfigService.updateTerminalStatus(data.id, data.isEnabled)
}

function handleTerminalConfigDetect() {
  return terminalConfigService.detectSystemTerminals()
}

function handleTerminalConfigInitDefault() {
  return terminalConfigService.initDefaultTerminals()
}

function handleTerminalConfigDetectAndAdd() {
  return terminalConfigService.detectAndAddNewTerminals()
}

// ============ Chromium 管理处理器 ============
function handleChromiumGetStatus() {
  return chromiumService.getChromiumStatus()
}

async function handleChromiumInstall() {
  return chromiumService.installChromium()
}

function handleChromiumUninstall() {
  return chromiumService.uninstallChromium()
}

function handleChromiumRegister() {
  return chromiumService.registerChromium()
}

function handleChromiumUnregister() {
  return chromiumService.unregisterChromium()
}

// ============ 应用锁定处理器 ============
function handleAppLockGetSettings() {
  return appLockService.getLockSettings()
}

function handleAppLockUpdateSettings(data: { is_enabled?: boolean; lock_delay_minutes?: number }) {
  return appLockService.updateLockSettings(data)
}

function handleAppLockSetPassword(data: { password: string }) {
  return appLockService.setLockPassword(data.password)
}

function handleAppLockVerifyPassword(data: { password: string }) {
  return { valid: appLockService.verifyLockPassword(data.password) }
}

function handleAppLockRemovePassword() {
  return appLockService.removeLockPassword()
}

function handleAppLockLock() {
  return appLockService.lockApp()
}

function handleAppLockUnlock() {
  return appLockService.unlockApp()
}

function handleAppLockIsLocked() {
  return { is_locked: appLockService.isAppLocked() }
}
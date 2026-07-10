/**
 * Electron API mock
 * Provides complete mocks for all Electron APIs used across the codebase.
 * Imported in setup.ts to ensure mocks are active before any test runs.
 */
import { vi } from 'vitest'
import path from 'path'
import os from 'os'

// --- Electron app mock ---
const mockApp = {
  getPath: vi.fn((name: string) => {
    const mockUserData = path.join(os.tmpdir(), 'secure-ledger-test')
    const paths: Record<string, string> = {
      userData: mockUserData,
      appData: path.join(os.homedir(), 'AppData', 'Roaming'),
      home: os.homedir(),
      temp: os.tmpdir(),
      exe: path.join(mockUserData, 'secure-ledger.exe'),
      module: path.join(mockUserData, 'app.asar'),
    }
    return paths[name] || mockUserData
  }),
  getVersion: vi.fn(() => '1.0.0-test'),
  getName: vi.fn(() => 'secure-ledger'),
  on: vi.fn(),
  quit: vi.fn(),
  exit: vi.fn(),
  whenReady: vi.fn(() => Promise.resolve()),
  isPackaged: false,
  commandLine: { appendSwitch: vi.fn(), appendArgument: vi.fn() },
}

// --- Electron safeStorage mock ---
const mockSafeStorage = {
  isEncryptionAvailable: vi.fn(() => true),
  encryptString: vi.fn((s: string) => Buffer.from(s, 'utf-8')),
  decryptString: vi.fn((b: Buffer) => b.toString('utf-8')),
}

// --- Electron BrowserWindow mock ---
const mockBrowserWindow = {
  getAllWindows: vi.fn(() => []),
  getFocusedWindow: vi.fn(() => null),
  fromId: vi.fn(() => null),
  fromWebContents: vi.fn(() => null),
}

// --- Electron ipcMain mock ---
const mockIpcMain = {
  handle: vi.fn(),
  on: vi.fn(),
  removeHandler: vi.fn(),
}

// --- Electron dialog mock ---
const mockDialog = {
  showOpenDialog: vi.fn(() => Promise.resolve({ canceled: true, filePaths: [] })),
  showSaveDialog: vi.fn(() => Promise.resolve({ canceled: true, filePath: '' })),
  showMessageBox: vi.fn(() => Promise.resolve({ response: 0 })),
}

// --- Electron shell mock ---
const mockShell = {
  openPath: vi.fn(() => Promise.resolve('')),
  showItemInFolder: vi.fn(),
  openExternal: vi.fn(() => Promise.resolve()),
}

// --- Complete electron mock ---
vi.mock('electron', () => ({
  app: mockApp,
  safeStorage: mockSafeStorage,
  BrowserWindow: mockBrowserWindow,
  ipcMain: mockIpcMain,
  dialog: mockDialog,
  shell: mockShell,
  default: {
    app: mockApp,
    safeStorage: mockSafeStorage,
    BrowserWindow: mockBrowserWindow,
    ipcMain: mockIpcMain,
    dialog: mockDialog,
    shell: mockShell,
  },
}))

export { mockApp, mockSafeStorage, mockBrowserWindow, mockIpcMain, mockDialog, mockShell }

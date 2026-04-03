/**
 * Token Receiver Service
 * 
 * HTTP server that accepts Token transfer requests from same-subnet machines.
 * Security:
 * - Only accepts POST /token requests
 * - Only accepts connections from same subnet
 * - Validates token before showing confirmation dialog
 * - User must confirm before import
 */
import http, { IncomingMessage, ServerResponse } from 'http'
import { BrowserWindow, ipcMain } from 'electron'
import { validateImportConditions, importEndpointFromToken, ShareTokenPayload } from './endpointShare'
import { getLocalIPs, areInSameSubnet } from '../utils/network'

const DEFAULT_PORT = 37777
const FALLBACK_PORTS = [37778, 37779, 37780]
const MAX_TOKEN_SIZE = 16384  // 16KB max

let server: http.Server | null = null
let currentPort: number | null = null

// 待确认的请求
const pendingConfirmations = new Map<string, { resolve: (accepted: boolean) => void }>()

/**
 * Start the token receiver HTTP server
 */
export async function startTokenReceiver(): Promise<{ success: boolean; port?: number; error?: string }> {
  if (server) {
    console.log('[TokenReceiver] Already running on port', currentPort)
    return { success: true, port: currentPort! }
  }
  
  // Find available port
  const port = await findAvailablePort()
  if (!port) {
    console.error('[TokenReceiver] No available port found')
    return { success: false, error: 'No available port (37777-37780 all in use)' }
  }
  
  server = http.createServer(handleTokenRequest)
  
  try {
    await new Promise<void>((resolve, reject) => {
      server!.listen(port, '0.0.0.0', () => {
        console.log(`[TokenReceiver] Server listening on 0.0.0.0:${port}`)
        resolve()
      })
      server!.on('error', reject)
    })
    
    currentPort = port
    console.log(`[TokenReceiver] Started successfully on port ${port}`)
    return { success: true, port }
    
  } catch (err: any) {
    console.error('[TokenReceiver] Failed to start:', err.message)
    server = null
    currentPort = null
    return { success: false, error: err.message }
  }
}

/**
 * Stop the token receiver HTTP server
 */
export function stopTokenReceiver(): { success: boolean } {
  if (!server) {
    return { success: true }
  }
  
  try {
    server.close()
    server = null
    currentPort = null
    console.log('[TokenReceiver] Server stopped')
    return { success: true }
  } catch (err: any) {
    console.error('[TokenReceiver] Failed to stop:', err.message)
    return { success: false }
  }
}

/**
 * Get current status of the token receiver
 */
export function getTokenReceiverStatus(): { running: boolean; port: number | null } {
  return { 
    running: server !== null, 
    port: currentPort 
  }
}

/**
 * Handle incoming HTTP requests
 */
async function handleTokenRequest(req: IncomingMessage, res: ServerResponse) {
  // CORS headers for browser requests
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  
  // Handle preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(200).end()
    return
  }
  
  // Only accept POST /token
  if (req.method !== 'POST' || req.url !== '/token') {
    res.writeHead(404, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Not found. Use POST /token' }))
    return
  }
  
  // Security: Check subnet restriction
  const clientIP = extractClientIP(req)
  const localIPs = getLocalIPs()
  
  if (localIPs.length > 0 && clientIP) {
    const inSameSubnet = localIPs.some(local => areInSameSubnet(clientIP, local))
    if (!inSameSubnet) {
      console.warn(`[TokenReceiver] Rejected request from ${clientIP} - not in same subnet`)
      res.writeHead(403, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Subnet restriction - IP not in same subnet' }))
      return
    }
  }
  
  // Read request body
  let body = ''
  req.on('data', chunk => {
    if (body.length > MAX_TOKEN_SIZE) {
      res.writeHead(413, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Request too large' }))
      req.destroy()
      return
    }
    body += chunk
  })
  
  req.on('end', async () => {
    try {
      const token = body.trim()
      
      if (!token || token.length < 100) {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'Invalid token format' }))
        return
      }
      
      // Validate token before showing dialog
      const validation = await validateImportConditions(token)
      
      if (!validation.valid) {
        console.warn('[TokenReceiver] Token validation failed:', validation.error)
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: validation.error || 'Token validation failed' }))
        return
      }
      
      const payload = validation.payload!
      
      // Show confirmation dialog to user
      const confirmed = await showConfirmationDialog(payload, clientIP)
      
      if (confirmed) {
        // Import the token
        const endpoint = await importEndpointFromToken(token)
        
        console.log(`[TokenReceiver] Token imported: ${endpoint.name} (ID: ${endpoint.id})`)
        
        // Notify renderer to refresh
        const win = BrowserWindow.getAllWindows()[0]
        if (win && !win.isDestroyed()) {
          win.webContents.send('token:imported', { 
            endpoint, 
            fromIP: clientIP 
          })
        }
        
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ 
          success: true, 
          endpointId: endpoint.id,
          endpointName: endpoint.name
        }))
      } else {
        // User rejected
        res.writeHead(403, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'User rejected the import' }))
      }
      
    } catch (err: any) {
      console.error('[TokenReceiver] Error processing request:', err)
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: err.message || 'Internal server error' }))
    }
  })
}

/**
 * Show confirmation dialog for token import via IPC (frontend Vue dialog)
 */
async function showConfirmationDialog(payload: ShareTokenPayload, fromIP?: string): Promise<boolean> {
  const win = BrowserWindow.getAllWindows()[0]
  if (!win) return false
  
  // 生成唯一确认ID
  const confirmId = `confirm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  
  return new Promise((resolve) => {
    // 存储等待响应的 resolve 函数
    pendingConfirmations.set(confirmId, { resolve })
    
    // 发送确认请求到前端
    win.webContents.send('token:confirm', {
      confirmId,
      endpointName: payload.endpoint.name,
      endpointIcon: payload.endpoint.icon,
      loginType: payload.endpoint.login_type,
      restrictions: payload.restrictions,
      targetIp: payload.targetIp,
      importDeadline: payload.importDeadline,
      fromIP
    })
    
    // 60秒超时
    setTimeout(() => {
      if (pendingConfirmations.has(confirmId)) {
        pendingConfirmations.delete(confirmId)
        resolve(false)
      }
    }, 60000)
  })
}

/**
 * Handle confirmation response from frontend
 */
export function handleTokenConfirmResponse(confirmId: string, accepted: boolean) {
  const pending = pendingConfirmations.get(confirmId)
  if (pending) {
    pendingConfirmations.delete(confirmId)
    pending.resolve(accepted)
  }
}

/**
 * Register IPC handler for token confirmation
 */
export function registerTokenConfirmationHandler() {
  ipcMain.on('token:confirm:response', (_event, { confirmId, accepted }) => {
    handleTokenConfirmResponse(confirmId, accepted)
  })
}

/**
 * Find an available port from the pool
 */
async function findAvailablePort(): Promise<number | null> {
  const ports = [DEFAULT_PORT, ...FALLBACK_PORTS]
  
  for (const port of ports) {
    try {
      await new Promise<void>((resolve, reject) => {
        const testServer = http.createServer()
        
        testServer.once('error', (err: any) => {
          if (err.code === 'EADDRINUSE') {
            reject(err)
          } else {
            reject(err)
          }
        })
        
        testServer.once('listening', () => {
          testServer.close()
          resolve()
        })
        
        testServer.listen(port, '0.0.0.0')
      })
      
      // Port is available
      return port
      
    } catch {
      // Port in use, try next
      continue
    }
  }
  
  return null
}

/**
 * Extract client IP from request
 */
function extractClientIP(req: IncomingMessage): string {
  const socket = req.socket
  let ip = socket.remoteAddress || ''
  
  // Remove IPv6 prefix
  if (ip.startsWith('::ffff:')) {
    ip = ip.substring(7)
  }
  
  return ip
}
/**
 * Endpoint Share Service
 * 
 * Token v2.0 分享机制：
 * 
 * 分享端：
 * 1. 解密本地数据（用分享端私钥）
 * 2. 生成随机对称密钥
 * 3. 用对称密钥加密敏感数据
 * 4. Token 包含：对称密钥 + 加密数据 + 签名
 * 
 * 导入端：
 * 1. 验证 Token 签名
 * 2. 只保存 Token 本身到数据库
 * 3. 登录时实时从 Token 解码获取数据
 * 4. 用 Token 中的 symmetricKey 解密 slot 值
 */
import * as jose from 'jose'
import { loadPrivateKey, loadPublicKey } from '../crypto/secureKeyStorage'
import { hybridDecrypt } from '../crypto/hybrid'
import { symmetricEncrypt, symmetricDecrypt, generateSymmetricKey } from '../crypto/hybrid'
import { run, queryOne } from '../database/index'
import type { Endpoint, Page, Slot } from '../database/init'
import { getLocalIPs, isIPInCIDR, normalizeToCIDR, isValidCIDR } from '../utils/network'

// ============================================
// Types
// ============================================

export interface ShareRestrictions {
  type: 'unlimited' | 'count' | 'duration' | 'datetime'
  maxUsage?: number       // For type='count'
  durationHours?: number  // For type='duration'
  expiresAt?: string      // For type='datetime' - ISO string
  targetIp?: string       // Target IP or CIDR for import restriction
  importDeadline?: number // Hours from generation until import deadline
}

// Slot for token payload (encrypted with symmetric key)
interface SlotInToken {
  order_index: number
  name: string
  element_xpath: string
  action_type: 'input' | 'click' | 'select' | 'password' | 'keyfile'
  value: string       // 用对称密钥加密的值（明文已加密）
  is_encrypted: boolean
  timeout: number
}

// Page with slots for token payload
interface PageInToken {
  order_index: number
  url: string
  ssh_port?: number
  slots: SlotInToken[]
}

export interface ShareTokenPayload {
  // JWT standard claims
  iat: number           // Issued at (Unix timestamp)
  jti: string           // Unique token ID (UUID)
  
  // Version
  version: string       // '2.0'
  
  // Endpoint with pages and slots
  endpoint: {
    name: string
    icon: string
    login_type: 'web' | 'ssh'
    pages: PageInToken[]
  }
  
  // Symmetric key for decrypting slot values (v2.0 only)
  // 导入端用这个密钥解密数据，然后用本地公钥重新加密
  symmetricKey?: string   // Hex-encoded AES-256 key (64 chars)
  
  // Restriction configuration
  restrictions: {
    type: 'unlimited' | 'count' | 'duration' | 'datetime'
    maxUsage?: number
    durationHours?: number
    expiresAt?: number   // Unix timestamp
  }
  
  // Usage tracking (stored in token)
  usageCount: number
  
  // Share endpoint's public key for signature verification
  publicKey: string      // PEM-encoded public key
  
  // Import restrictions
  targetIp?: string      // Target IP or CIDR
  importDeadline?: number // Hours from iat until import deadline
}

export interface TokenValidationResult {
  valid: boolean
  payload?: ShareTokenPayload
  error?: string
  shouldUpdate?: boolean
  isExpired?: boolean
  isExhausted?: boolean
  ipMismatch?: boolean      // IP restriction mismatch
  deadlineExpired?: boolean // Import deadline passed
}

// Full endpoint data for generating token
export interface EndpointFullData {
  id: number
  name: string
  icon: string
  login_type: 'web' | 'ssh'
  pages: (Page & { slots: Slot[] })[]
}

// ============================================
// Token Generation
// ============================================

/**
 * Generate a share token for an endpoint with complete pages and slots
 * 
 * 新流程：
 * 1. 解密本地加密的数据（用分享端私钥）
 * 2. 生成随机对称密钥
 * 3. 用对称密钥加密敏感数据
 * 4. 生成包含对称密钥的 Token
 */
export async function generateShareToken(
  endpoint: EndpointFullData,
  restrictions: ShareRestrictions
): Promise<string> {
  // Check if endpoint already has a token
  const existing = queryOne<{ share_token: string }>(
    'SELECT share_token FROM endpoint WHERE id = ?',
    [endpoint.id]
  )
  
  if (existing?.share_token) {
    throw new Error('此登录端已被分享，不可重复分享')
  }
  
  // Load keys
  const privateKey = await loadPrivateKey()
  const publicKey = loadPublicKey()
  
  if (!privateKey || !publicKey) {
    throw new Error('密钥不可用，无法生成Token')
  }
  
  // 生成对称密钥
  const symmetricKey = generateSymmetricKey()
  console.log('[EndpointShare] Generated symmetric key for token')
  
  // Build pages with slots (decrypt and re-encrypt with symmetric key)
  const pagesInToken: PageInToken[] = []
  
  for (const page of endpoint.pages) {
    const slotsInToken: SlotInToken[] = []
    
    for (const slot of page.slots) {
      let valueToEncrypt = slot.value
      
      // 如果数据已加密，先解密
      if (slot.is_encrypted && slot.value) {
        try {
          valueToEncrypt = hybridDecrypt(slot.value)
        } catch (error) {
          console.warn('[EndpointShare] Failed to decrypt slot value, using original')
          valueToEncrypt = slot.value
        }
      }
      
      // 用对称密钥加密
      let encryptedValue = valueToEncrypt
      if (valueToEncrypt && slot.is_encrypted) {
        try {
          encryptedValue = symmetricEncrypt(valueToEncrypt, symmetricKey)
        } catch (error) {
          console.warn(`[EndpointShare] Failed to encrypt with symmetric key: ${slot.name || slot.id}`)
        }
      }
      
      slotsInToken.push({
        order_index: slot.order_index,
        name: slot.name || '',
        element_xpath: slot.element_xpath,
        action_type: slot.action_type,
        value: encryptedValue,
        is_encrypted: slot.is_encrypted,
        timeout: slot.timeout
      })
    }
    
    pagesInToken.push({
      order_index: page.order_index,
      url: page.url,
      ssh_port: page.ssh_port,
      slots: slotsInToken
    })
  }
  
  // Build payload
  const now = Math.floor(Date.now() / 1000)
  const payload: ShareTokenPayload = {
    iat: now,
    jti: crypto.randomUUID(),
    version: '2.0',
    endpoint: {
      name: endpoint.name,
      icon: endpoint.icon,
      login_type: endpoint.login_type,
      pages: pagesInToken,
    },
    symmetricKey: symmetricKey,
    restrictions: buildRestrictions(restrictions, now),
    usageCount: 0,
    publicKey: publicKey,
  }
  
  // Add import restrictions
  if (restrictions.targetIp) {
    payload.targetIp = restrictions.targetIp
  }
  if (restrictions.importDeadline) {
    payload.importDeadline = restrictions.importDeadline
  }
  
  // Import private key
  const privateKeyObj = await jose.importPKCS8(privateKey, 'RS256')
  
  // Sign token
  const token = await new jose.SignJWT(payload as any)
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
    .setIssuedAt(now)
    .setJti(payload.jti)
    .sign(privateKeyObj)
  
  console.log('[EndpointShare] Token generated successfully (version 2.0)')
  
  return token
}

function buildRestrictions(
  restrictions: ShareRestrictions,
  now: number
): ShareTokenPayload['restrictions'] {
  const result: ShareTokenPayload['restrictions'] = {
    type: restrictions.type,
  }
  
  switch (restrictions.type) {
    case 'count':
      result.maxUsage = restrictions.maxUsage || 1
      break
    case 'duration':
      result.durationHours = restrictions.durationHours || 24
      break
    case 'datetime':
      if (restrictions.expiresAt) {
        result.expiresAt = Math.floor(new Date(restrictions.expiresAt).getTime() / 1000)
      }
      break
  }
  
  return result
}

// ============================================
// Token Validation
// ============================================

/**
 * Validate a share token
 */
export async function validateShareToken(token: string): Promise<TokenValidationResult> {
  try {
    // Decode without verification first to extract public key
    const parts = token.split('.')
    if (parts.length !== 3) {
      return { valid: false, error: 'Token格式无效' }
    }
    
    const payloadJson = Buffer.from(parts[1], 'base64url').toString('utf-8')
    const payload = JSON.parse(payloadJson) as ShareTokenPayload
    
    // Validate structure
    if (!isValidPayloadStructure(payload)) {
      return { valid: false, error: 'Token结构无效' }
    }
    
    // Import embedded public key
    const publicKeyObj = await jose.importSPKI(payload.publicKey, 'RS256')
    
    // Verify signature
    await jose.jwtVerify(token, publicKeyObj)
    
    // Check expiry
    if (payload.restrictions.type === 'duration') {
      const expiresAt = payload.iat + (payload.restrictions.durationHours || 0) * 3600
      if (Date.now() / 1000 > expiresAt) {
        return { valid: false, isExpired: true, error: 'Token已过期' }
      }
    } else if (payload.restrictions.type === 'datetime' && payload.restrictions.expiresAt) {
      if (Date.now() / 1000 > payload.restrictions.expiresAt) {
        return { valid: false, isExpired: true, error: 'Token已过期' }
      }
    }
    
    // Check usage count
    if (payload.restrictions.type === 'count' && payload.restrictions.maxUsage) {
      if (payload.usageCount >= payload.restrictions.maxUsage) {
        return { valid: false, isExhausted: true, error: 'Token使用次数已用尽' }
      }
    }
    
    return { valid: true, payload }
  } catch (error: any) {
    console.error('[EndpointShare] Token validation failed:', error)
    return { valid: false, error: error.message || 'Token验证失败' }
  }
}

function isValidPayloadStructure(payload: any): boolean {
  return (
    payload &&
    typeof payload.iat === 'number' &&
    typeof payload.jti === 'string' &&
    payload.version === '2.0' &&
    payload.endpoint &&
    typeof payload.endpoint.name === 'string' &&
    Array.isArray(payload.endpoint.pages) &&
    payload.restrictions &&
    typeof payload.restrictions.type === 'string' &&
    typeof payload.usageCount === 'number' &&
    typeof payload.publicKey === 'string'
  )
}

// ============================================
// Import Validation
// ============================================

/**
 * Validate import conditions for a token
 * 
 * Validation order:
 * 1. Standard JWT validation (signature, expiry, usage count)
 * 2. Import deadline check (token must be imported within deadline)
 * 3. Target IP check (local IP must match targetIp)
 */
export async function validateImportConditions(
  token: string
): Promise<TokenValidationResult> {
  // 1. Standard JWT validation
  const validation = await validateShareToken(token)
  
  if (!validation.valid) {
    return validation
  }
  
  if (!validation.payload) {
    return { valid: false, error: 'Token解析失败' }
  }
  
  const payload = validation.payload
  
  // 2. Check import deadline (Token survival time)
  if (payload.importDeadline) {
    const deadlineTimestamp = payload.iat + payload.importDeadline * 3600
    if (Date.now() / 1000 > deadlineTimestamp) {
      return {
        valid: false,
        error: 'Token导入期限已过，无法导入',
        deadlineExpired: true
      }
    }
  }
  
  // 3. Check target IP matches local machine
  if (payload.targetIp) {
    const localIPs = getLocalIPs()
    
    if (localIPs.length === 0) {
      return {
        valid: false,
        error: '无法获取本机IP地址'
      }
    }
    
    // Normalize target IP to CIDR
    const targetCIDR = normalizeToCIDR(payload.targetIp)
    
    // Check if any local IP matches
    const matchFound = localIPs.some(localIP => isIPInCIDR(localIP, targetCIDR))
    
    if (!matchFound) {
      return {
        valid: false,
        error: `Token目标IP (${payload.targetIp}) 与本机IP (${localIPs.join(', ')}) 不匹配`,
        ipMismatch: true
      }
    }
  }
  
  return { valid: true, payload }
}

// ============================================
// Import from Token
// ============================================

/**
 * Import an endpoint from a share token
 * 
 * Token v2.0 流程：
 * 1. 验证 Token 签名
 * 2. 只保存 endpoint 记录和 Token 本身
 * 3. 不创建 pages/slots 数据库记录
 * 4. 登录时实时从 Token 解码获取数据
 */
export async function importEndpointFromToken(token: string): Promise<Endpoint> {
  // Use new validation that checks import deadline and target IP
  const validation = await validateImportConditions(token)
  
  if (!validation.valid || !validation.payload) {
    throw new Error(validation.error || 'Token无效')
  }
  
  const payload = validation.payload
  
  // Check if token already imported
  const existing = queryOne<{ id: number }>(
    'SELECT id FROM endpoint WHERE share_token = ?',
    [token]
  )
  
  if (existing) {
    throw new Error('此Token已被导入')
  }
  
  // 只创建 endpoint 记录，保存 Token，不创建 pages/slots
  const now = new Date().toISOString()
  const endpointResult = run(
    `INSERT INTO endpoint (name, icon, login_type, share_token, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [payload.endpoint.name, payload.endpoint.icon, payload.endpoint.login_type, token, now, now]
  )
  
  const endpointId = endpointResult.lastInsertRowid as number
  
  // Return the created endpoint
  const endpoint = queryOne<Endpoint>(
    'SELECT * FROM endpoint WHERE id = ?',
    [endpointId]
  )
  
  if (!endpoint) {
    throw new Error('创建登录端失败')
  }
  
  console.log('[EndpointShare] Token imported successfully (v2.0)')
  return endpoint
}



// ============================================
// Permission Check & Token Update
// ============================================

/**
 * Check if a token-endpoint can execute login
 */
export async function checkTokenPermission(endpoint: Endpoint): Promise<{
  allowed: boolean
  reason?: string
}> {
  // Not a token-endpoint
  if (!endpoint.share_token) {
    return { allowed: true }
  }
  
  const validation = await validateShareToken(endpoint.share_token)
  
  if (!validation.valid) {
    return { allowed: false, reason: validation.error }
  }
  
  if (!validation.payload) {
    return { allowed: false, reason: 'Token解析失败' }
  }
  
  // Token is valid, allow login
  return { allowed: true }
}

/**
 * Increment usage count and return updated token
 */
export async function incrementTokenUsage(endpoint: Endpoint): Promise<string | null> {
  if (!endpoint.share_token) {
    return null
  }
  
  const validation = await validateShareToken(endpoint.share_token)
  
  if (!validation.valid || !validation.payload) {
    return null
  }
  
  const payload = validation.payload
  
  // Check if it's a count-limited token
  if (payload.restrictions.type !== 'count') {
    return null // No need to update for unlimited/duration/datetime
  }
  
  // Increment usage count
  const newUsageCount = payload.usageCount + 1
  
  // Build new payload
  const newPayload: ShareTokenPayload = {
    ...payload,
    usageCount: newUsageCount,
  }
  
  // Load private key for re-signing
  const privateKey = await loadPrivateKey()
  if (!privateKey) {
    console.error('[EndpointShare] Cannot update token: private key unavailable')
    return null
  }
  
  const privateKeyObj = await jose.importPKCS8(privateKey, 'RS256')
  
  // Re-sign token
  const newToken = await new jose.SignJWT(newPayload as any)
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
    .setIssuedAt(payload.iat)
    .setJti(payload.jti)
    .sign(privateKeyObj)
  
  // Update database
  run(
    'UPDATE endpoint SET share_token = ?, updated_at = ? WHERE id = ?',
    [newToken, new Date().toISOString(), endpoint.id]
  )
  
  return newToken
}

/**
 * Check if endpoint is a token-endpoint
 */
export function isTokenEndpoint(endpoint: Endpoint): boolean {
  return !!endpoint.share_token
}

/**
 * 从 Token 解码并解密 pages/slots 数据
 * 用于 Token endpoint 登录时获取实时数据
 */
export function decodeTokenPages(token: string): (Page & { slots: Slot[] })[] | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) {
      return null
    }
    
    const payloadJson = Buffer.from(parts[1], 'base64url').toString('utf-8')
    const payload = JSON.parse(payloadJson) as ShareTokenPayload
    
    if (!payload.symmetricKey || !payload.endpoint.pages) {
      return null
    }
    
    const symmetricKey = payload.symmetricKey
    const pages: (Page & { slots: Slot[] })[] = []
    
    for (const pageData of payload.endpoint.pages) {
      const slots: Slot[] = pageData.slots.map(slotData => {
        let value = slotData.value
        
        // 如果是加密数据，用 symmetricKey 解密
        if (slotData.is_encrypted && slotData.value && symmetricKey) {
          try {
            value = symmetricDecrypt(slotData.value, symmetricKey)
          } catch (error) {
            console.warn('[EndpointShare] Failed to decrypt slot value')
          }
        }
        
        return {
          id: 0, // Token 中的 slots 没有 ID
          page_id: 0,
          order_index: slotData.order_index,
          name: slotData.name || '',
          element_xpath: slotData.element_xpath,
          action_type: slotData.action_type,
          value: value,
          is_encrypted: false, // 解密后标记为未加密
          timeout: slotData.timeout,
          created_at: '',
          updated_at: ''
        } as Slot
      })
      
      pages.push({
        id: 0,
        endpoint_id: 0,
        order_index: pageData.order_index,
        url: pageData.url,
        ssh_port: pageData.ssh_port ?? undefined,
        created_at: '',
        updated_at: '',
        slots: slots
      })
    }
    
    return pages
  } catch (error) {
    console.error('[EndpointShare] Failed to decode token pages:', error)
    return null
  }
}

/**
 * Get token status for display
 */
export async function getTokenStatus(endpoint: Endpoint): Promise<{
  isToken: boolean
  isValid: boolean
  usageInfo?: string
  expiryInfo?: string
}> {
  if (!endpoint.share_token) {
    return { isToken: false, isValid: true }
  }
  
  const validation = await validateShareToken(endpoint.share_token)
  
  if (!validation.valid || !validation.payload) {
    return { isToken: true, isValid: false }
  }
  
  const payload = validation.payload
  const result: { isToken: boolean; isValid: boolean; usageInfo?: string; expiryInfo?: string } = {
    isToken: true,
    isValid: true,
  }
  
  // Usage info
  if (payload.restrictions.type === 'count' && payload.restrictions.maxUsage) {
    result.usageInfo = `${payload.usageCount}/${payload.restrictions.maxUsage}次`
  }
  
  // Expiry info
  if (payload.restrictions.type === 'duration' && payload.restrictions.durationHours) {
    const expiresAt = new Date((payload.iat + payload.restrictions.durationHours * 3600) * 1000)
    result.expiryInfo = `有效期至 ${expiresAt.toLocaleString()}`
  } else if (payload.restrictions.type === 'datetime' && payload.restrictions.expiresAt) {
    const expiresAt = new Date(payload.restrictions.expiresAt * 1000)
    result.expiryInfo = `有效期至 ${expiresAt.toLocaleString()}`
  }
  
  return result
}

/**
 * Clear token from endpoint (mark as invalid/deleted)
 */
export function clearEndpointToken(endpointId: number): boolean {
  try {
    run(
      'UPDATE endpoint SET share_token = "", updated_at = ? WHERE id = ?',
      [new Date().toISOString(), endpointId]
    )
    return true
  } catch (error) {
    console.error('[EndpointShare] Failed to clear token:', error)
    return false
  }
}

/**
 * Extract symmetric key from token (v2.0)
 * @deprecated Use validateShareToken instead
 */
export function extractSymmetricKeyFromToken(token: string): string | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) {
      return null
    }
    
    const payloadJson = Buffer.from(parts[1], 'base64url').toString('utf-8')
    const payload = JSON.parse(payloadJson) as ShareTokenPayload
    
    if (payload.version === '2.0' && payload.symmetricKey) {
      return payload.symmetricKey
    }
    
    return null
  } catch {
    return null
  }
}

/**
 * Extract public key from token (for signature verification)
 */
export function extractPublicKeyFromToken(token: string): string | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) {
      return null
    }
    
    const payloadJson = Buffer.from(parts[1], 'base64url').toString('utf-8')
    const payload = JSON.parse(payloadJson) as ShareTokenPayload
    
    if (!payload.publicKey) {
      return null
    }
    
    return payload.publicKey
  } catch {
    return null
  }
}
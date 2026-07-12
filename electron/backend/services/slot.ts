import { db } from '../database/init'
import { hybridEncrypt, hybridDecrypt, hybridEncryptWithKey, hybridDecryptWithKey, isHybridEncrypted } from '../crypto/hybrid'
import { loadEndpointKeys, loadSubPrivateKey } from '../crypto/keyHierarchy'
import type { Slot } from '../database/init'

// 数据库返回的原始 Slot 类型（is_encrypted 是 INTEGER）
interface RawSlot {
  id: number
  page_id: number
  order_index: number
  name?: string
  element_xpath: string
  action_type: 'input' | 'click' | 'select' | 'password' | 'keyfile' | 'captcha'
  value: string
  is_encrypted: number  // 数据库中是 INTEGER (0 或 1)
  timeout: number
  output_key?: string
  created_at: string
  updated_at: string
  username?: string
  keyfile?: string
  passphrase?: string
}

// 将原始 Slot 转换为 Slot
function convertSlot(raw: RawSlot): Slot {
  return {
    ...raw,
    is_encrypted: raw.is_encrypted === 1
  }
}

/**
 * 根据 slot 的 page_id 查找所属 endpoint_id
 */
function getEndpointIdForSlot(slotPageId: number): number | null {
  const row = db.queryOne<{ endpoint_id: number }>(
    'SELECT endpoint_id FROM page WHERE id = ?',
    [slotPageId]
  )
  return row?.endpoint_id || null
}

/**
 * 获取 slot 所属端点的子公钥（用于加密）
 */
function getSubPublicKeyForSlot(slotPageId: number): string | null {
  const endpointId = getEndpointIdForSlot(slotPageId)
  if (!endpointId) return null
  const keys = loadEndpointKeys(endpointId)
  return keys?.sub_public_key || null
}

/**
 * 获取 slot 所属端点的子私钥（用于解密）
 */
function getSubPrivateKeyForSlot(slotPageId: number): string | null {
  const endpointId = getEndpointIdForSlot(slotPageId)
  if (!endpointId) return null
  return loadSubPrivateKey(endpointId)
}

// 获取步骤页的所有操作槽
export function listSlots(pageId: number): Slot[] {
  const rawSlots = db.query<RawSlot>(
    'SELECT * FROM slot WHERE page_id = ? ORDER BY order_index',
    [pageId]
  )
  return rawSlots.map(convertSlot)
}

// 获取单个操作槽
export function getSlot(id: number): Slot | null {
  const rawSlot = db.queryOne<RawSlot>('SELECT * FROM slot WHERE id = ?', [id])
  if (!rawSlot) return null
  return convertSlot(rawSlot)
}

/**
 * 加密敏感值（使用端点子公钥，回退到全局密钥）
 */
function encryptValue(value: string, slotPageId?: number): string {
  if (!value) return value

  // 尝试使用端点子密钥
  if (slotPageId) {
    const subPublicKey = getSubPublicKeyForSlot(slotPageId)
    if (subPublicKey) {
      return hybridEncryptWithKey(value, subPublicKey)
    }
  }

  // 回退: 使用全局密钥 (legacy)
  return hybridEncrypt(value)
}

/**
 * 解密敏感值（自动检测加密类型，优先使用端点子私钥）
 */
export function decryptValue(encryptedValue: string, slotPageId?: number): string {
  if (!encryptedValue) return encryptedValue
  
  const cleanValue = encryptedValue.replace(/[\r\n\s]/g, '')
  if (!isHybridEncrypted(cleanValue)) return encryptedValue

  try {
    if (slotPageId) {
      const subPrivateKey = getSubPrivateKeyForSlot(slotPageId)
      if (subPrivateKey) {
        const result = hybridDecryptWithKey(cleanValue, subPrivateKey)
        const isDev = typeof process !== 'undefined' && process.env['VITE_DEV_SERVER_URL']
        if (isDev) {
          console.debug('[Slot] page_id=' + slotPageId + ' decrypted=' + (result ? 'OK value="' + result + '"' : 'FAIL'))
        }
        return result
      }
    }
    // 回退: 使用全局 legacy 密钥
    if (process.env['DEBUG'] === 'crypto') {
      console.debug('[Slot] page_id=' + (slotPageId || 'none') + ' no sub-key, fallback to legacy')
    }
    return hybridDecrypt(cleanValue)
  } catch (error) {
    if (process.env['DEBUG'] === 'crypto') {
      console.debug('[Slot] page_id=' + (slotPageId || 'none') + ' ERROR: ' + (error as Error).message)
    }
    console.debug('[Slot] Decryption failed:', (error as Error).message || error)
    return encryptedValue
  }
}

// 创建操作槽
export function createSlot(data: {
  page_id: number
  order_index?: number
  name?: string
  element_xpath: string
  action_type: 'input' | 'click' | 'select' | 'password' | 'keyfile' | 'captcha'
  value: string
  is_encrypted?: boolean
  timeout?: number
  output_key?: string
}): Slot {
  // 如果没有指定顺序，放到最后
  if (data.order_index === undefined) {
    const maxOrder = db.queryOne<{ max: number }>(
      'SELECT COALESCE(MAX(order_index), -1) as max FROM slot WHERE page_id = ?',
      [data.page_id]
    )
    data.order_index = (maxOrder?.max ?? -1) + 1
  }

  // 如果需要加密（使用端点子公钥）
  let finalValue = data.value
  if (data.is_encrypted && data.value) {
    finalValue = encryptValue(data.value, data.page_id)
  }

  const result = db.run(
    `INSERT INTO slot (page_id, order_index, name, element_xpath, action_type, value, is_encrypted, timeout, output_key) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.page_id, 
      data.order_index, 
      data.name || '', 
      data.element_xpath, 
      data.action_type, 
      finalValue, 
      data.is_encrypted ? 1 : 0, 
      data.timeout || 200,
      data.output_key || ''
    ]
  )

  return {
    id: result.lastInsertRowid as number,
    page_id: data.page_id,
    order_index: data.order_index,
    name: data.name || '',
    element_xpath: data.element_xpath,
    action_type: data.action_type,
    value: finalValue,
    is_encrypted: data.is_encrypted || false,
    timeout: data.timeout || 200,
    output_key: data.output_key || '',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
}

// 更新操作槽
export function updateSlot(id: number, updates: Partial<Slot>): boolean {
  const fields: string[] = []
  const values: any[] = []

  if (updates.order_index !== undefined) {
    fields.push('order_index = ?')
    values.push(updates.order_index)
  }
  if (updates.name !== undefined) {
    fields.push('name = ?')
    values.push(updates.name)
  }
  if (updates.element_xpath !== undefined) {
    fields.push('element_xpath = ?')
    values.push(updates.element_xpath)
  }
  if (updates.action_type !== undefined) {
    fields.push('action_type = ?')
    values.push(updates.action_type)
  }
  if (updates.value !== undefined) {
    // 检查是否需要加密（使用端点子公钥）
    if (updates.is_encrypted) {
      // 获取 slot 的 page_id 用于确定端点
      const slot = getSlot(id)
      const pageId = slot?.page_id
      fields.push('value = ?')
      values.push(encryptValue(updates.value, pageId))
    } else {
      fields.push('value = ?')
      values.push(updates.value)
    }
  }
  if (updates.is_encrypted !== undefined) {
    fields.push('is_encrypted = ?')
    values.push(updates.is_encrypted ? 1 : 0)
  }
  if (updates.timeout !== undefined) {
    fields.push('timeout = ?')
    values.push(updates.timeout)
  }
  if (updates.output_key !== undefined) {
    fields.push('output_key = ?')
    values.push(updates.output_key)
  }

  if (fields.length === 0) return false

  fields.push('updated_at = CURRENT_TIMESTAMP')
  values.push(id)

  db.run(`UPDATE slot SET ${fields.join(', ')} WHERE id = ?`, values)
  return true
}

// 删除操作槽
export function deleteSlot(id: number): boolean {
  const result = db.run('DELETE FROM slot WHERE id = ?', [id])
  return result.changes > 0
}

// 解密操作槽的值
export function decryptSlotValue(encryptedValue: string, slotPageId?: number): string {
  return decryptValue(encryptedValue, slotPageId)
}

// 解密操作槽的值（自动检测加密类型）
export function decryptSlotValueAuto(encryptedValue: string, slotPageId?: number): string {
  return decryptValue(encryptedValue, slotPageId)
}

// 调整操作槽顺序
export function reorderSlots(pageId: number, slotIds: number[]): boolean {
  return db.transaction(() => {
    slotIds.forEach((slotId, index) => {
      db.run(
        'UPDATE slot SET order_index = ? WHERE id = ? AND page_id = ?',
        [index, slotId, pageId]
      )
    })
    return true
  })
}
import { db } from '../database/init'
import { hybridEncrypt, hybridDecrypt, isHybridEncrypted } from '../crypto/hybrid'
import type { Slot } from '../database/init'

// 数据库返回的原始 Slot 类型（is_encrypted 是 INTEGER）
interface RawSlot {
  id: number
  page_id: number
  order_index: number
  name?: string
  element_xpath: string
  action_type: 'input' | 'click' | 'select' | 'password' | 'keyfile'
  value: string
  is_encrypted: number  // 数据库中是 INTEGER (0 或 1)
  timeout: number
  created_at: string
  updated_at: string
}

// 将原始 Slot 转换为 Slot
function convertSlot(raw: RawSlot): Slot {
  return {
    ...raw,
    is_encrypted: raw.is_encrypted === 1
  }
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
 * 加密敏感值（使用混合加密）
 */
function encryptValue(value: string): string {
  if (!value) return value
  return hybridEncrypt(value)
}

/**
 * 解密敏感值（自动检测加密类型）
 */
export function decryptValue(encryptedValue: string): string {
  if (!encryptedValue) return encryptedValue
  
  // 清理可能的换行符
  const cleanValue = encryptedValue.replace(/[\r\n\s]/g, '')
  
  // 检查是否是混合加密
  if (isHybridEncrypted(cleanValue)) {
    try {
      const decrypted = hybridDecrypt(cleanValue)
      return decrypted
    } catch (error) {
      console.warn('[Slot] Decryption failed')
      // 返回原值
      return encryptedValue
    }
  }
  
  // 未加密的数据，直接返回
  return encryptedValue
}

// 创建操作槽
export function createSlot(data: {
  page_id: number
  order_index?: number
  name?: string
  element_xpath: string
  action_type: 'input' | 'click' | 'select' | 'password' | 'keyfile'
  value: string
  is_encrypted?: boolean
  timeout?: number
}): Slot {
  // 如果没有指定顺序，放到最后
  if (data.order_index === undefined) {
    const maxOrder = db.queryOne<{ max: number }>(
      'SELECT COALESCE(MAX(order_index), -1) as max FROM slot WHERE page_id = ?',
      [data.page_id]
    )
    data.order_index = (maxOrder?.max ?? -1) + 1
  }

  // 如果需要加密
  let finalValue = data.value
  if (data.is_encrypted && data.value) {
    finalValue = encryptValue(data.value)
  }

  const result = db.run(
    `INSERT INTO slot (page_id, order_index, name, element_xpath, action_type, value, is_encrypted, timeout) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.page_id, 
      data.order_index, 
      data.name || '', 
      data.element_xpath, 
      data.action_type, 
      finalValue, 
      data.is_encrypted ? 1 : 0, 
      data.timeout || 200
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
    // 检查是否需要加密
    if (updates.is_encrypted) {
      fields.push('value = ?')
      values.push(encryptValue(updates.value))
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
export function decryptSlotValue(encryptedValue: string): string {
  return decryptValue(encryptedValue)
}

// 解密操作槽的值（自动检测加密类型）
export function decryptSlotValueAuto(encryptedValue: string): string {
  return decryptValue(encryptedValue)
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
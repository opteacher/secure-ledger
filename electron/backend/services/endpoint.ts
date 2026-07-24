import { db } from '../database/init'
import type { Endpoint, Page, Slot } from '../database/init'
import { listSlots } from './slot'
import * as endpointShare from './endpointShare'
import { generateEndpointSubKeyPair, saveEndpointKeys, getEncryptionVersion, migrateFromLegacy } from '../crypto/keyHierarchy'

// 完整的登录端数据 (包含步骤和操作)
export interface EndpointFull extends Endpoint {
  pages: (Page & { slots: Slot[] })[]
}

// 获取所有登录端
export function listEndpoints(): Endpoint[] {
  return db.query<Endpoint>(`SELECT e.* FROM endpoint e 
    LEFT JOIN (SELECT name, display_order as g_order FROM endpoint WHERE group_name = name AND group_name != '') g ON e.group_name = g.name 
    WHERE e.group_name != e.name OR e.group_name = ''
    ORDER BY g.g_order, e.group_name, e.display_order, e.created_at DESC`)
}

// 获取单个登录端
export function getEndpoint(id: number): EndpointFull | null {
  const endpoint = db.queryOne<Endpoint>('SELECT * FROM endpoint WHERE id = ?', [id])
  if (!endpoint) return null

  // Token endpoint: 从 Token 实时解码获取 pages/slots
  if (endpoint.share_token) {
    const pages = endpointShare.decodeTokenPages(endpoint.share_token)
    if (pages) {
      return { ...endpoint, pages }
    }
    // Token 解码失败，返回空 pages
    console.warn('[Endpoint] Failed to decode token pages for endpoint:', id)
    return { ...endpoint, pages: [] }
  }

  // 普通 endpoint: 从数据库获取 pages/slots
  const pages = db.query<Page>(
    'SELECT * FROM page WHERE endpoint_id = ? ORDER BY order_index',
    [id]
  )

  const pagesWithSlots = pages.map(page => {
    const slots = listSlots(page.id)
    return { ...page, slots }
  })

  return { ...endpoint, pages: pagesWithSlots }
}

// 创建登录端
export function createEndpoint(data: {
  name: string
  icon?: string
  login_type: 'web' | 'ssh'
  group_name?: string
}): Endpoint {
  const now = new Date().toISOString()
  const result = db.run(
    `INSERT INTO endpoint (name, icon, login_type, group_name, display_order, share_token, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [data.name, data.icon || '', data.login_type, data.group_name || '', data.display_order ?? 0, '', now, now]
  )

  const endpointId = result.lastInsertRowid as number

  // 确保分组标记记录存在
  if (data.group_name) ensureGroupExists(data.group_name)

  // v1.0: 为新端点生成子密钥对
  const version = getEncryptionVersion()
  if (version === 'v1.0' || version === null) {
    try {
      const subKeys = generateEndpointSubKeyPair()
      saveEndpointKeys(endpointId, subKeys.publicKey, subKeys.privateKey)
      console.log(`[Endpoint] Sub-key pair generated for endpoint ${endpointId}`)
    } catch (e: any) {
      console.warn(`[Endpoint] Failed to generate sub-keys for endpoint ${endpointId}:`, e.message)
    }
  }

  return {
    id: endpointId,
    name: data.name,
    icon: data.icon || '',
    login_type: data.login_type,
    group_name: data.group_name || '',
    display_order: 0,
    share_token: '',
    created_at: now,
    updated_at: now
  }
}

// 更新登录端
export function updateEndpoint(id: number, updates: Partial<Endpoint>): boolean {
  const fields: string[] = []
  const values: any[] = []

  if (updates.name !== undefined) {
    fields.push('name = ?')
    values.push(updates.name)
  }
  if (updates.icon !== undefined) {
    fields.push('icon = ?')
    values.push(updates.icon)
  }
  if (updates.login_type !== undefined) {
    fields.push('login_type = ?')
    values.push(updates.login_type)
  }
  if (updates.group_name !== undefined) {
    fields.push('group_name = ?')
    values.push(updates.group_name)
  }
  if (updates.display_order !== undefined) {
    fields.push('display_order = ?')
    values.push(updates.display_order)
  }

  if (fields.length === 0) return false

  fields.push('updated_at = CURRENT_TIMESTAMP')
  values.push(id)

  db.run(`UPDATE endpoint SET ${fields.join(', ')} WHERE id = ?`, values)
  if (updates.group_name !== undefined) {
    ensureGroupExists(updates.group_name)
    cleanupEmptyGroups()
  }
  return true
}

// 删除登录端 (级联删除相关数据)
export function deleteEndpoint(id: number): boolean {
  // 获取所有步骤页
  const pages = db.query<Page>('SELECT id FROM page WHERE endpoint_id = ?', [id])
  
  // 删除所有操作槽
  for (const page of pages) {
    db.run('DELETE FROM slot WHERE page_id = ?', [page.id])
  }
  
  // 删除所有步骤页
  db.run('DELETE FROM page WHERE endpoint_id = ?', [id])
  
  // 删除登录端
  const result = db.run('DELETE FROM endpoint WHERE id = ?', [id])

  // 删除端点密钥 (v1.0)
  try { db.run('DELETE FROM endpoint_key WHERE endpoint_id = ?', [id]) } catch (_) {}
  
  return result.changes > 0
}

// 导出登录端
export function exportEndpoints(ids: number[]): EndpointFull[] {
  return ids.map(id => getEndpoint(id)).filter((e): e is EndpointFull => e !== null)
}

// 确保分组存在：无标记记录则自动创建
export function ensureGroupExists(groupName: string): void {
  if (!groupName) return
  const exists = db.queryOne('SELECT id FROM endpoint WHERE group_name = name AND group_name = ?', [groupName])
  if (!exists) {
    const now = new Date().toISOString()
    db.run(
      `INSERT INTO endpoint (name, icon, login_type, group_name, display_order, share_token, created_at, updated_at)
       VALUES (?, '', 'web', ?, (SELECT COALESCE(MAX(display_order), -1) + 1 FROM endpoint WHERE group_name = name AND group_name != ''), '', ?, ?)`,
      [groupName, groupName, now, now])
  }
}

// 清理空分组：无正式端点的分组标记记录自动删除
export function cleanupEmptyGroups(): void {
  db.run(`DELETE FROM endpoint WHERE group_name = name AND group_name != ''
    AND group_name NOT IN (SELECT DISTINCT group_name FROM endpoint WHERE group_name != name AND group_name != '')`)
}
export function listDistinctGroups(): string[] {
  const rows = db.query<{ group_name: string }>(
    `SELECT DISTINCT group_name FROM endpoint WHERE group_name != '' AND group_name != name ORDER BY group_name`
  )
  return rows.map(r => r.group_name)
}

// 批量更新端点排序（分组标记记录由前端维护，此处仅更新 display_order）
export function reorderEndpoints(items: Array<{ id: number; group_name: string; display_order: number }>): void {
  for (const item of items) {
    db.run('UPDATE endpoint SET group_name = ?, display_order = ? WHERE id = ?',
      [item.group_name, item.display_order, item.id])
  }
  // Sync group marker ordering: each unique group's marker gets sequential display_order
  let gOrder = 0
  const seen = new Set<string>()
  for (const item of items) {
    if (item.group_name && !seen.has(item.group_name)) {
      seen.add(item.group_name)
      const marker = db.queryOne<{ id: number }>(
        'SELECT id FROM endpoint WHERE group_name = name AND group_name = ?', [item.group_name])
      if (marker) {
        db.run('UPDATE endpoint SET display_order = ? WHERE id = ?', [gOrder++, marker.id])
      } else {
        ensureGroupExists(item.group_name)
        const newMarker = db.queryOne<{ id: number }>(
          'SELECT id FROM endpoint WHERE group_name = name AND group_name = ?', [item.group_name])
        if (newMarker) db.run('UPDATE endpoint SET display_order = ? WHERE id = ?', [gOrder++, newMarker.id])
      }
    }
  }
  cleanupEmptyGroups()
}

// 导入登录端
export function importEndpoints(data: EndpointFull[]): { success: number; failed: number } {
  let success = 0
  let failed = 0

  for (const endpointData of data) {
    try {
      db.transaction(() => {
        // 创建登录端
        const endpointResult = db.run(
          `INSERT INTO endpoint (name, icon, login_type, group_name) VALUES (?, ?, ?, ?)`,
          [endpointData.name, endpointData.icon, endpointData.login_type, endpointData.group_name || '']
        )
        const endpointId = endpointResult.lastInsertRowid as number

        // 创建步骤页和操作槽
        for (const pageData of endpointData.pages) {
          const pageResult = db.run(
            `INSERT INTO page (endpoint_id, order_index, url, ssh_port) VALUES (?, ?, ?, ?)`,
            [endpointId, pageData.order_index, pageData.url, pageData.ssh_port]
          )
          const pageId = pageResult.lastInsertRowid as number

          for (const slotData of pageData.slots) {
            db.run(
              `INSERT INTO slot (page_id, order_index, name, element_xpath, action_type, value, is_encrypted, timeout, output_key) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [pageId, slotData.order_index, slotData.name || '', slotData.element_xpath, slotData.action_type, slotData.value, slotData.is_encrypted ? 1 : 0, slotData.timeout, slotData.output_key || '']
            )
          }
        }
      })
      success++
    } catch (error) {
      console.error('Failed to import endpoint:', error)
      failed++
    }
  }

  return { success, failed }
}
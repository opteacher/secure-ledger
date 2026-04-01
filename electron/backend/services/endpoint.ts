import { db } from '../database/init'
import type { Endpoint, Page, Slot } from '../database/init'
import { listSlots } from './slot'

// 完整的登录端数据 (包含步骤和操作)
export interface EndpointFull extends Endpoint {
  pages: (Page & { slots: Slot[] })[]
}

// 获取所有登录端
export function listEndpoints(): Endpoint[] {
  return db.query<Endpoint>('SELECT * FROM endpoint ORDER BY created_at DESC')
}

// 获取单个登录端
export function getEndpoint(id: number): EndpointFull | null {
  const endpoint = db.queryOne<Endpoint>('SELECT * FROM endpoint WHERE id = ?', [id])
  if (!endpoint) return null

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
}): Endpoint {
  const result = db.run(
    `INSERT INTO endpoint (name, icon, login_type) VALUES (?, ?, ?)`,
    [data.name, data.icon || '', data.login_type]
  )

  return {
    id: result.lastInsertRowid as number,
    name: data.name,
    icon: data.icon || '',
    login_type: data.login_type,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
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

  if (fields.length === 0) return false

  fields.push('updated_at = CURRENT_TIMESTAMP')
  values.push(id)

  db.run(`UPDATE endpoint SET ${fields.join(', ')} WHERE id = ?`, values)
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
  
  return result.changes > 0
}

// 导出登录端
export function exportEndpoints(ids: number[]): EndpointFull[] {
  return ids.map(id => getEndpoint(id)).filter((e): e is EndpointFull => e !== null)
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
          `INSERT INTO endpoint (name, icon, login_type) VALUES (?, ?, ?)`,
          [endpointData.name, endpointData.icon, endpointData.login_type]
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
              `INSERT INTO slot (page_id, order_index, name, element_xpath, action_type, value, is_encrypted, timeout) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
              [pageId, slotData.order_index, slotData.name || '', slotData.element_xpath, slotData.action_type, slotData.value, slotData.is_encrypted ? 1 : 0, slotData.timeout]
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
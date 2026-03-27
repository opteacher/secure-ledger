import { db } from '../database/init'
import type { Page, Slot } from '../database/init'

// 获取登录端的所有步骤页
export function listPages(endpointId: number): Page[] {
  return db.query<Page>(
    'SELECT * FROM page WHERE endpoint_id = ? ORDER BY order_index',
    [endpointId]
  )
}

// 获取单个步骤页
export function getPage(id: number): (Page & { slots: Slot[] }) | null {
  const page = db.queryOne<Page>('SELECT * FROM page WHERE id = ?', [id])
  if (!page) return null

  const slots = db.query<Slot>(
    'SELECT * FROM slot WHERE page_id = ? ORDER BY order_index',
    [id]
  )

  return { ...page, slots }
}

// 创建步骤页
export function createPage(data: {
  endpoint_id: number
  order_index?: number
  url: string
  ssh_port?: number
}): Page {
  // 如果没有指定顺序，放到最后
  if (data.order_index === undefined) {
    const maxOrder = db.queryOne<{ max: number }>(
      'SELECT COALESCE(MAX(order_index), -1) as max FROM page WHERE endpoint_id = ?',
      [data.endpoint_id]
    )
    data.order_index = (maxOrder?.max ?? -1) + 1
  }

  const result = db.run(
    `INSERT INTO page (endpoint_id, order_index, url, ssh_port) VALUES (?, ?, ?, ?)`,
    [data.endpoint_id, data.order_index, data.url, data.ssh_port || null]
  )

  return {
    id: result.lastInsertRowid as number,
    endpoint_id: data.endpoint_id,
    order_index: data.order_index,
    url: data.url,
    ssh_port: data.ssh_port,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
}

// 更新步骤页
export function updatePage(id: number, updates: Partial<Page>): boolean {
  const fields: string[] = []
  const values: any[] = []

  if (updates.order_index !== undefined) {
    fields.push('order_index = ?')
    values.push(updates.order_index)
  }
  if (updates.url !== undefined) {
    fields.push('url = ?')
    values.push(updates.url)
  }
  if (updates.ssh_port !== undefined) {
    fields.push('ssh_port = ?')
    values.push(updates.ssh_port)
  }

  if (fields.length === 0) return false

  fields.push('updated_at = CURRENT_TIMESTAMP')
  values.push(id)

  db.run(`UPDATE page SET ${fields.join(', ')} WHERE id = ?`, values)
  return true
}

// 删除步骤页
export function deletePage(id: number): boolean {
  // 删除关联的操作槽
  db.run('DELETE FROM slot WHERE page_id = ?', [id])
  
  // 删除步骤页
  const result = db.run('DELETE FROM page WHERE id = ?', [id])
  
  return result.changes > 0
}

// 调整步骤页顺序
export function reorderPages(endpointId: number, pageIds: number[]): boolean {
  return db.transaction(() => {
    pageIds.forEach((pageId, index) => {
      db.run(
        'UPDATE page SET order_index = ? WHERE id = ? AND endpoint_id = ?',
        [index, pageId, endpointId]
      )
    })
    return true
  })()
}
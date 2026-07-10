/**
 * Shared mock factories for backend tests
 */
import { vi } from 'vitest'

/**
 * Creates a mock database object matching the db API shape
 */
export function createMockDb() {
  return {
    query: vi.fn(),
    queryOne: vi.fn(),
    run: vi.fn(() => ({ changes: 1, lastInsertRowid: 1 })),
    exec: vi.fn(),
    transaction: vi.fn((fn: () => unknown) => fn()),
  }
}

/**
 * Mock module path helper - resolves correct path from test location to source
 * Tests are in tests/unit/backend/{crypto,database,services,utils,ipc}/
 * Source is in electron/backend/
 */
export function srcPath(modulePath: string): string {
  // Strip leading ../ to get clean path
  let p = modulePath
  while (p.startsWith('../')) p = p.substring(3)
  return p
}

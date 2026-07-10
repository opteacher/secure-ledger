import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useEndpointStore } from '@/stores/endpoint'
import type { Endpoint, EndpointFull } from '@/apis'

// ── Mock helpers ──────────────────────────────────────────────

function makeEndpoint(overrides: Partial<Endpoint> = {}): Endpoint {
  return {
    id: 1,
    name: 'Test Endpoint',
    icon: 'globe',
    login_type: 'web',
    share_token: '',
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
    ...overrides,
  }
}

function makeEndpointFull(overrides: Partial<EndpointFull> = {}): EndpointFull {
  return {
    ...makeEndpoint(overrides),
    pages: [],
    ...overrides,
  } as EndpointFull
}

// ── Global mock for window.ipc.invoke ─────────────────────────

const mockInvoke = vi.fn()

let store: ReturnType<typeof useEndpointStore>

beforeEach(() => {
  vi.clearAllMocks()
  setActivePinia(createPinia())
  ;(window as any).ipc = { invoke: mockInvoke, on: vi.fn(), send: vi.fn() }
  store = useEndpointStore()
})

// ── Tests ─────────────────────────────────────────────────────

describe('useEndpointStore', () => {
  // ── Initial state ──────────────────────────────────────────

  it('initializes with correct default state', () => {
    expect(store.endpoints).toEqual([])
    expect(store.currentEndpoint).toBeNull()
    expect(store.loading).toBe(false)
    expect(store.error).toBeNull()
    expect(store.endpointCount).toBe(0)
  })

  // ── loadEndpoints ──────────────────────────────────────────

  describe('loadEndpoints', () => {
    it('sets loading to true during invocation', async () => {
      mockInvoke.mockResolvedValue([])
      const promise = store.loadEndpoints()
      expect(store.loading).toBe(true)
      await promise
    })

    it('populates endpoints on success and sets loading false', async () => {
      const list = [makeEndpoint({ id: 1 }), makeEndpoint({ id: 2, name: 'Second' })]
      mockInvoke.mockResolvedValue(list)

      await store.loadEndpoints()

      expect(store.endpoints).toEqual(list)
      expect(store.endpointCount).toBe(2)
      expect(store.loading).toBe(false)
      expect(store.error).toBeNull()
      expect(mockInvoke).toHaveBeenCalledWith('endpoint:list')
    })

    it('handles empty array response', async () => {
      mockInvoke.mockResolvedValue([])

      await store.loadEndpoints()

      expect(store.endpoints).toEqual([])
      expect(store.endpointCount).toBe(0)
      expect(store.loading).toBe(false)
    })

    it('sets error and keeps endpoints empty on failure', async () => {
      mockInvoke.mockRejectedValue(new Error('Network failure'))

      await store.loadEndpoints()

      expect(store.error).toBe('Network failure')
      expect(store.endpoints).toEqual([])
      expect(store.loading).toBe(false)
    })
  })

  // ── loadEndpoint ───────────────────────────────────────────

  describe('loadEndpoint', () => {
    it('sets currentEndpoint on success and returns it', async () => {
      const ep = makeEndpointFull({ id: 5 })
      mockInvoke.mockResolvedValue(ep)

      const result = await store.loadEndpoint(5)

      expect(result).toEqual(ep)
      expect(store.currentEndpoint).toEqual(ep)
      expect(store.loading).toBe(false)
      expect(mockInvoke).toHaveBeenCalledWith('endpoint:get', 5)
    })

    it('overwrites currentEndpoint with null when backend returns null', async () => {
      store.currentEndpoint = makeEndpointFull({ id: 1 })
      mockInvoke.mockResolvedValue(null)

      const result = await store.loadEndpoint(99)

      expect(result).toBeNull()
      expect(store.currentEndpoint).toBeNull() // store assigns null from API response
      expect(store.loading).toBe(false)
    })

    it('sets error and returns null on failure', async () => {
      mockInvoke.mockRejectedValue(new Error('Not found'))

      const result = await store.loadEndpoint(404)

      expect(result).toBeNull()
      expect(store.error).toBe('Not found')
      expect(store.loading).toBe(false)
    })

    it('sets loading true during invocation', async () => {
      mockInvoke.mockResolvedValue(makeEndpointFull({ id: 1 }))
      const promise = store.loadEndpoint(1)
      expect(store.loading).toBe(true)
      await promise
    })
  })

  // ── createEndpoint ─────────────────────────────────────────

  describe('createEndpoint', () => {
    it('prepends created endpoint to array and returns it', async () => {
      store.endpoints = [makeEndpoint({ id: 1, name: 'Old' })]
      const created = makeEndpoint({ id: 2, name: 'New' })
      mockInvoke.mockResolvedValue(created)

      const result = await store.createEndpoint({ name: 'New', login_type: 'web' })

      expect(result).toEqual(created)
      expect(store.endpoints).toHaveLength(2)
      expect(store.endpoints[0]).toEqual(created) // prepended
      expect(store.endpointCount).toBe(2)
      expect(store.loading).toBe(false)
      expect(mockInvoke).toHaveBeenCalledWith('endpoint:create', {
        name: 'New',
        login_type: 'web',
      })
    })

    it('sets error and returns null on failure', async () => {
      mockInvoke.mockRejectedValue(new Error('Validation error'))

      const result = await store.createEndpoint({ name: 'Bad' })

      expect(result).toBeNull()
      expect(store.error).toBe('Validation error')
      expect(store.endpoints).toEqual([])
      expect(store.loading).toBe(false)
    })

    it('sets loading true during invocation', async () => {
      mockInvoke.mockResolvedValue(makeEndpoint({ id: 1 }))
      const promise = store.createEndpoint({ name: 'Test' })
      expect(store.loading).toBe(true)
      await promise
    })
  })

  // ── updateEndpoint ─────────────────────────────────────────

  describe('updateEndpoint', () => {
    it('updates matching endpoint in array and returns true', async () => {
      store.endpoints = [makeEndpoint({ id: 1, name: 'Old' }), makeEndpoint({ id: 2, name: 'Other' })]
      mockInvoke.mockResolvedValue(true)

      const result = await store.updateEndpoint(1, { name: 'Updated' })

      expect(result).toBe(true)
      expect(store.endpoints[0].name).toBe('Updated')
      expect(store.endpoints[1].name).toBe('Other') // unchanged
      expect(store.loading).toBe(false)
      expect(mockInvoke).toHaveBeenCalledWith('endpoint:update', {
        id: 1,
        updates: { name: 'Updated' },
      })
    })

    it('updates currentEndpoint when it matches the updated id', async () => {
      store.endpoints = [makeEndpoint({ id: 1, name: 'Old' })]
      store.currentEndpoint = makeEndpointFull({ id: 1, name: 'Old' })
      mockInvoke.mockResolvedValue(true)

      await store.updateEndpoint(1, { name: 'Renamed' })

      expect(store.currentEndpoint!.name).toBe('Renamed')
      expect(store.currentEndpoint!.id).toBe(1)
    })

    it('does NOT update currentEndpoint when id does not match', async () => {
      store.endpoints = [makeEndpoint({ id: 1, name: 'Old' })]
      store.currentEndpoint = makeEndpointFull({ id: 2, name: 'Other' })
      mockInvoke.mockResolvedValue(true)

      await store.updateEndpoint(1, { name: 'Updated' })

      expect(store.currentEndpoint!.name).toBe('Other') // unchanged
    })

    it('returns true but does not mutate when endpoint not in local array', async () => {
      store.endpoints = [makeEndpoint({ id: 1 })]
      mockInvoke.mockResolvedValue(true)

      const result = await store.updateEndpoint(999, { name: 'Ghost' })

      expect(result).toBe(true)
      expect(store.endpoints).toHaveLength(1)
      expect(store.endpoints[0].name).toBe('Test Endpoint')
    })

    it('returns false when backend update fails', async () => {
      store.endpoints = [makeEndpoint({ id: 1, name: 'Old' })]
      mockInvoke.mockResolvedValue(false)

      const result = await store.updateEndpoint(1, { name: 'Should Fail' })

      expect(result).toBe(false)
      expect(store.endpoints[0].name).toBe('Old') // unchanged
    })

    it('returns false and sets error on thrown exception', async () => {
      mockInvoke.mockRejectedValue(new Error('Permission denied'))

      const result = await store.updateEndpoint(1, { name: 'X' })

      expect(result).toBe(false)
      expect(store.error).toBe('Permission denied')
      expect(store.loading).toBe(false)
    })
  })

  // ── deleteEndpoint ─────────────────────────────────────────

  describe('deleteEndpoint', () => {
    it('removes endpoint from array and returns true', async () => {
      store.endpoints = [makeEndpoint({ id: 1 }), makeEndpoint({ id: 2 })]
      mockInvoke.mockResolvedValue(true)

      const result = await store.deleteEndpoint(1)

      expect(result).toBe(true)
      expect(store.endpoints).toHaveLength(1)
      expect(store.endpoints[0].id).toBe(2)
      expect(store.endpointCount).toBe(1)
      expect(store.loading).toBe(false)
      expect(mockInvoke).toHaveBeenCalledWith('endpoint:delete', 1)
    })

    it('clears currentEndpoint when it matches the deleted id', async () => {
      store.currentEndpoint = makeEndpointFull({ id: 1 })
      store.endpoints = [makeEndpoint({ id: 1 })]
      mockInvoke.mockResolvedValue(true)

      await store.deleteEndpoint(1)

      expect(store.currentEndpoint).toBeNull()
    })

    it('does NOT clear currentEndpoint when id does not match', async () => {
      store.currentEndpoint = makeEndpointFull({ id: 2 })
      store.endpoints = [makeEndpoint({ id: 1 })]
      mockInvoke.mockResolvedValue(true)

      await store.deleteEndpoint(1)

      expect(store.currentEndpoint).not.toBeNull()
      expect(store.currentEndpoint!.id).toBe(2)
    })

    it('returns false with no mutation when backend returns false', async () => {
      store.endpoints = [makeEndpoint({ id: 1 })]
      mockInvoke.mockResolvedValue(false)

      const result = await store.deleteEndpoint(1)

      expect(result).toBe(false)
      expect(store.endpoints).toHaveLength(1)
    })

    it('returns false and sets error on thrown exception', async () => {
      mockInvoke.mockRejectedValue(new Error('Database error'))

      const result = await store.deleteEndpoint(1)

      expect(result).toBe(false)
      expect(store.error).toBe('Database error')
      expect(store.loading).toBe(false)
    })

    it('sets loading true during invocation', async () => {
      mockInvoke.mockResolvedValue(true)
      const promise = store.deleteEndpoint(1)
      expect(store.loading).toBe(true)
      await promise
    })
  })

  // ── exportEndpoints ────────────────────────────────────────

  describe('exportEndpoints', () => {
    let createObjectURLSpy: ReturnType<typeof vi.spyOn>
    let revokeObjectURLSpy: ReturnType<typeof vi.spyOn>

    beforeEach(() => {
      createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test-url')
      revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL')
    })

    afterEach(() => {
      createObjectURLSpy.mockRestore()
      revokeObjectURLSpy.mockRestore()
    })

    it('exports data, creates blob, and triggers download', async () => {
      const exportData = [makeEndpointFull({ id: 1 }), makeEndpointFull({ id: 2 })]
      mockInvoke.mockResolvedValue(exportData)

      const result = await store.exportEndpoints([1, 2])

      expect(result).toBe(true)
      expect(mockInvoke).toHaveBeenCalledWith('endpoint:export', [1, 2])
      expect(createObjectURLSpy).toHaveBeenCalledOnce()
      const blobArg = createObjectURLSpy.mock.calls[0][0] as Blob
      expect(blobArg).toBeInstanceOf(Blob)
      expect(blobArg.type).toBe('application/json')
      expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:test-url')
      expect(store.loading).toBe(false)
    })

    it('returns false and sets error on failure', async () => {
      mockInvoke.mockRejectedValue(new Error('Export failed'))

      const result = await store.exportEndpoints([1])

      expect(result).toBe(false)
      expect(store.error).toBe('Export failed')
      expect(store.loading).toBe(false)
      expect(createObjectURLSpy).not.toHaveBeenCalled()
    })

    it('sets loading true during invocation', async () => {
      mockInvoke.mockResolvedValue([])
      const promise = store.exportEndpoints([1])
      expect(store.loading).toBe(true)
      await promise
    })
  })

  // ── importEndpoints ────────────────────────────────────────

  describe('importEndpoints', () => {
    it('calls loadEndpoints after successful import with successes > 0', async () => {
      const importData: EndpointFull[] = [makeEndpointFull({ id: 1 }), makeEndpointFull({ id: 2 })]
      const importResult = { success: 2, failed: 0 }
      const refreshedList = [makeEndpoint({ id: 1 }), makeEndpoint({ id: 2 }), makeEndpoint({ id: 3 })]

      mockInvoke
        .mockResolvedValueOnce(importResult) // endpoint:import
        .mockResolvedValueOnce(refreshedList) // endpoint:list (via loadEndpoints)

      const result = await store.importEndpoints(importData)

      expect(result).toEqual(importResult)
      expect(mockInvoke).toHaveBeenNthCalledWith(1, 'endpoint:import', importData)
      expect(mockInvoke).toHaveBeenNthCalledWith(2, 'endpoint:list')
      expect(store.endpoints).toEqual(refreshedList)
      expect(store.endpointCount).toBe(3)
      expect(store.loading).toBe(false)
    })

    it('does NOT call loadEndpoints when all imports failed (success = 0)', async () => {
      const importData: EndpointFull[] = [makeEndpointFull({ id: 1 })]
      const importResult = { success: 0, failed: 1 }

      mockInvoke.mockResolvedValue(importResult)

      const result = await store.importEndpoints(importData)

      expect(result).toEqual(importResult)
      expect(mockInvoke).toHaveBeenCalledTimes(1) // only the import call
      expect(mockInvoke).toHaveBeenCalledWith('endpoint:import', importData)
      expect(store.loading).toBe(false)
    })

    it('returns {success:0, failed:data.length} on thrown exception', async () => {
      const importData: EndpointFull[] = [makeEndpointFull({ id: 1 }), makeEndpointFull({ id: 2 })]
      mockInvoke.mockRejectedValue(new Error('Import error'))

      const result = await store.importEndpoints(importData)

      expect(result).toEqual({ success: 0, failed: 2 })
      expect(store.error).toBe('Import error')
      expect(store.loading).toBe(false)
    })

    it('sets loading true during invocation', async () => {
      mockInvoke.mockResolvedValue({ success: 1, failed: 0 })
      // Also mock the list call from loadEndpoints
      mockInvoke.mockResolvedValue([])
      const promise = store.importEndpoints([makeEndpointFull({ id: 1 })])
      expect(store.loading).toBe(true)
      await promise
    })
  })

  // ── Computed: endpointCount ────────────────────────────────

  describe('endpointCount', () => {
    it('returns 0 for empty array', () => {
      expect(store.endpointCount).toBe(0)
    })

    it('updates when endpoints change via mutation', () => {
      store.endpoints = [makeEndpoint({ id: 1 }), makeEndpoint({ id: 2 }), makeEndpoint({ id: 3 })]
      expect(store.endpointCount).toBe(3)
    })

    it('decreases after deleteEndpoint succeeds', async () => {
      store.endpoints = [makeEndpoint({ id: 1 }), makeEndpoint({ id: 2 })]
      mockInvoke.mockResolvedValue(true)

      await store.deleteEndpoint(1)

      expect(store.endpointCount).toBe(1)
    })

    it('increases after createEndpoint succeeds', async () => {
      mockInvoke.mockResolvedValue(makeEndpoint({ id: 1 }))

      await store.createEndpoint({ name: 'New' })

      expect(store.endpointCount).toBe(1)
    })
  })

  // ── Edge cases ─────────────────────────────────────────────

  describe('edge cases', () => {
    it('clears previous error on subsequent successful loadEndpoints', async () => {
      mockInvoke.mockRejectedValueOnce(new Error('First fail'))
      await store.loadEndpoints()
      expect(store.error).toBe('First fail')

      mockInvoke.mockResolvedValue([makeEndpoint({ id: 1 })])
      await store.loadEndpoints()

      expect(store.error).toBeNull()
      expect(store.endpoints).toHaveLength(1)
    })

    it('clears previous error on subsequent successful loadEndpoint', async () => {
      mockInvoke.mockRejectedValueOnce(new Error('Previous'))
      await store.loadEndpoint(1)
      expect(store.error).toBe('Previous')

      mockInvoke.mockResolvedValue(makeEndpointFull({ id: 2 }))
      await store.loadEndpoint(2)

      expect(store.error).toBeNull()
      expect(store.currentEndpoint!.id).toBe(2)
    })

    it('handles rapid sequential actions without state leakage', async () => {
      // Load endpoints
      mockInvoke.mockResolvedValueOnce([makeEndpoint({ id: 1 })])
      await store.loadEndpoints()
      expect(store.endpoints).toHaveLength(1)

      // Create
      mockInvoke.mockResolvedValueOnce(makeEndpoint({ id: 2 }))
      await store.createEndpoint({ name: 'Second' })
      expect(store.endpoints).toHaveLength(2)

      // Update
      mockInvoke.mockResolvedValueOnce(true)
      await store.updateEndpoint(2, { name: 'Renamed' })
      expect(store.endpoints[0].name).toBe('Renamed')

      // Delete the first one
      mockInvoke.mockResolvedValueOnce(true)
      await store.deleteEndpoint(1)
      expect(store.endpoints).toHaveLength(1)
      expect(store.endpoints[0].id).toBe(2)

      // Loading stable
      expect(store.loading).toBe(false)
    })

    it('keeps state unchanged after failing delete then succeeding create', async () => {
      mockInvoke.mockRejectedValueOnce(new Error('Delete failed'))
      await store.deleteEndpoint(1)

      mockInvoke.mockResolvedValue(makeEndpoint({ id: 1, name: 'Created' }))
      await store.createEndpoint({ name: 'Created' })

      expect(store.endpoints).toHaveLength(1)
      expect(store.endpoints[0].name).toBe('Created')
      expect(store.error).toBeNull() // cleared by successful create
    })
  })
})

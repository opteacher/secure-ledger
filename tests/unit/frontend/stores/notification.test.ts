import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useNotificationStore } from '@/stores/notification'

let store: ReturnType<typeof useNotificationStore>

beforeEach(() => {
  vi.clearAllMocks()
  setActivePinia(createPinia())
  store = useNotificationStore()
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useNotificationStore', () => {
  // ── Initial state ──────────────────────────────────────────

  it('initializes with empty notifications array', () => {
    expect(store.notifications).toEqual([])
  })

  it('initializes confirmDialog with visible=false and resolve=null', () => {
    expect(store.confirmDialog.visible).toBe(false)
    expect(store.confirmDialog.resolve).toBeNull()
    expect(store.confirmDialog.title).toBe('')
    expect(store.confirmDialog.message).toBe('')
    expect(store.confirmDialog.confirmText).toBe('Confirm')
    expect(store.confirmDialog.cancelText).toBe('Cancel')
    expect(store.confirmDialog.type).toBe('info')
  })

  // ── addNotification ──────────────────────────────────────────

  describe('addNotification', () => {
    it('creates notification with unique non-empty id', () => {
      const id = store.addNotification('info', 'test message')

      expect(id).toBeTruthy()
      expect(typeof id).toBe('string')
      expect(id.length).toBeGreaterThan(0)
      expect(id).toMatch(/^notification-/)
    })

    it('adds notification to the array with correct properties', () => {
      store.addNotification('error', 'Error occurred', 'Detailed description', 5000)

      expect(store.notifications).toHaveLength(1)
      expect(store.notifications[0].type).toBe('error')
      expect(store.notifications[0].message).toBe('Error occurred')
      expect(store.notifications[0].description).toBe('Detailed description')
      expect(store.notifications[0].duration).toBe(5000)
      expect(store.notifications[0].createdAt).toBeGreaterThan(0)
    })

    it('uses default duration of 4500ms', () => {
      store.addNotification('info', 'test')

      expect(store.notifications[0].duration).toBe(4500)
    })

    it('returns id that matches the stored notification id', () => {
      const returnedId = store.addNotification('success', 'match test')

      expect(store.notifications[0].id).toBe(returnedId)
    })

    it('generates unique ids for consecutive calls', () => {
      const id1 = store.addNotification('info', 'first')
      const id2 = store.addNotification('info', 'second')

      expect(id1).not.toBe(id2)
    })

    it('removes notification after duration elapses', () => {
      store.addNotification('info', 'auto-remove test', undefined, 1000)
      expect(store.notifications).toHaveLength(1)

      vi.advanceTimersByTime(999)
      expect(store.notifications).toHaveLength(1)

      vi.advanceTimersByTime(1)
      expect(store.notifications).toHaveLength(0)
    })

    it('duration=0 skips auto-remove — notification persists', () => {
      store.addNotification('info', 'persistent', undefined, 0)

      vi.advanceTimersByTime(10000)
      expect(store.notifications).toHaveLength(1)
    })

    it('limits to maxNotifications (5) — shifts oldest when exceeding', () => {
      for (let i = 0; i < 7; i++) {
        store.addNotification('info', `message-${i}`)
      }

      expect(store.notifications).toHaveLength(5)
      expect(store.notifications[0].message).toBe('message-2')
      expect(store.notifications[1].message).toBe('message-3')
      expect(store.notifications[4].message).toBe('message-6')
    })

    it('keeps exactly 5 when continuously adding beyond limit', () => {
      const ids: string[] = []
      for (let i = 0; i < 10; i++) {
        ids.push(store.addNotification('info', `msg-${i}`))
      }

      expect(store.notifications).toHaveLength(5)
      // Oldest 5 (msg-0 to msg-4) should be gone
      expect(store.notifications[0].message).toBe('msg-5')
      expect(store.notifications[4].message).toBe('msg-9')
    })

    it('description defaults to undefined when not provided', () => {
      store.addNotification('warning', 'no description')

      expect(store.notifications[0].description).toBeUndefined()
    })
  })

  // ── removeNotification ──────────────────────────────────────

  describe('removeNotification', () => {
    it('removes matching notification from array', () => {
      const id = store.addNotification('info', 'removable')
      expect(store.notifications).toHaveLength(1)

      store.removeNotification(id)
      expect(store.notifications).toHaveLength(0)
    })

    it('removes only the matching notification among several', () => {
      const id1 = store.addNotification('info', 'keep')
      const id2 = store.addNotification('info', 'remove')
      const id3 = store.addNotification('info', 'also keep')

      store.removeNotification(id2)

      expect(store.notifications).toHaveLength(2)
      expect(store.notifications[0].id).toBe(id1)
      expect(store.notifications[1].id).toBe(id3)
    })

    it('non-existent id is noop — does not throw and does not mutate', () => {
      store.addNotification('info', 'only one')
      expect(store.notifications).toHaveLength(1)

      expect(() => store.removeNotification('nonexistent-id')).not.toThrow()
      expect(store.notifications).toHaveLength(1)
      expect(store.notifications[0].message).toBe('only one')
    })

    it('removes first match when somehow duplicates exist', () => {
      // Force duplicate id by directly pushing
      store.notifications.push({
        id: 'dup-id',
        type: 'info',
        message: 'first',
        createdAt: Date.now(),
      })
      store.notifications.push({
        id: 'dup-id',
        type: 'info',
        message: 'second',
        createdAt: Date.now(),
      })

      store.removeNotification('dup-id')

      expect(store.notifications).toHaveLength(1)
      expect(store.notifications[0].message).toBe('second')
    })
  })

  // ── clearAll ──────────────────────────────────────────────────

  describe('clearAll', () => {
    it('empties the notifications array', () => {
      store.addNotification('info', 'one')
      store.addNotification('info', 'two')
      store.addNotification('info', 'three')
      expect(store.notifications).toHaveLength(3)

      store.clearAll()

      expect(store.notifications).toEqual([])
      expect(store.notifications).toHaveLength(0)
    })

    it('does nothing on already empty array — no error', () => {
      expect(store.notifications).toHaveLength(0)

      expect(() => store.clearAll()).not.toThrow()
      expect(store.notifications).toEqual([])
    })
  })

  // ── Convenience methods ─────────────────────────────────────

  describe('success', () => {
    it('creates notification with type=success and default duration 4500', () => {
      const id = store.success('Operation completed', 'All good')

      expect(store.notifications).toHaveLength(1)
      expect(store.notifications[0].type).toBe('success')
      expect(store.notifications[0].message).toBe('Operation completed')
      expect(store.notifications[0].description).toBe('All good')
      expect(store.notifications[0].duration).toBe(4500)
      expect(store.notifications[0].id).toBe(id)
    })
  })

  describe('error', () => {
    it('creates notification with type=error and duration 6000', () => {
      const id = store.error('Something went wrong')

      expect(store.notifications).toHaveLength(1)
      expect(store.notifications[0].type).toBe('error')
      expect(store.notifications[0].message).toBe('Something went wrong')
      expect(store.notifications[0].duration).toBe(6000)
      expect(store.notifications[0].id).toBe(id)
    })
  })

  describe('warning', () => {
    it('creates notification with type=warning and duration 5000', () => {
      const id = store.warning('Heads up')

      expect(store.notifications).toHaveLength(1)
      expect(store.notifications[0].type).toBe('warning')
      expect(store.notifications[0].message).toBe('Heads up')
      expect(store.notifications[0].duration).toBe(5000)
      expect(store.notifications[0].id).toBe(id)
    })
  })

  describe('info', () => {
    it('creates notification with type=info and default duration 4500', () => {
      const id = store.info('FYI')

      expect(store.notifications).toHaveLength(1)
      expect(store.notifications[0].type).toBe('info')
      expect(store.notifications[0].message).toBe('FYI')
      expect(store.notifications[0].duration).toBe(4500)
      expect(store.notifications[0].id).toBe(id)
    })
  })

  // ── showConfirm ──────────────────────────────────────────────

  describe('showConfirm', () => {
    it('returns a Promise<boolean>', () => {
      const result = store.showConfirm('Are you sure?')

      expect(result).toBeInstanceOf(Promise)
    })

    it('sets confirmDialog visible=true with the message', () => {
      store.showConfirm('Delete this item?')

      expect(store.confirmDialog.visible).toBe(true)
      expect(store.confirmDialog.message).toBe('Delete this item?')
      expect(store.confirmDialog.resolve).not.toBeNull()
    })

    it('applies default options when none provided', () => {
      store.showConfirm('Default dialog')

      expect(store.confirmDialog.title).toBe('Confirm')
      expect(store.confirmDialog.confirmText).toBe('Confirm')
      expect(store.confirmDialog.cancelText).toBe('Cancel')
      expect(store.confirmDialog.type).toBe('info')
    })

    it('applies custom options for title, buttons, and type', () => {
      store.showConfirm('Custom question', {
        title: 'Warning!',
        confirmText: 'Proceed',
        cancelText: 'Abort',
        type: 'danger',
      })

      expect(store.confirmDialog.title).toBe('Warning!')
      expect(store.confirmDialog.confirmText).toBe('Proceed')
      expect(store.confirmDialog.cancelText).toBe('Abort')
      expect(store.confirmDialog.type).toBe('danger')
    })

    it('applies partial custom options with remaining defaults', () => {
      store.showConfirm('Partial custom', {
        title: 'Custom Title',
      })

      expect(store.confirmDialog.title).toBe('Custom Title')
      expect(store.confirmDialog.confirmText).toBe('Confirm')
      expect(store.confirmDialog.cancelText).toBe('Cancel')
      expect(store.confirmDialog.type).toBe('info')
    })

    it('called twice — second overwrites first, first promise never resolves', async () => {
      let firstResolved = false
      let firstValue: boolean | null = null

      const promise1 = store.showConfirm('First question')
      promise1.then((v) => {
        firstResolved = true
        firstValue = v
      })

      const promise2 = store.showConfirm('Second question')

      store.handleConfirm()
      const result2 = await promise2
      expect(result2).toBe(true)

      // First promise should still be pending — never resolved
      expect(firstResolved).toBe(false)
      expect(firstValue).toBeNull()
    })
  })

  // ── handleConfirm ────────────────────────────────────────────

  describe('handleConfirm', () => {
    it('resolves the confirm promise with true', async () => {
      const promise = store.showConfirm('Proceed?')

      store.handleConfirm()

      await expect(promise).resolves.toBe(true)
    })

    it('sets visible to false and resolve to null after confirming', async () => {
      const promise = store.showConfirm('Test')

      store.handleConfirm()
      await promise

      expect(store.confirmDialog.visible).toBe(false)
      expect(store.confirmDialog.resolve).toBeNull()
    })

    it('does not throw when called with no active dialog', () => {
      expect(() => store.handleConfirm()).not.toThrow()
      expect(store.confirmDialog.visible).toBe(false)
    })

    it('closes dialog even after multiple handleConfirm calls', async () => {
      const promise = store.showConfirm('Multi confirm')

      store.handleConfirm()
      await promise

      // Second call on already-closed dialog should be safe
      expect(() => store.handleConfirm()).not.toThrow()
      expect(store.confirmDialog.visible).toBe(false)
    })
  })

  // ── handleCancel ────────────────────────────────────────────

  describe('handleCancel', () => {
    it('resolves the confirm promise with false', async () => {
      const promise = store.showConfirm('Cancel?')

      store.handleCancel()

      await expect(promise).resolves.toBe(false)
    })

    it('sets visible to false and resolve to null after cancelling', async () => {
      const promise = store.showConfirm('Test')

      store.handleCancel()
      await promise

      expect(store.confirmDialog.visible).toBe(false)
      expect(store.confirmDialog.resolve).toBeNull()
    })

    it('does not throw when called with no active dialog', () => {
      expect(() => store.handleCancel()).not.toThrow()
      expect(store.confirmDialog.visible).toBe(false)
    })

    it('closes dialog even after multiple handleCancel calls', async () => {
      const promise = store.showConfirm('Multi cancel')

      store.handleCancel()
      await promise

      expect(() => store.handleCancel()).not.toThrow()
      expect(store.confirmDialog.visible).toBe(false)
    })
  })
})

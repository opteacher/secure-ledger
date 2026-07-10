import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { nextTick } from 'vue'
import NotificationToast from '@/components/NotificationToast.vue'
import { useNotificationStore } from '@/stores/notification'

beforeEach(() => {
  document.body.innerHTML = ''
  setActivePinia(createPinia())
  ;(window as any).ipc = { invoke: vi.fn(), on: vi.fn(), send: vi.fn() }
})

describe('NotificationToast', () => {
  function getStore() {
    const store = useNotificationStore()
    store.clearAll()
    return store
  }

  it('renders nothing when notifications array is empty', () => {
    const store = getStore()
    expect(store.notifications).toHaveLength(0)

    mount(NotificationToast)

    expect(document.querySelector('.notification-item')).toBeNull()
  })

  it('renders a toast when a notification is added', async () => {
    const store = getStore()
    store.addNotification('success', 'Operation completed')

    mount(NotificationToast)
    await nextTick()

    const items = document.querySelectorAll('.notification-item')
    expect(items).toHaveLength(1)
    expect(items[0].querySelector('.notification-message')?.textContent).toBe(
      'Operation completed',
    )
  })

  it('toast contains the message text', () => {
    const store = getStore()
    store.addNotification('error', 'Something went wrong')

    mount(NotificationToast)

    const message = document.querySelector('.notification-message')
    expect(message).not.toBeNull()
    expect(message?.textContent).toBe('Something went wrong')
  })

  it('toast shows description when provided', () => {
    const store = getStore()
    store.addNotification('info', 'Update available', 'Version 2.0.0 is ready')

    mount(NotificationToast)

    const description = document.querySelector('.notification-description')
    expect(description).not.toBeNull()
    expect(description?.textContent).toBe('Version 2.0.0 is ready')
  })

  it('toast does not show description when not provided', () => {
    const store = getStore()
    store.addNotification('info', 'Simple message')

    mount(NotificationToast)

    const description = document.querySelector('.notification-description')
    expect(description).toBeNull()
  })

  it('clicking close button removes the notification', async () => {
    const store = getStore()
    store.addNotification('success', 'Closable message', undefined, 0)

    mount(NotificationToast)

    expect(store.notifications).toHaveLength(1)

    const closeBtn = document.querySelector('.notification-close') as HTMLElement
    closeBtn.click()
    await nextTick()

    expect(store.notifications).toHaveLength(0)
  })

  it('renders multiple toasts when multiple notifications exist', () => {
    const store = getStore()
    store.addNotification('success', 'First')
    store.addNotification('error', 'Second')
    store.addNotification('warning', 'Third')

    mount(NotificationToast)

    const items = document.querySelectorAll('.notification-item')
    expect(items).toHaveLength(3)

    const messages = Array.from(items).map(
      (item) => item.querySelector('.notification-message')?.textContent,
    )
    expect(messages).toEqual(['First', 'Second', 'Third'])
  })

  it('caps notifications at max 5 (oldest removed)', () => {
    const store = getStore()
    for (let i = 0; i < 7; i++) {
      store.addNotification('info', `Message ${i + 1}`)
    }

    mount(NotificationToast)

    const items = document.querySelectorAll('.notification-item')
    expect(items).toHaveLength(5)

    const messages = Array.from(items).map(
      (item) => item.querySelector('.notification-message')?.textContent,
    )
    expect(messages).toEqual(['Message 3', 'Message 4', 'Message 5', 'Message 6', 'Message 7'])
  })

  it('renders success notification with success class', () => {
    const store = getStore()
    store.addNotification('success', 'Done')

    mount(NotificationToast)

    expect(document.querySelector('.notification-success')).not.toBeNull()
  })

  it('renders error notification with error class', () => {
    const store = getStore()
    store.addNotification('error', 'Failed')

    mount(NotificationToast)

    expect(document.querySelector('.notification-error')).not.toBeNull()
  })

  it('renders warning notification with warning class', () => {
    const store = getStore()
    store.addNotification('warning', 'Caution')

    mount(NotificationToast)

    expect(document.querySelector('.notification-warning')).not.toBeNull()
  })

  it('renders info notification with info class', () => {
    const store = getStore()
    store.addNotification('info', 'Note')

    mount(NotificationToast)

    expect(document.querySelector('.notification-info')).not.toBeNull()
  })
})

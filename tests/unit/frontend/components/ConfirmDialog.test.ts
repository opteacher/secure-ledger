import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { nextTick } from 'vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import { useNotificationStore } from '@/stores/notification'

beforeEach(() => {
  document.body.innerHTML = ''
  setActivePinia(createPinia())
  ;(window as any).ipc = { invoke: vi.fn(), on: vi.fn(), send: vi.fn() }
})

describe('ConfirmDialog', () => {
  function getStore() {
    const store = useNotificationStore()
    // Reset dialog state to hidden
    Object.assign(store.confirmDialog, {
      visible: false,
      title: '',
      message: '',
      confirmText: 'Confirm',
      cancelText: 'Cancel',
      type: 'info' as const,
      resolve: null,
    })
    return store
  }

  it('is hidden by default when visible is false', () => {
    const store = getStore()

    mount(ConfirmDialog)

    expect(document.querySelector('.confirm-overlay')).toBeNull()
  })

  it('becomes visible when confirmDialog.visible is true', () => {
    const store = getStore()
    Object.assign(store.confirmDialog, {
      visible: true,
      title: 'Test Title',
      message: 'Test message',
      confirmText: 'Yes',
      cancelText: 'No',
      type: 'info' as const,
      resolve: null,
    })

    mount(ConfirmDialog)

    const overlay = document.querySelector('.confirm-overlay')
    expect(overlay).not.toBeNull()
    expect(document.querySelector('.confirm-title')?.textContent).toBe('Test Title')
    expect(document.querySelector('.confirm-message')?.textContent).toBe('Test message')
  })

  it('confirm button resolves true', async () => {
    let resolvedValue: boolean | null = null
    const store = getStore()
    Object.assign(store.confirmDialog, {
      visible: true,
      title: 'Confirm',
      message: 'Are you sure?',
      confirmText: 'Yes',
      cancelText: 'No',
      type: 'info' as const,
      resolve: (val: boolean) => {
        resolvedValue = val
      },
    })

    mount(ConfirmDialog)

    const confirmBtn = document.querySelector('.confirm-btn-confirm') as HTMLElement
    confirmBtn.click()
    await nextTick()

    expect(resolvedValue).toBe(true)
    expect(store.confirmDialog.visible).toBe(false)
  })

  it('cancel button resolves false', async () => {
    let resolvedValue: boolean | null = null
    const store = getStore()
    Object.assign(store.confirmDialog, {
      visible: true,
      title: 'Confirm',
      message: 'Are you sure?',
      confirmText: 'Yes',
      cancelText: 'No',
      type: 'info' as const,
      resolve: (val: boolean) => {
        resolvedValue = val
      },
    })

    mount(ConfirmDialog)

    const cancelBtn = document.querySelector('.confirm-btn-cancel') as HTMLElement
    cancelBtn.click()
    await nextTick()

    expect(resolvedValue).toBe(false)
    expect(store.confirmDialog.visible).toBe(false)
  })

  it('renders custom title and message', () => {
    const store = getStore()
    Object.assign(store.confirmDialog, {
      visible: true,
      title: 'Delete Endpoint',
      message: 'This action cannot be undone.',
      confirmText: 'Delete',
      cancelText: 'Keep',
      type: 'danger' as const,
      resolve: null,
    })

    mount(ConfirmDialog)

    expect(document.querySelector('.confirm-title')?.textContent).toBe('Delete Endpoint')
    expect(document.querySelector('.confirm-message')?.textContent).toBe(
      'This action cannot be undone.',
    )
    expect(document.querySelector('.confirm-btn-confirm')?.textContent).toBe('Delete')
    expect(document.querySelector('.confirm-btn-cancel')?.textContent).toBe('Keep')
  })

  it('renders danger type with danger button class', () => {
    const store = getStore()
    Object.assign(store.confirmDialog, {
      visible: true,
      title: 'Danger',
      message: 'Dangerous action',
      confirmText: 'Confirm',
      cancelText: 'Cancel',
      type: 'danger' as const,
      resolve: null,
    })

    mount(ConfirmDialog)

    expect(document.querySelector('.confirm-btn-danger')).not.toBeNull()
    expect(document.querySelector('.confirm-icon-danger')).not.toBeNull()
  })

  it('renders warning type with warning button class', () => {
    const store = getStore()
    Object.assign(store.confirmDialog, {
      visible: true,
      title: 'Warning',
      message: 'Be careful',
      confirmText: 'Confirm',
      cancelText: 'Cancel',
      type: 'warning' as const,
      resolve: null,
    })

    mount(ConfirmDialog)

    expect(document.querySelector('.confirm-btn-warning')).not.toBeNull()
    expect(document.querySelector('.confirm-icon-warning')).not.toBeNull()
  })

  it('renders info type by default', () => {
    const store = getStore()
    Object.assign(store.confirmDialog, {
      visible: true,
      title: 'Info',
      message: 'For your information',
      confirmText: 'OK',
      cancelText: 'Cancel',
      type: 'info' as const,
      resolve: null,
    })

    mount(ConfirmDialog)

    expect(document.querySelector('.confirm-icon-info')).not.toBeNull()
  })

  it('backdrop click closes the dialog', async () => {
    let resolvedValue: boolean | null = null
    const store = getStore()
    Object.assign(store.confirmDialog, {
      visible: true,
      title: 'Test',
      message: 'Test message',
      confirmText: 'Confirm',
      cancelText: 'Cancel',
      type: 'info' as const,
      resolve: (val: boolean) => {
        resolvedValue = val
      },
    })

    mount(ConfirmDialog)

    const overlay = document.querySelector('.confirm-overlay') as HTMLElement
    overlay.click()
    await nextTick()

    expect(resolvedValue).toBe(false)
    expect(store.confirmDialog.visible).toBe(false)
  })

  it('showConfirm makes the dialog visible via store', () => {
    const store = getStore()

    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    store.showConfirm('Are you sure?', { title: 'Test', type: 'danger' })

    expect(store.confirmDialog.visible).toBe(true)
    expect(store.confirmDialog.title).toBe('Test')
    expect(store.confirmDialog.message).toBe('Are you sure?')
    expect(store.confirmDialog.type).toBe('danger')
  })
})

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import SlotCard from '@/components/SlotCard.vue'
import type { Slot } from '@/apis'

beforeEach(() => {
  setActivePinia(createPinia())
  ;(window as any).ipc = { invoke: vi.fn(), on: vi.fn(), send: vi.fn() }
})

function createMockSlot(overrides: Partial<Slot> = {}): Slot {
  return {
    id: 1,
    page_id: 10,
    order_index: 0,
    name: 'Username Input',
    element_xpath: '//input[@id="username"]',
    action_type: 'input',
    value: 'testuser',
    is_encrypted: false,
    timeout: 5000,
    created_at: '2024-01-01',
    updated_at: '2024-01-01',
    ...overrides,
  }
}

describe('SlotCard', () => {
  it('displays slot name in the name input', () => {
    const slot = createMockSlot({ name: 'Login Step' })
    const wrapper = mount(SlotCard, {
      props: { slot, index: 0, collapsed: false },
    })

    const nameInput = wrapper.find('input[placeholder="点击输入操作名称"]')
    expect((nameInput.element as HTMLInputElement).value).toBe('Login Step')
  })

  it('displays element_xpath in the xpath input', () => {
    const slot = createMockSlot({ element_xpath: '//input[@name="email"]' })
    const wrapper = mount(SlotCard, {
      props: { slot, index: 0, collapsed: false },
    })

    const xpathInput = wrapper.find('input[placeholder="//input[@id=\'username\']"]')
    expect((xpathInput.element as HTMLInputElement).value).toBe('//input[@name="email"]')
  })

  it('displays index + 1 as the step number', () => {
    const slot = createMockSlot()
    const wrapper = mount(SlotCard, {
      props: { slot, index: 2, collapsed: false },
    })

    expect(wrapper.find('span').text()).toBe('3')
  })

  it('shows password input type when is_encrypted is true', () => {
    const slot = createMockSlot({ is_encrypted: true, action_type: 'input' })
    const wrapper = mount(SlotCard, {
      props: { slot, index: 0, collapsed: false },
    })

    const valueInput = wrapper.find('input[placeholder="输入值"]')
    expect((valueInput.element as HTMLInputElement).type).toBe('password')
  })

  it('shows text input type when is_encrypted is false', () => {
    const slot = createMockSlot({ is_encrypted: false, action_type: 'input' })
    const wrapper = mount(SlotCard, {
      props: { slot, index: 0, collapsed: false },
    })

    const valueInput = wrapper.find('input[placeholder="输入值"]')
    expect((valueInput.element as HTMLInputElement).type).toBe('text')
  })

  it('value field is editable and emits update:value', async () => {
    const slot = createMockSlot({ action_type: 'input' })
    const wrapper = mount(SlotCard, {
      props: { slot, index: 0, collapsed: false },
    })

    const valueInput = wrapper.find('input[placeholder="输入值"]')
    await valueInput.setValue('newpassword')

    const emitted = wrapper.emitted('update:value')
    expect(emitted).toBeTruthy()
    expect(emitted![0]).toEqual(['newpassword'])
  })

  it('delete button emits delete event', async () => {
    const slot = createMockSlot()
    const wrapper = mount(SlotCard, {
      props: { slot, index: 0, collapsed: false },
    })

    // The delete button is the X button in the header
    const buttons = wrapper.findAll('button')
    const deleteButton = buttons[0] // First button in header is delete
    await deleteButton.trigger('click')

    expect(wrapper.emitted('delete')).toBeTruthy()
    expect(wrapper.emitted('delete')).toHaveLength(1)
  })

  it('timeout field displays correct value', () => {
    const slot = createMockSlot({ timeout: 3000 })
    const wrapper = mount(SlotCard, {
      props: { slot, index: 0, collapsed: false },
    })

    const timeoutInput = wrapper.find('input[type="number"]')
    expect(Number((timeoutInput.element as HTMLInputElement).value)).toBe(3000)
  })

  it('timeout field emits update:timeout as number on input', async () => {
    const slot = createMockSlot({ timeout: 2000 })
    const wrapper = mount(SlotCard, {
      props: { slot, index: 0, collapsed: false },
    })

    const timeoutInput = wrapper.find('input[type="number"]')
    await timeoutInput.setValue('500')

    const emitted = wrapper.emitted('update:timeout')
    expect(emitted).toBeTruthy()
    expect(emitted![0]).toEqual([500])
  })

  it('action_type selector renders with correct value', () => {
    const slot = createMockSlot({ action_type: 'click' })
    const wrapper = mount(SlotCard, {
      props: { slot, index: 0, collapsed: false },
    })

    const select = wrapper.find('select')
    expect((select.element as HTMLSelectElement).value).toBe('click')
  })

  it('action_type selector contains all options', () => {
    const slot = createMockSlot()
    const wrapper = mount(SlotCard, {
      props: { slot, index: 0, collapsed: false },
    })

    const options = wrapper.findAll('option')
    const values = options.map((opt) => (opt.element as HTMLOptionElement).value)
    expect(values).toEqual(['input', 'click', 'select', 'captcha'])
  })

  it('action_type selector has captcha option', () => {
    const slot = createMockSlot()
    const wrapper = mount(SlotCard, {
      props: { slot, index: 0, collapsed: false },
    })

    const options = wrapper.findAll('option')
    const captchaOption = options.find((opt) => (opt.element as HTMLOptionElement).value === 'captcha')
    expect(captchaOption).toBeDefined()
    expect((captchaOption!.element as HTMLOptionElement).value).toBe('captcha')
  })

  it('shows output_key input when action_type is captcha', () => {
    const slot = createMockSlot({ action_type: 'captcha', output_key: 'captcha_result' })
    const wrapper = mount(SlotCard, {
      props: { slot, index: 0, collapsed: false },
    })

    const outputKeyInput = wrapper.find('input[placeholder="captcha_result"]')
    expect(outputKeyInput.exists()).toBe(true)
    expect((outputKeyInput.element as HTMLInputElement).value).toBe('captcha_result')
  })

  it('hides output_key input when action_type is not captcha', () => {
    const slot = createMockSlot({ action_type: 'input' })
    const wrapper = mount(SlotCard, {
      props: { slot, index: 0, collapsed: false },
    })

    const outputKeyInput = wrapper.find('input[placeholder="captcha_result"]')
    expect(outputKeyInput.exists()).toBe(false)
  })

  it('output_key input emits update:output_key on input', async () => {
    const slot = createMockSlot({ action_type: 'captcha', output_key: 'old_key' })
    const wrapper = mount(SlotCard, {
      props: { slot, index: 0, collapsed: false },
    })

    const outputKeyInput = wrapper.find('input[placeholder="captcha_result"]')
    await outputKeyInput.setValue('new_key')

    const emitted = wrapper.emitted('update:output_key')
    expect(emitted).toBeTruthy()
    expect(emitted![0]).toEqual(['new_key'])
  })

  it('collapses content when collapsed is true', () => {
    const slot = createMockSlot()
    const wrapper = mount(SlotCard, {
      props: { slot, index: 0, collapsed: true },
    })

    // The content area has v-show="!collapsed", so it should be hidden
    const contentArea = wrapper.find('.px-4.pb-4')
    expect(contentArea.isVisible()).toBe(false)
  })

  it('shows content when collapsed is false', () => {
    const slot = createMockSlot()
    const wrapper = mount(SlotCard, {
      props: { slot, index: 0, collapsed: false },
    })

    const contentArea = wrapper.find('.px-4.pb-4')
    expect(contentArea.isVisible()).toBe(true)
  })

  it('emits toggle event when header is clicked', async () => {
    const slot = createMockSlot()
    const wrapper = mount(SlotCard, {
      props: { slot, index: 0, collapsed: false },
    })

    await wrapper.find('.cursor-pointer').trigger('click')

    expect(wrapper.emitted('toggle')).toBeTruthy()
    expect(wrapper.emitted('toggle')).toHaveLength(1)
  })

  it('does not show value field when action_type is not input', () => {
    const slot = createMockSlot({ action_type: 'click' })
    const wrapper = mount(SlotCard, {
      props: { slot, index: 0, collapsed: false },
    })

    expect(wrapper.find('input[placeholder="输入值"]').exists()).toBe(false)
  })

  it('shows value field when action_type is input', () => {
    const slot = createMockSlot({ action_type: 'input' })
    const wrapper = mount(SlotCard, {
      props: { slot, index: 0, collapsed: false },
    })

    expect(wrapper.find('input[placeholder="输入值"]').exists()).toBe(true)
  })

  it('encryption checkbox is checked when is_encrypted is true', () => {
    const slot = createMockSlot({ is_encrypted: true, action_type: 'input' })
    const wrapper = mount(SlotCard, {
      props: { slot, index: 0, collapsed: false },
    })

    const checkbox = wrapper.find('input[type="checkbox"]')
    expect((checkbox.element as HTMLInputElement).checked).toBe(true)
  })

  it('encryption checkbox emits update:is_encrypted on change', async () => {
    const slot = createMockSlot({ is_encrypted: false, action_type: 'input' })
    const wrapper = mount(SlotCard, {
      props: { slot, index: 0, collapsed: false },
    })

    const checkbox = wrapper.find('input[type="checkbox"]')
    await checkbox.setValue(true)

    const emitted = wrapper.emitted('update:is_encrypted')
    expect(emitted).toBeTruthy()
    expect(emitted![0]).toEqual([true])
  })

  it('updating name input emits update:name', async () => {
    const slot = createMockSlot()
    const wrapper = mount(SlotCard, {
      props: { slot, index: 0, collapsed: false },
    })

    const nameInput = wrapper.find('input[placeholder="点击输入操作名称"]')
    await nameInput.setValue('New Step Name')

    const emitted = wrapper.emitted('update:name')
    expect(emitted).toBeTruthy()
    expect(emitted![0]).toEqual(['New Step Name'])
  })
})

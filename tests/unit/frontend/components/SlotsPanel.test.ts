import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import SlotsPanel from '@/components/SlotsPanel.vue'
import type { Slot } from '@/apis'

beforeEach(() => {
  setActivePinia(createPinia())
  ;(window as any).ipc = { invoke: vi.fn(), on: vi.fn(), send: vi.fn() }
})

function createMockSlot(id: number, overrides: Partial<Slot> = {}): Slot {
  return {
    id,
    page_id: 10,
    order_index: id,
    name: `Step ${id}`,
    element_xpath: `//input[@id="field-${id}"]`,
    action_type: 'input',
    value: `value-${id}`,
    is_encrypted: false,
    timeout: 5000,
    created_at: '2024-01-01',
    updated_at: '2024-01-01',
    ...overrides,
  }
}

function createMockSlots(count: number): Slot[] {
  return Array.from({ length: count }, (_, i) => createMockSlot(i + 1))
}

describe('SlotsPanel', () => {
  it('renders slot cards for each slot in the array', () => {
    const slots = createMockSlots(3)
    const wrapper = mount(SlotsPanel, {
      props: { slots },
    })

    // SlotCard components rendered
    const slotCards = wrapper.findAllComponents({ name: 'SlotCard' })
    expect(slotCards).toHaveLength(3)
  })

  it('displays the step count badge', () => {
    const slots = createMockSlots(3)
    const wrapper = mount(SlotsPanel, {
      props: { slots },
    })

    expect(wrapper.text()).toContain('3 个步骤')
  })

  it('does not show count badge when no slots', () => {
    const wrapper = mount(SlotsPanel, {
      props: { slots: [] },
    })

    // Should still show "操作步骤" title but no count badge
    expect(wrapper.text()).toContain('操作步骤')
    // The badge span should not render when slots.length === 0
    expect(wrapper.text()).not.toContain('个步骤')
  })

  it('"添加步骤" button exists', () => {
    const wrapper = mount(SlotsPanel, {
      props: { slots: [] },
    })

    const addButton = wrapper.find('button')
    expect(addButton.exists()).toBe(true)
    expect(addButton.text()).toContain('添加步骤')
  })

  it('clicking "添加步骤" emits add event', async () => {
    const wrapper = mount(SlotsPanel, {
      props: { slots: [] },
    })

    const addButton = wrapper.find('button')
    await addButton.trigger('click')

    expect(wrapper.emitted('add')).toBeTruthy()
    expect(wrapper.emitted('add')).toHaveLength(1)
  })

  it('empty state shows when no slots', () => {
    const wrapper = mount(SlotsPanel, {
      props: { slots: [] },
    })

    expect(wrapper.text()).toContain('暂无操作步骤')
    expect(wrapper.text()).toContain('添加步骤')
    expect(wrapper.find('.grid').exists()).toBe(false)
  })

  it('passes slot data to SlotCard children', () => {
    const slots = createMockSlots(2)
    const wrapper = mount(SlotsPanel, {
      props: { slots },
    })

    const slotCards = wrapper.findAllComponents({ name: 'SlotCard' })
    expect(slotCards[0].props('slot')).toEqual(slots[0])
    expect(slotCards[0].props('index')).toBe(0)
    expect(slotCards[1].props('slot')).toEqual(slots[1])
    expect(slotCards[1].props('index')).toBe(1)
  })

  it('emits delete when SlotCard emits delete', async () => {
    const slots = createMockSlots(2)
    const wrapper = mount(SlotsPanel, {
      props: { slots },
    })

    const slotCards = wrapper.findAllComponents({ name: 'SlotCard' })
    await slotCards[0].vm.$emit('delete')

    expect(wrapper.emitted('delete')).toBeTruthy()
    expect(wrapper.emitted('delete')![0]).toEqual([slots[0].id])
  })

  it('emits update when SlotCard emits update:name', async () => {
    const slots = createMockSlots(1)
    const wrapper = mount(SlotsPanel, {
      props: { slots },
    })

    const slotCards = wrapper.findAllComponents({ name: 'SlotCard' })
    await slotCards[0].vm.$emit('update:name', 'New Name')

    expect(wrapper.emitted('update')).toBeTruthy()
    expect(wrapper.emitted('update')![0]).toEqual([slots[0].id, 'name', 'New Name'])
  })

  it('emits update when SlotCard emits update:value', async () => {
    const slots = createMockSlots(1)
    const wrapper = mount(SlotsPanel, {
      props: { slots },
    })

    const slotCards = wrapper.findAllComponents({ name: 'SlotCard' })
    await slotCards[0].vm.$emit('update:value', 'new-value')

    expect(wrapper.emitted('update')).toBeTruthy()
    expect(wrapper.emitted('update')![0]).toEqual([slots[0].id, 'value', 'new-value'])
  })

  it('emits update when SlotCard emits update:output_key', async () => {
    const slots = createMockSlots(1)
    const wrapper = mount(SlotsPanel, {
      props: { slots },
    })

    const slotCards = wrapper.findAllComponents({ name: 'SlotCard' })
    await slotCards[0].vm.$emit('update:output_key', 'captcha_result')

    expect(wrapper.emitted('update')).toBeTruthy()
    expect(wrapper.emitted('update')![0]).toEqual([slots[0].id, 'output_key', 'captcha_result'])
  })

  it('emits update when SlotCard emits update:timeout', async () => {
    const slots = createMockSlots(1)
    const wrapper = mount(SlotsPanel, {
      props: { slots },
    })

    const slotCards = wrapper.findAllComponents({ name: 'SlotCard' })
    await slotCards[0].vm.$emit('update:timeout', 1000)

    expect(wrapper.emitted('update')).toBeTruthy()
    expect(wrapper.emitted('update')![0]).toEqual([slots[0].id, 'timeout', 1000])
  })

  it('toggles collapse state when SlotCard emits toggle', async () => {
    const slots = createMockSlots(1)
    const wrapper = mount(SlotsPanel, {
      props: { slots },
    })

    const slotCards = wrapper.findAllComponents({ name: 'SlotCard' })

    // Initially not collapsed
    expect(slotCards[0].props('collapsed')).toBe(false)

    // Toggle to collapsed
    await slotCards[0].vm.$emit('toggle')
    await wrapper.vm.$nextTick()
    const updatedCards = wrapper.findAllComponents({ name: 'SlotCard' })
    expect(updatedCards[0].props('collapsed')).toBe(true)

    // Toggle back
    await updatedCards[0].vm.$emit('toggle')
    await wrapper.vm.$nextTick()
    const finalCards = wrapper.findAllComponents({ name: 'SlotCard' })
    expect(finalCards[0].props('collapsed')).toBe(false)
  })
})

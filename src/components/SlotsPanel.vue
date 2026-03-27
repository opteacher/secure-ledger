<template>
  <div class="h-full flex flex-col">
    <div class="p-4 border-b border-neutral-200 flex items-center justify-between bg-white">
      <div class="flex items-center gap-2">
        <svg class="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
        </svg>
        <h3 class="font-semibold text-fg-primary">操作步骤</h3>
        <span v-if="slots.length > 0" class="px-2 py-0.5 text-xs bg-primary-100 text-primary-700 rounded-full">{{ slots.length }} 个步骤</span>
      </div>
      <button @click="$emit('add')" class="btn-primary text-sm">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
        </svg>
        添加步骤
      </button>
    </div>
    
    <div class="flex-1 overflow-auto p-6 bg-neutral-50">
      <div v-if="slots.length === 0" class="text-center py-16">
        <svg class="w-16 h-16 mx-auto text-neutral-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
        </svg>
        <p class="text-fg-muted mb-2">暂无操作步骤</p>
        <p class="text-sm text-fg-muted">在"网页预览"中选择元素，或点击上方"添加步骤"按钮</p>
      </div>
      
      <div v-else class="grid gap-4">
        <SlotCard
          v-for="(slot, index) in slots"
          :key="slot.id"
          :slot="slot"
          :index="index"
          :collapsed="collapsedSlots.has(slot.id)"
          @toggle="toggleCollapse(slot.id)"
          @delete="$emit('delete', slot.id)"
          @update:name="updateSlot(slot.id, 'name', $event)"
          @update:element_xpath="updateSlot(slot.id, 'element_xpath', $event)"
          @update:action_type="updateSlot(slot.id, 'action_type', $event)"
          @update:value="updateSlot(slot.id, 'value', $event)"
          @update:is_encrypted="updateSlot(slot.id, 'is_encrypted', $event)"
          @update:timeout="updateSlot(slot.id, 'timeout', $event)"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import SlotCard from './SlotCard.vue'
import type { Slot } from '../apis'

defineProps<{
  slots: Slot[]
}>()

const emit = defineEmits<{
  add: []
  delete: [slotId: number]
  update: [slotId: number, field: string, value: any]
}>()

const collapsedSlots = ref<Set<number>>(new Set())

function toggleCollapse(slotId: number) {
  if (collapsedSlots.value.has(slotId)) {
    collapsedSlots.value.delete(slotId)
  } else {
    collapsedSlots.value.add(slotId)
  }
}

function updateSlot(slotId: number, field: string, value: any) {
  emit('update', slotId, field, value)
}
</script>
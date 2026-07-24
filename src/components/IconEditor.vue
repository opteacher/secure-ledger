<template>
  <div class="relative inline-flex items-center">
    <button
      class="w-10 h-10 rounded-xl flex items-center justify-center font-medium text-lg shadow-soft hover:shadow-elevated transition-all duration-200 cursor-pointer border-2 border-transparent hover:border-primary-300"
      :class="iconPreviewBg"
      @click="openPicker"
      title="设置图标"
    >
      <img
        v-if="isImageUrl"
        :src="iconValue"
        class="w-full h-full object-cover rounded-xl"
        alt="icon"
      />
      <span v-else-if="isIconfontUrl" class="flex items-center justify-center overflow-hidden" style="font-size:24px" v-html="extractSvg(iconValue)" />
      <component v-else-if="isAntdIcon" :is="resolveAntdIcon(iconValue)" :style="{ fontSize: '24px' }" />
      <span v-else-if="!iconValue" class="text-sm">
        {{ fallbackLetter }}
      </span>
    </button>
    <button
      v-if="iconValue"
      class="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-error-500 text-white flex items-center justify-center text-xs leading-none hover:bg-error-600 transition-colors shadow-sm"
      @click.stop="$emit('update:iconValue', '')"
      title="移除图标"
    >
      ×
    </button>

    <IconPickerModal
      v-model:visible="pickerVisible"
      @select="onIconSelect"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import * as Icons from '@ant-design/icons-vue'
import IconPickerModal from './IconPickerModal.vue'

const props = defineProps<{
  iconValue: string
  name?: string
}>()

const emit = defineEmits<{
  'update:iconValue': [value: string]
}>()

const pickerVisible = ref(false)

const isImageUrl = computed(() => props.iconValue.startsWith('data:image/'))
const isAntdIcon = computed(() => props.iconValue.startsWith('antd:'))
const isIconfontUrl = computed(() => props.iconValue.startsWith('iconfont:'))

const fallbackLetter = computed(() =>
  (props.name || '?').charAt(0).toUpperCase()
)

const iconPreviewBg = computed(() => {
  if (isImageUrl.value || isIconfontUrl.value) return 'bg-transparent'
  if (isAntdIcon.value) return 'bg-primary-50 text-primary-600'
  return 'bg-gradient-to-br from-primary-100 to-primary-50 text-primary-600'
})

function resolveAntdIcon(raw: string) {
  return (Icons as Record<string, any>)[raw.slice(5)] || null
}

function extractSvg(raw: string) {
  const idx = raw.indexOf(':', raw.indexOf(':') + 1)
  const svg = idx !== -1 ? raw.slice(idx + 1) : raw
  return svg.replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/on\w+\s*=\s*"[^"]*"/gi, '')
    .replace(/on\w+\s*=\s*'[^']*'/gi, '')
    .replace(/javascript\s*:/gi, '')
}

function openPicker() {
  pickerVisible.value = true
}

function onIconSelect(value: string) {
  emit('update:iconValue', value)
  pickerVisible.value = false
}
</script>

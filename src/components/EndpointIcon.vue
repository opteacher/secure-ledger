<template>
  <div
    class="flex items-center justify-center font-medium"
    :class="containerClasses"
    :style="{ width: size + 'px', height: size + 'px' }"
  >
    <img
      v-if="isImageUrl"
      :src="icon"
      class="w-full h-full object-cover"
      :class="roundedClass"
      alt=""
    />
    <span v-else-if="isIconfontUrl" class="w-full h-full flex items-center justify-center overflow-hidden" :style="{ fontSize: Math.round(size * 0.55) + 'px' }" v-html="extractSvg(icon)" />
    <component v-else-if="isAntdIcon" :is="resolveAntdIcon(icon)" :style="{ fontSize: Math.round(size * 0.55) + 'px' }" class="w-full h-full flex items-center justify-center" />
    <span v-else :class="textSizeClass">
      {{ fallbackLetter }}
    </span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import * as Icons from '@ant-design/icons-vue'

const props = withDefaults(defineProps<{
  icon: string
  name: string
  size?: number
}>(), {
  size: 48
})

const isImageUrl = computed(() => props.icon.startsWith('data:image/'))
const isAntdIcon = computed(() => props.icon.startsWith('antd:'))
const isIconfontUrl = computed(() => props.icon.startsWith('iconfont:'))

const fallbackLetter = computed(() => (props.name || '?').charAt(0).toUpperCase())

const containerClasses = computed(() => {
  const sizeClass = props.size <= 32 ? 'rounded-lg' : 'rounded-xl'
  if (isImageUrl.value || isIconfontUrl.value) return sizeClass + ' overflow-hidden'
  if (isAntdIcon.value) return sizeClass + ' bg-primary-50 text-primary-600'
  return sizeClass + ' bg-gradient-to-br from-primary-100 to-primary-50 text-primary-600'
})

const roundedClass = computed(() => props.size <= 32 ? 'rounded-lg' : 'rounded-xl')

const textSizeClass = computed(() => {
  if (props.size <= 20) return 'text-xs'
  if (props.size <= 32) return 'text-sm'
  return 'text-lg'
})

function resolveAntdIcon(raw: string) {
  const name = raw.slice(5)
  return (Icons as Record<string, any>)[name] || null
}

function extractSvg(raw: string) {
  const secondColon = raw.indexOf(':', raw.indexOf(':') + 1)
  const svg = secondColon !== -1 ? raw.slice(secondColon + 1) : raw
  return sanitizeSvg(svg)
}

function sanitizeSvg(svg: string): string {
  return svg
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/on\w+\s*=\s*"[^"]*"/gi, '')
    .replace(/on\w+\s*=\s*'[^']*'/gi, '')
    .replace(/javascript\s*:/gi, '')
}
</script>

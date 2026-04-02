<template>
  <div class="modal-overlay" @click.self="emit('close')">
    <div class="modal-content" style="width: 520px;">
      <!-- Header -->
      <div class="flex items-center justify-between mb-6">
        <h3 class="text-lg font-semibold text-fg-primary">分享成功</h3>
        <button @click="emit('close')" class="btn-icon">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      
      <!-- Info -->
      <div class="mb-4 p-3 bg-primary-50 rounded-lg">
        <div class="flex items-center gap-2 text-primary-700">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span class="text-sm font-medium">Token已生成，请妥善保管</span>
        </div>
      </div>
      
      <!-- Endpoint Info -->
      <div class="card p-3 mb-4 bg-neutral-50">
        <div class="flex items-center gap-3">
          <div class="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-100 to-primary-50 flex items-center justify-center text-primary-600 font-medium text-sm">
            {{ endpointIcon }}
          </div>
          <div>
            <div class="font-medium text-sm">{{ endpointName }}</div>
            <div class="text-xs text-fg-muted">{{ restrictionText }}</div>
          </div>
        </div>
      </div>
      
      <!-- Token Display -->
      <div class="mb-6">
        <div class="text-sm font-medium text-fg-secondary mb-2">Token:</div>
        <div class="bg-neutral-900 rounded-lg p-4 max-h-40 overflow-auto">
          <pre class="text-xs text-green-400 font-mono whitespace-pre-wrap break-all select-all">{{ token }}</pre>
        </div>
        <div class="text-xs text-fg-muted mt-2">
          共 {{ token.length }} 字符
        </div>
      </div>
      
      <!-- Actions -->
      <div class="flex gap-3 justify-end">
        <button @click="copyToken" class="btn-secondary">
          <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          复制Token
        </button>
        <button @click="downloadToken" class="btn-primary">
          <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          下载文件
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { ShareRestrictions } from '@/apis'
import { messageSuccess, messageError } from '@/utils/dialog'

const props = defineProps<{
  token: string
  endpointName: string
  endpointIcon: string
  restrictions: ShareRestrictions
}>()

const emit = defineEmits<{ close: [] }>()

const restrictionText = computed(() => {
  const r = props.restrictions
  switch (r.type) {
    case 'unlimited':
      return '无限制使用'
    case 'count':
      return `限制使用 ${r.maxUsage} 次`
    case 'duration':
      return `有效期 ${r.durationHours} 小时`
    case 'datetime':
      return `有效期至 ${new Date(r.expiresAt || '').toLocaleString()}`
    default:
      return ''
  }
})

async function copyToken() {
  try {
    await navigator.clipboard.writeText(props.token)
    messageSuccess('Token已复制到剪贴板')
  } catch (e) {
    messageError('复制失败，请手动复制')
  }
}

function downloadToken() {
  const blob = new Blob([props.token], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${props.endpointName}-share.jwt`
  a.click()
  URL.revokeObjectURL(url)
  messageSuccess('Token文件下载成功')
}
</script>
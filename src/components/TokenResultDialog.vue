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
          复制
        </button>
        <button @click="downloadToken" class="btn-secondary">
          <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          下载
        </button>
        <button 
          v-if="canSend" 
          @click="sendToken" 
          :disabled="sending"
          :title="`发送到 ${targetIpForSend}`"
          class="btn-primary relative group"
        >
          <svg v-if="sending" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <svg v-else class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
          <span v-if="!sending">发送</span>
        </button>
      </div>
      
      <!-- Send Result/Error -->
      <div v-if="sendResult" class="badge-success mt-3">{{ sendResult }}</div>
      <div v-if="sendError" class="badge-error mt-3">{{ sendError }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import type { ShareRestrictions } from '@/apis'
import { messageSuccess, messageError } from '@/utils/dialog'

const props = defineProps<{
  token: string
  endpointName: string
  endpointIcon: string
  restrictions: ShareRestrictions
}>()

const emit = defineEmits<{ close: []; sent: [success: boolean] }>()

// Network transfer
const sending = ref(false)
const sendResult = ref('')
const sendError = ref('')

const restrictionText = computed(() => {
  const r = props.restrictions
  let text = ''
  
  switch (r.type) {
    case 'unlimited':
      text = '无限制使用'
      break
    case 'count':
      text = `限制使用 ${r.maxUsage} 次`
      break
    case 'duration':
      text = `有效期 ${r.durationHours} 小时`
      break
    case 'datetime':
      text = `有效期至 ${new Date(r.expiresAt || '').toLocaleString()}`
      break
  }
  
  // Add IP and deadline info
  if (r.targetIp) {
    text += ` | IP: ${r.targetIp}`
  }
  if (r.importDeadline) {
    text += ` | 导入期限: ${r.importDeadline}小时`
  }
  
  return text
})

// Check if can send token (only single IP without CIDR)
const canSend = computed(() => {
  const ip = props.restrictions.targetIp
  if (!ip) return false
  // CIDR notation contains '/'
  if (ip.includes('/')) return false
  return true
})

// Get target IP for sending
const targetIpForSend = computed(() => {
  return props.restrictions.targetIp || ''
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

async function sendToken() {
  if (!targetIpForSend.value) {
    sendError.value = '目标IP未设置'
    return
  }
  
  sending.value = true
  sendError.value = ''
  sendResult.value = ''
  
  try {
    const port = 37777  // Default port
    const response = await fetch(`http://${targetIpForSend.value}:${port}/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: props.token
    })
    
    const result = await response.json()
    
    if (response.ok && result.success) {
      sendResult.value = `Token已发送成功`
      emit('sent', true)
      messageSuccess('Token发送成功')
    } else {
      sendError.value = result.error || '发送失败'
    }
  } catch (e: any) {
    console.error('Send token error:', e)
    sendError.value = '连接失败，请确认目标机器已开启接收服务'
  } finally {
    sending.value = false
  }
}
</script>
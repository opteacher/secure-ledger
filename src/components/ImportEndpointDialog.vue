<template>
  <div class="modal-overlay" @click.self="emit('close')">
    <div class="modal-content" style="width: 520px;">
      <!-- Header -->
      <div class="flex items-center justify-between mb-6">
        <h3 class="text-lg font-semibold text-fg-primary">导入登录端</h3>
        <button @click="emit('close')" class="btn-icon">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      
      <!-- Token Input -->
      <div class="space-y-4 mb-6">
        <div>
          <label class="text-sm font-medium text-fg-secondary mb-2 block">Token内容</label>
          <textarea 
            v-model="tokenInput" 
            class="textarea w-full h-24 p-3 text-sm font-mono"
            placeholder="粘贴Token内容..."
          />
        </div>
        
        <div class="flex items-center gap-3">
          <div class="flex-1 h-px bg-neutral-200"></div>
          <span class="text-xs text-fg-muted">或</span>
          <div class="flex-1 h-px bg-neutral-200"></div>
        </div>
        
        <div>
          <button @click="selectFile" class="btn-secondary w-full">
            <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            选择Token文件
          </button>
          <div v-if="selectedFile" class="text-sm text-fg-muted mt-2 text-center">
            已选择: {{ selectedFile }}
          </div>
        </div>
      </div>
      
      <!-- Error message -->
      <div v-if="error" class="badge-error mb-4">{{ error }}</div>
      
      <!-- Actions -->
      <div class="flex gap-3 justify-end">
        <button @click="emit('close')" class="btn-secondary">取消</button>
        <button @click="importEndpoint" class="btn-primary" :disabled="!tokenInput || importing">
          <svg v-if="importing" class="w-4 h-4 animate-spin mr-1" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          {{ importing ? '导入中...' : '导入' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { endpointApi, type Endpoint } from '@/apis'

const emit = defineEmits<{ close: []; imported: [endpoint: Endpoint] }>()

const tokenInput = ref('')
const selectedFile = ref('')
const importing = ref(false)
const error = ref('')

async function selectFile() {
  error.value = ''
  try {
    const result = await window.ipc.invoke('dialog:openFile', {
      filters: [{ name: 'Token Files', extensions: ['jwt', 'txt'] }]
    })
    if (!result.canceled && result.filePaths[0]) {
      selectedFile.value = result.filePaths[0]
      // Read file content
      const content = await window.ipc.invoke('file:read', result.filePaths[0])
      tokenInput.value = content
    }
  } catch (e: any) {
    error.value = e.message || '读取文件失败'
  }
}

async function importEndpoint() {
  error.value = ''
  
  if (!tokenInput.value.trim()) {
    error.value = '请输入Token内容'
    return
  }
  
  importing.value = true
  
  try {
    const endpoint = await endpointApi.importToken(tokenInput.value.trim())
    emit('imported', endpoint)
    emit('close')
  } catch (e: any) {
    error.value = e.message || '导入失败'
  } finally {
    importing.value = false
  }
}
</script>
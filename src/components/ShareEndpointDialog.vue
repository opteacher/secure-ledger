<template>
  <div class="modal-overlay" @click.self="emit('close')">
    <div class="modal-content" style="width: 1100px;">
      <!-- Header -->
      <div class="flex items-center justify-between mb-6">
        <h3 class="text-lg font-semibold text-fg-primary">分享登录端</h3>
        <button @click="emit('close')" class="btn-icon">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      
      <!-- Endpoint Preview -->
      <div class="card p-3 mb-4 bg-neutral-50">
        <div class="flex items-center gap-3">
          <div class="w-9 h-9 rounded-lg bg-gradient-to-br from-primary-100 to-primary-50 flex items-center justify-center text-primary-600 font-medium">
            {{ endpoint.icon || endpoint.name.charAt(0).toUpperCase() }}
          </div>
          <div>
            <div class="font-medium text-sm">{{ endpoint.name }}</div>
            <div class="text-xs text-fg-muted">{{ endpoint.login_type === 'web' ? '网页登录' : 'SSH登录' }}</div>
          </div>
        </div>
      </div>
      
      <!-- Two Column Layout -->
      <div class="grid grid-cols-2 gap-6 mb-6">
        <!-- Left Column: Usage Restrictions -->
        <div>
          <h4 class="text-sm font-medium text-fg-secondary mb-3">使用限制</h4>
          <div class="space-y-3">
            <label class="flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors" 
                   :class="restrictionType === 'unlimited' ? 'border-primary-500 bg-primary-50' : 'border-neutral-200 hover:border-neutral-300'">
              <input type="radio" v-model="restrictionType" value="unlimited" class="mt-1" />
              <div>
                <div class="font-medium">无限制</div>
                <div class="text-sm text-fg-muted">无限次使用</div>
              </div>
            </label>
            
            <label class="flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors"
                   :class="restrictionType === 'count' ? 'border-primary-500 bg-primary-50' : 'border-neutral-200 hover:border-neutral-300'">
              <input type="radio" v-model="restrictionType" value="count" class="mt-1" />
              <div class="flex-1">
                <div class="font-medium">限制次数</div>
                <div v-if="restrictionType === 'count'" class="mt-2 flex items-center gap-2">
                  <input type="number" v-model.number="maxUsage" min="1" max="1000" 
                         class="input-field w-20 px-2 py-1 text-sm" />
                  <span class="text-sm text-fg-muted">次</span>
                </div>
              </div>
            </label>
            
            <label class="flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors"
                   :class="restrictionType === 'duration' ? 'border-primary-500 bg-primary-50' : 'border-neutral-200 hover:border-neutral-300'">
              <input type="radio" v-model="restrictionType" value="duration" class="mt-1" />
              <div class="flex-1">
                <div class="font-medium">限制时长</div>
                <div v-if="restrictionType === 'duration'" class="mt-2 flex items-center gap-2">
                  <input type="number" v-model.number="durationHours" min="1" max="720" 
                         class="input-field w-20 px-2 py-1 text-sm" />
                  <span class="text-sm text-fg-muted">小时</span>
                </div>
              </div>
            </label>
            
            <label class="flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors"
                   :class="restrictionType === 'datetime' ? 'border-primary-500 bg-primary-50' : 'border-neutral-200 hover:border-neutral-300'">
              <input type="radio" v-model="restrictionType" value="datetime" class="mt-1" />
              <div class="flex-1">
                <div class="font-medium">截止时间</div>
                <div v-if="restrictionType === 'datetime'" class="mt-2">
                  <input type="datetime-local" v-model="expiresAt" 
                         class="input-field px-2 py-1 text-sm w-full" />
                </div>
              </div>
            </label>
          </div>
        </div>
        
        <!-- Right Column: Import Restrictions -->
        <div>
          <h4 class="text-sm font-medium text-fg-secondary mb-3">导入限制</h4>
          <div class="space-y-3">
            <div class="p-3 rounded-lg border transition-colors"
                   :class="hasTargetIp ? 'border-primary-500 bg-primary-50' : 'border-neutral-200 hover:border-neutral-300'">
              <label class="flex items-start gap-3 cursor-pointer">
                <input type="checkbox" v-model="hasTargetIp" class="mt-1" />
                <div class="flex-1">
                  <div class="font-medium">限制目标IP</div>
                  <div class="text-sm text-fg-muted">仅指定IP/网段可导入</div>
                </div>
              </label>
              <div v-if="hasTargetIp" class="mt-2 ml-7">
                <input type="text" v-model="targetIp" 
                       class="input-field w-full px-2 py-1 text-sm"
                       :class="targetIpError ? 'border-red-500' : ''"
                       placeholder="192.168.1.100 或 192.168.1.0/24" />
                <div v-if="targetIpError" class="text-xs text-red-500 mt-1">{{ targetIpError }}</div>
              </div>
            </div>
            
            <div class="p-3 rounded-lg border transition-colors"
                   :class="hasImportDeadline ? 'border-primary-500 bg-primary-50' : 'border-neutral-200 hover:border-neutral-300'">
              <label class="flex items-start gap-3 cursor-pointer">
                <input type="checkbox" v-model="hasImportDeadline" class="mt-1" />
                <div class="flex-1">
                  <div class="font-medium">导入期限</div>
                  <div class="text-sm text-fg-muted">超时未导入则失效</div>
                </div>
              </label>
              <div v-if="hasImportDeadline" class="mt-2 ml-7 flex items-center gap-2">
                <input type="number" v-model.number="importDeadline" min="1" max="168"
                       class="input-field w-20 px-2 py-1 text-sm"
                       :class="importDeadlineError ? 'border-red-500' : ''" />
                <span class="text-sm text-fg-muted">小时</span>
              </div>
              <div v-if="hasImportDeadline && importDeadlineError" class="text-xs text-red-500 mt-1 ml-7">{{ importDeadlineError }}</div>
            </div>
          </div>
          
          <!-- Local IP Hint -->
          <div class="mt-4 p-3 bg-neutral-50 rounded-lg text-sm text-fg-muted">
            本机IP: {{ localIPs.join(', ') || '未检测到' }}
          </div>
        </div>
      </div>
      
      <!-- Actions -->
      <div class="flex gap-3 justify-end">
        <button @click="emit('close')" class="btn-secondary">取消</button>
        <button @click="generateToken" class="btn-primary" :disabled="generating">
          {{ generating ? '生成中...' : '生成Token' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { endpointApi, networkApi, type Endpoint, type ShareRestrictions } from '@/apis'

const props = defineProps<{ endpoint: Endpoint }>()
const emit = defineEmits<{ 
  close: []
  generated: [token: string, endpointName: string, endpointIcon: string, restrictions: ShareRestrictions]
}>()

const restrictionType = ref<'unlimited' | 'count' | 'duration' | 'datetime'>('unlimited')
const maxUsage = ref(5)
const durationHours = ref(24)
const expiresAt = ref('')
const generating = ref(false)

// Import restrictions
const hasTargetIp = ref(true)
const targetIp = ref('')
const targetIpError = ref('')
const hasImportDeadline = ref(true)
const importDeadline = ref(2)
const importDeadlineError = ref('')
const localIPs = ref<string[]>([])

// Clear errors when user types
watch(targetIp, () => { targetIpError.value = '' })
watch(importDeadline, () => { importDeadlineError.value = '' })
watch(hasTargetIp, (val) => { if (!val) targetIpError.value = '' })
watch(hasImportDeadline, (val) => { if (!val) importDeadlineError.value = '' })

// Load local IPs on mount
onMounted(async () => {
  try {
    const result = await networkApi.getLocalIPs()
    localIPs.value = result.ips
  } catch (e) {
    console.warn('Failed to get local IPs:', e)
  }
})

async function generateToken() {
  // Clear previous errors
  targetIpError.value = ''
  importDeadlineError.value = ''
  
  // Validation: check if restrictions are properly filled
  if (hasTargetIp.value && !targetIp.value.trim()) {
    targetIpError.value = '请输入目标IP地址'
    return
  }
  
  if (hasImportDeadline.value && (!importDeadline.value || importDeadline.value < 1)) {
    importDeadlineError.value = '请输入有效期限（1-168小时）'
    return
  }
  
  // Validate targetIp format if provided
  if (hasTargetIp.value && targetIp.value.trim()) {
    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/
    if (!ipRegex.test(targetIp.value.trim())) {
      targetIpError.value = 'IP格式不正确，例如: 192.168.1.100'
      return
    }
  }
  
  generating.value = true
  
  try {
    const restrictions: ShareRestrictions = {
      type: restrictionType.value,
    }
    
    if (restrictionType.value === 'count') {
      restrictions.maxUsage = maxUsage.value
    } else if (restrictionType.value === 'duration') {
      restrictions.durationHours = durationHours.value
    } else if (restrictionType.value === 'datetime') {
      restrictions.expiresAt = expiresAt.value
    }
    
    // Add import restrictions
    if (hasTargetIp.value && targetIp.value.trim()) {
      restrictions.targetIp = targetIp.value.trim()
    }
    if (hasImportDeadline.value) {
      restrictions.importDeadline = importDeadline.value
    }
    
    const token = await endpointApi.share(props.endpoint.id, restrictions)
    
    // Emit result and close
    emit('generated', token, props.endpoint.name, props.endpoint.icon || '', restrictions)
    emit('close')
  } catch (e: any) {
    // Show backend errors in the appropriate field
    if (e.message?.includes('IP') || e.message?.includes('目标')) {
      targetIpError.value = e.message
    } else if (e.message?.includes('期限') || e.message?.includes('deadline')) {
      importDeadlineError.value = e.message
    }
    // Other errors are silently logged
    console.error('Failed to generate token:', e.message)
  } finally {
    generating.value = false
  }
}
</script>
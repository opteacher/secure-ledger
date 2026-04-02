<template>
  <div class="modal-overlay" @click.self="emit('close')">
    <div class="modal-content" style="width: 520px;">
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
      <div class="card p-4 mb-6 bg-neutral-50">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-100 to-primary-50 flex items-center justify-center text-primary-600 font-medium text-lg">
            {{ endpoint.icon || endpoint.name.charAt(0).toUpperCase() }}
          </div>
          <div>
            <div class="font-medium text-fg-primary">{{ endpoint.name }}</div>
            <div class="text-sm text-fg-muted">{{ endpoint.login_type === 'web' ? '网页登录' : 'SSH登录' }}</div>
          </div>
        </div>
        <div class="mt-3 text-xs text-fg-muted bg-amber-50 text-amber-700 p-2 rounded">
          注意：分享仅包含登录端基本信息，不包含操作槽和密码等敏感数据
        </div>
      </div>
      
      <!-- Restriction Options -->
      <div class="space-y-3 mb-6">
        <label class="flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors" 
               :class="restrictionType === 'unlimited' ? 'border-primary-500 bg-primary-50' : 'border-neutral-200 hover:border-neutral-300'">
          <input type="radio" v-model="restrictionType" value="unlimited" class="mt-1" />
          <div>
            <div class="font-medium">无限制</div>
            <div class="text-sm text-fg-muted">接收方可无限次使用</div>
          </div>
        </label>
        
        <label class="flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors"
               :class="restrictionType === 'count' ? 'border-primary-500 bg-primary-50' : 'border-neutral-200 hover:border-neutral-300'">
          <input type="radio" v-model="restrictionType" value="count" class="mt-1" />
          <div class="flex-1">
            <div class="font-medium">限制使用次数</div>
            <div class="text-sm text-fg-muted">达到次数后Token自动失效</div>
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
            <div class="font-medium">限制使用时长</div>
            <div class="text-sm text-fg-muted">从生成时开始计时</div>
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
            <div class="font-medium">限制截止时间</div>
            <div class="text-sm text-fg-muted">指定具体过期时间</div>
            <div v-if="restrictionType === 'datetime'" class="mt-2">
              <input type="datetime-local" v-model="expiresAt" 
                     class="input-field px-2 py-1 text-sm" />
            </div>
          </div>
        </label>
      </div>
      
      <!-- Error message -->
      <div v-if="error" class="badge-error mb-4">{{ error }}</div>
      
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
import { ref } from 'vue'
import { endpointApi, type Endpoint, type ShareRestrictions } from '@/apis'

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
const error = ref('')

async function generateToken() {
  error.value = ''
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
    
    const token = await endpointApi.share(props.endpoint.id, restrictions)
    
    // Emit result and close
    emit('generated', token, props.endpoint.name, props.endpoint.icon || '', restrictions)
    emit('close')
  } catch (e: any) {
    error.value = e.message || '生成Token失败'
  } finally {
    generating.value = false
  }
}
</script>
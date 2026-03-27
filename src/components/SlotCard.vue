<template>
  <div class="rounded-xl border border-neutral-200 bg-neutral-50 overflow-hidden">
    <!-- 卡片头部 - 可点击展开/折叠 -->
    <div 
      class="flex items-center gap-2 px-4 py-3 cursor-pointer hover:bg-neutral-100 transition-colors"
      @click="$emit('toggle')"
    >
      <!-- 折叠/展开箭头 -->
      <svg 
        class="w-4 h-4 text-fg-muted transition-transform duration-200" 
        :class="{ 'rotate-90': !collapsed }"
        fill="none" stroke="currentColor" viewBox="0 0 24 24"
      >
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
      </svg>
      <!-- 序号 -->
      <span class="w-6 h-6 rounded bg-primary-100 text-primary-600 flex items-center justify-center text-xs font-medium">
        {{ index + 1 }}
      </span>
      <!-- 名称输入框 -->
      <input 
        :value="slot.name"
        @input="$emit('update:name', ($event.target as HTMLInputElement).value)"
        type="text" 
        class="flex-1 text-sm font-medium bg-transparent border-none focus:ring-0 p-0 text-fg-primary placeholder:text-fg-muted"
        placeholder="点击输入操作名称"
        @click.stop
      />
      <!-- 删除按钮 -->
      <button 
        @click.stop="$emit('delete')"
        class="text-neutral-400 hover:text-error-500 transition-colors p-1"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
    
    <!-- 卡片内容 - 可折叠 -->
    <div v-show="!collapsed" class="px-4 pb-4 border-t border-neutral-200">
      <div class="space-y-3 pt-3">
        <!-- 元素XPath -->
        <div>
          <label class="text-xs font-medium text-fg-muted block mb-1">元素XPath</label>
          <input 
            :value="slot.element_xpath"
            @input="$emit('update:element_xpath', ($event.target as HTMLInputElement).value)"
            type="text" 
            class="w-full text-sm" 
            placeholder="//input[@id='username']" 
          />
        </div>
        
        <!-- 操作类型 -->
        <div>
          <label class="text-xs font-medium text-fg-muted block mb-1">操作类型</label>
          <select 
            :value="slot.action_type"
            @change="$emit('update:action_type', ($event.target as HTMLSelectElement).value)"
            class="w-full text-sm"
          >
            <option value="input">输入</option>
            <option value="click">点击</option>
            <option value="select">选择</option>
          </select>
        </div>
        
        <!-- 输入值 -->
        <div v-if="slot.action_type === 'input'">
          <label class="text-xs font-medium text-fg-muted block mb-1">输入值</label>
          <div class="flex gap-2">
            <input 
              :value="slot.value"
              @input="$emit('update:value', ($event.target as HTMLInputElement).value)"
              :type="slot.is_encrypted ? 'password' : 'text'" 
              class="flex-1 text-sm" 
              placeholder="输入值" 
            />
            <label class="flex items-center gap-1 text-xs text-fg-muted cursor-pointer">
              <input 
                :checked="slot.is_encrypted"
                @change="$emit('update:is_encrypted', ($event.target as HTMLInputElement).checked)"
                type="checkbox" 
                class="w-3.5 h-3.5 rounded border-neutral-300 text-primary-600" 
              />
              加密
            </label>
          </div>
        </div>
        
        <!-- 超时设置 -->
        <div>
          <label class="text-xs font-medium text-fg-muted block mb-1">超时 (ms)</label>
          <input 
            :value="slot.timeout"
            @input="$emit('update:timeout', Number(($event.target as HTMLInputElement).value))"
            type="number" 
            class="w-full text-sm" 
            placeholder="200" 
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Slot } from '../apis'

defineProps<{
  slot: Slot
  index: number
  collapsed: boolean
}>()

defineEmits<{
  toggle: []
  delete: []
  'update:name': [value: string]
  'update:element_xpath': [value: string]
  'update:action_type': [value: string]
  'update:value': [value: string]
  'update:is_encrypted': [value: boolean]
  'update:timeout': [value: number]
}>()
</script>
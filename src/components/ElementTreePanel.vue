<template>
  <div class="h-full flex flex-col">
    <div class="p-4 border-b border-neutral-200 flex items-center justify-between bg-white">
      <div class="flex items-center gap-2">
        <svg class="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
        </svg>
        <h3 class="font-semibold text-fg-primary">元素树</h3>
        <span v-if="elements.length > 0" class="px-2 py-0.5 text-xs bg-primary-100 text-primary-700 rounded-full">{{ elements.length }} 个元素</span>
      </div>
    </div>
    
    <div class="flex-1 overflow-auto p-4 bg-neutral-50">
      <div v-if="elements.length === 0" class="text-center py-12">
        <svg class="w-12 h-12 mx-auto text-neutral-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
        </svg>
        <p class="text-sm text-fg-muted mb-1">暂无元素数据</p>
        <p class="text-xs text-fg-muted">在"网页预览"标签加载页面后，元素将自动收集</p>
      </div>
      
      <div v-else class="space-y-1">
        <template v-for="node in tree" :key="node.path">
          <div 
            v-for="el in node.elements" 
            :key="el.xpath"
            class="group flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer hover:bg-primary-50 transition-colors"
            :class="{ 'bg-primary-100 ring-1 ring-primary-200': selectedXpath === el.xpath }"
            @mouseenter="$emit('select', el.xpath)"
            @mouseleave="$emit('select', null)"
            @dblclick="$emit('add', el.xpath)"
          >
            <span class="w-6 h-6 rounded bg-neutral-200 flex items-center justify-center text-xs text-fg-muted font-mono">
              {{ node.tagName.charAt(0).toUpperCase() }}
            </span>
            <span class="font-mono text-sm text-fg-primary">{{ node.tagName }}</span>
            <span v-if="el.idCls" class="text-xs text-primary-600 font-mono truncate">{{ el.idCls }}</span>
            <div class="flex-1"></div>
            <button 
              @click.stop="$emit('add', el.xpath)"
              class="opacity-0 group-hover:opacity-100 px-2 py-1 text-xs bg-primary-600 text-white rounded hover:bg-primary-700 transition-all"
            >
              + 添加操作
            </button>
          </div>
          
          <!-- Child nodes -->
          <div v-for="child in node.children" :key="child.path" class="ml-4 pl-3 border-l-2 border-neutral-200">
            <div
              v-for="el in child.elements"
              :key="el.xpath"
              class="group flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer hover:bg-primary-50 transition-colors"
              :class="{ 'bg-primary-100 ring-1 ring-primary-200': selectedXpath === el.xpath }"
              @mouseenter="$emit('select', el.xpath)"
              @mouseleave="$emit('select', null)"
              @dblclick="$emit('add', el.xpath)"
            >
              <span class="w-6 h-6 rounded bg-neutral-200 flex items-center justify-center text-xs text-fg-muted font-mono">
                {{ child.tagName.charAt(0).toUpperCase() }}
              </span>
              <span class="font-mono text-sm text-fg-primary">{{ child.tagName }}</span>
              <span v-if="el.idCls" class="text-xs text-primary-600 font-mono truncate">{{ el.idCls }}</span>
              <div class="flex-1"></div>
              <button 
                @click.stop="$emit('add', el.xpath)"
                class="opacity-0 group-hover:opacity-100 px-2 py-1 text-xs bg-primary-600 text-white rounded hover:bg-primary-700 transition-all"
              >
                + 添加操作
              </button>
            </div>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface PageElement {
  xpath: string
  tagName: string
  idCls: string
  rect: { x: number; y: number; width: number; height: number }
  depth: number
}

interface ElementTreeNode {
  path: string
  tagName: string
  children: ElementTreeNode[]
  elements: PageElement[]
}

const props = defineProps<{
  elements: PageElement[]
  selectedXpath: string | null
}>()

defineEmits<{
  select: [xpath: string | null]
  add: [xpath: string]
}>()

// Build element tree
const tree = computed(() => {
  const root: ElementTreeNode = { path: '', tagName: 'root', children: [], elements: [] }
  
  for (const element of props.elements) {
    const parts = element.xpath.split('/').filter(p => p)
    let current = root
    let currentPath = ''
    
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]
      currentPath += '/' + part
      
      let child = current.children.find(c => c.path === currentPath)
      if (!child) {
        child = {
          path: currentPath,
          tagName: part.replace(/\[.+\]$/, ''),
          children: [],
          elements: []
        }
        current.children.push(child)
      }
      
      if (i === parts.length - 1) {
        child.elements.push(element)
      }
      
      current = child
    }
  }
  
  return root.children
})
</script>
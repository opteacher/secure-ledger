<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-300 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition duration-200 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div v-if="visible" class="modal-overlay" @click.self="handleClose">
        <div class="modal-content max-w-4xl animate-slide-up" @click.stop>
          <!-- Header -->
          <div class="flex items-center justify-between mb-5">
            <h3 class="text-lg font-semibold text-fg-primary">选择图标</h3>
            <button @click="handleClose" class="btn-icon" aria-label="关闭">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <!-- Top Bar: Source Dropdown + Search Input + Search Button -->
          <div class="flex items-center gap-2 mb-5">
            <select
              v-model="source"
              class="bg-surface-input border border-surface text-sm rounded-lg px-3 py-2 shrink-0"
            >
              <option value="antd">Ant Design 图标</option>
              <option value="iconfont">Iconfont</option>
              <option value="upload">本地上传</option>
            </select>

            <template v-if="source !== 'upload'">
              <div class="relative flex-1">
                <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-fg-muted pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  v-model="searchKeyword"
                  type="text"
                  :placeholder="source === 'antd' ? '搜索图标名称（如 User, Setting）' : '输入关键词搜索 Iconfont 图标'"
                  class="w-full pl-10 pr-4 py-2 text-sm border border-surface rounded-lg bg-surface-input focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 transition-colors"
                  @keydown.enter="doSearch"
                />
              </div>
              <button @click="doSearch" class="btn-primary px-5 py-2 text-sm">搜索</button>
            </template>
          </div>

          <!-- ─── Ant Design Content ─── -->
          <template v-if="source === 'antd'">
            <div v-if="antPagedIcons.length > 0" class="grid grid-cols-6 gap-4">
              <button
                v-for="name in antPagedIcons"
                :key="name"
                @click="selectAntd(name)"
                class="flex flex-col items-center gap-3 p-5 rounded-xl border border-surface hover:border-primary-300 hover:shadow-soft hover:bg-primary-50 dark:hover:bg-primary-900/30 transition-all duration-200 group"
              >
                <component :is="(Icons as Record<string, any>)[name]" :style="{ fontSize: '40px' }" class="text-fg-secondary group-hover:text-primary-600 transition-colors" />
                <span class="text-xs text-fg-muted group-hover:text-fg-primary text-center leading-tight truncate w-full">{{ formatIconName(name) }}</span>
              </button>
            </div>
            <div v-else class="empty-state py-12">
              <svg class="w-12 h-12 text-neutral-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <p class="text-sm text-fg-muted">未找到匹配的图标</p>
            </div>

            <div v-if="antTotalPages > 1" class="flex items-center justify-between mt-4 pt-3 border-t border-surface">
              <button @click="antPage = Math.max(1, antPage - 1)" :disabled="antPage <= 1" class="btn-secondary px-3 py-1.5 text-sm">上一页</button>
              <span class="text-sm text-fg-muted">第 {{ antPage }} / {{ antTotalPages }} 页</span>
              <button @click="antPage = Math.min(antTotalPages, antPage + 1)" :disabled="antPage >= antTotalPages" class="btn-secondary px-3 py-1.5 text-sm">下一页</button>
            </div>
          </template>

          <!-- ─── Iconfont Content ─── -->
          <template v-if="source === 'iconfont'">
            <div v-if="iconfontError" class="p-3 mb-4 rounded-lg bg-error-50 dark:bg-error-500/10 border border-error-500/20 text-sm text-error-600 flex items-center gap-2">
              <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              {{ iconfontError }}
            </div>
            <div v-if="iconfontResults.length > 0" class="grid grid-cols-6 gap-4">
              <button v-for="icon in iconfontResults" :key="icon.id" @click="selectIconfont(icon)"
                class="flex flex-col items-center gap-3 p-5 rounded-xl border border-surface hover:border-primary-300 hover:shadow-soft hover:bg-primary-50 dark:hover:bg-primary-900/30 transition-all duration-200 group">
                <span class="flex items-center justify-center text-fg-secondary group-hover:text-primary-600" style="font-size:40px" v-html="sanitizeSvg(icon.show_svg)" />
                <span class="text-xs text-fg-muted group-hover:text-fg-primary text-center leading-tight truncate w-full">{{ icon.name }}</span>
              </button>
            </div>
            <div v-else-if="iconfontSearched && !iconfontLoading && !iconfontError" class="empty-state py-12">
              <svg class="w-12 h-12 text-neutral-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              <p class="text-sm text-fg-muted">未找到匹配的图标，请尝试其他关键词</p>
            </div>
            <div v-else-if="!iconfontSearched && !iconfontLoading" class="empty-state py-12">
              <svg class="w-12 h-12 text-neutral-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              <p class="text-sm text-fg-muted">输入关键词搜索 Iconfont 图标</p>
            </div>

            <div v-if="iconfontTotalPages > 1" class="flex items-center justify-between mt-4 pt-3 border-t border-surface">
              <button @click="iconfontPage = Math.max(1, iconfontPage - 1); searchIconfont()" :disabled="iconfontPage <= 1 || iconfontLoading" class="btn-secondary px-3 py-1.5 text-sm">上一页</button>
              <span class="text-sm text-fg-muted">第 {{ iconfontPage }} / {{ iconfontTotalPages }} 页</span>
              <button @click="iconfontPage = Math.min(iconfontTotalPages, iconfontPage + 1); searchIconfont()" :disabled="iconfontPage >= iconfontTotalPages || iconfontLoading" class="btn-secondary px-3 py-1.5 text-sm">下一页</button>
            </div>
          </template>

          <!-- ─── Upload Content ─── -->
          <template v-if="source === 'upload'">
            <div class="upload-area border-2 border-dashed border-surface rounded-xl px-8 py-12 text-center cursor-pointer hover:border-primary-300 hover:bg-primary-50 dark:hover:bg-primary-900/10 transition-colors" @click="openFilePicker" @dragover.prevent @drop.prevent="handleFileDrop">
              <input ref="fileInputRef" type="file" accept="image/png,image/jpeg,image/svg+xml" class="hidden" @change="handleFileChange" />
              <svg v-if="!previewUrl" class="w-10 h-10 text-fg-muted mb-3 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
              <p v-if="!previewUrl" class="text-sm text-fg-muted mb-1">点击或拖拽上传图标文件</p>
              <p v-if="!previewUrl" class="text-xs text-fg-muted">支持 PNG / JPEG / SVG，最大 2MB</p>
              <p v-if="uploadError" class="text-xs text-error-500 mt-2">{{ uploadError }}</p>
              <div v-if="previewUrl" class="flex flex-col items-center gap-3">
                <div class="w-20 h-20 rounded-xl border border-surface bg-surface-page flex items-center justify-center p-3 overflow-hidden"><img :src="previewUrl" class="max-w-full max-h-full object-contain" alt="图标预览" /></div>
                <p class="text-sm text-fg-primary font-medium">{{ uploadFileName }}</p>
                <button @click.stop="resetUpload" class="btn-ghost px-3 py-1.5 text-sm text-fg-muted">重新选择</button>
              </div>
            </div>
            <div v-if="previewUrl" class="flex justify-end gap-3 mt-5">
              <button @click="resetUpload" class="btn-secondary">取消</button>
              <button @click="confirmUpload" class="btn-primary">确认使用</button>
            </div>
          </template>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import * as Icons from '@ant-design/icons-vue'

const emit = defineEmits<{
  'update:visible': [value: boolean]
  select: [iconValue: string]
}>()

defineProps<{ visible: boolean }>()

interface IconfontIcon { id: number; name: string; show_svg: string; font_class: string }

type Source = 'antd' | 'iconfont' | 'upload'
const source = ref<Source>('antd')
const searchKeyword = ref('')

// ─── Ant Design ───
const antAppliedKeyword = ref('')
const antPage = ref(1)
const antPageSize = 24

const antIconNames = computed(() => {
  return Object.keys(Icons).filter(key => {
    return /^[A-Z]\w*(?:Outlined|Filled|TwoTone)$/.test(key)
  }).sort()
})

const antFilteredIcons = computed(() => {
  const q = antAppliedKeyword.value.toLowerCase()
  if (!q) return antIconNames.value
  return antIconNames.value.filter(name => name.toLowerCase().includes(q))
})

const antTotalPages = computed(() => Math.max(1, Math.ceil(antFilteredIcons.value.length / antPageSize)))
const antPagedIcons = computed(() => {
  const start = (antPage.value - 1) * antPageSize
  return antFilteredIcons.value.slice(start, start + antPageSize)
})

function formatIconName(name: string): string {
  return name.replace(/(Outlined|Filled|TwoTone)$/, '').replace(/([a-z])([A-Z])/g, '$1 $2')
}
function selectAntd(name: string): void { emit('select', `antd:${name}`); emit('update:visible', false) }

// ─── Iconfont ───
const iconfontResults = ref<IconfontIcon[]>([])
const iconfontTotal = ref(0)
const iconfontPage = ref(1)
const iconfontError = ref<string | null>(null)
const iconfontLoading = ref(false)
const iconfontSearched = ref(false)
const iconfontPageSize = 24

const iconfontTotalPages = computed(() => Math.max(1, Math.ceil(iconfontTotal.value / iconfontPageSize)))

async function searchIconfont(): Promise<void> {
  const q = searchKeyword.value.trim()
  if (!q) return
  iconfontLoading.value = true; iconfontError.value = null; iconfontSearched.value = true
  try {
    const data = await (window as any).ipc.invoke('iconfont:search', { q, page: iconfontPage.value, pageSize: iconfontPageSize })
    iconfontResults.value = data.icons || []
    iconfontTotal.value = data.pagination.total || 0
  } catch (e: any) {
    iconfontError.value = e.message || '搜索失败：网络或 IPC 错误'
  } finally { iconfontLoading.value = false }
}

function selectIconfont(icon: IconfontIcon): void {
  emit('select', `iconfont:${icon.id}:${sanitizeSvg(icon.show_svg)}`)
  emit('update:visible', false)
}

// ─── Upload ───
const fileInputRef = ref<HTMLInputElement | null>(null)
const previewUrl = ref<string | null>(null)
const uploadFileName = ref('')
const uploadError = ref<string | null>(null)

function openFilePicker(): void { fileInputRef.value?.click() }
function handleFileDrop(e: DragEvent): void {
  const file = e.dataTransfer?.files?.[0]
  if (file) processFile(file)
}
function handleFileChange(e: Event): void {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (file) processFile(file)
}
function processFile(file: File): void {
  uploadError.value = null
  const ext = file.name.split('.').pop()?.toLowerCase()
  if (!['png', 'jpg', 'jpeg', 'svg'].includes(ext || '')) { uploadError.value = '仅支持 PNG、JPEG、SVG 格式'; return }
  if (file.size > 2 * 1024 * 1024) { uploadError.value = '文件大小不能超过 2MB'; return }
  const reader = new FileReader()
  reader.onload = () => { previewUrl.value = reader.result as string; uploadFileName.value = file.name }
  reader.readAsDataURL(file)
}
function resetUpload(): void { previewUrl.value = null; uploadFileName.value = ''; uploadError.value = null }
function confirmUpload(): void {
  if (previewUrl.value) { emit('select', previewUrl.value); emit('update:visible', false) }
}

// ─── Shared ───
function doSearch(): void {
  if (source.value === 'antd') {
    antAppliedKeyword.value = searchKeyword.value
    antPage.value = 1
  } else if (source.value === 'iconfont') {
    iconfontPage.value = 1
    searchIconfont()
  }
}

function sanitizeSvg(svg: string): string {
  return svg
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/on\w+\s*=\s*"[^"]*"/gi, '')
    .replace(/on\w+\s*=\s*'[^']*'/gi, '')
    .replace(/javascript\s*:/gi, '')
}

function handleClose(): void { emit('update:visible', false) }
</script>

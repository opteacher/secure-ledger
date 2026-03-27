<template>
  <div class="modal-overlay" @click.self="close">
    <div class="modal-content" style="width: 700px; max-height: 80vh;">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-lg font-semibold text-fg-primary">上传文件</h3>
        <button @click="close" class="btn-icon">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- 文件列表 -->
      <div class="mb-4">
        <h4 class="text-sm font-medium text-fg-secondary mb-2">待上传文件 ({{ files.length }} 个)</h4>
        <div class="border border-neutral-200 rounded-lg max-h-40 overflow-auto">
          <div v-if="files.length === 0" class="p-4 text-center text-fg-muted text-sm">
            没有选择文件
          </div>
          <div v-else>
            <div 
              v-for="(file, index) in files" 
              :key="index"
              class="flex items-center justify-between px-3 py-2 border-b border-neutral-100 last:border-b-0 hover:bg-neutral-50"
            >
              <div class="flex items-center gap-2 flex-1 min-w-0">
                <svg v-if="file.isFolder" class="w-4 h-4 text-warning-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
                </svg>
                <svg v-else class="w-4 h-4 text-primary-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span class="truncate text-sm text-fg-primary">{{ file.name }}</span>
              </div>
              <span class="text-xs text-fg-muted flex-shrink-0 ml-2">{{ formatSize(file.size) }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 远程目录选择 -->
      <div class="mb-4">
        <h4 class="text-sm font-medium text-fg-secondary mb-2">上传到服务器目录</h4>
        <div class="flex gap-2 mb-2">
          <input 
            v-model="remotePath" 
            type="text" 
            class="flex-1 text-sm" 
            placeholder="/home/user"
          />
        </div>
        
        <!-- 目录列表 -->
        <div class="border border-neutral-200 rounded-lg max-h-48 overflow-auto bg-neutral-50">
          <div v-if="loadingDir" class="p-4 text-center text-fg-muted text-sm">
            加载中...
          </div>
          <div v-else-if="dirError" class="p-4 text-center text-error-500 text-sm">
            {{ dirError }}
          </div>
          <div v-else>
            <!-- 返回上一级 -->
            <div 
              v-if="remotePath && remotePath !== '/'"
              class="px-3 py-2 border-b border-neutral-200 hover:bg-neutral-100 cursor-pointer text-sm flex items-center gap-2 text-fg-muted"
              @click="goToParentDir"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 17l-5-5m0 0l5-5m-5 5h12" />
              </svg>
              <span>返回上一级</span>
            </div>
            <!-- 当前路径 -->
            <div 
              class="px-3 py-2 border-b border-neutral-200 bg-primary-50 text-sm text-primary-700 cursor-pointer hover:bg-primary-100"
              @click="selectPath(remotePath)"
            >
              <svg class="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
              {{ remotePath || '/' }} (使用此目录)
            </div>
            <!-- 空目录提示 -->
            <div v-if="directories.length === 0" class="p-4 text-center text-fg-muted text-sm">
              没有子目录
            </div>
            <!-- 子目录列表 -->
            <div
              v-for="dir in directories"
              :key="dir.name"
              class="px-3 py-2 hover:bg-neutral-100 cursor-pointer text-sm flex items-center gap-2"
              @click="navigateToDir(dir.name)"
            >
              <svg class="w-4 h-4 text-warning-500" fill="currentColor" viewBox="0 0 20 20">
                <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
              </svg>
              <span class="text-fg-primary">{{ dir.name }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 选项 -->
      <div class="mb-4">
        <label class="flex items-center gap-2 cursor-pointer">
          <input 
            type="checkbox" 
            v-model="overwrite" 
            class="w-4 h-4 rounded border-neutral-300 text-primary-600"
          />
          <span class="text-sm text-fg-secondary">覆盖同名文件</span>
        </label>
      </div>

      <!-- 进度条 -->
      <div v-if="uploading" class="mb-4">
        <div class="flex items-center justify-between text-sm mb-1">
          <span class="text-fg-secondary">{{ progress.fileName }}</span>
          <span class="text-fg-muted">{{ progress.fileIndex }}/{{ progress.totalFiles }} - {{ progress.percent }}%</span>
        </div>
        <div class="w-full h-2 bg-neutral-200 rounded-full overflow-hidden">
          <div 
            class="h-full bg-primary-500 transition-all duration-300"
            :style="{ width: progress.percent + '%' }"
          ></div>
        </div>
        <div class="text-xs text-fg-muted mt-1">
          {{ formatSize(progress.bytesTransferred) }} / {{ formatSize(progress.totalBytes) }}
        </div>
      </div>

      <!-- 按钮 -->
      <div class="flex gap-3 justify-end">
        <button @click="close" class="btn-secondary" :disabled="uploading">
          取消
        </button>
        <button 
          @click="startUpload" 
          class="btn-primary" 
          :disabled="uploading || files.length === 0 || !remotePath"
        >
          {{ uploading ? '上传中...' : '开始上传' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, toRaw } from 'vue'
import { sshApi, type SSHConfig, type RemoteFile, type UploadProgress } from '../apis'

interface Props {
  config: SSHConfig
  selectedFiles: { path: string; name: string; size: number; isFolder: boolean }[]
}

const props = defineProps<Props>()
const emit = defineEmits<{
  close: []
  complete: [filesUploaded: number]
}>()

const files = ref<{ path: string; name: string; size: number; isFolder: boolean }[]>([])
const remotePath = ref('/home')
const directories = ref<RemoteFile[]>([])
const overwrite = ref(false)
const loadingDir = ref(false)
const dirError = ref('')
const uploading = ref(false)
const progress = ref<UploadProgress>({
  fileName: '',
  fileIndex: 0,
  totalFiles: 0,
  bytesTransferred: 0,
  totalBytes: 0,
  percent: 0
})

let unsubscribe: (() => void) | null = null

onMounted(() => {
  files.value = props.selectedFiles
  unsubscribe = sshApi.onUploadProgress((p) => {
    progress.value = p
  })
  // 自动加载默认目录
  loadDirectory(remotePath.value)
})

onUnmounted(() => {
  if (unsubscribe) unsubscribe()
})

function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

async function loadDirectory(path: string) {
  loadingDir.value = true
  dirError.value = ''
  
  try {
    // 使用 toRaw 将响应式对象转换为普通对象，避免 IPC 序列化问题
    const config = toRaw(props.config)
    const result = await sshApi.listDir(config, path || '/')
    if (result.success) {
      directories.value = result.files.filter(f => f.isDirectory)
    } else {
      dirError.value = result.message || '加载失败'
      directories.value = []
    }
  } catch (e: any) {
    dirError.value = e.message
    directories.value = []
  } finally {
    loadingDir.value = false
  }
}

function navigateToDir(dirName: string) {
  const newPath = remotePath.value === '/' ? `/${dirName}` : `${remotePath.value}/${dirName}`
  remotePath.value = newPath
  loadDirectory(newPath)
}

function goToParentDir() {
  if (!remotePath.value || remotePath.value === '/') return
  
  // 获取父目录路径
  const parts = remotePath.value.split('/').filter(p => p)
  parts.pop() // 移除最后一个目录
  const parentPath = parts.length === 0 ? '/' : '/' + parts.join('/')
  
  remotePath.value = parentPath
  loadDirectory(parentPath)
}

function selectPath(_path: string) {
    // 路径已选择，无需额外操作
  }

async function startUpload() {
  if (files.value.length === 0 || !remotePath.value) return
  
  uploading.value = true
  progress.value = {
    fileName: '',
    fileIndex: 0,
    totalFiles: 0,
    bytesTransferred: 0,
    totalBytes: 0,
    percent: 0
  }
  
  try {
    // 使用 toRaw 将响应式对象转换为普通对象
    const config = toRaw(props.config)
    for (const file of files.value) {
      const result = await sshApi.uploadWithProgress({
        ...config,
        localPath: file.path,
        remotePath: remotePath.value,
        isFolder: file.isFolder,
        overwrite: overwrite.value
      })
      
      if (!result.success) {
        console.error(`上传失败: ${file.name}`, result.message)
      }
    }
    
    emit('complete', files.value.length)
    close()
  } catch (e: any) {
    console.error('上传失败:', e.message)
  } finally {
    uploading.value = false
  }
}

function close() {
  emit('close')
}
</script>
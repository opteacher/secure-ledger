import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { endpointApi, type Endpoint, type EndpointFull } from '../apis'

export const useEndpointStore = defineStore('endpoint', () => {
  // 状态
  const endpoints = ref<Endpoint[]>([])
  const currentEndpoint = ref<EndpointFull | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  // 计算属性
  const endpointCount = computed(() => endpoints.value.length)

  // 加载所有登录端
  async function loadEndpoints() {
    loading.value = true
    error.value = null

    try {
      endpoints.value = await endpointApi.list()
    } catch (e: any) {
      error.value = e.message
    } finally {
      loading.value = false
    }
  }

  // 加载单个登录端详情
  async function loadEndpoint(id: number) {
    loading.value = true
    error.value = null

    try {
      currentEndpoint.value = await endpointApi.get(id)
      return currentEndpoint.value
    } catch (e: any) {
      error.value = e.message
      return null
    } finally {
      loading.value = false
    }
  }

  // 创建登录端
  async function createEndpoint(data: Partial<Endpoint>) {
    loading.value = true
    error.value = null

    try {
      const endpoint = await endpointApi.create(data)
      endpoints.value.unshift(endpoint)
      return endpoint
    } catch (e: any) {
      error.value = e.message
      return null
    } finally {
      loading.value = false
    }
  }

  // 更新登录端
  async function updateEndpoint(id: number, updates: Partial<Endpoint>) {
    loading.value = true
    error.value = null

    try {
      const success = await endpointApi.update(id, updates)
      if (success) {
        const index = endpoints.value.findIndex(e => e.id === id)
        if (index !== -1) {
          endpoints.value[index] = { ...endpoints.value[index], ...updates }
        }
        if (currentEndpoint.value?.id === id) {
          currentEndpoint.value = { ...currentEndpoint.value, ...updates }
        }
      }
      return success
    } catch (e: any) {
      error.value = e.message
      return false
    } finally {
      loading.value = false
    }
  }

  // 删除登录端
  async function deleteEndpoint(id: number) {
    loading.value = true
    error.value = null

    try {
      const success = await endpointApi.delete(id)
      if (success) {
        endpoints.value = endpoints.value.filter(e => e.id !== id)
        if (currentEndpoint.value?.id === id) {
          currentEndpoint.value = null
        }
      }
      return success
    } catch (e: any) {
      error.value = e.message
      return false
    } finally {
      loading.value = false
    }
  }

  // 导出登录端
  async function exportEndpoints(ids: number[]) {
    loading.value = true
    error.value = null

    try {
      const data = await endpointApi.export(ids)
      
      // 创建下载
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `endpoints-${Date.now()}.json`
      a.click()
      URL.revokeObjectURL(url)
      
      return true
    } catch (e: any) {
      error.value = e.message
      return false
    } finally {
      loading.value = false
    }
  }

  // 导入登录端
  async function importEndpoints(data: EndpointFull[]) {
    loading.value = true
    error.value = null

    try {
      const result = await endpointApi.import(data)
      if (result.success > 0) {
        await loadEndpoints()
      }
      return result
    } catch (e: any) {
      error.value = e.message
      return { success: 0, failed: data.length }
    } finally {
      loading.value = false
    }
  }

  return {
    endpoints,
    currentEndpoint,
    loading,
    error,
    endpointCount,
    loadEndpoints,
    loadEndpoint,
    createEndpoint,
    updateEndpoint,
    deleteEndpoint,
    exportEndpoints,
    importEndpoints
  }
})
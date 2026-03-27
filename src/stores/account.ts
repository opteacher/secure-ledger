import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { accountApi } from '../apis'

export const useAccountStore = defineStore('account', () => {
  // 状态
  const token = ref<string | null>(localStorage.getItem('token'))
  const username = ref<string | null>(localStorage.getItem('username'))
  const loading = ref(false)
  const error = ref<string | null>(null)

  // 计算属性
  const isLoggedIn = computed(() => !!token.value)

  // 检查认证状态
  async function checkAuth() {
    if (!token.value) {
      return false
    }

    try {
      const result = await accountApi.verify(token.value)
      if (result.valid) {
        username.value = result.username || null
        return true
      } else {
        logout()
        return false
      }
    } catch {
      logout()
      return false
    }
  }

  // 创建账户
  async function createAccount(user: string, pass: string) {
    loading.value = true
    error.value = null

    try {
      const result = await accountApi.create(user, pass)
      if (result.success) {
        // 创建成功后自动登录
        return await login(user, pass)
      }
      return false
    } catch (e: any) {
      error.value = e.message
      return false
    } finally {
      loading.value = false
    }
  }

  // 登录
  async function login(user: string, pass: string) {
    loading.value = true
    error.value = null

    try {
      const result = await accountApi.login(user, pass)
      token.value = result.token
      username.value = result.username
      
      localStorage.setItem('token', result.token)
      localStorage.setItem('username', result.username)
      
      return true
    } catch (e: any) {
      error.value = e.message
      return false
    } finally {
      loading.value = false
    }
  }

  // 登出
  function logout() {
    token.value = null
    username.value = null
    localStorage.removeItem('token')
    localStorage.removeItem('username')
  }

  // 修改密码
  async function changePassword(oldPass: string, newPass: string) {
    loading.value = true
    error.value = null

    try {
      const result = await accountApi.changePassword(oldPass, newPass)
      return result.success
    } catch (e: any) {
      error.value = e.message
      return false
    } finally {
      loading.value = false
    }
  }

  // 检查是否有账户
  async function checkHasAccount() {
    try {
      const result = await accountApi.hasAccount()
      return result
    } catch {
      return false
    }
  }

  return {
    token,
    username,
    loading,
    error,
    isLoggedIn,
    checkAuth,
    checkHasAccount,
    createAccount,
    login,
    logout,
    changePassword
  }
})
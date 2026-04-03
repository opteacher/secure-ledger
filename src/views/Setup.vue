<template>
  <div class="min-h-screen flex items-center justify-center bg-gradient-to-br from-neutral-50 via-white to-primary-50/30 px-4">
    <div class="w-full max-w-md animate-fade-in">
      <!-- Logo & Title -->
      <div class="text-center mb-10">
        <div class="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-600 shadow-glow mb-6">
          <svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <h1 class="text-3xl font-bold text-fg-primary mb-2 font-display">欢迎使用账号管理器</h1>
        <p class="text-fg-muted">首次使用，请创建您的账户</p>
      </div>
      <!-- Setup Card -->
      </div>

      <!-- Setup Card -->
      <div class="card">
        <form @submit.prevent="handleSetup" class="space-y-5">
          <div class="input-group">
            <label class="input-label">用户名</label>
            <input
              v-model="username"
              type="text"
              class="w-full"
              placeholder="请输入用户名"
              required
            />
            <p class="input-hint">用于登录应用</p>
          </div>

          <div class="input-group">
            <label class="input-label">密码</label>
            <input
              v-model="password"
              type="password"
              class="w-full"
              placeholder="请输入密码"
              required
              minlength="6"
            />
            <p class="input-hint">至少6位字符，用于加密您的数据</p>
          </div>

          <div class="input-group">
            <label class="input-label">确认密码</label>
            <input
              v-model="confirmPassword"
              type="password"
              class="w-full"
              placeholder="请再次输入密码"
              required
            />
          </div>

          <div v-if="error" class="input-error text-center">
            {{ error }}
          </div>

          <button
            type="submit"
            class="btn-primary w-full"
            :disabled="loading"
          >
            <svg v-if="loading" class="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            {{ loading ? '创建中...' : '创建账户' }}
          </button>
        </form>
      </div>

      <!-- Footer -->
      <p class="text-center text-sm text-fg-muted mt-8">
        您的数据将被安全加密存储在本地
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAccountStore } from '../stores/account'

const router = useRouter()
const accountStore = useAccountStore()

const username = ref('')
const password = ref('')
const confirmPassword = ref('')
const loading = ref(false)
const error = ref('')

async function handleSetup() {
  if (password.value !== confirmPassword.value) {
    error.value = '两次密码输入不一致'
    return
  }

  if (password.value.length < 6) {
    error.value = '密码至少需要6位字符'
    return
  }

  loading.value = true
  error.value = ''

  try {
    const success = await accountStore.createAccount(username.value, password.value)
    if (success) {
      router.push('/home')
    } else {
      error.value = accountStore.error || '创建账户失败'
    }
  } catch (e: any) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}
</script>
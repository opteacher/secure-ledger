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
        <h1 class="text-3xl font-bold text-fg-primary mb-2 font-display">密钥终端</h1>
        <p class="text-fg-muted">Secure Ledger</p>
      </div>
      
      <!-- Login/Register Card -->
      <div class="card">
        <!-- Tab Switcher -->
        <div class="flex mb-6 bg-neutral-100 rounded-lg p-1">
          <button 
            @click="isRegister = false" 
            class="flex-1 py-2 text-sm font-medium rounded-md transition-colors"
            :class="!isRegister ? 'bg-white text-primary-600 shadow-sm' : 'text-fg-muted'"
          >登录</button>
          <button 
            @click="isRegister = true" 
            class="flex-1 py-2 text-sm font-medium rounded-md transition-colors"
            :class="isRegister ? 'bg-white text-primary-600 shadow-sm' : 'text-fg-muted'"
          >注册</button>
        </div>
        
        <!-- Login Form -->
        <form v-if="!isRegister" @submit.prevent="handleLogin" class="space-y-5">
          <div class="input-group">
            <label class="input-label">用户名</label>
            <input
              v-model="username"
              type="text"
              class="w-full"
              placeholder="请输入用户名"
              required
            />
          </div>

          <div class="input-group">
            <label class="input-label">密码</label>
            <input
              v-model="password"
              type="password"
              class="w-full"
              placeholder="请输入密码"
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
            {{ loading ? '登录中...' : '登录' }}
          </button>
        </form>
        
        <!-- Register Form -->
        <form v-else @submit.prevent="handleRegister" class="space-y-5">
          <div class="input-group">
            <label class="input-label">用户名</label>
            <input
              v-model="username"
              type="text"
              class="w-full"
              placeholder="请输入用户名"
              required
            />
          </div>

          <div class="input-group">
            <label class="input-label">密码</label>
            <input
              v-model="password"
              type="password"
              class="w-full"
              placeholder="请输入密码"
              required
            />
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
            {{ loading ? '注册中...' : '注册' }}
          </button>
        </form>
      </div>

      <!-- Footer -->
      <p class="text-center text-sm text-fg-muted mt-8">
        安全的本地账户密码管理
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

const isRegister = ref(false)
const username = ref('')
const password = ref('')
const confirmPassword = ref('')
const loading = ref(false)
const error = ref('')

async function handleLogin() {
  loading.value = true
  error.value = ''

  try {
    const success = await accountStore.login(username.value, password.value)
    if (success) {
      router.push('/home')
    } else {
      error.value = accountStore.error || '登录失败'
    }
  } catch (e: any) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

async function handleRegister() {
  if (password.value !== confirmPassword.value) {
    error.value = '两次输入的密码不一致'
    return
  }
  
  loading.value = true
  error.value = ''

  try {
    const success = await accountStore.createAccount(username.value, password.value)
    if (success) {
      router.push('/home')
    } else {
      error.value = accountStore.error || '注册失败'
    }
  } catch (e: any) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

</script>

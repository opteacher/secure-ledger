<template>
  <div class="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
    <!-- 背景装饰 -->
    <div class="absolute inset-0 overflow-hidden">
      <div class="absolute -top-40 -right-40 w-80 h-80 bg-primary-500/10 rounded-full blur-3xl"></div>
      <div class="absolute -bottom-40 -left-40 w-96 h-96 bg-primary-600/10 rounded-full blur-3xl"></div>
    </div>
    
    <!-- 锁定卡片 -->
    <div class="relative z-10 w-full max-w-md mx-4">
      <div class="bg-white/10 backdrop-blur-xl rounded-3xl shadow-2xl p-8 border border-white/20">
        <!-- Logo -->
        <div class="text-center mb-8">
          <div class="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center shadow-lg shadow-primary-500/30">
            <svg class="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h1 class="text-2xl font-bold text-white">应用已锁定</h1>
          <p class="text-sm text-gray-400 mt-2">
            {{ hasPassword ? '请输入6位数字密码解锁' : '按回车键解锁' }}
          </p>
        </div>
        
        <!-- 6位密码输入框 -->
        <div class="flex justify-center gap-3 mb-6">
          <input
            v-for="i in 6"
            :key="i"
            :ref="el => { if (el) inputs[i-1] = el as HTMLInputElement }"
            v-model="digits[i-1]"
            type="password"
            maxlength="1"
            @input="handleInput(i-1, $event)"
            @keydown="handleKeydown(i-1, $event)"
            @paste="handlePaste"
            class="w-12 h-14 text-center text-2xl font-bold text-white bg-white/5 border-2 rounded-xl focus:border-primary-500 focus:bg-white/10 transition-all outline-none"
            :class="[
              digits[i-1] ? 'border-primary-500 bg-primary-500/20' : 'border-white/30 hover:border-white/50'
            ]"
          />
        </div>
        
        <!-- 错误提示 -->
        <Transition name="shake">
          <p v-if="errorMessage" class="text-sm text-red-400 text-center mb-4">{{ errorMessage }}</p>
        </Transition>
        
        <!-- 提示文字 -->
        <p v-if="hasPassword" class="text-xs text-gray-500 text-center">
          连续输错 {{ maxAttempts }} 次将需要等待 {{ lockoutTime }} 秒
        </p>
        
        <!-- 忘记密码链接 -->
        <p class="text-xs text-center mt-4">
          <a 
            href="javascript:;" 
            @click="handleForgotPassword"
            class="text-primary-400 hover:text-primary-300 transition-colors"
          >
            忘记密码，联系开发者
          </a>
        </p>
      </div>
      
      <!-- 版本信息 -->
      <p class="text-center text-xs text-gray-600 mt-6">密钥终端 v1.0.4</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { appLockApi } from '../apis'

const router = useRouter()

// 是否设置了密码
const hasPassword = ref(true)
// 6位密码
const digits = ref(['', '', '', '', '', ''])
const inputs = ref<(HTMLInputElement | null)[]>([])
const errorMessage = ref('')
const maxAttempts = 3
const lockoutTime = 30
let attempts = 0
let lockoutUntil = 0

// 初始化时检查是否设置了密码
onMounted(async () => {
  try {
    const settings = await appLockApi.getSettings()
    hasPassword.value = settings.has_password
    
    nextTick(() => {
      inputs.value[0]?.focus()
    })
  } catch (e) {
    console.error('Failed to get lock settings:', e)
  }
})

// 处理输入
function handleInput(index: number, event: Event) {
  const input = event.target as HTMLInputElement
  const value = input.value // 保留任意字符
  
  if (value) {
    digits.value[index] = value.slice(-1) // 只取最后一位
    
    // 自动跳到下一个输入框
    if (index < 5 && value) {
      nextTick(() => {
        inputs.value[index + 1]?.focus()
      })
    }
    
    // 检查是否输入完成（只有有密码时才验证）
    if (hasPassword.value && (index === 5 || (index < 5 && digits.value.every(d => d)))) {
      checkPassword()
    }
  }
}

// 处理按键
function handleKeydown(index: number, event: KeyboardEvent) {
  // 无密码时，回车直接解锁
  if (event.key === 'Enter' && !hasPassword.value) {
    unlockWithoutPassword()
    return
  }
  
  // 退格键处理
  if (event.key === 'Backspace') {
    if (!digits.value[index] && index > 0) {
      // 当前为空，跳到前一个并清除
      digits.value[index - 1] = ''
      nextTick(() => {
        inputs.value[index - 1]?.focus()
      })
    } else {
      // 清除当前
      digits.value[index] = ''
    }
    event.preventDefault()
  }
  
  // 回车键
  if (event.key === 'Enter') {
    checkPassword()
  }
  
  // 方向键
  if (event.key === 'ArrowLeft' && index > 0) {
    nextTick(() => inputs.value[index - 1]?.focus())
  }
  if (event.key === 'ArrowRight' && index < 5) {
    nextTick(() => inputs.value[index + 1]?.focus())
  }
}

// 处理粘贴
function handlePaste(event: ClipboardEvent) {
  event.preventDefault()
  const pastedText = event.clipboardData?.getData('text') || ''
  const chars = pastedText.slice(0, 6)  // 保留任意字符
  
  for (let i = 0; i < chars.length; i++) {
    digits.value[i] = chars[i]
  }
  
  // 聚焦到下一个空位或最后一位
  const nextEmpty = digits.value.findIndex(d => !d)
  const focusIndex = nextEmpty === -1 ? 5 : nextEmpty
  nextTick(() => inputs.value[focusIndex]?.focus())
  
  // 如果填满则自动验证（只有有密码时）
  if (hasPassword.value && chars.length === 6) {
    checkPassword()
  }
}

// 检查密码
async function checkPassword() {
  const password = digits.value.join('')
  
  if (password.length !== 6) {
    showError('请输入完整的6位密码')
    return
  }
  
  // 检查是否被锁定
  if (lockoutUntil > Date.now()) {
    const remaining = Math.ceil((lockoutUntil - Date.now()) / 1000)
    showError(`请等待 ${remaining} 秒后再试`)
    return
  }
  
  try {
    const result = await appLockApi.verifyPassword(password)
    if (result.valid) {
      // 解锁成功，先更新数据库状态
      await appLockApi.unlock()
      // 再返回首页
      router.push('/home')
    } else {
      attempts++
      if (attempts >= maxAttempts) {
        // 锁定30秒
        lockoutUntil = Date.now() + lockoutTime * 1000
        showError(`输错次数过多，请等待 ${lockoutTime} 秒`)
        attempts = 0
      } else {
        showError(`密码错误，还剩 ${maxAttempts - attempts} 次机会`)
      }
      // 清空输入
      digits.value = ['', '', '', '', '', '']
      nextTick(() => inputs.value[0]?.focus())
    }
  } catch (e: any) {
    showError('验证失败: ' + e.message)
  }
}

// 无密码解锁
async function unlockWithoutPassword() {
  try {
    await appLockApi.unlock()
    router.push('/home')
  } catch (e: any) {
    showError('解锁失败: ' + e.message)
  }
}

// 忘记密码
async function handleForgotPassword() {
  try {
    const result = await appLockApi.sendUnlockRequest()
    if (result.success) {
      alert('邮件已发送，请联系开发者处理。')
    } else {
      showError(result.message || '发送失败')
    }
  } catch (e: any) {
    showError('发送失败: ' + e.message)
  }
}

// 显示错误
function showError(msg: string) {
  errorMessage.value = msg
  setTimeout(() => {
    errorMessage.value = ''
  }, 3000)
}
</script>

<style scoped>
input::-webkit-outer-spin-button,
input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

input[type=number] {
  -moz-appearance: textfield;
}

/* 抖动动画 */
.shake-enter-active {
  animation: shake 0.5s ease-in-out;
}

@keyframes shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-10px); }
  50% { transform: translateX(10px); }
  75% { transform: translateX(-10px); }
}
</style>
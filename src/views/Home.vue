<template>
  <div class="flex h-screen bg-neutral-50">
    <!-- Main Content -->
    <main class="flex-1 overflow-auto">
      <!-- Header -->
      <header class="bg-white/80 backdrop-blur-md border-b border-neutral-200 sticky top-0 z-10">
        <div class="px-8 py-5 flex items-center justify-between">
          <!-- Logo - 点击刷新列表 -->
          <a href="#" @click.prevent="refreshList" class="flex items-center gap-3 hover:opacity-80 transition-opacity cursor-pointer" title="点击刷新列表">
            <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center shadow-glow">
              <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <div>
              <h1 class="text-lg font-bold text-fg-primary font-display">密钥终端</h1>
              <p class="text-xs text-fg-muted">登录端管理</p>
            </div>
          </a>
          <div class="flex gap-3 items-center">
            <!-- 搜索框 -->
            <div class="relative">
              <svg class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-fg-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                v-model="searchKeyword"
                type="text"
                placeholder="搜索登录端..."
                class="pl-9 pr-4 py-2 w-56 text-sm rounded-lg border border-neutral-200 focus:border-primary-400 focus:ring-1 focus:ring-primary-400 outline-none transition-all"
              />
              <button
                v-if="searchKeyword"
                @click="searchKeyword = ''"
                class="absolute right-2 top-1/2 -translate-y-1/2 text-fg-muted hover:text-fg-primary"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <button @click="showSettingsModal = true" class="btn-secondary" title="设置">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              设置
            </button>
            <router-link to="/endpoint/new" class="btn-primary">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
              </svg>
              新建登录端
            </router-link>
          </div>
        </div>
      </header>

      <!-- Content -->
      <div class="p-8">
        <!-- Loading State -->
        <div v-if="loading" class="flex items-center justify-center py-20">
          <div class="typing-indicator">
            <span></span>
            <span></span>
            <span></span>
          </div>
        </div>

        <!-- Empty State -->
        <div v-else-if="filteredEndpoints.length === 0 && endpoints.length > 0" class="empty-state">
          <div class="w-20 h-20 rounded-2xl bg-neutral-100 flex items-center justify-center mb-6">
            <svg class="w-10 h-10 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <h3 class="text-lg font-medium text-fg-primary mb-2">未找到匹配的登录端</h3>
          <p class="text-fg-muted mb-6">尝试使用其他关键词搜索</p>
          <button @click="searchKeyword = ''" class="btn-secondary">
            清除搜索
          </button>
        </div>

        <div v-else-if="endpoints.length === 0" class="empty-state">
          <div class="w-20 h-20 rounded-2xl bg-neutral-100 flex items-center justify-center mb-6">
            <svg class="w-10 h-10 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
          </div>
          <h3 class="text-lg font-medium text-fg-primary mb-2">暂无登录端</h3>
          <p class="text-fg-muted mb-6">创建您的第一个登录端开始管理账户</p>
          <router-link to="/endpoint/new" class="btn-primary">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
            </svg>
            创建第一个登录端
          </router-link>
        </div>

        <!-- Endpoint List -->
        <div v-else class="grid gap-4">
          <div
            v-for="endpoint in filteredEndpoints"
            :key="endpoint.id"
            class="card-hover group"
            @click="router.push(`/endpoint/${endpoint.id}`)"
          >
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-4">
                <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-100 to-primary-50 flex items-center justify-center text-primary-600 font-medium text-lg">
                  {{ endpoint.icon || endpoint.name.charAt(0).toUpperCase() }}
                </div>
                <div>
                  <h3 class="font-semibold text-fg-primary">{{ endpoint.name }}</h3>
                  <p class="text-sm text-fg-muted flex items-center gap-1.5">
                    <span class="w-1.5 h-1.5 rounded-full" :class="endpoint.login_type === 'web' ? 'bg-primary-400' : 'bg-success-500'"></span>
                    {{ endpoint.login_type === 'web' ? '网页登录' : 'SSH登录' }}
                  </p>
                </div>
              </div>

              <div class="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  @click.stop="executeLogin(endpoint)"
                  class="btn-primary text-sm"
                  :disabled="executingId === endpoint.id"
                >
                  <svg v-if="executingId === endpoint.id" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  {{ executingId === endpoint.id ? '执行中' : '执行登录' }}
                </button>
                <!-- 上传按钮组 -->
                <div v-if="endpoint.login_type === 'ssh'" class="flex">
                  <button
                    @click.stop="startUpload(endpoint, false)"
                    class="btn-secondary text-sm rounded-r-none border-r-0"
                    title="上传文件"
                  >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                    上传文件
                  </button>
                  <button
                    @click.stop="startUpload(endpoint, true)"
                    class="btn-secondary text-sm rounded-l-none"
                    title="上传文件夹"
                  >
                    夹
                  </button>
                </div>
                <button
                  @click.stop="confirmDelete(endpoint.id)"
                  class="btn-icon text-error-500 hover:text-error-600 hover:bg-error-50"
                  title="删除"
                >
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>

    <!-- Chrome Selection Modal -->
    <div v-if="showChromeModal" class="modal-overlay" @click.self="showChromeModal = false">
      <div class="modal-content">
        <div class="flex items-center justify-between mb-6">
          <h3 class="text-lg font-semibold text-fg-primary">选择浏览器</h3>
          <button @click="showChromeModal = false" class="btn-icon">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div v-if="chromeList.length === 0" class="empty-state py-8">
          <p class="text-fg-muted">未检测到浏览器</p>
        </div>

        <div v-else class="space-y-2">
          <button
            v-for="chrome in chromeList"
            :key="chrome.path"
            class="w-full text-left p-4 rounded-xl border border-neutral-200 hover:border-primary-300 hover:bg-primary-50/50 transition-all cursor-pointer"
            @click="selectChrome(chrome.path)"
          >
            <div class="font-medium text-fg-primary">{{ chrome.name }}</div>
            <div class="text-sm text-fg-muted mt-0.5 truncate" :title="chrome.path">{{ chrome.path }}</div>
          </button>
        </div>

        <button @click="showChromeModal = false" class="btn-secondary w-full mt-6">
          取消
        </button>
      </div>
    </div>

    <!-- Terminal Selection Modal -->
    <div v-if="showTerminalModal" class="modal-overlay" @click.self="showTerminalModal = false">
      <div class="modal-content">
        <div class="flex items-center justify-between mb-6">
          <h3 class="text-lg font-semibold text-fg-primary">选择终端工具</h3>
          <button @click="showTerminalModal = false" class="btn-icon">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div v-if="terminalList.length === 0" class="empty-state py-8">
          <p class="text-fg-muted">未检测到终端工具</p>
        </div>

        <div v-else class="space-y-2">
          <button
            v-for="terminal in terminalList"
            :key="terminal.id"
            @click="selectTerminal(terminal)"
            class="w-full flex items-center gap-4 p-4 rounded-lg border border-neutral-200 hover:border-primary-500 hover:bg-primary-50 transition-all text-left"
          >
            <div class="w-10 h-10 rounded-lg bg-neutral-100 flex items-center justify-center">
              <svg class="w-6 h-6 text-neutral-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div class="flex-1">
              <div class="font-medium text-fg-primary">{{ terminal.name }}</div>
              <div class="text-sm text-fg-muted mt-0.5 truncate">{{ terminal.path }}</div>
            </div>
          </button>
        </div>

        <button @click="showTerminalModal = false" class="btn-secondary w-full mt-6">
          取消
        </button>
      </div>
    </div>

    <!-- Upload Modal -->
    <UploadModal
      v-if="showUploadModal && uploadConfig"
      :config="uploadConfig"
      :selectedFiles="uploadFiles"
      @close="showUploadModal = false"
      @complete="onUploadComplete"
    />

    <!-- Settings Sidebar -->
    <Transition name="sidebar">
      <div v-if="showSettingsModal" class="fixed inset-0 z-50">
        <!-- Backdrop - 点击关闭 -->
        <div class="absolute inset-0 bg-black/30 backdrop-blur-sm" @click="showSettingsModal = false"></div>
        
        <!-- Sidebar Panel -->
        <div class="absolute right-0 top-0 h-full w-[520px] bg-white shadow-2xl flex flex-col overflow-hidden">
          <!-- Header -->
          <div class="flex items-center justify-between px-6 py-5 border-b border-neutral-200 bg-white">
            <h3 class="text-lg font-semibold text-fg-primary">设置</h3>
            <button @click="showSettingsModal = false" class="btn-icon">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          <!-- Content -->
          <div class="flex-1 overflow-y-auto p-6">
            <!-- App Lock Settings -->
            <div class="mb-6">
              <h4 class="text-sm font-medium text-fg-secondary mb-3 flex items-center gap-2">
                <svg class="w-4 h-4 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                应用锁定
              </h4>
              <div class="space-y-3">
                <!-- 启用开关 -->
                <div class="flex items-center justify-between p-3 rounded-lg bg-neutral-50">
                  <div>
                    <p class="text-sm font-medium text-fg-primary">启用自动锁定</p>
                    <p class="text-xs text-fg-muted">空闲一段时间后自动锁定应用</p>
                  </div>
                  <button 
                    @click="toggleLockEnabled" 
                    :class="lockSettings?.is_enabled ? 'bg-primary-500' : 'bg-gray-300'"
                    class="relative w-11 h-6 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
                  >
                    <span 
                      :class="lockSettings?.is_enabled ? 'translate-x-5' : 'translate-x-1'"
                      class="absolute top-1 left-0 w-4 h-4 bg-white rounded-full shadow transition-transform"
                    ></span>
                  </button>
                </div>
                
                <!-- 活动时长 -->
                <div class="p-3 rounded-lg bg-neutral-50" :class="{ 'opacity-50': !lockSettings?.is_enabled }">
                  <div class="flex items-center justify-between">
                    <div>
                      <p class="text-sm font-medium text-fg-primary">活动时长</p>
                      <p class="text-xs text-fg-muted">无操作多久后自动锁定</p>
                    </div>
                    <select 
                      v-model.number="lockDelayMinutes" 
                      @change="updateLockDelay"
                      :disabled="!lockSettings?.is_enabled"
                      class="px-3 py-1.5 text-sm rounded-lg border border-neutral-300 focus:border-primary-500 focus:outline-none disabled:bg-gray-100 disabled:cursor-not-allowed"
                    >
                      <option :value="0.5">30 秒</option>
                      <option :value="1">1 分钟</option>
                      <option :value="3">3 分钟</option>
                      <option :value="5">5 分钟</option>
                      <option :value="10">10 分钟</option>
                      <option :value="15">15 分钟</option>
                      <option :value="30">30 分钟</option>
                    </select>
                  </div>
                </div>
                
                <!-- 锁定密码 -->
                <div class="p-3 rounded-lg bg-neutral-50" :class="{ 'opacity-50': !lockSettings?.is_enabled }">
                  <div class="flex items-center justify-between mb-2">
                    <div>
                      <p class="text-sm font-medium text-fg-primary">锁定密码</p>
                      <p class="text-xs text-fg-muted">{{ lockSettings?.has_password ? '已设置6位密码' : '未设置密码，输入后自动保存' }}</p>
                    </div>
                    <button 
                      v-if="lockSettings?.has_password"
                      @click="clearLockPassword"
                      :disabled="!lockSettings?.is_enabled"
                      class="text-sm text-red-600 hover:text-red-700 disabled:text-gray-400 disabled:cursor-not-allowed"
                    >
                      清除
                    </button>
                  </div>
                  
                  <!-- 密码输入 -->
                  <input 
                    v-model="lockPassword" 
                    type="password"
                    maxlength="6"
                    :placeholder="lockSettings?.has_password ? '输入6位密码修改' : '输入6位密码'"
                    :disabled="!lockSettings?.is_enabled"
                    @blur="saveLockPasswordAuto"
                    class="w-full px-3 py-2 text-sm rounded-lg border border-neutral-300 focus:border-primary-500 focus:outline-none disabled:bg-gray-100 disabled:cursor-not-allowed tracking-[0.3em]"
                  />
                  <p v-if="lockPasswordError" class="text-xs text-red-500 mt-1">{{ lockPasswordError }}</p>
                </div>
              </div>
            </div>

            <!-- Data Management -->
            <div class="mb-6">
              <h4 class="text-sm font-medium text-fg-secondary mb-3 flex items-center gap-2">
                <svg class="w-4 h-4 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
                </svg>
                数据管理
              </h4>
              <div class="space-y-2">
                <div class="flex items-center justify-between p-3 rounded-lg bg-neutral-50">
                  <div>
                    <p class="text-sm font-medium text-fg-primary">导出数据</p>
                    <p class="text-xs text-fg-muted">导出所有登录端数据</p>
                  </div>
                  <button @click="handleExportAll" class="btn-secondary text-sm">导出</button>
                </div>
                <div class="flex items-center justify-between p-3 rounded-lg bg-neutral-50">
                  <div>
                    <p class="text-sm font-medium text-fg-primary">导入数据</p>
                    <p class="text-xs text-fg-muted">从JSON文件导入</p>
                  </div>
                  <div>
                    <input type="file" accept=".json" @change="handleImport" class="hidden" ref="importInput" />
                    <button @click="($refs.importInput as HTMLInputElement).click()" class="btn-secondary text-sm">导入</button>
                  </div>
                </div>
              </div>
            </div>

            <!-- App Config -->
            <div class="mb-6">
              <h4 class="text-sm font-medium text-fg-secondary mb-3 flex items-center gap-2">
                <svg class="w-4 h-4 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                应用配置
              </h4>
              <div class="space-y-2">
                <div class="p-3 rounded-lg bg-neutral-50">
                  <div class="flex items-center justify-between mb-2">
                    <div>
                      <p class="text-sm font-medium text-fg-primary">数据库文件</p>
                      <p class="text-xs text-fg-muted">数据存储位置</p>
                    </div>
                    <button @click="openDatabaseFolder" class="btn-secondary text-sm">
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                      打开
                    </button>
                  </div>
                  <div class="p-2 rounded bg-white border border-neutral-200">
                    <p class="text-xs text-fg-muted break-all font-mono">{{ databasePath || '加载中...' }}</p>
                  </div>
                </div>
                
                <div class="p-3 rounded-lg bg-neutral-50">
                  <div class="flex items-center justify-between mb-2">
                    <div>
                      <p class="text-sm font-medium text-fg-primary">日志文件</p>
                      <p class="text-xs text-fg-muted">应用运行日志</p>
                    </div>
                    <div class="flex gap-2">
                      <button @click="showLogContent" class="btn-secondary text-sm">查看日志</button>
                      <button @click="openLogFolder" class="btn-secondary text-sm">打开目录</button>
                    </div>
                  </div>
                  <div class="p-2 rounded bg-white border border-neutral-200">
                    <p class="text-xs text-fg-muted break-all font-mono">{{ logPath || '加载中...' }}</p>
                  </div>
                </div>
              </div>
            </div>

<!-- Browser Config -->
            <div class="mb-6">
              <div class="flex items-center justify-between mb-3">
                <h4 class="text-sm font-medium text-fg-secondary flex items-center gap-2">
                  <svg class="w-4 h-4 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                  </svg>
                  浏览器管理
                </h4>
                <button @click="detectAndAddBrowsers" class="text-fg-muted hover:text-primary-500 transition-colors" title="自动检测添加">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
              </div>
              <div class="space-y-2">
                <!-- 浏览器列表 -->
                <div v-for="browser in browserList" :key="browser.id" 
                     class="p-3 rounded-lg bg-neutral-50">
                  <div class="flex items-center justify-between">
                    <div class="flex items-center gap-3 flex-1 min-w-0">
                      <div class="w-8 h-8 rounded-lg bg-primary-100 flex items-center justify-center flex-shrink-0">
                        <svg class="w-4 h-4 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9" />
                        </svg>
                      </div>
                      <div class="flex-1 min-w-0">
                        <p class="text-sm font-medium text-fg-primary">{{ browser.name }}</p>
                        <p class="text-xs text-fg-muted truncate" :title="browser.path">{{ browser.path }}</p>
                        <!-- Chrome 版本显示 -->
                        <p v-if="browser.chrome_version" class="text-xs text-fg-muted mt-0.5">
                          Chrome 内核: {{ browser.chrome_version }}
                        </p>
                      </div>
                    </div>
                    <div class="flex items-center gap-2 flex-shrink-0 ml-2">
                      <!-- Puppeteer 版本选择器 -->
                      <select 
                        v-model="browser.puppeteer_version" 
                        @change="updateBrowserPuppeteerVersion(browser)"
                        class="text-xs px-2 py-1 rounded border border-neutral-300 bg-white focus:border-primary-500 focus:outline-none"
                        title="Puppeteer 版本设置"
                      >
                        <option value="auto">自动</option>
                        <option value="high">高版本</option>
                        <option value="low">低版本</option>
                      </select>
                      <button @click="toggleBrowserStatus(browser)" 
                              :class="browser.is_enabled ? 'bg-primary-100 text-primary-700' : 'bg-gray-100 text-gray-500'"
                              class="text-xs px-2 py-1 rounded transition-colors">
                        {{ browser.is_enabled ? '启用' : '禁用' }}
                      </button>
                      <button @click="deleteBrowser(browser.id)" 
                              class="text-xs px-2 py-1 rounded bg-red-50 text-red-600 hover:bg-red-100 transition-colors">
                        删除
                      </button>
                    </div>
                  </div>
                  <!-- Puppeteer 版本说明 -->
                  <div class="mt-2 text-xs text-fg-muted pl-11">
                    <span v-if="browser.puppeteer_version === 'auto'">
                      自动: Chrome &lt;112 使用低版本 Puppeteer (13.7.0)
                    </span>
                    <span v-else-if="browser.puppeteer_version === 'high'">
                      高版本: Puppeteer 22.x (Chrome 112+)
                    </span>
                    <span v-else>
                      低版本: Puppeteer 13.7.0 (Chrome 90-111)
                    </span>
                  </div>
                </div>
                
                <!-- 空状态 -->
                <div v-if="browserList.length === 0" class="p-4 rounded-lg bg-neutral-50 text-center">
                  <p class="text-sm text-fg-muted">暂无浏览器配置</p>
                  <button @click="initDefaultBrowsers" class="btn-secondary text-sm mt-2">自动检测并添加</button>
                </div>
                
                <!-- 添加按钮 -->
                <button @click="showAddBrowserDialog" class="w-full p-2 rounded-lg border-2 border-dashed border-neutral-300 text-sm text-fg-muted hover:border-primary-400 hover:text-primary-600 transition-colors">
                  + 添加浏览器
                </button>
              </div>
            </div>

            <!-- Terminal Tools Config -->
            <div class="mb-6">
              <div class="flex items-center justify-between mb-3">
                <h4 class="text-sm font-medium text-fg-secondary flex items-center gap-2">
                  <svg class="w-4 h-4 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  命令行工具
                </h4>
                <button @click="detectAndAddTerminals" class="text-fg-muted hover:text-primary-500 transition-colors" title="自动检测添加">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
              </div>
              <div class="space-y-2">
                <!-- 终端列表 -->
                <div v-for="term in settingsTerminalList" :key="term.id" 
                     class="p-3 rounded-lg bg-neutral-50 flex items-center justify-between">
                  <div class="flex items-center gap-3 flex-1 min-w-0">
                    <div class="w-8 h-8 rounded-lg bg-success-100 flex items-center justify-center flex-shrink-0">
                      <svg class="w-4 h-4 text-success-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div class="flex-1 min-w-0">
                      <p class="text-sm font-medium text-fg-primary">{{ term.name }}</p>
                      <p class="text-xs text-fg-muted truncate" :title="term.path">{{ term.path }}</p>
                    </div>
                  </div>
                  <div class="flex items-center gap-2 flex-shrink-0 ml-2">
                    <button @click="toggleTerminalStatus(term)" 
                            :class="term.is_enabled ? 'bg-success-100 text-success-700' : 'bg-gray-100 text-gray-500'"
                            class="text-xs px-2 py-1 rounded transition-colors">
                      {{ term.is_enabled ? '启用' : '禁用' }}
                    </button>
                    <button @click="deleteTerminalConfig(term.id)" 
                            class="text-xs px-2 py-1 rounded bg-red-50 text-red-600 hover:bg-red-100 transition-colors">
                      删除
                    </button>
                  </div>
                </div>
                
                <!-- 空状态 -->
                <div v-if="settingsTerminalList.length === 0" class="p-4 rounded-lg bg-neutral-50 text-center">
                  <p class="text-sm text-fg-muted">暂无命令行工具配置</p>
                  <button @click="initDefaultTerminals" class="btn-secondary text-sm mt-2">自动检测并添加</button>
                </div>
                
                <!-- 添加按钮 -->
                <button @click="showAddTerminalDialog" class="w-full p-2 rounded-lg border-2 border-dashed border-neutral-300 text-sm text-fg-muted hover:border-primary-400 hover:text-primary-600 transition-colors">
                  + 添加命令行工具
                </button>
              </div>
            </div>

            <!-- SSH Tools Config -->
            <div class="mb-6">
              <h4 class="text-sm font-medium text-fg-secondary mb-3 flex items-center gap-2">
                <svg class="w-4 h-4 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                SSH 工具
              </h4>
              <div class="space-y-2">
                <!-- ttyd Status -->
                <div class="p-3 rounded-lg bg-neutral-50">
                  <div class="flex items-center justify-between mb-2">
                    <div>
                      <p class="text-sm font-medium text-fg-primary">ttyd 服务</p>
                      <p class="text-xs text-fg-muted">SSH 终端服务</p>
                    </div>
                    <div class="flex items-center gap-2">
                      <span :class="ttydStatus?.running ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'" 
                            class="px-2 py-0.5 rounded text-xs font-medium">
                        {{ ttydStatus?.running ? '运行中' : '已停止' }}
                      </span>
                      <button @click="refreshTtydStatus" class="btn-icon text-xs">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                      </button>
                    </div>
                  </div>
                  <div class="p-2 rounded bg-white border border-neutral-200 mb-2">
                    <div class="flex items-center gap-2 text-xs">
                      <span class="text-fg-muted whitespace-nowrap">路径 ({{ ttydPathInfo?.source === 'custom' ? '自定义' : ttydPathInfo?.source === 'bundled' ? '内置' : ttydPathInfo?.source === 'system' ? '系统' : '无' }}):</span>
                      <span class="text-fg-primary font-mono truncate flex-1 min-w-0" :title="ttydPathInfo?.path || '未找到'">
                        {{ ttydPathInfo?.path || '未找到' }}
                      </span>
                      <button @click="refreshTtydPath" class="text-primary-500 hover:text-primary-600 flex-shrink-0" title="重新检测">
                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                      </button>
                      <button @click="selectTtydPath" class="text-primary-500 hover:text-primary-600 flex-shrink-0" title="手动选择">
                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </button>
                    </div>
                  </div>
                  <div class="flex items-center justify-between text-xs">
                    <span class="text-fg-muted">端口 7681:</span>
                    <div class="flex items-center gap-2">
                      <span :class="portCheck?.inUse ? (ttydStatus?.running ? 'text-green-600' : 'text-orange-600') : 'text-gray-500'">
                        {{ portCheck?.inUse 
                          ? (ttydStatus?.running ? `ttyd 占用中 (PID: ${ttydStatus.pid})` : `${portCheck.process?.name || '未知'} 占用中 (PID: ${portCheck.process?.pid})`) 
                          : '可用' 
                        }}
                      </span>
                      <!-- 杀掉占用端口的进程按钮 -->
                      <button 
                        v-if="portCheck?.inUse && !ttydStatus?.running"
                        @click="killPortProcess"
                        class="text-xs px-2 py-0.5 rounded bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                        title="终止占用端口的进程"
                      >
                        终止
                      </button>
                    </div>
                  </div>
                </div>
                
                <!-- plink Config (Windows only) -->
                <div v-if="platformInfo?.isWindows" class="p-3 rounded-lg bg-neutral-50">
                  <div class="flex items-center justify-between mb-2">
                    <div>
                      <p class="text-sm font-medium text-fg-primary">plink (PuTTY)</p>
                      <p class="text-xs text-fg-muted">Windows SSH 密码认证</p>
                    </div>
                    <span :class="plinkPathInfo?.path ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'" 
                          class="px-2 py-0.5 rounded text-xs font-medium">
                      {{ plinkPathInfo?.path ? '已安装' : '未找到' }}
                    </span>
                  </div>
                  <div class="p-2 rounded bg-white border border-neutral-200">
                    <div class="flex items-center gap-2 text-xs">
                      <span class="text-fg-muted whitespace-nowrap">路径 ({{ plinkPathInfo?.source === 'custom' ? '自定义' : plinkPathInfo?.source === 'system' ? '系统' : '无' }}):</span>
                      <span class="text-fg-primary font-mono truncate flex-1 min-w-0" :title="plinkPathInfo?.path || '未找到'">
                        {{ plinkPathInfo?.path || '未找到' }}
                      </span>
                      <button @click="refreshPlinkPath" class="text-primary-500 hover:text-primary-600 flex-shrink-0" title="重新检测">
                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                      </button>
                      <button @click="selectPlinkPath" class="text-primary-500 hover:text-primary-600 flex-shrink-0" title="手动选择">
                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
                
                <!-- sshpass Config (Linux/macOS only) -->
                <div v-if="!platformInfo?.isWindows" class="p-3 rounded-lg bg-neutral-50">
                  <div class="flex items-center justify-between mb-2">
                    <div>
                      <p class="text-sm font-medium text-fg-primary">sshpass</p>
                      <p class="text-xs text-fg-muted">{{ platformInfo?.isMac ? 'macOS' : 'Linux' }} SSH 密码认证</p>
                    </div>
                    <span :class="sshpassPathInfo?.path ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'" 
                          class="px-2 py-0.5 rounded text-xs font-medium">
                      {{ sshpassPathInfo?.path ? '已安装' : '未找到' }}
                    </span>
                  </div>
                  <div class="p-2 rounded bg-white border border-neutral-200">
                    <div class="flex items-center gap-2 text-xs">
                      <span class="text-fg-muted whitespace-nowrap">路径 ({{ sshpassPathInfo?.source === 'custom' ? '自定义' : sshpassPathInfo?.source === 'system' ? '系统' : '无' }}):</span>
                      <span class="text-fg-primary font-mono truncate flex-1 min-w-0" :title="sshpassPathInfo?.path || '未找到'">
                        {{ sshpassPathInfo?.path || '未找到' }}
                      </span>
                      <button @click="refreshSshpassPath" class="text-primary-500 hover:text-primary-600 flex-shrink-0" title="重新检测">
                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                      </button>
                      <button @click="selectSshpassPath" class="text-primary-500 hover:text-primary-600 flex-shrink-0" title="手动选择">
                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </button>
                    </div>
                  </div>
                  <p v-if="platformInfo?.isMac && !sshpassPathInfo?.path" class="text-xs text-orange-600 mt-2">
                    macOS 建议使用密钥文件登录，或通过 Homebrew 安装: brew install sshpass
                  </p>
                </div>
              </div>
            </div>

            <!-- About -->
            <div class="mb-4">
              <h4 class="text-sm font-medium text-fg-secondary mb-3 flex items-center gap-2">
                <svg class="w-4 h-4 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                关于
              </h4>
              <div class="flex items-center gap-3 p-3 rounded-lg bg-neutral-50">
                <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center">
                  <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <div>
                  <p class="text-sm font-semibold text-fg-primary">密钥终端 (Secure Ledger)</p>
                  <p class="text-xs text-fg-muted">版本 1.0.2</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Log Content Modal -->
    <div v-if="showLogModal" class="modal-overlay" @click.self="showLogModal = false">
      <div class="modal-content" style="width: 700px; max-height: 80vh;">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-semibold text-fg-primary">应用日志</h3>
          <button @click="showLogModal = false" class="btn-icon">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div class="mb-4 max-h-96 overflow-auto bg-neutral-900 rounded-lg p-4">
          <pre class="text-xs text-green-400 font-mono whitespace-pre-wrap break-all">{{ logContent || '暂无日志' }}</pre>
        </div>
        <div class="flex gap-3">
          <button @click="clearLogs" class="btn-secondary flex-1">清空日志</button>
          <button @click="showLogModal = false" class="btn-primary flex-1">关闭</button>
        </div>
      </div>
    </div>

    <!-- Add Browser Modal -->
    <div v-if="showAddBrowserModal" class="modal-overlay" @click.self="showAddBrowserModal = false">
      <div class="modal-content" style="width: 500px;">
        <div class="flex items-center justify-between mb-6">
          <h3 class="text-lg font-semibold text-fg-primary">添加浏览器</h3>
          <button @click="showAddBrowserModal = false" class="btn-icon">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <!-- 检测到的浏览器 -->
        <div v-if="detectedBrowsers.length > 0" class="mb-4">
          <p class="text-sm font-medium text-fg-secondary mb-2">检测到的浏览器（点击快速添加）:</p>
          <div class="flex flex-wrap gap-2">
            <button v-for="browser in detectedBrowsers" :key="browser.path"
                    @click="selectDetectedBrowser(browser)"
                    class="px-3 py-1.5 text-sm rounded-lg border border-neutral-200 hover:border-primary-400 hover:bg-primary-50 transition-colors">
              {{ browser.name }}
            </button>
          </div>
        </div>
        
        <!-- 手动输入 -->
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-fg-secondary mb-1">浏览器名称</label>
            <input v-model="newBrowserName" type="text" placeholder="例如: Google Chrome"
                   class="w-full px-3 py-2 rounded-lg border border-neutral-300 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none">
          </div>
          <div>
            <label class="block text-sm font-medium text-fg-secondary mb-1">浏览器路径</label>
            <div class="flex gap-2">
              <input v-model="newBrowserPath" type="text" placeholder="浏览器可执行文件路径"
                     class="flex-1 px-3 py-2 rounded-lg border border-neutral-300 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none">
              <button @click="selectBrowserPath" class="btn-secondary">选择</button>
            </div>
          </div>
        </div>
        
        <div class="flex gap-3 mt-6">
          <button @click="showAddBrowserModal = false" class="btn-secondary flex-1">取消</button>
          <button @click="addBrowser" class="btn-primary flex-1">添加</button>
        </div>
      </div>
    </div>

    <!-- Add Terminal Modal -->
    <div v-if="showAddTerminalModal" class="modal-overlay" @click.self="showAddTerminalModal = false">
      <div class="modal-content" style="width: 500px;">
        <div class="flex items-center justify-between mb-6">
          <h3 class="text-lg font-semibold text-fg-primary">添加命令行工具</h3>
          <button @click="showAddTerminalModal = false" class="btn-icon">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <!-- 检测到的终端 -->
        <div v-if="detectedTerminals.length > 0" class="mb-4">
          <p class="text-sm font-medium text-fg-secondary mb-2">检测到的终端工具（点击快速添加）:</p>
          <div class="flex flex-wrap gap-2">
            <button v-for="term in detectedTerminals" :key="term.path"
                    @click="selectDetectedTerminal(term)"
                    class="px-3 py-1.5 text-sm rounded-lg border border-neutral-200 hover:border-primary-400 hover:bg-primary-50 transition-colors">
              {{ term.name }}
            </button>
          </div>
        </div>
        
        <!-- 手动输入 -->
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-fg-secondary mb-1">终端工具名称</label>
            <input v-model="newTerminalName" type="text" placeholder="例如: Windows Terminal"
                   class="w-full px-3 py-2 rounded-lg border border-neutral-300 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none">
          </div>
          <div>
            <label class="block text-sm font-medium text-fg-secondary mb-1">终端工具路径</label>
            <div class="flex gap-2">
              <input v-model="newTerminalPath" type="text" placeholder="终端工具可执行文件路径"
                     class="flex-1 px-3 py-2 rounded-lg border border-neutral-300 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none">
              <button @click="selectTerminalPath" class="btn-secondary">选择</button>
            </div>
          </div>
        </div>
        
        <div class="flex gap-3 mt-6">
          <button @click="showAddTerminalModal = false" class="btn-secondary flex-1">取消</button>
          <button @click="addTerminalConfig" class="btn-primary flex-1">添加</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useEndpointStore } from '../stores/endpoint'
import { loginApi, terminalApi, terminalConfigApi, endpointApi, sshApi, appApi, ttydApi, plinkApi, sshpassApi, platformApi, browserApi, appLockApi, type ChromeInfo, type TerminalTool, type TerminalConfig, type EndpointFull, type Endpoint, type SSHConfig, type TtydStatus, type TtydPathInfo, type PortCheckResult, type PlinkPathInfo, type SshpassPathInfo, type PlatformInfo, type BrowserConfig, type AppLockSettings } from '../apis'
import { safeConfirm, messageSuccess, messageError, messageWarning } from '../utils/dialog'
import UploadModal from '../components/UploadModal.vue'

const router = useRouter()
const endpointStore = useEndpointStore()

const loading = computed(() => endpointStore.loading)
const endpoints = computed(() => endpointStore.endpoints)

// 搜索关键词
const searchKeyword = ref('')
// 缓存的端点 URL 映射（用于搜索）
const endpointUrlsCache = ref<Map<number, string[]>>(new Map())

// 根据搜索关键词过滤登录端
const filteredEndpoints = computed(() => {
  const keyword = searchKeyword.value.trim().toLowerCase()
  if (!keyword) {
    return endpoints.value
  }
  
  return endpoints.value.filter(endpoint => {
    // 匹配名称
    if (endpoint.name.toLowerCase().includes(keyword)) {
      return true
    }
    
    // 匹配登录类型
    if (endpoint.login_type.toLowerCase().includes(keyword)) {
      return true
    }
    
    // 匹配缓存的 URL
    const cachedUrls = endpointUrlsCache.value.get(endpoint.id)
    if (cachedUrls) {
      for (const url of cachedUrls) {
        if (url.toLowerCase().includes(keyword)) {
          return true
        }
      }
    }
    
    return false
  })
})

// 当搜索关键词变化时，异步加载端点 URL
watch(searchKeyword, async (keyword) => {
  if (keyword.trim()) {
    // 加载缺失的端点 URL
    for (const endpoint of endpoints.value) {
      if (!endpointUrlsCache.value.has(endpoint.id)) {
        try {
          const fullEndpoint = await endpointApi.get(endpoint.id)
          if (fullEndpoint) {
            const urls = fullEndpoint.pages.map(p => p.url).filter(Boolean) as string[]
            endpointUrlsCache.value.set(endpoint.id, urls)
          }
        } catch {
          // 忽略加载错误
        }
      }
    }
  }
})

const showChromeModal = ref(false)
const showTerminalModal = ref(false)
const showUploadModal = ref(false)
const showSettingsModal = ref(false)
const chromeList = ref<ChromeInfo[]>([])
const executingId = ref<number | null>(null)
const pendingEndpointId = ref<number | null>(null)
const pendingEndpoint = ref<EndpointFull | null>(null)
const uploadFiles = ref<{ path: string; name: string; size: number; isFolder: boolean }[]>([])
const uploadConfig = ref<SSHConfig | null>(null)
const databasePath = ref('')
const logPath = ref('')
const showLogModal = ref(false)
const logContent = ref('')

// ttyd 和 plink 配置状态
const ttydStatus = ref<TtydStatus | null>(null)
const ttydPathInfo = ref<TtydPathInfo | null>(null)
const portCheck = ref<PortCheckResult | null>(null)
const plinkPathInfo = ref<PlinkPathInfo | null>(null)
const sshpassPathInfo = ref<SshpassPathInfo | null>(null)
const platformInfo = ref<PlatformInfo | null>(null)

// 浏览器管理状态
const browserList = ref<BrowserConfig[]>([])
const showAddBrowserModal = ref(false)
const detectedBrowsers = ref<ChromeInfo[]>([])
const newBrowserName = ref('')
const newBrowserPath = ref('')

// SSH 登录终端选择
const terminalList = ref<TerminalConfig[]>([])

// 设置对话框中的终端工具状态
const settingsTerminalList = ref<TerminalConfig[]>([])
const showAddTerminalModal = ref(false)
const detectedTerminals = ref<TerminalTool[]>([])
const newTerminalName = ref('')
const newTerminalPath = ref('')
const newTerminalType = ref('')

// 应用锁定状态
const lockSettings = ref<AppLockSettings | null>(null)
const lockPassword = ref('')
const lockPasswordError = ref('')
let lockTimer: ReturnType<typeof setTimeout> | null = null
let activityListener: (() => void) | null = null

// 锁定相关状态
const lockDelayMinutes = ref(5)

onMounted(async () => {
  await endpointStore.loadEndpoints()
  // 初始化锁定设置
  await refreshLockSettings()
  
  // 检查是否处于锁定状态
  const lockStatus = await appLockApi.isLocked()
  if (lockStatus.is_locked) {
    console.log('[AppLock] App is locked, navigating to lock page')
    router.push('/lock')
    return
  }
  
  // 只要启用锁定就启动计时器（不要求必须设置密码）
  if (lockSettings.value?.is_enabled) {
    startActivityMonitor()
    startLockTimer()
  }
})

// 监听设置对话框打开，获取数据库路径和日志路径
watch(showSettingsModal, async (newVal) => {
  if (newVal) {
    if (!databasePath.value) {
      try {
        const result = await appApi.getDatabasePath()
        databasePath.value = result.path
      } catch (e) {
        console.error('Failed to get database path:', e)
      }
    }
    if (!logPath.value) {
      try {
        const result = await appApi.getLogPath()
        logPath.value = result.path
      } catch (e) {
        console.error('Failed to get log path:', e)
      }
    }
    // 加载 ttyd 和 plink 配置
    await refreshTtydStatus()
    platformInfo.value = await platformApi.getInfo()
    if (platformInfo.value?.isWindows) {
      await refreshPlinkPath()
    } else {
      await refreshSshpassPath()
    }
    // 加载浏览器配置
    await refreshBrowserList()
    // 加载终端工具
    await refreshSettingsTerminalList()
    // 加载锁定设置
    await refreshLockSettings()
  }
})

// 刷新登录端列表
async function refreshList() {
  await endpointStore.loadEndpoints()
}

// 刷新锁定设置
async function refreshLockSettings() {
  try {
    lockSettings.value = await appLockApi.getSettings()
    lockDelayMinutes.value = lockSettings.value.lock_delay_minutes
  } catch (e) {
    console.error('Failed to get lock settings:', e)
  }
}

// 切换锁定启用状态
async function toggleLockEnabled() {
  if (!lockSettings.value) return
  
  const newEnabled = !lockSettings.value.is_enabled
  lockSettings.value = await appLockApi.updateSettings({ is_enabled: newEnabled })
  
  if (newEnabled) {
    startActivityMonitor()
    startLockTimer()
  } else {
    stopLockTimer()
  }
  
  messageSuccess(newEnabled ? '已启用自动锁定' : '已关闭自动锁定')
}

// 更新锁定延时
async function updateLockDelay() {
  if (!lockSettings.value?.is_enabled) return
  
  lockSettings.value = await appLockApi.updateSettings({ lock_delay_minutes: lockDelayMinutes.value })
  startLockTimer() // 重置计时器
  
  // 格式化显示时间
  const delayText = lockDelayMinutes.value === 0.5 ? '30 秒' : `${lockDelayMinutes.value} 分钟`
  messageSuccess(`活动时长已设置为 ${delayText}`)
}

// 自动保存锁定密码（失去焦点时）
async function saveLockPasswordAuto() {
  // 清除之前的错误
  lockPasswordError.value = ''
  
  // 如果密码为空，不做任何操作
  if (!lockPassword.value) return
  
  if (lockPassword.value.length !== 6) {
    lockPasswordError.value = '密码必须为6位'
    return
  }
  
  try {
    const result = await appLockApi.setPassword(lockPassword.value)
    if (result.success) {
      messageSuccess('密码已保存')
      lockPassword.value = ''
      await refreshLockSettings()
      // 如果已启用，启动活动监听器和计时器
      if (lockSettings.value?.is_enabled) {
        startActivityMonitor()
        startLockTimer()
      }
    } else {
      lockPasswordError.value = result.message
    }
  } catch (e: any) {
    lockPasswordError.value = e.message
  }
}

// 清除锁定密码
async function clearLockPassword() {
  if (!lockSettings.value?.is_enabled) return
  
  if (!await safeConfirm('确定要清除锁定密码吗？', { title: '清除密码', confirmText: '清除', type: 'warning' })) {
    return
  }
  
  try {
    await appLockApi.removePassword()
    messageSuccess('密码已清除')
    await refreshLockSettings()
  } catch (e: any) {
    messageError('清除失败: ' + e.message)
  }
}

// 启动锁定计时器
function startLockTimer() {
  // 先清除旧的计时器
  if (lockTimer) {
    clearTimeout(lockTimer)
    lockTimer = null
  }
  
  // 检查是否启用锁定（不再要求必须设置密码）
  if (!lockSettings.value?.is_enabled) {
    return
  }
  
  const delay = (lockSettings.value.lock_delay_minutes || 5) * 60 * 1000
  console.log('[LockTimer] Starting timer, will lock in', delay / 1000, 'seconds')
  
  lockTimer = setTimeout(async () => {
    console.log('[LockTimer] Timer fired, locking app')
    // 先更新数据库锁定状态
    await appLockApi.lock()
    // 再跳转到锁定页面
    router.push('/lock')
  }, delay)
}

// 重置锁定计时器（用户活动时调用）
function resetLockTimer() {
  if (!lockSettings.value?.is_enabled) {
    return
  }
  startLockTimer()
}

// 添加活动监听器（只添加一次）
function startActivityMonitor() {
  if (activityListener) return // 已经添加过了
  
  activityListener = () => {
    resetLockTimer()
  }
  
  document.addEventListener('mousemove', activityListener)
  document.addEventListener('keydown', activityListener)
  document.addEventListener('mousedown', activityListener)
  document.addEventListener('touchstart', activityListener)
  console.log('[LockTimer] Activity monitor started')
}

// 停止锁定计时器和活动监听
function stopLockTimer() {
  if (lockTimer) {
    clearTimeout(lockTimer)
    lockTimer = null
  }
  
  if (activityListener) {
    document.removeEventListener('mousemove', activityListener)
    document.removeEventListener('keydown', activityListener)
    document.removeEventListener('mousedown', activityListener)
    document.removeEventListener('touchstart', activityListener)
    activityListener = null
    console.log('[LockTimer] Activity monitor stopped')
  }
}

// 刷新 ttyd 状态
async function refreshTtydStatus() {
  try {
    ttydStatus.value = await ttydApi.getStatus()
    ttydPathInfo.value = await ttydApi.getPath()
    portCheck.value = await ttydApi.checkPort(7681)
  } catch (e) {
    console.error('Failed to get ttyd status:', e)
  }
}

// 刷新 plink 路径 (Windows)
async function refreshPlinkPath() {
  try {
    plinkPathInfo.value = await plinkApi.getPath()
    if (plinkPathInfo.value?.path) {
      messageSuccess('plink 已检测到: ' + plinkPathInfo.value.path)
    } else {
      messageWarning('未找到 plink')
    }
  } catch (e: any) {
    console.error('Failed to get plink path:', e)
    messageError('检测 plink 失败: ' + e.message)
  }
}

// 刷新 sshpass 路径 (Linux/macOS)
async function refreshSshpassPath() {
  try {
    sshpassPathInfo.value = await sshpassApi.getPath()
    if (sshpassPathInfo.value?.path) {
      messageSuccess('sshpass 已检测到: ' + sshpassPathInfo.value.path)
    } else {
      messageWarning('未找到 sshpass')
    }
  } catch (e: any) {
    console.error('Failed to get sshpass path:', e)
    messageError('检测 sshpass 失败: ' + e.message)
  }
}

// 杀掉占用 7681 端口的进程
async function killPortProcess() {
  try {
    const result = await ttydApi.killPort(7681)
    if (result.success) {
      messageSuccess(result.message)
      await refreshTtydStatus()
    } else {
      messageError(result.message)
    }
  } catch (e: any) {
    messageError('终止进程失败: ' + e.message)
  }
}

// 重新检测 ttyd 路径
async function refreshTtydPath() {
  try {
    await refreshTtydStatus()
    if (ttydPathInfo.value?.path) {
      messageSuccess('ttyd 已检测到: ' + ttydPathInfo.value.path)
    } else {
      messageWarning('未找到 ttyd')
    }
  } catch (e: any) {
    messageError('检测 ttyd 失败: ' + e.message)
  }
}

// 选择自定义 ttyd 路径
async function selectTtydPath() {
  try {
    const result = await appApi.selectExecutable('选择 ttyd 可执行文件')
    if (!result.canceled && result.filePaths.length > 0) {
      const path = result.filePaths[0]
      const setResult = await ttydApi.setPath(path)
      if (setResult.success) {
        messageSuccess('ttyd 路径已更新')
        await refreshTtydStatus()
      } else {
        messageError(setResult.message)
      }
    }
  } catch (e: any) {
    messageError('选择 ttyd 路径失败：' + e.message)
  }
}

// 选择自定义 plink 路径
async function selectPlinkPath() {
  try {
    const result = await appApi.selectExecutable('选择 plink 可执行文件')
    if (!result.canceled && result.filePaths.length > 0) {
      const path = result.filePaths[0]
      const setResult = await plinkApi.setPath(path)
      if (setResult.success) {
        messageSuccess('plink 路径已更新')
        await refreshPlinkPath()
      } else {
        messageError(setResult.message)
      }
    }
  } catch (e: any) {
    messageError('选择 plink 路径失败：' + e.message)
  }
}

// 选择自定义 sshpass 路径 (Linux/macOS)
async function selectSshpassPath() {
  try {
    const result = await appApi.selectExecutable('选择 sshpass 可执行文件')
    if (!result.canceled && result.filePaths.length > 0) {
      const path = result.filePaths[0]
      const setResult = await sshpassApi.setPath(path)
      if (setResult.success) {
        messageSuccess('sshpass 路径已更新')
        await refreshSshpassPath()
      } else {
        messageError(setResult.message)
      }
    }
  } catch (e: any) {
    messageError('选择 sshpass 路径失败：' + e.message)
  }
}

// ============ 浏览器管理函数 ============
async function refreshBrowserList() {
  try {
    browserList.value = await browserApi.getList()
    // 如果没有配置，自动初始化
    if (browserList.value.length === 0) {
      await initDefaultBrowsers()
    }
  } catch (e) {
    console.error('Failed to get browser list:', e)
  }
}

async function initDefaultBrowsers() {
  try {
    await browserApi.initDefault()
    await refreshBrowserList()
    messageSuccess('已自动检测并添加浏览器')
  } catch (e: any) {
    messageError('初始化浏览器失败: ' + e.message)
  }
}

async function detectAndAddBrowsers() {
  try {
    const result = await browserApi.detectAndAdd()
    await refreshBrowserList()
    if (result.added > 0) {
      messageSuccess(`检测完成：新增 ${result.added} 个浏览器，跳过 ${result.skipped} 个已存在的`)
    } else {
      messageSuccess(`检测完成：所有 ${result.total} 个浏览器已存在，无需添加`)
    }
  } catch (e: any) {
    messageError('自动检测失败: ' + e.message)
  }
}

async function toggleBrowserStatus(browser: BrowserConfig) {
  try {
    await browserApi.updateStatus(browser.id, !browser.is_enabled)
    await refreshBrowserList()
  } catch (e: any) {
    messageError('更新状态失败: ' + e.message)
  }
}

async function updateBrowserPuppeteerVersion(browser: BrowserConfig) {
  try {
    await browserApi.updatePuppeteerVersion(browser.id, browser.puppeteer_version)
    messageSuccess('Puppeteer 版本设置已更新')
  } catch (e: any) {
    messageError('更新失败: ' + e.message)
    // 恢复原值
    await refreshBrowserList()
  }
}

async function deleteBrowser(id: number) {
  if (await safeConfirm('确定要删除此浏览器配置吗？', { title: '删除浏览器', confirmText: '删除', type: 'danger' })) {
    try {
      await browserApi.delete(id)
      await refreshBrowserList()
      messageSuccess('浏览器已删除')
    } catch (e: any) {
      messageError('删除失败: ' + e.message)
    }
  }
}

async function showAddBrowserDialog() {
  // 检测系统浏览器
  try {
    detectedBrowsers.value = await browserApi.detect()
  } catch (e) {
    console.error('Failed to detect browsers:', e)
    detectedBrowsers.value = []
  }
  newBrowserName.value = ''
  newBrowserPath.value = ''
  showAddBrowserModal.value = true
}

async function addBrowser() {
  if (!newBrowserName.value.trim() || !newBrowserPath.value.trim()) {
    messageWarning('请填写浏览器名称和路径')
    return
  }
  
  try {
    await browserApi.add(newBrowserName.value.trim(), newBrowserPath.value.trim())
    showAddBrowserModal.value = false
    await refreshBrowserList()
    messageSuccess('浏览器添加成功')
  } catch (e: any) {
    messageError('添加失败: ' + e.message)
  }
}

function selectDetectedBrowser(browser: ChromeInfo) {
  newBrowserName.value = browser.name
  newBrowserPath.value = browser.path
}

async function selectBrowserPath() {
  try {
    const result = await appApi.selectExecutable('选择浏览器可执行文件')
    if (!result.canceled && result.filePaths.length > 0) {
      newBrowserPath.value = result.filePaths[0]
    }
  } catch (e: any) {
    messageError('选择浏览器路径失败：' + e.message)
  }
}

// ============ 命令行工具管理函数 ============
async function refreshSettingsTerminalList() {
  try {
    settingsTerminalList.value = await terminalConfigApi.getList()
  } catch (e) {
    console.error('Failed to get terminal list:', e)
  }
}

async function initDefaultTerminals() {
  try {
    const result = await terminalConfigApi.initDefault()
    await refreshSettingsTerminalList()
    if (result.count > 0) {
      messageSuccess(result.message)
    }
  } catch (e: any) {
    messageError('初始化命令行工具失败: ' + e.message)
  }
}

async function detectAndAddTerminals() {
  try {
    const result = await terminalConfigApi.detectAndAdd()
    await refreshSettingsTerminalList()
    if (result.added > 0) {
      messageSuccess(`检测完成：新增 ${result.added} 个终端工具，跳过 ${result.skipped} 个已存在的`)
    } else {
      messageSuccess(`检测完成：所有 ${result.total} 个终端工具已存在，无需添加`)
    }
  } catch (e: any) {
    messageError('自动检测失败: ' + e.message)
  }
}

async function toggleTerminalStatus(terminal: TerminalConfig) {
  try {
    await terminalConfigApi.updateStatus(terminal.id, !terminal.is_enabled)
    await refreshSettingsTerminalList()
  } catch (e: any) {
    messageError('更新状态失败: ' + e.message)
  }
}

async function deleteTerminalConfig(id: number) {
  if (await safeConfirm('确定要删除此命令行工具配置吗？', { title: '删除命令行工具', confirmText: '删除', type: 'danger' })) {
    try {
      await terminalConfigApi.delete(id)
      await refreshSettingsTerminalList()
      messageSuccess('命令行工具已删除')
    } catch (e: any) {
      messageError('删除失败: ' + e.message)
    }
  }
}

async function showAddTerminalDialog() {
  // 检测系统终端
  try {
    detectedTerminals.value = await terminalConfigApi.detect()
  } catch (e) {
    console.error('Failed to detect terminals:', e)
    detectedTerminals.value = []
  }
  newTerminalName.value = ''
  newTerminalPath.value = ''
  newTerminalType.value = ''
  showAddTerminalModal.value = true
}

async function addTerminalConfig() {
  if (!newTerminalName.value.trim() || !newTerminalPath.value.trim()) {
    messageWarning('请填写终端工具名称和路径')
    return
  }
  
  try {
    await terminalConfigApi.add(newTerminalName.value.trim(), newTerminalPath.value.trim(), newTerminalType.value)
    showAddTerminalModal.value = false
    await refreshSettingsTerminalList()
    messageSuccess('命令行工具添加成功')
  } catch (e: any) {
    messageError('添加失败: ' + e.message)
  }
}

function selectDetectedTerminal(terminal: TerminalTool) {
  newTerminalName.value = terminal.name
  newTerminalPath.value = terminal.path
  newTerminalType.value = terminal.id  // 保存终端类型标识符
}

async function selectTerminalPath() {
  try {
    const result = await appApi.selectExecutable('选择命令行工具可执行文件')
    if (!result.canceled && result.filePaths.length > 0) {
      newTerminalPath.value = result.filePaths[0]
    }
  } catch (e: any) {
    messageError('选择终端路径失败：' + e.message)
  }
}

async function executeLogin(endpoint: Endpoint) {
  pendingEndpointId.value = endpoint.id
  
  // 获取完整端点数据
  const fullEndpoint = await endpointApi.get(endpoint.id)
  if (!fullEndpoint) {
    messageError('获取登录端数据失败')
    pendingEndpointId.value = null
    return
  }
  pendingEndpoint.value = fullEndpoint
  
  if (endpoint.login_type === 'ssh') {
    // SSH 登录：获取配置的终端工具
    const availableTerminals = await terminalConfigApi.getAvailable()
    
    if (availableTerminals.length === 0) {
      // 没有配置终端工具，尝试初始化默认终端
      await terminalConfigApi.initDefault()
      const retryTerminals = await terminalConfigApi.getAvailable()
      
      if (retryTerminals.length === 0) {
        messageWarning('未检测到可用的终端工具，请在设置中添加命令行工具')
        pendingEndpointId.value = null
        pendingEndpoint.value = null
        return
      }
      
      terminalList.value = retryTerminals
    } else {
      terminalList.value = availableTerminals
    }
    
    showTerminalModal.value = true
  } else {
    // Web 登录：获取可用浏览器（从用户配置）
    const availableBrowsers = await browserApi.getAvailable()
    
    if (availableBrowsers.length === 0) {
      // 没有配置浏览器，尝试初始化默认浏览器
      await browserApi.initDefault()
      const retryBrowsers = await browserApi.getAvailable()
      
      if (retryBrowsers.length === 0) {
        messageWarning('未检测到可用的浏览器，请在设置中添加浏览器')
        pendingEndpointId.value = null
        pendingEndpoint.value = null
        return
      }
      
      // 转换为 ChromeInfo 格式
      chromeList.value = retryBrowsers.map(b => ({
        name: b.name,
        path: b.path
      }))
    } else {
      // 转换为 ChromeInfo 格式
      chromeList.value = availableBrowsers.map(b => ({
        name: b.name,
        path: b.path
      }))
    }
    
    showChromeModal.value = true
  }
}

async function selectChrome(chromePath: string) {
  showChromeModal.value = false
  if (pendingEndpointId.value) {
    // 检测是否有现有浏览器实例
    try {
      const instanceInfo = await browserApi.checkInstance()
      
      if (instanceInfo.available && instanceInfo.wsEndpoint) {
        // 有现有实例，询问用户是否使用
        const pageCount = instanceInfo.pages?.length || 0
        const message = pageCount > 0 
          ? `检测到浏览器已开启 ${pageCount} 个页面。\n\n是否使用现有浏览器实例执行登录？\n\n注意：如果现有浏览器不是通过本应用启动的，可能无法连接。`
          : '检测到浏览器已开启。\n\n是否使用现有浏览器实例执行登录？\n\n注意：如果现有浏览器不是通过本应用启动的，可能无法连接。'
        
        const useExisting = await safeConfirm(message, {
          title: '使用现有浏览器',
          confirmText: '是，使用现有',
          cancelText: '否，启动新实例',
          type: 'info'
        })
        
        if (useExisting) {
          // 使用现有实例
          await doExecuteLogin(pendingEndpointId.value, chromePath, instanceInfo.wsEndpoint)
        } else {
          // 启动新实例（端口冲突时会自动跳过调试端口）
          await doExecuteLogin(pendingEndpointId.value, chromePath)
        }
      } else {
        // 没有现有实例，正常执行
        await doExecuteLogin(pendingEndpointId.value, chromePath)
      }
    } catch (e: any) {
      console.error('Failed to check browser instance:', e)
      // 检测失败时，正常执行登录
      await doExecuteLogin(pendingEndpointId.value, chromePath)
    }
  }
}

async function doExecuteLogin(endpointId: number, chromePath: string, wsEndpoint?: string) {
  executingId.value = endpointId
  
  try {
    const result = await loginApi.execute(endpointId, chromePath, wsEndpoint)
    if (!result.success) {
      messageError('登录执行失败: ' + result.message)
    } else if (result.isConnected) {
      messageSuccess('登录执行成功（使用现有浏览器）')
    } else {
      messageSuccess('登录执行成功')
    }
  } catch (e: any) {
    const errorMsg = e.message || '未知错误'
    
    // 如果是连接现有浏览器失败，提示用户关闭浏览器重新启动
    if (wsEndpoint && (errorMsg.includes('无法连接') || errorMsg.includes('Not allowed') || errorMsg.includes('Protocol error'))) {
      const shouldLaunchNew = await safeConfirm(
        '无法连接到现有浏览器实例。\n\n这可能是因为：\n1. 浏览器不是通过本应用启动的\n2. 浏览器启动时缺少远程调试参数\n\n建议：关闭现有浏览器后，启动新的浏览器实例。',
        {
          title: '连接失败',
          confirmText: '启动新实例',
          cancelText: '取消',
          type: 'warning'
        }
      )
      
      if (shouldLaunchNew) {
        // 递归调用，不传 wsEndpoint（启动新实例）
        // 先确保关闭 pending 状态
        executingId.value = null
        pendingEndpointId.value = null
        pendingEndpoint.value = null
        // 重新设置执行状态
        executingId.value = endpointId
        try {
          const result = await loginApi.execute(endpointId, chromePath)
          if (!result.success) {
            messageError('登录执行失败: ' + result.message)
          } else {
            messageSuccess('登录执行成功')
          }
        } catch (retryError: any) {
          messageError('执行出错: ' + retryError.message)
        }
      }
    } else {
      messageError('执行出错: ' + errorMsg)
    }
  } finally {
    executingId.value = null
    pendingEndpointId.value = null
    pendingEndpoint.value = null
  }
}

async function selectTerminal(terminal: TerminalConfig) {
  showTerminalModal.value = false
  if (!pendingEndpoint.value) return
  
  executingId.value = pendingEndpointId.value
  
  try {
    // 获取第一个页面的 SSH 配置
    const firstPage = pendingEndpoint.value.pages?.[0]
    
    // 解析 SSH 地址（host:port 或 host）
    const address = firstPage?.url || ''
    const parts = address.trim().split(':')
    const host = parts[0] || ''
    const port = parts.length === 2 ? (parseInt(parts[1], 10) || 22) : 22
    
    // 获取 SSH 认证信息 - 从独立的 slots 读取
    const slots = firstPage?.slots || []
    const usernameSlot = slots.find(s => s.name === 'SSH用户名')
    const passwordSlot = slots.find(s => s.name === 'SSH密码')
    const keyfileSlot = slots.find(s => s.name === 'SSH密钥文件')
    const username = usernameSlot?.value
    const password = passwordSlot?.value
    const keyfilePath = keyfileSlot?.value
    
    const result = await terminalApi.launchSSH({
      terminalId: terminal.terminal_type || '',
      terminalPath: terminal.path,
      terminalName: terminal.name,
      host,
      port,
      username,
      keyfilePath,
      password
    })
    
    if (!result.success) {
      // 检查是否需要安装 PuTTY
      if (result.message.includes('plink')) {
        const shouldInstall = await safeConfirm('密码登录需要安装 PuTTY。\n\n是否立即安装？', {
          title: '安装 PuTTY',
          confirmText: '安装',
          type: 'info'
        })
        if (shouldInstall) {
          const installResult = await sshApi.installPuTTY()
          if (installResult.success) {
            messageSuccess('PuTTY 安装完成，请重新点击执行登录')
          } else {
            messageError('安装失败: ' + installResult.message)
          }
        }
      } else {
        messageError('启动终端失败: ' + result.message)
      }
    }
  } catch (e: any) {
    messageError('执行出错: ' + e.message)
  } finally {
    executingId.value = null
    pendingEndpointId.value = null
    pendingEndpoint.value = null
  }
}

async function confirmDelete(id: number) {
  if (await safeConfirm('确定要删除此登录端吗？删除后无法恢复。', {
    title: '删除登录端',
    confirmText: '删除',
    type: 'danger'
  })) {
    await endpointStore.deleteEndpoint(id)
  }
}

async function handleExportAll() {
  const ids = endpoints.value.map(e => e.id)
  if (ids.length === 0) {
    messageWarning('没有可导出的登录端')
    return
  }
  await endpointStore.exportEndpoints(ids)
}

async function handleImport(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  
  try {
    const text = await file.text()
    const data = JSON.parse(text)
    
    if (!Array.isArray(data)) {
      messageError('导入文件格式错误')
      return
    }
    
    const result = await endpointApi.import(data)
    messageSuccess(`导入完成: 成功 ${result.success} 个, 失败 ${result.failed} 个`)
    await endpointStore.loadEndpoints()
  } catch (e: any) {
    messageError('导入失败: ' + e.message)
  }
  
  // 清空 input
  input.value = ''
}

// 开始上传流程
async function startUpload(endpoint: Endpoint, isFolder: boolean) {
  const fullEndpoint = await endpointApi.get(endpoint.id)
  if (!fullEndpoint) {
    messageError('获取登录端数据失败')
    return
  }
  
  // 获取第一个页面的 SSH 配置
  const firstPage = fullEndpoint.pages?.[0]
  if (!firstPage) {
    messageError('未找到 SSH 配置')
    return
  }
  
  // 解析 SSH 地址
  const address = firstPage.url || ''
  const parts = address.trim().split(':')
  const host = parts[0] || ''
  const port = parts.length === 2 ? (parseInt(parts[1], 10) || 22) : 22
  
  // 获取 SSH 认证信息
  const slots = firstPage.slots || []
  const usernameSlot = slots.find(s => s.name === 'SSH用户名')
  const passwordSlot = slots.find(s => s.name === 'SSH密码')
  const keyfileSlot = slots.find(s => s.name === 'SSH密钥文件')
  const passphraseSlot = slots.find(s => s.name === 'SSH密钥密码')
  
  // 构建配置（确保所有值都是普通字符串，不是 undefined）
  const config: SSHConfig = {
    host,
    port,
    username: usernameSlot?.value || '',
    password: passwordSlot?.value || undefined,
    keyfilePath: keyfileSlot?.value || undefined,
    passphrase: passphraseSlot?.value || undefined
  }
  
  console.log('SSH上传配置:', { host, port, username: config.username, hasPassword: !!config.password, hasKeyfile: !!config.keyfilePath })
  
  try {
    const result = await sshApi.selectUploadFiles(isFolder)
    
    if (result.canceled || result.filePaths.length === 0) {
      return
    }
    
    // 获取文件信息
    uploadFiles.value = result.filePaths.map(path => {
      const name = path.split(/[/\\]/).pop() || path
      return { path, name, size: 0, isFolder }
    })
    uploadConfig.value = config
    showUploadModal.value = true
  } catch (e: any) {
    messageError('选择文件失败: ' + e.message)
  }
}

function onUploadComplete(filesUploaded: number) {
  showUploadModal.value = false
  messageSuccess(`成功上传 ${filesUploaded} 个文件`)
}

async function openDatabaseFolder() {
  try {
    await appApi.openDatabaseFolder()
  } catch (e: any) {
    messageError('打开文件夹失败: ' + e.message)
  }
}

async function openLogFolder() {
  try {
    await appApi.openLogFolder()
  } catch (e: any) {
    messageError('打开日志目录失败: ' + e.message)
  }
}

async function showLogContent() {
  try {
    const result = await appApi.getLogContent(1000)
    logContent.value = result.content
    showLogModal.value = true
  } catch (e: any) {
    messageError('获取日志失败: ' + e.message)
  }
}

async function clearLogs() {
  if (await safeConfirm('Are you sure you want to clear all logs?', {
    title: 'Clear Logs',
    confirmText: 'Clear',
    type: 'warning'
  })) {
    try {
      const result = await appApi.clearLogs()
      if (result.success) {
        logContent.value = ''
        messageSuccess('日志已清空')
      } else {
        messageError('清空日志失败: ' + result.message)
      }
    } catch (e: any) {
      messageError('清空日志失败: ' + e.message)
    }
  }
}
</script>

<style scoped>
/* Sidebar transition */
.sidebar-enter-active,
.sidebar-leave-active {
  transition: all 0.3s ease;
}

.sidebar-enter-active .absolute.right-0,
.sidebar-leave-active .absolute.right-0 {
  transition: transform 0.3s ease;
}

.sidebar-enter-from,
.sidebar-leave-to {
  opacity: 0;
}

.sidebar-enter-from .absolute.right-0 {
  transform: translateX(100%);
}

.sidebar-leave-to .absolute.right-0 {
  transform: translateX(100%);
}
</style>

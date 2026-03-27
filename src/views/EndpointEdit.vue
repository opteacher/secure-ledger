<template>
  <div class="flex h-screen bg-neutral-50">
    <!-- Sidebar - Step Pages -->
    <aside class="w-64 flex-shrink-0 flex flex-col bg-white border-r border-neutral-200">
      <div class="p-4 border-b border-neutral-100">
        <router-link to="/home" class="flex items-center gap-2 text-fg-secondary hover:text-fg-primary transition-colors">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          <span class="font-medium">返回</span>
        </router-link>
      </div>

      <div class="flex-1 overflow-auto p-3">
        <div class="px-3 py-2 text-xs font-semibold text-fg-muted uppercase tracking-wider">步骤页</div>
        <div class="space-y-1">
          <div
            v-for="(page, index) in pages"
            :key="page.id"
            class="sidebar-item group"
            :class="{ active: selectedPageId === page.id }"
            @click="selectPage(page.id)"
          >
            <span class="w-6 h-6 rounded flex items-center justify-center text-xs font-medium" :class="selectedPageId === page.id ? 'bg-primary-600 text-white' : 'bg-primary-100 text-primary-600'">
              {{ index + 1 }}
            </span>
            <span class="truncate text-sm flex-1">{{ page.url || '新步骤' }}</span>
            <button 
              @click.stop="deletePage(page.id)" 
              class="opacity-0 group-hover:opacity-100 text-neutral-400 hover:text-error-500 transition-all p-1"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        </div>
        <button v-if="loginType === 'web'" @click="addPage" class="sidebar-item text-fg-muted hover:text-fg-primary mt-2">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          <span>添加步骤页</span>
        </button>
      </div>
    </aside>

    <!-- Main Content -->
    <main class="flex-1 overflow-hidden flex flex-col">
      <!-- Header -->
      <header class="bg-white/80 backdrop-blur-md border-b border-neutral-200">
        <div class="px-8 py-3 flex items-center justify-between">
          <input v-model="endpointName" type="text" class="text-lg font-semibold bg-transparent border-none focus:ring-0 p-0 text-fg-primary placeholder:text-fg-muted" placeholder="登录端名称" />
          <div class="flex items-center gap-2">
            <select v-model="loginType" class="bg-neutral-100 border-neutral-200 text-sm rounded-lg px-3 py-1.5">
              <option value="web">网页登录</option>
              <option value="ssh">SSH登录</option>
            </select>
            <button @click="handleSave" class="btn-primary text-sm" :disabled="saving">
              <svg v-if="saving" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              {{ saving ? '保存中...' : '保存' }}
            </button>
            <router-link to="/home" class="btn-secondary text-sm">取消</router-link>
          </div>
        </div>
      </header>

      <div v-if="selectedPage" class="flex-1 overflow-hidden flex flex-col">
        <!-- URL Bar -->
        <div class="px-8 py-3 bg-white border-b border-neutral-200">
          <div class="flex gap-4 items-end">
            <div class="flex-1 input-group mb-0">
              <label class="input-label text-xs">{{ loginType === 'ssh' ? '服务器地址' : '页面URL' }}</label>
              <input v-model="selectedPage.url" type="text" class="w-full text-sm" :placeholder="loginType === 'ssh' ? 'example.com:22' : 'https://example.com/login'" @keyup.enter="loginType === 'web' ? loadPage() : connectSSH()" />
            </div>
            <button v-if="loginType === 'web' && selectedPage.url" @click="loadPage" class="btn-primary text-sm mb-0" :disabled="pageLoading">
              {{ pageLoading ? '加载中...' : '加载' }}
            </button>
            <button v-if="loginType === 'ssh'" @click="connectSSH" class="btn-primary text-sm mb-0" :disabled="!selectedPage.url || sshConnecting">
              {{ sshConnecting ? '连接中...' : (sshConnected ? '重连' : '连接') }}
            </button>
          </div>
        </div>

        <!-- Main Editor Area - 3 Panels -->
        <div class="flex-1 flex overflow-hidden">
          <!-- Webview Panel (Center) -->
          <div v-if="loginType === 'web'" class="flex-1 flex flex-col border-r border-neutral-200 min-w-0">
            <!-- Webview Toolbar -->
            <div class="px-4 py-2 bg-white border-b border-neutral-200 flex items-center gap-2">
              <button @click="toggleSelecting" class="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors" :class="isSelectingElement ? 'bg-primary-100 text-primary-700' : 'bg-neutral-100 text-fg-secondary hover:bg-neutral-200'">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
                </svg>
                {{ isSelectingElement ? '选择中' : '选择元素' }}
              </button>
              <button @click="showMask = !showMask" class="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors" :class="showMask ? 'bg-primary-100 text-primary-700' : 'bg-neutral-100 text-fg-secondary hover:bg-neutral-200'">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                {{ showMask ? '遮罩开' : '遮罩关' }}
              </button>
              <div class="flex-1"></div>
              <div v-if="hoveredElement" class="flex items-center gap-2">
                <code class="text-xs bg-neutral-100 px-2 py-0.5 rounded truncate max-w-xs">{{ hoveredElement.xpath }}</code>
                <button @click="selectElement(hoveredElement)" class="text-xs text-primary-600 hover:text-primary-700 font-medium">+添加</button>
              </div>
              <div class="text-xs text-fg-muted">元素: {{ pageElements.length }}</div>
            </div>
            
            <div class="flex-1 relative bg-white">
              <!-- Loading Overlay -->
              <div v-if="pageLoading" class="absolute inset-0 bg-white/80 flex items-center justify-center z-10">
                <div class="flex flex-col items-center gap-2">
                  <div class="typing-indicator"><span></span><span></span><span></span></div>
                  <p class="text-fg-muted text-sm">页面加载中...</p>
                </div>
              </div>

              <!-- Empty State -->
              <div v-if="!webviewSrc && !pageLoading" class="absolute inset-0 flex items-center justify-center">
                <div class="text-center">
                  <svg class="w-12 h-12 mx-auto text-neutral-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                  </svg>
                  <p class="text-sm text-fg-muted">输入URL并加载页面</p>
                </div>
              </div>

              <!-- Webview -->
              <webview
                v-if="webviewSrc"
                ref="webviewRef"
                :key="webviewKey"
                class="w-full h-full"
                :src="webviewSrc"
                allowpopups
                disablewebsecurity
                nodeintegrationinsubframes
                webpreferences="allowRunningInsecureContent"
                @did-start-loading="onPageStartLoading"
                @did-stop-loading="onPageLoaded"
                @did-fail-load="onPageLoadError"
                @dom-ready="onDomReady"
                @console-message="onConsoleMessage"
              />

              <!-- Element Selection Overlay -->
              <div
                v-if="webviewSrc && !pageLoading && showMask"
                class="absolute inset-0 z-20 pointer-events-none"
                style="background: transparent;"
              >
                <svg class="w-full h-full pointer-events-none">
                  <!-- Slot elements (blue) -->
                  <g v-for="(item, idx) in slotElements" :key="item.slot.id">
                    <rect
                      v-if="item.element"
                      :x="item.element.rect.x - scrollOffset.x"
                      :y="item.element.rect.y - scrollOffset.y"
                      :width="item.element.rect.width"
                      :height="item.element.rect.height"
                      :rx="3"
                      :ry="3"
                      fill="rgba(59, 130, 246, 0.15)"
                      stroke="#3B82F6"
                      stroke-width="2"
                      class="pointer-events-none"
                    />
                    <text
                      v-if="item.element"
                      :x="item.element.rect.x - scrollOffset.x + item.element.rect.width + 4"
                      :y="item.element.rect.y - scrollOffset.y + 10"
                      fill="#3B82F6"
                      font-size="10"
                      font-weight="500"
                      class="pointer-events-none"
                    >{{ idx + 1 }}</text>
                  </g>
                  
                  <!-- Selected elements (green) -->
                  <g v-for="(el, idx) in selectedElements" :key="idx">
                    <rect
                      :x="el.rect.x - scrollOffset.x"
                      :y="el.rect.y - scrollOffset.y"
                      :width="el.rect.width"
                      :height="el.rect.height"
                      :rx="3"
                      :ry="3"
                      fill="rgba(34, 197, 94, 0.15)"
                      stroke="#22C55E"
                      stroke-width="2"
                      class="pointer-events-auto cursor-pointer"
                      @click.stop="onSelectedElementClick(el, idx)"
                    />
                    <text
                      :x="el.rect.x - scrollOffset.x + el.rect.width + 4"
                      :y="el.rect.y - scrollOffset.y + 10"
                      fill="#22C55E"
                      font-size="10"
                      font-weight="500"
                      class="pointer-events-none"
                    >{{ idx + 1 }}</text>
                  </g>
                  
                  <!-- Hover preview (purple) -->
                  <g v-if="isSelectingElement && hoveredElement">
                    <rect
                      :x="hoveredElement.rect.x - scrollOffset.x"
                      :y="hoveredElement.rect.y - scrollOffset.y"
                      :width="hoveredElement.rect.width"
                      :height="hoveredElement.rect.height"
                      :rx="3"
                      :ry="3"
                      fill="rgba(124, 58, 237, 0.15)"
                      stroke="#7C3AED"
                      stroke-width="2"
                      stroke-dasharray="4,4"
                      class="pointer-events-auto cursor-pointer"
                      @click.stop="selectElement(hoveredElement)"
                    />
                  </g>
                </svg>
                
                <!-- Mouse tracking overlay -->
                <div
                  v-if="isSelectingElement"
                  class="absolute inset-0 pointer-events-auto"
                  style="background: transparent;"
                  @mousemove="onMaskMouseMove"
                  @click="onMaskClick"
                ></div>
              </div>
            </div>
          </div>

          <!-- Right Panels Container -->
          <div v-if="loginType === 'web'" class="flex flex-col bg-white w-[420px] flex-shrink-0">
            <!-- Element Tree Panel (Top) -->
            <div class="flex-1 flex flex-col border-b border-neutral-200 min-h-0 overflow-hidden">
              <div class="px-3 py-2 border-b border-neutral-200 flex items-center justify-between bg-neutral-50">
                <div class="flex items-center gap-2">
                  <svg class="w-4 h-4 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                  </svg>
                  <span class="font-medium text-sm text-fg-primary">元素树</span>
                  <span v-if="pageElements.length > 0" class="px-1.5 py-0.5 text-xs bg-primary-100 text-primary-700 rounded">{{ pageElements.length }}</span>
                </div>
              </div>
              <div class="flex-1 overflow-auto p-2">
                <div v-if="pageElements.length === 0" class="text-center py-6 text-xs text-fg-muted">
                  加载页面后显示元素
                </div>
                <div v-else class="space-y-0.5 text-xs">
                  <template v-for="node in elementTree" :key="node.path">
                    <div 
                      v-for="el in node.elements" 
                      :key="el.xpath"
                      class="group flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer hover:bg-primary-50 transition-colors"
                      :class="{ 'bg-primary-100': hoveredElement?.xpath === el.xpath }"
                      @mouseenter="hoveredElement = el"
                      @mouseleave="hoveredElement = null"
                      @dblclick="selectElement(el)"
                    >
                      <span class="w-5 h-5 rounded bg-neutral-200 flex items-center justify-center text-[10px] text-fg-muted font-mono flex-shrink-0">
                        {{ node.tagName.charAt(0).toUpperCase() }}
                      </span>
                      <span class="font-mono text-fg-primary truncate">{{ node.tagName }}</span>
                      <span v-if="el.idCls" class="text-primary-600 font-mono truncate">{{ el.idCls }}</span>
                      <div class="flex-1"></div>
                      <button 
                        @click.stop="selectElement(el)"
                        class="opacity-0 group-hover:opacity-100 px-1.5 py-0.5 text-[10px] bg-primary-600 text-white rounded hover:bg-primary-700 transition-all"
                      >
                        +
                      </button>
                    </div>
                    <!-- Child nodes -->
                    <div v-for="child in node.children" :key="child.path" class="ml-3 pl-2 border-l border-neutral-200">
                      <div
                        v-for="cel in child.elements"
                        :key="cel.xpath"
                        class="group flex items-center gap-2 px-2 py-1 rounded cursor-pointer hover:bg-primary-50 transition-colors"
                        :class="{ 'bg-primary-100': hoveredElement?.xpath === cel.xpath }"
                        @mouseenter="hoveredElement = cel"
                        @mouseleave="hoveredElement = null"
                        @dblclick="selectElement(cel)"
                      >
                        <span class="w-4 h-4 rounded bg-neutral-200 flex items-center justify-center text-[9px] text-fg-muted font-mono flex-shrink-0">
                          {{ child.tagName.charAt(0).toUpperCase() }}
                        </span>
                        <span class="font-mono text-fg-primary truncate">{{ child.tagName }}</span>
                        <span v-if="cel.idCls" class="text-primary-600 font-mono truncate">{{ cel.idCls }}</span>
                        <div class="flex-1"></div>
                        <button 
                          @click.stop="selectElement(cel)"
                          class="opacity-0 group-hover:opacity-100 px-1 py-0.5 text-[9px] bg-primary-600 text-white rounded hover:bg-primary-700 transition-all"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </template>
                </div>
              </div>
            </div>

            <!-- Slots Panel (Bottom) -->
            <div class="flex-1 flex flex-col min-h-0 overflow-hidden">
              <div class="px-3 py-2 border-b border-neutral-200 flex items-center justify-between bg-neutral-50">
                <div class="flex items-center gap-2">
                  <svg class="w-4 h-4 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
                  </svg>
                  <span class="font-medium text-sm text-fg-primary">操作步骤</span>
                  <span v-if="slots.length > 0" class="px-1.5 py-0.5 text-xs bg-primary-100 text-primary-700 rounded">{{ slots.length }}</span>
                </div>
                <button @click="addSlot" class="text-xs text-primary-600 hover:text-primary-700 font-medium">+ 添加</button>
              </div>
              <div class="flex-1 overflow-auto p-2">
                <div v-if="slots.length === 0" class="text-center py-6 text-xs text-fg-muted">
                  选择元素或点击添加
                </div>
                <div v-else>
                  <div
                    v-for="(slot, index) in slots"
                    :key="slot.id"
                    :id="'slot-' + slot.id"
                    class="py-2 text-xs border-b border-neutral-200 last:border-b-0"
                  >
                    <div class="flex items-center gap-2 mb-2">
                      <span class="w-5 h-5 rounded bg-primary-100 text-primary-700 flex items-center justify-center font-medium">{{ index + 1 }}</span>
                      <select v-model="slot.action_type" class="flex-1 bg-white border border-neutral-200 rounded px-1.5 py-0.5 text-xs">
                        <option value="input">输入</option>
                        <option value="click">点击</option>
                        <option value="select">选择</option>
                      </select>
                      <button @click="deleteSlot(slot.id)" class="text-neutral-400 hover:text-error-500">
                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </div>
                    <div class="space-y-1">
                      <div class="flex gap-2 items-center">
                        <span class="text-fg-muted w-8 flex-shrink-0">XPath:</span>
                        <input :id="'xpath-' + slot.id" v-model="slot.element_xpath" type="text" class="flex-1 bg-white border border-neutral-200 rounded px-1.5 py-0.5 font-mono text-[10px]" placeholder="元素路径" />
                      </div>
                      <div v-if="slot.action_type === 'input'" class="flex gap-2 items-center">
                        <span class="text-fg-muted w-8 flex-shrink-0">值:</span>
                        <input v-model="slot.value" :type="slot.is_encrypted ? 'password' : 'text'" class="flex-1 bg-white border border-neutral-200 rounded px-1.5 py-0.5" placeholder="输入值" />
                      </div>
                      <div class="flex gap-2 items-center">
                        <label class="flex items-center gap-1 text-fg-muted">
                          <input v-model="slot.is_encrypted" type="checkbox" class="rounded" />
                          加密
                        </label>
                        <span class="text-fg-muted ml-auto">延时:</span>
                        <input v-model.number="slot.timeout" type="number" class="w-14 bg-white border border-neutral-200 rounded px-1.5 py-0.5" />
                        <span class="text-fg-muted">ms</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- SSH Panel -->
          <div v-if="loginType === 'ssh'" class="flex-1 flex overflow-hidden">
            <!-- SSH Terminal Webview (Center) -->
            <div class="flex-1 flex flex-col min-w-0 border-r border-neutral-200">
              <div class="px-4 py-2 bg-white border-b border-neutral-200 flex items-center gap-2">
                <svg class="w-4 h-4 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span class="font-medium text-sm text-fg-primary">SSH 终端</span>
                <div class="flex-1"></div>
                <div v-if="sshError" class="text-xs text-error-600">{{ sshError }}</div>
                <div v-else-if="sshConnected" class="flex items-center gap-2">
                  <span class="text-xs text-success-600 flex items-center gap-1">
                    <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
                    </svg>
                    已连接
                  </span>
                  <button @click="disconnectSSH" class="text-xs px-2 py-1 bg-error-100 text-error-600 rounded hover:bg-error-200 transition-colors">
                    断开连接
                  </button>
                </div>
              </div>
              <div class="flex-1 relative bg-white">
                <!-- Empty State -->
                <div v-if="!sshWebviewSrc" class="absolute inset-0 flex items-center justify-center">
                  <div class="text-center">
                    <svg class="w-12 h-12 mx-auto text-neutral-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <p class="text-sm text-fg-muted">填写认证信息并点击连接</p>
                  </div>
                </div>
                
                <!-- SSH Terminal Webview -->
                <webview
                  v-if="sshWebviewSrc"
                  :key="sshWebviewKey"
                  class="w-full h-full"
                  :src="sshWebviewSrc"
                  allowpopups
                />
              </div>
            </div>
            
            <!-- SSH Auth Panel (Right) -->
            <div class="w-[420px] flex-shrink-0 bg-white flex flex-col">
              <div class="px-3 py-2 border-b border-neutral-200 bg-neutral-50 flex items-center gap-2">
                <svg class="w-4 h-4 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
                <span class="font-medium text-sm text-fg-primary">SSH 认证</span>
              </div>
              <div class="flex-1 overflow-auto p-4">
                <div class="space-y-4">
                  <!-- Username -->
                  <div>
                    <label class="text-xs text-fg-muted block mb-1">用户名 (可选)</label>
                    <input v-model="sshConfig.username" type="text" class="w-full text-sm" placeholder="留空使用系统默认" />
                  </div>
                  
                  <!-- Password -->
                  <div>
                    <label class="text-xs text-fg-muted block mb-1">密码 (可选)</label>
                    <input v-model="sshConfig.password" type="password" class="w-full text-sm" placeholder="••••••••" />
                  </div>
                  
                  <!-- Keyfile -->
                  <div>
                    <label class="text-xs text-fg-muted block mb-1">id_rsa 密钥文件 (可选)</label>
                    <div class="flex gap-2">
                      <input :value="sshConfig.keyfilePath" type="text" class="flex-1 text-sm bg-neutral-100" placeholder="选择密钥文件..." readonly />
                      <button @click="selectKeyfile" class="btn-secondary text-xs px-2">选择</button>
                    </div>
                  </div>
                  
                  <!-- Passphrase for keyfile -->
                  <div v-if="sshConfig.keyfilePath">
                    <label class="text-xs text-fg-muted block mb-1">密钥密码 (可选)</label>
                    <input v-model="sshConfig.passphrase" type="password" class="w-full text-sm" placeholder="••••••••" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div v-else class="flex-1 flex items-center justify-center">
        <div class="text-center">
          <svg class="w-16 h-16 mx-auto text-neutral-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
          <p class="text-fg-muted">请选择或创建一个步骤页</p>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useEndpointStore } from '../stores/endpoint'
import { pageApi, slotApi, sshApi, type Page, type Slot } from '../apis'
import { safeConfirm, messageError, messageInfo, messageWarning } from '../utils/dialog'

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

const route = useRoute()
const router = useRouter()
const endpointStore = useEndpointStore()

const isNew = computed(() => route.params.id === 'new')
const endpointId = computed(() => isNew.value ? null : Number(route.params.id))

const endpointName = ref('')
const loginType = ref<'web' | 'ssh'>('web')
const pages = ref<(Page & { slots: Slot[] })[]>([])
const selectedPageId = ref<number | null>(null)
const saving = ref(false)

const webviewRef = ref<any>(null)
const webviewSrc = ref('')
const webviewKey = ref(0)
const pageLoading = ref(false)
const isSelectingElement = ref(false)
const hoveredElement = ref<PageElement | null>(null)
const selectedElements = ref<PageElement[]>([])
const pageElements = ref<PageElement[]>([])
const scrollOffset = ref({ x: 0, y: 0 })
const executing = ref(false)
const showMask = ref(true)

// SSH 状态
const sshConfig = ref({
  username: '',
  password: '',
  keyfilePath: '',
  passphrase: ''
})
const sshConnecting = ref(false)
const sshConnected = ref(false)
const sshError = ref('')
const sshWebviewSrc = ref('')
const sshWebviewKey = ref(0)

const selectedPage = computed(() => {
  if (!selectedPageId.value) return null
  return pages.value.find(p => p.id === selectedPageId.value) || null
})

const slots = computed(() => selectedPage.value?.slots || [])

const slotElements = computed(() => {
  const result: { slot: Slot; element: PageElement | null }[] = []
  for (const slot of slots.value) {
    const element = pageElements.value.find(el => el.xpath === slot.element_xpath) || null
    result.push({ slot, element })
  }
  return result
})

// Build element tree
const elementTree = computed(() => {
  const root: ElementTreeNode = { path: '', tagName: 'root', children: [], elements: [] }
  
  for (const element of pageElements.value) {
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

// SSH 配置验证 - 所有认证字段都是可选的
const isSSHConfigValid = computed(() => {
  return !!selectedPage.value?.url
})

// 解析 SSH 地址（host:port 或 host）
function parseSSHAddress(address: string): { host: string; port: number } {
  const parts = address.trim().split(':')
  if (parts.length === 2) {
    const port = parseInt(parts[1], 10)
    return { host: parts[0], port: isNaN(port) ? 22 : port }
  }
  return { host: address.trim(), port: 22 }
}

// 选择密钥文件
async function selectKeyfile() {
  try {
    const result = await sshApi.selectKeyfile()
    if (!result.canceled && result.filePaths.length > 0) {
      sshConfig.value.keyfilePath = result.filePaths[0]
    }
  } catch (e: any) {
    console.error('选择密钥文件失败:', e)
  }
}

// 连接 SSH
async function connectSSH() {
  if (!isSSHConfigValid.value || !selectedPage.value) return
  
  sshConnecting.value = true
  sshError.value = ''
  
  try {
    // 检查 ttyd 是否安装
    const ttydStatus = await sshApi.checkTtyd()
    
    // 处理 GLIBC 兼容性问题
    if (ttydStatus.error && ttydStatus.error.includes('GLIBC')) {
      sshConnecting.value = false
      sshError.value = ttydStatus.error
      messageError(ttydStatus.error)
      return
    }
    
    if (!ttydStatus.installed || !ttydStatus.available) {
      // 弹出确认对话框
      const shouldInstall = await safeConfirm('ttyd 未安装，是否自动下载安装？\n\nttyd 是 SSH 终端服务，安装后即可连接 SSH。\n\n或者运行: sudo apt install ttyd', {
        title: '安装 ttyd',
        confirmText: '安装',
        type: 'info'
      })
      
      if (!shouldInstall) {
        sshConnecting.value = false
        sshError.value = 'ttyd 未安装，无法连接 SSH'
        return
      }
      
      // 安装 ttyd
      sshError.value = '正在下载安装 ttyd...'
      const installResult = await sshApi.installTtyd()
      
      if (!installResult.success) {
        sshConnecting.value = false
        sshError.value = installResult.message
        return
      }
      
      // 再次检查兼容性
      const recheck = await sshApi.checkTtyd()
      if (recheck.error) {
        sshConnecting.value = false
        sshError.value = recheck.error
        messageError(recheck.error)
        return
      }
      
      // 安装成功，清除提示
      sshError.value = ''
    }
    
    // 解析 SSH 地址
    const { host, port } = parseSSHAddress(selectedPage.value.url)
    
    // 连接 SSH
    const result = await sshApi.startTtyd({
      host,
      port,
      username: sshConfig.value.username || undefined,
      password: sshConfig.value.password || undefined,
      keyfilePath: sshConfig.value.keyfilePath || undefined,
      passphrase: sshConfig.value.passphrase || undefined
    })
    
    if (result.success) {
      sshConnected.value = true
      // 等待 ttyd 启动
      await new Promise(resolve => setTimeout(resolve, 500))
      sshWebviewKey.value++
      sshWebviewSrc.value = 'http://127.0.0.1:7681'
    } else if (result.message.startsWith('NEED_PUTTY:')) {
      // 需要安装 PuTTY
      const msg = result.message.replace('NEED_PUTTY:', '')
      const shouldInstall = await safeConfirm(`${msg}\n\n是否立即安装 PuTTY？`, {
        title: '安装 PuTTY',
        confirmText: '安装',
        type: 'info'
      })
      
      if (shouldInstall) {
        sshError.value = '正在安装 PuTTY...'
        const installResult = await sshApi.installPuTTY()
        
        if (installResult.success) {
          // 等待安装完成后重试
          await new Promise(resolve => setTimeout(resolve, 3000))
          sshError.value = ''
          // 重新连接
          const retryResult = await sshApi.startTtyd({
            host,
            port,
            username: sshConfig.value.username || undefined,
            password: sshConfig.value.password || undefined,
            keyfilePath: sshConfig.value.keyfilePath || undefined,
            passphrase: sshConfig.value.passphrase || undefined
          })
          
          if (retryResult.success) {
            sshConnected.value = true
            await new Promise(resolve => setTimeout(resolve, 500))
            sshWebviewKey.value++
            sshWebviewSrc.value = 'http://127.0.0.1:7681'
          } else {
            sshError.value = retryResult.message
          }
        } else {
          sshError.value = installResult.message
        }
      } else {
        sshError.value = msg
      }
    } else {
      sshError.value = result.message
    }
  } catch (e: any) {
    sshError.value = e.message || '连接失败'
  } finally {
    sshConnecting.value = false
  }
}

// 断开 SSH
async function disconnectSSH() {
  try {
    await sshApi.stopTtyd()
  } catch (e) {
    console.error('断开连接失败:', e)
  }
  sshConnected.value = false
  sshWebviewSrc.value = ''
}

onMounted(async () => {
  if (!isNew.value && endpointId.value) {
    const endpoint = await endpointStore.loadEndpoint(endpointId.value)
    if (endpoint) {
      endpointName.value = endpoint.name
      loginType.value = endpoint.login_type
      pages.value = endpoint.pages
      if (pages.value.length > 0) {
        selectedPageId.value = pages.value[0].id
        
        // 恢复 SSH 认证信息 - 从独立的 slots 读取
        if (loginType.value === 'ssh') {
          const slots = pages.value[0].slots || []
          // 用户名
          const usernameSlot = slots.find(s => s.name === 'SSH用户名')
          if (usernameSlot) sshConfig.value.username = usernameSlot.value || ''
          // 密码
          const passwordSlot = slots.find(s => s.name === 'SSH密码')
          if (passwordSlot) sshConfig.value.password = passwordSlot.value || ''
          // 密钥文件
          const keyfileSlot = slots.find(s => s.name === 'SSH密钥文件')
          if (keyfileSlot) sshConfig.value.keyfilePath = keyfileSlot.value || ''
          // 密钥密码
          const passphraseSlot = slots.find(s => s.name === 'SSH密钥密码')
          if (passphraseSlot) sshConfig.value.passphrase = passphraseSlot.value || ''
        }
        
        if (pages.value[0].url && loginType.value === 'web') {
          const url = pages.value[0].url
          const fullUrl = url.startsWith('http://') || url.startsWith('https://') ? url : 'http://' + url
          nextTick(() => {
            webviewSrc.value = fullUrl
          })
        }
      }
    }
  } else if (isNew.value) {
    const tempId = Date.now()
    pages.value.push({ 
      id: tempId, 
      endpoint_id: 0, 
      order_index: 0, 
      url: '', 
      slots: [], 
      created_at: new Date().toISOString(), 
      updated_at: new Date().toISOString() 
    })
    selectedPageId.value = tempId
  }
})

// 组件卸载时清理 SSH 连接
onUnmounted(() => {
  if (sshConnected.value) {
    disconnectSSH()
  }
})

watch(selectedPageId, () => {
  if (executing.value) return
  webviewSrc.value = ''
  pageLoading.value = false
  isSelectingElement.value = false
  hoveredElement.value = null
  pageElements.value = []
  selectedElements.value = []
})

function selectPage(pageId: number) {
  const pageIndex = pages.value.findIndex(p => p.id === pageId)
  if (pageIndex === -1) return
  
  if (pageIndex === 0 && pages.value[0]?.url) {
    const url = pages.value[0].url
    const fullUrl = url.startsWith('http://') || url.startsWith('https://') ? url : 'http://' + url
    webviewKey.value++
    webviewSrc.value = fullUrl
  } else {
    executePages(0, pageIndex, false)
  }
  
  selectedPageId.value = pageId
  isSelectingElement.value = false
  hoveredElement.value = null
}

async function deletePage(pageId: number) {
  if (loginType.value === 'ssh') return
  if (pages.value.length <= 1) return
  
  try {
    if (pageId > 0 && !isNew.value) {
      await pageApi.delete(pageId)
    }
  } catch {
    // Ignore
  }
  
  const index = pages.value.findIndex(p => p.id === pageId)
  if (index !== -1) {
    pages.value.splice(index, 1)
  }
  
  if (selectedPageId.value === pageId) {
    if (pages.value.length > 0) {
      selectedPageId.value = pages.value[0].id
    } else {
      selectedPageId.value = null
      webviewSrc.value = ''
    }
  }
}

async function addPage() {
  try {
    const tempId = Date.now()
    if (isNew.value) {
      pages.value.push({ id: tempId, endpoint_id: endpointId.value || 0, order_index: pages.value.length, url: '', slots: [], created_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    } else {
      const page = await pageApi.create({ endpoint_id: endpointId.value!, url: '' })
      pages.value.push({ ...page, slots: [] })
    }
    executePages(0, pages.value.length - 1, true)
  } catch (e: any) {
    console.error('添加步骤页失败:', e)
  }
}

async function executePages(fromIndex: number, toIndex: number, executeLastPageSlots: boolean) {
  if (executing.value) return
  executing.value = true
  
  try {
    for (let i = fromIndex; i <= toIndex && i < pages.value.length; i++) {
      const pageData = pages.value[i]
      
      if (pageData.url) {
        let url = pageData.url
        if (!url.startsWith('http://') && !url.startsWith('https://')) url = 'http://' + url
        
        console.log(`[执行] 导航到页面 ${i + 1}:`, url)
        webviewKey.value++
        webviewSrc.value = url
        
        await new Promise<void>(resolve => {
          const checkStarted = () => {
            if (pageLoading.value) {
              resolve()
            } else {
              setTimeout(checkStarted, 50)
            }
          }
          setTimeout(checkStarted, 50)
        })
      }
        
      await new Promise<void>(resolve => {
        const checkLoaded = () => {
          if (!pageLoading.value) {
            resolve()
          } else {
            setTimeout(checkLoaded, 100)
          }
        }
        setTimeout(checkLoaded, 100)
      })
      
      selectedPageId.value = pageData.id
      await new Promise(resolve => setTimeout(resolve, 500))
      
      if (i < toIndex || executeLastPageSlots) {
        for (const slot of pageData.slots) {
          try {
            console.log(`[执行] 页面 ${i + 1} 操作:`, slot.action_type, slot.element_xpath)
            
            if (!webviewRef.value) continue
            
            const jsCode = `
              (function() {
                const result = document.evaluate('${slot.element_xpath}', document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
                const element = result.singleNodeValue;
                if (element) {
                  ${slot.action_type === 'input' ? `element.value = '${slot.value.replace(/'/g, "\\'")}'; element.dispatchEvent(new Event('input', { bubbles: true }));` : 
                    slot.action_type === 'click' ? 'element.click();' : 
                    `element.value = '${slot.value}';`}
                  return true;
                }
                return false;
              })()
            `
            const result = await webviewRef.value.executeJavaScript(jsCode)
            console.log(`[执行] 操作结果:`, result ? '成功' : '元素未找到')
            await new Promise(resolve => setTimeout(resolve, slot.timeout || 200))
          } catch (e: any) {
            console.error(`[执行] 操作失败:`, e.message)
          }
        }
      }
    }
  } finally {
    executing.value = false
  }
}

function loadPage() {
  if (selectedPage.value?.url) {
    let url = selectedPage.value.url
    if (!url.startsWith('http://') && !url.startsWith('https://')) url = 'http://' + url
    pageLoading.value = true
    webviewKey.value++
    webviewSrc.value = url
    isSelectingElement.value = false
    hoveredElement.value = null
    selectedElements.value = []
    pageElements.value = []
  }
}

function onPageStartLoading() { pageLoading.value = true }
function onPageLoadError(e: any) { console.error('Page load error:', e); pageLoading.value = false }
function onPageLoaded() { pageLoading.value = false; collectPageElements() }

function onDomReady() {
  if (webviewRef.value) {
    webviewRef.value.executeJavaScript(`document.addEventListener('scroll', () => { console.log('[scroll]:', JSON.stringify({ x: window.scrollX, y: window.scrollY })); });`).catch(() => {})
  }
}

function onConsoleMessage(e: any) {
  if (e.message.startsWith('[scroll]:')) {
    try { scrollOffset.value = JSON.parse(e.message.replace('[scroll]:', '').trim()) } catch {}
  }
}

async function collectPageElements() {
  if (!webviewRef.value) return
  
  await new Promise(resolve => setTimeout(resolve, 2000))
  
  if (!webviewRef.value) return
  
  try {
    const elements = await webviewRef.value.executeJavaScript(`
      JSON.stringify(Array.from(document.getElementsByTagName('*')).map(function(el) {
        const tagName = el.tagName.toLowerCase()
        let idCls = el.id ? '#' + el.id : (el.className && typeof el.className === 'string' ? '.' + el.className.split(' ').filter(v => v).join('.') : '')
        const rect = el.getBoundingClientRect()
        let depth = 0, parent = el.parentElement
        while (parent) { depth++; parent = parent.parentElement }
        const ret = { tagName, idCls, rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height }, depth }
        if (['style', 'script', 'link', 'meta', 'head', 'header', 'title', 'noscript'].includes(tagName)) return null
        if (el === document.body) return { xpath: '/html/body', ...ret }
        if (el.id) return { xpath: '//*[@id="' + el.id + '"]', ...ret }
        let index = 1
        const siblings = el.parentElement ? el.parentElement.children : []
        for (const sibling of siblings) {
          if (sibling === el) {
            const prtEl = arguments.callee(el.parentElement)
            return prtEl ? { xpath: prtEl.xpath + '/' + tagName + '[' + index + ']', ...ret } : null
          }
          if (sibling.nodeType === 1 && sibling.tagName === el.tagName) index++
        }
        return null
      }).filter(el => el && el.rect.width > 0 && el.rect.height > 0))
    `)
    pageElements.value = JSON.parse(elements)
    console.log('Collected', pageElements.value.length, 'elements')
  } catch (e) { console.error('Failed to collect page elements:', e) }
}

function findElementAtPoint(x: number, y: number): PageElement | null {
  if (!pageElements.value?.length) return null
  const candidates: PageElement[] = []
  for (const el of pageElements.value) {
    if (!el?.rect) continue
    if (x >= el.rect.x && x <= el.rect.x + el.rect.width && y >= el.rect.y && y <= el.rect.y + el.rect.height) {
      candidates.push(el)
    }
  }
  if (!candidates.length) return null
  let deepest = candidates[0]
  for (const el of candidates) { if (el.depth > deepest.depth) deepest = el }
  return deepest
}

function onMaskMouseMove(e: MouseEvent) {
  if (!isSelectingElement.value) return
  hoveredElement.value = findElementAtPoint(e.offsetX + scrollOffset.value.x, e.offsetY + scrollOffset.value.y)
}

function onMaskClick() { if (hoveredElement.value) selectElement(hoveredElement.value) }

function toggleSelecting() { 
  isSelectingElement.value = !isSelectingElement.value
  if (!isSelectingElement.value) hoveredElement.value = null
}

function selectElement(element: PageElement) {
  if (!selectedPage.value) return
  selectedElements.value.push(element)
  const newSlotId = Date.now()
  selectedPage.value.slots.push({ 
    id: newSlotId, 
    page_id: selectedPage.value.id, 
    order_index: selectedPage.value.slots.length, 
    name: '',
    element_xpath: element.xpath, 
    action_type: 'input', 
    value: '', 
    is_encrypted: false, 
    timeout: 200, 
    created_at: new Date().toISOString(), 
    updated_at: new Date().toISOString() 
  })
  hoveredElement.value = null
  isSelectingElement.value = false
  
  // 滚动到新添加的步骤并聚焦 xpath 输入框
  nextTick(() => {
    const slotEl = document.getElementById('slot-' + newSlotId)
    const xpathInput = document.getElementById('xpath-' + newSlotId) as HTMLInputElement | null
    if (slotEl) {
      slotEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
    if (xpathInput) {
      xpathInput.focus()
      xpathInput.select()
    }
  })
}

function onSelectedElementClick(element: PageElement, index: number) {
  if (isSelectingElement.value) return
  messageInfo(`元素XPath: ${element.xpath}，操作序号: ${index + 1}`)
}

function addSlot() {
  // 点击添加按钮时，先进入选择元素模式
  // 选择元素后会自动添加操作步骤
  isSelectingElement.value = true
}

async function deleteSlot(slotId: number) {
  if (!selectedPage.value) return
  if (slotId > 0) await slotApi.delete(slotId)
  selectedPage.value.slots = selectedPage.value.slots.filter(s => s.id !== slotId)
}

async function handleSave() {
  if (!endpointName.value.trim()) { messageWarning('请输入登录端名称'); return }
  saving.value = true
  try {
    // SSH 登录：将认证信息分别存储为独立的 slot
    if (loginType.value === 'ssh' && pages.value.length > 0) {
      const sshPage = pages.value[0]
      
      // 清除之前的 SSH 认证 slots
      sshPage.slots = sshPage.slots.filter(s => !s.name?.startsWith('SSH'))
      
      let orderIndex = 0
      
      // 用户名 - 单独的 slot
      if (sshConfig.value.username) {
        sshPage.slots.push({
          id: Date.now() + orderIndex,
          page_id: sshPage.id,
          order_index: orderIndex++,
          name: 'SSH用户名',
          element_xpath: '',
          action_type: 'input',
          value: sshConfig.value.username,
          is_encrypted: false,
          timeout: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
      }
      
      // 密码 - 单独的 slot，需要加密
      if (sshConfig.value.password) {
        sshPage.slots.push({
          id: Date.now() + orderIndex,
          page_id: sshPage.id,
          order_index: orderIndex++,
          name: 'SSH密码',
          element_xpath: '',
          action_type: 'input',
          value: sshConfig.value.password,
          is_encrypted: true, // 密码需要加密
          timeout: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
      }
      
      // 密钥文件路径 - 单独的 slot
      if (sshConfig.value.keyfilePath) {
        sshPage.slots.push({
          id: Date.now() + orderIndex,
          page_id: sshPage.id,
          order_index: orderIndex++,
          name: 'SSH密钥文件',
          element_xpath: '',
          action_type: 'input',
          value: sshConfig.value.keyfilePath,
          is_encrypted: false,
          timeout: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
      }
      
      // 密钥密码 - 单独的 slot，需要加密
      if (sshConfig.value.passphrase) {
        sshPage.slots.push({
          id: Date.now() + orderIndex,
          page_id: sshPage.id,
          order_index: orderIndex++,
          name: 'SSH密钥密码',
          element_xpath: '',
          action_type: 'input',
          value: sshConfig.value.passphrase,
          is_encrypted: true, // 密钥密码需要加密
          timeout: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
      }
    }
    
    if (isNew.value) {
      const endpoint = await endpointStore.createEndpoint({ name: endpointName.value, login_type: loginType.value })
      if (endpoint) {
        for (const page of pages.value) {
          const createdPage = await pageApi.create({ endpoint_id: endpoint.id, url: page.url })
          for (const slot of page.slots) await slotApi.create({ 
            page_id: createdPage.id, 
            name: slot.name, 
            element_xpath: slot.element_xpath, 
            action_type: slot.action_type, 
            value: slot.value, 
            is_encrypted: slot.is_encrypted, 
            timeout: slot.timeout
          })
        }
        router.push('/home')
      }
    } else {
      await endpointStore.updateEndpoint(endpointId.value!, { name: endpointName.value, login_type: loginType.value })
      for (const page of pages.value) {
        if (page.id < 0) {
          const createdPage = await pageApi.create({ endpoint_id: endpointId.value!, url: page.url })
          for (const slot of page.slots) await slotApi.create({ 
            page_id: createdPage.id, 
            name: slot.name, 
            element_xpath: slot.element_xpath, 
            action_type: slot.action_type, 
            value: slot.value, 
            is_encrypted: slot.is_encrypted, 
            timeout: slot.timeout
          })
        } else {
          await pageApi.update(page.id, { url: page.url })
          // 删除旧的 slots
          for (const oldSlot of await slotApi.list(page.id)) {
            await slotApi.delete(oldSlot.id)
          }
          // 创建新的 slots
          for (const slot of page.slots) {
            await slotApi.create({ 
              page_id: page.id, 
              name: slot.name, 
              element_xpath: slot.element_xpath, 
              action_type: slot.action_type, 
              value: slot.value, 
              is_encrypted: slot.is_encrypted, 
              timeout: slot.timeout
            })
          }
        }
      }
      router.push('/home')
    }
  } catch (e: any) { messageError('保存失败: ' + e.message) } finally { saving.value = false }
}
</script>
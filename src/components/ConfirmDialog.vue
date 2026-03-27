<template>
  <Teleport to="body">
    <Transition name="confirm">
      <div v-if="visible" class="confirm-overlay" @click.self="handleCancel">
        <div class="confirm-dialog">
          <div class="confirm-header">
            <div class="confirm-icon" :class="`confirm-icon-${type}`">
              <!-- Danger Icon -->
              <svg v-if="type === 'danger'" class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <!-- Warning Icon -->
              <svg v-else-if="type === 'warning'" class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <!-- Info Icon -->
              <svg v-else class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 class="confirm-title">{{ title }}</h3>
          </div>
          <div class="confirm-body">
            <p class="confirm-message">{{ message }}</p>
          </div>
          <div class="confirm-footer">
            <button class="confirm-btn confirm-btn-cancel" @click="handleCancel">
              {{ cancelText }}
            </button>
            <button class="confirm-btn confirm-btn-confirm" :class="`confirm-btn-${type}`" @click="handleConfirm">
              {{ confirmText }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useNotificationStore } from '../stores/notification'

const notificationStore = useNotificationStore()

const visible = computed(() => notificationStore.confirmDialog.visible)
const title = computed(() => notificationStore.confirmDialog.title)
const message = computed(() => notificationStore.confirmDialog.message)
const confirmText = computed(() => notificationStore.confirmDialog.confirmText)
const cancelText = computed(() => notificationStore.confirmDialog.cancelText)
const type = computed(() => notificationStore.confirmDialog.type)

const handleConfirm = notificationStore.handleConfirm
const handleCancel = notificationStore.handleCancel
</script>

<style scoped>
.confirm-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(4px);
}

.confirm-dialog {
  background: white;
  border-radius: 12px;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1),
              0 10px 10px -5px rgba(0, 0, 0, 0.04);
  width: 400px;
  max-width: 90vw;
  overflow: hidden;
}

.confirm-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 20px 24px 16px;
}

.confirm-icon {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 50%;
}

.confirm-icon-danger {
  background: #fef2f2;
  color: #ef4444;
}

.confirm-icon-warning {
  background: #fffbeb;
  color: #f59e0b;
}

.confirm-icon-info {
  background: #eff6ff;
  color: #3b82f6;
}

.confirm-title {
  font-size: 18px;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.88);
  margin: 0;
}

.confirm-body {
  padding: 0 24px 20px;
}

.confirm-message {
  font-size: 14px;
  color: rgba(0, 0, 0, 0.65);
  margin: 0;
  white-space: pre-wrap;
  line-height: 1.6;
}

.confirm-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 24px;
  background: #fafafa;
  border-top: 1px solid #f0f0f0;
}

.confirm-btn {
  padding: 8px 20px;
  font-size: 14px;
  font-weight: 500;
  border-radius: 6px;
  border: none;
  cursor: pointer;
  transition: all 0.2s;
}

.confirm-btn-cancel {
  background: white;
  border: 1px solid #d9d9d9;
  color: rgba(0, 0, 0, 0.88);
}

.confirm-btn-cancel:hover {
  border-color: #1677ff;
  color: #1677ff;
}

.confirm-btn-confirm {
  background: #1677ff;
  color: white;
}

.confirm-btn-confirm:hover {
  background: #4096ff;
}

.confirm-btn-danger {
  background: #ef4444;
}

.confirm-btn-danger:hover {
  background: #f87171;
}

.confirm-btn-warning {
  background: #f59e0b;
}

.confirm-btn-warning:hover {
  background: #fbbf24;
}

/* Transitions */
.confirm-enter-active,
.confirm-leave-active {
  transition: all 0.25s ease;
}

.confirm-enter-active .confirm-dialog,
.confirm-leave-active .confirm-dialog {
  transition: all 0.25s ease;
}

.confirm-enter-from,
.confirm-leave-to {
  opacity: 0;
}

.confirm-enter-from .confirm-dialog,
.confirm-leave-to .confirm-dialog {
  transform: scale(0.95);
  opacity: 0;
}
</style>
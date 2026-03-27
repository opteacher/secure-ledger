<template>
  <Teleport to="body">
    <div class="notification-container">
      <TransitionGroup name="notification">
        <div
          v-for="notification in notifications"
          :key="notification.id"
          class="notification-item"
          :class="`notification-${notification.type}`"
        >
          <div class="notification-icon">
            <!-- Success Icon -->
            <svg v-if="notification.type === 'success'" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>
            <!-- Error Icon -->
            <svg v-else-if="notification.type === 'error'" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
            <!-- Warning Icon -->
            <svg v-else-if="notification.type === 'warning'" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <!-- Info Icon -->
            <svg v-else class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div class="notification-content">
            <div class="notification-message">{{ notification.message }}</div>
            <div v-if="notification.description" class="notification-description">
              {{ notification.description }}
            </div>
          </div>
          <button class="notification-close" @click="removeNotification(notification.id)">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useNotificationStore } from '../stores/notification'

const notificationStore = useNotificationStore()
const notifications = computed(() => notificationStore.notifications)
const removeNotification = notificationStore.removeNotification
</script>

<style scoped>
.notification-container {
  position: fixed;
  top: 16px;
  right: 16px;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  gap: 12px;
  pointer-events: none;
}

.notification-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 16px 20px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 6px 16px 0 rgba(0, 0, 0, 0.08),
              0 3px 6px -4px rgba(0, 0, 0, 0.12),
              0 9px 28px 8px rgba(0, 0, 0, 0.05);
  min-width: 320px;
  max-width: 420px;
  pointer-events: auto;
  border-left: 4px solid;
}

.notification-success {
  border-left-color: #52c41a;
}

.notification-error {
  border-left-color: #ff4d4f;
}

.notification-warning {
  border-left-color: #faad14;
}

.notification-info {
  border-left-color: #1677ff;
}

.notification-icon {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.notification-success .notification-icon {
  color: #52c41a;
}

.notification-error .notification-icon {
  color: #ff4d4f;
}

.notification-warning .notification-icon {
  color: #faad14;
}

.notification-info .notification-icon {
  color: #1677ff;
}

.notification-content {
  flex: 1;
  min-width: 0;
}

.notification-message {
  font-size: 14px;
  font-weight: 500;
  color: rgba(0, 0, 0, 0.88);
  line-height: 1.5;
}

.notification-description {
  font-size: 13px;
  color: rgba(0, 0, 0, 0.45);
  margin-top: 4px;
  line-height: 1.5;
}

.notification-close {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  margin: -4px -4px -4px 0;
  border: none;
  background: transparent;
  color: rgba(0, 0, 0, 0.25);
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.2s;
}

.notification-close:hover {
  color: rgba(0, 0, 0, 0.45);
  background: rgba(0, 0, 0, 0.04);
}

/* Transitions */
.notification-enter-active {
  animation: notification-in 0.3s ease-out;
}

.notification-leave-active {
  animation: notification-out 0.3s ease-in;
}

@keyframes notification-in {
  from {
    opacity: 0;
    transform: translateX(100%);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

@keyframes notification-out {
  from {
    opacity: 1;
    transform: translateX(0);
  }
  to {
    opacity: 0;
    transform: translateX(100%);
  }
}
</style>
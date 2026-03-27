import { defineStore } from 'pinia'
import { ref } from 'vue'

export type NotificationType = 'success' | 'error' | 'warning' | 'info'

export interface NotificationItem {
  id: string
  type: NotificationType
  message: string
  description?: string
  duration?: number
  createdAt: number
}

export interface ConfirmDialogState {
  visible: boolean
  title: string
  message: string
  confirmText: string
  cancelText: string
  type: 'danger' | 'warning' | 'info'
  resolve: ((value: boolean) => void) | null
}

export const useNotificationStore = defineStore('notification', () => {
  const notifications = ref<NotificationItem[]>([])
  const confirmDialog = ref<ConfirmDialogState>({
    visible: false,
    title: '',
    message: '',
    confirmText: 'Confirm',
    cancelText: 'Cancel',
    type: 'info',
    resolve: null
  })
  
  // 最大显示数量
  const maxNotifications = 5
  
  // 生成唯一 ID
  function generateId(): string {
    return `notification-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }
  
  // 添加通知
  function addNotification(
    type: NotificationType,
    message: string,
    description?: string,
    duration: number = 4500
  ): string {
    const id = generateId()
    
    const notification: NotificationItem = {
      id,
      type,
      message,
      description,
      duration,
      createdAt: Date.now()
    }
    
    notifications.value.push(notification)
    
    // 限制最大数量
    if (notifications.value.length > maxNotifications) {
      notifications.value.shift()
    }
    
    // 自动移除（duration = 0 时不自动关闭）
    if (duration > 0) {
      setTimeout(() => {
        removeNotification(id)
      }, duration)
    }
    
    return id
  }
  
  // 移除通知
  function removeNotification(id: string): void {
    const index = notifications.value.findIndex(n => n.id === id)
    if (index > -1) {
      notifications.value.splice(index, 1)
    }
  }
  
  // 清空所有通知
  function clearAll(): void {
    notifications.value = []
  }
  
  // 便捷方法
  function success(message: string, description?: string): string {
    return addNotification('success', message, description)
  }
  
  function error(message: string, description?: string): string {
    return addNotification('error', message, description, 6000)
  }
  
  function warning(message: string, description?: string): string {
    return addNotification('warning', message, description, 5000)
  }
  
  function info(message: string, description?: string): string {
    return addNotification('info', message, description)
  }
  
  // 显示确认对话框
  function showConfirm(
    message: string,
    options?: {
      title?: string
      confirmText?: string
      cancelText?: string
      type?: 'danger' | 'warning' | 'info'
    }
  ): Promise<boolean> {
    return new Promise((resolve) => {
      confirmDialog.value = {
        visible: true,
        title: options?.title || 'Confirm',
        message,
        confirmText: options?.confirmText || 'Confirm',
        cancelText: options?.cancelText || 'Cancel',
        type: options?.type || 'info',
        resolve
      }
    })
  }
  
  // 确认
  function handleConfirm(): void {
    if (confirmDialog.value.resolve) {
      confirmDialog.value.resolve(true)
    }
    confirmDialog.value.visible = false
    confirmDialog.value.resolve = null
  }
  
  // 取消
  function handleCancel(): void {
    if (confirmDialog.value.resolve) {
      confirmDialog.value.resolve(false)
    }
    confirmDialog.value.visible = false
    confirmDialog.value.resolve = null
  }
  
  return {
    notifications,
    confirmDialog,
    addNotification,
    removeNotification,
    clearAll,
    success,
    error,
    warning,
    info,
    showConfirm,
    handleConfirm,
    handleCancel
  }
})
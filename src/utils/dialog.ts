/**
 * 通知系统 - 替代原生 alert/confirm
 * 解决 Electron 在 Windows 上 alert 后焦点丢失的问题
 */

import { useNotificationStore } from '../stores/notification'

/**
 * 显示成功消息
 */
export function messageSuccess(message: string): void {
  const notificationStore = useNotificationStore()
  notificationStore.success(message)
}

/**
 * 显示错误消息
 */
export function messageError(message: string, description?: string): void {
  const notificationStore = useNotificationStore()
  notificationStore.error(message, description)
}

/**
 * 显示警告消息
 */
export function messageWarning(message: string): void {
  const notificationStore = useNotificationStore()
  notificationStore.warning(message)
}

/**
 * 显示信息消息
 */
export function messageInfo(message: string): void {
  const notificationStore = useNotificationStore()
  notificationStore.info(message)
}

/**
 * 显示提示消息（兼容旧 API）
 * 根据消息内容自动判断类型
 */
export function safeAlert(message: string): void {
  const notificationStore = useNotificationStore()
  
  // 根据消息内容判断类型
  const lowerMessage = message.toLowerCase()
  
  if (lowerMessage.includes('失败') || lowerMessage.includes('错误') || lowerMessage.includes('error') || lowerMessage.includes('fail')) {
    notificationStore.error(message)
  } else if (lowerMessage.includes('成功') || lowerMessage.includes('完成') || lowerMessage.includes('success')) {
    notificationStore.success(message)
  } else if (lowerMessage.includes('警告') || lowerMessage.includes('warning')) {
    notificationStore.warning(message)
  } else {
    notificationStore.info(message)
  }
}

/**
 * 显示确认对话框
 * @param message 确认消息
 * @param options 可选配置
 * @returns Promise<boolean> 用户点击确认返回 true，取消返回 false
 */
export async function safeConfirm(
  message: string,
  options?: {
    title?: string
    confirmText?: string
    cancelText?: string
    type?: 'danger' | 'warning' | 'info'
  }
): Promise<boolean> {
  const notificationStore = useNotificationStore()
  return notificationStore.showConfirm(message, options)
}
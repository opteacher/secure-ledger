<template>
  <div class="min-h-screen bg-neutral-50 text-fg-primary">
    <router-view />
    <NotificationToast />
    <ConfirmDialog />
  </div>
</template>

<script setup lang="ts">
import NotificationToast from './components/NotificationToast.vue'
import ConfirmDialog from './components/ConfirmDialog.vue'
</script>

<style>
/* Custom scrollbar - Light theme */
::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background: #d4d4d8;
  border-radius: 3px;
}

::-webkit-scrollbar-thumb:hover {
  background: #a1a1aa;
}

/* Selection */
::selection {
  background: rgba(124, 58, 237, 0.2);
  color: inherit;
}

/* Focus visible outline */
:focus-visible {
  outline: 2px solid rgba(124, 58, 237, 0.5);
  outline-offset: 2px;
}

/* Smooth scrolling */
html {
  scroll-behavior: smooth;
}

@media (prefers-reduced-motion: reduce) {
  html {
    scroll-behavior: auto;
  }
  
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
</style>
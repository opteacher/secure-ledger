import { createRouter, createWebHashHistory, RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    redirect: '/home'
  },
  {
    path: '/home',
    name: 'Home',
    component: () => import('../views/Home.vue')
  },
  {
    path: '/endpoint/:id?',
    name: 'Endpoint',
    component: () => import('../views/EndpointEdit.vue')
  }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

export default router

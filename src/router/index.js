import { createRouter, createWebHashHistory } from 'vue-router'
import MainLayout from '../layouts/MainLayout.vue'
import Dashboard from '../views/Dashboard.vue'
import Treatments from '../views/Treatments.vue'
import Claims from '../views/Claims.vue'
import Setup from '../views/Setup.vue'

const routes = [
  {
    path: '/setup',
    name: 'Setup',
    component: Setup
  },
  {
    path: '/',
    component: MainLayout,
    children: [
      { path: '', redirect: '/dashboard' },
      { path: 'dashboard', name: 'Dashboard', component: Dashboard },
      { path: 'treatments', name: 'Treatments', component: Treatments },
      { path: 'claims', name: 'Claims', component: Claims },
    ]
  }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

router.beforeEach((to, from, next) => {
  const url = localStorage.getItem('SUPABASE_URL')
  const key = localStorage.getItem('SUPABASE_SECRET_KEYS')
  
  if (to.name !== 'Setup' && (!url || !key)) {
    next({ name: 'Setup' })
  } else {
    next()
  }
})

export default router

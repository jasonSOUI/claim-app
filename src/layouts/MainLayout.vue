<script setup>
import { ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { LayoutDashboard, Stethoscope, Receipt, LogOut, Sun, Moon } from 'lucide-vue-next'

const router = useRouter()
const route = useRoute()

const isDark = ref(false)

onMounted(() => {
  // Check local storage or system preference
  if (localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    isDark.value = true
    document.documentElement.classList.add('dark')
  } else {
    isDark.value = false
    document.documentElement.classList.remove('dark')
  }
})

const toggleDark = () => {
  isDark.value = !isDark.value
  if (isDark.value) {
    document.documentElement.classList.add('dark')
    localStorage.theme = 'dark'
  } else {
    document.documentElement.classList.remove('dark')
    localStorage.theme = 'light'
  }
}

const navigation = [
  { name: '總覽', href: 'Dashboard', icon: LayoutDashboard },
  { name: '療程管理', href: 'Treatments', icon: Stethoscope },
  { name: '理賠紀錄', href: 'Claims', icon: Receipt },
]

const handleLogout = () => {
  localStorage.clear()
  window.location.reload()
}
</script>

<template>
  <div>
    <!-- The ambient glass background -->
    <div class="glass-bg"></div>

    <div class="flex h-screen overflow-hidden text-slate-800 dark:text-slate-200">
      
      <!-- Sidebar -->
      <div class="w-64 glass-panel m-4 rounded-3xl flex flex-col overflow-hidden z-10">
        <div class="h-20 flex items-center px-6 border-b border-white/20 dark:border-slate-700/30">
          <h1 class="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-brand to-emerald-500">
            保險理賠小幫手
          </h1>
        </div>
        
        <div class="flex-1 overflow-y-auto py-6">
          <nav class="space-y-2 px-4">
            <router-link 
              v-for="item in navigation" 
              :key="item.name" 
              :to="{ name: item.href }"
              :class="[route.name === item.href ? 'bg-white/50 dark:bg-slate-800/60 shadow-sm' : 'hover:bg-white/30 dark:hover:bg-slate-800/40', 'group flex items-center px-4 py-3 text-lg font-semibold rounded-2xl transition-all']"
            >
              <component :is="item.icon" :class="[route.name === item.href ? 'text-brand' : 'text-slate-500 dark:text-slate-400 group-hover:text-brand', 'flex-shrink-0 mr-3 h-5 w-5 transition-colors']" aria-hidden="true" />
              <span class="truncate">{{ item.name }}</span>
            </router-link>
          </nav>
        </div>

        <div class="p-4 border-t border-white/20 dark:border-slate-700/30 space-y-2">
          <!-- Theme Toggle -->
          <button @click="toggleDark" class="flex w-full items-center px-4 py-3 text-lg font-semibold rounded-2xl hover:bg-white/30 dark:hover:bg-slate-800/40 transition-all">
            <Sun v-if="isDark" class="text-amber-400 mr-3 h-5 w-5" />
            <Moon v-else class="text-indigo-500 mr-3 h-5 w-5" />
            {{ isDark ? '切換淺色模式' : '切換深色模式' }}
          </button>
          
          <button @click="handleLogout" class="flex w-full items-center px-4 py-3 text-lg font-semibold rounded-2xl hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-600 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-all group">
            <LogOut class="text-slate-400 group-hover:text-red-500 flex-shrink-0 mr-3 h-5 w-5 transition-colors" />
            登出 / 清除設定
          </button>
        </div>
      </div>

      <!-- Main content -->
      <div class="flex-1 overflow-auto relative z-0 p-4 pl-0">
        <div class="h-full max-w-7xl mx-auto">
          <!-- Router View will contain glass-panel for its main content as well -->
          <router-view></router-view>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { initSupabase } from '../supabase'

const router = useRouter()
const url = ref('')
const key = ref('')
const errorMsg = ref('')

const handleSave = () => {
  if (!url.value || !key.value) {
    errorMsg.value = '請填寫完整資訊'
    return
  }
  
  localStorage.setItem('SUPABASE_URL', url.value)
  localStorage.setItem('SUPABASE_SECRET_KEYS', key.value)
  
  const success = initSupabase()
  if (success) {
    router.push({ name: 'Dashboard' })
  } else {
    errorMsg.value = '連線失敗，請檢查網址或金鑰是否正確'
    localStorage.removeItem('SUPABASE_URL')
    localStorage.removeItem('SUPABASE_SECRET_KEYS')
  }
}
</script>

<template>
  <div class="min-h-screen flex flex-col justify-center py-12 sm:px-6 lg:px-8 glass-bg">
    <div class="sm:mx-auto sm:w-full sm:max-w-md">
      <h2 class="mt-6 text-center text-3xl font-extrabold text-white">
        設定資料庫連線
      </h2>
      <p class="mt-2 text-center text-lg text-white/80 font-medium">
        將資料安全儲存在您的個人 Supabase
      </p>
    </div>

    <div class="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
      <div class="glass-panel py-8 px-4 shadow-2xl sm:rounded-3xl sm:px-10">
        <form class="space-y-6" @submit.prevent="handleSave">
          <div>
            <label class="block text-lg font-bold text-slate-700 dark:text-slate-300">Supabase URL</label>
            <div class="mt-2">
              <input v-model="url" type="text" required class="appearance-none block w-full px-4 py-3 glass-input rounded-xl shadow-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand font-mono" placeholder="https://xxxx.supabase.co" />
            </div>
          </div>

          <div>
            <label class="block text-lg font-bold text-slate-700 dark:text-slate-300">Anon Key</label>
            <div class="mt-2">
              <input v-model="key" type="password" required class="appearance-none block w-full px-4 py-3 glass-input rounded-xl shadow-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand font-mono" placeholder="eyJhbGciOi..." />
            </div>
          </div>
          
          <div v-if="errorMsg" class="text-red-400 font-bold bg-red-900/20 p-3 rounded-lg text-center">
            {{ errorMsg }}
          </div>

          <div class="pt-2">
            <button type="submit" class="w-full flex justify-center py-3 px-4 rounded-xl shadow-lg shadow-brand/30 text-lg font-bold text-white bg-brand hover:bg-sky-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand transition-all transform hover:scale-105 active:scale-95">
              儲存並進入系統
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

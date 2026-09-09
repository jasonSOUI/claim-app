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
  <div class="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
    <div class="sm:mx-auto sm:w-full sm:max-w-md">
      <h2 class="mt-6 text-center text-3xl font-extrabold text-gray-900">
        設定資料庫連線
      </h2>
      <p class="mt-2 text-center text-lg text-gray-600">
        將資料安全儲存在您的個人 Supabase
      </p>
    </div>

    <div class="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
      <div class="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
        <form class="space-y-6" @submit.prevent="handleSave">
          <div>
            <label class="block text-lg font-medium text-gray-700">Supabase URL</label>
            <div class="mt-1">
              <input v-model="url" type="text" required class="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-brand focus:border-brand sm:text-lg" placeholder="https://xxxx.supabase.co" />
            </div>
          </div>

          <div>
            <label class="block text-lg font-medium text-gray-700">Anon Key</label>
            <div class="mt-1">
              <input v-model="key" type="password" required class="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-brand focus:border-brand sm:text-lg" placeholder="eyJhbGciOi..." />
            </div>
          </div>
          
          <div v-if="errorMsg" class="text-red-500 text-lg">
            {{ errorMsg }}
          </div>

          <div>
            <button type="submit" class="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-lg font-medium text-white bg-brand hover:bg-sky-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand transition-colors">
              儲存並進入系統
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { supabase } from '../supabase'
import { Plus, Edit2, Trash2, X, Search } from 'lucide-vue-next'

const treatments = ref([])
const hospitals = ref([])
const isModalOpen = ref(false)
const isLoading = ref(false)

const isViewClaimsModalOpen = ref(false)
const selectedTreatmentForClaims = ref(null)

const sortedAssociatedClaims = computed(() => {
  if (!selectedTreatmentForClaims.value?.claim_record_treatments) return []
  return [...selectedTreatmentForClaims.value.claim_record_treatments].sort((a, b) => {
    const dateA = a.claim_records.received_date ? new Date(a.claim_records.received_date) : new Date(0)
    const dateB = b.claim_records.received_date ? new Date(b.claim_records.received_date) : new Date(0)
    return dateB - dateA // 降冪排序 (最新的日期在最上面)
  })
})

const openViewClaims = (item) => {
  selectedTreatmentForClaims.value = item
  isViewClaimsModalOpen.value = true
}

const closeViewClaims = () => {
  isViewClaimsModalOpen.value = false
  setTimeout(() => { selectedTreatmentForClaims.value = null }, 300)
}

const form = ref({
  id: null,
  treatment_date: '',
  title: '',
  hospital_id: '',
  amount: 0,
  notes: ''
})

const fetchHospitals = async () => {
  const { data, error } = await supabase.value
    .from('claim_hospitals')
    .select('*')
    .order('created_at', { ascending: true })
  if (data) hospitals.value = data
}

const fetchTreatments = async () => {
  isLoading.value = true
  const { data, error } = await supabase.value
    .from('claim_treatments')
    .select(`
      *,
      claim_hospitals (name),
      claim_record_treatments (
        claim_records (
          *,
          claim_insurance_companies (name)
        )
      )
    `)
    .order('treatment_date', { ascending: false })
  
  if (data) treatments.value = data
  isLoading.value = false
}

onMounted(() => {
  fetchHospitals()
  fetchTreatments()
})

const openModal = (item = null) => {
  if (item) {
    form.value = { ...item }
  } else {
    form.value = {
      id: null,
      treatment_date: new Date().toISOString().split('T')[0],
      title: '',
      hospital_id: hospitals.value[0]?.id || '',
      amount: 0,
      notes: ''
    }
  }
  isModalOpen.value = true
}

const closeModal = () => {
  isModalOpen.value = false
}

const handleSave = async () => {
  const payload = {
    treatment_date: form.value.treatment_date,
    title: form.value.title,
    hospital_id: form.value.hospital_id,
    amount: Number(form.value.amount),
    notes: form.value.notes
  }

  if (form.value.id) {
    await supabase.value.from('claim_treatments').update(payload).eq('id', form.value.id)
  } else {
    await supabase.value.from('claim_treatments').insert(payload)
  }
  
  closeModal()
  fetchTreatments()
}

const handleDelete = async (id) => {
  if (confirm('確定要刪除這筆療程紀錄嗎？相關的理賠關聯也會一併被移除喔！')) {
    await supabase.value.from('claim_treatments').delete().eq('id', id)
    fetchTreatments()
  }
}
</script>

<template>
  <div class="h-full flex flex-col">
    <div class="flex justify-between items-center mb-6">
      <h2 class="text-2xl font-bold text-slate-800 dark:text-slate-100">療程管理</h2>
      <button @click="openModal()" class="inline-flex items-center px-4 py-2 bg-brand text-white text-lg font-medium rounded-xl hover:bg-sky-600 shadow-lg shadow-sky-500/30 transition-all transform hover:scale-105 active:scale-95">
        <Plus class="w-4 h-4 mr-2" />
        新增療程
      </button>
    </div>

    <!-- Table / List -->
    <div class="glass-panel rounded-3xl flex-1 overflow-hidden flex flex-col">
      <div v-if="isLoading" class="p-8 text-center text-slate-500 dark:text-slate-400">載入中...</div>
      
      <div v-else-if="treatments.length === 0" class="p-12 text-center flex flex-col items-center justify-center">
        <div class="text-slate-400 dark:text-slate-500 mb-2">目前還沒有任何療程紀錄</div>
        <button @click="openModal()" class="text-brand hover:underline">點此建立第一筆療程</button>
      </div>

      <div v-else class="overflow-x-auto flex-1 p-2">
        <table class="min-w-full divide-y divide-white/20 dark:divide-slate-700/50">
          <thead class="bg-white/40 dark:bg-slate-800/40 backdrop-blur-md sticky top-0 z-10 rounded-t-2xl">
            <tr>
              <th scope="col" class="px-6 py-4 text-left text-base font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider rounded-tl-2xl">日期</th>
              <th scope="col" class="px-6 py-4 text-left text-base font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">療程名稱</th>
              <th scope="col" class="px-6 py-4 text-left text-base font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">醫院</th>
              <th scope="col" class="px-6 py-4 text-right text-base font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">花費金額</th>
              <th scope="col" class="px-6 py-4 text-left text-base font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">備註</th>
              <th scope="col" class="relative px-6 py-4 rounded-tr-2xl"><span class="sr-only">操作</span></th>
            </tr>
          </thead>
          <tbody class="divide-y divide-white/10 dark:divide-slate-700/30">
            <tr v-for="item in treatments" :key="item.id" class="hover:bg-sky-100/80 dark:hover:bg-sky-900/50 transition-all duration-200 group">
              <td class="px-6 py-4 whitespace-nowrap text-lg text-slate-600 dark:text-slate-300">{{ item.treatment_date }}</td>
              <td class="px-6 py-4 whitespace-nowrap text-lg font-bold text-slate-900 dark:text-slate-100">{{ item.title }}</td>
              <td class="px-6 py-4 whitespace-nowrap text-lg text-slate-500">
                <span class="inline-flex items-center px-2.5 py-1 rounded-full text-base font-medium bg-blue-100/80 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800/50">
                  {{ item.claim_hospitals?.name }}
                </span>
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-lg text-slate-900 dark:text-slate-100 text-right font-mono font-bold">${{ item.amount.toLocaleString() }}</td>
              <td class="px-6 py-4 text-lg text-slate-500 dark:text-slate-400 max-w-xs truncate">{{ item.notes }}</td>
              <td class="px-6 py-4 whitespace-nowrap text-right text-lg font-medium">
                <button @click="openViewClaims(item)" class="text-emerald-600 dark:text-emerald-400 hover:text-emerald-900 dark:hover:text-emerald-300 mx-2 p-2 rounded-xl hover:bg-white/50 dark:hover:bg-slate-800/50 transition-colors" title="查看關聯理賠">
                  <Search class="w-4 h-4" />
                </button>
                <button @click="openModal(item)" class="text-indigo-600 dark:text-indigo-400 hover:text-indigo-900 dark:hover:text-indigo-300 mx-2 p-2 rounded-xl hover:bg-white/50 dark:hover:bg-slate-800/50 transition-colors" title="編輯"><Edit2 class="w-4 h-4" /></button>
                <button @click="handleDelete(item.id)" class="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300 p-2 rounded-xl hover:bg-white/50 dark:hover:bg-slate-800/50 transition-colors" title="刪除"><Trash2 class="w-4 h-4" /></button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Edit/Create Modal -->
    <div v-if="isModalOpen" class="fixed inset-0 z-50 overflow-y-auto">
      <div class="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:p-0">
        <div class="fixed inset-0 transition-opacity bg-slate-900/40 backdrop-blur-sm" @click="closeModal"></div>
        <div class="relative inline-block w-full max-w-md p-8 overflow-hidden text-left align-middle transition-all transform glass-panel rounded-3xl shadow-2xl">
          <div class="flex justify-between items-center mb-6">
            <h3 class="text-xl font-bold leading-6 text-slate-900 dark:text-slate-100">
              {{ form.id ? '編輯療程' : '新增療程' }}
            </h3>
            <button @click="closeModal" class="text-slate-400 hover:text-slate-500 dark:hover:text-slate-300 p-1 rounded-full hover:bg-white/20 dark:hover:bg-slate-700/50 transition-colors"><X class="w-5 h-5" /></button>
          </div>
          
          <form @submit.prevent="handleSave" class="space-y-5">
            <div>
              <label class="block text-lg font-bold text-slate-700 dark:text-slate-300 mb-2">日期</label>
              <div class="relative flex items-center">
                <input 
                  type="text" 
                  v-model="form.treatment_date" 
                  required 
                  placeholder="YYYY-MM-DD (例如: 2026-08-01)"
                  pattern="\d{4}-\d{2}-\d{2}"
                  title="請輸入 YYYY-MM-DD 格式"
                  class="w-full rounded-xl glass-input px-4 py-2 pr-12 font-mono" 
                />
                <div class="absolute right-2 top-1/2 transform -translate-y-1/2 w-8 h-8 overflow-hidden cursor-pointer rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors flex justify-center items-center">
                  <span class="text-slate-500">📅</span>
                  <input 
                    type="date" 
                    v-model="form.treatment_date" 
                    class="absolute inset-0 opacity-0 cursor-pointer w-full h-full" 
                  />
                </div>
              </div>
            </div>
            
            <div>
              <label class="block text-lg font-bold text-slate-700 dark:text-slate-300 mb-2">名稱</label>
              <input type="text" v-model="form.title" required placeholder="例如: 8月化療" class="w-full rounded-xl glass-input px-4 py-2 placeholder-slate-400/70" />
            </div>

            <div>
              <label class="block text-lg font-bold text-slate-700 dark:text-slate-300 mb-2">醫院</label>
              <select v-model="form.hospital_id" required class="w-full rounded-xl glass-input px-4 py-2">
                <option v-for="h in hospitals" :key="h.id" :value="h.id" class="bg-white text-slate-900 dark:bg-slate-800 dark:text-slate-100">{{ h.name }}</option>
              </select>
            </div>

            <div>
              <label class="block text-lg font-bold text-slate-700 dark:text-slate-300 mb-2">花費金額 (自費)</label>
              <div class="relative rounded-xl">
                <div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                  <span class="text-slate-500 dark:text-slate-400 font-mono font-bold">$</span>
                </div>
                <input type="number" v-model="form.amount" min="0" class="w-full rounded-xl glass-input pl-8 pr-4 py-2 font-mono font-bold" />
              </div>
            </div>

            <div>
              <label class="block text-lg font-bold text-slate-700 dark:text-slate-300 mb-2">備註</label>
              <textarea v-model="form.notes" rows="2" class="w-full rounded-xl glass-input px-4 py-2 placeholder-slate-400/70" placeholder="可以填寫雙人病房、達文西手術等細項"></textarea>
            </div>

            <div class="pt-4 flex justify-end gap-3 border-t border-white/20 dark:border-slate-700/50 mt-2">
              <button type="button" @click="closeModal" class="px-5 py-2.5 text-lg font-bold text-slate-700 dark:text-slate-300 bg-white/50 dark:bg-slate-800/50 hover:bg-white/80 dark:hover:bg-slate-700/80 rounded-xl transition-all shadow-sm">
                取消
              </button>
              <button type="submit" class="px-5 py-2.5 text-lg font-bold text-white bg-brand hover:bg-sky-500 rounded-xl shadow-lg shadow-sky-500/30 transition-all transform hover:scale-105 active:scale-95">
                儲存
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>

    <!-- View Claims Modal -->
    <div v-if="isViewClaimsModalOpen" class="fixed inset-0 z-50 overflow-y-auto">
      <div class="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:p-0">
        <div class="fixed inset-0 transition-opacity bg-slate-900/40 backdrop-blur-sm" @click="closeViewClaims"></div>
        <div class="relative inline-block w-full max-w-lg p-8 overflow-hidden text-left align-middle transition-all transform glass-panel rounded-3xl shadow-2xl">
          <div class="flex justify-between items-center mb-6">
            <h3 class="text-xl font-bold leading-6 text-slate-900 dark:text-slate-100 flex items-center">
              <Search class="w-5 h-5 mr-2 text-emerald-500" />
              理賠查詢結果
            </h3>
            <button @click="closeViewClaims" class="text-slate-400 hover:text-slate-500 dark:hover:text-slate-300 p-1 rounded-full hover:bg-white/20 dark:hover:bg-slate-700/50 transition-colors"><X class="w-5 h-5" /></button>
          </div>
          
          <div v-if="selectedTreatmentForClaims">
            <div class="mb-4 pb-4 border-b border-white/20 dark:border-slate-700/50">
              <p class="text-sm font-bold text-slate-500 dark:text-slate-400 mb-1">目標療程</p>
              <p class="text-lg font-bold text-slate-900 dark:text-slate-100">{{ selectedTreatmentForClaims.title }} <span class="text-sm text-slate-500 font-normal">({{ selectedTreatmentForClaims.treatment_date }})</span></p>
              <p class="text-lg font-mono text-slate-600 dark:text-slate-300">花費: ${{ selectedTreatmentForClaims.amount.toLocaleString() }}</p>
            </div>

            <div>
              <p class="text-sm font-bold text-slate-700 dark:text-slate-300 mb-3">關聯的理賠紀錄 ({{ sortedAssociatedClaims.length }} 筆)</p>
              
              <div v-if="sortedAssociatedClaims.length > 0" class="space-y-3 max-h-60 overflow-y-auto pr-2">
                <div v-for="rt in sortedAssociatedClaims" :key="rt.claim_records.id" class="bg-white/50 dark:bg-slate-800/50 p-4 rounded-xl border border-white/40 dark:border-slate-700/50 flex justify-between items-center shadow-sm">
                  <div>
                    <div class="flex items-center mb-1">
                      <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-emerald-100/80 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50 mr-2">
                        {{ rt.claim_records.claim_insurance_companies?.name }}
                      </span>
                      <span class="text-sm font-bold text-slate-700 dark:text-slate-300">{{ rt.claim_records.status }}</span>
                    </div>
                    <div class="text-xs text-slate-500 dark:text-slate-400">入帳日: {{ rt.claim_records.received_date || '未定' }}</div>
                  </div>
                  <div class="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
                    +${{ rt.claim_records.amount.toLocaleString() }}
                  </div>
                </div>
              </div>
              <div v-else class="text-center py-8 text-slate-500 glass-input rounded-xl border-dashed">
                此療程尚未關聯任何理賠紀錄。
              </div>
            </div>
            
            <div class="pt-6 flex justify-end">
              <button @click="closeViewClaims" class="px-5 py-2.5 text-lg font-bold text-slate-700 dark:text-slate-300 bg-white/50 dark:bg-slate-800/50 hover:bg-white/80 dark:hover:bg-slate-700/80 rounded-xl transition-all shadow-sm">
                關閉
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

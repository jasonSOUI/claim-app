<script setup>
import { ref, onMounted, computed } from 'vue'
import { supabase } from '../supabase'
import { Plus, Edit2, Trash2, X } from 'lucide-vue-next'

const claims = ref([])
const companies = ref([])
const treatmentsList = ref([])
const isModalOpen = ref(false)
const isLoading = ref(false)
const isDropdownOpen = ref(false)
const searchQuery = ref('')
const filterCompanyId = ref('')

const sortedClaims = computed(() => {
  let list = claims.value
  if (filterCompanyId.value) {
    list = list.filter(c => c.company_id === filterCompanyId.value)
  }
  
  return [...list].sort((a, b) => {
    const dateA = a.received_date ? new Date(a.received_date).getTime() : 0
    const dateB = b.received_date ? new Date(b.received_date).getTime() : 0
    // 如果日期一樣，可以用 created_at 做次要排序，但目前單純比日期
    return dateB - dateA
  })
})

const availableTreatments = computed(() => {
  const unselected = treatmentsList.value.filter(t => !form.value.selected_treatments.includes(t.id))
  
  if (!searchQuery.value) {
    return unselected.slice(0, 5)
  }
  
  const q = searchQuery.value.toLowerCase()
  return unselected.filter(t => 
    t.title.toLowerCase().includes(q) || 
    t.treatment_date.includes(q)
  )
})

const addTreatment = (id) => {
  if (!form.value.selected_treatments.includes(id)) {
    form.value.selected_treatments.push(id)
  }
  searchQuery.value = ''
}

const handleBlur = () => {
  setTimeout(() => {
    isDropdownOpen.value = false
  }, 150)
}

const form = ref({
  id: null,
  company_id: '',
  amount: 0,
  status: '已入帳',
  received_date: '',
  notes: '',
  selected_treatments: []
})

const fetchData = async () => {
  isLoading.value = true
  
  const { data: cData } = await supabase.value.from('claim_insurance_companies').select('*').order('created_at')
  if (cData) companies.value = cData
  
  const { data: tData } = await supabase.value.from('claim_treatments').select('id, title, treatment_date').order('treatment_date', { ascending: false })
  if (tData) treatmentsList.value = tData

  const { data: claimsData } = await supabase.value
    .from('claim_records')
    .select(`
      *,
      claim_insurance_companies (name),
      claim_record_treatments (
        treatment_id,
        claim_treatments (title, treatment_date)
      )
    `)
    .order('received_date', { ascending: false })
  
  if (claimsData) claims.value = claimsData
  isLoading.value = false
}

onMounted(() => {
  fetchData()
})

const openModal = (item = null) => {
  searchQuery.value = ''
  if (item) {
    form.value = {
      ...item,
      selected_treatments: item.claim_record_treatments.map(rt => rt.treatment_id)
    }
  } else {
    form.value = {
      id: null,
      company_id: companies.value[0]?.id || '',
      amount: 0,
      status: '已入帳',
      received_date: new Date().toISOString().split('T')[0],
      notes: '',
      selected_treatments: []
    }
  }
  isModalOpen.value = true
}

const closeModal = () => {
  isModalOpen.value = false
}

const handleSave = async () => {
  const payload = {
    company_id: form.value.company_id,
    amount: Number(form.value.amount),
    status: form.value.status,
    received_date: form.value.received_date || null,
    notes: form.value.notes
  }

  let recordId = form.value.id

  if (recordId) {
    await supabase.value.from('claim_records').update(payload).eq('id', recordId)
    await supabase.value.from('claim_record_treatments').delete().eq('record_id', recordId)
  } else {
    const { data } = await supabase.value.from('claim_records').insert(payload).select()
    if (data && data.length > 0) {
      recordId = data[0].id
    }
  }
  
  if (recordId && form.value.selected_treatments.length > 0) {
    const mappings = form.value.selected_treatments.map(tId => ({
      record_id: recordId,
      treatment_id: tId
    }))
    await supabase.value.from('claim_record_treatments').insert(mappings)
  }
  
  closeModal()
  fetchData()
}

const handleDelete = async (id) => {
  if (confirm('確定要刪除這筆理賠紀錄嗎？')) {
    await supabase.value.from('claim_records').delete().eq('id', id)
    fetchData()
  }
}
</script>

<template>
  <div class="h-full flex flex-col">
    <div class="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-6 gap-4">
      <div class="flex items-center space-x-4">
        <h2 class="text-2xl font-bold text-slate-800 dark:text-slate-100">理賠紀錄</h2>
        <select v-model="filterCompanyId" class="glass-input rounded-xl px-4 py-2 text-base font-bold text-slate-700 dark:text-slate-300 border-none shadow-sm cursor-pointer outline-none focus:ring-2 focus:ring-emerald-500/50">
          <option value="" class="bg-white text-slate-900 dark:bg-slate-800 dark:text-slate-100">全部保險公司</option>
          <option v-for="c in companies" :key="c.id" :value="c.id" class="bg-white text-slate-900 dark:bg-slate-800 dark:text-slate-100">{{ c.name }}</option>
        </select>
      </div>
      <button @click="openModal()" class="inline-flex items-center justify-center px-4 py-2 bg-emerald-500 text-white text-base font-bold rounded-xl hover:bg-emerald-600 shadow-lg shadow-emerald-500/30 transition-all transform hover:scale-105 active:scale-95">
        <Plus class="w-4 h-4 mr-2" />
        新增理賠
      </button>
    </div>

    <!-- Table / List -->
    <div class="glass-panel rounded-3xl flex-1 overflow-hidden flex flex-col p-2 border-0 bg-transparent shadow-none dark:bg-transparent">
      <div v-if="isLoading" class="p-8 text-center text-slate-500">載入中...</div>
      
      <div v-else-if="claims.length === 0" class="p-12 text-center flex flex-col items-center justify-center glass-panel rounded-3xl h-64 border-dashed">
        <div class="text-slate-400 mb-2">目前還沒有任何理賠紀錄</div>
        <button @click="openModal()" class="text-emerald-500 font-bold hover:underline">點此建立第一筆理賠</button>
      </div>

      <div v-else class="overflow-x-auto flex-1 p-2 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 content-start">
        <!-- Card layout for Claims -->
        <div v-for="item in sortedClaims" :key="item.id" class="glass-panel border border-white/40 dark:border-slate-700/50 rounded-2xl p-6 flex flex-col relative group transform transition-all hover:-translate-y-1 hover:shadow-2xl">
          <div class="absolute top-4 right-4 flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
            <button @click.stop="openModal(item)" class="text-slate-400 hover:text-indigo-500 dark:hover:text-indigo-400 p-2 bg-white/50 dark:bg-slate-800/80 backdrop-blur-md rounded-full shadow-sm relative"><Edit2 class="w-4 h-4" /></button>
            <button @click.stop="handleDelete(item.id)" class="text-slate-400 hover:text-red-500 dark:hover:text-red-400 p-2 bg-white/50 dark:bg-slate-800/80 backdrop-blur-md rounded-full shadow-sm relative"><Trash2 class="w-4 h-4" /></button>
          </div>
          
          <div class="flex justify-between items-start mb-3">
            <span class="inline-flex items-center px-3 py-1 rounded-full text-base font-bold bg-emerald-100/80 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50">
              {{ item.claim_insurance_companies?.name }}
            </span>
            <span :class="[item.status === '已入帳' ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-500 dark:text-amber-400', 'text-base font-bold px-2 py-1 bg-white/50 dark:bg-slate-800/50 rounded-lg group-hover:opacity-0 transition-opacity duration-300']">
              {{ item.status }}
            </span>
          </div>
          
          <div class="text-3xl font-bold font-mono text-slate-900 dark:text-slate-100 mb-1">
            ${{ item.amount.toLocaleString() }}
          </div>
          <div class="text-base font-medium text-slate-500 dark:text-slate-400 mb-5 flex items-center">
            入帳日: {{ item.received_date || '未定' }}
          </div>
          
          <div class="mt-auto pt-4 border-t border-white/20 dark:border-slate-700/50">
            <div class="text-base font-bold text-slate-600 dark:text-slate-400 mb-3">關聯療程 ({{ item.claim_record_treatments?.length || 0 }})</div>
            <div class="flex flex-wrap gap-1.5">
              <span v-for="rt in item.claim_record_treatments" :key="rt.treatment_id" class="inline-flex items-center px-2 py-1 rounded-md text-[10px] font-bold bg-white/60 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 border border-white/40 dark:border-slate-600/50 shadow-sm">
                {{ rt.claim_treatments?.title }}
              </span>
              <span v-if="!item.claim_record_treatments?.length" class="text-base text-slate-400 italic">未關聯任何療程</span>
            </div>
            <div v-if="item.notes" class="mt-4 text-base font-medium text-slate-600 dark:text-slate-300 bg-white/40 dark:bg-slate-800/40 p-3 rounded-xl border border-white/20 dark:border-slate-700/30 truncate">
              {{ item.notes }}
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal -->
    <div v-if="isModalOpen" class="fixed inset-0 z-50 overflow-y-auto">
      <div class="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:p-0">
        <div class="fixed inset-0 transition-opacity bg-slate-900/40 backdrop-blur-sm" @click="closeModal"></div>
        <div class="relative inline-block w-full max-w-lg p-8 overflow-hidden text-left align-middle transition-all transform glass-panel rounded-3xl shadow-2xl">
          <div class="flex justify-between items-center mb-6">
            <h3 class="text-xl font-bold leading-6 text-slate-900 dark:text-slate-100">
              {{ form.id ? '編輯理賠紀錄' : '新增理賠紀錄' }}
            </h3>
            <button @click="closeModal" class="text-slate-400 hover:text-slate-500 dark:hover:text-slate-300 p-1 rounded-full hover:bg-white/20 dark:hover:bg-slate-700/50 transition-colors"><X class="w-5 h-5" /></button>
          </div>
          
          <form @submit.prevent="handleSave" class="space-y-5">
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-lg font-bold text-slate-700 dark:text-slate-300 mb-2">保險公司</label>
                <select v-model="form.company_id" required class="w-full rounded-xl glass-input px-4 py-2 border">
                  <option v-for="c in companies" :key="c.id" :value="c.id" class="bg-white text-slate-900 dark:bg-slate-800 dark:text-slate-100">{{ c.name }}</option>
                </select>
              </div>
              <div>
                <label class="block text-lg font-bold text-slate-700 dark:text-slate-300 mb-2">入帳狀態</label>
                <select v-model="form.status" required class="w-full rounded-xl glass-input px-4 py-2 border">
                  <option class="bg-white text-slate-900 dark:bg-slate-800 dark:text-slate-100">已入帳</option>
                  <option class="bg-white text-slate-900 dark:bg-slate-800 dark:text-slate-100">申請中</option>
                </select>
              </div>
            </div>

            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-lg font-bold text-slate-700 dark:text-slate-300 mb-2">理賠總額</label>
                <div class="relative rounded-xl">
                  <div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4"><span class="text-slate-500 dark:text-slate-400 font-mono font-bold">$</span></div>
                  <input type="number" v-model="form.amount" min="0" required class="block w-full rounded-xl glass-input pl-8 pr-4 py-2 font-mono font-bold" />
                </div>
              </div>
              <div>
                <label class="block text-lg font-bold text-slate-700 dark:text-slate-300 mb-2">入帳日期</label>
                <div class="relative flex items-center">
                  <input 
                    type="text" 
                    v-model="form.received_date" 
                    placeholder="YYYY-MM-DD"
                    pattern="\d{4}-\d{2}-\d{2}"
                    title="請輸入 YYYY-MM-DD 格式"
                    class="w-full rounded-xl glass-input px-4 py-2 pr-12 font-mono" 
                  />
                  <div class="absolute right-2 top-1/2 transform -translate-y-1/2 w-8 h-8 overflow-hidden cursor-pointer rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors flex justify-center items-center">
                    <span class="text-slate-500">📅</span>
                    <input 
                      type="date" 
                      v-model="form.received_date" 
                      class="absolute inset-0 opacity-0 cursor-pointer w-full h-full" 
                    />
                  </div>
                </div>
              </div>
            </div>

            <!-- Tag-based Many to Many treatments -->
            <div class="py-4 my-2">
              <label class="block text-lg font-bold text-slate-700 dark:text-slate-300 mb-3">關聯療程</label>
              
              <!-- 已經選取的標籤區 -->
              <div class="flex flex-wrap gap-2 mb-4" v-if="form.selected_treatments.length > 0">
                <div v-for="tId in form.selected_treatments" :key="tId" class="inline-flex items-center px-3 py-1.5 rounded-full text-base font-bold bg-emerald-100/80 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50 shadow-sm">
                  <span>{{ treatmentsList.find(t => t.id === tId)?.title }}</span>
                  <span class="text-emerald-600/70 dark:text-emerald-400/70 ml-1">({{ treatmentsList.find(t => t.id === tId)?.treatment_date }})</span>
                  <button type="button" @click.prevent="form.selected_treatments = form.selected_treatments.filter(id => id !== tId)" class="ml-1.5 flex-shrink-0 inline-flex text-emerald-600 dark:text-emerald-400 hover:text-emerald-900 focus:outline-none">
                    <X class="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <div v-else class="text-base text-slate-400 mb-4 italic px-2">尚未關聯任何療程</div>

              <!-- 搜尋與下拉選單 -->
              <div class="relative">
                <div class="flex items-center glass-input rounded-xl px-4 py-2 border shadow-sm">
                  <span class="text-slate-400 mr-2">🔍</span>
                  <input 
                    type="text" 
                    v-model="searchQuery" 
                    @focus="isDropdownOpen = true"
                    @blur="handleBlur"
                    placeholder="搜尋並加入療程..." 
                    class="block w-full border-0 p-0 text-lg bg-transparent focus:ring-0 text-slate-900 dark:text-slate-100 placeholder-slate-400 outline-none" 
                  />
                </div>

                <!-- Dropdown -->
                <div v-if="isDropdownOpen" class="absolute z-20 mt-2 w-full glass-panel border border-white/40 dark:border-slate-700/50 shadow-2xl max-h-48 rounded-xl py-2 text-lg overflow-auto">
                  <ul tabindex="-1" role="listbox">
                    <li 
                      v-for="t in availableTreatments" 
                      :key="t.id"
                      @mousedown.prevent="addTreatment(t.id)"
                      class="text-slate-900 dark:text-slate-200 cursor-pointer select-none relative py-3 pl-4 pr-9 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 transition-colors"
                    >
                      <div class="flex flex-col">
                        <span class="font-bold truncate">{{ t.title }}</span>
                        <span class="text-slate-500 dark:text-slate-400 text-base truncate font-medium mt-0.5">{{ t.treatment_date }}</span>
                      </div>
                    </li>
                    <li v-if="availableTreatments.length === 0" class="text-slate-500 dark:text-slate-400 cursor-default select-none relative py-3 pl-4">
                      <span class="font-medium block truncate text-base">{{ searchQuery ? '找不到符合的療程' : '目前沒有可選的療程' }}</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            <div>
              <label class="block text-lg font-bold text-slate-700 dark:text-slate-300 mb-2">備註</label>
              <textarea v-model="form.notes" rows="2" class="w-full rounded-xl glass-input px-4 py-2 placeholder-slate-400/70 border"></textarea>
            </div>

            <div class="pt-4 flex justify-end gap-3 border-t border-white/20 dark:border-slate-700/50 mt-2">
              <button type="button" @click="closeModal" class="px-5 py-2.5 text-lg font-bold text-slate-700 dark:text-slate-300 bg-white/50 dark:bg-slate-800/50 hover:bg-white/80 dark:hover:bg-slate-700/80 rounded-xl transition-all shadow-sm">
                取消
              </button>
              <button type="submit" class="px-5 py-2.5 text-lg font-bold text-white bg-emerald-500 hover:bg-emerald-600 rounded-xl shadow-lg shadow-emerald-500/30 transition-all transform hover:scale-105 active:scale-95">
                儲存
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  </div>
</template>

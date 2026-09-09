<script setup>
import { ref, onMounted, computed } from 'vue'
import { supabase } from '../supabase'
import { Plus, Edit2, Trash2, X, Search, Paperclip, FileUp, Loader2, Download, ArrowUp, ArrowDown } from 'lucide-vue-next'
import imageCompression from 'browser-image-compression'

const treatments = ref([])
const hospitals = ref([])
const isModalOpen = ref(false)
const isLoading = ref(false)

const isViewClaimsModalOpen = ref(false)
const selectedTreatmentForClaims = ref(null)

const isDocsModalOpen = ref(false)
const selectedTreatmentForDocs = ref(null)
const treatmentDocuments = ref([])
const isUploading = ref(false)

// 排序狀態
const sortKey = ref('treatment_date')
const sortOrder = ref('desc')

const sortBy = (key) => {
  if (sortKey.value === key) {
    sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortKey.value = key
    // 數字或日期通常預設大到小比較符合直覺
    sortOrder.value = 'desc'
  }
}

const sortedTreatments = computed(() => {
  return [...treatments.value].sort((a, b) => {
    let valA = a[sortKey.value]
    let valB = b[sortKey.value]

    // 特殊處理醫院名稱的排序
    if (sortKey.value === 'hospital_name') {
      valA = a.claim_hospitals?.name || ''
      valB = b.claim_hospitals?.name || ''
    }

    if (valA < valB) return sortOrder.value === 'asc' ? -1 : 1
    if (valA > valB) return sortOrder.value === 'asc' ? 1 : -1
    return 0
  })
})

const sortedAssociatedClaims = computed(() => {
  if (!selectedTreatmentForClaims.value?.claim_record_treatments) return []
  return [...selectedTreatmentForClaims.value.claim_record_treatments].sort((a, b) => {
    const dateA = a.claim_records.received_date ? new Date(a.claim_records.received_date) : new Date(0)
    const dateB = b.claim_records.received_date ? new Date(b.claim_records.received_date) : new Date(0)
    return dateB - dateA
  })
})

const fetchHospitals = async () => {
  const { data } = await supabase.value.from('claim_hospitals').select('*').order('created_at', { ascending: true })
  if (data) hospitals.value = data
}

const fetchTreatments = async () => {
  isLoading.value = true
  const { data } = await supabase.value
    .from('claim_treatments')
    .select(`
      *,
      claim_hospitals (name),
      claim_record_treatments (
        claim_records (
          *,
          claim_insurance_companies (name)
        )
      ),
      claim_treatment_documents (id)
    `)
  
  if (data) treatments.value = data
  isLoading.value = false
}

onMounted(() => {
  fetchHospitals()
  fetchTreatments()
})

const form = ref({
  id: null,
  treatment_date: '',
  title: '',
  hospital_id: '',
  amount: 0,
  notes: ''
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
const closeModal = () => { isModalOpen.value = false }

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

const openViewClaims = (item) => {
  selectedTreatmentForClaims.value = item
  isViewClaimsModalOpen.value = true
}
const closeViewClaims = () => {
  isViewClaimsModalOpen.value = false
  setTimeout(() => { selectedTreatmentForClaims.value = null }, 300)
}

// === 文件上傳邏輯 ===
const openDocsModal = async (item) => {
  selectedTreatmentForDocs.value = item
  isDocsModalOpen.value = true
  await fetchDocuments(item.id)
}

const closeDocsModal = () => {
  isDocsModalOpen.value = false
  setTimeout(() => { 
    selectedTreatmentForDocs.value = null
    treatmentDocuments.value = []
  }, 300)
}

const fetchDocuments = async (treatmentId) => {
  const { data } = await supabase.value
    .from('claim_treatment_documents')
    .select('*')
    .eq('treatment_id', treatmentId)
    .order('created_at', { ascending: false })
  
  if (data) treatmentDocuments.value = data
}

const handleFileUpload = async (event) => {
  const files = event.target.files
  if (!files || files.length === 0) return
  
  isUploading.value = true
  const treatmentId = selectedTreatmentForDocs.value.id

  for (let i = 0; i < files.length; i++) {
    let file = files[i]
    
    // 如果是圖片，進行無損壓縮以節省空間
    if (file.type.startsWith('image/')) {
      const options = {
        maxSizeMB: 0.3,
        maxWidthOrHeight: 1920,
        useWebWorker: true
      }
      try {
        file = await imageCompression(file, options)
      } catch (error) {
        console.error('壓縮失敗:', error)
      }
    }

    // 上傳至 Supabase Storage
    const fileExt = file.name.split('.').pop()
    const uniqueFileName = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${fileExt}`
    const filePath = `${treatmentId}/${uniqueFileName}`

    const { data: uploadData, error: uploadError } = await supabase.value.storage
      .from('receipts')
      .upload(filePath, file)

    if (uploadError) {
      alert(`上傳失敗: ${uploadError.message}`)
      continue
    }

    // 取得公開網址
    const { data: publicUrlData } = supabase.value.storage
      .from('receipts')
      .getPublicUrl(filePath)

    // 寫入資料庫
    await supabase.value.from('claim_treatment_documents').insert({
      treatment_id: treatmentId,
      file_name: file.name,
      file_url: publicUrlData.publicUrl,
      file_type: file.type
    })
  }

  isUploading.value = false
  event.target.value = '' 
  await fetchDocuments(treatmentId)
  fetchTreatments()
}

const deleteDocument = async (docId, fileUrl) => {
  if (!confirm('確定要刪除這份文件嗎？此操作無法還原。')) return

  const urlParts = fileUrl.split('/receipts/')
  if (urlParts.length > 1) {
    const filePath = urlParts[1]
    await supabase.value.storage.from('receipts').remove([filePath])
  }
  
  await supabase.value.from('claim_treatment_documents').delete().eq('id', docId)
  await fetchDocuments(selectedTreatmentForDocs.value.id)
  fetchTreatments()
}
</script>

<template>
  <div class="h-full flex flex-col">
    <div class="flex justify-between items-center mb-6">
      <h2 class="text-2xl font-bold text-slate-800 dark:text-slate-100">療程管理</h2>
      <button @click="openModal()" class="inline-flex items-center px-4 py-2 bg-brand text-white text-base font-medium rounded-xl hover:bg-sky-600 shadow-lg shadow-sky-500/30 transition-all transform hover:scale-105 active:scale-95">
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
          <thead class="bg-white/40 dark:bg-slate-800/40 backdrop-blur-md sticky top-0 z-10 rounded-t-2xl select-none">
            <tr>
              <th scope="col" @click="sortBy('treatment_date')" class="px-6 py-4 text-left text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider rounded-tl-2xl cursor-pointer hover:bg-slate-200/50 dark:hover:bg-slate-700/50 transition-colors">
                <div class="flex items-center">
                  日期
                  <span v-if="sortKey === 'treatment_date'" class="ml-1 text-slate-700 dark:text-slate-200">
                    <ArrowUp v-if="sortOrder === 'asc'" class="w-4 h-4" />
                    <ArrowDown v-else class="w-4 h-4" />
                  </span>
                </div>
              </th>
              <th scope="col" @click="sortBy('title')" class="px-6 py-4 text-left text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider cursor-pointer hover:bg-slate-200/50 dark:hover:bg-slate-700/50 transition-colors">
                <div class="flex items-center">
                  療程名稱
                  <span v-if="sortKey === 'title'" class="ml-1 text-slate-700 dark:text-slate-200">
                    <ArrowUp v-if="sortOrder === 'asc'" class="w-4 h-4" />
                    <ArrowDown v-else class="w-4 h-4" />
                  </span>
                </div>
              </th>
              <th scope="col" @click="sortBy('hospital_name')" class="px-6 py-4 text-left text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider cursor-pointer hover:bg-slate-200/50 dark:hover:bg-slate-700/50 transition-colors">
                <div class="flex items-center">
                  醫院
                  <span v-if="sortKey === 'hospital_name'" class="ml-1 text-slate-700 dark:text-slate-200">
                    <ArrowUp v-if="sortOrder === 'asc'" class="w-4 h-4" />
                    <ArrowDown v-else class="w-4 h-4" />
                  </span>
                </div>
              </th>
              <th scope="col" @click="sortBy('amount')" class="px-6 py-4 text-right text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider cursor-pointer hover:bg-slate-200/50 dark:hover:bg-slate-700/50 transition-colors">
                <div class="flex items-center justify-end">
                  花費金額
                  <span v-if="sortKey === 'amount'" class="ml-1 text-slate-700 dark:text-slate-200">
                    <ArrowUp v-if="sortOrder === 'asc'" class="w-4 h-4" />
                    <ArrowDown v-else class="w-4 h-4" />
                  </span>
                </div>
              </th>
              <th scope="col" class="px-6 py-4 text-left text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">備註</th>
              <th scope="col" class="relative px-6 py-4 rounded-tr-2xl"><span class="sr-only">操作</span></th>
            </tr>
          </thead>
          <tbody class="divide-y divide-white/10 dark:divide-slate-700/30">
            <tr v-for="item in sortedTreatments" :key="item.id" class="hover:bg-sky-100/80 dark:hover:bg-sky-900/50 transition-all duration-200 group">
              <td class="px-6 py-4 whitespace-nowrap text-lg text-slate-600 dark:text-slate-300">{{ item.treatment_date }}</td>
              <td class="px-6 py-4 whitespace-nowrap text-lg font-bold text-slate-900 dark:text-slate-100">{{ item.title }}</td>
              <td class="px-6 py-4 whitespace-nowrap text-lg text-slate-500">
                <span class="inline-flex items-center px-2.5 py-1 rounded-full text-sm font-medium bg-blue-100/80 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800/50">
                  {{ item.claim_hospitals?.name }}
                </span>
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-lg text-slate-900 dark:text-slate-100 text-right font-mono font-bold">${{ item.amount.toLocaleString() }}</td>
              <td class="px-6 py-4 text-lg text-slate-500 dark:text-slate-400 max-w-[150px] truncate" :title="item.notes">{{ item.notes }}</td>
              <td class="px-6 py-4 whitespace-nowrap text-right text-lg font-medium">
                <div class="flex justify-end items-center space-x-1">
                  <!-- 文件管理按鈕 -->
                  <button @click="openDocsModal(item)" class="relative text-amber-600 dark:text-amber-400 hover:text-amber-900 dark:hover:text-amber-300 p-2 rounded-xl hover:bg-white/50 dark:hover:bg-slate-800/50 transition-colors" title="管理單據文件">
                    <Paperclip class="w-4 h-4" />
                    <span v-if="item.claim_treatment_documents?.length" class="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-white">
                      {{ item.claim_treatment_documents.length }}
                    </span>
                  </button>
                  
                  <!-- 查看理賠按鈕 -->
                  <button @click="openViewClaims(item)" class="text-emerald-600 dark:text-emerald-400 hover:text-emerald-900 dark:hover:text-emerald-300 p-2 rounded-xl hover:bg-white/50 dark:hover:bg-slate-800/50 transition-colors" title="查看關聯理賠">
                    <Search class="w-4 h-4" />
                  </button>
                  
                  <button @click="openModal(item)" class="text-indigo-600 dark:text-indigo-400 hover:text-indigo-900 dark:hover:text-indigo-300 p-2 rounded-xl hover:bg-white/50 dark:hover:bg-slate-800/50 transition-colors" title="編輯"><Edit2 class="w-4 h-4" /></button>
                  <button @click="handleDelete(item.id)" class="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300 p-2 rounded-xl hover:bg-white/50 dark:hover:bg-slate-800/50 transition-colors" title="刪除"><Trash2 class="w-4 h-4" /></button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- 其餘 Modal 保持不變 (編輯、查看理賠、文件上傳) -->
    <!-- Edit/Create Modal -->
    <div v-if="isModalOpen" class="fixed inset-0 z-50 overflow-y-auto">
      <div class="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:p-0">
        <div class="fixed inset-0 transition-opacity bg-slate-900/40 backdrop-blur-sm"></div>
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
                <input type="text" v-model="form.treatment_date" required placeholder="YYYY-MM-DD" pattern="\d{4}-\d{2}-\d{2}" class="w-full rounded-xl glass-input px-4 py-2 pr-12 font-mono" />
                <div class="absolute right-2 top-1/2 transform -translate-y-1/2 w-8 h-8 overflow-hidden cursor-pointer rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors flex justify-center items-center">
                  <span class="text-slate-500">📅</span>
                  <input type="date" v-model="form.treatment_date" class="absolute inset-0 opacity-0 cursor-pointer w-full h-full" />
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
              <button type="button" @click="closeModal" class="px-5 py-2.5 text-lg font-bold text-slate-700 dark:text-slate-300 bg-white/50 dark:bg-slate-800/50 hover:bg-white/80 dark:hover:bg-slate-700/80 rounded-xl transition-all shadow-sm">取消</button>
              <button type="submit" class="px-5 py-2.5 text-lg font-bold text-white bg-brand hover:bg-sky-500 rounded-xl shadow-lg shadow-sky-500/30 transition-all transform hover:scale-105 active:scale-95">儲存</button>
            </div>
          </form>
        </div>
      </div>
    </div>

    <!-- View Claims Modal -->
    <div v-if="isViewClaimsModalOpen" class="fixed inset-0 z-50 overflow-y-auto">
      <div class="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:p-0">
        <div class="fixed inset-0 transition-opacity bg-slate-900/40 backdrop-blur-sm"></div>
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
            </div>
            <div>
              <p class="text-sm font-bold text-slate-700 dark:text-slate-300 mb-3">關聯的理賠紀錄 ({{ sortedAssociatedClaims.length }} 筆)</p>
              <div v-if="sortedAssociatedClaims.length > 0" class="space-y-3 max-h-60 overflow-y-auto pr-2">
                <div v-for="rt in sortedAssociatedClaims" :key="rt.claim_records.id" class="bg-white/50 dark:bg-slate-800/50 p-4 rounded-xl border border-white/40 dark:border-slate-700/50 flex justify-between items-center shadow-sm">
                  <div>
                    <div class="flex items-center mb-1">
                      <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-emerald-100/80 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50 mr-2">{{ rt.claim_records.claim_insurance_companies?.name }}</span>
                      <span class="text-sm font-bold text-slate-700 dark:text-slate-300">{{ rt.claim_records.status }}</span>
                    </div>
                  </div>
                  <div class="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400">+${{ rt.claim_records.amount.toLocaleString() }}</div>
                </div>
              </div>
            </div>
            <div class="pt-6 flex justify-end">
              <button @click="closeViewClaims" class="px-5 py-2.5 text-lg font-bold text-slate-700 dark:text-slate-300 bg-white/50 dark:bg-slate-800/50 hover:bg-white/80 dark:hover:bg-slate-700/80 rounded-xl transition-all shadow-sm">關閉</button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Documents Upload Modal -->
    <div v-if="isDocsModalOpen" class="fixed inset-0 z-50 overflow-y-auto">
      <div class="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:p-0">
        <div class="fixed inset-0 transition-opacity bg-slate-900/40 backdrop-blur-sm"></div>
        <div class="relative inline-block w-full max-w-2xl p-8 overflow-hidden text-left align-middle transition-all transform glass-panel rounded-3xl shadow-2xl">
          <div class="flex justify-between items-center mb-6">
            <h3 class="text-xl font-bold leading-6 text-slate-900 dark:text-slate-100 flex items-center">
              <Paperclip class="w-5 h-5 mr-2 text-amber-500" />
              單據與文件管理
            </h3>
            <button @click="closeDocsModal" class="text-slate-400 hover:text-slate-500 dark:hover:text-slate-300 p-1 rounded-full hover:bg-white/20 dark:hover:bg-slate-700/50 transition-colors"><X class="w-5 h-5" /></button>
          </div>
          
          <div v-if="selectedTreatmentForDocs">
            <div class="mb-6 flex justify-between items-center">
              <p class="text-lg font-bold text-slate-900 dark:text-slate-100">
                {{ selectedTreatmentForDocs.title }} <span class="text-base text-slate-500 font-normal">({{ selectedTreatmentForDocs.treatment_date }})</span>
              </p>
              
              <label class="relative inline-flex items-center justify-center px-4 py-2 bg-amber-500 text-white text-base font-bold rounded-xl hover:bg-amber-600 shadow-lg shadow-amber-500/30 transition-all cursor-pointer transform hover:scale-105 active:scale-95" :class="{'opacity-50 cursor-not-allowed': isUploading}">
                <Loader2 v-if="isUploading" class="w-4 h-4 mr-2 animate-spin" />
                <FileUp v-else class="w-4 h-4 mr-2" />
                {{ isUploading ? '上傳處理中...' : '上傳新文件' }}
                <input type="file" multiple accept="image/*,.pdf" class="absolute inset-0 w-full h-full opacity-0 cursor-pointer" @change="handleFileUpload" :disabled="isUploading" />
              </label>
            </div>

            <div class="space-y-4 max-h-96 overflow-y-auto pr-2">
              <div v-if="treatmentDocuments.length === 0" class="text-center py-12 text-slate-500 glass-input rounded-xl border-dashed">
                尚無任何文件，點擊上方按鈕上傳收據或診斷證明。
              </div>

              <div v-for="doc in treatmentDocuments" :key="doc.id" class="group bg-white/50 dark:bg-slate-800/50 p-4 rounded-xl border border-white/40 dark:border-slate-700/50 flex justify-between items-center shadow-sm hover:shadow-md transition-all">
                <div class="flex items-center space-x-4 overflow-hidden">
                  <div class="w-16 h-16 rounded-lg bg-slate-200 dark:bg-slate-700 flex-shrink-0 flex items-center justify-center overflow-hidden shadow-inner">
                    <img v-if="doc.file_type?.startsWith('image/')" :src="doc.file_url" class="w-full h-full object-cover" />
                    <span v-else class="text-2xl font-bold text-slate-400">PDF</span>
                  </div>
                  
                  <div class="flex flex-col overflow-hidden">
                    <span class="text-base font-bold text-slate-800 dark:text-slate-200 truncate">{{ doc.file_name }}</span>
                    <span class="text-xs text-slate-500 dark:text-slate-400 mt-1">上傳於: {{ new Date(doc.created_at).toLocaleString() }}</span>
                  </div>
                </div>
                
                <div class="flex items-center space-x-2">
                  <a :href="doc.file_url" target="_blank" class="p-2 text-slate-500 hover:text-brand bg-white/60 dark:bg-slate-700/60 rounded-lg shadow-sm hover:shadow transition-all">
                    <Download class="w-4 h-4" />
                  </a>
                  <button @click="deleteDocument(doc.id, doc.file_url)" class="p-2 text-slate-500 hover:text-red-500 bg-white/60 dark:bg-slate-700/60 rounded-lg shadow-sm hover:shadow transition-all">
                    <Trash2 class="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

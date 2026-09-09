<script setup>
import { ref, onMounted, computed } from 'vue'
import { supabase } from '../supabase'
import { Wallet, Stethoscope, Receipt, AlertCircle } from 'lucide-vue-next'

const treatments = ref([])
const claims = ref([])
const mappings = ref([])
const companies = ref([])
const isLoading = ref(true)

const fetchData = async () => {
  isLoading.value = true
  
  const [tRes, cRes, mRes, compRes] = await Promise.all([
    supabase.value.from('claim_treatments').select('*').order('treatment_date'),
    supabase.value.from('claim_records').select('*'),
    supabase.value.from('claim_record_treatments').select('*'),
    supabase.value.from('claim_insurance_companies').select('*')
  ])
  
  if (tRes.data) treatments.value = tRes.data
  if (cRes.data) claims.value = cRes.data
  if (mRes.data) mappings.value = mRes.data
  if (compRes.data) companies.value = compRes.data
  
  isLoading.value = false
}

onMounted(() => {
  fetchData()
})

const companyName = (id) => {
  const c = companies.value.find(c => c.id === id)
  return c ? c.name : '未知公司'
}

// Algorithm to group connected treatments and claims
const groups = computed(() => {
  // 1. Build adjacency list for bipartite graph
  const adj = {}
  treatments.value.forEach(t => adj[`t_${t.id}`] = [])
  claims.value.forEach(c => adj[`c_${c.id}`] = [])
  
  mappings.value.forEach(m => {
    const tid = `t_${m.treatment_id}`
    const cid = `c_${m.record_id}`
    if(adj[tid] && adj[cid]) {
      adj[tid].push(cid)
      adj[cid].push(tid)
    }
  })

  // 2. Find connected components
  const visited = new Set()
  const components = []

  const bfs = (startNode) => {
    const queue = [startNode]
    visited.add(startNode)
    const compTreatments = []
    const compClaims = []

    while(queue.length > 0) {
      const curr = queue.shift()
      if (curr.startsWith('t_')) {
        compTreatments.push(treatments.value.find(t => t.id === curr.substring(2)))
      } else {
        compClaims.push(claims.value.find(c => c.id === curr.substring(2)))
      }
      
      adj[curr].forEach(neighbor => {
        if (!visited.has(neighbor)) {
          visited.add(neighbor)
          queue.push(neighbor)
        }
      })
    }
    return { compTreatments, compClaims }
  }

  // Iterate over all nodes
  Object.keys(adj).forEach(node => {
    if (!visited.has(node)) {
      const comp = bfs(node)
      // Only keep components that have at least one treatment or claim
      if (comp.compTreatments.length > 0 || comp.compClaims.length > 0) {
        components.push(comp)
      }
    }
  })

  // 3. Calculate financial summaries per component
  return components.map((comp, index) => {
    const sumTreatments = comp.compTreatments.reduce((sum, t) => sum + (t.amount || 0), 0)
    const sumClaims = comp.compClaims.reduce((sum, c) => sum + (c.amount || 0), 0)
    const actualExpense = sumTreatments - sumClaims
    
    // Sort treatments by date
    comp.compTreatments.sort((a, b) => new Date(a.treatment_date) - new Date(b.treatment_date))

    // Derive a name for the group based on its earliest treatment
    let groupTitle = `獨立理賠紀錄`
    if (comp.compTreatments.length > 0) {
      groupTitle = comp.compTreatments.length > 1 
        ? `${comp.compTreatments[0].title} 等 ${comp.compTreatments.length} 項合併療程` 
        : comp.compTreatments[0].title
    }

    return {
      id: `group_${index}`,
      title: groupTitle,
      treatments: comp.compTreatments,
      claims: comp.compClaims,
      sumTreatments,
      sumClaims,
      actualExpense
    }
  }).sort((a, b) => {
    // Sort by latest treatment date if available
    const aDate = a.treatments.length ? new Date(a.treatments[a.treatments.length-1].treatment_date) : 0
    const bDate = b.treatments.length ? new Date(b.treatments[b.treatments.length-1].treatment_date) : 0
    return bDate - aDate
  })
})

const grandTotalExpense = computed(() => {
  return groups.value.reduce((sum, g) => sum + g.actualExpense, 0)
})

</script>

<template>
  <div class="h-full flex flex-col">
    <div class="mb-6 flex justify-between items-end">
      <div>
        <h2 class="text-2xl font-bold text-gray-800">總覽儀表板</h2>
        <p class="text-gray-500 text-lg mt-1">自動合併關聯的療程與理賠金，精算您的實際自付額</p>
      </div>
    </div>

    <div v-if="isLoading" class="flex-1 flex justify-center items-center text-gray-400">
      載入中...
    </div>
    
    <div v-else class="flex-1 overflow-y-auto pb-8">
      
      <!-- Top Metrics -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div class="glass-panel rounded-2xl p-6 flex items-center">
          <div class="p-4 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 mr-4">
            <Stethoscope class="w-8 h-8" />
          </div>
          <div>
            <p class="text-lg font-medium text-slate-500 dark:text-slate-400">總醫療花費 (未扣理賠)</p>
            <p class="text-2xl font-bold font-mono text-slate-900 dark:text-white">${{ treatments.reduce((s, t)=>s+t.amount, 0).toLocaleString() }}</p>
          </div>
        </div>
        
        <div class="glass-panel rounded-2xl p-6 flex items-center">
          <div class="p-4 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 mr-4">
            <Receipt class="w-8 h-8" />
          </div>
          <div>
            <p class="text-lg font-medium text-slate-500 dark:text-slate-400">總理賠金</p>
            <p class="text-2xl font-bold font-mono text-slate-900 dark:text-white">${{ claims.reduce((s, c)=>s+c.amount, 0).toLocaleString() }}</p>
          </div>
        </div>

        <div class="rounded-2xl shadow-xl border border-white/20 dark:border-slate-700/50 p-6 flex items-center text-white relative overflow-hidden bg-gradient-to-br from-slate-800 to-slate-900 dark:from-slate-900 dark:to-black">
          <div class="absolute right-0 bottom-0 opacity-10 transform translate-x-1/4 translate-y-1/4">
            <Wallet class="w-32 h-32" />
          </div>
          <div class="relative z-10 w-full">
            <p class="text-lg font-medium text-slate-300 mb-1">最終實際自付總額</p>
            <div class="flex items-baseline space-x-2">
              <span class="text-4xl font-bold font-mono" :class="grandTotalExpense < 0 ? 'text-emerald-400' : 'text-white'">
                {{ grandTotalExpense < 0 ? '-' : '' }}${{ Math.abs(grandTotalExpense).toLocaleString() }}
              </span>
            </div>
            <p v-if="grandTotalExpense < 0" class="text-base text-emerald-400 font-medium mt-1">
              🎉 恭喜！總理賠金大於總花費，尚有結餘！
            </p>
          </div>
        </div>
      </div>

      <h3 class="text-xl font-bold text-slate-800 dark:text-slate-100 mb-4 flex items-center">
        <AlertCircle class="w-5 h-5 mr-2 text-brand" /> 分組明細分析
      </h3>
      
      <!-- Group Cards -->
      <div class="space-y-6">
        <div v-for="group in groups" :key="group.id" class="glass-panel rounded-2xl overflow-hidden">
          <!-- Card Header -->
          <div class="bg-white/40 dark:bg-slate-800/40 px-6 py-4 border-b border-white/20 dark:border-slate-700/50 flex justify-between items-center backdrop-blur-md">
            <h4 class="font-bold text-slate-800 dark:text-slate-100 text-xl">{{ group.title }}</h4>
            <div class="text-right">
              <div class="text-lg font-medium text-slate-500 dark:text-slate-400">此群組自付額</div>
              <div class="text-xl font-bold font-mono" :class="group.actualExpense < 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-900 dark:text-white'">
                 {{ group.actualExpense < 0 ? '-' : '' }}${{ Math.abs(group.actualExpense).toLocaleString() }}
              </div>
            </div>
          </div>
          
          <!-- Card Body -->
          <div class="p-6 grid grid-cols-1 lg:grid-cols-2 gap-8">
            <!-- Treatments Side -->
            <div>
              <h5 class="text-lg font-bold text-slate-700 dark:text-slate-300 mb-3 border-b border-slate-200 dark:border-slate-700/50 pb-2">涵蓋療程清單</h5>
              <ul class="space-y-3">
                <li v-for="t in group.treatments" :key="t.id" class="flex justify-between text-lg">
                  <div class="flex flex-col">
                    <span class="font-medium text-slate-800 dark:text-slate-200">{{ t.title }}</span>
                    <span class="text-base text-slate-500 dark:text-slate-400">{{ t.treatment_date }}</span>
                  </div>
                  <span class="font-mono text-slate-600 dark:text-slate-300">${{ t.amount.toLocaleString() }}</span>
                </li>
                <li v-if="!group.treatments.length" class="text-lg text-slate-400 italic">無關聯療程</li>
              </ul>
              <div class="mt-4 pt-2 border-t border-dashed border-slate-200 dark:border-slate-700 flex justify-between font-bold text-lg text-slate-700 dark:text-slate-300">
                <span>療程總花費</span>
                <span class="font-mono">${{ group.sumTreatments.toLocaleString() }}</span>
              </div>
            </div>
            
            <!-- Claims Side -->
            <div>
              <h5 class="text-lg font-bold text-slate-700 dark:text-slate-300 mb-3 border-b border-slate-200 dark:border-slate-700/50 pb-2">相關理賠紀錄</h5>
              <ul class="space-y-3">
                <li v-for="c in group.claims" :key="c.id" class="flex justify-between text-lg">
                  <div class="flex flex-col">
                    <span class="font-medium text-emerald-700 dark:text-emerald-400 flex items-center">
                      <span class="w-2 h-2 rounded-full bg-emerald-500 mr-2"></span>
                      {{ companyName(c.company_id) }}
                    </span>
                    <span class="text-base text-slate-500 dark:text-slate-400">{{ c.status }} | {{ c.received_date || '未定' }}</span>
                  </div>
                  <span class="font-mono text-emerald-600 dark:text-emerald-400">+${{ c.amount.toLocaleString() }}</span>
                </li>
                <li v-if="!group.claims.length" class="text-lg text-slate-400 italic">目前尚未有理賠紀錄</li>
              </ul>
              <div class="mt-4 pt-2 border-t border-dashed border-slate-200 dark:border-slate-700 flex justify-between font-bold text-lg text-emerald-700 dark:text-emerald-400">
                <span>群組總理賠</span>
                <span class="font-mono">${{ group.sumClaims.toLocaleString() }}</span>
              </div>
            </div>
          </div>
        </div>
        
        <div v-if="groups.length === 0" class="text-center py-12 text-slate-500 glass-panel rounded-2xl border-dashed">
          尚無任何資料可供分析，請先新增療程與理賠紀錄。
        </div>
      </div>
      
    </div>
  </div>
</template>

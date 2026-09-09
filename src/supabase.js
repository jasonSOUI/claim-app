import { createClient } from '@supabase/supabase-js'
import { ref } from 'vue'

export const supabase = ref(null)

export function initSupabase() {
  const url = localStorage.getItem('SUPABASE_URL')
  const key = localStorage.getItem('SUPABASE_SECRET_KEYS')
  
  if (url && key) {
    try {
      supabase.value = createClient(url, key)
      return true
    } catch (e) {
      console.error('Invalid Supabase URL or Key')
      return false
    }
  }
  return false
}

// Call initially
initSupabase()

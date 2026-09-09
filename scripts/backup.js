import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'
import https from 'https'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// === 您的 Supabase 連線資訊 ===
// 在這裡填入您的 URL 與 Key (或是讓腳本讀取 .env)
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '請填入您的_SUPABASE_URL'
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || '請填入您的_SUPABASE_ANON_KEY'

if (SUPABASE_URL.includes('請填入')) {
  console.error('❌ 請先在 scripts/backup.js 中填寫您的 Supabase URL 與 Key！')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

const TABLES_TO_BACKUP = [
  'claim_hospitals',
  'claim_insurance_companies',
  'claim_treatments',
  'claim_records',
  'claim_record_treatments',
  'claim_treatment_documents'
]

const BACKUP_DIR = path.join(__dirname, '..', `backup_${new Date().toISOString().replace(/[:.]/g, '-')}`)

if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true })
}
const RECEIPTS_DIR = path.join(BACKUP_DIR, 'receipts')
if (!fs.existsSync(RECEIPTS_DIR)) {
  fs.mkdirSync(RECEIPTS_DIR, { recursive: true })
}

async function backupDatabase() {
  console.log('📦 開始備份資料庫...')
  
  for (const table of TABLES_TO_BACKUP) {
    console.log(`- 讀取資料表: ${table}`)
    const { data, error } = await supabase.from(table).select('*')
    
    if (error) {
      console.error(`❌ 讀取 ${table} 失敗:`, error.message)
      continue
    }

    const filePath = path.join(BACKUP_DIR, `${table}.json`)
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8')
    console.log(`  ✅ 成功儲存 ${data.length} 筆紀錄`)
  }
}

async function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest)
    https.get(url, (response) => {
      response.pipe(file)
      file.on('finish', () => {
        file.close(resolve)
      })
    }).on('error', (err) => {
      fs.unlink(dest, () => reject(err))
    })
  })
}

async function backupStorage() {
  console.log('\n🖼️  開始備份 Storage 收據檔案...')
  
  const { data: folders, error: folderError } = await supabase.storage.from('receipts').list()
  
  if (folderError) {
    console.error('❌ 取得檔案列表失敗:', folderError.message)
    return
  }

  let totalFiles = 0;
  for (const item of folders) {
    if (!item.id) {
      const folderName = item.name
      const { data: files } = await supabase.storage.from('receipts').list(folderName)
      
      if (files) {
        const targetFolder = path.join(RECEIPTS_DIR, folderName)
        if (!fs.existsSync(targetFolder)) fs.mkdirSync(targetFolder, { recursive: true })

        for (const file of files) {
          if (file.name === '.emptyFolderPlaceholder') continue
          const { data: urlData } = supabase.storage.from('receipts').getPublicUrl(`${folderName}/${file.name}`)
          console.log(`- 下載檔案: ${folderName}/${file.name}`)
          await downloadFile(urlData.publicUrl, path.join(targetFolder, file.name))
          totalFiles++
        }
      }
    } else {
      if (item.name === '.emptyFolderPlaceholder') continue
      const { data: urlData } = supabase.storage.from('receipts').getPublicUrl(item.name)
      console.log(`- 下載檔案: ${item.name}`)
      await downloadFile(urlData.publicUrl, path.join(RECEIPTS_DIR, item.name))
      totalFiles++
    }
  }
  
  console.log(`✅ 成功下載 ${totalFiles} 個附件檔案！`)
}

async function run() {
  console.log('====================================')
  console.log('🚀 開始執行自動備份腳本')
  console.log('====================================\n')
  
  await backupDatabase()
  await backupStorage()
  
  console.log('\n🎉 備份完成！所有資料已儲存於:', BACKUP_DIR)
}

run()

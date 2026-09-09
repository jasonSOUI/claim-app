# 📂 Supabase + GitHub Pages (BYOD 架構) 開發與踩坑指南

這是一份關於本「理賠小幫手」純前端應用程式的架構、踩坑與部屬紀錄。當未來需要延續開發或是複製架構給其他人使用時，可參考這份筆記快速上手。

---

## 1. 架構核心：BYOD (Bring Your Own Database)

本專案採用了非常輕量、適合個人使用的 **BYOD 架構**。

* **運作原理**：這是一個 100% 純前端的 SPA (Single Page Application)。系統內建資料庫邏輯，使用者首次進入時，輸入自己的 Supabase URL 與 Anon Key，儲存於 `localStorage`。
* **優點**：
  * **零伺服器成本**：不需要架設 Node.js 或 Python 後端伺服器。
  * **高相容、好部屬**：前端編譯出來的 `dist` 可以掛在 GitHub Pages 免費託管。
  * **隱私性高**：金鑰只存在使用者的瀏覽器裡，資料完全保存在使用者私人的空間。

---

## 2. 前端設定踩坑紀錄 (Vue 3 + Vite)

在部署至 GitHub Pages 時，前端路由與打包設定有幾個必知的坑：

> [!WARNING]
> **Vite 基礎路徑設定 (base)**
> 預設的 Vite 打包路徑是根目錄 `/`。在 GitHub Pages 上，網址通常會是 `https://username.github.io/repo-name/`。如果不更改，所有的 CSS 與 JS 檔案都會因為 404 找不到。
> **解法**：在 `vite.config.js` 加上 `base: './'`，改為相對路徑。

> [!CAUTION]
> **Vue Router 坑：請使用 Hash 模式**
> Vue 預設使用 `createWebHistory()`。這會產生看起來很乾淨的網址 (如 `/dashboard`)。使用者在該頁面按下 F5 重新整理時，GitHub Pages 會去找伺服器上的 `dashboard.html`，結果找不到就會報 404 錯誤。
> **解法**：改用 `createWebHashHistory()`。網址會變成 `/#/dashboard`，因 `#` 後面的網址改變不會傳到伺服器，由前端的 Vue Router 接手，解決重新整理 404 問題。

---

## 3. Supabase 資料庫與權限

Supabase 提供了強大的 PostgreSQL 關聯資料庫與直接的 API。

### 路由守衛 (Router Guards)
* 為防止未登入，在 Vue Router 設定路由攔截 (`beforeEach`)。
* 在每次跳轉前，檢查 `localStorage.getItem('SUPABASE_URL')`。若無則強制導向 `/setup` 頁面。
* **注意**：寫入與讀取 `localStorage` Key 名稱必須一致，否則會產生「無限導向迴圈」的 Bug。

### RLS (Row Level Security) 策略
* 從前端連線至 Supabase 時，預設會被 RLS 擋下。
* 個人 BYOD 系統，可直接用 SQL 開啟 RLS 並設定全域允許存取：
  ```sql
  ALTER TABLE my_table ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "Allow all actions" ON my_table FOR ALL USING (true);
  ```

---

## 4. Supabase Storage 檔案上傳與壓縮

為了實現醫療單據（收據、診斷證明）上傳功能，我們整合了 Supabase Storage。

### 儲存空間權限 (Storage RLS)
* 建立 Bucket (例如 `receipts`) 後，必須對 `storage.objects` 表設定 RLS。
* **坑**：即使勾選 Public Bucket，匿名使用者 (Anon Key) 預設依舊「無法上傳 (Insert)」。
* **解法**：必須針對 `storage.objects` 寫入明確的 `FOR INSERT` 政策，搭配 `WITH CHECK`：
  ```sql
  CREATE POLICY "Allow Public Insert" ON storage.objects FOR INSERT TO public WITH CHECK (bucket_id = 'receipts');
  ```

### 前端無損壓縮保護機制
* Supabase 免費版 Storage 容量上限為 1GB。若直接上傳手機原圖，很快就會塞滿。
* **解法**：在前端引入 `browser-image-compression`。使用者選取圖片後，瀏覽器會在本地端將圖片壓縮到 **300 KB 以內**。
* **效益**：不僅大幅加快上傳與讀取速度，還能讓 1GB 免費容量足以容納超過 3,400 張單據圖片，完美解決容量焦慮。

---

## 5. UI/UX 與排版實作技巧

本專案大量使用了 Glassmorphism (毛玻璃) 搭配 Dark Mode，遇到幾個常犯的雷：

> [!IMPORTANT]
> **深色模式下的 `<select>` 陷阱**
> 為了外觀統一，一開始把 `<option>` 設定了 `text-slate-900`。
> 在 Windows/macOS 系統深色模式下，原生選單背景會變黑，導致「黑底黑字」無法閱讀。
> **解法**：必須乖乖在 `<option>` 加上完整的深淺色設定：
> `class="bg-white text-slate-900 dark:bg-slate-800 dark:text-slate-100"`

> [!TIP]
> **表格排版與 Z-Index**
> 將操作按鈕設定為 `absolute` 固定在卡片右上角時，若 HTML 結構 (Flex Box) 順序在絕對定位後面，會產生一層無形的遮罩擋住按鈕點擊。
> 若把 `<td>` 設定為 `flex`，會破壞表格儲存格的特性，導致按鈕跑出版面。
> **解法**：絕對定位加上 `z-10` 與 `@click.stop`；表格的 Flex 排列必須包在 `<td>` 內層的 `<div>` 中。

### 表格表頭動態排序
* 表格加入了點擊標題即可切換排序 (asc/desc) 的功能。
* **實作技巧**：不要動到原始 API 抓取下來的資料 (`treatments.value`)，而是透過 `computed()` 建立一份動態排序的陣列 (`sortedTreatments`) 供 `v-for` 渲染，這樣在切換排序時效能最好且不會污染原始資料。

---

## 6. 自動化部署：GitHub Actions for Pages

要將 Vue SPA 部署到 GitHub Pages，最現代、乾淨的做法是寫一個 `.github/workflows/deploy.yml`。

### 部署流程四大步驟：
1. **Push 程式碼**：將原始碼 (包含 Workflow 設定) 推上 `main` 分支。
2. **修改 GitHub 設定**：到專案的 Settings -> Pages -> Build and deployment -> Source，將其改為 **"GitHub Actions"**。這步最重要，沒改的話 Actions 跑到最後一步會噴出 `HttpError: Not Found` 錯誤。
3. **自動打包**：GitHub 雲端會自動跑 `npm run build`，並將 `dist` 資料夾打包成 artifact。
4. **自動發布**：將 artifact 解開到 GitHub 伺服器，並上線。

若部署時序錯亂 (例如程式碼還沒設定好 Pages Source)，只需到 Actions 點擊 **"Re-run all jobs"** 即可解決。

# 🚀 Supabase + GitHub Pages (BYOD 架構) 開發與部署實戰指南

這份文件記錄了開發「保險理賠小幫手」過程中的所有關鍵決策、踩坑紀錄與最佳實踐。未來若有類似的「純前端 + 雲端資料庫」個人工具開發需求，可直接參考此指南快速上手。

---

## 1. 架構核心：BYOD (Bring Your Own Database)

本專案採用了非常適合個人工具的 **BYOD 架構**。

* **運作原理**：網頁本身是一個 100% 的純前端靜態 SPA (Single Page Application)。系統不內建任何資料庫金鑰，使用者進入網頁時，必須輸入自己的 Supabase URL 與 Anon Key，並儲存於瀏覽器的 `localStorage`。
* **優勢**：
  * **零後端維護成本**：完全不需要架設 Node.js 或 Python 後端伺服器。
  * **完美相容靜態託管**：前端編譯出來的 `dist` 可以直接丟到 GitHub Pages 免費代管。
  * **絕對隱私安全**：原始碼公開在 GitHub 上非常安全，因為金鑰只存在使用者的個人電腦裡。

---

## 2. 前端設定注意事項 (Vue 3 + Vite)

在搭配 GitHub Pages 時，前端路由與打包設定有幾個必須遵守的鐵則：

> [!WARNING]
> **Vite 基礎路徑設定 (base)**
> 預設 Vite 打包時的路徑是絕對路徑 `/`。但在 GitHub Pages 上，網址通常會是 `https://username.github.io/repo-name/`。如果沒有修改，所有的 CSS 與 JS 檔案都會回報 404 找不到。
> **解法**：在 `vite.config.js` 加上 `base: './'`，改為相對路徑。

> [!CAUTION]
> **Vue Router 的坑：請使用 Hash 模式**
> Vue 預設使用 `createWebHistory()`。這會讓網址看起來很漂亮 (如 `/dashboard`)。但當使用者在該頁面按下「F5 重新整理」時，GitHub Pages 會嘗試去伺服器找 `dashboard.html`，結果找不到就會跳 404 錯誤。
> **解法**：改用 `createWebHashHistory()`。網址會變成 `/#/dashboard`，因為 `#` 後面的路徑不會送到伺服器，完全由前端 Vue Router 掌控，完美解決重新整理 404 的問題。

---

## 3. Supabase 資料庫與整合

Supabase 提供了強大的 PostgreSQL 關聯式資料庫與即時 API。

### 認證與防護網 (Router Guards)
* 由於金鑰是動態輸入的，必須在 Vue Router 設定全域攔截器 (`beforeEach`)。
* 在每次跳轉路由前，檢查 `localStorage.getItem('SUPABASE_URL')`。若無金鑰，強制導向 `/setup` 頁面。
* **注意**：存入與讀取的 `localStorage` Key 名稱必須嚴格一致，否則會發生「無限導向回首頁」的 Bug。

### RLS (Row Level Security) 政策
* 從前端直接存取 Supabase 時，預設會被 RLS 擋下。
* 對於個人的 BYOD 系統，可在建表 SQL 中開啟 RLS 並設定全域允許政策：
  ```sql
  ALTER TABLE my_table ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "Allow all actions" ON my_table FOR ALL USING (true);
  ```

---

## 4. UI/UX 與 Tailwind CSS 踩坑紀錄 (暗色模式)

這次專案大量使用了 Glassmorphism (毛玻璃) 搭配 Dark Mode，遇到了幾個常見的視覺陷阱：

> [!IMPORTANT]
> **原生下拉選單 `<select>` 在暗色模式的悲劇**
> 為了讓淺色模式看得清楚，一開始在 `<option>` 設定了 `text-slate-900`。
> 但在 Windows/macOS 的暗色模式下，瀏覽器原生會把選單背景塗黑，造成「黑底黑字」完全無法閱讀。
> **解法**：永遠要為 `<option>` 加上完整的深色設定：
> `class="bg-white text-slate-900 dark:bg-slate-800 dark:text-slate-100"`

> [!TIP]
> **絕對定位與點擊失效 (Z-Index)**
> 將「編輯 / 刪除」按鈕用 `absolute` 定位在卡片右上角時，雖然滑鼠移過去能看到按鈕，但點擊卻沒反應。
> 原因是後方的 HTML 元素 (Flex Box) 在渲染順序上比較晚，產生了一層隱形的覆蓋層擋住了滑鼠點擊。
> **解法**：為 `absolute` 容器加上 `z-10`，並在按鈕綁定加上 `@click.stop` 防止事件冒泡。

---

## 5. 自動化部署：GitHub Actions for Pages

要將 Vue SPA 部署到 GitHub Pages，最現代、最推薦的做法是寫一支 `.github/workflows/deploy.yml`。

### 部署流程四大步驟：
1. **Push 程式碼**：將原始碼 (包含 Workflow 設定) 推上 `main` 分支。
2. **修改 GitHub 設定**：到專案的 Settings -> Pages -> Build and deployment -> Source，將其改為 **"GitHub Actions"**。（這一步非常重要，沒有改的話 Actions 跑到最後上傳那一步會噴出 `HttpError: Not Found` 的錯誤）。
3. **自動打包**：GitHub 雲端會自動執行 `npm run build`，並將 `dist` 資料夾打包為 artifact。
4. **自動發布**：將 artifact 解壓縮到 GitHub 伺服器並上線。

若因為時間差導致第一次部署失敗 (例如推程式碼時還沒設定好 Pages Source)，只需到 Actions 頁籤點擊 **"Re-run all jobs"** 即可解決。

# 🏥 保險理賠小幫手 (Insurance Claims Assistant)

這是一個基於 **Vue 3** + **Supabase** 開發的個人醫療理賠追蹤系統。
採用現代感十足的 **Glassmorphism (毛玻璃)** 介面設計，並支援自動深淺色模式切換，幫助您輕鬆且優雅地記錄每一次的醫療花費與保險理賠。

---

## ✨ 核心特色

* 💅 **高質感毛玻璃介面**：結合 Tailwind CSS 與動態漸層背景，帶來猶如 iOS 系統般的流暢視覺體驗。支援完整 Dark / Light Mode 切換。
* 📊 **精準財務追蹤**：採用「多對多 (Many-to-Many)」的資料庫關聯設計。因為一筆保險理賠（例如實支實付）往往涵蓋了多次的門診與手術，系統會自動透過 Graph BFS 演算法將相關的療程與理賠分組，精準計算出每個醫療事件的「最終實際自付額」。
* 🔄 **雙向關聯查詢**：不僅能從「理賠紀錄」中查看包含了哪些療程；也能從「療程管理」中反向查詢該次看診已經收到哪些理賠，確保對帳不漏接。
* 🔒 **BYOD 絕對隱私 (Bring Your Own Database)**：本專案為 100% 的純前端靜態網頁 (SPA)，無專屬後端伺服器。使用者進入系統時需輸入自己的 Supabase 金鑰，資料完全掌握在您個人手中，絕無隱私外洩風險。

---

## 🚀 線上使用 (GitHub Pages)

因為採用了 BYOD 架構，本系統已完美整合 GitHub Actions，並託管於 GitHub Pages 上。

👉 **[點我開啟保險理賠小幫手](https://jasonSOUI.github.io/claim-app/)**

### 登入與設定方式：
1. 請先擁有您個人的 [Supabase](https://supabase.com/) 專案。
2. 在您的 Supabase SQL Editor 中，執行本專案根目錄或關聯的 `claims_setup.sql` 以建立所需的資料表與 RLS (Row Level Security) 規則。
3. 開啟上方的 GitHub Pages 連結。
4. 於設定畫面輸入您 Supabase 的 `URL` 與 `Anon Key`。
5. 金鑰將僅會安全地加密儲存於您當前瀏覽器的 `localStorage` 中，即可開始使用！

---

## 💻 本地開發指南

若您想在自己的電腦上運行或修改此專案，請確保您已安裝 Node.js (v18+)。

### 1. 安裝依賴套件
```bash
npm install
```

### 2. 啟動開發伺服器
```bash
npm run dev
```
啟動後，請開啟瀏覽器訪問終端機提示的 `localhost` 網址。

### 3. 編譯打包 (部署用)
```bash
npm run build
```
將會生成 `dist` 資料夾，即可將其部署至任何靜態網頁伺服器（如 Vercel, Netlify, 或 GitHub Pages）。

---

## 🛠 技術棧 (Tech Stack)

* **核心框架**: [Vue 3](https://vuejs.org/) (Composition API)
* **建置工具**: [Vite](https://vitejs.dev/)
* **路由管理**: [Vue Router](https://router.vuejs.org/) (使用 Hash 模式以相容靜態部署)
* **UI 與樣式**: [Tailwind CSS](https://tailwindcss.com/)
* **圖示庫**: [Lucide Vue](https://lucide.dev/)
* **資料庫與驗證**: [Supabase](https://supabase.com/) (PostgreSQL)

---

## 📝 授權條款

MIT License

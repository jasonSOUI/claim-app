-- ========================================================
-- 理賠紀錄系統 Supabase 資料庫初始化腳本
-- 請將此腳本複製到 Supabase Dashboard -> SQL Editor 執行
-- ========================================================

-- 強制設定當前會話為可讀寫 (防止部分 Supabase 池化連接處於唯讀狀態)
SET default_transaction_read_only = off;

-- ==========================================
-- 0. 清除舊有資料表 (若需保留資料請把此段註解)
-- ==========================================
DROP TABLE IF EXISTS public.claim_record_treatments CASCADE;
DROP TABLE IF EXISTS public.claim_records CASCADE;
DROP TABLE IF EXISTS public.claim_expenses CASCADE;
DROP TABLE IF EXISTS public.claim_treatments CASCADE;
DROP TABLE IF EXISTS public.claim_hospitals CASCADE;
DROP TABLE IF EXISTS public.claim_insurance_companies CASCADE;

-- ==========================================
-- 1. 建立所有資料表
-- ==========================================

-- 1-1. 建立保險公司清單表
CREATE TABLE IF NOT EXISTS public.claim_insurance_companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 1-2. 建立醫院清單表
CREATE TABLE IF NOT EXISTS public.claim_hospitals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 1-3. 建立療程/就醫事件表
CREATE TABLE IF NOT EXISTS public.claim_treatments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hospital_id UUID REFERENCES public.claim_hospitals(id) ON DELETE RESTRICT,
    treatment_date DATE NOT NULL,
    title TEXT NOT NULL,
    amount INTEGER NOT NULL DEFAULT 0, -- 療程花費金額
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- (以 amount 紀錄該療程的花費，實際花費差額由前端自動分組計算)

-- 1-5. 建立保險理賠單/匯款紀錄表 (原本的 claims，為避免 claim_claims 語意重複，命名為 claim_records)
CREATE TABLE IF NOT EXISTS public.claim_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES public.claim_insurance_companies(id) ON DELETE RESTRICT,
    amount INTEGER NOT NULL,
    status TEXT DEFAULT '已入帳',
    received_date DATE,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 1-6. 建立理賠與療程的多對多關聯表
CREATE TABLE IF NOT EXISTS public.claim_record_treatments (
    record_id UUID REFERENCES public.claim_records(id) ON DELETE CASCADE,
    treatment_id UUID REFERENCES public.claim_treatments(id) ON DELETE CASCADE,
    PRIMARY KEY (record_id, treatment_id)
);


-- ==========================================
-- 2. 啟動 Row Level Security (RLS)
-- ==========================================
ALTER TABLE public.claim_insurance_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.claim_hospitals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.claim_treatments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.claim_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.claim_record_treatments ENABLE ROW LEVEL SECURITY;


-- ==========================================
-- 3. 允許 Anon (公開角色) 讀寫
-- ==========================================

-- claim_insurance_companies
DROP POLICY IF EXISTS "Allow public read and write access" ON public.claim_insurance_companies;
CREATE POLICY "Allow public read and write access" ON public.claim_insurance_companies FOR ALL USING (true) WITH CHECK (true);

-- claim_hospitals
DROP POLICY IF EXISTS "Allow public read and write access" ON public.claim_hospitals;
CREATE POLICY "Allow public read and write access" ON public.claim_hospitals FOR ALL USING (true) WITH CHECK (true);

-- claim_treatments
DROP POLICY IF EXISTS "Allow public read and write access" ON public.claim_treatments;
CREATE POLICY "Allow public read and write access" ON public.claim_treatments FOR ALL USING (true) WITH CHECK (true);


-- claim_records
DROP POLICY IF EXISTS "Allow public read and write access" ON public.claim_records;
CREATE POLICY "Allow public read and write access" ON public.claim_records FOR ALL USING (true) WITH CHECK (true);

-- claim_record_treatments
DROP POLICY IF EXISTS "Allow public read and write access" ON public.claim_record_treatments;
CREATE POLICY "Allow public read and write access" ON public.claim_record_treatments FOR ALL USING (true) WITH CHECK (true);


-- ==========================================
-- 4. 插入預設資料 (保險公司與醫院)
-- ==========================================

INSERT INTO public.claim_insurance_companies (name) 
VALUES 
    ('國泰人壽'), 
    ('南山人壽'), 
    ('凱基人壽(團險)')
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.claim_hospitals (name) 
VALUES 
    ('亞東醫院')
ON CONFLICT (name) DO NOTHING;

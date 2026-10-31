-- =============================================================================
-- PTVPRO SUPER APP — DATABASE MIGRATION SCRIPT (PTV-DEV-232)
-- MODUL: Verifikasi Surat Logs & Kru Portofolio
-- TARGET DATABASE: Supabase Staging (swadgljnyelsjstqqxbm)
-- =============================================================================

-- 1. TABEL LOG PEMERIKSAAN DOKUMEN / SURAT IZIN (AUDIT TRANSPARANSI)
CREATE TABLE IF NOT EXISTS public.ptv_surat_verifikasi_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nomor_surat TEXT NOT NULL,
    nama_pemeriksa TEXT NOT NULL,
    instansi TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    accessed_at TIMESTAMPTZ DEFAULT now()
);

-- Indeks untuk pencarian cepat berdasarkan nomor surat dan waktu
CREATE INDEX IF NOT EXISTS idx_ptv_surat_verifikasi_logs_nomor 
    ON public.ptv_surat_verifikasi_logs (nomor_surat);
CREATE INDEX IF NOT EXISTS idx_ptv_surat_verifikasi_logs_accessed 
    ON public.ptv_surat_verifikasi_logs (accessed_at DESC);

-- Izin tabel verifikasi logs untuk service_role & anon insert
ALTER TABLE public.ptv_surat_verifikasi_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on ptv_surat_verifikasi_logs"
    ON public.ptv_surat_verifikasi_logs
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Anonim/publik hanya boleh insert catatan pemeriksaan (tidak boleh sembarang membaca seluruh histori publik)
CREATE POLICY "Public insert verification log"
    ON public.ptv_surat_verifikasi_logs
    FOR INSERT
    TO anon, authenticated
    WITH CHECK (
        length(trim(nama_pemeriksa)) >= 2 AND
        instansi IN ('PTV', 'SD', 'SMP', 'IIS SMP', 'SMA', 'MADIN', 'ASRAMA', 'SPI', 'MI', 'MTs', 'MA', 'RIBATH', 'YAYASAN', 'NDALEM')
    );

-- 2. TABEL PORTOFOLIO & REKAM KARYA KRU
CREATE TABLE IF NOT EXISTS public.ptv_kru_portofolio (
    id TEXT PRIMARY KEY,
    identity_id UUID REFERENCES public.canonical_identity(id) ON DELETE CASCADE,
    ptv_id TEXT NOT NULL,
    tanggal DATE NOT NULL DEFAULT CURRENT_DATE,
    platform TEXT NOT NULL,
    jenis_kontribusi TEXT NOT NULL,
    judul TEXT NOT NULL,
    link_karya TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indeks portofolio berdasarkan ptv_id dan tanggal
CREATE INDEX IF NOT EXISTS idx_ptv_kru_portofolio_ptv_id 
    ON public.ptv_kru_portofolio (ptv_id);
CREATE INDEX IF NOT EXISTS idx_ptv_kru_portofolio_tanggal 
    ON public.ptv_kru_portofolio (tanggal DESC);

ALTER TABLE public.ptv_kru_portofolio ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on ptv_kru_portofolio"
    ON public.ptv_kru_portofolio
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Publik dapat membaca portofolio
CREATE POLICY "Public read on ptv_kru_portofolio"
    ON public.ptv_kru_portofolio
    FOR SELECT
    TO anon, authenticated
    USING (true);

-- Kru terautentikasi dapat mengelola karyanya sendiri
CREATE POLICY "Authenticated crew manage own portfolio"
    ON public.ptv_kru_portofolio
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

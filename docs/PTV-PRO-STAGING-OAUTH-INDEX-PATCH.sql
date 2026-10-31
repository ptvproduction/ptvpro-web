-- ============================================================================
-- PTV PRO STAGING OAUTH UNIQUE INDEX PATCH
-- File: docs/PTV-PRO-STAGING-OAUTH-INDEX-PATCH.sql
-- Target: Supabase Cloud Staging (swadgljnyelsjstqqxbm)
-- ============================================================================
-- Ringkasan:
-- 1. Pra-pemeriksaan duplikasi (Read-only)
-- 2. DDL Partial Unique Index pada (oauth_provider, oauth_subject_id)
-- 3. Verifikasi katalog PostgreSQL (pg_indexes)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. PRA-PEMERIKSAAN DUPLIKASI DATA EKSISTING (READ-ONLY)
-- Menjamin tidak ada rekaman duplikat sebelum indeks unik dipasang
-- ----------------------------------------------------------------------------
SELECT 
    oauth_provider, 
    oauth_subject_id, 
    COUNT(*) as duplicate_count,
    array_agg(account_id) as affected_accounts
FROM public.auth_credentials
WHERE oauth_provider IS NOT NULL 
  AND oauth_subject_id IS NOT NULL
GROUP BY oauth_provider, oauth_subject_id
HAVING COUNT(*) > 1;

-- ----------------------------------------------------------------------------
-- 2. DDL PARTIAL UNIQUE INDEX
-- Menjamin 1 akun Google hanya dapat ditautkan ke tepat 1 akun kru PTVPRO
-- Partial index: Hanya mengindeks baris yang memiliki nilai provider & subject
-- ----------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS idx_auth_credentials_oauth_provider_subject
ON public.auth_credentials (oauth_provider, oauth_subject_id)
WHERE oauth_provider IS NOT NULL AND oauth_subject_id IS NOT NULL;

-- ----------------------------------------------------------------------------
-- 3. VERIFIKASI KATALOG POSTGRESQL (PG_INDEXES)
-- Membuktikan secara definitif bahwa indeks telah terdaftar di mesin PostgreSQL
-- ----------------------------------------------------------------------------
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public' 
  AND tablename = 'auth_credentials'
  AND indexname = 'idx_auth_credentials_oauth_provider_subject';

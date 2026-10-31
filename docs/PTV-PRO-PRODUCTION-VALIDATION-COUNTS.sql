-- ============================================================================
-- PTV PRO -- PRODUCTION LIVE RECORD COUNT VALIDATION (ALL TABLES IN SCHEMA)
-- Target Database: Supabase Production (jthzuhkblxcaohiuypqq)
-- Status         : STRICTLY READ-ONLY (SELECT COUNT DARI TABEL AKTUAL)
--
-- PANDUAN OPERATOR:
-- Jalankan query ini di SQL Editor Production untuk melihat SELURUH TABEL
-- yang benar-benar ada di public schema beserta jumlah baris riilnya.
-- ============================================================================

SELECT 
    table_name,
    (xpath('/row/c/text()', query_to_xml(format('SELECT COUNT(*) AS c FROM %I', table_name), false, true, '')))[1]::text::bigint AS total_baris
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_type = 'BASE TABLE'
ORDER BY total_baris DESC, table_name ASC;

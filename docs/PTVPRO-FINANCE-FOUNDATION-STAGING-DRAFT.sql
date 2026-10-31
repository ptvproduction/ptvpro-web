-- DRAFT v2 / BELUM DIEKSEKUSI. Memerlukan ACC operator; PostgreSQL 17 Staging.
-- Host eksternal WAJIB diverifikasi swadgljnyelsjstqqxbm. GUC di bawah hanya konfirmasi manual.
-- Sebelum eksekusi: simpan snapshot relacl, attacl, role memberships, policies dan fingerprint
-- data sesuai docs/PTVPRO-FINANCE-TRANSACTION-CONTRACT.md. Snapshot lama bukan backup ACL saat eksekusi.
-- Tutup penulisan langsung SEMUA pengguna Data API, termasuk pengelola, sampai RPC atomik tersedia.
-- Tidak mengubah data/tabel/policy, SELECT existing, owner atau service_role.
-- Error apa pun: STOP, ROLLBACK; jangan lanjut ke COMMIT/menjalankan sebagian script.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
-- Operator menyisipkan SET LOCAL app.target_project_ref dan app.finance_acl_backup_confirmed
-- SETELAH BEGIN, sebelum guard ini, setelah host dan penyimpanan snapshot dikonfirmasi.
DO $$
BEGIN
  IF current_setting('app.target_project_ref', true) IS DISTINCT FROM 'swadgljnyelsjstqqxbm' THEN
    RAISE EXCEPTION 'Target Staging belum dikonfirmasi; hentikan eksekusi';
  END IF;
  IF current_setting('app.finance_acl_backup_confirmed', true) IS DISTINCT FROM 'yes' THEN
    RAISE EXCEPTION 'Snapshot ACL untuk rollback belum dikonfirmasi';
  END IF;
  IF current_setting('server_version_num')::integer < 170000 THEN
    RAISE EXCEPTION 'Draft MAINTAIN ini memerlukan PostgreSQL 17 atau lebih baru';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_class WHERE oid IN ('public.ptv_keuangan'::regclass,
      'public.ptv_pemasukan'::regclass,'public.ptv_pengeluaran'::regclass,
      'public.ptv_kas_kru'::regclass,'public.ptv_kas_periode'::regclass)
      AND (NOT relrowsecurity OR pg_get_userbyid(relowner) <> current_user)
  ) THEN RAISE EXCEPTION 'RLS/owner berbeda dari prasyarat audit; hentikan dan tinjau ulang'; END IF;
END $$;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN
  ON public.ptv_keuangan, public.ptv_pemasukan, public.ptv_pengeluaran,
     public.ptv_kas_kru, public.ptv_kas_periode FROM PUBLIC, anon, authenticated RESTRICT;
-- REVOKE tabel tidak cukup bila terdapat grant kolom eksplisit di masa mendatang.
DO $$
DECLARE t regclass; cols text; role_name text;
BEGIN
  FOREACH t IN ARRAY ARRAY['public.ptv_keuangan'::regclass,'public.ptv_pemasukan'::regclass,
    'public.ptv_pengeluaran'::regclass,'public.ptv_kas_kru'::regclass,'public.ptv_kas_periode'::regclass]
  LOOP
    SELECT string_agg(quote_ident(attname), ', ' ORDER BY attnum) INTO cols
      FROM pg_attribute WHERE attrelid=t AND attnum>0 AND NOT attisdropped;
    EXECUTE format('REVOKE INSERT (%s), UPDATE (%s), REFERENCES (%s) ON TABLE %s FROM PUBLIC, anon, authenticated RESTRICT',cols,cols,cols,t);
    FOREACH role_name IN ARRAY ARRAY['anon','authenticated'] LOOP
      IF has_table_privilege(role_name,t,'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN')
        OR has_any_column_privilege(role_name,t,'INSERT,UPDATE,REFERENCES') THEN
        RAISE EXCEPTION 'Hak tulis efektif masih ada pada % untuk %; cek pewarisan role',role_name,t;
      END IF;
      IF NOT has_table_privilege(role_name,t,'SELECT') THEN
        RAISE EXCEPTION 'SELECT existing tidak tersedia; tinjau drift ACL sebelum melanjutkan';
      END IF;
    END LOOP;
    IF NOT has_table_privilege('service_role',t,'SELECT')
      OR NOT has_table_privilege('service_role',t,'INSERT')
      OR NOT has_table_privilege('service_role',t,'UPDATE')
      OR NOT has_table_privilege('service_role',t,'DELETE') THEN
      RAISE EXCEPTION 'Prasyarat akses backend berbeda untuk %',t;
    END IF;
  END LOOP;
END $$;
COMMIT;
-- Ulangi pemeriksaan ACL efektif + fingerprint dari koneksi baru sesudah COMMIT.
-- Idempoten selama prasyarat audit tetap benar; tanpa CASCADE, RLS tetap aktif.
-- Rollback sebelum COMMIT: ROLLBACK. Sesudah COMMIT: ACC terpisah, restore hanya ACL
-- dari snapshot tepat sebelum eksekusi dengan pemeriksaan konflik, bukan GRANT ALL.
-- Pemulihan ACL membuka kembali risiko lama; pilihan utama tetap freeze sambil memperbaiki.

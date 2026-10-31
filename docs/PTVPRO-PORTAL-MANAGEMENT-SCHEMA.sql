-- ============================================================================
-- PTVPRO — PORTAL MANAGEMENT & SERVICE STATUS SCHEMA (IDEMPOTENT MIGRATION)
-- Target Environment: Supabase Staging (swadgljnyelsjstqqxbm)
-- File: docs/PTVPRO-PORTAL-MANAGEMENT-SCHEMA.sql
-- Description:
--   Mendukung modul Pengelolaan Portal PTV Hub, Direktori Layanan,
--   Status Operasional Transparan, Pengumuman Publik, Layanan Musiman,
--   serta Alur Draft -> Preview -> Publish.
-- ============================================================================

-- 1. Tabel Direktori Layanan Portal
CREATE TABLE IF NOT EXISTS public.ptv_portal_services (
  id TEXT PRIMARY KEY,
  name_id TEXT NOT NULL,
  name_en TEXT,
  desc_id TEXT NOT NULL,
  desc_en TEXT,
  cat TEXT NOT NULL DEFAULT 'public',
  href TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT 'globe',
  status TEXT NOT NULL DEFAULT 'ok',
  status_note TEXT,
  status_updated_at TIMESTAMPTZ DEFAULT NOW(),
  is_public BOOLEAN NOT NULL DEFAULT TRUE,
  is_seasonal BOOLEAN NOT NULL DEFAULT FALSE,
  seasonal_start DATE,
  seasonal_end DATE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  is_published BOOLEAN NOT NULL DEFAULT TRUE,
  draft_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by TEXT
);

-- Indexing untuk performa filter direktori
CREATE INDEX IF NOT EXISTS idx_portal_services_pub_active
  ON public.ptv_portal_services (is_public, is_active, is_published, sort_order);

-- 2. Tabel Pengumuman Portal Publik
CREATE TABLE IF NOT EXISTS public.ptv_portal_announcements (
  id TEXT PRIMARY KEY,
  title_id TEXT NOT NULL,
  title_en TEXT,
  body_id TEXT NOT NULL,
  body_en TEXT,
  cta_text_id TEXT NOT NULL DEFAULT 'Lihat Layanan',
  cta_text_en TEXT DEFAULT 'View Services',
  cta_href TEXT NOT NULL DEFAULT '#direktori-layanan',
  format TEXT NOT NULL DEFAULT 'text',
  poster_src TEXT,
  start_date DATE,
  end_date DATE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  is_published BOOLEAN NOT NULL DEFAULT FALSE,
  draft_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_portal_announcements_active_dates
  ON public.ptv_portal_announcements (is_active, is_published, start_date, end_date);

-- Trigger: Maksimal 1 pengumuman aktif & published pada portal publik pada satu waktu
CREATE OR REPLACE FUNCTION public.fn_ensure_single_active_portal_announcement()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_active = TRUE AND NEW.is_published = TRUE THEN
    UPDATE public.ptv_portal_announcements
    SET is_active = FALSE, updated_at = NOW()
    WHERE id <> NEW.id AND is_active = TRUE AND is_published = TRUE;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_single_active_portal_announcement ON public.ptv_portal_announcements;
CREATE TRIGGER trg_single_active_portal_announcement
  BEFORE INSERT OR UPDATE ON public.ptv_portal_announcements
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_ensure_single_active_portal_announcement();

-- 3. Tabel Pengaturan Global Portal
CREATE TABLE IF NOT EXISTS public.ptv_portal_settings (
  id TEXT PRIMARY KEY DEFAULT 'global',
  hero_title_1 TEXT NOT NULL DEFAULT 'Semua layanan.',
  hero_title_2 TEXT NOT NULL DEFAULT 'Satu tempat.',
  hero_desc TEXT NOT NULL DEFAULT 'Pintu akses resmi ekosistem digital keluarga yayasan dan Progresif TV — mulai dari ruang operasional kru hingga layanan verifikasi publik.',
  help_wa_number TEXT NOT NULL DEFAULT '62895325884964',
  footer_signature TEXT NOT NULL DEFAULT 'Dibangun oleh santri. Didedikasikan untuk sesama.',
  footer_copyright TEXT NOT NULL DEFAULT '© 2026 Progresif TV Production.',
  is_published BOOLEAN NOT NULL DEFAULT TRUE,
  draft_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by TEXT
);

-- 4. Tabel Audit Log Pengelolaan Portal
CREATE TABLE IF NOT EXISTS public.ptv_portal_audit_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  user_name TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  details TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_portal_audit_created_at
  ON public.ptv_portal_audit_logs (created_at DESC);

-- ============================================================================
-- KEBIJAKAN ROW LEVEL SECURITY (RLS)
-- ============================================================================
ALTER TABLE public.ptv_portal_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ptv_portal_announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ptv_portal_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ptv_portal_audit_logs ENABLE ROW LEVEL SECURITY;

-- Kebijakan Baca Publik: Hanya konten published dan aktif
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'ptv_portal_services' AND policyname = 'portal_services_public_read'
  ) THEN
    CREATE POLICY portal_services_public_read ON public.ptv_portal_services
      FOR SELECT USING (is_public = TRUE AND is_active = TRUE AND is_published = TRUE);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'ptv_portal_services' AND policyname = 'portal_services_auth_all'
  ) THEN
    CREATE POLICY portal_services_auth_all ON public.ptv_portal_services
      FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'ptv_portal_announcements' AND policyname = 'portal_announcements_public_read'
  ) THEN
    CREATE POLICY portal_announcements_public_read ON public.ptv_portal_announcements
      FOR SELECT USING (is_active = TRUE AND is_published = TRUE);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'ptv_portal_announcements' AND policyname = 'portal_announcements_auth_all'
  ) THEN
    CREATE POLICY portal_announcements_auth_all ON public.ptv_portal_announcements
      FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'ptv_portal_settings' AND policyname = 'portal_settings_public_read'
  ) THEN
    CREATE POLICY portal_settings_public_read ON public.ptv_portal_settings
      FOR SELECT USING (is_published = TRUE);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'ptv_portal_settings' AND policyname = 'portal_settings_auth_all'
  ) THEN
    CREATE POLICY portal_settings_auth_all ON public.ptv_portal_settings
      FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'ptv_portal_audit_logs' AND policyname = 'portal_audit_auth_read'
  ) THEN
    CREATE POLICY portal_audit_auth_read ON public.ptv_portal_audit_logs
      FOR SELECT TO authenticated USING (TRUE);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'ptv_portal_audit_logs' AND policyname = 'portal_audit_auth_insert'
  ) THEN
    CREATE POLICY portal_audit_auth_insert ON public.ptv_portal_audit_logs
      FOR INSERT TO authenticated WITH CHECK (TRUE);
  END IF;
END $$;

-- ============================================================================
-- SEED DATA BASELINE (INITIAL SERVICES COMPATIBILITY)
-- ============================================================================
INSERT INTO public.ptv_portal_services (id, name_id, name_en, desc_id, desc_en, cat, href, icon, status, is_public, sort_order)
VALUES
  ('hub', 'PTV Hub', 'PTV Hub', 'Workspace terpadu kru: jadwal acara, inventaris alat, perizinan, dan koordinasi produksi.', 'Unified crew workspace: event schedules, gear inventory, permits, and production coordination.', 'internal', '/hub', 'hub', 'ok', TRUE, 0),
  ('id', 'Verifikasi Kru', 'Crew Verification', 'Pemeriksaan keabsahan ID digital kru aktif Progresif TV secara real-time dan terbuka.', 'Real-time and open validity check for active Progresif TV crew digital IDs.', 'public', '/verifikasi-identitas', 'id', 'ok', TRUE, 1),
  ('ltr', 'Keabsahan Dokumen', 'Document Verification', 'Layanan verifikasi publik tanda tangan digital dan nomor surat resmi Progresif TV.', 'Public verification for digital signatures and official Progresif TV letter numbers.', 'public', '/verifikasi-surat', 'surat', 'ok', TRUE, 2),
  ('bsh', 'Shortlink PPBS', 'PPBS Shortlink', 'Pengalihan tautan ringkas dan aman untuk publikasi media keluarga yayasan.', 'Secure and compact link redirection for foundation family media publications.', 'public', 'https://bsh.bio', 'bsh', 'ok', TRUE, 3),
  ('haul', 'Majelis Sama'' Haul', 'Haul Majelis Sama''', 'Pusat pendaftaran dan informasi terpadu Majelis Sama'' Haul & Harlah PPBS.', 'Unified registration and information for Majelis Sama'' Haul & Harlah PPBS.', 'public', '/hub/haul', 'haul', 'soon', TRUE, 4),
  ('gear', 'Katalog Publik Alat', 'Public Gear Catalog', 'Eksplorasi inventaris peralatan produksi yang dikelola Progresif TV.', 'Explore production gear inventory maintained by Progresif TV.', 'public', '/hub/inventaris', 'gear', 'soon', TRUE, 5)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.ptv_portal_settings (id, hero_title_1, hero_title_2, hero_desc, help_wa_number, footer_signature, footer_copyright)
VALUES (
  'global',
  'Semua layanan.',
  'Satu tempat.',
  'Pintu akses resmi ekosistem digital keluarga yayasan dan Progresif TV — mulai dari ruang operasional kru hingga layanan verifikasi publik.',
  '62895325884964',
  'Dibangun oleh santri. Didedikasikan untuk sesama.',
  '© 2026 Progresif TV Production.'
)
ON CONFLICT (id) DO NOTHING;

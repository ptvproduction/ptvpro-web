-- ============================================================================
-- PTV PRO SUPER APP — DATABASE DRAFT DDL & MIGRATION SCHEMA (LOCAL DRAFT ONLY)
-- ============================================================================
-- 
-- WARNING / PERINGATAN:
-- INI ADALAH FILE DRAFT LOKAL UNTUK DOKUMENTASI DAN VALIDASI ARSITEKTUR.
-- JANGAN MENJALANKAN FILE INI TERHADAP SUPABASE PRODUCTION.
-- JANGAN MENJALANKAN DDL/DML TERHADAP DATABASE LIVE PROGRESIFTV.ID.
--
-- Authoritative Contracts:
-- - docs/PTV-HUB-FINAL-DATABASE-AUTH-CONTRACT.md
-- - docs/PTV-PRO-PROJECT-ARCHITECTURE.md
-- - docs/PTV-PRO-DECISIONS.md
-- - docs/PTV-PRO-IDENTITY-AUTH-CONTRACT.md
-- - docs/PTV-PRO-DATABASE-IMPLEMENTATION-DESIGN.md
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. EXTENSIONS & PREREQUISITES
-- ----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ----------------------------------------------------------------------------
-- 2. CANONICAL IDENTITY & CONTACT
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS canonical_identity (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ptv_id VARCHAR(16) NOT NULL UNIQUE, -- Permanent identifier (e.g. 'PTV-001', 'PTV-ROOT')
    full_name VARCHAR(255) NOT NULL,
    avatar_url TEXT NULL,
    legacy_id BIGINT NULL UNIQUE,       -- Backward reference to legacy ptv_kru.id
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_canonical_identity_ptv_id ON canonical_identity (ptv_id);
CREATE INDEX IF NOT EXISTS idx_canonical_identity_legacy_id ON canonical_identity (legacy_id);

CREATE TABLE IF NOT EXISTS identity_contact (
    identity_id UUID PRIMARY KEY REFERENCES canonical_identity(id) ON DELETE CASCADE,
    phone VARCHAR(32) NULL,
    whatsapp VARCHAR(32) NULL,
    email_personal VARCHAR(255) NULL,
    emergency_contact_name VARCHAR(255) NULL,
    emergency_contact_phone VARCHAR(32) NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 3. USER ACCOUNT & AUTHENTICATION METHODS
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS user_account (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    identity_id UUID NOT NULL UNIQUE REFERENCES canonical_identity(id) ON DELETE RESTRICT,
    auth_user_id UUID UNIQUE NULL, -- Maps to Supabase auth.users.id
    username VARCHAR(64) NOT NULL UNIQUE,
    status_akun VARCHAR(16) NOT NULL DEFAULT 'active' CHECK (status_akun IN ('active', 'inactive')),
    failed_login_attempts INT NOT NULL DEFAULT 0,
    lockout_until TIMESTAMPTZ NULL,
    tokens_valid_after TIMESTAMPTZ NOT NULL DEFAULT now(), -- Revocation tracking epoch
    last_login_at TIMESTAMPTZ NULL,
    last_login_ip VARCHAR(45) NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_account_username ON user_account (LOWER(username));

CREATE TABLE IF NOT EXISTS auth_credentials (
    account_id UUID PRIMARY KEY REFERENCES user_account(id) ON DELETE CASCADE,
    password_hash VARCHAR(255) NULL, -- Bcrypt hash ($2y$ / $2b$, cost >= 10)
    hash_algorithm VARCHAR(32) NOT NULL DEFAULT 'bcrypt', -- 'bcrypt', 'legacy_unknown', 'none'
    needs_rehash BOOLEAN NOT NULL DEFAULT FALSE,
    oauth_provider VARCHAR(32) NULL, -- 'google'
    oauth_subject_id VARCHAR(255) NULL,
    oauth_email VARCHAR(255) NULL,
    password_updated_at TIMESTAMPTZ NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 4. ORGANIZATION & MEMBERSHIP
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS organization (
    id VARCHAR(32) PRIMARY KEY, -- 'ptv_studio', 'bsh_pesantren'
    name VARCHAR(255) NOT NULL,
    description TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS organization_division (
    id VARCHAR(32) PRIMARY KEY, -- 'technical', 'editor', 'layouter', 'creative', 'engagements'
    name VARCHAR(100) NOT NULL,
    description TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS organization_membership (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    identity_id UUID NOT NULL REFERENCES canonical_identity(id) ON DELETE RESTRICT,
    organization_id VARCHAR(32) NOT NULL REFERENCES organization(id) DEFAULT 'ptv_studio',
    division_id VARCHAR(32) NULL REFERENCES organization_division(id),
    position_title VARCHAR(100) NOT NULL,
    special_responsibility VARCHAR(100) NULL,
    cohort INT NULL,
    status_organisasi VARCHAR(16) NOT NULL DEFAULT 'active' CHECK (status_organisasi IN ('active', 'inactive', 'archived')),
    period_start DATE NOT NULL DEFAULT CURRENT_DATE,
    period_end DATE NULL,
    is_current BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_org_membership_identity ON organization_membership (identity_id);
CREATE INDEX IF NOT EXISTS idx_org_membership_current ON organization_membership (identity_id, is_current);

-- ----------------------------------------------------------------------------
-- 5. ACCESS PROFILES & CAPABILITIES (Exact 53 Ratified Capabilities)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS access_profile (
    id VARCHAR(32) PRIMARY KEY, -- 'root_executive', 'eksekutif', 'kepolo_kepali', 'crew', 'pembina'
    name VARCHAR(100) NOT NULL,
    description TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS capability_registry (
    key VARCHAR(64) PRIMARY KEY,
    domain VARCHAR(32) NOT NULL,
    description TEXT NOT NULL,
    is_mutation BOOLEAN NOT NULL DEFAULT FALSE,
    is_sensitive BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS profile_capabilities (
    profile_id VARCHAR(32) NOT NULL REFERENCES access_profile(id) ON DELETE CASCADE,
    capability_key VARCHAR(64) NOT NULL REFERENCES capability_registry(key) ON DELETE CASCADE,
    PRIMARY KEY (profile_id, capability_key)
);

CREATE TABLE IF NOT EXISTS account_profiles (
    account_id UUID NOT NULL REFERENCES user_account(id) ON DELETE CASCADE,
    profile_id VARCHAR(32) NOT NULL REFERENCES access_profile(id) ON DELETE RESTRICT,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (account_id, profile_id)
);

CREATE TABLE IF NOT EXISTS account_capability_overrides (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES user_account(id) ON DELETE CASCADE,
    capability_key VARCHAR(64) NOT NULL REFERENCES capability_registry(key) ON DELETE CASCADE,
    override_type VARCHAR(8) NOT NULL CHECK (override_type IN ('allow', 'deny')),
    reason TEXT NULL,
    granted_by UUID NULL REFERENCES canonical_identity(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (account_id, capability_key)
);

-- Seed Canonical Access Profiles (Exact 5)
INSERT INTO access_profile (id, name, description) VALUES
('root_executive', 'PTV / Root Executive', 'Institutional system account (PTV-ROOT) with emergency override powers'),
('eksekutif', 'Eksekutif', 'Leadership operational control across all views (Ketua Umum, Sekretaris & Bendahara, Koor Operasional)'),
('kepolo_kepali', 'Kepolo Kepali', 'Division leads and operational supervisors'),
('crew', 'Crew', 'Active operational santri personnel, videographers, editors, technicians'),
('pembina', 'Pembina', 'Foundation patrons and advisory leadership (strictly quarantined from finance/valuation)')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description;

-- Seed Authoritative Capability Registry (Exact 53 Granular Capabilities)
INSERT INTO capability_registry (key, domain, description, is_mutation, is_sensitive) VALUES
('hub.access', 'hub', 'Log in and access PTV Hub SPA shell', false, false),
('events.view', 'events', 'View broadcasts, events, and schedules', false, false),
('events.create', 'events', 'Create new production events', true, false),
('events.edit', 'events', 'Modify event metadata and details', true, false),
('events.delete', 'events', 'Delete production events', true, true),
('events.rundown.manage', 'events', 'Edit event timelines and crew rosters', true, false),
('calendar.view', 'calendar', 'Access interactive monthly calendar grid', false, false),
('inventory.view', 'inventory', 'View equipment catalog & unit availability', false, false),
('inventory.create', 'inventory', 'Add new equipment catalog items', true, false),
('inventory.edit', 'inventory', 'Modify equipment specifications & photos', true, false),
('inventory.delete', 'inventory', 'Delete equipment catalog items', true, true),
('inventory.units.manage', 'inventory', 'Add, edit serial numbers, barcode units', true, false),
('inventory.valuation.view', 'inventory', 'View asset purchase prices & capital total (Quarantined from Pembina)', false, true),
('inventory.valuation.manage', 'inventory', 'Modify asset acquisition cost & receipts', true, true),
('loans.view', 'loans', 'View active and historical loan records', false, false),
('loans.checkout', 'loans', 'Checkout equipment loan basket', true, false),
('loans.return', 'loans', 'Process return & equipment inspection', true, false),
('loans.manage', 'loans', 'Cancel or adjust loan transaction records', true, true),
('damage.view', 'damage', 'View damage reports and QC pipeline', false, false),
('damage.report', 'damage', 'Submit broken equipment incident ticket', true, false),
('damage.qc.approve', 'damage', 'Sign off on repaired gear & restore status', true, true),
('lostfound.view', 'lostfound', 'View lost & found item directory', false, false),
('lostfound.report', 'lostfound', 'Log lost or found item', true, false),
('lostfound.manage', 'lostfound', 'Update claim status or delete record', true, false),
('crew.view', 'crew', 'View crew directory and division rosters', false, false),
('crew.create', 'crew', 'Provision new crew profiles', true, true),
('crew.edit', 'crew', 'Update crew divisions, titles, profiles', true, false),
('crew.status.manage', 'crew', 'Deactivate, suspend, or archive accounts', true, true),
('crew.permissions.manage', 'crew', 'Grant or revoke capabilities and profiles', true, true),
('id.view', 'id', 'Access personal digital ID card', false, false),
('id.export', 'id', 'Download ID card image or print canvas', false, false),
('documents.view', 'documents', 'View personal and team official documents', false, false),
('documents.request', 'documents', 'Submit permit / official letter request', true, false),
('documents.generate', 'documents', 'Run wizard to draft SI/ST/SBB documents', true, false),
('documents.approve', 'documents', 'Digitally sign & issue formal documents', true, true),
('documents.archive.view', 'documents', 'Access master historical archive', false, false),
('documents.archive.manage', 'documents', 'Delete or void archived official letters', true, true),
('finance.view', 'finance', 'View studio cash book ledgers & balances (Quarantined from Pembina & Crew)', false, true),
('finance.manage', 'finance', 'Add vouchers, void transactions, close periods', true, true),
('finance.operator', 'finance', 'Record dues, generate invoices, entries (Configurable override)', true, true),
('contacts.internal.view', 'contacts', 'Access crew phonebook & WhatsApp links', false, false),
('contacts.external.view', 'contacts', 'Access third-party vendor directory', false, false),
('contacts.external.manage', 'contacts', 'Add, edit, delete vendor contacts', true, false),
('broadcast.view', 'broadcast', 'View announcements and studio alerts', false, false),
('broadcast.dispatch', 'broadcast', 'Send Web Push notifications & chimes', true, true),
('projecthaul.view', 'projecthaul', 'Access Haul Akbar mission control', false, false),
('projecthaul.manage', 'projecthaul', 'Edit milestones and stream links', true, false),
('notes.view', 'notes', 'View operational notes & minutes', false, false),
('notes.create', 'notes', 'Create scratchpad notes & notulensi', true, false),
('notes.manage', 'notes', 'Pin notes, delete notes, edit categories', true, false),
('settings.personal', 'settings', 'Edit preferences, audio test, theme', false, false),
('settings.system', 'settings', 'Configure Supabase keys, system flags', true, true),
('audit.logs.view', 'audit', 'Inspect forensic login & mutation logs', false, true)
ON CONFLICT (key) DO UPDATE SET 
    domain = EXCLUDED.domain,
    description = EXCLUDED.description,
    is_mutation = EXCLUDED.is_mutation,
    is_sensitive = EXCLUDED.is_sensitive;

-- Seed Profile Capability Mappings (Root: 53, Eksekutif: 51, Kepolo: 37, Crew: 24, Pembina: 10)
-- 1. Root Executive (All 53)
INSERT INTO profile_capabilities (profile_id, capability_key)
SELECT 'root_executive', key FROM capability_registry
ON CONFLICT DO NOTHING;

-- 2. Eksekutif (51 capabilities - all except settings.system root scope if restricted, but per contract: 51)
INSERT INTO profile_capabilities (profile_id, capability_key) VALUES
('eksekutif', 'hub.access'), ('eksekutif', 'events.view'), ('eksekutif', 'events.create'),
('eksekutif', 'events.edit'), ('eksekutif', 'events.delete'), ('eksekutif', 'events.rundown.manage'),
('eksekutif', 'calendar.view'), ('eksekutif', 'inventory.view'), ('eksekutif', 'inventory.create'),
('eksekutif', 'inventory.edit'), ('eksekutif', 'inventory.delete'), ('eksekutif', 'inventory.units.manage'),
('eksekutif', 'inventory.valuation.view'), ('eksekutif', 'inventory.valuation.manage'),
('eksekutif', 'loans.view'), ('eksekutif', 'loans.checkout'), ('eksekutif', 'loans.return'),
('eksekutif', 'loans.manage'), ('eksekutif', 'damage.view'), ('eksekutif', 'damage.report'),
('eksekutif', 'damage.qc.approve'), ('eksekutif', 'lostfound.view'), ('eksekutif', 'lostfound.report'),
('eksekutif', 'lostfound.manage'), ('eksekutif', 'crew.view'), ('eksekutif', 'crew.create'),
('eksekutif', 'crew.edit'), ('eksekutif', 'crew.status.manage'), ('eksekutif', 'crew.permissions.manage'),
('eksekutif', 'id.view'), ('eksekutif', 'id.export'), ('eksekutif', 'documents.view'),
('eksekutif', 'documents.request'), ('eksekutif', 'documents.generate'), ('eksekutif', 'documents.approve'),
('eksekutif', 'documents.archive.view'), ('eksekutif', 'documents.archive.manage'),
('eksekutif', 'finance.view'), ('eksekutif', 'finance.manage'), ('eksekutif', 'finance.operator'),
('eksekutif', 'contacts.internal.view'), ('eksekutif', 'contacts.external.view'),
('eksekutif', 'contacts.external.manage'), ('eksekutif', 'broadcast.view'),
('eksekutif', 'broadcast.dispatch'), ('eksekutif', 'projecthaul.view'),
('eksekutif', 'projecthaul.manage'), ('eksekutif', 'notes.view'), ('eksekutif', 'notes.create'),
('eksekutif', 'notes.manage'), ('eksekutif', 'settings.personal'), ('eksekutif', 'settings.system'),
('eksekutif', 'audit.logs.view')
ON CONFLICT DO NOTHING;

-- 3. Kepolo Kepali (37 capabilities)
INSERT INTO profile_capabilities (profile_id, capability_key) VALUES
('kepolo_kepali', 'hub.access'), ('kepolo_kepali', 'events.view'), ('kepolo_kepali', 'events.create'),
('kepolo_kepali', 'events.edit'), ('kepolo_kepali', 'events.rundown.manage'), ('kepolo_kepali', 'calendar.view'),
('kepolo_kepali', 'inventory.view'), ('kepolo_kepali', 'inventory.create'), ('kepolo_kepali', 'inventory.edit'),
('kepolo_kepali', 'inventory.units.manage'), ('kepolo_kepali', 'inventory.valuation.view'),
('kepolo_kepali', 'loans.view'), ('kepolo_kepali', 'loans.checkout'), ('kepolo_kepali', 'loans.return'),
('kepolo_kepali', 'damage.view'), ('kepolo_kepali', 'damage.report'), ('kepolo_kepali', 'damage.qc.approve'),
('kepolo_kepali', 'lostfound.view'), ('kepolo_kepali', 'lostfound.report'), ('kepolo_kepali', 'lostfound.manage'),
('kepolo_kepali', 'crew.view'), ('kepolo_kepali', 'id.view'), ('kepolo_kepali', 'id.export'),
('kepolo_kepali', 'documents.view'), ('kepolo_kepali', 'documents.request'), ('kepolo_kepali', 'documents.generate'),
('kepolo_kepali', 'documents.archive.view'), ('kepolo_kepali', 'contacts.internal.view'),
('kepolo_kepali', 'contacts.external.view'), ('kepolo_kepali', 'contacts.external.manage'),
('kepolo_kepali', 'broadcast.view'), ('kepolo_kepali', 'projecthaul.view'),
('kepolo_kepali', 'projecthaul.manage'), ('kepolo_kepali', 'notes.view'), ('kepolo_kepali', 'notes.create'),
('kepolo_kepali', 'notes.manage'), ('kepolo_kepali', 'settings.personal')
ON CONFLICT DO NOTHING;

-- 4. Crew (24 capabilities)
INSERT INTO profile_capabilities (profile_id, capability_key) VALUES
('crew', 'hub.access'), ('crew', 'events.view'), ('crew', 'calendar.view'),
('crew', 'inventory.view'), ('crew', 'inventory.valuation.view'),
('crew', 'loans.view'), ('crew', 'loans.checkout'), ('crew', 'loans.return'),
('crew', 'damage.view'), ('crew', 'damage.report'), ('crew', 'lostfound.view'),
('crew', 'lostfound.report'), ('crew', 'crew.view'), ('crew', 'id.view'),
('crew', 'id.export'), ('crew', 'documents.view'), ('crew', 'documents.request'),
('crew', 'contacts.internal.view'), ('crew', 'contacts.external.view'),
('crew', 'broadcast.view'), ('crew', 'projecthaul.view'), ('crew', 'notes.view'),
('crew', 'notes.create'), ('crew', 'settings.personal')
ON CONFLICT DO NOTHING;

-- 5. Pembina (10 capabilities - strictly isolated from finance & valuation)
INSERT INTO profile_capabilities (profile_id, capability_key) VALUES
('pembina', 'hub.access'), ('pembina', 'events.view'), ('pembina', 'calendar.view'),
('pembina', 'inventory.view'), ('pembina', 'loans.view'), ('pembina', 'damage.view'),
('pembina', 'lostfound.view'), ('pembina', 'broadcast.view'), ('pembina', 'notes.view'),
('pembina', 'settings.personal')
ON CONFLICT DO NOTHING;

-- ----------------------------------------------------------------------------
-- 6. AUDIT & LOGGING
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS auth_audit_log (
    id BIGSERIAL PRIMARY KEY,
    actor_id UUID NULL REFERENCES canonical_identity(id),
    actor_ptv_id VARCHAR(16) NULL,
    event_type VARCHAR(64) NOT NULL,
    ip_address VARCHAR(45) NULL,
    user_agent TEXT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ptv_login_history (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NULL REFERENCES user_account(id),
    ptv_id VARCHAR(16) NULL,
    username VARCHAR(64) NULL,
    ip_address VARCHAR(45) NULL,
    user_agent TEXT NULL,
    status VARCHAR(32) NOT NULL,
    login_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 7. OPERATIONAL DOMAIN SCHEMAS
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS ptv_acara (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nama_acara VARCHAR(255) NOT NULL,
    tanggal DATE NOT NULL,
    waktu_mulai TIME NULL,
    waktu_selesai TIME NULL,
    lokasi VARCHAR(255) NULL,
    deskripsi TEXT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'dijadwalkan',
    created_by UUID NULL REFERENCES canonical_identity(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ptv_acara_rundown (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    acara_id UUID NOT NULL REFERENCES ptv_acara(id) ON DELETE CASCADE,
    urutan INT NOT NULL DEFAULT 1,
    waktu_mulai TIME NULL,
    waktu_selesai TIME NULL,
    agenda VARCHAR(255) NOT NULL,
    pic_nama VARCHAR(255) NULL,
    catatan TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ptv_content_planner (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    judul VARCHAR(255) NOT NULL,
    platform VARCHAR(64) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'ide',
    target_tayang DATE NULL,
    pic_id UUID NULL REFERENCES canonical_identity(id),
    catatan TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ptv_inventaris (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kode VARCHAR(32) NOT NULL UNIQUE,
    nama_alat VARCHAR(255) NOT NULL,
    kategori VARCHAR(64) NOT NULL,
    spesifikasi TEXT NULL,
    foto_url TEXT NULL,
    harga_beli NUMERIC(15, 2) NULL,
    sumber_perolehan VARCHAR(128) NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ptv_inventaris_unit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inventaris_id UUID NOT NULL REFERENCES ptv_inventaris(id) ON DELETE CASCADE,
    kode_unit VARCHAR(64) NOT NULL UNIQUE,
    nomor_seri VARCHAR(128) NULL,
    kondisi VARCHAR(32) NOT NULL DEFAULT 'bagus',
    status_peminjaman VARCHAR(32) NOT NULL DEFAULT 'tersedia',
    lokasi_penyimpanan VARCHAR(128) NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ptv_nilai_inventaris (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inventaris_id UUID NOT NULL REFERENCES ptv_inventaris(id) ON DELETE CASCADE,
    nilai_perolehan NUMERIC(15, 2) NOT NULL DEFAULT 0,
    nilai_buku_saat_ini NUMERIC(15, 2) NOT NULL DEFAULT 0,
    tanggal_valuasi DATE NOT NULL DEFAULT CURRENT_DATE,
    catatan_akuntansi TEXT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ptv_peminjaman (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id VARCHAR(64) NOT NULL,
    unit_id UUID NOT NULL REFERENCES ptv_inventaris_unit(id) ON DELETE RESTRICT,
    peminjam_nama VARCHAR(255) NOT NULL,
    keperluan TEXT NOT NULL,
    tanggal_pinjam DATE NOT NULL DEFAULT CURRENT_DATE,
    tenggat_kembali DATE NOT NULL,
    tanggal_kembali DATE NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'dipinjam',
    kondisi_kembali VARCHAR(32) NULL,
    catatan TEXT NULL,
    actor_id UUID NULL REFERENCES canonical_identity(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_peminjaman_tx ON ptv_peminjaman (transaction_id);

CREATE TABLE IF NOT EXISTS ptv_lapor_masalah (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    unit_id UUID NOT NULL REFERENCES ptv_inventaris_unit(id) ON DELETE RESTRICT,
    pelapor_id UUID NULL REFERENCES canonical_identity(id),
    pelapor_nama VARCHAR(255) NOT NULL,
    deskripsi_kerusakan TEXT NOT NULL,
    status_qc VARCHAR(32) NOT NULL DEFAULT 'dilaporkan',
    biaya_reparasi NUMERIC(12, 2) NULL,
    qc_approved_by UUID NULL REFERENCES canonical_identity(id),
    qc_approved_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ptv_lost_found (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nama_barang VARCHAR(255) NOT NULL,
    lokasi_ditemukan VARCHAR(255) NULL,
    deskripsi TEXT NULL,
    foto_url TEXT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'diamankan',
    ditemukan_oleh VARCHAR(255) NULL,
    diklaim_oleh VARCHAR(255) NULL,
    tanggal_klaim DATE NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ptv_surat_tugas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nomor_surat VARCHAR(128) NOT NULL UNIQUE,
    perihal VARCHAR(255) NOT NULL,
    tanggal_tugas DATE NOT NULL,
    kru_terlibat JSONB NOT NULL DEFAULT '[]'::jsonb,
    disetujui_oleh UUID NULL REFERENCES canonical_identity(id),
    status VARCHAR(32) NOT NULL DEFAULT 'diajukan',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ptv_surat_izin (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nomor_surat VARCHAR(128) NOT NULL UNIQUE,
    nama_pemohon VARCHAR(255) NOT NULL,
    alasan TEXT NOT NULL,
    tanggal_mulai DATE NOT NULL,
    tanggal_selesai DATE NOT NULL,
    disetujui_oleh UUID NULL REFERENCES canonical_identity(id),
    status VARCHAR(32) NOT NULL DEFAULT 'diajukan',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ptv_surat_barang (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nomor_surat VARCHAR(128) NOT NULL UNIQUE,
    nama_pembawa VARCHAR(255) NOT NULL,
    tujuan_lokasi VARCHAR(255) NOT NULL,
    daftar_barang JSONB NOT NULL DEFAULT '[]'::jsonb,
    disetujui_oleh UUID NULL REFERENCES canonical_identity(id),
    status VARCHAR(32) NOT NULL DEFAULT 'diajukan',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ptv_keuangan (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kode_voucher VARCHAR(64) NOT NULL UNIQUE,
    kategori VARCHAR(64) NOT NULL,
    keterangan TEXT NOT NULL,
    nominal NUMERIC(15, 2) NOT NULL,
    jenis VARCHAR(16) NOT NULL CHECK (jenis IN ('pemasukan', 'pengeluaran')),
    tanggal_transaksi DATE NOT NULL DEFAULT CURRENT_DATE,
    pic_id UUID NULL REFERENCES canonical_identity(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ptv_pemasukan (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    keuangan_id UUID NULL REFERENCES ptv_keuangan(id) ON DELETE SET NULL,
    sumber VARCHAR(255) NOT NULL,
    nominal NUMERIC(15, 2) NOT NULL,
    tanggal DATE NOT NULL DEFAULT CURRENT_DATE,
    keterangan TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ptv_pengeluaran (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    keuangan_id UUID NULL REFERENCES ptv_keuangan(id) ON DELETE SET NULL,
    keperluan VARCHAR(255) NOT NULL,
    nominal NUMERIC(15, 2) NOT NULL,
    tanggal DATE NOT NULL DEFAULT CURRENT_DATE,
    keterangan TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ptv_kas_kru (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    identity_id UUID NOT NULL REFERENCES canonical_identity(id) ON DELETE RESTRICT,
    bulan_tahun VARCHAR(7) NOT NULL,
    nominal NUMERIC(12, 2) NOT NULL DEFAULT 0,
    status_bayar VARCHAR(16) NOT NULL DEFAULT 'belum' CHECK (status_bayar IN ('lunas', 'belum')),
    tanggal_bayar DATE NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ptv_kas_periode (
    id VARCHAR(7) PRIMARY KEY,
    saldo_awal NUMERIC(15, 2) NOT NULL DEFAULT 0,
    total_pemasukan NUMERIC(15, 2) NOT NULL DEFAULT 0,
    total_pengeluaran NUMERIC(15, 2) NOT NULL DEFAULT 0,
    saldo_akhir NUMERIC(15, 2) NOT NULL DEFAULT 0,
    status_closing VARCHAR(16) NOT NULL DEFAULT 'open' CHECK (status_closing IN ('open', 'closed')),
    closed_at TIMESTAMPTZ NULL
);

CREATE TABLE IF NOT EXISTS ptv_catatan (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    judul VARCHAR(255) NOT NULL,
    isi TEXT NOT NULL,
    kategori VARCHAR(64) NOT NULL DEFAULT 'umum',
    is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
    author_id UUID NULL REFERENCES canonical_identity(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ptv_kontak_eksternal (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nama_kontak VARCHAR(255) NOT NULL,
    instansi VARCHAR(255) NULL,
    telepon VARCHAR(32) NULL,
    email VARCHAR(255) NULL,
    peran VARCHAR(128) NULL,
    catatan TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ptv_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tipe VARCHAR(32) NOT NULL,
    judul VARCHAR(255) NOT NULL,
    pesan TEXT NOT NULL,
    target_role VARCHAR(32) NULL,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ptv_push_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    identity_id UUID NULL REFERENCES canonical_identity(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL UNIQUE,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ptv_pengumuman (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    judul VARCHAR(255) NOT NULL,
    konten TEXT NOT NULL,
    is_aktif BOOLEAN NOT NULL DEFAULT TRUE,
    berlaku_sampai DATE NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 8. COMPATIBILITY LAYER & VIEW (ptv_kru_legacy_compat)
-- ----------------------------------------------------------------------------

CREATE OR REPLACE VIEW ptv_kru_legacy_compat AS
SELECT 
    ci.legacy_id AS id,
    ci.ptv_id AS crew_id,
    ci.full_name AS nama,
    ua.username AS username,
    ac.password_hash AS password_hash,
    ac.oauth_email AS oauth_email,
    ic.phone AS telepon,
    ic.whatsapp AS no_wa,
    ic.email_personal AS email,
    od.name AS divisi,
    om.position_title AS jabatan,
    om.cohort AS angkatan,
    CASE 
        WHEN om.status_organisasi = 'active' AND ua.status_akun = 'active' THEN 'aktif'
        WHEN om.status_organisasi = 'inactive' AND ua.status_akun = 'active' THEN 'alumni'
        ELSE 'nonaktif'
    END AS status,
    COALESCE(ap.profile_id, 'crew') AS role,
    ci.avatar_url AS foto_url,
    ci.created_at AS created_at,
    ci.updated_at AS updated_at
FROM canonical_identity ci
JOIN user_account ua ON ua.identity_id = ci.id
LEFT JOIN auth_credentials ac ON ac.account_id = ua.id
LEFT JOIN identity_contact ic ON ic.identity_id = ci.id
LEFT JOIN organization_membership om ON om.identity_id = ci.id AND om.is_current = TRUE
LEFT JOIN organization_division od ON od.id = om.division_id
LEFT JOIN account_profiles ap ON ap.account_id = ua.id;

-- ----------------------------------------------------------------------------
-- 9. SERVER-SIDE SECURITY & CAPABILITY RESOLVER FUNCTIONS
-- ----------------------------------------------------------------------------

-- Custom JWT Claims Injector
CREATE OR REPLACE FUNCTION auth.jwt_custom_claims()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_user_account RECORD;
    v_identity RECORD;
    v_membership RECORD;
    v_profiles TEXT[];
    v_allowed TEXT[];
    v_denied TEXT[];
BEGIN
    SELECT ua.* INTO v_user_account
    FROM public.user_account ua
    WHERE ua.auth_user_id = auth.uid();

    IF NOT FOUND THEN
        RETURN '{}'::jsonb;
    END IF;

    SELECT ci.* INTO v_identity
    FROM public.canonical_identity ci
    WHERE ci.id = v_user_account.identity_id;

    SELECT om.* INTO v_membership
    FROM public.organization_membership om
    WHERE om.identity_id = v_user_account.identity_id AND om.is_current = TRUE
    LIMIT 1;

    SELECT array_agg(profile_id) INTO v_profiles
    FROM public.account_profiles WHERE account_id = v_user_account.id;

    SELECT array_agg(capability_key) INTO v_allowed
    FROM public.account_capability_overrides WHERE account_id = v_user_account.id AND override_type = 'allow';

    SELECT array_agg(capability_key) INTO v_denied
    FROM public.account_capability_overrides WHERE account_id = v_user_account.id AND override_type = 'deny';

    RETURN jsonb_build_object(
        'account_id', v_user_account.id,
        'identity_id', v_identity.id,
        'ptv_id', v_identity.ptv_id,
        'username', v_user_account.username,
        'status_akun', v_user_account.status_akun,
        'status_organisasi', COALESCE(v_membership.status_organisasi, 'inactive'),
        'tokens_valid_after', extract(epoch from v_user_account.tokens_valid_after)::bigint,
        'profiles', COALESCE(v_profiles, ARRAY[]::TEXT[]),
        'allowed_overrides', COALESCE(v_allowed, ARRAY[]::TEXT[]),
        'denied_overrides', COALESCE(v_denied, ARRAY[]::TEXT[])
    );
END;
$$;

-- Server-Side Capability Resolver with Stale-JWT Revocation Guard
CREATE OR REPLACE FUNCTION auth.has_capability(p_capability TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_claims JSONB := auth.jwt();
    v_account_id UUID;
    v_status_akun TEXT;
    v_status_organisasi TEXT;
    v_is_mutation BOOLEAN;
    v_is_sensitive BOOLEAN;
    v_allowed TEXT[];
    v_denied TEXT[];
    v_profiles TEXT[];
    v_token_issued_at BIGINT;
    v_tokens_valid_after BIGINT;
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN FALSE;
    END IF;

    -- Extract claim parameters
    v_account_id := (v_claims ->> 'account_id')::uuid;
    v_status_akun := v_claims ->> 'status_akun';
    v_status_organisasi := v_claims ->> 'status_organisasi';
    v_token_issued_at := (v_claims ->> 'iat')::bigint;

    -- Look up capability metadata
    SELECT is_mutation, is_sensitive INTO v_is_mutation, v_is_sensitive 
    FROM public.capability_registry WHERE key = p_capability;

    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;

    -- REVOCATION-SAFE GUARD:
    -- If capability is sensitive or mutates state, verify against LIVE database state
    -- to prevent stale 72h JWT exploitation.
    IF v_is_sensitive IS TRUE OR v_is_mutation IS TRUE THEN
        SELECT ua.status_akun, extract(epoch from ua.tokens_valid_after)::bigint, om.status_organisasi
        INTO v_status_akun, v_tokens_valid_after, v_status_organisasi
        FROM public.user_account ua
        LEFT JOIN public.organization_membership om ON om.identity_id = ua.identity_id AND om.is_current = TRUE
        WHERE ua.id = v_account_id;

        -- If token was issued before a revocation event (password change / suspension), FAIL CLOSED
        IF v_tokens_valid_after IS NOT NULL AND v_token_issued_at IS NOT NULL AND v_token_issued_at < v_tokens_valid_after THEN
            RETURN FALSE;
        END IF;
    END IF;

    -- Gate 1: Account must be active
    IF v_status_akun != 'active' THEN
        RETURN FALSE;
    END IF;

    -- Gate 2: Inactive organization members are strictly read-only
    IF v_status_organisasi = 'inactive' AND v_is_mutation IS TRUE THEN
        RETURN FALSE;
    END IF;

    -- Gate 3: Denied override takes highest precedence
    IF v_is_sensitive IS TRUE OR v_is_mutation IS TRUE THEN
        -- Query live overrides
        IF EXISTS (
            SELECT 1 FROM public.account_capability_overrides
            WHERE account_id = v_account_id AND capability_key = p_capability AND override_type = 'deny'
        ) THEN
            RETURN FALSE;
        END IF;

        -- Check live allowed override
        IF EXISTS (
            SELECT 1 FROM public.account_capability_overrides
            WHERE account_id = v_account_id AND capability_key = p_capability AND override_type = 'allow'
        ) THEN
            RETURN TRUE;
        END IF;

        -- Check live profiles
        IF EXISTS (
            SELECT 1 FROM public.account_profiles ap
            JOIN public.profile_capabilities pc ON pc.profile_id = ap.profile_id
            WHERE ap.account_id = v_account_id AND pc.capability_key = p_capability
        ) THEN
            RETURN TRUE;
        END IF;
    ELSE
        -- Standard read performance path via claims
        SELECT ARRAY(SELECT jsonb_array_elements_text(v_claims -> 'denied_overrides')) INTO v_denied;
        IF p_capability = ANY(v_denied) THEN
            RETURN FALSE;
        END IF;

        SELECT ARRAY(SELECT jsonb_array_elements_text(v_claims -> 'allowed_overrides')) INTO v_allowed;
        IF p_capability = ANY(v_allowed) THEN
            RETURN TRUE;
        END IF;

        SELECT ARRAY(SELECT jsonb_array_elements_text(v_claims -> 'profiles')) INTO v_profiles;
        IF EXISTS (
            SELECT 1 FROM public.profile_capabilities
            WHERE profile_id = ANY(v_profiles) AND capability_key = p_capability
        ) THEN
            RETURN TRUE;
        END IF;
    END IF;

    RETURN FALSE;
END;
$$;

-- ----------------------------------------------------------------------------
-- 10. TRANSACTIONAL STORED PROCEDURES (5 Contracted RPCs)
-- ----------------------------------------------------------------------------

-- RPC 1: rpc_checkout_loan
CREATE OR REPLACE FUNCTION rpc_checkout_loan(
    p_transaction_id TEXT,
    p_borrower_name  TEXT,
    p_purpose        TEXT,
    p_out_date       DATE,
    p_due_date       DATE,
    p_event_name     TEXT,
    p_unit_ids       UUID[],
    p_actor_id       UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_unit_id UUID;
    v_count INT := 0;
BEGIN
    IF NOT auth.has_capability('loans.checkout') THEN
        RAISE EXCEPTION 'UNAUTHORIZED: loans.checkout capability required';
    END IF;

    -- Concurrency Guard: Lock rows FOR UPDATE
    PERFORM id FROM ptv_inventaris_unit 
    WHERE id = ANY(p_unit_ids) AND status_peminjaman = 'tersedia' 
    FOR UPDATE;

    -- Verify all requested units are available
    IF (SELECT count(*) FROM ptv_inventaris_unit WHERE id = ANY(p_unit_ids) AND status_peminjaman = 'tersedia') != array_length(p_unit_ids, 1) THEN
        RAISE EXCEPTION 'UNIT_NOT_AVAILABLE: One or more selected units are already loaned or missing';
    END IF;

    FOREACH v_unit_id IN ARRAY p_unit_ids LOOP
        INSERT INTO ptv_peminjaman (
            transaction_id, unit_id, peminjam_nama, keperluan, 
            tanggal_pinjam, tenggat_kembali, status, actor_id
        ) VALUES (
            p_transaction_id, v_unit_id, p_borrower_name, p_purpose,
            p_out_date, p_due_date, 'dipinjam', p_actor_id
        );

        UPDATE ptv_inventaris_unit 
        SET status_peminjaman = 'dipinjam', updated_at = now()
        WHERE id = v_unit_id;

        v_count := v_count + 1;
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'transaction_id', p_transaction_id,
        'items_count', v_count
    );
END;
$$;

-- RPC 2: rpc_return_loan
CREATE OR REPLACE FUNCTION rpc_return_loan(
    p_transaction_id   TEXT,
    p_back_date        DATE,
    p_condition_status TEXT,
    p_notes            TEXT,
    p_actor_id         UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_unit_ids UUID[];
BEGIN
    IF NOT auth.has_capability('loans.return') THEN
        RAISE EXCEPTION 'UNAUTHORIZED: loans.return capability required';
    END IF;

    SELECT array_agg(unit_id) INTO v_unit_ids
    FROM ptv_peminjaman
    WHERE transaction_id = p_transaction_id AND status = 'dipinjam';

    IF v_unit_ids IS NULL OR array_length(v_unit_ids, 1) = 0 THEN
        RAISE EXCEPTION 'TRANSACTION_NOT_FOUND: No active loans found for transaction %', p_transaction_id;
    END IF;

    UPDATE ptv_peminjaman
    SET status = 'dikembalikan',
        tanggal_kembali = p_back_date,
        kondisi_kembali = p_condition_status,
        catatan = COALESCE(catatan, '') || ' | ' || COALESCE(p_notes, '')
    WHERE transaction_id = p_transaction_id AND status = 'dipinjam';

    UPDATE ptv_inventaris_unit
    SET status_peminjaman = 'tersedia',
        kondisi = p_condition_status,
        updated_at = now()
    WHERE id = ANY(v_unit_ids);

    RETURN jsonb_build_object(
        'success', true,
        'transaction_id', p_transaction_id,
        'returned_units', array_length(v_unit_ids, 1)
    );
END;
$$;

-- RPC 3: rpc_return_single_unit
CREATE OR REPLACE FUNCTION rpc_return_single_unit(
    p_loan_row_id      UUID,
    p_unit_id          UUID,
    p_condition_status TEXT,
    p_actor_id         UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
    IF NOT auth.has_capability('loans.return') THEN
        RAISE EXCEPTION 'UNAUTHORIZED: loans.return capability required';
    END IF;

    UPDATE ptv_peminjaman
    SET status = 'dikembalikan',
        tanggal_kembali = CURRENT_DATE,
        kondisi_kembali = p_condition_status
    WHERE id = p_loan_row_id AND unit_id = p_unit_id;

    UPDATE ptv_inventaris_unit
    SET status_peminjaman = 'tersedia',
        kondisi = p_condition_status,
        updated_at = now()
    WHERE id = p_unit_id;

    RETURN jsonb_build_object(
        'success', true,
        'loan_id', p_loan_row_id,
        'unit_id', p_unit_id
    );
END;
$$;

-- RPC 4: rpc_get_next_inv_code
CREATE OR REPLACE FUNCTION rpc_get_next_inv_code()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_max_num INT;
BEGIN
    PERFORM pg_advisory_xact_lock(1001);

    SELECT COALESCE(MAX(NULLIF(regexp_replace(kode, '\D', '', 'g'), '')::INT), 0)
    INTO v_max_num
    FROM ptv_inventaris;

    RETURN 'INV-' || LPAD((v_max_num + 1)::TEXT, 3, '0');
END;
$$;

-- RPC 5: rpc_submit_official_doc
CREATE OR REPLACE FUNCTION rpc_submit_official_doc(
    p_doc_type TEXT,
    p_payload  JSONB,
    p_actor_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_prefix TEXT;
    v_lock_id BIGINT;
    v_year TEXT := to_char(CURRENT_DATE, 'YYYY');
    v_month TEXT := to_char(CURRENT_DATE, 'MM');
    v_seq INT;
    v_nomor TEXT;
    v_doc_id UUID;
BEGIN
    IF NOT auth.has_capability('documents.request') AND NOT auth.has_capability('documents.generate') THEN
        RAISE EXCEPTION 'UNAUTHORIZED: documents capability required';
    END IF;

    IF p_doc_type = 'tugas' THEN
        v_prefix := 'ST'; v_lock_id := 1002;
    ELSIF p_doc_type = 'izin' THEN
        v_prefix := 'SI'; v_lock_id := 1003;
    ELSIF p_doc_type = 'barang' THEN
        v_prefix := 'SBB'; v_lock_id := 1004;
    ELSE
        RAISE EXCEPTION 'INVALID_DOC_TYPE: %', p_doc_type;
    END IF;

    PERFORM pg_advisory_xact_lock(v_lock_id);

    IF p_doc_type = 'tugas' THEN
        SELECT count(*) + 1 INTO v_seq FROM ptv_surat_tugas WHERE nomor_surat LIKE v_prefix || '-PTV/' || v_year || '/' || v_month || '/%';
        v_nomor := v_prefix || '-PTV/' || v_year || '/' || v_month || '/' || LPAD(v_seq::TEXT, 3, '0');
        INSERT INTO ptv_surat_tugas (nomor_surat, perihal, tanggal_tugas, kru_terlibat, disetujui_oleh)
        VALUES (v_nomor, p_payload ->> 'perihal', (p_payload ->> 'tanggal_tugas')::DATE, p_payload -> 'kru_terlibat', p_actor_id)
        RETURNING id INTO v_doc_id;
    ELSIF p_doc_type = 'izin' THEN
        SELECT count(*) + 1 INTO v_seq FROM ptv_surat_izin WHERE nomor_surat LIKE v_prefix || '-PTV/' || v_year || '/' || v_month || '/%';
        v_nomor := v_prefix || '-PTV/' || v_year || '/' || v_month || '/' || LPAD(v_seq::TEXT, 3, '0');
        INSERT INTO ptv_surat_izin (nomor_surat, nama_pemohon, alasan, tanggal_mulai, tanggal_selesai, disetujui_oleh)
        VALUES (v_nomor, p_payload ->> 'nama_pemohon', p_payload ->> 'alasan', (p_payload ->> 'tanggal_mulai')::DATE, (p_payload ->> 'tanggal_selesai')::DATE, p_actor_id)
        RETURNING id INTO v_doc_id;
    ELSE
        SELECT count(*) + 1 INTO v_seq FROM ptv_surat_barang WHERE nomor_surat LIKE v_prefix || '-PTV/' || v_year || '/' || v_month || '/%';
        v_nomor := v_prefix || '-PTV/' || v_year || '/' || v_month || '/' || LPAD(v_seq::TEXT, 3, '0');
        INSERT INTO ptv_surat_barang (nomor_surat, nama_pembawa, tujuan_lokasi, daftar_barang, disetujui_oleh)
        VALUES (v_nomor, p_payload ->> 'nama_pembawa', p_payload ->> 'tujuan_lokasi', p_payload -> 'daftar_barang', p_actor_id)
        RETURNING id INTO v_doc_id;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'nomor_surat', v_nomor,
        'doc_id', v_doc_id
    );
END;
$$;

-- ----------------------------------------------------------------------------
-- 11. ROW LEVEL SECURITY (RLS) POLICIES
-- ----------------------------------------------------------------------------

ALTER TABLE canonical_identity ENABLE ROW LEVEL SECURITY;
ALTER TABLE identity_contact ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_account ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE ptv_inventaris ENABLE ROW LEVEL SECURITY;
ALTER TABLE ptv_nilai_inventaris ENABLE ROW LEVEL SECURITY;
ALTER TABLE ptv_peminjaman ENABLE ROW LEVEL SECURITY;
ALTER TABLE ptv_lapor_masalah ENABLE ROW LEVEL SECURITY;
ALTER TABLE ptv_keuangan ENABLE ROW LEVEL SECURITY;
ALTER TABLE ptv_pemasukan ENABLE ROW LEVEL SECURITY;
ALTER TABLE ptv_pengeluaran ENABLE ROW LEVEL SECURITY;
ALTER TABLE ptv_kas_kru ENABLE ROW LEVEL SECURITY;
ALTER TABLE ptv_surat_tugas ENABLE ROW LEVEL SECURITY;
ALTER TABLE ptv_surat_izin ENABLE ROW LEVEL SECURITY;
ALTER TABLE ptv_surat_barang ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE ptv_push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Financial Isolation (Quarantined from Pembina & Crew)
CREATE POLICY isolate_finance_view ON ptv_keuangan FOR SELECT 
USING (auth.has_capability('finance.view') OR auth.has_capability('finance.operator'));

CREATE POLICY isolate_finance_manage ON ptv_keuangan FOR ALL 
USING (auth.has_capability('finance.manage'));

CREATE POLICY isolate_pemasukan ON ptv_pemasukan FOR ALL 
USING (auth.has_capability('finance.view') OR auth.has_capability('finance.operator'));

CREATE POLICY isolate_pengeluaran ON ptv_pengeluaran FOR ALL 
USING (auth.has_capability('finance.view') OR auth.has_capability('finance.operator'));

-- Inventory Valuation Isolation (Quarantined from Pembina)
CREATE POLICY isolate_valuation_view ON ptv_nilai_inventaris FOR SELECT 
USING (auth.has_capability('inventory.valuation.view'));

CREATE POLICY isolate_valuation_manage ON ptv_nilai_inventaris FOR ALL 
USING (auth.has_capability('inventory.valuation.manage'));

-- Private Contact Protection
CREATE POLICY isolate_contacts ON identity_contact FOR SELECT 
USING (identity_id = (auth.jwt() ->> 'identity_id')::uuid OR auth.has_capability('crew.permissions.manage'));

-- Credentials System Protection (No client SELECT)
CREATE POLICY block_client_credentials ON auth_credentials FOR ALL 
USING (false);

-- Push Subscription Crypto Protection
CREATE POLICY allow_client_insert_sub ON ptv_push_subscriptions FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY block_client_read_sub ON ptv_push_subscriptions FOR SELECT 
USING (false);

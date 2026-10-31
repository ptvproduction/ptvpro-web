-- ============================================================================
-- PTV PRO SUPER APP — STAGING REFERENCE DATA SEED SCRIPT (SEED-ONLY)
-- ============================================================================
-- 
-- Phase: Phase 5C.1 — Staging Reference Data Seed
-- Target: Supabase Staging Project (swadgljnyelsjstqqxbm)
-- 
-- STRICT ISOLATION & NON-DESTRUCTIVE RULES:
-- 1. SEED-ONLY: Zero CREATE TABLE, zero ALTER TABLE, zero DROP, zero TRUNCATE.
-- 2. ZERO PRODUCTION SECRETS / ZERO PERSONAL DATA:
--    Only seeds institutional configuration: 2 organizations, 5 divisions,
--    5 access profiles, 53 capability keys, and 177 profile capability mappings.
--    Zero santri, zero crew, zero user accounts, zero credentials, zero passwords.
-- 3. IDEMPOTENT & RE-RUNNABLE:
--    Uses ON CONFLICT DO UPDATE for metadata syncing and ON CONFLICT DO NOTHING
--    for relational mappings. Completely safe to run multiple times.
-- 4. ATOMIC TRANSACTION:
--    Wrapped in BEGIN ... COMMIT to ensure all-or-nothing execution.
-- 
-- Authoritative Contracts:
-- - docs/PTV-HUB-FINAL-DATABASE-AUTH-CONTRACT.md (Section 5 & 6)
-- - docs/PTV-PRO-PROJECT-ARCHITECTURE.md
-- - docs/PTV-PRO-DECISIONS.md (ADR-016)
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. SEED CANONICAL ORGANIZATIONS (2 Entities)
-- ----------------------------------------------------------------------------
INSERT INTO organization (id, name, description) VALUES
('ptv_studio', 'PTV Studio', 'Lembaga Penyiaran & Multimedia Pesantren Progresif'),
('bsh_pesantren', 'BSH Pesantren', 'Badan Santri & Kepengurusan Pesantren')
ON CONFLICT (id) DO UPDATE SET 
    name = EXCLUDED.name, 
    description = EXCLUDED.description;

-- ----------------------------------------------------------------------------
-- 2. SEED CANONICAL DIVISIONS (5 Functional Divisions)
-- ----------------------------------------------------------------------------
INSERT INTO organization_division (id, name, description) VALUES
('technical', 'Technical & Hardware', 'Divisi teknis, kamera, lighting, audio, dan perawatan perangkat studio'),
('editor', 'Editor & Post-Production', 'Divisi penyuntingan video, color grading, dan pengolahan audio'),
('layouter', 'Layouter & Visual Design', 'Divisi tata letak grafis, poster, publikasi cetak, dan visual branding'),
('creative', 'Creative & Production', 'Divisi konseptor konten, sutradara, naskah, dan talent production'),
('engagements', 'Engagements & Media Relations', 'Divisi distribusi konten, media sosial, humas, dan live streaming')
ON CONFLICT (id) DO UPDATE SET 
    name = EXCLUDED.name, 
    description = EXCLUDED.description;

-- ----------------------------------------------------------------------------
-- 3. SEED CANONICAL ACCESS PROFILES (Exact 5 Profiles)
-- ----------------------------------------------------------------------------
INSERT INTO access_profile (id, name, description) VALUES
('root_executive', 'PTV / Root Executive', 'Institutional system account (PTV-ROOT) with emergency override powers'),
('eksekutif', 'Eksekutif', 'Leadership operational control across all views (Ketua Umum, Sekretaris & Bendahara, Koor Operasional)'),
('kepolo_kepali', 'Kepolo Kepali', 'Division leads and operational supervisors'),
('crew', 'Crew', 'Active operational santri personnel, videographers, editors, technicians'),
('pembina', 'Pembina', 'Foundation patrons and advisory leadership (strictly quarantined from finance/valuation)')
ON CONFLICT (id) DO UPDATE SET 
    name = EXCLUDED.name, 
    description = EXCLUDED.description;

-- ----------------------------------------------------------------------------
-- 4. SEED AUTHORITATIVE CAPABILITY REGISTRY (Exact 53 Granular Capabilities)
-- ----------------------------------------------------------------------------
INSERT INTO capability_registry (key, domain, description, is_mutation, is_sensitive) VALUES
-- Domain: Hub & General
('hub.access', 'hub', 'Log in and access PTV Hub SPA shell', false, false),

-- Domain: Events & Rundown
('events.view', 'events', 'View broadcasts, events, and schedules', false, false),
('events.create', 'events', 'Create new production events', true, false),
('events.edit', 'events', 'Modify event metadata and details', true, false),
('events.delete', 'events', 'Delete production events', true, true),
('events.rundown.manage', 'events', 'Edit event timelines and crew rosters', true, false),
('calendar.view', 'calendar', 'Access interactive monthly calendar grid', false, false),

-- Domain: Inventory & Gear
('inventory.view', 'inventory', 'View equipment catalog & unit availability', false, false),
('inventory.create', 'inventory', 'Add new equipment catalog items', true, false),
('inventory.edit', 'inventory', 'Modify equipment specifications & photos', true, false),
('inventory.delete', 'inventory', 'Delete equipment catalog items', true, true),
('inventory.units.manage', 'inventory', 'Add, edit serial numbers, barcode units', true, false),
('inventory.valuation.view', 'inventory', 'View asset purchase prices & capital total (Quarantined from Pembina)', false, true),
('inventory.valuation.manage', 'inventory', 'Modify asset acquisition cost & receipts', true, true),

-- Domain: Loans & Checkout
('loans.view', 'loans', 'View active and historical loan records', false, false),
('loans.checkout', 'loans', 'Checkout equipment loan basket', true, false),
('loans.return', 'loans', 'Process return & equipment inspection', true, false),
('loans.manage', 'loans', 'Cancel or adjust loan transaction records', true, true),

-- Domain: Damage & QC
('damage.view', 'damage', 'View damage reports and QC pipeline', false, false),
('damage.report', 'damage', 'Submit broken equipment incident ticket', true, false),
('damage.qc.approve', 'damage', 'Sign off on repaired gear & restore status', true, true),

-- Domain: Lost & Found
('lostfound.view', 'lostfound', 'View lost & found item directory', false, false),
('lostfound.report', 'lostfound', 'Log lost or found item', true, false),
('lostfound.manage', 'lostfound', 'Update claim status or delete record', true, false),

-- Domain: Crew & Roles
('crew.view', 'crew', 'View crew directory and division rosters', false, false),
('crew.create', 'crew', 'Provision new crew profiles', true, true),
('crew.edit', 'crew', 'Update crew divisions, titles, profiles', true, false),
('crew.status.manage', 'crew', 'Deactivate, suspend, or archive accounts', true, true),
('crew.permissions.manage', 'crew', 'Grant or revoke capabilities and profiles', true, true),
('id.view', 'id', 'Access personal digital ID card', false, false),
('id.export', 'id', 'Download ID card image or print canvas', false, false),

-- Domain: Official Documents
('documents.view', 'documents', 'View personal and team official documents', false, false),
('documents.request', 'documents', 'Submit permit / official letter request', true, false),
('documents.generate', 'documents', 'Run wizard to draft SI/ST/SBB documents', true, false),
('documents.approve', 'documents', 'Digitally sign & issue formal documents', true, true),
('documents.archive.view', 'documents', 'Access master historical archive', false, false),
('documents.archive.manage', 'documents', 'Delete or void archived official letters', true, true),

-- Domain: Finance & Cash Book
('finance.view', 'finance', 'View studio cash book ledgers & balances (Quarantined from Pembina & Crew)', false, true),
('finance.manage', 'finance', 'Add vouchers, void transactions, close periods', true, true),
('finance.operator', 'finance', 'Record dues, generate invoices, entries (Configurable override)', true, true),

-- Domain: Contacts & Phonebook
('contacts.internal.view', 'contacts', 'Access crew phonebook & WhatsApp links', false, false),
('contacts.external.view', 'contacts', 'Access third-party vendor directory', false, false),
('contacts.external.manage', 'contacts', 'Add, edit, delete vendor contacts', true, false),

-- Domain: Broadcast & Announcements
('broadcast.view', 'broadcast', 'View announcements and studio alerts', false, false),
('broadcast.dispatch', 'broadcast', 'Send Web Push notifications & chimes', true, true),

-- Domain: Special Projects & Haul Akbar
('projecthaul.view', 'projecthaul', 'Access Haul Akbar mission control', false, false),
('projecthaul.manage', 'projecthaul', 'Edit milestones and stream links', true, false),

-- Domain: Notes & Notulensi
('notes.view', 'notes', 'View operational notes & minutes', false, false),
('notes.create', 'notes', 'Create scratchpad notes & notulensi', true, false),
('notes.manage', 'notes', 'Pin notes, delete notes, edit categories', true, false),

-- Domain: System & Auditing
('settings.personal', 'settings', 'Edit preferences, audio test, theme', false, false),
('settings.system', 'settings', 'Configure Supabase keys, system flags', true, true),
('audit.logs.view', 'audit', 'Inspect forensic login & mutation logs', false, true)
ON CONFLICT (key) DO UPDATE SET 
    domain = EXCLUDED.domain,
    description = EXCLUDED.description,
    is_mutation = EXCLUDED.is_mutation,
    is_sensitive = EXCLUDED.is_sensitive;

-- ----------------------------------------------------------------------------
-- 5. SEED PROFILE CAPABILITY MAPPINGS (Total 177 Relational Mappings)
-- ----------------------------------------------------------------------------

-- Profile 1: Root Executive (All 53 Capabilities)
INSERT INTO profile_capabilities (profile_id, capability_key)
SELECT 'root_executive', key FROM capability_registry
ON CONFLICT (profile_id, capability_key) DO NOTHING;

-- Profile 2: Eksekutif (All 53 Capabilities per ADR-016 Contract Reconciliation)
INSERT INTO profile_capabilities (profile_id, capability_key)
SELECT 'eksekutif', key FROM capability_registry
ON CONFLICT (profile_id, capability_key) DO NOTHING;

-- Profile 3: Kepolo Kepali (37 Capabilities)
INSERT INTO profile_capabilities (profile_id, capability_key) VALUES
('kepolo_kepali', 'hub.access'),
('kepolo_kepali', 'events.view'),
('kepolo_kepali', 'events.create'),
('kepolo_kepali', 'events.edit'),
('kepolo_kepali', 'events.rundown.manage'),
('kepolo_kepali', 'calendar.view'),
('kepolo_kepali', 'inventory.view'),
('kepolo_kepali', 'inventory.create'),
('kepolo_kepali', 'inventory.edit'),
('kepolo_kepali', 'inventory.units.manage'),
('kepolo_kepali', 'inventory.valuation.view'),
('kepolo_kepali', 'loans.view'),
('kepolo_kepali', 'loans.checkout'),
('kepolo_kepali', 'loans.return'),
('kepolo_kepali', 'damage.view'),
('kepolo_kepali', 'damage.report'),
('kepolo_kepali', 'damage.qc.approve'),
('kepolo_kepali', 'lostfound.view'),
('kepolo_kepali', 'lostfound.report'),
('kepolo_kepali', 'lostfound.manage'),
('kepolo_kepali', 'crew.view'),
('kepolo_kepali', 'id.view'),
('kepolo_kepali', 'id.export'),
('kepolo_kepali', 'documents.view'),
('kepolo_kepali', 'documents.request'),
('kepolo_kepali', 'documents.generate'),
('kepolo_kepali', 'documents.archive.view'),
('kepolo_kepali', 'contacts.internal.view'),
('kepolo_kepali', 'contacts.external.view'),
('kepolo_kepali', 'contacts.external.manage'),
('kepolo_kepali', 'broadcast.view'),
('kepolo_kepali', 'projecthaul.view'),
('kepolo_kepali', 'projecthaul.manage'),
('kepolo_kepali', 'notes.view'),
('kepolo_kepali', 'notes.create'),
('kepolo_kepali', 'notes.manage'),
('kepolo_kepali', 'settings.personal')
ON CONFLICT (profile_id, capability_key) DO NOTHING;

-- Profile 4: Crew (24 Capabilities)
INSERT INTO profile_capabilities (profile_id, capability_key) VALUES
('crew', 'hub.access'),
('crew', 'events.view'),
('crew', 'calendar.view'),
('crew', 'inventory.view'),
('crew', 'inventory.valuation.view'),
('crew', 'loans.view'),
('crew', 'loans.checkout'),
('crew', 'loans.return'),
('crew', 'damage.view'),
('crew', 'damage.report'),
('crew', 'lostfound.view'),
('crew', 'lostfound.report'),
('crew', 'crew.view'),
('crew', 'id.view'),
('crew', 'id.export'),
('crew', 'documents.view'),
('crew', 'documents.request'),
('crew', 'contacts.internal.view'),
('crew', 'contacts.external.view'),
('crew', 'broadcast.view'),
('crew', 'projecthaul.view'),
('crew', 'notes.view'),
('crew', 'notes.create'),
('crew', 'settings.personal')
ON CONFLICT (profile_id, capability_key) DO NOTHING;

-- Profile 5: Pembina (10 Capabilities - Quarantined from Finance & Valuation)
INSERT INTO profile_capabilities (profile_id, capability_key) VALUES
('pembina', 'hub.access'),
('pembina', 'events.view'),
('pembina', 'calendar.view'),
('pembina', 'inventory.view'),
('pembina', 'loans.view'),
('pembina', 'damage.view'),
('pembina', 'lostfound.view'),
('pembina', 'broadcast.view'),
('pembina', 'notes.view'),
('pembina', 'settings.personal')
ON CONFLICT (profile_id, capability_key) DO NOTHING;

-- Strict Quarantine Assertion: Reconcile any existing privilege drift on Pembina
DELETE FROM public.profile_capabilities 
WHERE profile_id = 'pembina' 
  AND (capability_key LIKE 'finance.%' OR capability_key LIKE 'inventory.valuation.%');

-- Institutional Reference Tables Privileges
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON 
    public.organization, 
    public.organization_division, 
    public.access_profile, 
    public.capability_registry, 
    public.profile_capabilities 
FROM anon, authenticated, PUBLIC;

GRANT SELECT ON 
    public.organization, 
    public.organization_division, 
    public.access_profile, 
    public.capability_registry, 
    public.profile_capabilities 
TO anon, authenticated;

COMMIT;

-- ----------------------------------------------------------------------------
-- 6. POST-SEED VERIFICATION QUERY (Read-Only Status Check)
-- ----------------------------------------------------------------------------
SELECT 
    'organization' AS entity, count(*) AS total_rows, '2 expected' AS requirement FROM organization
UNION ALL
SELECT 
    'organization_division', count(*), '5 expected' FROM organization_division
UNION ALL
SELECT 
    'access_profile', count(*), '5 expected' FROM access_profile
UNION ALL
SELECT 
    'capability_registry', count(*), '53 expected' FROM capability_registry
UNION ALL
SELECT 
    'profile_capabilities', count(*), '177 expected' FROM profile_capabilities;

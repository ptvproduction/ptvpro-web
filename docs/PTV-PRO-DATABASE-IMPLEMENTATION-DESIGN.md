# PTV PRO SUPER APP — DATABASE & SUPABASE IMPLEMENTATION DESIGN

**Subsystem:** PTV PRO Database & Supabase Integration  
**Phase:** Phase 5A — Database & Supabase Implementation Design  
**Status:** Authoritative Architectural Design Specification (LOCAL DRAFT ONLY — NO PRODUCTION EXECUTION)  
**Date:** 08 Oktober 2026  
**Author:** Antigravity AI Architecture Team  
**Authoritative References:**
- [PTV-HUB-FINAL-DATABASE-AUTH-CONTRACT.md](file:///c:/Users/zidna/ptvpro/docs/PTV-HUB-FINAL-DATABASE-AUTH-CONTRACT.md)
- [PTV-PRO-PROJECT-ARCHITECTURE.md](file:///c:/Users/zidna/ptvpro/docs/PTV-PRO-PROJECT-ARCHITECTURE.md)
- [PTV-PRO-DECISIONS.md](file:///c:/Users/zidna/ptvpro/docs/PTV-PRO-DECISIONS.md)
- [PTV-PRO-IDENTITY-AUTH-CONTRACT.md](file:///c:/Users/zidna/ptvpro/docs/PTV-PRO-IDENTITY-AUTH-CONTRACT.md)
- [PTV-PRO-CONTRACT-RECONCILIATION.md](file:///c:/Users/zidna/ptvpro/docs/PTV-PRO-CONTRACT-RECONCILIATION.md)
- [PTV-PRO-SCAFFOLD.md](file:///c:/Users/zidna/ptvpro/docs/PTV-PRO-SCAFFOLD.md)
- [PTV-PRO-SCAFFOLD-AUDIT.md](file:///c:/Users/zidna/ptvpro/docs/PTV-PRO-SCAFFOLD-AUDIT.md)

---

## 1. Executive Summary

This specification establishes the authoritative database architecture for the PTV PRO Super App on **Supabase Cloud (PostgreSQL 15+)**.

### Non-Negotiable Operational Boundaries (Design Phase):
1. **Zero Production Mutation:** Under no circumstances will SQL DDL/DML, migrations, or schema alterations be applied to the live production Supabase instance or legacy MySQL during this phase.
2. **Business Continuity:** The legacy production dashboard at `progresiftv.id/dasbor` must remain fully operational without service disruption.
3. **Decoupled Architecture:** Eliminates legacy dual-write ambiguities by designating Supabase Cloud PostgreSQL as the **Single Source of Truth**, while maintaining an asynchronous one-way compatibility mirror to WordPress MySQL.
4. **Strict Decoupling Principle:**
   $$\mathbf{IDENTITY} \neq \mathbf{ORGANIZATION\ MEMBERSHIP} \neq \mathbf{ACCOUNT} \neq \mathbf{AUTHENTICATION} \neq \mathbf{SYSTEM\ ACCESS} \neq \mathbf{POLICY}$$
5. **Ratified Capabilities:** Retains exactly **53 Granular Capabilities** and **5 Canonical Access Profiles** (`root_executive`, `eksekutif`, `kepolo_kepali`, `crew`, `pembina`) without alteration.

---

## 2. Canonical Data Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                      LEGACY CLIENTS (/dasbor)                          │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ (Read / Write via bridge)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│             POSTGRESQL COMPATIBILITY LAYER (VIEWS & RPC)               │
│  - View: ptv_kru_legacy_compat (INSTEAD OF triggers for legacy writes) │
│  - Legacy table aliases & backward compatibility schemas               │
└───────────────────────────────────┬────────────────────────────────────┘
                                    ▲
                                    │ (Direct canonical access)
┌───────────────────────────────────┴────────────────────────────────────┐
│                    PTV PRO SUPER APP CLIENTS (/hub)                    │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                  CANONICAL SUPABASE CLOUD POSTGRESQL                   │
│                        (SINGLE SOURCE OF TRUTH)                        │
├─────────────────────┬────────────────────┬─────────────────────────────┤
│  1. Identity & Auth │ 2. Organization    │ 3. Access Control & Policy  │
│  - canonical_ident  │ - organization     │ - access_profiles           │
│  - identity_contact │ - org_division     │ - capability_registry (53)  │
│  - user_account     │ - org_membership   │ - profile_capabilities      │
│  - auth_credentials │                    │ - capability_overrides      │
├─────────────────────┴────────────────────┴─────────────────────────────┤
│  4. Operational Domains (22+ tables):                                  │
│     Events, Rundown, Content Planner, Inventory, Units, Valuation,     │
│     Loans, Damages/QC, Lost & Found, Official Letters (ST/SI/SBB),     │
│     Finance, Income/Expense, Crew Dues, Notes, External Contacts,      │
│     Notifications, Push Subscriptions, Announcements, Login History    │
├────────────────────────────────────────────────────────────────────────┤
│  5. PostgreSQL ACID Stored Procedures (5 Contracted RPCs)              │
│  6. PostgreSQL Row Level Security (RLS Zero-Trust Engine)              │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    │ (Asynchronous background mirror)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   LEGACY WORDPRESS MYSQL DATABASE                      │
│                  (TEMPORARY COMPATIBILITY MIRROR)                      │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Identity & Authentication Schema

### 3.1 `canonical_identity`
Represents the permanent physical person or institutional entity.

```sql
CREATE TABLE canonical_identity (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ptv_id VARCHAR(16) NOT NULL UNIQUE, -- Permanent identifier (e.g. 'PTV-001', 'PTV-ROOT')
    full_name VARCHAR(255) NOT NULL,
    avatar_url TEXT NULL,
    legacy_id BIGINT NULL UNIQUE,       -- Maps to legacy ptv_kru.id
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_canonical_identity_ptv_id ON canonical_identity (ptv_id);
CREATE INDEX idx_canonical_identity_legacy_id ON canonical_identity (legacy_id);
```

### 3.2 `identity_contact`
Isolates private personally identifiable information (PII) from public APIs.

```sql
CREATE TABLE identity_contact (
    identity_id UUID PRIMARY KEY REFERENCES canonical_identity(id) ON DELETE CASCADE,
    phone VARCHAR(32) NULL,
    whatsapp VARCHAR(32) NULL,
    email_personal VARCHAR(255) NULL,
    emergency_contact_name VARCHAR(255) NULL,
    emergency_contact_phone VARCHAR(32) NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 3.3 `user_account`
Represents software access and login permissions for an identity.

```sql
CREATE TABLE user_account (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    identity_id UUID NOT NULL UNIQUE REFERENCES canonical_identity(id) ON DELETE RESTRICT,
    auth_user_id UUID UNIQUE NULL, -- Maps 1:1 to Supabase auth.users.id
    username VARCHAR(64) NOT NULL UNIQUE,
    status_akun VARCHAR(16) NOT NULL DEFAULT 'active' CHECK (status_akun IN ('active', 'inactive')),
    failed_login_attempts INT NOT NULL DEFAULT 0,
    lockout_until TIMESTAMPTZ NULL,
    last_login_at TIMESTAMPTZ NULL,
    last_login_ip VARCHAR(45) NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_user_account_username ON user_account (LOWER(username));
CREATE INDEX idx_user_account_auth_user ON user_account (auth_user_id);
```

### 3.4 `auth_credentials`
Stores encrypted credentials and external OAuth bindings.

```sql
CREATE TABLE auth_credentials (
    account_id UUID PRIMARY KEY REFERENCES user_account(id) ON DELETE CASCADE,
    password_hash VARCHAR(255) NULL, -- Bcrypt hash ($2y$/$2b$, cost >= 10)
    hash_algorithm VARCHAR(32) NOT NULL DEFAULT 'bcrypt', -- 'bcrypt', 'legacy_unknown', 'none'
    needs_rehash BOOLEAN NOT NULL DEFAULT FALSE,
    oauth_provider VARCHAR(32) NULL, -- 'google'
    oauth_subject_id VARCHAR(255) NULL,
    oauth_email VARCHAR(255) NULL,
    password_updated_at TIMESTAMPTZ NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_auth_credentials_oauth 
ON auth_credentials (oauth_provider, oauth_subject_id) 
WHERE oauth_provider IS NOT NULL AND oauth_subject_id IS NOT NULL;
```

---

## 4. Organization Schema

### 4.1 `organization`
Defines institutional bodies within Pesantren Progresif.

```sql
CREATE TABLE organization (
    id VARCHAR(32) PRIMARY KEY, -- 'ptv_studio', 'bsh_pesantren'
    name VARCHAR(255) NOT NULL,
    description TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO organization (id, name, description) 
VALUES ('ptv_studio', 'PTV Studio Pesantren Progresif', 'Institutional broadcast & creative production studio');
```

### 4.2 `organization_division`
Defines the functional studio divisions.

```sql
CREATE TABLE organization_division (
    id VARCHAR(32) PRIMARY KEY, -- 'technical', 'editor', 'layouter', 'creative', 'engagements'
    name VARCHAR(100) NOT NULL,
    description TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO organization_division (id, name, description) VALUES
('technical', 'Technical Division', 'Camera operations, live stream, audio engineering, hardware custody'),
('editor', 'Editor Division', 'Post-production editing, grading, archival rendering'),
('layouter', 'Layouter Division', 'Print layout, stream overlays, lower thirds'),
('creative', 'Creative Division', 'Pre-production, scriptwriting, creative concepts'),
('engagements', 'Engagements Division', 'Public relations, institutional distribution');
```

### 4.3 `organization_membership`
Represents an identity's standing and chronological assignment history.

```sql
CREATE TABLE organization_membership (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    identity_id UUID NOT NULL REFERENCES canonical_identity(id) ON DELETE RESTRICT,
    organization_id VARCHAR(32) NOT NULL REFERENCES organization(id) DEFAULT 'ptv_studio',
    division_id VARCHAR(32) NULL REFERENCES organization_division(id),
    position_title VARCHAR(100) NOT NULL, -- 'Ketua Umum', 'Sekretaris & Bendahara', 'Koor Operasional', 'Ketua Divisi', 'Anggota Divisi', 'Pembina', 'Pengarah'
    special_responsibility VARCHAR(100) NULL, -- 'PJ Sosmed', 'PJ Website'
    cohort INT NULL,                          -- Academic cohort / angkatan (e.g. 2024)
    status_organisasi VARCHAR(16) NOT NULL DEFAULT 'active' CHECK (status_organisasi IN ('active', 'inactive', 'archived')),
    period_start DATE NOT NULL DEFAULT CURRENT_DATE,
    period_end DATE NULL,
    is_current BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_org_membership_identity ON organization_membership (identity_id);
CREATE INDEX idx_org_membership_current ON organization_membership (identity_id, is_current);
```

---

## 5. Access Control Schema

### 5.1 `access_profile`
The 5 authoritative institutional access profiles.

```sql
CREATE TABLE access_profile (
    id VARCHAR(32) PRIMARY KEY, -- 'root_executive', 'eksekutif', 'kepolo_kepali', 'crew', 'pembina'
    name VARCHAR(100) NOT NULL,
    description TEXT NOT NULL
);

INSERT INTO access_profile (id, name, description) VALUES
('root_executive', 'PTV / Root Executive', 'Institutional system account (PTV-ROOT) with full emergency powers'),
('eksekutif', 'Eksekutif', 'Studio leadership (Ketua Umum, Sekretaris & Bendahara, Koor Operasional)'),
('kepolo_kepali', 'Kepolo Kepali', 'Division leads and operational supervisors'),
('crew', 'Crew', 'Active operational santri personnel, videographers, technicians'),
('pembina', 'Pembina', 'Foundation patrons and advisory leadership (strictly quarantined from finance/valuation)');
```

### 5.2 `capability_registry`
Stores the ratified **53 Granular Capabilities** (`domain.resource.action`).

```sql
CREATE TABLE capability_registry (
    key VARCHAR(64) PRIMARY KEY,
    domain VARCHAR(32) NOT NULL,
    description TEXT NOT NULL,
    is_mutation BOOLEAN NOT NULL DEFAULT FALSE,
    is_sensitive BOOLEAN NOT NULL DEFAULT FALSE
);
```

### 5.3 `profile_capabilities` & `account_profiles`
Associates capabilities to profiles, and profiles to user accounts.

```sql
CREATE TABLE profile_capabilities (
    profile_id VARCHAR(32) NOT NULL REFERENCES access_profile(id) ON DELETE CASCADE,
    capability_key VARCHAR(64) NOT NULL REFERENCES capability_registry(key) ON DELETE CASCADE,
    PRIMARY KEY (profile_id, capability_key)
);

CREATE TABLE account_profiles (
    account_id UUID NOT NULL REFERENCES user_account(id) ON DELETE CASCADE,
    profile_id VARCHAR(32) NOT NULL REFERENCES access_profile(id) ON DELETE RESTRICT,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (account_id, profile_id)
);
```

### 5.4 `account_capability_overrides`
User-level overrides (`allow` / `deny`).

```sql
CREATE TABLE account_capability_overrides (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES user_account(id) ON DELETE CASCADE,
    capability_key VARCHAR(64) NOT NULL REFERENCES capability_registry(key) ON DELETE CASCADE,
    override_type VARCHAR(8) NOT NULL CHECK (override_type IN ('allow', 'deny')),
    reason TEXT NULL,
    granted_by UUID NULL REFERENCES canonical_identity(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (account_id, capability_key)
);
```

---

## 6. Audit & Security Schema

```sql
CREATE TABLE auth_audit_log (
    id BIGSERIAL PRIMARY KEY,
    actor_id UUID NULL REFERENCES canonical_identity(id),
    actor_ptv_id VARCHAR(16) NULL,
    event_type VARCHAR(64) NOT NULL,
    ip_address VARCHAR(45) NULL,
    user_agent TEXT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE ptv_login_history (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NULL REFERENCES user_account(id),
    ptv_id VARCHAR(16) NULL,
    username VARCHAR(64) NULL,
    ip_address VARCHAR(45) NULL,
    user_agent TEXT NULL,
    status VARCHAR(32) NOT NULL, -- 'success', 'failed_bad_password', 'failed_inactive', 'locked'
    login_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_login_history_time ON ptv_login_history (login_at DESC);
CREATE INDEX idx_login_history_user ON ptv_login_history (user_id);
```

---

## 7. Operational Domain Schemas (22+ Canonical Tables)

The operational tables are retained from [PTV-HUB-FINAL-DATABASE-AUTH-CONTRACT.md](file:///c:/Users/zidna/ptvpro/docs/PTV-HUB-FINAL-DATABASE-AUTH-CONTRACT.md), maintaining complete backward compatibility with `/dasbor` data fields while adopting UUID primary keys and foreign key constraints.

1. **`ptv_acara`**: Production events, broadcasts, haul coverage.
2. **`ptv_acara_rundown`**: Minute-by-minute rundown, crew roles.
3. **`ptv_content_planner`**: Social media and video production pipeline.
4. **`ptv_inventaris`**: Master equipment catalog (`INV-xxx`, category, model, photo).
5. **`ptv_inventaris_unit`**: Barcoded physical inventory units (`status_peminjaman`: `tersedia`, `dipinjam`, `rusak`, `hilang`).
6. **`ptv_nilai_inventaris`**: Asset purchase valuations, capital sums, procurement invoices (isolated from `pembina`).
7. **`ptv_peminjaman`**: Equipment loan transactions, checkout baskets, due dates, return timestamps.
8. **`ptv_lapor_masalah`**: Equipment damage incident tickets, 4-stage QC repair workflow.
9. **`ptv_lost_found`**: Lost and found item directory, claim states.
10. **`ptv_surat_tugas`**: Official assignment letters (`ST-PTV/YYYY/MM/xxx`).
11. **`ptv_surat_izin`**: Official permit requests (`SI-PTV/YYYY/MM/xxx`).
12. **`ptv_surat_barang`**: Equipment passes (`SBB-PTV/YYYY/MM/xxx`).
13. **`ptv_keuangan`**: Studio cash books, financial vouchers (quarantined from `pembina` & `crew`).
14. **`ptv_pemasukan`**: Cash inflows.
15. **`ptv_pengeluaran`**: Cash outflows.
16. **`ptv_kas_kru`**: Monthly crew dues ledger.
17. **`ptv_kas_periode`**: Financial accounting closing periods.
18. **`ptv_catatan`**: Operational scratchpad notes and meeting minutes (manual save only).
19. **`ptv_kontak_eksternal`**: Third-party equipment vendors, broadcast partners.
20. **`ptv_notifications`**: Studio operational broadcast alerts.
21. **`ptv_push_subscriptions`**: Web Push client subscription credentials (`p256dh`, `auth`).
22. **`ptv_pengumuman`**: Global studio banner announcements.

---

## 8. Relational Entity Relationship Diagram (ASCII)

```
┌──────────────────────────┐
│    canonical_identity    │
│  PK id (UUID)            │◄───────────┐
│  UK ptv_id               │            │
│     full_name            │            │
└────────────┬─────────────┘            │
             │ 1:1                      │
             ▼                          │
┌──────────────────────────┐            │
│     identity_contact     │            │
│  PK identity_id (UUID)   │            │
│     phone, wa, email     │            │
└──────────────────────────┘            │
             ▲                          │ 1:N
             │                          │
┌────────────┴─────────────┐   ┌────────┴─────────────────┐
│       user_account       │   │ organization_membership  │
│  PK id (UUID)            │   │  PK id (UUID)            │
│  FK identity_id          │   │  FK identity_id          │
│  UK username             │   │  FK division_id          │
│     status_akun          │   │     position_title       │
│  FK auth_user_id (Auth)  │   │     status_organisasi    │
└────────────┬─────────────┘   └──────────────────────────┘
             │ 1:1
             ├──────────────────────────┐
             ▼                          ▼
┌──────────────────────────┐   ┌──────────────────────────┐
│     auth_credentials     │   │     account_profiles     │
│  PK account_id           │   │  PK (account_id, profile)│
│     password_hash        │   │  FK profile_id           │
│     oauth_email          │   └────────────┬─────────────┘
└──────────────────────────┘                │ N:1
                                            ▼
                               ┌──────────────────────────┐
                               │      access_profile      │
                               │  PK id                   │
                               └────────────┬─────────────┘
                                            │ 1:N
                                            ▼
                               ┌──────────────────────────┐
                               │   profile_capabilities   │
                               │  PK (profile, capability)│
                               │  FK capability_key       │
                               └────────────┬─────────────┘
                                            │ N:1
                                            ▼
                               ┌──────────────────────────┐
                               │   capability_registry    │
                               │  PK key (53 entries)     │
                               └──────────────────────────┘
```

---

## 9. Supabase Auth Integration Architecture

### 9.1 Mapping Model
Supabase `auth.users` serves as the underlying authentication infrastructure:
$$\text{auth.users.id} \longleftrightarrow \text{user_account.auth_user_id} \longleftrightarrow \text{canonical_identity.id}$$

### 9.2 Custom JWT Claims via PostgreSQL Function
To prevent continuous subqueries during client-side or RLS evaluations, Supabase Auth issues custom JWT claims containing the resolved identity context:
```sql
CREATE OR REPLACE FUNCTION auth.jwt_custom_claims()
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
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
        'profiles', COALESCE(v_profiles, ARRAY[]::TEXT[]),
        'allowed_overrides', COALESCE(v_allowed, ARRAY[]::TEXT[]),
        'denied_overrides', COALESCE(v_denied, ARRAY[]::TEXT[])
    );
END;
$$;
```

### 9.3 Login Methods Convergence
1. **Username + Password:** Client queries secure RPC `rpc_login_by_username(p_username, p_password)`, which validates Bcrypt hash in `auth_credentials`, increments lockout counter on failure, resets on success, and returns Supabase session.
2. **PTV ID + Password:** Client calls `rpc_login_by_ptvid(p_ptv_id, p_password)`, resolving `ptv_id` to `canonical_identity` and then checking credentials.
3. **Google OAuth SSO:** Authenticates via Supabase OAuth; on first login with verified email, automatically links `auth.users.id` to `user_account.auth_user_id`.
4. **Session Duration:** Token expiry 72 hours (development mock parity) with rolling refresh. Revocation on status change or password reset.

---

## 10. Row Level Security (RLS) Architecture

### 10.1 Core Server-Side Capability Resolver
```sql
CREATE OR REPLACE FUNCTION auth.has_capability(p_capability TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
    v_claims JSONB := auth.jwt();
    v_status_akun TEXT;
    v_status_organisasi TEXT;
    v_is_mutation BOOLEAN;
    v_allowed TEXT[];
    v_denied TEXT[];
    v_profiles TEXT[];
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN FALSE;
    END IF;

    v_status_akun := v_claims ->> 'status_akun';
    v_status_organisasi := v_claims ->> 'status_organisasi';

    -- Gate 1: Account must be active
    IF v_status_akun != 'active' THEN
        RETURN FALSE;
    END IF;

    -- Gate 2: Inactive organization members cannot mutate
    SELECT is_mutation INTO v_is_mutation 
    FROM public.capability_registry WHERE key = p_capability;

    IF v_status_organisasi = 'inactive' AND v_is_mutation IS TRUE THEN
        RETURN FALSE;
    END IF;

    -- Gate 3: Denied override has highest priority
    SELECT ARRAY(SELECT jsonb_array_elements_text(v_claims -> 'denied_overrides')) INTO v_denied;
    IF p_capability = ANY(v_denied) THEN
        RETURN FALSE;
    END IF;

    -- Gate 4: Allowed override
    SELECT ARRAY(SELECT jsonb_array_elements_text(v_claims -> 'allowed_overrides')) INTO v_allowed;
    IF p_capability = ANY(v_allowed) THEN
        RETURN TRUE;
    END IF;

    -- Gate 5: Profile capabilities
    SELECT ARRAY(SELECT jsonb_array_elements_text(v_claims -> 'profiles')) INTO v_profiles;
    IF EXISTS (
        SELECT 1 FROM public.profile_capabilities
        WHERE profile_id = ANY(v_profiles) AND capability_key = p_capability
    ) THEN
        RETURN TRUE;
    END IF;

    RETURN FALSE;
END;
$$;
```

### 10.2 Authoritative RLS Policy Matrix

| Table | Policy Name | Command | Expression / Security Boundary |
| :--- | :--- | :--- | :--- |
| `canonical_identity` | `view_identities` | `SELECT` | `auth.has_capability('crew.view')` |
| `canonical_identity` | `manage_identities` | `ALL` | `auth.has_capability('crew.create') OR auth.has_capability('crew.edit')` |
| `identity_contact` | `view_own_or_admin` | `SELECT` | `identity_id = (auth.jwt() ->> 'identity_id')::uuid OR auth.has_capability('crew.permissions.manage')` |
| `identity_contact` | `update_own_contact` | `UPDATE` | `identity_id = (auth.jwt() ->> 'identity_id')::uuid OR auth.has_capability('crew.edit')` |
| `user_account` | `view_accounts` | `SELECT` | `auth.has_capability('crew.view')` |
| `user_account` | `manage_accounts` | `ALL` | `auth.has_capability('crew.status.manage') OR auth.has_capability('crew.permissions.manage')` |
| `auth_credentials` | `system_auth_only` | `ALL` | `FALSE` (Direct client access blocked; accessible ONLY via Security Definer RPC) |
| `ptv_inventaris` | `view_catalog` | `SELECT` | `auth.has_capability('inventory.view')` |
| `ptv_inventaris` | `manage_catalog` | `INSERT, UPDATE, DELETE` | `auth.has_capability('inventory.create') OR auth.has_capability('inventory.edit')` |
| `ptv_nilai_inventaris` | `view_valuation` | `SELECT` | `auth.has_capability('inventory.valuation.view')` (*Quarantined from Pembina*) |
| `ptv_nilai_inventaris` | `manage_valuation` | `ALL` | `auth.has_capability('inventory.valuation.manage')` |
| `ptv_keuangan` | `view_finance` | `SELECT` | `auth.has_capability('finance.view') OR auth.has_capability('finance.operator')` (*Quarantined from Pembina & Crew*) |
| `ptv_keuangan` | `manage_finance` | `ALL` | `auth.has_capability('finance.manage')` |
| `ptv_pemasukan` / `pengeluaran` | `view_ledger` | `SELECT` | `auth.has_capability('finance.view') OR auth.has_capability('finance.operator')` |
| `ptv_peminjaman` | `view_loans` | `SELECT` | `auth.has_capability('loans.view')` |
| `ptv_peminjaman` | `checkout_loans` | `INSERT` | `auth.has_capability('loans.checkout')` |
| `ptv_lapor_masalah` | `view_damage` | `SELECT` | `auth.has_capability('damage.view')` |
| `ptv_lapor_masalah` | `report_damage` | `INSERT` | `auth.has_capability('damage.report')` |
| `ptv_lapor_masalah` | `qc_approve` | `UPDATE` | `auth.has_capability('damage.qc.approve')` |
| `ptv_surat_*` | `view_docs` | `SELECT` | `auth.has_capability('documents.view')` |
| `ptv_surat_*` | `approve_docs` | `UPDATE` | `auth.has_capability('documents.approve')` |
| `auth_audit_log` | `view_audit_logs` | `SELECT` | `auth.has_capability('audit.logs.view')` |
| `ptv_push_subscriptions` | `insert_own_sub` | `INSERT` | `auth.uid() IS NOT NULL` |
| `ptv_push_subscriptions` | `view_secrets` | `SELECT` | `FALSE` (Push service backend only) |

---

## 11. Stored Procedures (RPC) Contract Mapping

The 5 contractual atomic procedures are implemented with explicit PostgreSQL locking and capability authorization:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        5 CONTRACTED ATOMIC RPCS                        │
├──────────────────────────┬─────────────────────────────────────────────┤
│ 1. rpc_checkout_loan     │ Multi-unit basket checkout; FOR UPDATE lock │
│ 2. rpc_return_loan       │ Full transaction return; restores units     │
│ 3. rpc_return_single_unit│ Partial single-unit return from basket      │
│ 4. rpc_get_next_inv_code │ Collision-free INV-xxx code; pg_advisory_lock│
│ 5. rpc_submit_official_doc│ Atomic numbering ST/SI/SBB; advisory lock   │
└──────────────────────────┴─────────────────────────────────────────────┘
```

### Detailed RPC Specifications:

#### 1. `rpc_checkout_loan`
- **Signature:** `rpc_checkout_loan(p_transaction_id TEXT, p_borrower_name TEXT, p_purpose TEXT, p_out_date DATE, p_due_date DATE, p_event_name TEXT, p_unit_ids UUID[], p_actor_id UUID) RETURNS JSONB`
- **Locking:** `SELECT id FROM ptv_inventaris_unit WHERE id = ANY(p_unit_ids) FOR UPDATE;`
- **Validation:** Calls `auth.has_capability('loans.checkout')`. If any unit has `status_peminjaman != 'tersedia'`, rolls back with exception `UNIT_NOT_AVAILABLE`.
- **Side Effects:** Inserts rows into `ptv_peminjaman`; updates `ptv_inventaris_unit.status_peminjaman = 'dipinjam'`.

#### 2. `rpc_return_loan`
- **Signature:** `rpc_return_loan(p_transaction_id TEXT, p_back_date DATE, p_condition_status TEXT, p_notes TEXT, p_actor_id UUID) RETURNS JSONB`
- **Validation:** Calls `auth.has_capability('loans.return')`.
- **Side Effects:** Updates `ptv_peminjaman.status = 'dikembalikan'`; restores associated `ptv_inventaris_unit.status_peminjaman = 'tersedia'`.

#### 3. `rpc_return_single_unit`
- **Signature:** `rpc_return_single_unit(p_loan_row_id UUID, p_unit_id UUID, p_condition_status TEXT, p_actor_id UUID) RETURNS JSONB`
- **Validation:** Calls `auth.has_capability('loans.return')`.
- **Side Effects:** Marks specific loan record as returned; restores single unit to `tersedia`.

#### 4. `rpc_get_next_inv_code`
- **Signature:** `rpc_get_next_inv_code() RETURNS TEXT`
- **Locking:** `PERFORM pg_advisory_xact_lock(1001);`
- **Algorithm:** Scans `ptv_inventaris.kode`, extracts integer suffix, returns formatted `'INV-' || LPAD((MAX + 1)::TEXT, 3, '0')`.

#### 5. `rpc_submit_official_doc`
- **Signature:** `rpc_submit_official_doc(p_doc_type TEXT, p_payload JSONB, p_actor_id UUID) RETURNS JSONB`
- **Locking:** Advisory lock per type: `1002` (ST), `1003` (SI), `1004` (SBB).
- **Format:** Generates `[PREFIX]-PTV/YYYY/MM/xxx`, inserts document record, and returns document number and UUID.

---

## 12. Legacy `ptv_kru` Compatibility Layer

### 12.1 Backward Compatibility View: `ptv_kru_legacy_compat`
To allow legacy PHP scripts on `/dasbor` to continue querying `ptv_kru` without modifying legacy queries:

```sql
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
```

### 12.2 Updatable View Trigger (`INSTEAD OF UPDATE / INSERT`)
If `/dasbor` executes legacy updates (e.g. updating profile details), an `INSTEAD OF UPDATE` trigger distributes fields into `canonical_identity`, `identity_contact`, and `user_account` synchronously.

---

## 13. Dual-Write Elimination & MySQL Mirror Strategy

```
    [ User Action ]
           │
           ▼
    [ Canonical Write: Supabase Cloud PostgreSQL ] (Immediate ACID transaction)
           │
           ▼
    [ PostgreSQL CDC / Background Worker ]
           │
           ▼
    [ Compatibility Mirror Write: WordPress MySQL ] (Non-blocking replica)
```

### 13.1 Operational Domain Audit

| Domain | Canonical Supabase Table | Legacy MySQL Table | Desired Write Path | Mirror Mechanism | Consistency | Rollback Concern |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **1. Loans** | `ptv_peminjaman` | `$wpdb->ptv_peminjaman_log` | Supabase RPC $\rightarrow$ Mirror | Event Webhook / Cron | Eventual ($\le 2s$) | Re-sync from Supabase |
| **2. Damage/QC**| `ptv_lapor_masalah` | `$wpdb->ptv_lapor_masalah` | Supabase $\rightarrow$ Mirror | Event Webhook | Eventual | Re-sync from Supabase |
| **3. Lost & Found**| `ptv_lost_found` | `$wpdb->ptv_lost_found` | Supabase $\rightarrow$ Mirror | Event Webhook | Eventual | Re-sync from Supabase |
| **4. Equip Passes**| `ptv_surat_barang` | `$wpdb->ptv_surat_barang` | Supabase RPC $\rightarrow$ Mirror | Event Webhook | Eventual | Re-sync from Supabase |
| **5. Finance** | `ptv_keuangan`, `ptv_pemasukan` | `$wpdb->ptv_keuangan` | Supabase $\rightarrow$ Mirror | Event Webhook | Eventual | Re-sync from Supabase |
| **6. Contacts**| `ptv_kontak_eksternal` | `$wpdb->ptv_kontak_eksternal` | Supabase $\rightarrow$ Mirror | Event Webhook | Eventual | Re-sync from Supabase |

---

## 14. Data Migration Architecture

### 14.1 Phased Execution Pipeline
```
[ Phase 0: Preflight ] 
  ├── Verify connectivity & environment isolation
  └── Ensure zero staging/production crosstalk
[ Phase 1: Schema Validation ]
  ├── Validate all 53 capabilities registered
  └── Verify 5 access profiles configured
[ Phase 2: Source Extraction ]
  ├── Read-only dump of legacy MySQL ptv_kru & operational tables
  └── Load into staging schema: legacy_staging.ptv_kru
[ Phase 3: Dry-Run Transformation ]
  ├── Parse PTV IDs, validate uniqueness
  ├── Inspect password hash prefixes (Bcrypt check)
  └── Output transformation report & anomaly log
[ Phase 4: Atomic Canonical Migration ]
  ├── Insert into canonical_identity (preserve legacy_id & ptv_id)
  ├── Insert into identity_contact
  ├── Insert into user_account
  ├── Insert into auth_credentials
  ├── Insert into organization_membership
  └── Assign default account_profiles
[ Phase 5: Verification & Reconciliation ]
  ├── Row count validation: Source count === Target count
  ├── Hash integrity validation
  └── Test ptv_kru_legacy_compat view against legacy sample queries
[ Phase 6: Cutover & Bridge Repointing ]
```

---

## 15. Password Hash Migration & Reconciliation (ND-001)

The migration handles the three password scenarios without forcing unnecessary password resets:

```
                  [ Legacy Password Hash ]
                             │
            ┌────────────────┴────────────────┐
            ▼                                 ▼
   [ Starts with $2y$ or $2b$ ]      [ Old Hash / Unknown ]
            │                                 │
            ▼                                 ▼
   [ Scenario A: Valid Bcrypt ]      [ Scenario B: Legacy Hash ]
   - hash_algorithm = 'bcrypt'       - hash_algorithm = 'legacy_unknown'
   - needs_rehash = FALSE            - needs_rehash = TRUE
   - Login directly supported        - Verifies via fallback RPC,
                                       auto-rehashes to Bcrypt on login
```

- **Scenario A (Valid Bcrypt):** Transferred verbatim; users log in seamlessly without credential interruption.
- **Scenario B (Old/Unknown Hash):** Flagged `needs_rehash = TRUE`. Login checks legacy verification function. Upon first successful login, the system automatically computes a standard Bcrypt hash, saves it to `auth_credentials`, and clears `needs_rehash`.
- **Scenario C (Missing/Invalid Hash):** Account flagged `needs_rehash = TRUE, hash_algorithm = 'none'`. Login requires administrative provisioning or password reset.

---

## 16. Organization Membership History Strategy (ND-002)

- **Principle:** No fictitious history is ever created.
- **Rule:** If legacy `ptv_kru` only contains current `divisi`, `jabatan`, and `angkatan`:
  - `period_start` is set to `DATE(created_at)` or default cohort start date.
  - `period_end` is `NULL`.
  - `is_current` is `TRUE`.
  - No speculative intermediate transfer records are synthesized.

---

## 17. Google OAuth Governance Strategy (ND-003)

- **Schema Design:** Future-proofed to support both domain-restricted and personal email bindings:
  - Supports `oauth_email` and `oauth_subject_id`.
  - Policy enforcement is controlled via system configuration setting `auth.allow_personal_google_sso`:
    - If `FALSE`: Only emails ending in `@progresiftv.id` are accepted for auto-linking.
    - If `TRUE`: Personal `@gmail.com` accounts are permitted only when explicitly linked by an authenticated user or authorized by an Executive Admin.

---

## 18. Asset Custody & Transfer Governance (ND-004)

- **Audit Finding:** In legacy schema, equipment custody belongs to Technical Division Leadership (`Ketua Technical`).
- **Safety Decision:** Automatic programmatic asset reassignment upon membership deactivation carries operational risk (e.g. assigning hundreds of physical items without physical handover).
- **Contract Policy:** Deactivating a crew member triggers an **Asset Custody Notification & Audit Flag** alerting `Ketua Technical` and `Eksekutif` to conduct a physical handover audit, rather than executing blind automatic data mutations.

---

## 19. Security Threat Considerations

1. **Advisory / Pembina Isolation:** Enforced strictly via PostgreSQL RLS on `ptv_keuangan` and `ptv_nilai_inventaris`. Client-side CSS hiding is prohibited.
2. **Credential Exfiltration:** `password_hash` column is protected; standard SELECT queries from application roles cannot access `auth_credentials`.
3. **PII Protection:** Phone numbers and personal emails reside in `identity_contact` with strict owner/admin-only RLS policies.
4. **Brute Force Defense:** 5 consecutive failed attempts lock an account for 15 minutes (`lockout_until`).
5. **Session Revocation:** Status change (`status_akun = 'inactive'`) immediately invalidates JWT session capabilities via server-side capability resolver.

---

## 20. Open Decisions & Architecture Registry

| ID | Title | Core Question | Architectural Decision / Baseline | Status |
| :--- | :--- | :--- | :--- | :--- |
| **ND-001** | Legacy Password Hash | Are all legacy hashes standard Bcrypt? | Multi-scenario migration (A: direct Bcrypt, B: auto-rehash on login, C: administrative reset). | **RESOLVED IN DESIGN** |
| **ND-002** | Membership History | How to populate history if legacy has only current position? | Populate current membership without fabricating past timeline. | **RESOLVED IN DESIGN** |
| **ND-003** | Google OAuth Scope | Institutional domain only vs. personal Google accounts? | Future-proof schema; toggleable domain policy via configuration setting. | **RESOLVED IN DESIGN** |
| **ND-004** | Asset Custody Transfer | Automatic SQL transfer vs. audited physical handover? | Audited notification & handover workflow; no blind automated data mutations. | **RESOLVED IN DESIGN** |

---

## 21. Environment Separation & Safety Matrix

| Environment | Purpose | Database Target | Execution Allowance |
| :--- | :--- | :--- | :--- |
| **LOCAL** | Scaffold, unit testing, schema validation | Local SQLite / Local Postgres / Mock | Full DDL & test execution |
| **STAGING** | Dry-run migration, compatibility verification | Isolated Supabase Staging Instance | Dry-run migration scripts only |
| **PRODUCTION** | Live studio operations (`progresiftv.id`) | Supabase Cloud Production / MySQL | **READ-ONLY INSPECTION ONLY — NO DDL/DML** |

---

## 22. Implementation Sequence & Non-Execution Register

### Implementation Sequence:
1. **Phase 5A (Current):** Database implementation design & local SQL draft (Completed).
2. **Phase 5B (Future):** Local schema validation & test suite execution against local container.
3. **Phase 5C (Future):** Staging dry-run migration & compatibility bridge testing.
4. **Phase 5D (Future):** Production reconciliation and cutover.

### Explicit List of Operations NOT to Execute Yet:
- ❌ **DO NOT execute SQL against Supabase Cloud production.**
- ❌ **DO NOT apply migrations or schema modifications to live database.**
- ❌ **DO NOT alter or drop `ptv_kru` in production.**
- ❌ **DO NOT modify `ptv-dashboard-data-bridge.php` or `page-dasbor.php` on production.**
- ❌ **DO NOT commit production service role keys or database connection strings.**
- ❌ **DO NOT push to GitHub or deploy to Vercel.**

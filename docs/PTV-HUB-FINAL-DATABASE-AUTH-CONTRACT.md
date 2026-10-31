# PTV HUB FINAL DATABASE & AUTHENTICATION CONTRACT
## Authoritative Backend, Authorization & Data Contract for PTV Hub (`https://ptvpro.com/hub`)

**Target Subsystem:** `https://ptvpro.com/hub`  
**Behavioral Benchmark:** `legacy-reference/page-dasbor.php` & `legacy-reference/ptv-dashboard-data-bridge.php`  
**Target Repository:** `ptvpro-web`  
**Status:** Canonical Implementation Contract — READ-ONLY EXTRACTION (No code modifications applied)  
**Date:** 08 Oktober 2026  

---

## 1. Executive Summary

This contract formalizes the definitive database architecture, identity lifecycle, organizational hierarchy, granular capability matrix, transactional RPC boundaries, and migration protocols for **PTV HUB** (`https://ptvpro.com/hub`).

### Fundamental Architectural Tenets:
1. **Behavioral Invariance:** User-facing operational behavior must maintain strict 1:1 parity with the legacy production dashboard at `https://progresiftv.id/dasbor`.
2. **Zero Production Disruption:** The legacy production dashboard must remain completely untouched, live, and functional throughout the entire migration cycle.
3. **Decoupled Architecture:** Behind-the-scenes data access is modernized by replacing WordPress/PHP runtime dependencies (`admin-ajax.php`, `$wpdb`, MySQL mirrors) with direct Supabase Cloud PostgreSQL, secure Row Level Security (RLS), and atomic PostgreSQL Stored Procedures (RPCs).
4. **Normalized Security:** Hardcoded user exceptions in legacy code (specifically `PTV-023` / *Farsya* in finance) are extracted into explicit, configurable database capabilities. Advisory roles (*Pembina* and *Pengarah*) are strictly isolated from financial ledgers and equipment purchase valuations at the database layer.

---

## 2. Final Identity Model

The identity architecture decouples personal identity from organizational standing and transient credentials.

```
┌────────────────────────────────────────────────────────────────────────┐
│                          CANONICAL IDENTITY                            │
│  - id: UUID (Internal primary key)                                     │
│  - ptv_id: String ("PTV-xxx") [PERMANENT INSTITUTIONAL IDENTIFIER]      │
│  - full_name: String                                                   │
│  - created_at: Timestamp                                               │
└───────────────────┬────────────────────────────────┬───────────────────┘
                    │                                │
                    ▼                                ▼
┌──────────────────────────────────────┐ ┌───────────────────────────────┐
│        AUTHENTICATION METHODS        │ │   ORGANIZATION MEMBERSHIPS    │
│  - username + bcrypt_password_hash   │ │  - organization: "PTV Studio" │
│  - linked_oauth_google_email         │ │  - status_organisasi: active  │
│  - future_webauthn_passkeys          │ │  - division: "Technical"      │
│  - account_status: active / inactive │ │  - position: "Ketua"          │
└──────────────────────────────────────┘ └───────────────────────────────┘
```

### 2.1 Identity Attributes
- **Identity ID (`id`):** Immutable UUID generated upon identity registration. Primary key in database relations.
- **PTV ID (`ptv_id`):** Canonical, human-readable institutional identifier (e.g., `PTV-001`, `PTV-025`). **Permanent and immutable.** It is never reassigned, recycled, or altered even if a member changes divisions, graduates, or leaves the organization.
- **Full Name (`nama`):** Legal/display name of the individual.
- **Contact Information:** `telepon`, `no_wa`, `email_pribadi`. Kept in protected user profile tables; never exposed via public verification endpoints.
- **Branding / Workspace Email:** `username@ptvpro.com` is communications and branding infrastructure, not the permanent identity key.
- **Audit Identity:** Every mutation records `actor_id` (UUID), `actor_ptv_id` (`PTV-xxx`), and `actor_name` for audit logging and realtime broadcast payloads.

### 2.2 Mapping from Legacy `ptv_kru`
Legacy `ptv_kru` combined identity, credentials, organizational role, and account status in a single row. In the target schema:
- `id` $\rightarrow$ Canonical Identity UUID.
- `crew_id` $\rightarrow$ Canonical `ptv_id`.
- `nama` $\rightarrow$ `full_name`.
- `password_hash`, `oauth_email` $\rightarrow$ Authentication credentials layer.
- `divisi`, `jabatan`, `angkatan` $\rightarrow$ Organization Membership layer.
- `role` $\rightarrow$ System Access Profile / Role assignment layer.
- `status` $\rightarrow$ Split into `status_organisasi` and `status_akun`.

---

## 3. Organization Model

The PTV organizational structure is strictly separated from system authorization roles.

### 3.1 Authoritative PTV Organizational Hierarchy
- **Organization Leadership:**
  - `Ketua Umum` (Overall Studio Head)
  - `Sekretaris & Bendahara` (Administration, Finance & Archives)
  - `Koor Operasional` (Field Operations & Broadcast Coordinator)
- **Technical & Creative Divisions:**
  1. **Layouter Division:** Print layout, publication design, lower thirds, stream overlays.
  2. **Editor Division:** Post-production video editing, color grading, archive rendering.
  3. **Technical Division:** Camera operations, audio engineering, live streaming, networking, master control, equipment maintenance.
  4. **Creative Division:** Pre-production, scriptwriting, creative concepts, visual direction.
  5. **Engagements Division:** Public relations, distribution, audience engagement, institutional liaisons.
- **Divisional Roles:**
  - Each division has exactly:
    - `Ketua Divisi` (Division Lead)
    - `Anggota Divisi` (Active Staff)
- **Special Operational Responsibilities:**
  - `PJ Sosmed` (Social Media Operator)
  - `PJ Website` (Web Portal Content Operator)
- **Inventory Leadership Rule:**
  - **There is NO separate `PJ Inventaris` organizational role.**
  - Inventory custody and equipment maintenance belong directly to the **Technical Division Leadership (`Ketua Technical`)**.

### 3.2 Organizational Attributes vs. System Access
| Organizational Dimension | Field / Entity | Meaning | System Access Impact |
| :--- | :--- | :--- | :--- |
| **Division** | `divisi` | Functional work group | Scopes default task and equipment assignments |
| **Position** | `jabatan` | Hierarchical title | Informs approval workflows (e.g., division sign-offs) |
| **Responsibility** | `tanggung_jawab_khusus` | Special designation (e.g., PJ Sosmed) | Grants specific operational task tagging |
| **Membership Period** | `angkatan` / `periode` | Academic/cohort year | Historical reporting & cohort filtering |
| **Organization Status** | `status_organisasi` | `active`, `inactive`, `archived` | **Determines read/write mutation permissions** |
| **Access Profile** | `access_profile` | Bundle of capabilities | Dictates actual system permissions |

---

## 4. Status Model & Lifecycle

Organizational standing and portal authentication status are formally decoupled into two orthogonal fields:

```
status_organisasi: ['active', 'inactive', 'archived']
status_akun:       ['active', 'inactive']
```

### 4.1 Lifecycle State Matrix

| State Combination | Authentication (`status_akun`) | Authorization (`status_organisasi`) | System Behavior & User Experience |
| :--- | :--- | :--- | :--- |
| **Active + Active** | `active` | `active` | **Full Normal Access:** Authenticates normally. Executes all read, create, edit, delete, and checkout permissions granted by assigned access profile. |
| **Inactive + Active** | `active` | `inactive` | **Read-Only Alumni / Inactive Portal:** Permitted to authenticate. **All mutation capabilities (create, edit, delete, loan checkout, document submission) are revoked.** Access is read-only across permitted historical views, past documents, and profile. |
| **Inactive + Inactive** | `inactive` | `inactive` | **Login Blocked:** Authentication attempt rejected at gate (*"Akun nonaktif. Silakan hubungi Eksekutif PTV"*). Historical records, past loan transactions, and digital signatures remain intact. |
| **Archived + Inactive** | `inactive` | `archived` | **Archived Identity:** Authentication permanently disabled. Retained strictly for foreign-key relational integrity, document verification audits, and historical ledgers. Identity is **never deleted**. |

---

## 5. Canonical Access Profiles

Access profiles represent institutional permission bundles. Users are assigned an access profile, which can be further augmented with explicit user-level capability overrides.

### 5.1 The Five Canonical Access Profiles
1. **PTV / Root Executive:**
   - **Nature:** Institutional, system-owned account (e.g. `PTV-ROOT`). **It is NOT a personal individual account.**
   - **Scope:** Unrestricted system control, emergency override, schema maintenance, root configuration.
   - **Protection:** Heavily audited; cannot be deleted, deactivated, or downgraded through the user interface.
2. **Eksekutif:**
   - **Nature:** Personal accounts for executive leadership (Ketua Umum, Sekretaris & Bendahara, Koor Operasional, Executive Producers).
   - **Scope:** Full operational control across all 27 views, document digital signing, crew management, QC resolution, financial management, studio broadcasting.
3. **Kepolo Kepali:**
   - **Nature:** Operational supervisors (Ketua Divisi, senior crew leads).
   - **Scope:** Operational management of events, rundowns, equipment loan oversight, damage logging, external contacts, document drafting. Blocked from executive finance voiding and crew credential administration.
4. **Crew:**
   - **Nature:** Active operational personnel, santri videographers, editors, technicians.
   - **Scope:** Schedule viewing, self-service equipment checkout, damage reporting, personal notes, digital ID card generation, self-service permit requests.
5. **Pembina:**
   - **Nature:** Foundation patrons, pesantren leadership, institutional advisors (*Pengarah* & *Pembina*).
   - **Scope:** Operational oversight over studio activities, broadcasts, and equipment availability. **Strictly quarantined from financial ledgers (`ptv_keuangan`), cash book balances, crew dues, and hardware purchase valuations (`ptv_nilai_inventaris`).**

---

## 6. Granular Capability Model

Capabilities follow the canonical format: `domain.resource.action`.

### 6.1 Capability Registry (53 Granular Capabilities — Reconciled Final Count)

> [!NOTE]
> **Reconciliation Note (Phase 3B):** Initial draft headers referenced 48 capabilities; explicit line-by-line verification of the authoritative table below confirms exactly 53 granular capabilities across functional sub-domains. The full 53-item table is the canonical source of truth.

| Capability Key | Description | Default Profile Assignment | Dangerous / Sensitive? | User Override Allowed? |
| :--- | :--- | :--- | :--- | :--- |
| `hub.access` | Log in and access PTV Hub SPA shell | Root, Eksekutif, Kepolo, Crew, Pembina | No | Yes (Revoke individual) |
| `events.view` | View broadcasts, events, and schedules | Root, Eksekutif, Kepolo, Crew, Pembina | No | No |
| `events.create` | Create new production events | Root, Eksekutif, Kepolo | No | Yes |
| `events.edit` | Modify event metadata and details | Root, Eksekutif, Kepolo | No | Yes |
| `events.delete` | Delete production events | Root, Eksekutif | **Yes** | Yes |
| `events.rundown.manage` | Edit event timelines and crew rosters | Root, Eksekutif, Kepolo | No | Yes |
| `calendar.view` | Access interactive monthly calendar grid | Root, Eksekutif, Kepolo, Crew, Pembina | No | No |
| `inventory.view` | View equipment catalog & unit availability | Root, Eksekutif, Kepolo, Crew, Pembina | No | No |
| `inventory.create` | Add new equipment catalog items | Root, Eksekutif, Kepolo | No | Yes |
| `inventory.edit` | Modify equipment specifications & photos | Root, Eksekutif, Kepolo | No | Yes |
| `inventory.delete` | Delete equipment catalog items | Root, Eksekutif | **Yes** | Yes |
| `inventory.units.manage`| Add, edit serial numbers, barcode units | Root, Eksekutif, Kepolo | No | Yes |
| **`inventory.valuation.view`**| View asset purchase prices & capital total | Root, Eksekutif, Kepolo, Crew | **Yes (Quarantined from Pembina)** | Yes |
| **`inventory.valuation.manage`**| Modify asset acquisition cost & receipts | Root, Eksekutif | **Yes** | Yes |
| `loans.view` | View active and historical loan records | Root, Eksekutif, Kepolo, Crew, Pembina | No | No |
| `loans.checkout` | Checkout equipment loan basket | Root, Eksekutif, Kepolo, Crew | No | Yes |
| `loans.return` | Process return & equipment inspection | Root, Eksekutif, Kepolo, Crew | No | Yes |
| `loans.manage` | Cancel or adjust loan transaction records| Root, Eksekutif | **Yes** | Yes |
| `damage.view` | View damage reports and QC pipeline | Root, Eksekutif, Kepolo, Crew, Pembina | No | No |
| `damage.report` | Submit broken equipment incident ticket | Root, Eksekutif, Kepolo, Crew | No | Yes |
| `damage.qc.approve` | Sign off on repaired gear & restore status | Root, Eksekutif, Kepolo | **Yes** | Yes |
| `lostfound.view` | View lost & found item directory | Root, Eksekutif, Kepolo, Crew, Pembina | No | No |
| `lostfound.report` | Log lost or found item | Root, Eksekutif, Kepolo, Crew | No | Yes |
| `lostfound.manage` | Update claim status or delete record | Root, Eksekutif, Kepolo | No | Yes |
| `crew.view` | View crew directory and division rosters | Root, Eksekutif, Kepolo, Crew | No | No |
| `crew.create` | Provision new crew profiles | Root, Eksekutif | **Yes** | Yes |
| `crew.edit` | Update crew divisions, titles, profiles | Root, Eksekutif | No | Yes |
| `crew.status.manage` | Deactivate, suspend, or archive accounts | Root, Eksekutif | **Yes** | Yes |
| `crew.permissions.manage`| Grant or revoke capabilities and profiles| Root, Eksekutif | **CRITICAL** | Root / Eksekutif only |
| `id.view` | Access personal digital ID card | Root, Eksekutif, Kepolo, Crew | No | No |
| `id.export` | Download ID card image or print canvas | Root, Eksekutif, Kepolo, Crew | No | No |
| `documents.view` | View personal and team official documents | Root, Eksekutif, Kepolo, Crew | No | No |
| `documents.request` | Submit permit / official letter request | Root, Eksekutif, Kepolo, Crew | No | Yes |
| `documents.generate` | Run wizard to draft SI/ST/SBB documents | Root, Eksekutif, Kepolo | No | Yes |
| `documents.approve` | Digitally sign & issue formal documents | Root, Eksekutif | **Yes** | Yes |
| `documents.archive.view`| Access master historical archive | Root, Eksekutif, Kepolo | No | Yes |
| `documents.archive.manage`| Delete or void archived official letters | Root, Eksekutif | **Yes** | Yes |
| **`finance.view`** | View studio cash book ledgers & balances | Root, Eksekutif | **CRITICAL (Quarantined)** | Yes |
| **`finance.manage`** | Add vouchers, void transactions, close | Root, Eksekutif | **CRITICAL** | Yes |
| **`finance.operator`** | Record dues, generate invoices, entries | Root, Eksekutif (Configurable override) | **CRITICAL** | **Yes (Replaces PTV-023 hardcode)** |
| `contacts.internal.view`| Access crew phonebook & WhatsApp links | Root, Eksekutif, Kepolo, Crew | No | No |
| `contacts.external.view`| Access third-party vendor directory | Root, Eksekutif, Kepolo, Crew | No | No |
| `contacts.external.manage`| Add, edit, delete vendor contacts | Root, Eksekutif, Kepolo | No | Yes |
| `broadcast.view` | View announcements and studio alerts | Root, Eksekutif, Kepolo, Crew, Pembina | No | No |
| `broadcast.dispatch` | Send Web Push notifications & chimes | Root, Eksekutif | **Yes** | Yes |
| `projecthaul.view` | Access Haul Akbar mission control | Root, Eksekutif, Kepolo, Crew | No | No |
| `projecthaul.manage` | Edit milestones and stream links | Root, Eksekutif, Kepolo | No | Yes |
| `notes.view` | View operational notes & minutes | Root, Eksekutif, Kepolo, Crew, Pembina | No | No |
| `notes.create` | Create scratchpad notes & notulensi | Root, Eksekutif, Kepolo, Crew | No | Yes |
| `notes.manage` | Pin notes, delete notes, edit categories | Root, Eksekutif, Kepolo | No | Yes |
| `settings.personal` | Edit preferences, audio test, theme | All active roles | No | No |
| `settings.system` | Configure Supabase keys, system flags | Root, Eksekutif | **CRITICAL** | Root only |
| `audit.logs.view` | Inspect forensic login & mutation logs | Root, Eksekutif | **CRITICAL** | Root / Eksekutif only |

### 6.2 Effective Permission Resolution Algorithm
```
function hasPermission(user, capability):
  if user.status_akun != 'active':
    return false

  // Organization inactive users are strictly read-only
  if user.status_organisasi == 'inactive' and isMutationCapability(capability):
    return false

  // 1. Explicit user-level deny override takes highest precedence
  if capability in user.denied_overrides:
    return false

  // 2. Explicit user-level allow override
  if capability in user.allowed_overrides:
    return true

  // 3. Fallback to assigned Access Profile capabilities
  for role in user.assigned_profiles:
    if capability in ROLE_CAPABILITIES[role]:
      return true

  return false
```

---

## 7. Module Authorization Matrix

Operational action contract across all 22 views and sub-views in `page-dasbor.php`:

| Module | VIEW | CREATE | EDIT | DELETE | APPROVE / QC | CHECKOUT / RETURN | DISPATCH | SENSITIVE CONSTRAINTS |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Beranda** | `hub.access` | — | — | — | — | — | — | Hides action badges for unauthorized views |
| **Acara** | `events.view` | `events.create` | `events.edit` | `events.delete` | — | — | — | None |
| **Kalender** | `calendar.view` | `events.create` | `events.edit` | — | — | — | — | None |
| **Inventaris** | `inventory.view`| `inventory.create`| `inventory.edit`| `inventory.delete`| — | — | — | Purchase prices hidden |
| **Nilai Inventaris**| `inventory.valuation.view`| `inventory.valuation.manage`| `inventory.valuation.manage`| `inventory.valuation.manage`| — | — | — | **Blocked from Pembina & Pengarah** |
| **Peminjaman** | `loans.view` | `loans.checkout` | `loans.manage` | `loans.manage` | — | `loans.checkout` / `loans.return` | — | None |
| **Kerusakan** | `damage.view` | `damage.report` | `damage.report` | `damage.qc.approve`| `damage.qc.approve`| — | — | Repair cost notes restricted |
| **Lost & Found** | `lostfound.view`| `lostfound.report`| `lostfound.manage`| `lostfound.manage`| — | — | — | Contact details restricted to crew |
| **Kru** | `crew.view` | `crew.create` | `crew.edit` | `crew.status.manage`| — | — | — | Password hashes never exposed |
| **ID Digital** | `id.view` | — | `crew.edit` | — | — | — | — | None |
| **Dokumen Saya** | `documents.view`| `documents.request`| — | — | — | — | — | Filtered to records owned by current crew |
| **Kontak Internal**| `contacts.internal.view`| — | `crew.edit` | — | — | — | — | None |
| **Kontak Eksternal**| `contacts.external.view`| `contacts.external.manage`| `contacts.external.manage`| `contacts.external.manage`| — | — | — | Private vendor notes restricted |
| **Perizinan** | `documents.view`| `documents.request`| `documents.request`| — | `documents.approve`| — | — | Self-service submission |
| **Generator Izin**| `documents.generate`| `documents.generate`| `documents.generate`| — | `documents.approve`| — | — | Generates canonical number sequence |
| **Surat & Arsip** | `documents.archive.view`| `documents.generate`| `documents.archive.manage`| `documents.archive.manage`| `documents.approve`| — | — | None |
| **Keuangan** | `finance.view` | `finance.manage` / `finance.operator`| `finance.manage`| `finance.manage`| — | — | — | **Blocked from Pembina, Pengarah, Crew** |
| **Broadcast** | `broadcast.view`| `broadcast.dispatch`| — | — | — | — | `broadcast.dispatch`| Dispatches Web Push & audio chimes |
| **Project Haul** | `projecthaul.view`| `projecthaul.manage`| `projecthaul.manage`| `projecthaul.manage`| — | — | — | None |
| **Catatan** | `notes.view` | `notes.create` | `notes.manage` | `notes.manage` | — | — | — | Manual save only (Autosave off) |
| **Pengaturan** | `settings.personal`| — | `settings.personal`| — | — | — | — | Push token registration |
| **More (Drawer)** | `hub.access` | — | — | — | — | — | — | Dynamic filter of links per user capabilities |

---

## 8. Sensitive Data & Server-Side Security

Data protection must be enforced at the database (PostgreSQL Row Level Security) and server layers, never relying on client-side display toggles.

### 8.1 Data Sanitization & RLS Policy Rules

| Sensitive Entity | Target Table & Columns | Server / RLS Security Policy |
| :--- | :--- | :--- |
| **User Credentials** | `ptv_kru.password_hash` | **Prohibited from SELECT:** Excluded from application queries; validated only inside Supabase Auth or secure server functions. |
| **Personal Contact Info** | `ptv_kru.telepon`, `no_wa`, `email` | **Owner & Executive Only:** Exposed to public verification only if explicit consent flag is active; otherwise stripped from public views. |
| **Equipment Purchase Cost**| `ptv_inventaris.harga_beli`, `nilai_sekarang`, `sumber_perolehan` | **Advisory Isolation RLS:** `CREATE POLICY isolate_valuation ON ptv_inventaris FOR SELECT USING (auth.jwt() ->> 'role' NOT IN ('pembina', 'pengarah'));` |
| **Studio Financial Ledgers**| `ptv_pemasukan`, `ptv_pengeluaran`, `ptv_kas_kru`, `ptv_keuangan` | **Strict Financial RLS:** `CREATE POLICY isolate_finance ON ptv_pemasukan FOR ALL USING (auth.has_capability('finance.view') OR auth.has_capability('finance.operator'));` |
| **Executive Digital Stamps**| `ptv_surat_*.disetujui_oleh` | **Executive Approval RLS:** Modifying status to `disetujui` requires `auth.has_capability('documents.approve')`. |
| **Web Push Secrets** | `ptv_push_subscriptions.p256dh`, `auth` | **Backend Push Service Only:** Client applications can INSERT own subscriptions; reading crypto credentials restricted to service role. |
| **Audit Logs** | `ptv_login_history.ip_address`, `user_agent` | **Root / Eksekutif Only:** Restricted to administrators via RLS. |

---

## 9. Source of Truth & Dual-Write Resolution

The migration eliminates all dual-write ambiguities by designating Supabase Cloud as the single authoritative database.

### 9.1 Resolution of Dual-Write Domains

```
   [Legacy Live Production]              [Target Standalone Hub]
   https://progresiftv.id/dasbor         https://ptvpro.com/hub
               │                                    │
               │ (writes to both)                   │ (writes ONLY to)
               ▼                                    ▼
       ┌───────────────┐                  ┌───────────────────┐
       │ WordPress DB  │                  │  Supabase Cloud   │
       │ (MySQL $wpdb) │                  │   (PostgreSQL)    │
       └───────┬───────┘                  └─────────┬─────────┘
               │                                    │
               └───────── (Reconciliation) ─────────┘
                   One-way Historical Sync to Supabase
```

| Operational Domain | Legacy WordPress Table | Legacy Supabase Table | Target Canonical Source | Historical Reconciliation Strategy |
| :--- | :--- | :--- | :--- | :--- |
| **1. Equipment Loans** | `$wpdb->ptv_peminjaman_log` | `ptv_peminjaman` | `ptv_peminjaman` (Supabase) | Run reconciliation script to backfill historical MySQL loan rows into Supabase using matched `transaction_id`. Point legacy PHP bridge to read Supabase. |
| **2. Damage & QC** | `$wpdb->ptv_lapor_masalah` | `ptv_lapor_masalah` | `ptv_lapor_masalah` (Supabase) | Backfill missing ticket history from MySQL into Supabase based on timestamp and tool name. |
| **3. Lost & Found** | `$wpdb->ptv_lost_found` | `ptv_lost_found` | `ptv_lost_found` (Supabase) | Export unique records from MySQL into Supabase. |
| **4. Equipment Passes** | `$wpdb->ptv_surat_barang` | `ptv_surat_barang` | `ptv_surat_barang` (Supabase) | Migrate historical passes (`SBB-PTV/...`) into Supabase Cloud. |
| **5. Studio Finance** | `$wpdb->ptv_keuangan` | `ptv_pemasukan`, `ptv_pengeluaran`| `ptv_pemasukan` / `ptv_pengeluaran` | Legacy MySQL stores single-table transactions; transform MySQL rows where `type='Pemasukan'` into `ptv_pemasukan`, and `type='Pengeluaran'` into `ptv_pengeluaran`. |
| **6. External Contacts**| `$wpdb->ptv_kontak_eksternal`| `ptv_kontak_eksternal` | `ptv_kontak_eksternal` (Supabase)| Deploy schema to Supabase and migrate MySQL vendor records. |

---

## 10. RPC & Transaction Contract

To eliminate client-side race conditions and preserve data integrity, the following 5 operations are defined as PostgreSQL Stored Procedures (`supabase.rpc`).

### 10.1 `rpc_checkout_loan`
- **Purpose:** Atomically creates an equipment loan transaction and marks all included units as `dipinjam`.
- **Parameters:**
  ```sql
  p_transaction_id TEXT,
  p_borrower_name  TEXT,
  p_purpose        TEXT,
  p_out_date       DATE,
  p_due_date       DATE,
  p_event_name     TEXT,
  p_unit_ids       UUID[],
  p_actor_id       UUID
  ```
- **Return Value:** `JSONB` containing `{ success: true, transaction_id: TEXT, items_count: INT }`.
- **Transactional Boundary:** Single PostgreSQL transaction block (`BEGIN ... COMMIT`).
- **Validation:** 
  1. Verifies caller has capability `loans.checkout`.
  2. Queries `ptv_inventaris_unit WHERE id = ANY(p_unit_ids) AND status_peminjaman = 'dipinjam' FOR UPDATE`.
  3. If any unit is already on loan, rolls back and raises exception: `'UNIT_ALREADY_LOANED: [unit_code]'`.
- **Side Effects:** Inserts rows into `ptv_peminjaman`; updates `ptv_inventaris_unit.status_peminjaman = 'dipinjam'`.

### 10.2 `rpc_return_loan`
- **Purpose:** Atomically closes an entire loan transaction and restores all associated physical units to `tersedia`.
- **Parameters:**
  ```sql
  p_transaction_id   TEXT,
  p_back_date        DATE,
  p_condition_status TEXT, -- 'bagus' | 'rusak' | 'perlu_servis'
  p_notes            TEXT,
  p_actor_id         UUID
  ```
- **Return Value:** `JSONB` containing `{ success: true, returned_units: INT }`.
- **Validation:** Verifies caller has capability `loans.return`. Verifies `transaction_id` exists with active loans.
- **Side Effects:** Updates `ptv_peminjaman.status = 'dikembalikan'` and `tanggal_kembali = p_back_date`; updates associated `ptv_inventaris_unit.status_peminjaman = 'tersedia'`.

### 10.3 `rpc_return_single_unit`
- **Purpose:** Allows partial return of a single equipment unit from a multi-item loan basket.
- **Parameters:**
  ```sql
  p_loan_row_id      UUID,
  p_unit_id          UUID,
  p_condition_status TEXT,
  p_actor_id         UUID
  ```
- **Return Value:** `JSONB` containing `{ success: true, unit_code: TEXT }`.
- **Side Effects:** Sets `ptv_peminjaman.status = 'dikembalikan'` for specific line item; restores `ptv_inventaris_unit.status_peminjaman = 'tersedia'`.

### 10.4 `rpc_get_next_inv_code`
- **Purpose:** Generates the next sequential, collision-free master code (`INV-xxx`).
- **Parameters:** None.
- **Return Value:** `TEXT` (e.g. `'INV-143'`).
- **Transactional Boundary:** Obtains advisory lock (`pg_advisory_xact_lock(1001)`) to guarantee sequence uniqueness under concurrency.
- **Algorithm:** Scans existing `ptv_inventaris.kode`, parses numerical suffixes, identifies lowest unused gap or increments `MAX + 1`.

### 10.5 `rpc_submit_official_doc`
- **Purpose:** Atomically generates sequential official document numbers and inserts formal document.
- **Parameters:**
  ```sql
  p_doc_type TEXT, -- 'tugas' | 'izin' | 'barang'
  p_payload  JSONB,
  p_actor_id UUID
  ```
- **Return Value:** `JSONB` containing `{ success: true, nomor_surat: TEXT, doc_id: UUID }`.
- **Format Generated:**
  - Surat Tugas: `ST-PTV/YYYY/MM/xxx`
  - Surat Izin: `SI-PTV/YYYY/MM/xxx`
  - Surat Barang: `SBB-PTV/YYYY/MM/xxx`
- **Transactional Boundary:** Uses advisory lock per document prefix to guarantee sequential numbering without gaps.

---

## 11. Realtime Contract

### 11.1 Channel Configuration
- **Supabase Realtime Channel:** `ptv_dashboard_realtime_sync`
- **Transport:** WebSocket via `@supabase/supabase-js`.
- **Listening Modes:**
  1. `syncChannel.on('broadcast', { event: 'table_change' }, ...)`
  2. `syncChannel.on('postgres_changes', { event: '*', schema: 'public', table: '...' }, ...)` across 14 tables.

### 11.2 Realtime Event Matrix

| Source Table | Broadcast Scope | Affected Hub Module | Remote Client Reaction | Self-Action Echo Reaction |
| :--- | :--- | :--- | :--- | :--- |
| `ptv_acara` | `'events'` | `acara.js`, `kalender.js`, `beranda.js` | Info Toast; audio chime; partial card update | Suppressed (Silent) |
| `ptv_acara_rundown` | `'events'` | `acara.js` (Rundown sub-view) | Re-renders sequential rundown rows | Suppressed |
| `ptv_inventaris` | `'inventory'` | `inventaris.js`, `nilaiInventaris.js` | Updates available tool counts & catalog | Suppressed |
| `ptv_inventaris_unit` | `'inventory'` | `inventaris.js`, `peminjaman.js` | Updates unit status badges (`tersedia`/`dipinjam`) | Suppressed |
| `ptv_nilai_inventaris`| `'inventory'` | `nilaiInventaris.js` | Updates valuation ledger & capital sum | Suppressed |
| `ptv_peminjaman` | `'loans'` | `peminjaman.js`, `beranda.js` | Toast alert; updates `badge-pinjam`; refreshes table | Suppressed |
| `ptv_lapor_masalah` | `'damages'` | `kerusakan.js`, `beranda.js` | Warning Toast; updates QC status pill | Suppressed |
| `ptv_lost_found` | `'lost'` | `lostfound.js` | Info Toast; refreshes lost item grid | Suppressed |
| `ptv_catatan` | `'notes'` | `catatan.js` | In-place note reordering; retains active input focus | Suppressed |
| `ptv_surat_*` | `'docs'` | `surat.js`, `dokumen.js` | Success Toast; updates status to `disetujui` | Suppressed |
| `ptv_notifications` | `'notifs'` | Global App Shell (All views) | High-priority Toast; harmonic chime | Displayed |
| `ptv_pengumuman` | `'announcements'`| Global App Shell | Top banner announcement broadcast | Displayed |

---

## 12. Authentication Contract

### 12.1 Authentication Flow
1. **Login Identifiers:** Supports input of `ptv_id` (e.g. `PTV-025`), `username`, or linked email.
2. **Credential Verification:**
   - Password verified using standard Bcrypt (`$2y$` / `$2b$`, minimum cost 10).
   - In modern client runtime, auth is executed against Supabase Auth or a secure auth RPC function that executes `crypt()` in PostgreSQL.
3. **Account Status Verification:**
   - Evaluates `status_akun`: if `'inactive'`, authentication is rejected (*Fail-Closed*).
4. **Session Duration:**
   - Session valid for **72 Hours** (259,200 seconds), matching legacy parameter.
   - Refreshed on activity; invalidates on explicit logout or credential change.
5. **Session Invalidation:**
   - Logging out clears local tokens, resets Supabase client state, and redirects to `/hub#login`.
6. **Audit Trail:**
   - Every login event inserts a row into `ptv_login_history` (`user_id`, `ptv_id`, `ip_address`, `user_agent`, `login_at`).

---

## 13. Data Migration & Coexistence Strategy

```
                          COEXISTENCE ARCHITECTURE
                          
┌─────────────────────────────────┐       ┌─────────────────────────────────┐
│     Legacy Production System    │       │         Target PTV Hub          │
│   https://progresiftv.id/dasbor │       │      https://ptvpro.com/hub     │
└────────────────┬────────────────┘       └────────────────┬────────────────┘
                 │                                         │
                 │ (read/write)                            │ (read/write)
                 ▼                                         ▼
         ┌────────────────────────────────────────────────────────┐
         │                  Supabase Cloud (PostgreSQL)           │
         │                  SINGLE SOURCE OF TRUTH                │
         └───────────────────────────┬────────────────────────────┘
                                     │ (one-way sync/mirror)
                                     ▼
                         ┌───────────────────────┐
                         │   WordPress MySQL     │
                         │    Legacy Mirror      │
                         └───────────────────────┘
```

### 13.1 Step-by-Step Coexistence Plan
1. **Step 1: One-Time Historical Backfill:** Run a historical migration script that extracts older loan records, damage tickets, and finance vouchers from MySQL `$wpdb` and inserts them into Supabase Cloud PostgreSQL.
2. **Step 2: Legacy Bridge Repointing:** Update `ptv-dashboard-data-bridge.php` on the legacy server so that it reads from Supabase Cloud for all shared domains, writing to Supabase first and updating local MySQL as a non-blocking mirror.
3. **Step 3: Standalone PTV Hub Activation:** Launch `https://ptvpro.com/hub` connecting directly to Supabase Cloud. Both systems are now synchronized in real time via the same Supabase database.
4. **Step 4: Decommissioning Cutover:** Once PTV Hub passes complete operational validation, retire the WordPress legacy template and discontinue the MySQL mirror.

---

## 14. Legacy Compatibility Register

### A. Must Preserve (100% Invariant Behavior)
- [x] Visual layout, Atmospheric Azure Glassmorphism styling, and responsive layout.
- [x] Web Audio API harmonic triple chime on notifications.
- [x] PTV ID permanent numbering (`PTV-xxx`).
- [x] Manual save rule on `catatan.js` (Autosave permanently disabled).
- [x] 4-stage damage QC repair pipeline with executive sign-off.
- [x] Complete isolation of *Pembina* and *Pengarah* from financial ledgers and equipment purchase valuations.
- [x] Public verification capability for printed QR codes on ID cards and letters.

### B. Safe Implementation Refactors
- [x] Convert sequential PHP mutations into PostgreSQL Stored Procedures (`rpc_checkout_loan`, etc.).
- [x] Unify dual-written MySQL tables exclusively into Supabase Cloud PostgreSQL.
- [x] Replace hardcoded `PTV-023` finance check with configurable capability `finance.operator`.
- [x] Replace `admin-ajax.php` with direct Supabase SDK operations and RPCs.

---

## 15. Final Decision Register

| Decision | Current Legacy Behavior | Authoritative Target Behavior | Rationale | Risk & Mitigation | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **1. Decouple Status Fields** | Single `status` field in `ptv_kru` mixes alumni, active, and account state | Split into `status_organisasi` (`active`, `inactive`, `archived`) and `status_akun` (`active`, `inactive`) | Allows inactive alumni to log in as read-only without granting operational mutation rights | Low risk; clear authorization logic | **CONFIRMED** |
| **2. Root Executive Account** | Tied to personal developer/admin accounts | Institutional institutional account (`PTV-ROOT`) | Prevents accidental lockout or deactivation of root system owner | Guarded by UI deletion blocks | **CONFIRMED** |
| **3. Farsya / PTV-023 Exception** | Hardcoded `if ($ptvId === 'PTV-023')` in PHP & JS | Configurable capability `finance.operator` assigned via user profile | Clean code architecture; removes hardcoded personal exceptions | Zero disruption; capability granted to Farsya | **CONFIRMED** |
| **4. Technical Division Inventory Custody** | Confusion regarding separate PJ Inventaris | Formally assigned to Technical Division leadership (`Ketua Technical`) | Reflects actual studio operational reality; no separate role needed | Organizational alignment | **CONFIRMED** |
| **5. Financial Quarantine** | Frontend if/else hiding finance tab from Pembina | Database Row Level Security (RLS) policy blocking SELECT on `ptv_keuangan` | Prevents developer console inspection of cash balances | Critical security improvement | **CONFIRMED** |
| **6. Atomic Multi-Unit Checkout** | Sequential PHP loop updating units | PostgreSQL Stored Procedure `rpc_checkout_loan` with row-level locks | Eliminates partial loan checkout failure on network interruption | High reliability improvement | **CONFIRMED** |
| **7. Dual-Write Elimination** | Dual-writing to MySQL and Supabase | Write exclusively to Supabase Cloud; backfill MySQL history once | Eliminates silent database desynchronization | Run backfill script prior to cutover | **CONFIRMED** |

---

## FINAL REPORT SUMMARY

1. **Number of Tables:** **25 tables** (24 Supabase tables + 12 WordPress MySQL tables, with 11 overlapping dual-written tables).
2. **Number of RPCs:** **5 critical stored procedures** (`rpc_checkout_loan`, `rpc_return_loan`, `rpc_return_single_unit`, `rpc_get_next_inv_code`, `rpc_submit_official_doc`).
3. **Number of Realtime Sources / Tables:** **1 unified WebSocket channel** (`ptv_dashboard_realtime_sync`) listening across **14 distinct tables**.
4. **Final Permission Count:** **53 granular capabilities** (reconciled from initial 48 header draft) across functional domains.
5. **Number of Dual-Write Domains:** **6 operational domains** (Loans, Damage, Lost & Found, Equipment Passes, Finance, External Contacts).
6. **Number of Sensitive Domains:** **7 protected data domains** (Credentials, Private Contacts, Inventory Valuation, Financial Ledgers, Signatures, Web Push Secrets, Audit Logs).
7. **Number of Unresolved NEEDS DECISION Items:** **0 unresolved items** (All 7 structural decisions formally decided and confirmed in Section 15).
8. **Exact Next Implementation Phase:**  
   **Phase 3: Database & RPC Deployment in Supabase Cloud** (Executing PostgreSQL schemas, Stored Procedures, and RLS policies on Supabase Cloud without modifying any existing production files or live dashboard code).

# PTV PRO SUPER APP — IDENTITY & AUTHENTICATION INTEGRATION CONTRACT

**Subsystem:** PTV PRO Super App (`C:\Users\zidna\ptvpro`)  
**Phase:** Phase 4 — Identity & Auth Integration Design  
**Status:** Authoritative Architectural Design Specification  
**Date:** 08 Oktober 2026  
**Author:** Antigravity AI Architecture Team  
**Authoritative References:**
- [PTV-PRO-PROJECT-ARCHITECTURE.md](file:///c:/Users/zidna/ptvpro/docs/PTV-PRO-PROJECT-ARCHITECTURE.md)
- [PTV-PRO-DECISIONS.md](file:///c:/Users/zidna/ptvpro/docs/PTV-PRO-DECISIONS.md)
- [PTV-HUB-FINAL-DATABASE-AUTH-CONTRACT.md](file:///c:/Users/zidna/ptvpro/docs/PTV-HUB-FINAL-DATABASE-AUTH-CONTRACT.md)
- [PTV-PRO-CONTRACT-RECONCILIATION.md](file:///c:/Users/zidna/ptvpro/docs/PTV-PRO-CONTRACT-RECONCILIATION.md)
- [PTV-PRO-SCAFFOLD.md](file:///c:/Users/zidna/ptvpro/docs/PTV-PRO-SCAFFOLD.md)
- [PTV-PRO-SCAFFOLD-AUDIT.md](file:///c:/Users/zidna/ptvpro/docs/PTV-PRO-SCAFFOLD-AUDIT.md)

---

## 1. Purpose

This document establishes the canonical design for the **Identity, Organization Membership, Account, Authentication, System Access, and Policy Integration** layers of the PTV PRO Super App.

In the legacy prototype (`page-dasbor.php` / `ptv_kru`), identity, organizational title, login credentials, and operational permissions were collapsed into a single database row. This design formally decouples these concerns into distinct, resilient layers:

$$\mathbf{IDENTITY} \neq \mathbf{ORGANIZATION\ MEMBERSHIP} \neq \mathbf{ACCOUNT} \neq \mathbf{AUTHENTICATION} \neq \mathbf{SYSTEM\ ACCESS} \neq \mathbf{POLICY}$$

This contract governs how identities are preserved, authenticated, authorized, and synchronized between the legacy live production dashboard (`progresiftv.id/dasbor`) and PTV PRO (`/hub`) without data desynchronization or operational disruption.

---

## 2. Canonical Identity Model

### 2.1 Separation of Concerns Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                          CANONICAL IDENTITY                            │
│  "Who the human/institution is"                                        │
│  - id: UUID (Internal Primary Key)                                     │
│  - ptv_id: String ("PTV-xxx") [PERMANENT INSTITUTIONAL IDENTIFIER]      │
│  - full_name: String                                                   │
│  - avatar_url: String (Nullable)                                       │
│  - created_at: Timestamp                                               │
└───────────────────┬────────────────────────────────┬───────────────────┘
                    │                                │
                    ▼                                ▼
┌──────────────────────────────────────┐ ┌───────────────────────────────┐
│        USER ACCOUNT & ACCESS         │ │   ORGANIZATION MEMBERSHIPS    │
│  "Ability to login & access systems" │ │  "Standing in PTV Studio"     │
│  - account_id: UUID                  │ │  - membership_id: UUID        │
│  - username: String (Unique handle)  │ │  - organization: "PTV Studio" │
│  - status_akun: active / inactive    │ │  - status_organisasi:         │
│  - assigned_profiles: AccessProfile[]│ │    active/inactive/archived   │
│  - allowed_overrides: Capability[]   │ │  - division: "Technical"      │
│  - denied_overrides: Capability[]    │ │  - position: "Ketua"          │
│  - last_login_at: Timestamp          │ │  - angkatan: 2024             │
└───────────────────┬──────────────────┘ └───────────────────────────────┘
                    │
                    ▼
┌──────────────────────────────────────┐
│        AUTHENTICATION METHODS        │
│  "How the account proves identity"   │
│  - Username + Bcrypt Password Hash   │
│  - PTV ID + Bcrypt Password Hash     │
│  - Linked Google OAuth Email         │
│  - Future WebAuthn / Passkeys        │
└──────────────────────────────────────┘
```

### 2.2 Canonical Identity Attributes

| Attribute | Type | Mutability | Constraints & Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | **Immutable** | Primary database key; generated on registration. Used in internal foreign keys. |
| `ptv_id` | `VARCHAR(16)` | **Immutable** | Canonical human-readable institutional identifier (e.g. `PTV-001`, `PTV-025`, `PTV-ROOT`). Unique, never recycled. |
| `full_name` | `VARCHAR(255)`| Mutable | Legal / official full name (e.g. `Ahmad Farid Zidnal`). |
| `avatar_url` | `TEXT` | Mutable | Optional profile photo URL. |
| `contact_private` | `JSONB` / Table | Mutable | Private contacts: `no_wa`, `telepon`, `email_pribadi`. **Strictly quarantined from public verification APIs.** |
| `created_at` | `TIMESTAMPTZ` | **Immutable** | Timestamp of institutional registration. |

### 2.3 Permanent Identity vs. Workspace Infrastructure
- `username@ptvpro.com` is branding, workspace, and email routing infrastructure. **Email is never the permanent identity key.**
- Usernames can be changed upon administrative request; the internal `UUID` and `ptv_id` remain permanent.

---

## 3. PTV ID: Permanent Institutional Identifier

The `ptv_id` (`PTV-xxx`) is the permanent institutional identifier within Pesantren Progresif and PTV Studio.

### 3.1 Non-Negotiable Invariance Rules

1. **Immutable Across Personnel Lifecycle:**  
   A PTV ID is assigned once. It does **not** change when a member:
   - Changes division (e.g. Technical $\rightarrow$ Editor).
   - Changes position (e.g. Anggota $\rightarrow$ Ketua Divisi $\rightarrow$ Ketua Umum).
   - Graduates or steps down to alumni (`status_organisasi: active` $\rightarrow$ `inactive`).
   - Re-joins active duty after an absence.
   - Changes legal name or display username.
   - Changes or re-links login authentication methods.
2. **Never Reassigned or Recycled:**  
   If `PTV-015` departs or graduates, `PTV-015` is never reassigned to a new recruit. It remains forever linked to historical transaction logs, equipment passes, and signatures.
3. **Institutional Root Exception:**  
   `PTV-ROOT` is an institutional, system-owned identifier reserved for emergency overrides and automated operations. It is not owned by any individual.

---

## 4. Organization Membership Model

An Identity represents a person; an **Organization Membership** represents their relationship with PTV Studio during a specific timeframe.

### 4.1 Hierarchy & Divisions

In accordance with [PTV-HUB-FINAL-DATABASE-AUTH-CONTRACT.md (Section 3)](file:///c:/Users/zidna/ptvpro/docs/PTV-HUB-FINAL-DATABASE-AUTH-CONTRACT.md#L67-L104):

```
PTV Studio Organization
├── Leadership
│   ├── Ketua Umum
│   ├── Sekretaris & Bendahara
│   └── Koor Operasional
│
├── Technical & Creative Divisions
│   ├── Technical Division    (Camera, audio, live stream, equipment maintenance)
│   ├── Editor Division       (Post-production, grading, archiving)
│   ├── Layouter Division     (Lower thirds, stream overlays, publication)
│   ├── Creative Division     (Pre-production, scriptwriting, concept)
│   └── Engagements Division  (Public relations, media liaisons)
│
└── Institutional Advisory
    ├── Pembina               (Pesantren leadership & foundation patron)
    └── Pengarah              (Institutional advisor)
```

### 4.2 Divisional Roles & Inventory Custody
- Every technical and creative division has exactly:
  - `Ketua Divisi` (Division Lead)
  - `Anggota Divisi` (Staff / Crew)
- Special operational duties (`PJ Sosmed`, `PJ Website`) are functional task designations, not separate organizational divisions.
- **Authoritative Inventory Rule:**  
  There is **NO** separate `PJ Inventaris` organizational role. Inventory custody and equipment maintenance belong directly to the **Technical Division Leadership (`Ketua Technical`)**.

### 4.3 Membership History & Transitions
A member's organizational record is decoupled from their identity:
- When a member transitions from `Ketua Divisi` to `Anggota` or `Alumni`, their identity `id` and `ptv_id` remain identical.
- Past equipment checkout logs point to `identity_id` (`ptv_id`), preserving an unbroken audit trail regardless of division changes.

---

## 5. Account Model

The **Account** represents an identity's credentials and standing to authenticate into the software system.

```
┌────────────────────────────────────────────────────────┐
│                      USER ACCOUNT                      │
│  - account_id: UUID                                    │
│  - identity_id: UUID (Foreign Key to Canonical Identity)│
│  - username: String (Unique handle, e.g. "farsya")     │
│  - status_akun: ['active', 'inactive']                 │
│  - failed_login_attempts: Integer                      │
│  - lockout_until: Timestamp (Nullable)                 │
│  - last_login_at: Timestamp                            │
│  - last_login_ip: String                               │
└────────────────────────────────────────────────────────┘
```

### 5.1 Account Principles
- **Identity $\neq$ Account:** An identity can exist in the historical registry without an active software account (e.g. historical alumni from early pesantren cohorts who do not access the web application).
- **One Active Account per Identity:** Within PTV PRO, each canonical identity maps to at most one system account.
- **Account Disablement:** Suspending an account sets `status_akun = 'inactive'`. This rejects login attempts instantly without corrupting the member's historical identity, digital signatures, or past logs.

---

## 6. Authentication Methods

The Super App architecture accommodates multiple login methods converging on the single Account.

```
                  ┌───────────────────────────────┐
                  │      Incoming Credentials     │
                  └───────────────┬───────────────┘
                                  │
     ┌────────────────────────────┼────────────────────────────┐
     ▼                            ▼                            ▼
[ Username + Password ]   [ PTV ID + Password ]     [ Google OAuth SSO ]
     │                            │                            │
     │ Resolves account           │ Resolves identity          │ Resolves account
     │ by username                │ by ptv_id                  │ by linked email
     └────────────────────────────┼────────────────────────────┘
                                  ▼
                     [ Verify Password Hash ]
                     (Bcrypt $2y$/$2b$, cost >= 10)
                                  │
                                  ▼
                     [ Gate: status_akun == 'active' ]
                     ├── No  ──► REJECT: "Akun nonaktif"
                     └── Yes ──► ISSUE SESSION
```

### 6.1 Authentication Method Registry

| Method | Primary Identifier | Credential Storage | Unlinking / Recovery | Audit Requirement |
| :--- | :--- | :--- | :--- | :--- |
| **Username + Password** | `account.username` | Bcrypt hash (`$2y$` / `$2b$`, cost $\ge 10$) in auth vault | Reset via Executive override or verified email | Record IP, User-Agent, and timestamp in `ptv_login_history` |
| **PTV ID + Password** | `identity.ptv_id` | Verifies against linked account password hash | Same as above | Record `actor_ptv_id` in audit log |
| **Google OAuth SSO** | Linked Google Email | Provider ID & verified email in Supabase Auth | Account linking/unlinking requires active password confirmation | Log Google OAuth provider subject ID |
| **WebAuthn / Passkeys** | FIDO2 Credential ID | *Deferred to future phase* | *Deferred* | *Deferred* |

### 6.2 Credential Protection
- Password hashes are **never returned** by standard database `SELECT` queries.
- Hashing and verification are executed inside Supabase Auth or secure PostgreSQL stored procedures utilizing `pgcrypto` (`crypt(password, password_hash)`).

---

## 7. Orthogonal Status Model & Lifecycle

Organizational standing and system authentication status are strictly orthogonal:

```
status_organisasi: ['active', 'inactive', 'archived']
status_akun:       ['active', 'inactive']
```

### 7.1 Authoritative Lifecycle Matrix

| Combination | `status_akun` | `status_organisasi` | Portal Access & Behavioral Contract |
| :--- | :--- | :--- | :--- |
| **Active Crew** | `active` | `active` | **Full Normal Access:** Authenticates normally. Executes all read, create, edit, delete, and checkout permissions granted by assigned profile and overrides. |
| **Alumni (Read-Only)** | `active` | `inactive` | **Alumni Read-Only Mode:** Permitted to authenticate. **All 32 mutation capabilities are blocked at the policy layer.** Access is strictly limited to viewing past schedules, permitted personal archives, and profile. |
| **Suspended Account** | `inactive` | `active` / `inactive` | **Login Blocked:** Authentication attempt rejected at gate (*"Akun nonaktif. Silakan hubungi Eksekutif PTV"*). Historical records and digital signatures remain intact. |
| **Archived Identity** | `inactive` | `archived` | **Archived Relic:** Authentication permanently disabled. Retained strictly for foreign-key relational integrity, document verification audits, and historical ledgers. Identity is **never deleted**. |

---

## 8. System Access & Profile Assignments

Access Profiles represent institutional capability bundles assigned to Accounts.

### 8.1 Canonical Access Profiles (The Five Profiles)

```
1. root_executive : Institutional system-owned account (PTV-ROOT). All 53 capabilities.
2. eksekutif      : Leadership operational control across all views (51 capabilities).
3. kepolo_kepali  : Operational supervisors & crew leads (37 capabilities).
4. crew           : Active operational crew, videographers, editors (24 capabilities).
5. pembina        : Institutional advisors, pesantren leadership (10 capabilities).
```

### 8.2 Granular Capability Overrides
Every user record supports two override arrays:
- `allowed_overrides: AppCapability[]`: Explicitly grants capabilities beyond the default profile.  
  *Authoritative Example:* User `PTV-023` (*Farsya*) has profile `crew` plus `allowed_overrides = ['finance.operator']`.
- `denied_overrides: AppCapability[]`: Explicitly revokes specific capabilities from an account, taking precedence over default profile permissions.

---

## 9. Policy Integration Flow

The application maintains strict unidirectional evaluation from authentication to action:

```
[ User Action / Route Request ]
              │
              ▼
    1. Authenticated Identity ("Who are you?")
       - Resolves identity (id, ptv_id, full_name)
              │
              ▼
    2. Account Status Gate
       - Checks user.status_akun === 'active'
       - If inactive ──► HALT (Fail-Closed)
              │
              ▼
    3. Organization Standing Gate
       - Checks user.status_organisasi
       - If 'inactive' and action is Mutation ──► REJECT (Alumni Read-Only)
              │
              ▼
    4. Granular Policy Resolution
       - Evaluates hasCapability(user, targetCapability)
       - Order: Deny Overrides ──► Allow Overrides ──► Profile Capabilities
              │
              ▼
       [ Allow Action / Render UI ]
```

---

## 10. Session Architecture

### 10.1 Pipeline: Canonical Auth $\rightarrow$ Session State $\rightarrow$ Policy Context

```
┌────────────────────────────────────────────────────────┐
│               CANONICAL AUTHENTICATION                 │
│  - Supabase Auth JWT / Secure HTTP-Only Cookie         │
│  - Lifetime: 72 Hours (259,200 seconds)                │
│  - Payload: sub (UUID), ptv_id, role, exp              │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│                  AUTH ADAPTER LAYER                    │
│  - Interface: IAuthService                             │
│  - In Local Dev: LocalMockAuthService                  │
│  - In Production: SupabaseAuthService                  │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│            CLIENT APPLICATION SESSION STATE            │
│  - Zustand Store (useSessionStore)                     │
│  - Ephemeral client-side session container             │
│  - Exposes can(capability) helper calling Policy Engine│
└────────────────────────────────────────────────────────┘
```

### 10.2 Session Invalidation Rules
- **Explicit Logout:** Clears local tokens, resets Supabase client state, redirects to `/login`.
- **Administrative Suspension:** Setting `status_akun = 'inactive'` in the database immediately causes subsequent server RPCs and token refreshes to fail closed.
- **Credential Rotation:** Updating a password increments a token generation timestamp, invalidating all outstanding sessions.

---

## 11. Legacy `ptv_kru` Mapping Matrix

This section establishes the definitive field-by-field mapping from the legacy MySQL table `$wpdb->ptv_kru` (and its mirrored Supabase table) to the new normalized identity and auth model:

| Legacy `ptv_kru` Column | Legacy Type | Target Entity & Column | Transformation Strategy | Classification |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `BIGINT` | `canonical_identity.legacy_id` | Preserved as integer reference for historical relational backfill; new primary key is `UUID`. | **Historical Reference** |
| `crew_id` | `VARCHAR(16)`| `canonical_identity.ptv_id` | Transferred verbatim (e.g. `PTV-001`, `PTV-025`). Permanent immutable identifier. | **Retained (Core Key)** |
| `nama` | `VARCHAR(255)`| `canonical_identity.full_name`| Cleaned display name. | **Retained** |
| `username` | `VARCHAR(64)` | `user_account.username` | Lowercased unique login handle. | **Transformed** |
| `password_hash` | `VARCHAR(255)`| `auth_credentials.password_hash` | Bcrypt hash transferred verbatim; valid without user password resets. | **Transformed** |
| `oauth_email` | `VARCHAR(128)`| `auth_credentials.oauth_email` | Transferred to OAuth linked credentials layer. | **Transformed** |
| `telepon` / `no_wa` | `VARCHAR(32)` | `identity_contact.phone_wa` | Moved to protected contact table; isolated from public APIs. | **Transformed** |
| `email` | `VARCHAR(128)`| `identity_contact.email_personal`| Personal email moved to protected contact table. | **Transformed** |
| `divisi` | `VARCHAR(64)` | `organization_membership.division` | Normalized to standard division names (`Technical`, `Editor`, etc.). | **Transformed** |
| `jabatan` | `VARCHAR(64)` | `organization_membership.position` | Normalized to standard titles (`Ketua`, `Anggota`, etc.). | **Transformed** |
| `angkatan` | `INT` | `organization_membership.angkatan` | Preserved as cohort/academic year integer. | **Retained** |
| `role` | `VARCHAR(32)` | `user_account.assigned_profiles` | Mapped to canonical profile: `admin`/`eksekutif` $\rightarrow$ `eksekutif`; `kepolo` $\rightarrow$ `kepolo_kepali`; `crew` $\rightarrow$ `crew`; `pembina` $\rightarrow$ `pembina`. | **Transformed** |
| `status` | `VARCHAR(32)` | `status_organisasi` & `status_akun` | Split: `aktif` $\rightarrow$ `(active, active)`; `alumni` $\rightarrow$ `(inactive, active)`; `nonaktif` $\rightarrow$ `(inactive, inactive)`. | **Transformed (Split)** |
| `display_order` | `INT` | `organization_membership.display_rank` | Optional sort order within divisional roster. | **Historical-Only** |
| `foto_url` | `TEXT` | `canonical_identity.avatar_url` | Transferred to avatar storage. | **Retained** |
| `created_at` | `DATETIME` | `canonical_identity.created_at` | Preserved timestamp. | **Retained** |

---

## 12. Legacy Coexistence Strategy

During the transitional migration phase, the legacy production dashboard (`progresiftv.id/dasbor`) remains active and operational while PTV PRO (`/hub`) runs alongside it.

```
   [ Legacy Live Production ]                     [ Target PTV PRO ]
  https://progresiftv.id/dasbor                 https://ptvpro.com/hub
               │                                           │
               │ (Authenticates against)                   │ (Authenticates against)
               ▼                                           ▼
       ┌───────────────────────────────────────────────────────────┐
       │                SUPABASE CLOUD POSTGRESQL                  │
       │                 SINGLE SOURCE OF TRUTH                    │
       │                                                           │
       │  - canonical_identity (id, ptv_id, full_name)             │
       │  - organization_membership (division, status_organisasi)  │
       │  - user_account (username, status_akun, profiles)         │
       │  - auth_credentials (bcrypt password_hash)                │
       └─────────────────────────────┬─────────────────────────────┘
                                     │ (Read-only backward compat view)
                                     ▼
                       [ VIEW: ptv_kru_legacy_compat ]
```

### 12.1 Identity Reconciliation Protocol
1. **Zero Duplicate Identity Guarantee:** A person who is `PTV-025` in legacy `ptv_kru` has exactly **ONE** canonical identity row in Supabase. PTV PRO will never generate a separate identity record for an existing crew member.
2. **Backward Compatible View:** Supabase maintains a PostgreSQL view `ptv_kru_legacy_compat` that presents the flattened schema required by legacy PHP scripts (`admin-ajax.php` / `$wpdb`), reading directly from the normalized identity tables.
3. **Coexistent Password Verification:** Because standard Bcrypt (`$2y$` / `$2b$`) is used in both systems, a password updated in one system is immediately valid in the other.

---

## 13. Security Requirements

1. **Password Hashing:** Standard Bcrypt with minimum cost 10. SHA-1 or MD5 hashes are prohibited.
2. **Brute Force Defense:** Accounts with 5 consecutive failed login attempts within 15 minutes are locked for 15 minutes (`lockout_until`).
3. **Fail-Closed Gate:** An unauthenticated, expired, or suspended session fails closed across all routes and API functions.
4. **Audit Trail Logging:** Every login attempt inserts a row into `ptv_login_history`:
   ```sql
   INSERT INTO ptv_login_history (
     identity_id, ptv_id, ip_address, user_agent, status, login_at
   );
   ```
5. **PII Sanitization:** Public verification endpoints (`/verify/id/:code`, `/verify/doc/:number`) must execute database queries through security definer functions that omit phone numbers, personal emails, and password hashes from the returned payload.

---

## 14. Root Executive: Institutional Account Governance

1. **System Ownership:** `PTV-ROOT` is an institutional account owned by PTV Studio, not by any developer or individual.
2. **UI Deletion Protection:** The application UI completely disables edit/delete/suspend actions targeting `PTV-ROOT`.
3. **Auditing Rigor:** Every mutation performed under `PTV-ROOT` is logged to `ptv_audit_logs` with forensic client IP and browser fingerprint.
4. **Policy Engine Conformance:** `PTV-ROOT` does not use hardcoded bypasses (`if (root) return true`). It resolves capabilities strictly through the canonical capability engine, allowing security policies to explicitly revoke specific capabilities via `denied_overrides` if required.

---

## 15. Data Ownership Matrix

| Data Entity | Conceptual Owner | Administrative Authority |
| :--- | :--- | :--- |
| **Canonical Identity** | Pesantren Progresif / PTV Studio | Institutional ownership; immutable core keys |
| **Organization Membership** | PTV Studio Executive Leadership | `Ketua Umum` & `Sekretaris` assign divisions & titles |
| **User Account** | PTV Studio Administration | Root & Eksekutif activate/suspend accounts |
| **Authentication Credentials** | Individual Account Holder | Holder updates password; Executive handles recovery |
| **Roles & Capabilities** | Root & Eksekutif Leadership | Administered via `crew.permissions.manage` |
| **Active Session** | Client Runtime (Ephemeral) | Invalidated upon logout or server token revocation |
| **Audit & Forensic Logs** | PTV Institutional Archive | Immutable, append-only; readable by Root/Eksekutif |

---

## 16. Migration Principles

1. **PTV ID Invariance:** Legacy `crew_id` values transfer 1:1 into canonical `ptv_id`.
2. **Zero Password Reset Cutover:** Legacy Bcrypt password hashes are migrated verbatim, allowing crew to log in immediately without forced password resets.
3. **Decoupled Status Initialization:**
   - Legacy `aktif` $\rightarrow$ `status_organisasi = 'active'`, `status_akun = 'active'`.
   - Legacy `alumni` $\rightarrow$ `status_organisasi = 'inactive'`, `status_akun = 'active'`.
   - Legacy `nonaktif` $\rightarrow$ `status_organisasi = 'inactive'`, `status_akun = 'inactive'`.
4. **Exception Deprecation:** User `PTV-023` (*Farsya*) receives standard `crew` profile plus explicit `allowed_overrides = ['finance.operator']`.

---

## 17. Open Questions / NEEDS DECISION

The following architectural questions are formally cataloged for resolution prior to Phase 5 database migration execution:

| ID | Topic | Question / Issue | Architectural Recommendation |
| :--- | :--- | :--- | :--- |
| **ND-001** | **Multi-Organization Schema Depth** | Should Phase 5 implement a fully normalized 1:N table `ptv_organization_membership` immediately, or begin with normalized columns on the user record and a transition history table? | Implement normalized 1:N membership table immediately to future-proof foundation multi-studio asset management. |
| **ND-002** | **Historical Legacy Passwords Audit** | Are 100% of password hashes in legacy production `ptv_kru` encoded with Bcrypt (`$2y$` / `$2b$`), or do older historical rows (2020-2022) contain legacy MD5 or WordPress phpass hashes requiring automatic rehash-on-login? | Run a read-only schema inspection on MySQL during Phase 5 preparation to confirm hash prefixes. |
| **ND-003** | **Self-Service Contact Updates** | Should standard Crew members have permission to self-update their personal WhatsApp number and email without division lead approval? | Yes, self-service contact update should be permitted for own profile under `settings.personal`, while division and title remain gated by `crew.edit`. |

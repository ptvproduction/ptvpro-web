# PTV PRO SUPER APP — MASTER PROJECT ARCHITECTURE

**System:** PTV PRO Super App  
**Primary Initial Target:** PTV Hub (`/hub`)  
**Target Repository:** `ptvpro` (`C:\Users\zidna\ptvpro`)  
**Authoritative Backend Contract:** [PTV-HUB-FINAL-DATABASE-AUTH-CONTRACT.md](file:///c:/Users/zidna/ptvpro/docs/PTV-HUB-FINAL-DATABASE-AUTH-CONTRACT.md)  
**Status:** Canonical Architecture Specification  
**Version:** 1.0.0 (October 2026)  

---

## Table of Contents

1. [Super App Architecture](#1-super-app-architecture)
2. [PTV Hub Architecture](#2-ptv-hub-architecture)
3. [Route Architecture](#3-route-architecture)
4. [Authentication & Identity Architecture](#4-authentication--identity-architecture)
5. [Authorization & Policy Engine](#5-authorization--policy-engine)
6. [Data Access Architecture](#6-data-access-architecture)
7. [Realtime Architecture](#7-realtime-architecture)
8. [Sensitive Data Boundaries](#8-sensitive-data-boundaries)
9. [UI & UX Component Architecture](#9-ui--ux-component-architecture)
10. [Legacy Migration Boundaries](#10-legacy-migration-boundaries)
11. [Future Extensibility & Product Isolation](#11-future-extensibility--product-isolation)
12. [Project Directory Structure](#12-project-directory-structure)
13. [Technology Stack Decisions](#13-technology-stack-decisions)
14. [Authoritative Architectural Principles](#14-authoritative-architectural-principles)

---

## 1. Super App Architecture

### 1.1 Conceptual Model

PTV PRO is the digital super app ecosystem of **Pesantren Progresif**, engineered to serve multiple distinct organizational domains, user personas, and public services under a single unified platform. 

Rather than building an unstructured dashboard that combines unrelated features into an ad-hoc codebase, PTV PRO employs a **Modular Super App Architecture**. 

> [!IMPORTANT]
> **Unified Application Model:**
> The initial PTV PRO implementation is **ONE application, ONE codebase, and ONE deployment**. Micro-frontend decomposition is strictly a future optional evolution only. Within this unified application, strict module boundaries decouple distinct products (Hub, Asset, Bio, Event, Verification) from becoming a tangled monolith.

In this architecture:
- Each product functions as an **independent domain module** with its own routes, views, business logic, data models, and authorization scopes.
- All products share **core infrastructure** for cross-cutting concerns: identity, session management, telemetry, base design primitives, and network transport.

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                   PTV PRO SUPER APP                                    │
│                              (Host Shell & Shared Core)                                │
├────────────────────────────────────────────────────────────────────────────────────────┤
│  Shared Infrastructure:                                                                │
│  - Identity & Multi-Method Auth Session    - Base Design Primitives & Theming Token    │
│  - Centralized Supabase Client             - Unified WebSocket Event Bus               │
│  - Shared Validation & Error Handling      - Platform Router & Global Navigation       │
├──────────────┬──────────────┬──────────────┬──────────────┬──────────────┬─────────────┤
│   PTV Hub    │    Asset     │   BSH Bio    │    Event     │ Verification │   Future    │
│  (Internal   │ (Foundation  │   (Public    │  (Ticketing  │   (Public    │  Services   │
│   Studio     │   Hardware   │   Santri     │ & Production │  Credential  │             │
│  Operations) │  Inventory)  │  Directory)  │  Portals)    │  Auditing)   │             │
├──────────────┴──────────────┴──────────────┴──────────────┴──────────────┴─────────────┤
│                       AUTHORITATIVE SUPABASE CLOUD (PostgreSQL)                        │
│   - PostgreSQL Row Level Security (RLS)        - ACID Stored Procedures (RPCs)         │
│   - Realtime Changefeed Publication            - Hardened Vault & Storage              │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Product Boundaries & Responsibilities

| Product | Audience | Purpose | Security Domain | Route Root |
| :--- | :--- | :--- | :--- | :--- |
| **PTV Hub** | PTV Crew, Supervisors, Executives, Pembina | Daily studio operations, scheduling, equipment checkout, damage tickets, internal records, studio finance | Internal Private (53 Capabilities, Profile-based, High Isolation) | `/hub` |
| **Asset** | Foundation Assets Team, Logistics Staff | Master physical equipment across Yayasan institutions (studios, classrooms, media labs) | Institutional Private (Asset Role-based) | `/asset` |
| **BSH Bio** | Santri, Parents, Public Visitors | Biodata, student portfolio, educational activity bio | Public / Semi-Private (Identity lookup & sanitized profiles) | `/bio` |
| **Event** | Event Attendees, Committees | Production scheduling, registration, haul broadcasts, ticketing | Hybrid Public & Committee | `/event` |
| **Verification** | Public Third-Parties, Security, Verifiers | Cryptographic & public ID card validation, formal letter verification via printed QR | Public Read-Only (Zero Authentication, Sanitized View) | `/verify` |

### 1.3 Super App Architectural Tenets

1. **Strict Product Boundary Isolation:**  
   Code in `src/products/hub` must never directly import internal feature logic, components, or stores from `src/products/asset` or `src/products/bio`. Products communicate strictly through shared platform APIs (`src/core/*`) or decoupled routing.
2. **Shared Identity, Product-Scoped Authorization:**  
   A user authenticates once with their PTV ID or linked credential. However, having an account does not imply access to every product. Access to PTV Hub is governed by `hub.access`, while access to Asset or Event management is governed by separate product-specific policy gates.
3. **Independent Lifecycle & Gradual Rollout:**  
   PTV Hub is the primary and first implementation target. The architecture allows PTV Hub to be developed, validated, and launched into production without waiting for BSH Bio or Event services to be implemented.
4. **Autonomous Design Languages within Global Shell:**  
   While shared UI primitives (buttons, inputs, glassmorphic surfaces, badges, modals) exist in `src/shared/ui`, each product maintains its specialized layouts and workflows without polluting the base system.

---

## 2. PTV Hub Architecture

### 2.1 Internal Modular Organization

PTV Hub is the core operational product inside PTV PRO. It encapsulates 22 distinct functional views and workflows derived from the legacy operational system (`page-dasbor.php`). 

To eliminate the legacy anti-pattern of an unmaintainable multi-thousand-line monolithic script, PTV Hub is structured into **Feature Domain Modules**:

```
src/products/hub/
├── components/          # Hub-specific layout (Sidebar, Mobile Header, Status Pill)
├── hooks/               # Hub-level context hooks (useHubAuth, useHubRealtime)
├── routes.tsx           # Hub routing definition and guard tree
└── modules/             # Distinct functional modules
    ├── overview/        # Beranda (Studio health, quick actions, agenda summary)
    ├── events/          # Acara (Event lifecycle, technical rundown, crew roster)
    ├── calendar/        # Kalender (Interactive monthly/weekly production grid)
    ├── inventory/       # Inventaris & Nilai (Master gear, units, purchase valuation)
    ├── loans/           # Peminjaman (Borrow baskets, checkouts, returns, scans)
    ├── damage/          # Kerusakan (Incident ticketing, 4-stage QC pipeline)
    ├── lostfound/       # Lost & Found (Missing items registry, return claims)
    ├── crew/            # Kru (Roster, profile, angkatan, account lifecycle)
    ├── id-card/         # ID Digital (Interactive preview, QR code, SVG/PNG export)
    ├── documents/       # Dokumen Saya, Perizinan, Generator Izin, Arsip Master
    ├── contacts/        # Kontak Internal (Crew phonebook) & Eksternal (Vendors)
    ├── finance/         # Keuangan (Pemasukan, Pengeluaran, Kas Kru, Vouchers)
    ├── broadcast/       # Broadcast (Alert dispatch, Web Push, audio chimes)
    ├── projecthaul/     # Project Haul (Haul Akbar stream coordination & rundowns)
    ├── notes/           # Catatan (Operational scratchpad, manual save protocol)
    └── settings/        # Pengaturan (Personal preferences, theme, notification test)
```

### 2.2 Implementation Strategy: Sequential Vertical Slices

Defining module boundaries upfront establishes architectural decoupling and prevents circular imports; it does **NOT** mean implementing all 16 modules at once. 

Implementation must proceed strictly through disciplined **vertical slices**, validating foundational security and shell integration before building operational features:

$$\mathbf{Auth} \longrightarrow \mathbf{Policy} \longrightarrow \mathbf{Hub\ Shell} \longrightarrow \mathbf{Beranda} \longrightarrow \mathbf{Kru}$$

1. **Slice 1: Auth (Authentication & Session Lifecycle):** Session persistence, login flow, token storage, and account status guards (`status_akun`).
2. **Slice 2: Policy (Authorization Engine):** The 53 capability matrix, 5 access profiles, and deterministic `hasCapability()` resolution algorithm.
3. **Slice 3: Hub Shell (Layout & Navigation):** Atmospheric Azure Glassmorphism shell, sidebar navigation, capability-gated menu filtering, and mobile bottom drawer.
4. **Slice 4: Beranda (Operational Overview):** Studio metrics, upcoming agenda cards, quick actions, and realtime notification banner.
5. **Slice 5: Kru (Personnel & Directory):** Crew roster, cohort (`angkatan`) filtering, profile view, and digital credential inspectors.

Subsequent modules (Events, Calendar, Inventory, Loans, Damage, Finance, etc.) will be implemented in subsequent prioritized vertical slices only after this foundational core is verified.

### 2.3 Module Boundaries & Dependency Hierarchy

To prevent circular dependencies and tangled imports, PTV Hub enforces strict directional layering:

```
┌─────────────────────────────────────────────────────────────┐
│                    UI Layer (Views & Pages)                 │
│  - Renders forms, tables, modals, cards                     │
│  - Consumes hooks; ZERO direct database or Supabase calls   │
└──────────────────────────────┬──────────────────────────────┘
                               │ invokes
                               ▼
┌─────────────────────────────────────────────────────────────┐
│             Feature Hooks & State Controllers               │
│  - Manages view state, filters, sorting, local modal state  │
│  - Encapsulates queries and mutations via Service Layer     │
└──────────────────────────────┬──────────────────────────────┘
                               │ calls
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                 Hub Module Service Layer                    │
│  - Business logic, validation schemas (Zod)                 │
│  - Transaction orchestration                                │
│  - Client-side policy assertions (canUser)                  │
└──────────────────────────────┬──────────────────────────────┘
                               │ invokes
                               ▼
┌─────────────────────────────────────────────────────────────┐
│              Data Access Layer & Supabase RPCs              │
│  - Typed queries to public tables                           │
│  - PostgreSQL Stored Procedure invocations (RPC)            │
│  - Centralized error normalization                          │
└─────────────────────────────────────────────────────────────┘
```

### 2.4 Module Interactions & Anti-Coupling Rules

1. **Shared Entities via Master Tables:**  
   `inventory` and `loans` interact through standard database relations (`ptv_inventaris_unit` $\leftrightarrow$ `ptv_peminjaman`), not by calling each other's UI components.
2. **Cross-Module Deep-Linking:**  
   When navigating from `Beranda` to a specific loan record, navigation occurs through deterministic URLs (`/hub/peminjaman?trx=TRX-1024`) or query params, not internal component event emitters.
3. **Documents and Generator Separation:**  
   `documents` contains personal records and archives. Document generation wizards (`Generator Izin`) run in a dedicated submodule that submits to atomic RPC `rpc_submit_official_doc`.

---

## 3. Route Architecture

### 3.1 Design Philosophy: Deterministic URL Hierarchy

The legacy dashboard used URL hash navigation (`/dasbor#acara`, `/dasbor#pinjam`) which prevented direct linking, disrupted browser back/forward history, and broke deep-linking in notifications.

PTV PRO adopts a **clean, path-based hierarchical routing structure** with built-in route guards and layout nesting.

### 3.2 Master Route Tree

```
/                                      # Root landing / Super App product chooser
├── /login                             # Unified Universal Login Portal
├── /auth/callback                     # OAuth redirect & session exchange handler
│
├── /hub                               # PTV Hub Shell (Auth Guarded + Hub Access Guard)
│   ├── /hub                           # Redirects to /hub/beranda
│   ├── /hub/beranda                   # Beranda (Operational Overview)
│   ├── /hub/acara                     # Acara (Event Directory)
│   │   ├── /hub/acara/baru            # Event Creator Wizard
│   │   └── /hub/acara/:id             # Event Detail & Rundown Editor
│   ├── /hub/kalender                  # Kalender (Interactive Production Grid)
│   ├── /hub/inventaris                # Inventaris (Master Catalog & Units)
│   │   ├── /hub/inventaris/:id        # Gear Detail & Barcode/Serial List
│   │   └── /hub/inventaris/nilai      # Nilai Inventaris (Valuation, Strict Guard)
│   ├── /hub/peminjaman                # Peminjaman (Checkout Desk & Logs)
│   ├── /hub/kerusakan                 # Kerusakan & QC Repair Tracking
│   ├── /hub/lostfound                 # Lost & Found Directory
│   ├── /hub/kru                       # Kru Directory & Cohort Rosters
│   │   └── /hub/kru/:ptvId            # Crew Profile View & Capability Inspector
│   ├── /hub/id                        # Digital ID Card Generator & QR
│   ├── /hub/dokumen                   # Dokumen Saya (Personal letters & tasks)
│   ├── /hub/perizinan                 # Perizinan (Permit request workflow)
│   ├── /hub/generator-izin            # Generator Izin (ST/SI/SBB Numbering Wizard)
│   ├── /hub/arsip                     # Master Document Archives
│   ├── /hub/kontak                    # Kontak Internal (Crew Phonebook)
│   ├── /hub/kontak-eksternal         # Kontak Eksternal (Vendor Directory)
│   ├── /hub/keuangan                  # Keuangan (Ledgers, Cash Book, Vouchers - Strict Guard)
│   ├── /hub/broadcast                 # Broadcast Studio Alerts & Push Dispatch
│   ├── /hub/project-haul              # Project Haul Mission Control
│   ├── /hub/catatan                   # Notulensi & Production Scratchpad
│   ├── /hub/pengaturan                # Settings & Audio Chime Diagnostics
│   └── /hub/audit                     # Audit & Forensic Access Logs (Executive Guard)
│
├── /asset                             # Future Asset Service (Asset Auth Guard)
│   ├── /asset/yayasan                 # Private Foundation Assets (page-assetyayasan.php migration)
│   └── /asset/publik                  # Public Assets Catalog (page-assetpublik.php migration)
│
├── /bio                               # Future BSH Bio Service
│   └── /bio/:santriId                 # Public/Semi-Private Santri Profile
│
├── /event                             # Future Event & Haul Public Portals
│   └── /event/:slug                   # Public Event Landing & Stream
│
└── /verify                            # Public Verification Subsystem (ZERO AUTH REQUIRED)
    ├── /verify/id/:code               # Digital ID Card Verification (page-verifikasi-identitas.php)
    └── /verify/doc/:number            # Official Document Verification (page-verifikasi-surat.php)
```

### 3.3 Route Guard Hierarchy

Every route in the Super App passes through a cascading security barrier:

```
[ Incoming Request URL ]
           │
           ▼
┌──────────────────────────────────────┐
│       1. Global Session Guard        │──(No Active Session)──► Redirect to /login
│  Checks Supabase JWT validity        │
└──────────────────┬───────────────────┘
                   │ Session Valid
                   ▼
┌──────────────────────────────────────┐
│       2. Account Status Guard        │──(status_akun != 'active')──► Show "Account Suspended"
│  Checks user.status_akun == 'active' │
└──────────────────┬───────────────────┘
                   │ Active Account
                   ▼
┌──────────────────────────────────────┐
│       3. Product Access Guard        │──(Lacks hub.access)──► Show "403 Forbidden" Screen
│  Checks capability for current root  │
└──────────────────┬───────────────────┘
                   │ Access Allowed
                   ▼
┌──────────────────────────────────────┐
│      4. Granular Feature Guard       │──(Lacks capability)──► Show "Access Restricted"
│  Checks specific action capability   │                        (e.g., finance.view)
└──────────────────┬───────────────────┘
                   │ Authorized
                   ▼
       [ Render Target Page ]
```

---

## 4. Authentication & Identity Architecture

### 4.1 Authoritative Identity Model

In alignment with [PTV-HUB-FINAL-DATABASE-AUTH-CONTRACT.md (Section 2)](file:///c:/Users/zidna/ptvpro/docs/PTV-HUB-FINAL-DATABASE-AUTH-CONTRACT.md#L24-L65), the identity layer separates **who a person is** from **how they authenticate** and **their organizational position**.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        CANONICAL USER IDENTITY                         │
│  - id: UUID (Immutable Primary Key)                                    │
│  - ptv_id: String ("PTV-xxx") [PERMANENT INSTITUTIONAL IDENTIFIER]      │
│  - full_name: String                                                   │
│  - avatar_url: String (Nullable)                                       │
│  - created_at: Timestamp                                               │
└───────────────────┬────────────────────────────────┬───────────────────┘
                    │                                │
                    ▼                                ▼
┌──────────────────────────────────────┐ ┌───────────────────────────────┐
│        AUTHENTICATION METHODS        │ │   ORGANIZATION MEMBERSHIPS    │
│  - username (e.g. "zidna")           │ │  - organization: "PTV Studio" │
│  - bcrypt_password_hash              │ │  - status_organisasi:         │
│  - linked_oauth_google_email         │ │    ['active','inactive',      │
│  - future_webauthn_credentials       │ │     'archived']               │
│  - status_akun: ['active','inactive']│ │  - division: "Technical"      │
│  - last_login_at: Timestamp          │ │  - position: "Ketua"          │
│  - last_login_ip: String             │ │  - angkatan: 2024             │
└──────────────────────────────────────┘ └───────────────────────────────┘
```

### 4.2 Rules of Identity

1. **PTV ID is Permanent and Immutable:**  
   The identifier `ptv_id` (`PTV-001`, `PTV-025`) is permanent. It is never reused, reissued, or modified when a member changes divisions, steps down, or graduates.
2. **Email is NOT the Permanent Identity Key:**  
   Email addresses (`@ptvpro.com` or personal Gmail) are communication coordinates and login methods, not identity anchors. Primary database references use `UUID` or `ptv_id`.
3. **Separation of Account Status and Organization Status:**  
   - `status_akun`: Governs system access. If `inactive`, login is rejected immediately.
   - `status_organisasi`: Governs organizational standing. An alumni member may have `status_akun = 'active'` and `status_organisasi = 'inactive'`. This grants **read-only alumni portal access** while revoking all mutations.

### 4.3 Multi-Method Authentication Flow

```
[ User Arrives at /login ]
           │
     Selects Method
     ┌─────┴─────────────────────────────────┐
     ▼                                       ▼
[ PTV ID / Username + Password ]     [ Google OAuth SSO ]
     │                                       │
     ▼                                       ▼
Validate via Supabase Auth           Exchange OAuth code
or Custom Auth RPC                   via Supabase Auth
     │                                       │
     └───────────────────┬───────────────────┘
                         ▼
             [ Verify Account Status ]
             Query: status_akun == 'active'?
              ├── No  ──► Abort & Display "Akun nonaktif"
              └── Yes ──► Continue
                         ▼
             [ Load Canonical Identity & Profile ]
             - Resolve Access Profiles
             - Resolve Allowed & Denied Overrides
             - Populate User Context
                         ▼
             [ Establish Session (72h Expiry) ]
             Store Secure JWT in httpOnly Cookie / Secure Storage
                         ▼
             [ Record Audit Log ]
             Insert into ptv_login_history (IP, User Agent, Timestamp)
                         ▼
             [ Redirect to Intended Product Route ]
```

### 4.4 Session Invalidation & Termination

- **Session Duration:** 72 Hours (259,200 seconds), mirroring legacy session life.
- **Explicit Logout:** Clears local tokens, resets Supabase client state, clears user memory stores, and redirects to `/login`.
- **Administrative Suspension:** Setting `status_akun = 'inactive'` immediately invalidates session validation on subsequent server/RPC requests.

---

## 5. Authorization & Policy Engine

### 5.1 The 53 Capability Matrix

PTV PRO adopts the **53 Granular Capabilities** defined in [PTV-HUB-FINAL-DATABASE-AUTH-CONTRACT.md (Section 6)](file:///c:/Users/zidna/ptvpro/docs/PTV-HUB-FINAL-DATABASE-AUTH-CONTRACT.md#L149-L210), structured into domain, resource, and action (`domain.resource.action`).

```
Domains:
- hub.*           : Portal entry access
- events.*        : Production events, schedules, and rundowns
- calendar.*      : Production grid views
- inventory.*     : Gear catalog, unit serials, and capital valuation
- loans.*         : Equipment checkout, returns, and dispute management
- damage.*        : Broken gear incident reporting, repairs, and QC approval
- lostfound.*     : Lost and found logging, claims, and resolution
- crew.*          : Personnel rosters, credentials, account status, permissions
- id.*            : Digital ID card generation and canvas export
- documents.*     : Letters, permits, generator numbering, and archives
- finance.*       : Cash ledgers, balances, vouchers, and operator entries
- contacts.*      : Internal crew and external vendor contacts
- broadcast.*     : Studio alerts, Web Push notifications, audio triggers
- projecthaul.*   : Major event control and broadcast milestones
- notes.*         : Studio minutes and scratchpad notes
- settings.*      : Personal and system-wide configurations
- audit.*         : Forensic security and login trail inspections
```

### 5.2 Canonical Access Profiles

Every user is mapped to one of the **5 Authoritative Access Profiles**:

```
1. PTV / Root Executive  (Institutional system-owned account, e.g. PTV-ROOT)
2. Eksekutif             (Ketua Umum, Sekretaris & Bendahara, Koor Operasional)
3. Kepolo Kepali         (Ketua Divisi, Technical & Operational Leads)
4. Crew                  (Active operational Santri crew & staff)
5. Pembina               (Institutional advisors, Foundation leadership)
```

### 5.3 Effective Capability Resolution Algorithm

Authorization is evaluated through a strict deterministic algorithm executed identically in the client-side policy layer and server-side RPCs:

```typescript
// Architectural Resolution Algorithm
export function hasCapability(
  user: UserContext,
  capability: AppCapability
): boolean {
  // Gate 1: Account must be active
  if (user.status_akun !== 'active') {
    return false;
  }

  // Gate 2: Inactive organization members are strictly read-only
  if (user.status_organisasi === 'inactive' && isMutationCapability(capability)) {
    return false;
  }

  // Gate 3: Explicit user-level deny override takes highest precedence
  if (user.denied_overrides.includes(capability)) {
    return false;
  }

  // Gate 4: Explicit user-level allow override (replaces legacy PTV-023 exception)
  if (user.allowed_overrides.includes(capability)) {
    return true;
  }

  // Gate 5: Profile capabilities
  for (const profile of user.assigned_profiles) {
    const profileCaps = PROFILE_CAPABILITY_MAP[profile] || [];
    if (profileCaps.includes(capability)) {
      return true;
    }
  }

  return false;
}
```

### 5.4 Elimination of Legacy Hardcoded Exceptions

In the legacy code, user `PTV-023` (*Farsya*) was hardcoded in PHP and JavaScript to access financial tools despite having a crew profile. 

**Architectural Replacement:**
- The hardcoded check is **completely removed**.
- Replaced by the explicit capability `finance.operator` in `user.allowed_overrides`.
- Any user designated by Executive Leadership can be granted `finance.operator` via database capability assignment without modifying a single line of application source code.

---

## 6. Data Access Architecture

### 6.1 Multi-Layer Pipeline

Direct Supabase queries inside React/Vue/Svelte components are **strictly prohibited**. All data operations pass through a disciplined four-tier pipeline:

```
┌─────────────────────────────────────────────────────────────┐
│                      1. UI Component                        │
│  - Calls typed hook: useEvents(), useLoanCheckout()        │
│  - Receives reactive data, loading state, error states      │
└──────────────────────────────┬──────────────────────────────┘
                               │ invokes
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                     2. Feature Service                      │
│  - Validates input payload with Zod schemas                 │
│  - Checks local policy: canUser(user, 'loans.checkout')     │
│  - Orchestrates business workflows                          │
└──────────────────────────────┬──────────────────────────────┘
                               │ delegates to
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                   3. Data Access Layer                      │
│  - Pure TypeScript repository functions                     │
│  - Typed Supabase queries (select, insert, update)          │
│  - Invocations of PostgreSQL Stored Procedures (RPC)        │
│  - Normalizes database responses to domain models           │
└──────────────────────────────┬──────────────────────────────┘
                               │ network call
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                     4. Supabase Cloud                       │
│  - Row Level Security (RLS) enforcement                     │
│  - PostgreSQL Stored Procedures (ACID transactions)         │
│  - Database constraints, unique sequences, advisory locks   │
└─────────────────────────────────────────────────────────────┘
```

### 6.2 RPC vs. Standard CRUD Policy

To maintain both performance and transactional safety, PTV PRO draws a clear line between routine database operations and atomic transactions:

1. **Complex Atomic Transactions (PostgreSQL RPC Required):**  
   PostgreSQL Stored Procedures (`supabase.rpc`) are **strictly required** for complex atomic transactional operations to guarantee ACID consistency, sequence safety, and row locking under concurrency. In particular, the **five contracted RPCs** from [PTV-HUB-FINAL-DATABASE-AUTH-CONTRACT.md](file:///c:/Users/zidna/ptvpro/docs/PTV-HUB-FINAL-DATABASE-AUTH-CONTRACT.md) execute exclusively via database functions:

| RPC Name | Purpose | Concurrency & Integrity Guard |
| :--- | :--- | :--- |
| `rpc_checkout_loan` | Atomic basket checkout for multiple units | `FOR UPDATE` row lock on `ptv_inventaris_unit` to prevent simultaneous double loans |
| `rpc_return_loan` | Atomic return of complete transaction | Validates caller capability, closes loan, restores unit availability |
| `rpc_return_single_unit` | Partial return of individual unit from basket | Atomically closes single line item without invalidating remainder of basket |
| `rpc_get_next_inv_code` | Collision-free gear catalog code generation | `pg_advisory_xact_lock(1001)` prevents duplicate `INV-xxx` codes |
| `rpc_submit_official_doc` | Atomic official letter numbering (SI/ST/SBB) | Prefix-specific advisory locks prevent sequence gaps or duplicates |

2. **Routine CRUD Operations (No RPC Needed by Default):**  
   Simple CRUD operations (standard SELECT queries, single-row inserts, routine status updates, and basic filtering) must use typed service and repository layers querying Supabase tables directly, protected by PostgreSQL Row Level Security (RLS). They do **NOT** need an RPC by default. Adding an RPC is reserved for operations requiring explicit multi-table transactions, advisory locks, or elevated service-role privileges.

---

## 7. Realtime Architecture

### 7.1 Unified Channel Design

In the legacy implementation, multiple disconnected event handlers listened for changes. In PTV PRO, realtime is managed through a **Centralized Realtime Event Bus**.

- **Supabase Realtime Channel:** `ptv_dashboard_realtime_sync`
- **Transport:** WebSocket via `@supabase/supabase-js`
- **Scope:** 14 authoritative tables published via Postgres Replication

```
┌────────────────────────────────────────────────────────────────────────┐
│                   SUPABASE REALTIME EVENT BUS                          │
│               Channel: "ptv_dashboard_realtime_sync"                   │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ WebSocket Stream
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                    CENTRAL REALTIME MANAGER SERVICE                    │
│  - Deduplicates events                                                 │
│  - Inspects actor_id: SUPPRESSES echo if action was by current client  │
│  - Triggers harmonic Web Audio chime if remote notification            │
│  - Dispatches domain events to in-memory reactive stores               │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ dispatches
           ┌────────────────────────┼────────────────────────┐
           ▼                        ▼                        ▼
┌───────────────────────┐┌───────────────────────┐┌───────────────────────┐
│     Events Store      ││    Inventory Store    ││      Loans Store      │
│  (Refreshes schedule) ││  (Updates unit badge) ││  (Updates badge-count)│
└───────────────────────┘└───────────────────────┘└───────────────────────┘
```

### 7.2 Event Routing & Echo Suppression

Every mutation performed by the application includes the client's current session identifier (`client_session_id`) or `actor_id`.

1. **Echo Suppression Rule:**  
   When a client performs an action (e.g., checks out a camera), the local UI updates optimistically. When the PostgreSQL replication event echoes back via WebSocket, the Realtime Manager compares `payload.new.actor_id === current_user.id`. The echo is **silently ignored** to prevent duplicate toasts or disruptive UI re-renders.
2. **Remote Client Reaction:**  
   When another crew member or coordinator modifies data, remote clients receive:
   - Discrete, non-blocking toast notification.
   - Preserved Web Audio API harmonic triple chime (for notifications/alerts).
   - In-place reactive cache invalidation (TanStack Query cache invalidation).

---

## 8. Sensitive Data Boundaries

Frontend visibility toggles (such as `style="display:none"` or `v-if`) do **not** constitute security. A malicious user with browser devtools can view any payload transmitted over the network.

PTV PRO enforces **Zero-Trust Server-Side Data Isolation**:

```
┌──────────────────────────────┬──────────────────────────────┬──────────────────────────────┐
│ Entity / Data Field          │ Threat Model                 │ Server-Side Defense Policy   │
├──────────────────────────────┼──────────────────────────────┼──────────────────────────────┤
│ User Credentials             │ Password hash exfiltration   │ password_hash never included │
│ (password_hash)              │                              │ in SELECT queries; guarded by│
│                              │                              │ Supabase Auth vault          │
├──────────────────────────────┼──────────────────────────────┼──────────────────────────────┤
│ Equipment Purchase Prices    │ Leaking procurement cost     │ Database RLS Policy:         │
│ (ptv_inventaris.harga_beli,  │ to unauthorized personnel,   │ SELECT denied to role IN     │
│  ptv_nilai_inventaris)       │ pembina, or public           │ ('pembina', 'pengarah')      │
├──────────────────────────────┼──────────────────────────────┼──────────────────────────────┤
│ Studio Cash Book Ledgers     │ Unauthorized visibility into │ Strict RLS: SELECT permitted │
│ (ptv_pemasukan, pengeluaran, │ financial health & balances  │ ONLY with capability         │
│  ptv_keuangan)               │                              │ 'finance.view'               │
├──────────────────────────────┼──────────────────────────────┼──────────────────────────────┤
│ Personal Contact Info        │ Doxxing santri / crew        │ Phone numbers stripped from  │
│ (telepon, no_wa, email)      │ via public verification      │ public verification queries  │
├──────────────────────────────┼──────────────────────────────┼──────────────────────────────┤
│ Push Crypto Secrets          │ Unauthorized alert broadcast │ Client can write own sub;    │
│ (p256dh, auth)               │                              │ reading restricted to Server │
├──────────────────────────────┼──────────────────────────────┼──────────────────────────────┤
│ Audit & Forensic Logs        │ Concealing unauthorized acts │ RLS policy restricts SELECT  │
│ (ptv_login_history)          │                              │ to Root & Eksekutif only     │
└──────────────────────────────┴──────────────────────────────┴──────────────────────────────┘
```

---

## 9. UI & UX Component Architecture

### 9.1 Parity Phase: Preservation of Legacy Visual Identity

The initial migration target for PTV Hub requires **1:1 visual, behavioral, and experiential parity** with the legacy dashboard (`progresiftv.id/dasbor`). 

- **Atmospheric Azure Glassmorphism:** Deep twilight backgrounds (`#0B132B`, `#1C2541`), translucent glass cards (`rgba(255, 255, 255, 0.05)`, `backdrop-filter: blur(12px)`), vibrant neon cyan/azure accents (`#48CAE4`, `#00B4D8`), and refined border glows.
- **Audio Feedback:** Authentic Web Audio API synthesizer generating the legacy three-tone harmonic chime on alerts.
- **Interaction Micro-animations:** Exact drawer sliding, modal overlays, barcode scanning sounds, and responsive mobile bottom-navigation bars.

### 9.2 Layered Component Hierarchy

To allow future design refreshes without touching business rules, the UI layer is strictly partitioned:

```
src/
├── shared/
│   └── ui/                     # Design Primitives (Zero Business Logic)
│       ├── Button/             # Glassmorphic button variants
│       ├── Card/               # Translucent frosted glass containers
│       ├── Input/              # Styled text, select, date inputs
│       ├── Modal/              # Accessible dialog overlays
│       ├── Badge/              # Status indicators (tersedia, dipinjam, QC)
│       └── Drawer/             # Responsive off-canvas navigation
│
├── products/
│   └── hub/
│       ├── layout/             # PTV Hub Shell
│       │   ├── HubLayout.tsx   # Desktop sidebar + content container
│       │   ├── HubSidebar.tsx  # Navigation links with capability filtering
│       │   ├── MobileNav.tsx   # Sticky bottom navigation bar for phones
│       │   └── TopHeader.tsx   # Active user pill, time widget, quick action
│       │
│       └── modules/            # Feature Components
│           └── inventory/
│               ├── components/
│               │   ├── GearCard.tsx          # Presentation card
│               │   ├── GearUnitTable.tsx     # Barcode & serial table
│               │   └── GearFilterBar.tsx     # Category & status search
│               ├── hooks/
│               │   └── useInventory.ts       # Reactive state hook
│               └── pages/
│                   └── InventoryPage.tsx     # Route view coordinator
```

---

## 10. Legacy Migration Boundaries

### 10.1 Mapping Legacy Files to PTV PRO Subsystems

The legacy WordPress codebase (`ptvpro-web`) contained mixed responsibilities across individual PHP template files. The architecture explicitly isolates these into their rightful products:

```
LEGACY SOURCE FILE               TARGET PTV PRO PRODUCT & LOCATION
────────────────────────────────────────────────────────────────────────────────
page-dasbor.php              ──► PTV Hub (`src/products/hub/*`)
                                 (Main operational studio management)

page-verifikasi-identitas.php ──► Verification Product (`src/products/verify/pages/VerifyIdPage.tsx`)
                                 (Public digital ID card scanner)

page-verifikasi-surat.php    ──► Verification Product (`src/products/verify/pages/VerifyDocPage.tsx`)
                                 (Public formal letter & permit validator)

page-assetyayasan.php        ──► Asset Product (`src/products/asset/pages/PrivateAssetPage.tsx`)
                                 (Foundation-wide hardware registry)

page-assetpublik.php         ──► Asset Product (`src/products/asset/pages/PublicAssetPage.tsx`)
                                 (Public educational gear catalog)

SEO tools & plugins          ──► EXCLUDED FROM PTV PRO
                                 (Maintained in external marketing web or headless CMS)
```

### 10.2 Coexistence Architecture (During Migration)

During the migration, the legacy dashboard at `progresiftv.id/dasbor` remains active and live. Zero regressions or disruptions are permitted:

```
┌─────────────────────────────────┐       ┌─────────────────────────────────┐
│     Legacy Production System    │       │         Target PTV Hub          │
│   https://progresiftv.id/dasbor │       │      https://ptvpro.com/hub     │
└────────────────┬────────────────┘       └────────────────┬────────────────┘
                 │                                         │
                 │ (writes to Supabase)                    │ (writes to Supabase)
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

1. **Supabase Cloud is the Sole Authority:** All writes from both the legacy bridge and the new PTV Hub land in Supabase Cloud.
2. **One-Way Mirroring:** Legacy MySQL tables receive updates via automated database trigger or one-way worker to maintain backward compatibility with old reporting tools until decommissioned.
3. **No Dual-Write Race Conditions:** Atomic RPCs guarantee data integrity regardless of which client initiated an action.

---

## 11. Future Extensibility & Product Isolation

The architecture ensures that future products (**Asset**, **BSH Bio**, **Event**, **Verification**) can be added without modifying, destabilizing, or re-testing PTV Hub.

### 11.1 The Product Contract

Every product inside `src/products/<product-name>` adheres to the standardized **Super App Product Interface**:

```typescript
export interface ProductModuleDefinition {
  id: string;                      // e.g. 'hub', 'asset', 'bio', 'event', 'verify'
  name: string;                    // e.g. 'PTV Hub'
  basePath: string;                // e.g. '/hub'
  requiredCapability?: string;     // e.g. 'hub.access' (undefined for public products)
  routes: RouteObject[];           // Declarative sub-routes
  navigationItems: NavItem[];      // Links to show in product navigation
  icon: React.ComponentType;       // Product brand icon
}
```

### 11.2 Scaling Model: Unified Deployment vs. Optional Evolution

- **Unified Baseline (Initial Implementation):**  
  The initial implementation of PTV PRO is built and deployed as **ONE application, ONE codebase, and ONE deployment**. All products reside in the same project repository and compile into a single optimized web application bundle.
- **Micro-Frontend as Future Optional Evolution Only:**  
  Micro-frontend decomposition or separately deployed micro-apps are strictly a future optional architectural evolution, NOT the current implementation. Clean directory boundaries (`src/products/*`) are enforced today so that code is decoupled, without introducing the operational overhead, separate CI/CD pipelines, or runtime complexity of micro-frontends prematurely.
- **Independent Route Registration:**  
  Products register their route tree with the Super App router in `src/app/routes.tsx`. If a new service like `Event` is introduced, it is simply registered in the product manifest without touching Hub code.

---

## 12. Project Directory Structure

Below is the complete proposed directory structure for `C:\Users\zidna\ptvpro`:

```
ptvpro/
├── docs/
│   ├── PTV-HUB-FINAL-DATABASE-AUTH-CONTRACT.md  # Authoritative Backend Contract
│   ├── PTV-PRO-PROJECT-ARCHITECTURE.md          # This Document
│   └── PTV-PRO-DECISIONS.md                     # Architectural Decisions & Anti-patterns
│
├── public/
│   ├── audio/                                   # Harmonic chime audio assets
│   ├── branding/                                # PTV PRO institutional logos & badges
│   └── favicon.ico
│
├── src/
│   ├── app/                                     # Super App Shell & Root Assembly
│   │   ├── App.tsx                              # Application entry component
│   │   ├── routes.tsx                           # Top-level route registry & layout dispatcher
│   │   ├── providers.tsx                        # QueryClient, AuthProvider, RealtimeProvider
│   │   └── productManifest.ts                  # Registry of all Super App products
│   │
│   ├── core/                                    # Cross-Cutting Super App Infrastructure
│   │   ├── auth/                                # Shared Identity & Session Management
│   │   │   ├── AuthContext.tsx                  # Global session context
│   │   │   ├── authService.ts                   # Login, logout, refresh, OAuth handlers
│   │   │   └── tokenStorage.ts                  # Secure credential persistence
│   │   ├── policy/                              # Granular Authorization Policy Engine
│   │   │   ├── capabilities.ts                  # 53 capability enum & definitions
│   │   │   ├── profiles.ts                      # 5 access profiles & default maps
│   │   │   ├── policyEngine.ts                  # hasCapability() resolution algorithm
│   │   │   └── Can.tsx                          # Declarative RBAC/ABAC component
│   │   ├── supabase/                            # Authoritative Database Client
│   │   │   ├── client.ts                        # Configured Supabase browser client
│   │   │   ├── database.types.ts                # Auto-generated TypeScript DB types
│   │   │   └── rpcClient.ts                     # Type-safe wrappers for 5 stored procedures
│   │   ├── realtime/                            # Unified Event Bus
│   │   │   ├── RealtimeBus.ts                   # WebSocket subscription manager
│   │   │   ├── echoSuppression.ts               # Actor-based loop filter
│   │   │   └── soundEffects.ts                  # Web Audio harmonic chime synthesizer
│   │   └── errors/                              # Centralized error normalization
│   │       ├── AppError.ts
│   │       └── errorHandler.ts
│   │
│   ├── shared/                                  # Platform-Wide UI & Utility Primitives
│   │   ├── ui/                                  # Pure Design Primitives (Zero business rules)
│   │   │   ├── Button/
│   │   │   ├── Card/
│   │   │   ├── Input/
│   │   │   ├── Modal/
│   │   │   ├── Badge/
│   │   │   ├── Toast/
│   │   │   └── Table/
│   │   ├── hooks/                               # Generic Utility Hooks
│   │   │   ├── useDebounce.ts
│   │   │   ├── useSound.ts
│   │   │   └── useMediaQuery.ts
│   │   └── utils/                               # Generic Pure Utilities
│   │       ├── formatters.ts                    # Currency (IDR), Indonesian Dates
│   │       ├── qrGenerator.ts                   # Client-side QR canvas renderer
│   │       └── validators.ts
│   │
│   └── products/                                # Independent Product Domains
│       │
│       ├── hub/                                 # PTV HUB (Initial Target Product)
│       │   ├── layout/                          # Hub Shell, Sidebar, Header, Mobile Drawer
│       │   │   ├── HubLayout.tsx
│       │   │   ├── HubSidebar.tsx
│       │   │   ├── HubMobileNav.tsx
│       │   │   └── HubTopBar.tsx
│       │   ├── hooks/                           # Hub Context Hooks
│       │   │   ├── useHubAuth.ts
│       │   │   └── useHubRealtime.ts
│       │   ├── routes.tsx                       # Hub Sub-routes & Navigation Guards
│       │   └── modules/                         # Functional Domain Modules
│       │       ├── overview/                    # Beranda Module
│       │       ├── events/                      # Acara & Rundown Module
│       │       ├── calendar/                    # Kalender Module
│       │       ├── inventory/                   # Inventaris & Nilai Module
│       │       ├── loans/                       # Peminjaman Module
│       │       ├── damage/                      # Kerusakan & QC Module
│       │       ├── lostfound/                   # Lost & Found Module
│       │       ├── crew/                        # Kru Management Module
│       │       ├── id-card/                     # Digital ID Card Module
│       │       ├── documents/                   # Dokumen, Generator Izin & Arsip
│       │       ├── contacts/                    # Kontak Internal & Eksternal
│       │       ├── finance/                     # Keuangan & Kas Kru Module
│       │       ├── broadcast/                   # Studio Alert & Web Push Module
│       │       ├── projecthaul/                 # Project Haul Module
│       │       ├── notes/                       # Catatan (Manual Save) Module
│       │       └── settings/                    # Hub Settings Module
│       │
│       ├── verify/                              # Verification Product (Public)
│       │   ├── routes.tsx
│       │   └── pages/
│       │       ├── VerifyIdPage.tsx             # Replacement for page-verifikasi-identitas.php
│       │       └── VerifyDocPage.tsx            # Replacement for page-verifikasi-surat.php
│       │
│       ├── asset/                               # Asset Product (Future Foundation Asset)
│       │   ├── routes.tsx
│       │   └── pages/
│       │       ├── PrivateAssetPage.tsx         # Replacement for page-assetyayasan.php
│       │       └── PublicAssetPage.tsx          # Replacement for page-assetpublik.php
│       │
│       ├── bio/                                 # BSH Bio Product (Future Santri Directory)
│       │   └── routes.tsx
│       │
│       └── event/                               # Event Product (Future Public Event/Haul)
│           └── routes.tsx
│
├── index.html                                   # SPA HTML Entry Point
├── package.json
├── tsconfig.json
└── vite.config.ts
```

---

## 13. Technology Stack Decisions

> [!IMPORTANT]
> **Local Application Architecture Scope:**  
> The stack specified below (Vite, React, TypeScript) is strictly a **local application architecture decision** for structuring the new codebase in `C:\Users\zidna\ptvpro`.  
> **DO NOT modify, migrate, reconnect, or deploy GitHub repositories or Vercel hosting yet.** All remote deployment workflows, repository bindings, and production hosting remain untouched until local application architecture and core slices are validated.

To support strict modularity, high performance, enterprise type safety, and real-time reactive state, the following modern technology stack is specified:

| Layer | Recommended Technology | Architectural Justification |
| :--- | :--- | :--- |
| **Runtime & Build Tool** | **Vite** | Instant HMR, lightweight dev server, highly optimized ESM production builds, zero legacy configuration baggage. |
| **Language** | **TypeScript (Strict Mode)** | Enforces end-to-end contract typing, compile-time capability checks, and exact Supabase schema mapping. |
| **Framework** | **React 18+** | Industry standard component model, rich ecosystem, declarative hook model perfectly suited for complex operational SPAs. |
| **Routing** | **React Router v6+** | Robust nested route layouts, declarative guards, parameterized dynamic segments (`/hub/kru/:ptvId`), full browser history control. |
| **Remote State & Cache** | **TanStack Query v5** | Intelligent caching, background query revalidation, automatic cache invalidation via realtime events, optimistic mutations. |
| **Local / UI State** | **Zustand** | Minimalist, unopinionated micro-stores for modals, active drawer state, and audio synthesis triggers without boilerplate. |
| **Form & Validation** | **React Hook Form + Zod** | High-performance uncontrolled form handling, zero unnecessary re-renders, strict schema validation matching PostgreSQL types. |
| **Database & Auth SDK**| **`@supabase/supabase-js`** | Authoritative backend transport, PostgreSQL RPC invocation, native WebSocket Realtime client, session persistence. |
| **Styling** | **Vanilla CSS Modules / Tailwind** | Provides maximum control over Atmospheric Azure Glassmorphism tokens, backdrop blur, CSS variables, and fluid responsive layouts. |
| **Icons & Media** | **Lucide React** | Consistent, modern vector iconography covering all 22 operational views. |
| **Audio Synthesis** | **Web Audio API (Native)** | Synthesizes pure harmonic triple chimes directly in browser without external audio asset network latency. |
| **Testing** | **Vitest + Testing Library** | Unit testing for policy resolution engine, capability checks, and data transformers with sub-second execution. |

---

## 14. Authoritative Architectural Principles

Every line of code and architectural decision in the PTV PRO project must adhere to these **12 Core Tenets**:

1. **Super App, Not Giant Dashboard:**  
   PTV PRO is an ecosystem of decoupled products. PTV Hub is merely one product inside it. Codebases and concerns remain strictly bounded.
2. **Product Boundaries Are Explicit:**  
   No cross-product internal imports. Features communicate through shared core APIs, routes, or database relations.
3. **Shared Identity, Contextual Authorization:**  
   Identity (`ptv_id`) is universal; authorization is scoped to product and role. Having an account does not inherently grant access to all products.
4. **Backend Authorization is Authoritative:**  
   Client-side permission checks provide user experience affordances only. Security is guaranteed exclusively by PostgreSQL Row Level Security (RLS) and secure RPCs.
5. **Legacy Behavior is the Migration Benchmark:**  
   The operational behavior of the production dashboard at `progresiftv.id/dasbor` is the invariant behavioral reference. No user-facing business feature may silently change during parity migration.
6. **Security Improvements Are Mandatory:**  
   Hardcoded credentials, client-side display hiding of sensitive finances, and sequential non-atomic database writes are eliminated.
7. **Business Workflow Changes Require Explicit Decisions:**  
   Developers may modernize internal code, but may not alter operational flows (e.g. 4-stage QC repair, manual note saving) without formal governance approval.
8. **Single Source of Truth:**  
   Supabase Cloud PostgreSQL is the single authoritative source of truth. Dual-write MySQL dependencies are eliminated.
9. **UI Components Do Not Own Business Logic:**  
   Components render presentation and forward user intent. Mutations, queries, validations, and RPC invocations belong to dedicated service layers.
10. **No Person-Specific Hardcoded Authorization:**  
    Hardcoding user IDs (such as legacy `PTV-023`) in logic is strictly forbidden. All permissions derive from access profiles or configurable capability overrides.
11. **Sensitive Data is Protected Server-Side:**  
    Equipment valuations, financial ledgers, and credentials are gated at the database layer. Pembina and advisory roles are isolated from cash balances by RLS.
12. **New Products Must Not Destabilize Existing Products:**  
    Adding or modifying BSH Bio, Event, or Asset services must have zero blast radius on PTV Hub operational stability.

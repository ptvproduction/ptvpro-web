# PTV PRO ARCHITECTURAL DECISIONS & GOVERNANCE LOG

**System:** PTV PRO Super App  
**Target Repository:** `ptvpro` (`C:\Users\zidna\ptvpro`)  
**Companion Documents:**
- [PTV-PRO-PROJECT-ARCHITECTURE.md](file:///c:/Users/zidna/ptvpro/docs/PTV-PRO-PROJECT-ARCHITECTURE.md)
- [PTV-HUB-FINAL-DATABASE-AUTH-CONTRACT.md](file:///c:/Users/zidna/ptvpro/docs/PTV-HUB-FINAL-DATABASE-AUTH-CONTRACT.md)  
**Status:** Canonical Decision Record  
**Version:** 1.0.0 (October 2026)  

---

## 1. Architectural Decisions & Rationale

| ID | Topic / Dimension | Architectural Decision | Rationale | Status |
| :--- | :--- | :--- | :--- | :--- |
| **ADR-001** | **Super App Paradigm** | PTV PRO is architected as a modular Super App within ONE application, ONE codebase, and ONE deployment. Micro-frontend decomposition is strictly a future optional evolution only. PTV Hub is an isolated product module (`/hub`). | Prevents unrelated institutional products (Asset, Bio, Event, Verification) from creating an unmaintainable codebase while avoiding premature multi-deployment operational overhead. | **CONFIRMED** |
| **ADR-002** | **Zero Disruption to Live Production** | The legacy production dashboard at `progresiftv.id/dasbor` remains active, live, and functional during migration. | Guarantees business continuity for active studio operations throughout the rewrite. | **CONFIRMED** |
| **ADR-003** | **Identity Permanence** | `ptv_id` (e.g. `PTV-001`, `PTV-025`) is an immutable institutional identifier. Email is never the primary identity key. | Institutional IDs persist across division transfers, graduation, and credential changes. | **CONFIRMED** |
| **ADR-004** | **Decoupling Status Dimensions** | Split single status into `status_organisasi` (`active`, `inactive`, `archived`) and `status_akun` (`active`, `inactive`). | Allows alumni to log in with active credentials to review past contributions in read-only mode, without mutation rights. | **CONFIRMED** |
| **ADR-005** | **Institutional Root Account** | The Root Executive account (`PTV-ROOT`) is an institutional system-owned entity, not an individual's personal account. | Eliminates single-point-of-failure risks and prevents accidental deletion/lockout of administrative authority. | **CONFIRMED** |
| **ADR-006** | **Removal of PTV-023 Hardcode** | Remove hardcoded `PTV-023` (Farsya) logic in code; replace with configurable granular capability `finance.operator`. | Hardcoded personal IDs in application logic violate security and maintainability standards. | **CONFIRMED** |
| **ADR-007** | **Inventory Custody Hierarchy** | Inventory responsibility belongs exclusively to Technical Division Leadership (`Ketua Technical`). No separate `PJ Inventaris` exists. | Aligns software roles with actual institutional operational realities and avoids conflicting sign-offs. | **CONFIRMED** |
| **ADR-008** | **Financial & Valuation Quarantine** | *Pembina* and *Pengarah* are strictly quarantined from financial ledgers and purchase valuations via PostgreSQL RLS. | Institutional governance requires confidential financial auditing while allowing advisors operational oversight. | **CONFIRMED** |
| **ADR-009** | **Single Source of Truth** | Supabase Cloud PostgreSQL is the sole authoritative database. Legacy WordPress MySQL dual-writes are eliminated. | Dual-writing introduces silent data desynchronization and race conditions during network blips. | **CONFIRMED** |
| **ADR-010** | **Atomic Stored Procedures (RPC) vs. Simple CRUD** | PostgreSQL RPCs are strictly required for complex atomic transactional operations, especially the 5 contracted RPCs (`rpc_checkout_loan`, `rpc_return_loan`, `rpc_return_single_unit`, `rpc_get_next_inv_code`, `rpc_submit_official_doc`). Simple CRUD operations must use typed service/repository layers and do NOT need an RPC by default. | Guarantees ACID transactional integrity and concurrency locking where needed without overcomplicating straightforward database reads and writes. | **CONFIRMED** |
| **ADR-011** | **Unified Realtime Bus & Echo Suppression** | Realtime updates across 14 tables stream through one channel (`ptv_dashboard_realtime_sync`) with client echo suppression. | Prevents duplicate toasts and audio chime loops when a client acts on their own data, while alerting remote clients. | **CONFIRMED** |
| **ADR-012** | **Path-Based Hierarchical Routing** | Transition from legacy URL hash navigation (`/dasbor#acara`) to clean path routes (`/hub/acara`, `/hub/peminjaman`). | Enables bookmarking, browser history back/forward navigation, and robust deep-linking in notifications. | **CONFIRMED** |
| **ADR-013** | **Preservation of 1:1 Legacy UX** | The initial migration phase enforces strict 1:1 visual parity (Atmospheric Azure Glassmorphism, Web Audio chimes). | Avoids user friction and operational retraining for Santri crew during core platform migration. | **CONFIRMED** |
| **ADR-015** | **Vertical Slice Implementation Order** | Module boundaries are defined upfront, but implementation proceeds strictly through sequential vertical slices: Auth → Policy → Hub Shell → Beranda → Kru. | Prevents spreading effort thin across 16 incomplete modules and ensures a verified security and shell baseline before expanding feature scope. | **CONFIRMED** |
| **ADR-016** | **Authoritative Capability Count (53 Granular Capabilities)** | The authoritative capability count is officially ratified at exactly 53 granular capabilities (as enumerated in the contract table), resolving the drafting discrepancy where the section header initially stated 48. | Eliminates documentation vs. implementation divergence; all 53 capabilities are preserved without adding, removing, or renaming any entry. | **CONFIRMED** |

---

## 2. Things Explicitly NOT to Do (Anti-Patterns & Prohibitions)

To maintain architectural integrity, the following actions and patterns are **strictly forbidden**:

### 2.1 Codebase & Source Separation
- ❌ **DO NOT copy prototype or legacy application code** from `C:\Users\zidna\ptvpro-web` into `C:\Users\zidna\ptvpro`.
- ❌ **DO NOT continue the legacy architectural patterns** (e.g. 40,000-line monolithic files, WordPress `$wpdb` calls, `admin-ajax.php`).
- ❌ **DO NOT cross-import modules between products** (e.g., `src/products/hub` must never import internal components or state from `src/products/asset`).

### 2.2 Security & Data Protection
- ❌ **DO NOT rely on frontend visibility toggles (`display: none`, `v-if`) for security.** Sensitive fields (finance, purchase prices, credentials) must be blocked at the database RLS layer.
- ❌ **DO NOT hardcode user IDs, PTV IDs, or personal names** anywhere in the source code or database queries.
- ❌ **DO NOT expose `password_hash` or personal phone numbers** through public verification endpoints or normal client SELECT queries.
- ❌ **DO NOT make email the primary database key.** PTV ID and internal UUIDs are the permanent anchors.

### 2.3 Operations & Execution Constraints
- ❌ **DO NOT implement application code during architecture design phase.**
- ❌ **DO NOT implement all modules at once.** Implementation must follow sequential vertical slices: Auth → Policy → Hub Shell → Beranda → Kru.
- ❌ **DO NOT create database migrations or execute schema changes** until architecture and contracts are formally locked.
- ❌ **DO NOT modify, restart, or deploy to production** environments.
- ❌ **DO NOT alter or disrupt the live legacy dashboard** at `progresiftv.id/dasbor`.
- ❌ **DO NOT touch, modify, migrate, reconnect, or deploy GitHub or Vercel yet.** Vite/React/TypeScript is a local application architecture decision only.
- ❌ **DO NOT silently alter business logic or operational workflows** without explicit written decision records.

### 2.4 State & Data Access Anti-Patterns
- ❌ **DO NOT allow UI components to query Supabase directly.** All data access must pass through typed services and repository layers.
- ❌ **DO NOT run sequential client-side loops for multi-row database updates.** Use PostgreSQL Stored Procedures (`RPC`).
- ❌ **DO NOT create global utility "dumping ground" files.** All helpers must be strictly scoped and typed.

---

## 3. Decisions Deferred to Future Phases

The following concerns are recognized but explicitly deferred to subsequent phases to keep focus on PTV Hub migration:

| Deferred Item | Description | Trigger for Resolution |
| :--- | :--- | :--- |
| **1. Passkeys / WebAuthn** | Biometric and FIDO2 passkey login support | Post-launch of PTV Hub; when browser passkey adoption is requested. |
| **2. BSH Bio Public Portal** | Comprehensive santri portfolio directory | Phase 5: After PTV Hub and Verification modules reach production stability. |
| **3. Foundation Asset Multi-Studio** | Full inventory tracking across non-PTV pesantren faculties | Phase 6: Post-hub stabilization. |
| **4. Micro-Frontend Decomposition** | Splitting products into separately deployed micro-apps | Future optional evolution only; initial implementation remains ONE application, ONE codebase, ONE deployment. |
| **5. Sunset of MySQL Mirror** | Discontinuing the one-way background mirror to legacy WordPress MySQL | After 60 consecutive days of zero legacy dashboard traffic. |

---

## 4. Architectural Governance Sign-Off

- **Contract Authority:** `PTV-HUB-FINAL-DATABASE-AUTH-CONTRACT.md`
- **Architecture Specification:** `PTV-PRO-PROJECT-ARCHITECTURE.md`
- **Open Architectural Blockers:** **0 items** (All 14 core decisions approved and locked).

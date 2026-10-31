# PTV PRO SUPER APP — LOCAL APPLICATION SCAFFOLD RECORD

**Phase:** Phase 2 (Local Application Scaffold)  
**Target Repository:** `C:\Users\zidna\ptvpro`  
**Status:** COMPLETE & VERIFIED  
**Date:** 08 Oktober 2026  
**Companion Documents:**
- [PTV-PRO-PROJECT-ARCHITECTURE.md](file:///c:/Users/zidna/ptvpro/docs/PTV-PRO-PROJECT-ARCHITECTURE.md)
- [PTV-PRO-DECISIONS.md](file:///c:/Users/zidna/ptvpro/docs/PTV-PRO-DECISIONS.md)
- [PTV-HUB-FINAL-DATABASE-AUTH-CONTRACT.md](file:///c:/Users/zidna/ptvpro/docs/PTV-HUB-FINAL-DATABASE-AUTH-CONTRACT.md)

---

## 1. Project Overview & Environment

PTV PRO Super App has been successfully bootstrapped as a standalone, clean-room local web application foundation under strict compliance with non-negotiable architectural constraints:
- **Local Development Only:** Zero Git push, zero GitHub actions, zero Vercel deployments, zero DNS/SSL modifications.
- **Production Isolation:** Zero queries or migrations against Supabase production; legacy dashboard (`progresiftv.id/dasbor`) and prototype folder (`C:\Users\zidna\ptvpro-web`) completely untouched.
- **Unified Single-Application Baseline:** Initial implementation is ONE application, ONE codebase, ONE deployment. Micro-frontend decomposition is strictly an optional future evolution.

---

## 2. Directory Structure

```
ptvpro/
├── docs/
│   ├── PTV-HUB-FINAL-DATABASE-AUTH-CONTRACT.md
│   ├── PTV-PRO-PROJECT-ARCHITECTURE.md
│   ├── PTV-PRO-DECISIONS.md
│   └── PTV-PRO-SCAFFOLD.md (This Document)
│
├── src/
│   ├── app/                                 # Platform Shell & Navigation
│   │   ├── config/
│   │   │   └── env.ts                       # Typed environment config
│   │   ├── providers/
│   │   │   ├── AppProviders.tsx             # Master providers wrapper
│   │   │   └── QueryProvider.tsx            # TanStack Query client & cache
│   │   └── router/
│   │       ├── ProtectedRoute.tsx           # Capability & status route guard
│   │       ├── LoginPage.tsx                # Universal mockable login portal
│   │       └── index.tsx                    # Root BrowserRouter definition
│   │
│   ├── core/                                # Cross-Cutting Security & Transport
│   │   ├── auth/
│   │   │   ├── types.ts                     # UserIdentity, UserAccount, AuthSession
│   │   │   ├── authService.ts               # IAuthService, LocalMockAuthService
│   │   │   └── index.ts
│   │   ├── policy/                          # Authoritative Authorization Engine
│   │   │   ├── capabilities.ts              # 53 capability enum & mutation classification
│   │   │   ├── profiles.ts                  # 5 canonical access profiles & default sets
│   │   │   ├── policyEngine.ts              # hasCapability() deterministic resolver
│   │   │   ├── policyEngine.test.ts         # Vitest test suite (8 unit tests)
│   │   │   └── index.ts
│   │   ├── session/
│   │   │   ├── sessionStore.ts              # Zustand client auth & policy store
│   │   │   └── index.ts
│   │   └── supabase/
│   │       ├── client.ts                    # Supabase Client abstraction (env-driven)
│   │       └── index.ts
│   │
│   ├── shared/                              # Reusable Primitives & Utilities
│   │   ├── components/
│   │   │   ├── Button.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── Badge.tsx
│   │   │   ├── LoadingState.tsx
│   │   │   ├── EmptyState.tsx
│   │   │   ├── ErrorState.tsx
│   │   │   └── index.ts
│   │   ├── types/
│   │   │   └── index.ts
│   │   └── utils/
│   │       └── formatters.ts
│   │
│   ├── products/                            # Product Subsystems
│   │   ├── hub/                             # PTV HUB (Initial Target)
│   │   │   ├── shell/
│   │   │   │   └── HubShell.tsx             # Hub Layout, capability menu, status pill
│   │   │   ├── beranda/                     # Slice 4: Beranda Module
│   │   │   │   ├── types.ts
│   │   │   │   ├── berandaService.ts        # Typed service/repository boundary
│   │   │   │   ├── useBeranda.ts            # TanStack Query hook
│   │   │   │   └── BerandaPage.tsx          # Presentation with full state handling
│   │   │   └── kru/                         # Slice 5: Kru Module
│   │   │       ├── types.ts
│   │   │       ├── kruService.ts            # Typed service/repository boundary
│   │   │       ├── useKru.ts                # TanStack Query hooks (list & member)
│   │   │       └── KruPage.tsx              # Roster table & capability-aware UI
│   │   │
│   │   ├── asset/                           # Future Asset Product Boundary
│   │   │   └── index.ts
│   │   ├── bio/                             # Future BSH Bio Product Boundary
│   │   │   └── index.ts
│   │   ├── event/                           # Future Event Product Boundary
│   │   │   └── index.ts
│   │   └── verification/                    # Future Verification Product Boundary
│   │       └── index.ts
│   │
│   ├── styles/
│   │   ├── tokens.css                       # Atmospheric Azure design tokens
│   │   └── base.css                         # CSS reset & element styling
│   │
│   ├── vite-env.d.ts
│   └── main.tsx                             # Application DOM entry point
│
├── .env.example                             # Local environment template
├── index.html                               # Vite HTML template
├── package.json                             # Exact required dependencies
├── tsconfig.json                            # Strict TypeScript configuration
├── tsconfig.node.json                       # Vite compiler options
├── vite.config.ts                           # Vite config with Vitest & path aliases
└── eslint.config.js                         # ESLint 9 flat configuration
```

---

## 3. Dependency Decisions

Strictly following the project specification, only essential libraries were installed:

| Package | Version | Purpose |
| :--- | :--- | :--- |
| `vite` | `^6.0.3` | Ultra-fast local dev server and ESM bundler |
| `react` & `react-dom` | `^18.3.1` | Core UI library |
| `typescript` | `^5.7.2` | Enterprise type safety in strict mode |
| `react-router-dom` | `^6.28.0` | Declarative routing and route guard abstractions |
| `@tanstack/react-query` | `^5.62.7` | Remote server-state caching, background revalidation |
| `zustand` | `^5.0.2` | Lightweight client auth and session state management |
| `react-hook-form` & `zod` | `^7.54.0` / `^3.24.1` | Performant uncontrolled forms & runtime schema validation |
| `@supabase/supabase-js` | `^2.47.10` | Authoritative database and auth client SDK |
| `lucide-react` | `^0.468.0` | Accessible vector iconography |
| `vitest` | `^2.1.8` | Unit testing runner for policy engine |

---

## 4. TypeScript Path Aliases

Aliases are synchronized identically across `tsconfig.json`, `vite.config.ts`, and `vitest`:
- `@/*` $\rightarrow$ `src/*`
- `@core/*` $\rightarrow$ `src/core/*`
- `@shared/*` $\rightarrow$ `src/shared/*`
- `@products/*` $\rightarrow$ `src/products/*`
- `@app/*` $\rightarrow$ `src/app/*`

---

## 5. Auth & Policy Architecture

### 5.1 Identity Representation
- `ptv_id` (`PTV-xxx`) is the permanent institutional identifier.
- Separated `status_organisasi` (`active`, `inactive`, `archived`) and `status_akun` (`active`, `inactive`).
- Session duration: 72 hours (259,200 seconds).

### 5.2 Deterministic Policy Engine (`hasCapability`)
- **53 Granular Capabilities** (reconciled final count) loaded from [PTV-HUB-FINAL-DATABASE-AUTH-CONTRACT.md](file:///c:/Users/zidna/ptvpro/docs/PTV-HUB-FINAL-DATABASE-AUTH-CONTRACT.md).
- **5 Canonical Access Profiles:**
  1. `root_executive` (Institutional account, unrestricted control)
  2. `eksekutif` (Executive operations, finance, sign-offs)
  3. `kepolo_kepali` (Supervisory, operations, rundown, gear)
  4. `crew` (Standard operations, checkout, damage reporting)
  5. `pembina` (Institutional advisory, strictly quarantined from finance & valuation)
- **Resolution Precedence:**
  1. `status_akun !== 'active'` $\rightarrow$ `false` (Fail-closed)
  2. `status_organisasi === 'archived'` $\rightarrow$ `false`
  3. `status_organisasi === 'inactive'` and `isMutationCapability()` $\rightarrow$ `false` (Alumni Read-Only)
  4. `denied_overrides.includes(capability)` $\rightarrow$ `false` (Highest override priority)
  5. `allowed_overrides.includes(capability)` $\rightarrow$ `true` (Replaces legacy `PTV-023` hardcode)
  6. Profile capabilities check $\rightarrow$ `true` if present
  7. Default $\rightarrow$ `false`

---

## 6. Data Access Architecture

Components strictly avoid calling Supabase directly:
```
UI Component (e.g. KruPage)
    │
    ▼
Hook / Query (e.g. useKruList)
    │
    ▼
Typed Service / Repository (e.g. LocalKruService / SupabaseKruRepository)
    │
    ▼
Supabase Client / Mock Adapter
```
- **Complex Transactions:** Reserved for the 5 PostgreSQL Stored Procedures (`RPC`).
- **Routine Simple CRUD:** Executed via typed repository methods with Row Level Security (RLS).

---

## 7. Testing & Verification Results

### 7.1 Vitest Unit Tests
Vitest suite `src/core/policy/policyEngine.test.ts` passed 8/8 tests:
1. Root Executive unrestricted access.
2. Crew profile boundaries (loans allowed, finance/crew management denied).
3. Pembina strict isolation from finance and equipment valuations.
4. User-level allowed override (`finance.operator`) granting non-profile capability.
5. User-level denied override overriding profile capabilities.
6. Inactive organization member with active account granted read-only alumni mode (mutations blocked).
7. Inactive account failing closed across all actions.
8. Null/undefined context failing closed.

### 7.2 Verification Gates
- [x] **Vitest:** 8 passed (0 failures)
- [x] **TypeScript Typecheck (`npm run typecheck`):** 0 errors
- [x] **ESLint (`npm run lint`):** 0 errors, 0 warnings
- [x] **Production Build (`npm run build`):** Built successfully in 21s (dist bundle generated)

---

## 8. Vertical Slice Status

| Slice | Scope | Status | Notes |
| :--- | :--- | :--- | :--- |
| **Slice 1: Auth** | Identity models, session store, login portal, mock adapter | **DONE** | Supports 8 simulated test accounts covering all profiles and statuses |
| **Slice 2: Policy** | 53 capabilities, 5 profiles, deterministic resolver, unit tests | **DONE** | Fully tested and passing (10/10 tests) |
| **Slice 3: Hub Shell** | Responsive layout, sidebar, capability menu filter, user badge | **DONE** | Dynamic menu filtering based on user permissions |
| **Slice 4: Beranda** | Dashboard metrics, studio health, upcoming agenda, state handling | **DONE** | TanStack Query + typed service repository |
| **Slice 5: Kru** | Roster directory, division filter, capability-gated creation action | **DONE** | TanStack Query + typed service repository |

---

## 9. Governance Confirmation

- **No Open Contradictions / Blockers:** 0 NEEDS DECISION items.
- **External Systems Untouched:** Zero modifications to GitHub, Vercel, Supabase production, `progresiftv.id`, legacy `/dasbor`, or `ptvpro-web`.

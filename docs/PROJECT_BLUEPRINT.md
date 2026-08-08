# LEANR — Project Blueprint & Requirements Document

### Next.js (App Router) + TypeScript + Supabase — Online Personal Training Platform

> **Version:** 1.0
> **Document snapshot:** 2026-08-01. Practices are maintained over time — dependency numbers in this file are **not** authoritative.
> **Audience:** Solo developer, AI coding assistants (Cursor, Copilot, Claude), future team developers, non-technical stakeholders
> **Purpose:** Single source of truth for stack, architecture, security checklist, API/service documentation standard, and copy-paste prompts for the LEANR (by Fitelo) codebase — adapted from the team's generic MERN blueprint to match what this repo actually is: a **Next.js monolith on Supabase**, not an Express/Mongo API.
> **Format note:** This document mirrors the structure of the team's `Full-Stack Project Blueprint & Prompt Sheet (MERN + TypeScript)` template, section-for-section, but every section below describes **this project's real stack and real code**, not the generic template's.

---

## ⚠️ Version Safety Rule (Read First)

> **Never copy version numbers from this document (or from memory) into `package.json`.** Old pins stay vulnerable; docs go stale the day they ship.

### For humans

1. Open [npmjs.com](https://www.npmjs.com/) for each package — confirm **latest** and read the **Security**/advisory links if shown.
2. Prefer the **newest patched release** on a supported major line — not an old pin "because the doc said so."
3. After install: `npm audit` and fix **high/critical** before shipping.

```bash
npm show <package-name> version          # latest published
npm view <package-name> time.modified    # how fresh "latest" is
npm audit                                # installed tree
```

### For AI assistants (mandatory)

Before editing `package.json` / `package-lock.json` or recommending install commands:

1. **Web search** each non-trivial dependency (`"<package> npm latest version"`, `"<package> npm security advisory"` / CVE). For Node.js, search `"Node.js LTS current release"`.
2. Cross-check with `npm show <package> version` in the terminal.
3. If a CVE is unpatched on `latest`, search for the patched version or an alternative package.
4. State what you verified in your reply — don't silently invent versions.
5. Use `^` ranges unless you have a documented reason to pin exact — then pin to a **verified good release**.

**Names to verify (not versions):**

| Package | What to check |
|---|---|
| `next` | Latest stable 14.x/15.x line; App Router breaking changes; advisories |
| `@supabase/supabase-js` | Latest stable v2; breaking changes vs. installed migrations |
| `react`, `react-dom` | Version compatibility with the installed `next` major |
| `typescript` | Latest stable; note `strict` currently `false` in this repo — see [§4.6](#46-known-gaps-vs-this-blueprint) |
| `tailwindcss`, `autoprefixer`, `postcss` | Latest stable, Tailwind v4 migration notes if relevant |
| `recharts`, `lucide-react`, `clsx` | Latest stable, no known advisories at time of writing — verify anyway |
| `@netlify/plugin-nextjs` | Keep aligned with installed `next` major |

---

## Table of Contents

1. [Tech Stack](#1-tech-stack)
2. [Repository Structure](#2-repository-structure)
3. [Environment Variables](#3-environment-variables)
4. [Backend Architecture (Supabase + Service Layer)](#4-backend-architecture-supabase--service-layer)
5. [API / Service Documentation Standard](#5-api--service-documentation-standard)
6. [Backend & Data Security Checklist](#6-backend--data-security-checklist)
7. [Frontend Architecture](#7-frontend-architecture)
8. [Frontend Security Checklist](#8-frontend-security-checklist)
9. [AI Workflow, CI & Git Hygiene](#9-ai-workflow-ci--git-hygiene)
10. [Testing Guide (Postman + Supabase)](#10-testing-guide-postman--supabase)
11. [Master Prompts](#11-master-prompts)
12. [Domain Notes — Scheduling / Personal Training](#12-domain-notes--scheduling--personal-training)
13. [Document Maintenance](#13-document-maintenance)

---

## 1. Tech Stack

There is **no separate backend service** in this project. It is a single Next.js application; "backend" logic lives in **Server Actions + a service layer** that talk to **Supabase** (Postgres, Auth, Storage, Row Level Security). This is the single biggest structural difference from the generic MERN blueprint — there is no Express, no Mongoose, no hand-rolled JWT issuance.

| Layer | Choice | Notes |
|---|---|---|
| **Runtime** | Node.js 18.18+ | Per `README.md`; verify current Active LTS before upgrading |
| **Framework** | Next.js 14 (App Router) | `next@14.2.5` in `package.json` — verify latest 14.x/15.x before bumping |
| **Language** | TypeScript | `tsconfig.json` has `"strict": false` — **gap**, see [§4.6](#46-known-gaps-vs-this-blueprint) |
| **Database** | PostgreSQL via Supabase | Managed, not self-hosted; schema lives in `supabase/migrations/*.sql` |
| **ORM/Query layer** | None (raw `@supabase/supabase-js` queries + Postgres functions via `.rpc()`) | No Prisma/Mongoose equivalent |
| **Auth** | Supabase Auth (email/password) | `supabase.auth.signInWithPassword`, `signOut`; session/JWT lifecycle handled by the Supabase client, not custom code |
| **Authorization** | PostgreSQL Row Level Security (RLS) | Every table has policies in `0012_rls_policies.sql`; this replaces the blueprint's `assertOwnership()` pattern |
| **Validation** | None yet | No Zod (or equivalent) on env vars or service inputs — **gap**, see [§4.6](#46-known-gaps-vs-this-blueprint) |
| **Styling** | Tailwind CSS 3.4 | `tailwind.config.ts`, brand palette defined there |
| **Charts** | Recharts | Admin/coach dashboards, revenue & utilization charts |
| **Icons** | lucide-react | |
| **Utility** | clsx | Conditional className composition |
| **File storage** | Supabase Storage | Buckets defined in `0013_storage_buckets.sql` (avatars, coach certifications, progress photos) |
| **Real-time** | Not implemented | Supabase supports Realtime subscriptions; unused in this repo today |
| **Background jobs / cron** | Not implemented | `mark_missed_bookings()` and inactivity checks are callable Postgres functions, not scheduled — deliberate Phase 1 scope boundary (see `docs/business-rules.md`) |
| **Email/push/WhatsApp** | Not implemented | `notifications.channels` (jsonb) is a placeholder for a future dispatcher |
| **Payments** | Not implemented | `subscriptions`/`package_tiers` model what was purchased; no payment-gateway integration yet (deliberate scope boundary) |
| **Monitoring/error tracking** | Not implemented | No Sentry or equivalent wired in yet — **gap** |
| **Deploy: App** | Netlify (primary, `netlify.toml` + `@netlify/plugin-nextjs`) or Vercel (zero-config) | |
| **Deploy: DB/Auth/Storage** | Supabase project (managed) | Migrations run manually via Supabase Dashboard → SQL Editor, in numeric order |

**Session/token model (handled entirely by Supabase, not custom code):**

- Supabase issues its own access + refresh tokens on `signInWithPassword`; the `supabase-js` client persists and auto-refreshes them (browser: `localStorage` by default under the `@supabase/supabase-js` key).
- Server-side code never issues tokens — it either uses the **anon key** (RLS-enforced, as the requesting user) or the **service-role key** (bypasses RLS, server-only, never shipped to the client).

---

## 2. Repository Structure

This is a **single Next.js app**, not a `backend/` + `frontend/` monorepo. Structure below reflects the repo as it exists today.

```
LeanR-PT-main/
├── src/
│   ├── app/                           # Next.js App Router — routes = folders
│   │   ├── layout.tsx                 # Root layout (fonts, globals.css)
│   │   ├── page.tsx                   # Landing page ("/")
│   │   ├── not-found.tsx
│   │   ├── login/
│   │   │   ├── client/page.tsx
│   │   │   ├── coach/page.tsx
│   │   │   └── admin/page.tsx
│   │   ├── client/                    # Client portal (layout.tsx wraps PortalShell)
│   │   │   ├── dashboard/ book/ coach/ sessions/ progress/ profile/ notifications/
│   │   ├── coach/                     # Coach portal
│   │   │   ├── dashboard/ schedule/ availability/ clients/[id]/ session/[id]/ profile/
│   │   └── admin/                     # Admin portal
│   │       ├── dashboard/ clients/[id]/ coaches/[id]/ sessions/ reports/
│   │       ├── coach-change-requests/ settings/
│   │
│   ├── components/
│   │   ├── ui/                        # Design-system primitives: Button, Card, Badge, Modal, Avatar,
│   │   │                               # ConfirmDialog, EmptyState, ProgressRing, Skeleton, StatCard
│   │   ├── shared/                    # PortalShell (sidebar/nav + logout), PageHeader, Logo
│   │   ├── auth/                      # AuthLayout, LoginForm (calls supabase.auth.signInWithPassword)
│   │   ├── landing/                   # Hero, Navbar, Footer, PricingSection, Testimonials, etc.
│   │   └── client/                    # Feature components: NextSessionCard, FeedbackModal
│   │
│   └── lib/
│       ├── supabase.ts                # Browser client (anon key) — used by LoginForm, PortalShell logout
│       ├── supabase/
│       │   ├── request-client.ts      # Request-scoped client for Server Actions — pass caller's
│       │   │                          # access_token so RLS resolves auth.uid() correctly
│       │   └── admin-client.ts        # Service-role client, server-only ("server-only" package
│       │                              # enforced), bypasses RLS — privileged ops only
│       ├── services/                  # "Backend" logic — one file per domain resource
│       │   ├── _auth.ts               # getCallerContext() / requireRole() — every service starts here
│       │   ├── profiles.service.ts
│       │   ├── coaches.service.ts
│       │   ├── clients.service.ts
│       │   ├── packages.service.ts
│       │   ├── subscriptions.service.ts
│       │   ├── availability.service.ts
│       │   ├── scheduling.service.ts  # getOpenSlots / holdSlot / confirmHold — wraps DB functions
│       │   ├── bookings.service.ts
│       │   ├── coachChange.service.ts
│       │   ├── notifications.service.ts
│       │   └── audit.service.ts
│       ├── mock-data.ts               # Prototype data — still the actual data source for all pages today
│       ├── types.ts
│       └── utils.ts
│
├── supabase/
│   └── migrations/                    # Run in order via Supabase Dashboard → SQL Editor
│       ├── 0001_enums.sql             ├── 0008_notifications.sql
│       ├── 0002_profiles.sql          ├── 0009_audit_and_settings.sql
│       ├── 0003_packages_subscriptions.sql   ├── 0010_views.sql
│       ├── 0004_coach_scheduling.sql  ├── 0011_scheduling_functions.sql
│       ├── 0005_bookings_and_slots.sql ├── 0012_rls_policies.sql
│       ├── 0006_continuity.sql        ├── 0013_storage_buckets.sql
│       └── 0007_coaching_content.sql  └── 0014_seed_data.sql (dev-only)
│   ├── seed_step2_fix_roles.sql
│   └── seed_step3.sql
│
├── docs/
│   ├── PROJECT_BLUEPRINT.md           # This file
│   ├── api.md                         # Service-layer function reference
│   ├── business-rules.md              # Canonical numeric rules (cutoffs, durations, thresholds)
│   ├── erd.md                         # Entity-relationship diagram (Mermaid)
│   ├── scheduling-engine.md           # Postgres scheduling functions, documented
│   └── booking-sequence-diagrams.md   # Sequence diagrams for booking flows
│
├── .eslintrc.json                     # extends "next/core-web-vitals"
├── next.config.mjs                    # eslint/typescript errors ignored at build — see §4.6
├── netlify.toml                       # Netlify build config + @netlify/plugin-nextjs
├── tailwind.config.ts
├── tsconfig.json                      # strict: false — see §4.6
├── package.json
└── README.md
```

**Rules — never break these:**

- Never commit `.env`, `.env.local`, `node_modules`, `.next/`, or `out/` (already covered by `.gitignore`).
- `SUPABASE_SERVICE_ROLE_KEY` must never appear in any file under `src/app/**` marked `"use client"`, nor in any `NEXT_PUBLIC_*` variable. It is imported only by `admin-client.ts`, which is guarded with the `server-only` package.
- One source of truth for business-rule numbers: `system_settings` table, read via `get_setting_int(key)` inside Postgres functions — **not** re-hardcoded in TypeScript. This was a deliberate fix for a prototype bug (see `docs/business-rules.md`).
- Every new service function's first parameter is `accessToken: string` (unless explicitly documented as a **system** function using the admin client) — this is the project's substitute for the blueprint's `requireAuth` middleware.

### `.gitignore` (current, verified against repo)

```gitignore
node_modules
.next
out
.env*
.DS_Store
*.log
*.tsbuildinfo
```

**Gap vs. the generic blueprint:** there is no committed `.env.example` in this repo today. Add one — see [§3](#3-environment-variables) for the exact contents to use.

---

## 3. Environment Variables

### Actual variables read by the codebase today (verified via `grep -rn "process.env\." src`)

| Variable | Used in | Exposed to browser? | Purpose |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `lib/supabase.ts`, `lib/supabase/request-client.ts`, `lib/supabase/admin-client.ts` | **Yes** (by design — Supabase project URL is not a secret) | Supabase project endpoint |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `lib/supabase.ts`, `lib/supabase/request-client.ts` | **Yes** (by design — anon key is RLS-constrained, safe to ship) | Public client, RLS-enforced |
| `SUPABASE_SERVICE_ROLE_KEY` | `lib/supabase/admin-client.ts` | **No — must never be `NEXT_PUBLIC_*` or reach client bundles** | Bypasses RLS; server-only privileged operations |

### `.env.example` (does not exist yet — create this file)

```env
# ── Supabase (Public — safe to expose, anon key is RLS-constrained) ──────
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_public_key

# ── Supabase (Secret — server-only, NEVER prefix with NEXT_PUBLIC_) ──────
# Bypasses Row Level Security. Only imported by lib/supabase/admin-client.ts,
# which is guarded with the "server-only" package.
SUPABASE_SERVICE_ROLE_KEY=your_service_role_secret_key
```

### Known gap: no env validation

Every current file reads `process.env.X!` with a non-null assertion and no runtime check — a missing/misspelled env var fails at first Supabase call, not at startup, and the error is generic. **Recommended fix**, matching the pattern used in the team's other Next.js projects:

```typescript
// src/lib/env.ts (does not exist yet — add it)
import { z } from "zod";

const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20).optional(), // optional: only needed server-side
});

export const env = envSchema.parse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
});
```

`zod` is not currently a dependency — verify latest version via `npm show zod version` before adding.

---

## 4. Backend Architecture (Supabase + Service Layer)

There is no Express `app.ts` middleware chain in this project. The equivalent responsibilities are split across **Postgres (RLS + functions)** and the **TypeScript service layer**.

### 4.1 Two Supabase clients, by design

```typescript
// src/lib/supabase/request-client.ts — RLS enforced AS THE CALLING USER
export function getRequestClient(accessToken: string) {
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}
```

```typescript
// src/lib/supabase/admin-client.ts — BYPASSES RLS, server-only
import "server-only";
export const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});
```

**Why two clients (documented in `docs/folder-architecture.md`):** a Server Action receives the caller's `access_token` (read client-side via `supabase.auth.getSession()`), builds a request-scoped client with it, and Postgres's `auth.uid()` then resolves correctly — every RLS policy applies exactly as if the user queried directly. `admin-client` is reserved for operations that must legitimately bypass RLS: writing audit logs, creating notifications for a *different* user than the caller, and the public assessment-booking entry point where the caller has no account yet.

### 4.2 The service layer replaces Express controllers

Every service function in `src/lib/services/*.ts` follows the same shape:

```typescript
// Pattern used throughout src/lib/services/
export async function cancelBooking(accessToken: string, bookingId: string, reason?: string) {
  const ctx = await getCallerContext(accessToken);   // resolves user + role, or throws
  // requireRole(ctx, ["client", "admin"]) where applicable
  const { data, error } = await ctx.client.rpc("cancel_booking", { p_booking_id: bookingId, p_reason: reason });
  if (error) throw error;
  return data;
}
```

- `getCallerContext(accessToken)` (in `_auth.ts`) is the substitute for `requireAuth` middleware — it resolves identity + role from the Supabase session and returns an RLS-scoped client.
- `requireRole(ctx, roles)` is the substitute for `roleGuard` middleware — throws `Error("Forbidden: ...")` before any query runs.
- Row Level Security policies (`0012_rls_policies.sql`) are the substitute for `assertOwnership()` — a query from a client whose token doesn't own a row simply returns zero rows, not a thrown error. Services that need an explicit 404-style error still check "was a row returned?" after the query.

**Intended call shape once wired into pages** (per `docs/folder-architecture.md` — not yet implemented, see [§4.6](#46-known-gaps-vs-this-blueprint)):

```typescript
"use server";
import { cancelBooking } from "@/lib/services/bookings.service";

export async function cancelBookingAction(accessToken: string, bookingId: string) {
  return cancelBooking(accessToken, bookingId);
}
```

### 4.3 Business logic lives in Postgres functions, not TypeScript

Scheduling/booking logic (slot holds, conflict detection, cutoff enforcement, recurring-slot generation) is implemented as Postgres functions in `0011_scheduling_functions.sql` and called via `.rpc(...)`:

`create_temporary_booking`, `confirm_booking`, `cancel_booking`, `reschedule_booking`, `generate_bookings_from_recurring_slot`, `assign_shadow_coach`, `mark_missed_bookings`, `expire_temporary_bookings`, `has_scheduling_conflict`, `is_slot_within_working_hours`, `booking_end_time`.

Full behavioral documentation: [`docs/scheduling-engine.md`](../docs/scheduling-engine.md) and [`docs/booking-sequence-diagrams.md`](../docs/booking-sequence-diagrams.md).

### 4.4 Business rule constants — single source of truth

All previously-hardcoded numeric rules now live in `system_settings`, read via `get_setting_int(key)`:

| Rule | Key | Default |
|---|---|---|
| Cancel/reschedule cutoff | `reschedule_cutoff_hours` | 12 |
| "Join" button window | `join_window_minutes` | 10 |
| Default session length | `default_session_duration_minutes` | 45 |
| Assessment session length | `assessment_session_duration_minutes` | 60 |
| Inactivity threshold | `inactivity_threshold_days` | 30 |
| Temporary slot hold duration | `temporary_booking_hold_minutes` | 10 |

Admins can change any of these live; every scheduling function reads the current value at call time — see `docs/business-rules.md` for the full audit trail of where these used to be duplicated in the prototype.

### 4.5 Standard response shape

The service layer does not (yet) enforce one consistent success/error envelope the way the blueprint's `{ success, data }` / `{ success, error }` pattern does for a REST API — service functions currently either return data directly or `throw`. **Recommended for Phase 2** when Server Actions are wired up: adopt the same envelope for anything returned to Client Components, so `useActionState`/error UI can branch consistently:

```typescript
// Recommended Server Action response shape
type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: { code: string; message: string; fields?: Record<string, string[]> } };
```

### 4.6 Known gaps vs. this blueprint

Track these explicitly — they are not implemented yet, not silently assumed to be fine:

- **`tsconfig.json` has `"strict": false`** and `next.config.mjs` sets `eslint.ignoreDuringBuilds: true` and `typescript.ignoreBuildErrors: true` — the build currently cannot fail on type or lint errors. Tighten before production launch.
- **No env validation** (Zod or otherwise) — see [§3](#3-environment-variables).
- **No `middleware.ts` / route guards** — `client/layout.tsx`, `coach/layout.tsx`, `admin/layout.tsx` render `PortalShell` unconditionally; there is currently no server-side session or role check preventing a client from navigating directly to `/admin/dashboard`. `LoginForm` performs a real `supabase.auth.signInWithPassword` call, but nothing downstream enforces the result.
- **UI is still on `mock-data.ts`, not the service layer.** 21 files under `src/app/` import from `lib/mock-data.ts`; zero import from `lib/services/*`; zero `"use server"` Server Actions exist yet. The Supabase schema, RLS policies, and service layer (Phase 1) are built and documented, but **not wired into any page** (Phase 2, per `docs/folder-architecture.md`).
- **No rate limiting** anywhere (login form, booking creation, etc.) — Supabase Auth has its own built-in abuse protection, but application-level limits (e.g. on `createAssessmentBooking`, a public unauthenticated entry point) are not implemented.
- **No monitoring/error tracking** (Sentry or equivalent) and no structured server-side logging.
- **No automated jobs** — `mark_missed_bookings()` and `expire_temporary_bookings()` must be invoked manually or wired to a scheduler (Supabase Edge Function cron, Vercel Cron, etc.); this is a deliberate Phase 1 scope boundary, not an oversight.
- **No CI pipeline** — no `.github/workflows`, no `npm test` script, no test runner installed.

---

## 5. API / Service Documentation Standard

There is no REST API surface owned by this app beyond what Supabase auto-generates (PostgREST + RPC). The documentation unit here is the **service function**, not an HTTP route. `docs/api.md` is the canonical reference and already follows this format — use it as the template for every new service function.

### Template (copy for each service function)

```
### `<module>.service.ts` → `functionName`

**Description:** One sentence describing what this does.
**Params:** `accessToken: string` (unless a **system** function), plus typed args.
**Returns:** shape of the resolved value.
**Authorization:**
  - RLS — describe which rows are visible/writable and why
  - and/or requireRole(ctx, [...]) — describe which roles pass, and what happens for the rest
    (RLS ⇒ query silently returns zero rows; requireRole ⇒ throws `Error("Forbidden: ...")`)

#### Underlying Postgres object(s)
  Table(s): ...
  RPC function (if any): `.rpc("fn_name", {...})` — see scheduling-engine.md if it's a scheduling function

#### Example call (from a Server Action)
  const result = await someService(accessToken, { ...args });

#### Error cases
  - "Not authenticated" — thrown by getCallerContext() if the access token is missing/invalid
  - "Profile not found" — thrown by getCallerContext() if no profiles row exists for the user
  - "Forbidden: requires role X or Y" — thrown by requireRole()
  - Postgres/RLS errors bubble up as the raw `PostgrestError` from supabase-js — decide at the
    Server Action boundary how these map to user-facing messages

#### Business rules
  - Rule 1, with a link to docs/business-rules.md if it reads a system_settings value
  - Rule 2
```

### Existing reference tables (already in the codebase, keep these current)

- [`docs/api.md`](../docs/api.md) — every service function, by module, with params/returns/authorization
- [`docs/business-rules.md`](../docs/business-rules.md) — every numeric rule, its `system_settings` key, and where it used to be hardcoded in the prototype
- [`docs/erd.md`](../docs/erd.md) — Mermaid ER diagram of every table
- [`docs/scheduling-engine.md`](../docs/scheduling-engine.md) — full behavior of the Postgres scheduling functions
- [`docs/booking-sequence-diagrams.md`](../docs/booking-sequence-diagrams.md) — sequence diagrams for hold → confirm → cancel/reschedule flows

### Error handling convention (recommended, not yet enforced everywhere)

| Situation | Convention |
|---|---|
| Caller not authenticated | `getCallerContext` throws `"Not authenticated"` |
| Caller authenticated but wrong role | `requireRole` throws `"Forbidden: requires role <roles>"` |
| Resource doesn't exist / not visible to caller | RLS returns zero rows — service should treat this as "not found," never distinguish it from "exists but forbidden" (same reasoning as the blueprint's 404-not-403 rule, achieved here structurally by RLS rather than an explicit check) |
| Validation failure | Not yet standardized — recommend adopting Zod schemas per service function input, mirroring the blueprint's `VALIDATION_ERROR` shape |

---

## 6. Backend & Data Security Checklist

Adapted for Supabase's model: RLS + Postgres functions replace most of the generic blueprint's Express-middleware checklist.

### Environment & Configuration

- [ ] `.env.example` committed with placeholder values (currently **missing** — create per [§3](#3-environment-variables))
- [x] `.env`, `.env.local` covered by `.env*` in `.gitignore`
- [ ] Env validated at startup (Zod or equivalent) — currently **not implemented**
- [x] `SUPABASE_SERVICE_ROLE_KEY` is a distinct secret from the anon key, never `NEXT_PUBLIC_*`
- [ ] Confirm Supabase project's database password / connection is not reused elsewhere
- [ ] Confirm Supabase Auth email templates, redirect URLs, and site URL are set correctly per environment (dev/staging/prod)

### Authentication & Authorization

- [x] Password auth via Supabase Auth (`signInWithPassword`) — no custom password hashing/storage in this codebase
- [x] Access/refresh token lifecycle fully delegated to `@supabase/supabase-js` (no custom JWT signing/verification to audit)
- [x] Row Level Security enabled and policy-per-table for every table (`0012_rls_policies.sql`)
- [ ] **No server-side route guard yet** — add a `middleware.ts` (or per-layout session check) so `/admin/*`, `/coach/*`, `/client/*` verify both session presence *and* `profiles.role` before rendering, not just after login redirect. This is the highest-priority security gap in the current codebase.
- [ ] Account lockout / brute-force protection on login — confirm Supabase Auth's built-in rate limiting is sufficient for this project's risk profile, or add an application-level limiter
- [ ] Session/device management UI (view & revoke active sessions) — not implemented, not currently planned in scope docs

### RLS & Query Safety

- [x] Every table has explicit policies — verified via `0012_rls_policies.sql` (grep confirms coverage for all 19 domain tables + `storage.objects`)
- [x] Coach-schedule visibility is **intentionally broad** (any authenticated user can read `coach_availability`, `coach_shifts`, `coach_leave`, and booking *existence/timing*) so slot-conflict checking works against every coach's real schedule — session **content** (`workout_notes`, `attendance`, ratings, `medical_notes`) stays restricted. This is documented policy, not a bug — see `docs/business-rules.md` and the header comment in `0012_rls_policies.sql` before "fixing" it.
- [ ] Audit that every service function which calls `admin-client` (RLS bypass) has a hard-coded reason in a comment, per the existing pattern in `admin-client.ts` — keep this list short and reviewed
- [x] `requireRole()` used ahead of privileged service calls (subscription purchase/pause/resume, package CRUD, coach-change resolution, etc.)

### Data & Privacy

- [ ] `medical_notes` (client PII) — confirm RLS restricts to admin / owning coach / owning client only (per `client_profiles` policies) and that it is never included in any broadly-readable view
- [ ] No GDPR-style data export endpoint yet (`GET /users/me/export` equivalent) — not implemented
- [ ] Account/data deletion flow — not implemented; decide on soft-delete vs. hard-delete semantics for `profiles`/`client_profiles` before launch
- [ ] Storage bucket policies (`0013_storage_buckets.sql`) reviewed for public vs. authenticated read (avatars are public-read by design; coach certifications and progress photos are owner/admin/coach-scoped — confirm this matches intent before launch)

### Infrastructure

- [ ] No monitoring/error tracking configured (Sentry or equivalent)
- [ ] No structured logging — Supabase Dashboard logs are the only current visibility into DB/Auth activity
- [ ] `npm audit` — run and fix high/critical before each deploy; no CI gate for this yet
- [ ] No CI pipeline (lint/typecheck/test/audit) — see [§9](#9-ai-workflow-ci--git-hygiene) for the recommended minimal baseline
- [ ] HTTPS is enforced by Netlify/Vercel + Supabase by default in production — no action needed, just confirm no `http://` URLs are hardcoded anywhere

---

## 7. Frontend Architecture

### Supabase browser client

```typescript
// src/lib/supabase.ts — the ONLY client used from Client Components today
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

Unlike the generic blueprint's Axios + manual refresh-interceptor pattern, `supabase-js` handles token storage and refresh internally — there is no custom `tokenStore.ts`, `AuthProvider.tsx`, or single-flight refresh queue in this codebase, and none is needed for the client itself. What **is** missing (see [§4.6](#46-known-gaps-vs-this-blueprint)) is a place that reads the resulting session and gates rendering by role.

### Current auth flow (`LoginForm.tsx`)

```typescript
const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
if (authError) { setError(authError.message); return; }
router.push(redirectTo);
```

This is real Supabase authentication (not mock, despite `README.md`'s "any email/password logs you in" line, which describes the *original* prototype behavior before the Supabase migrations/services were added — that line is now stale and should be updated once Phase 2 wiring lands).

### Portal structure

Three role-based portals, each a route group under `src/app/` with its own `layout.tsx` wrapping the shared `PortalShell` (sidebar/nav + `supabase.auth.signOut()` on logout):

- `/client/*` — dashboard, book, coach, sessions, progress, profile, notifications
- `/coach/*` — dashboard, schedule, availability, clients/[id], session/[id], profile
- `/admin/*` — dashboard, clients/[id], coaches/[id], sessions, reports, coach-change-requests, settings

### Data fetching today vs. intended

- **Today:** every page under `src/app/` imports directly from `src/lib/mock-data.ts`. No TanStack Query, no Server Actions, no service-layer calls from any page.
- **Intended (Phase 2, per `docs/folder-architecture.md`):** pages read the session via `supabase.auth.getSession()`, pass the `access_token` into a `"use server"` action, which calls the matching `*.service.ts` function. Consider adding TanStack Query (or React Server Component data fetching) at that point for caching/invalidation — neither is installed today.

### Design system

- Colors: black `#000000`, brand yellow `#F5E400`, white, charcoal `#111111`
- Display font: Oswald (bold/italic) · Body font: Manrope
- Primary actions use the yellow accent; destructive actions use red outline + confirmation (`ConfirmDialog.tsx`)
- Shared primitives in `src/components/ui/`: `Button`, `Card`, `Badge`, `Modal`, `Avatar`, `ConfirmDialog`, `EmptyState`, `ProgressRing`, `Skeleton`, `StatCard`

---

## 8. Frontend Security Checklist

- [x] No tokens manually stored in `localStorage`/`sessionStorage` by application code — session persistence is entirely `supabase-js`'s responsibility (its own `localStorage` key, standard for SPA-style Supabase apps)
- [ ] Confirm this default (localStorage-persisted session) matches the project's risk tolerance; Supabase supports cookie-based SSR sessions (`@supabase/ssr`) if server-rendered auth-aware pages become a requirement — not currently used
- [ ] No `dangerouslySetInnerHTML` usage found in current components — re-check this before adding any rich-text/markdown rendering (progress notes, workout notes) and add DOMPurify at that point
- [ ] No client-side route guards (`RequireAuth`-equivalent) — see [§4.6](#46-known-gaps-vs-this-blueprint), this is the top security gap
- [ ] `npm audit` clean — verify before each deploy
- [ ] No hardcoded secrets in `src/` — verified: only `NEXT_PUBLIC_*` Supabase values and no service-role key in any client component
- [ ] Forms are not yet validated with a schema library (React Hook Form + Zod not installed) — `LoginForm.tsx` relies on native `required` attributes only; add schema validation once real forms (booking, profile edit, settings) are wired to the service layer
- [ ] Loading/error states — present in `LoginForm` (spinner + error banner pattern); audit other forms once wired to real data
- [ ] Image domains are allowlisted in `next.config.mjs` (`i.pravatar.cc`, `picsum.photos`, `images.unsplash.com`) — remove placeholder-photo domains before production launch and add real asset domains (Supabase Storage public bucket URL) instead

---

## 9. AI Workflow, CI & Git Hygiene

### Secrets and model context

- Never paste `SUPABASE_SERVICE_ROLE_KEY`, database passwords, or `.env.local` contents into chat. Use placeholders.
- Treat AI-suggested changes to `supabase/migrations/*.sql` and `0012_rls_policies.sql` as high-risk — review every policy change as carefully as an auth PR; a mis-scoped `USING`/`WITH CHECK` clause is the equivalent of skipping `assertOwnership()` in the generic blueprint.
- Never run a new migration file directly against production via the Supabase Dashboard without first reading the full diff — migrations here are hand-applied, not auto-run by a migration tool, so there's no dry-run safety net.

### Dependency and package safety

- Confirm package names on [npmjs.com](https://www.npmjs.com/) before installing anything an AI assistant suggests.
- Web search `"<package> npm"` + `"<package> security advisory"` before trusting a version — align with the [Version Safety Rule](#-version-safety-rule-read-first) at the top of this file.
- `package-lock.json` is committed — use `npm ci` for reproducible installs, not `npm install`, in any CI or deploy step.

### `.cursorignore` (recommended — does not exist yet)

```gitignore
.env
.env.*
!.env.example
node_modules/
.next/
out/
supabase/seed_step2_fix_roles.sql
supabase/seed_step3.sql
```

(The seed files aren't secret, but they contain example account data — worth excluding from casual AI context the same way.)

### Minimal CI baseline (recommended — none exists yet)

| Step | Command | Purpose |
|---|---|---|
| Install | `npm ci` | Reproducible installs |
| Lint | `npm run lint` | `next lint`, already scripted in `package.json` |
| Typecheck | `npx tsc --noEmit` | Currently would surface a large backlog since `strict: false` and build-time checks are disabled — budget time to fix incrementally rather than flipping `strict: true` in one PR |
| Build | `npm run build` | Confirms Netlify/Vercel build won't fail |
| SCA | `npm audit --audit-level=high` | Known vulnerable dependencies |

No test runner is installed (`npm test` script does not exist). Adding one (Vitest + React Testing Library is the natural fit for a Next.js/Vite-adjacent stack) is a prerequisite for a real CI test step.

---

## 10. Testing Guide (Postman + Supabase)

There's no custom REST API to collect in Postman, but Supabase auto-generates a REST layer (PostgREST) and exposes RPC functions over HTTP — both are testable directly, independent of the Next.js app, which is useful for verifying RLS policies and scheduling functions in isolation.

### Supabase REST/RPC via Postman

```
Base URL:    https://<project-ref>.supabase.co/rest/v1
Headers:     apikey: <anon-or-service-key>
             Authorization: Bearer <user-access-token-or-anon-key>
             Content-Type: application/json
```

| Test | Example |
|---|---|
| Read own profile (RLS) | `GET /profiles?id=eq.<uuid>` with a real user's access token → should return exactly one row |
| Read another user's protected data (RLS should block) | `GET /client_profiles?id=eq.<other-client-uuid>` as a non-admin, non-linked-coach user → should return zero rows, not an error |
| Call a scheduling function | `POST /rpc/create_temporary_booking` with body matching its param names — see `docs/scheduling-engine.md` |
| Verify cutoff enforcement | `POST /rpc/cancel_booking` on a booking starting in <12h as a non-admin client → should error per `reschedule_cutoff_hours` |
| Verify admin bypass | Same call authenticated as an admin → should succeed regardless of cutoff |

### Recommended test matrix per service function (once Server Actions exist)

| Test | How to trigger |
|---|---|
| Happy path | Valid `accessToken` + valid params |
| Not authenticated | Missing/invalid `accessToken` → `getCallerContext` throws |
| Wrong role | Valid session, wrong role → `requireRole` throws |
| RLS-blocked read | Valid session, resource not owned/linked → zero rows, not an error |
| Business-rule violation | e.g. cancel inside cutoff window, book overlapping slot → Postgres function raises |
| Admin override | Same violation, called by admin → should succeed where applicable |

### Manual smoke test (current app, mock-data-backed)

Since pages are still on `mock-data.ts`, "testing" today is manual UI walkthrough, not API testing:

```
1. / (landing) loads, portal CTAs link to /login/client, /login/coach, /login/admin
2. /login/client → real Supabase sign-in → redirect to /client/dashboard (no role check yet — verify manually)
3. Each portal's nav items render their respective page without runtime errors
4. Logout (PortalShell) calls supabase.auth.signOut() and returns to a logged-out state
```

---

## 11. Master Prompts

### 11.1 Wire a service into the UI (Phase 2 — the actual next milestone)

```
Wire <service function, e.g. bookings.service.ts's cancelBooking> into <page, e.g. src/app/client/sessions/page.tsx>.

Context:
- This is a Next.js 14 App Router app on Supabase. The service layer (src/lib/services/*.ts)
  and RLS policies already exist and are documented in docs/api.md — do not modify the
  Postgres schema or RLS policies for this task.
- The page currently reads from src/lib/mock-data.ts — replace that specific interaction with
  a real call, following the pattern documented in docs/folder-architecture.md:
    1. A "use server" Server Action in the same feature area, calling the service function
    2. The Client Component reads accessToken via supabase.auth.getSession() right before
       calling the action
    3. Handle both the thrown-error cases (Not authenticated / Forbidden / Postgres error)
       and the loading state — follow the existing loading/error pattern in LoginForm.tsx
- Do not add a global state library, TanStack Query, or any new dependency without asking first
  — check what's already installed in package.json.
- Verify the exact behavior against docs/business-rules.md and docs/scheduling-engine.md if the
  interaction touches booking/scheduling.
```

### 11.2 Add server-side route protection (highest-priority security gap)

```
Add session + role enforcement to the three portal layouts (src/app/client/layout.tsx,
src/app/coach/layout.tsx, src/app/admin/layout.tsx) or via a root middleware.ts.

Context:
- Today these layouts render PortalShell unconditionally — there is no check that a session
  exists, or that profiles.role matches the portal, before rendering. Anyone who navigates
  directly to /admin/dashboard sees it regardless of login state.
- Auth is Supabase Auth; the profiles table has a role column (admin/coach/client) — see
  docs/erd.md and src/lib/services/_auth.ts's getCallerContext() for the existing pattern
  used server-side.
- Decide between: (a) a root middleware.ts using @supabase/ssr for cookie-based session
  reading, or (b) a server-side check inside each layout.tsx using the existing request-client
  pattern. Recommend option (a) if we're willing to add @supabase/ssr as a dependency — verify
  its latest version and read its Next.js App Router integration docs first.
- After this change, unauthenticated or wrong-role access to a portal route must redirect to
  the matching /login/<role> page, not render any portal content.
```

### 11.3 Env validation + `.env.example`

```
Add Zod-based environment validation and a committed .env.example, matching the pattern already
used elsewhere on the team (see PROJECT_BLUEPRINT.md §3).

- Create src/lib/env.ts validating NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, and
  optionally SUPABASE_SERVICE_ROLE_KEY (server-only — do not import env.ts from any "use client"
  file if it touches the service-role key; keep the public/secret schemas separate if needed).
- Create backend .env.example at the repo root with the three variables and comments, no real
  values.
- Verify `zod`'s latest version via npm show before adding it as a dependency.
- Do not change any existing Supabase client files' behavior beyond sourcing values through the
  new validated env object.
```

### 11.4 Minimal CI baseline

```
Add a GitHub Actions workflow (.github/workflows/ci.yml) that runs on every PR:
1. npm ci
2. npm run lint
3. npx tsc --noEmit  — expect this to currently fail with a backlog of errors; report the count,
   do not attempt to fix all of them in this task unless asked
4. npm run build
5. npm audit --audit-level=high

Do not enable "typescript.ignoreBuildErrors" workarounds to force this green — surface the real
error count so it can be triaged separately (see PROJECT_BLUEPRINT.md §4.6 for known gaps).
```

---

## 12. Domain Notes — Scheduling / Personal Training

This project is already a fully-specified instance of the "Scheduling/Calendar" domain — the domain design work is done, not a template to fill in.

```
Domain: Live online personal training (LEANR by Fitelo)
Portals: Client, Coach, Admin — role stored in profiles.role
Primary resources: bookings, recurring_slots, temporary_bookings (slot holds), coach_availability,
                    coach_shifts, coach_leave, subscriptions, package_tiers, assessment_sessions,
                    coach_change_requests, shadow_coach_assignments, progress_logs, workout_notes,
                    attendance, notifications, audit_logs

Special mechanics already implemented (Postgres functions, docs/scheduling-engine.md):
- Slot holds: create_temporary_booking() reserves a slot for temporary_booking_hold_minutes (10)
  before confirm_booking() finalizes it — prevents double-booking during the UI's confirm step
- Conflict detection: has_scheduling_conflict() checks proposed bookings against a coach's
  existing bookings, leave, and working hours (is_slot_within_working_hours())
- Recurring slots: generate_bookings_from_recurring_slot() materializes individual bookings from
  a client's standing weekly slot
- Cutoff enforcement: cancel_booking() / reschedule_booking() check reschedule_cutoff_hours
  unless the caller is admin
- Coach continuity: coach_change_requests + assign_shadow_coach() handle both permanent
  coach reassignment and temporary shadow-coach coverage, reassigning active recurring slots
  and upcoming bookings on approval
- Missed-session handling: mark_missed_bookings() (callable, not yet scheduled — see §4.6)

Deliberate scope boundaries (see docs/business-rules.md — do not "fix" these without a product
decision first):
- No payment/refund processing — subscriptions model session balances only
- No automated cron — scheduling functions are callable, not scheduled
- No email/push/WhatsApp dispatch — notifications.channels is a placeholder schema only
- Coach schedule visibility (availability/shifts/leave/booking timing) is broadly readable by
  any authenticated user, by design, so client-side conflict UI can work against real data
```

---

## 13. Document Maintenance

**When to update this file:**

- When Phase 2 lands (pages wired to the service layer via Server Actions) — update §4.5, §7's "Data fetching today vs. intended" section, and re-check every unchecked box in §6/§8.
- When `middleware.ts` / route guards are added — flip the corresponding §6/§8 items and update §11.2 (it will no longer be an open task).
- When a payment provider, email/push dispatcher, or cron scheduler is chosen — update §1 (Tech Stack), §4.6, and §12's scope-boundaries list; add a new domain add-on section if the integration is substantial.
- When `strict: true` is enabled or build-time lint/type checks are re-enabled in `next.config.mjs` — update §4.6.
- Whenever `docs/api.md`, `docs/business-rules.md`, `docs/erd.md`, or `docs/scheduling-engine.md` change — this file only links to them and summarizes key points; keep summaries in sync but treat those files as the source of truth for full detail.

**Security review triggers:**

- Any change to `0012_rls_policies.sql`
- Any change to which service functions use `admin-client` (RLS bypass)
- Any new public (unauthenticated) entry point — e.g. `createAssessmentBooking` — needs a rate-limiting decision
- Any change to Supabase Auth redirect URLs / site URL configuration
- Any new Storage bucket or change to bucket public/private visibility

**AI assistant instruction:** When using this document as context, follow the [Version Safety Rule](#-version-safety-rule-read-first): web search for each dependency before adding/upgrading it, confirm with `npm show <pkg> version`, state what you verified, and never copy semver literals from this file into `package.json`. Treat §4.6's "Known gaps" list as the current, honest state of the project — don't assume something is implemented because a generic blueprint would normally have it.

---

*This document describes the LEANR codebase as it exists today (Phase 1: schema, RLS, and service layer complete; Phase 2: UI wiring not started). Update it as the project moves, rather than treating it as fixed.*

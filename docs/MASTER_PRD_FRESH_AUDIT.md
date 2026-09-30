# LEANR by Fitelo — Master Product Requirements Document
## (Fresh, Code-Derived Audit — Web Application as Source of Truth, for Web + Mobile Unification)

**Document status:** Independently derived from the live source code of the existing web application (`LeanR-PT-main`) as of 2026-09-03. This document deliberately does **not** rely on, quote, or assume the correctness of any pre-existing `docs/*.md`, `LEANR_PT_MOBILE_PRD.md`, or `README.md` file in the repository — those were explicitly excluded from this audit per the requesting stakeholder's instruction, on the theory that the running code is the only trustworthy source of truth. Every claim below is traceable to a specific file, function, migration, or component in the actual codebase.

**Repository root audited:** `LeanR-PT-main/` (Next.js 14, App Router, TypeScript, Supabase, Razorpay, Zoom, Resend, MSG91).

**Method:** Eight independent deep-reads of the actual source — database migrations (all 57 files), backend business logic (services + server actions, ~70 files, split across three domain audits: payments/booking/scheduling; coach lifecycle; client/admin operations & auth), and frontend screens (client portal, coach portal, admin portal, public/marketing/auth/design system) — each verifying behavior against the literal code rather than any design intent or prior documentation. Findings were then cross-referenced and reconciled into this single document.

---

## Table of Contents

1. Executive Summary
2. Existing Application Audit (Methodology & Scope)
3. Product Overview
4. Product Goals
5. User Roles
6. Permission Matrix
7. Current Web Application Architecture
8. Proposed Web + Mobile Architecture
9. Information Architecture
10. Complete Screen Inventory
11. Screen-by-Screen Requirements (see §16–18 for full detail, organized by portal)
12. User Journeys
13. Business Workflows
14. Conditional Logic
15. Status / State Machines
16. Client Portal
17. Coach Portal
18. Admin Portal
19. Public / Landing Experience
20. Authentication
21. Profiles
22. Plans
23. Payments / Razorpay
24. Sessions
25. Zoom
26. Availability
27. Scheduling
28. Attendance
29. Session Notes
30. Feedback & Ratings
31. Progress & Measurements
32. Chat
33. Notifications
34. Escalations
35. Renewals
36. Coach Changes
37. Leave Management
38. Shadow Coverage
39. Search
40. Reports
41. Activity Logs
42. Database Specification
43. API Specification
44. Integration Specification
45. Web–Mobile Synchronization
46. Security & Permissions
47. Error Handling
48. Existing Edge Cases
49. Acceptance Criteria
50. Web vs Mobile Feature Matrix
51. UI/UX Requirements
52. Recommended Improvements
53. Open Questions / Undetermined
54. Implementation Dependencies
55. Development Phases

---

# 1. Executive Summary

LEANR by Fitelo is a live, production Next.js 14 + Supabase web application delivering **1:1 online personal training** as a three-sided marketplace: **clients** (who buy session packages and train live over Zoom with an assigned coach), **coaches** (who hold a weekly availability template, run sessions, and log outcomes), and **admin/ops staff** (who manage the entire operational lifecycle — coach assignment, leave, escalations, renewals, payments, reporting). The product is not a content or on-demand app: every session is a scheduled, live, one-on-one video call between a specific client and a specific coach, booked against a purchased session package.

The system is built as a single Next.js application that is **built three separate times** (`.next`, `.next-admin`, `.next-client`, `.next-coach` build outputs observed in the repo) but shares one codebase, one Supabase Postgres database, and one set of Server Actions/services — there is **no separate REST/GraphQL API layer**; the browser talks to Next.js Server Actions, which talk to Supabase (Postgres + Auth + Storage) directly, with **Postgres Row-Level Security (RLS) as the primary authorization boundary**, not application code. This has a direct, load-bearing consequence for a mobile rebuild (see §8, §45): a mobile client cannot simply "call the API" — it must either (a) reuse Supabase's client SDK against the same RLS-protected tables/RPCs, or (b) have a new thin HTTP wrapper built around the existing service-layer functions. This decision is the single most important architectural fork point for the mobile project and is called out explicitly as an open question in §53.

The product is commercially live: real Razorpay payment integration (signature-verified Checkout + webhook reconciliation), real Zoom meeting provisioning (server-to-server OAuth, one shared business account), real email (Resend) and SMS (MSG91) delivery, and a 57-migration-deep Postgres schema with mature RLS policies, audit triggers, and business-rule-enforcing database functions (RPCs). It also carries real, identified rough edges — a hard-coded temporary bypass on phone-number verification, a non-functional "Forgot password" button, a dormant/never-live paid-demo payment path, and at least one confirmed gap in the shadow-coach-coverage lifecycle (no automatic reversion back to the primary coach) — all catalogued precisely in §48 and §52 so that a mobile rebuild reproduces actual behavior rather than an idealized version of it.

This document's purpose is to be the single, exhaustive, code-verified specification of everything the web application currently does, so that a mobile application can be built as **a second interface to the same backend and database** — same users, same sessions, same payments, same coach relationships — without needing to rediscover any of this by re-reading the source.

---

# 2. Existing Application Audit (Methodology & Scope)

This PRD was produced by eight independent, code-only research passes, each explicitly instructed to ignore all pre-existing documentation and read only:
- `supabase/migrations/*.sql` (57 files, 0001 through 0057) — full schema, enums, RLS, functions, triggers, views, storage buckets.
- `src/lib/services/*.ts` (35 files) and `src/lib/actions/*.ts` (34 files) — every exported function's logic, validation, and side effects.
- `src/app/client/**`, `src/app/coach/**`, `src/app/admin/**`, `src/app/(marketing)/**`, `src/app/login/**`, `src/app/signup/**`, `src/app/auth/**`, and their corresponding `src/components/**` — every route, page, and client component.
- `src/middleware.ts`, the three Supabase client wrappers (`src/lib/supabase/{admin-client,request-client,server-client}.ts`), `src/app/globals.css`, `tailwind.config.ts`, and `src/components/ui/*`.

Two cross-checks were explicitly performed: (a) every claim about a database entity was checked against the *final* state of the schema after all 57 migrations, not any single migration in isolation (since later migrations frequently correct earlier ones — see §42's "schema evolution" notes); (b) every claim about business logic was checked against the literal code path (branches, thrown error strings, exact numeric thresholds), not inferred intent.

**Explicitly out of scope / not independently re-verified in this pass:** the internals of a handful of shared UI primitives used only by reference (`ConversationThread`, `MeasurementChart`, `ClientTimeline`'s exact prop contracts) were documented from their call sites rather than read line-by-line; these are noted in §53.

---

# 3. Product Overview

**What LEANR is:** An online personal-training marketplace. A client purchases a fixed-size session package (e.g., "24 sessions"), is matched to a coach, sets up a recurring weekly schedule (e.g., Mon/Wed/Fri at 7 AM), and trains live over Zoom for the duration of the package. Coaches manage their own leave and clients; admins run the operational back office (coach assignment/reassignment, leave approval with automatic shadow-coach coverage, escalation resolution, renewals, reporting, and platform settings).

**What LEANR is not (confirmed by absence in the code, not assumption):**
- Not an on-demand/content library — there are no pre-recorded workout videos anywhere in the codebase.
- Not a marketplace where clients browse and choose their own coach up front — coach matching is algorithmic (utilization-balanced, or specialization/language/rating-scored for shadow coverage), not a client-facing directory/browse experience.
- Not multi-tenant — one Zoom business account serves the entire platform; there is no white-labeling or per-org configuration.
- Does not currently process refunds or move money for pauses/adjustments — "Log Refund Request" is an audit-trail-only action (§34/§48); there is no payment gateway refund integration.

**Core entities** (see §42 for full schema): `profiles` (identity+role) → `client_profiles`/`coach_profiles` (role-specific extensions) → `subscriptions` (a purchased package instance) → `recurring_slots` (a weekly pattern) → `bookings` (a concrete scheduled session) → `attendance`/`workout_notes` (per-session outcome). Supporting entities: `payments` (Razorpay ledger), `escalations` (client concerns), `coach_change_requests`, `coach_leave`, `shadow_coach_assignments`, `conversations`/`messages` (chat), `notifications`, `audit_logs`, `client_timeline_events`, `system_settings`.

---

# 4. Product Goals

Inferred from the shipped feature set (not from any roadmap document, since those were excluded from this audit):
1. **Coach continuity** — a client keeps the same coach for the life of a plan wherever possible; coach changes and shadow-coverage are exception-handling mechanisms, not the default flow (evidenced by the entire shadow-coach-scoring/matching engine existing solely to *preserve* continuity during a coach's leave, §38).
2. **Operational automation with a human safety net** — booking, slot generation, missed-session detection, and shadow-coverage assignment are all automatic (RPC/sweep-driven), but every "nothing available" outcome (unmatched schedule, uncovered shadow slot) explicitly notifies an admin rather than silently failing (§13, §48).
3. **Server-enforced business rules, not just UI hints** — nearly every cutoff, cap, and gate identified in this audit (cancellation cutoff, reschedule cutoff/weekly cap, weekly measurement cadence, session-credit balance, two-step attendance→notes gate) is enforced in the service layer or a Postgres function/RLS policy/trigger, not merely in client-side JavaScript (§14, §46).
4. **A single, shared operational record per client** — the `client_timeline_events` table is an append-only, cross-cutting narrative (coach assignment, pauses, escalations, status changes) that every portal (client/coach/admin) reads from, establishing the pattern a mobile client must also read from rather than re-deriving.
5. **Revenue continuity via renewals**, not one-off sales — the dual-threshold renewal system (§35) exists specifically to catch a client before their package runs out, both from the client's own dashboard and from staff-facing "Renewal Opportunities" lists.

---

# 5. User Roles

Exactly **three** authenticated roles exist, stored in a single Postgres enum `user_role ('admin','coach','client')` on `profiles.role` (migration `0001`). There is no sub-role, tenant-admin, or "super admin" tier. A fourth, unauthenticated "visitor/prospect" state exists for the public marketing site and the logged-out "free assessment" lead-capture flow (`assessment_sessions` table, no auth account required).

### CLIENT
- **Login:** email/password (self-serve signup) or Google OAuth (self-serve, always provisions role `client` — no code path lets a Google sign-in become coach/admin). Phone number is separately OTP-verified (or, currently, skippable — see §48).
- **Access:** `/client/**` only, enforced by `middleware.ts` + RLS.
- **Core loop:** buy plan → activate (pick start date) → onboard (health/goals intake) → set recurring schedule → attend sessions → track progress → renew.
- **Editable:** own name/phone/photo/emergency contact, own goals/equipment/medical notes, own weekly progress logs (capped at 1/7 days), own password.
- **Cannot edit:** subscription status/sessions/pause-days directly (admin-only), coach assignment directly (must request a change), escalation resolution fields.

### COACH
- **Login:** email/password only — **no self-serve signup**; accounts are provisioned exclusively by an admin (`createCoach`, via the Supabase service-role Admin API). No Google OAuth path exists for coaches.
- **Access:** `/coach/**` only.
- **Core loop:** log in → see today's/pending tasks → join session → mark attendance → submit session notes → manage own leave requests → view (read-only) escalations/performance.
- **Editable:** own phone/emergency contact/photo, own password, can *append* (never remove) skills.
- **Cannot edit:** own name, specialization, bio, certifications, languages, working hours (all admin-owned), cannot resolve/respond to escalations (admin-only), cannot cancel/reschedule sessions (no such action exists in the coach action file set — confirmed by absence).

### ADMIN
- **Login:** email/password only, own dedicated `/login/admin` route. No self-serve signup; admin accounts are provisioned directly (out of band, e.g. via Supabase dashboard or seed data — no in-app "create admin" action was found).
- **Access:** `/admin/**` — the full operational surface: client/coach CRUD, scheduling/availability overrides, leave/coach-change/shadow-coverage approval workflows, escalation resolution, renewals, sales, reports, activity log, and platform settings.
- **Editable:** everything a client or coach can edit about themselves, plus subscription status/session counts/pause-days, coach profiles (professional fields), coach working hours, package catalog, and the four exposed global `system_settings` (§24, §46).

### VISITOR / PROSPECT (unauthenticated)
- Can browse the public marketing site, view active packages, and book a **free assessment session** via a lead-capture form (`createAssessmentBooking`, writes to `assessment_sessions`, not `bookings` — no account required). Can sign up (becomes a `client`) or log in.

---

# 6. Permission Matrix

Derived from the RLS policies (migration set, esp. `0012`/`0033`/`0045`) and the `requireRole()` calls in every service function — RLS is the actual enforcement layer; `requireRole()` is a redundant, friendlier-error second layer in front of it (see §46 for the full authorization-architecture writeup).

| Feature / Data | Client | Coach | Admin |
|---|---|---|---|
| View own profile | Yes (own row only) | Yes (own row only) | Yes |
| Edit own profile (name/phone/photo/emergency contact) | Yes | Yes (phone/emergency/photo only — name is admin-owned) | Yes |
| View client identity (name/photo) | Own only | **Any** client (post-migration `0033`, "global search") | All |
| View client profile detail (goals/medical/progress) | Own only | **Assigned** clients only (progress_logs never widened to "any coach" — health data kept stricter than identity) | All |
| Edit client profile (goals/equipment/medical notes) | Own, self-service, no approval | No | No dedicated action found — admin's write surface on a client is subscription/pause/coach-transfer/refund-log/onboarding-correction, not `client_profiles` fields directly |
| Change own coach | Request only (`requestCoachChange`, needs admin approval) | N/A | Full — direct reassignment (`reassignClientCoach`) or resolve a client's request |
| View sessions | Own only | Own (assigned) clients' sessions | All |
| Book / cancel / reschedule own session | Yes (cutoff-gated: 12h cancel, 1h reschedule, 2/week reschedule cap) | No booking/cancel/reschedule action exists for coaches | Yes, cutoff-exempt (`enforceCutoff = role !== 'admin'`) |
| Mark attendance / submit session notes | No | Yes, own sessions only, server-gated sequence (join→end-time→attendance→notes) | No dedicated action found (admin doesn't run sessions) |
| Manage own availability (weekly working hours) | N/A | **Read-only** (write access revoked in migration `0045`) | Full (sets any coach's hours) |
| Request / approve leave | N/A | Request only (24h notice, no bypass) | Approve/reject; approval auto-triggers shadow-coverage matching |
| Assign shadow coach | N/A | N/A (read-only view of own assignments) | Full (automatic on leave-approval, or manual preview→confirm tool) |
| Raise / view escalations | Raise own, view own | View own clients' (read-only, cannot resolve) | Full lifecycle (call-gate → classify → note → resolve) |
| Resolve escalations | No | No | Yes — hard-gated behind `confirmCalledClient` |
| View renewal opportunities | Only own "running low" nudge | Own clients | All clients |
| Manage subscriptions (pause/resume/adjust) | Pause/resume own (self-service) | No | Full, including session-count and pause-days-allowed adjustment |
| Manage package catalog | No | No | Full (create/edit/soft-delete) |
| View/edit platform settings | No | No | Yes (4 exposed numeric settings) |
| View audit log | No | No | Yes (200-row cap, filterable) |
| Chat | With current coach only, while conversation `active` | With currently-assigned client only, while `active`; retains read of own closed threads | Full read of every client's chat history across all coaches (no write) |
| Search clients | No client-search UI | **Global** (any client, platform-wide) | Global |

---

# 7. Current Web Application Architecture

**Stack:** Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS, Supabase (Postgres + Auth + Storage + Realtime), Razorpay (payments, raw REST + HMAC, no SDK), Zoom (Server-to-Server OAuth REST API, no SDK), Resend (email), MSG91 (SMS/OTP), `framer-motion`/`@react-three/fiber`/`lenis` (marketing-site animation/3D/smooth-scroll), `recharts` (charts), `jspdf`/`jspdf-autotable` (client-side PDF report export). Deployed on Vercel (a `vercel.json` cron entry drives the one time-based job — session reminders) with a Netlify config also present (`netlify.toml`, `@netlify/plugin-nextjs`) — **two deployment targets are configured**, worth confirming which is authoritative for production (see §53).

**Multi-build note:** the repo contains four separate Next.js build output directories (`.next`, `.next-admin`, `.next-client`, `.next-coach`), each with its own `package.json`/manifest — strongly suggesting the three portals (admin/client/coach) are built and possibly deployed as **separate Next.js instances of the same codebase** (a common pattern for giving each portal its own subdomain/scaling profile while sharing all source code). This is worth confirming operationally (see §53) but does not change the application-layer architecture described in this document, since all three share identical `src/lib` business logic.

**No REST/GraphQL API layer.** The browser talks to:
1. **Next.js Server Actions** (`"use server"` functions in `src/lib/actions/*.ts`) — the dominant pattern; each resolves the caller's Supabase access token from cookies, delegates to a `src/lib/services/*.ts` function, and returns a discriminated-union `ActionResult` (`{success, data}` or `{success:false, error:{code,message}}`) via a shared `runAction()` wrapper.
2. **Two real HTTP Route Handlers** (the only two): `POST /api/webhooks/razorpay` (server-to-server payment reconciliation) and `GET /api/cron/session-reminders` (Vercel Cron trigger). Neither is a general-purpose API — both are single-purpose integration endpoints.
3. **Direct Supabase client calls from a few client components** for things a Server Action can't do server-side conveniently: Storage file uploads (avatars, chat attachments), `supabase.auth.signInWithPassword/signUp/signInWithOAuth/updateUser`, and Realtime subscriptions (`postgres_changes` on `messages` for live chat).

**Three-layer authorization** (see §46 for full detail): (1) `middleware.ts` route-level role gate (JWT-claims-based, DB-fallback); (2) `requireRole()` inside each service function (early, friendly rejection); (3) **Postgres RLS on every table**, which is the actual, non-bypassable enforcement layer — application code cannot violate it even if (1) and (2) were removed. A small number of BEFORE UPDATE triggers (migration `0052`) close a genuine gap RLS cannot express on its own (column-level, not just row-level, restrictions on `bookings` and `messages`).

**Three Supabase client wrappers**, each with a distinct trust level:
- `supabaseAdmin` (`admin-client.ts`) — service-role key, **bypasses RLS entirely**, server-only (`import "server-only"`), reserved for privileged/cross-user operations (notifications for another user, audit writes, coach account creation, timeline events).
- `getRequestClient(accessToken)` (`request-client.ts`) — anon key + the caller's own JWT attached; **RLS applies as that specific user**. This is what the vast majority of service functions actually query through.
- The cookie-aware SSR client (`server-client.ts`) — used only to read/refresh the session and hand the access token to the two clients above.

**Directory map** (for a mobile rebuild's cross-reference):
```
src/app/{client,coach,admin}/**        — the three portals (pages + route-colocated client components)
src/app/(marketing)/**                 — public landing page
src/app/login/{client,coach,admin}/**  — three role-specific login pages
src/app/signup/**                      — client-only self-serve signup
src/app/auth/callback/**               — Google OAuth landing route
src/app/api/webhooks/razorpay/**       — payment webhook
src/app/api/cron/session-reminders/**  — the one scheduled job
src/components/{client,coach,admin}/** — portal-specific React components
src/components/shared/**               — PortalShell (nav shell), chat, misc cross-portal widgets
src/components/ui/**                   — design-system primitives
src/lib/services/**                    — business logic (35 files)
src/lib/actions/**                     — Server Action wrappers around services (34 files)
src/lib/supabase/**                    — the three client wrappers
src/middleware.ts                      — route-level role gate
supabase/migrations/**                 — 57 SQL migrations, the actual schema/RLS/RPC source of truth
```

---

# 8. Proposed Web + Mobile Architecture

Per the stakeholder's explicit requirement, the mobile app must be a **second interface to the same backend and database**, not a parallel product. Given §7's finding that there is no existing REST/GraphQL API layer — only Server Actions (which are Next.js-internal, RSC-wire-protocol calls not directly invokable from a React Native/native mobile client) and direct Supabase SDK calls — there are exactly two viable architectures, and this is the single biggest decision the mobile project must make before writing code:

**Option A — Mobile talks to Supabase directly** (same pattern as the web app's own `ctx.client` calls): the mobile app uses the Supabase client SDK (`@supabase/supabase-js` via a React Native-compatible wrapper) with the same anon key, authenticates the same way (email/password, Google OAuth via Supabase's mobile OAuth flow, or the same MSG91 phone-OTP action — which would need to be exposed as a callable endpoint, since it's currently a Server Action, not a Supabase Edge Function), and relies on the **exact same RLS policies and Postgres RPCs** already documented in §42. Business logic currently living in `src/lib/services/*.ts` (TypeScript) would need to be either (a) duplicated in the mobile client, (b) ported to Postgres functions/RPCs (some already are — see §42 §4), or (c) exposed via a new thin API layer (Option B) that both web and mobile call.

**Option B — Introduce a real API layer**: wrap the existing `src/lib/services/*.ts` functions in actual HTTP Route Handlers (Next.js Route Handlers, same pattern already used for the two existing ones), and have **both** the web app's Server Actions and the new mobile app call this API. This adds a migration cost (rewriting ~34 action files as ~34 route handlers) but avoids duplicating business logic and keeps a single, auditable request path for both platforms.

This PRD does not choose between them (that is a genuine architecture decision for the mobile team, flagged again in §53 as an open question) but documents the implication either way: **whichever is chosen, the underlying source of truth — the Postgres schema, RLS policies, and RPC functions in §42 — does not change**, and every business rule, cutoff, and status transition catalogued in §13–§41 must be reproduced identically, not reinterpreted.

```
                  COMMON BACKEND (Supabase: Postgres + Auth + Storage + Realtime)
                  + business logic, currently TS services (Option A) or a new API layer (Option B)
                                         │
                     ┌───────────────────┴───────────────────┐
                     │                                        │
                 WEB APP (Next.js,                      MOBILE APP (new,
                 3 portals, this PRD's                  React Native or native,
                 entire §16–41 spec)                    same spec reproduced)
                     │                                        │
                     └───────────────────┬───────────────────┘
                                         │
                              COMMON DATABASE (Postgres, §42)
                                         │
                         ┌───────────────┼───────────────┐
                         │               │               │
                    Razorpay          Zoom          Resend / MSG91
                 (§23, HMAC-verified)  (§25)          (§33 notifications)
```

**Single source of truth entities** (must never fork into a separate mobile-only table or state): `profiles`/`client_profiles`/`coach_profiles`, `subscriptions`, `payments`, `bookings`/`recurring_slots`/`temporary_bookings`, `coach_availability`/`coach_shifts`/`coach_leave`, `attendance`/`workout_notes`, `progress_logs`, `conversations`/`messages`, `notifications`, `escalations`/`escalation_notes`, `coach_change_requests`, `shadow_coach_assignments`, `client_timeline_events`, `audit_logs`, `system_settings`.

---

# 9. Information Architecture

### Public / Landing (unauthenticated, `src/app/(marketing)/**`)
Single-page marketing site: Navbar → Hero → TrustBar → CoachingShowsUp → WhatIsLeanR → HowItWorks → Coaches → ReadyWhenYouAre → PricingSection (data-driven from active packages) → WhyLeanR → Testimonials → Footer. Three login entry points (Client/Coach/Admin) and one signup entry point, all in the Navbar/Footer. See §19 for full detail.

### Client Portal Navigation (`PortalShell`, role="client")
Dashboard, My Sessions, Book a Session (hidden once subscribed), My Schedule, My Chats (hidden until any chat exists), My Coach, Subscription, Progress, My Concerns, Notifications, Profile. See §16.

### Coach Portal Navigation
Dashboard, Schedule, Clients, Renewal Opportunities, My Chats, Search, Escalations, Performance, Availability, Notifications, Profile. See §17.

### Admin Portal Navigation
Dashboard, Search, Clients, Renewal Opportunities, Coaches, Sessions, Sales, Scheduling, Availability Check, Coach Change Requests, Leave Requests, Shadow Coverage, Escalations, Notifications, Activity Log, Reports, Settings. See §18.

Each portal's nav is rendered by one shared component (`PortalShell.tsx`) parameterized by `role` — this is a strong signal for mobile information architecture: the three portals are structurally parallel (same shell, same badge/notification patterns), which the mobile app's own three-role bottom-nav structure should mirror rather than reinvent per role.

---

# 10. Complete Screen Inventory

**Client Portal — 18 routes + 3 global gate modals:**
`/client` (redirect), `/client/dashboard`, `/client/activate`, `/client/onboarding`, `/client/book`, `/client/demo-booking`, `/client/plans`, `/client/coach`, `/client/concerns`, `/client/chats`, `/client/sessions`, `/client/schedule`, `/client/progress`, `/client/renewal-checkin`, `/client/subscription`, `/client/notifications`, `/client/profile`; plus global gates: PhoneGateModal, MeasurementGateModal, SessionsLowGateModal.

**Coach Portal — 13 routes:**
`/coach` (redirect), `/coach/dashboard`, `/coach/schedule`, `/coach/clients`, `/coach/clients/[id]`, `/coach/renewals`, `/coach/chats`, `/coach/search`, `/coach/escalations`, `/coach/performance`, `/coach/availability`, `/coach/notifications`, `/coach/profile`, `/coach/session/[id]`.

**Admin Portal — 25 routes:**
`/admin` (redirect), `/admin/dashboard`, `/admin/clients`, `/admin/clients/new`, `/admin/clients/[id]`, `/admin/coaches`, `/admin/coaches/new`, `/admin/coaches/[id]`, `/admin/escalations`, `/admin/escalations/[id]`, `/admin/leave-requests`, `/admin/coach-change-requests`, `/admin/shadow-coverage`, `/admin/scheduling`, `/admin/availability`, `/admin/search`, `/admin/sessions`, `/admin/sessions/[id]`, `/admin/sales`, `/admin/renewals`, `/admin/reports`, `/admin/notifications`, `/admin/activity-log`, `/admin/settings`.

**Auth / Public — 8 routes:**
`/` (marketing landing), `/login/client`, `/login/coach`, `/login/admin`, `/signup`, `/auth/callback` (OAuth landing, no UI), `not-found` (404).

**Total: 64 distinct routes** across all portals plus the marketing site, not counting the modal-based flows layered on top of them.
# 12. User Journeys

## 12.1 New Client Acquisition (Visitor → Active Client)
Marketing site → `/signup` (or Google OAuth) → email+phone OTP verification (or the temporary skip bypass, §48) → `/client/plans` → purchase (Razorpay, §23) → `/client/activate` (pick start date) → `/client/onboarding` (health/goals intake) → `/client/schedule` (recurring pattern + coach match, §27) → first session.

## 12.2 Alternative Entry: Free Demo First
Marketing site (or a not-yet-subscribed client's dashboard) → `/client/demo-booking` (date/time/gender preference only, system auto-assigns coach) → free `assessment`-type booking created → demo session runs (coach side identical to a regular session, §17.15) → post-demo feedback gate (optional rating) → `/client/plans` → same purchase→activate→onboard→schedule path as §12.1.

## 12.3 Renewal (Existing Client)
Client's `sessionsRemaining` drops to ≤5 (client-facing nudge) or ≤10 (staff-facing opportunity, §35) → client (or staff, off-platform) initiates a new purchase via the same `/client/plans` Razorpay flow → new `subscriptions` row created (old one is superseded, not deleted, at activation) → `renewal_checkin` stage (fresh baseline measurement, bypassing the weekly cap) → `renewal_scheduling` stage → either "Keep My Schedule" (repoint existing pattern) or full re-pick via the scheduling wizard.

## 12.4 Coach's Daily Operational Loop
Login → Dashboard (7 KPIs + Today's/Pending Tasks + Upcoming 3 days) → for each due session: Join (§25) → wait for session end → mark Attendance (Present/Late/Absent, §28) → if present/late, submit Session Notes (§29, closes the booking) → repeat. Independently: manage own Leave requests (§37), view (read-only) Escalations/Performance, respond to chat messages (§32).

## 12.5 Admin's Operational Loop
Login → Dashboard (platform KPIs) → work the approval queues (Leave Requests, Coach Change Requests, Shadow Coverage gaps, Escalations — each a distinct gated workflow, §34/§36/§37/§38) → periodic client/coach management (search, detail, manual adjustments) → Reports/Sales/Activity Log for oversight → Settings for platform-wide tuning.

---

# 13. Business Workflows

Presented in the requested trigger→precondition→…→final-state form, for every major workflow confirmed to exist in the code.

### Workflow: Client Journey-Stage Resolution (the master gate underlying almost every client screen)
```
Trigger: any /client/* page load
↓
Precondition: none (always runs)
↓
Backend processing: getMyLatestSubscription →
  no subscription → getMyLatestDemoSession → upcoming? "demo_booked" : completed/missed? "demo_completed" : "marketing"
  subscription.status === "awaiting_activation" → "awaiting_activation"
  subscription.status === "active":
    no onboarding row → "onboarding"
    else checkRenewalStage (only meaningful if the client has >1 subscription ever):
      activatedAt set, no progress_logs since activation → "renewal_checkin"
      else no recurring_slots tied to THIS subscription → "renewal_scheduling"
    else no active recurring_slots at all → "slot_selection"
    else → "active" (default dashboard experience)
  subscription.status in (paused, inactive) with nothing newer → falls through to the "no subscription" branch above (never a dead end)
↓
UI update: the requesting page redirects or branches based on the returned stage
↓
Final state: exactly one of 9 stages, re-evaluated on every page load (not cached/persisted)
```

### Workflow: Session Booking (Ad-hoc / First Session)
```
Trigger: client submits "Confirm Booking" on /client/book
↓
Precondition: measurements not stale (getMeasurementStatus) — hard server gate, throws otherwise
↓
User action: selects an open slot from a 2-week grid
↓
Validation: is_slot_within_working_hours + has_scheduling_conflict (both DB RPCs, re-checked at hold AND at confirm)
↓
Backend processing: holdSlot (create_temporary_booking, 10-min hold) → confirmHold (confirm_booking: re-checks conflict, checks session-credit balance if a real subscription is involved, inserts the bookings row at status="upcoming")
↓
Database update: temporary_bookings row → confirmed; bookings row inserted
↓
External integration: none yet (Zoom meeting is created lazily on first join, not here)
↓
Notification: session_booked_client / session_booked_coach (or demo_booked_* for an assessment)
↓
UI update: success card, "Back to Dashboard" / "View My Sessions"
↓
Other affected users: the coach's schedule now shows this booking
↓
Audit log: DB trigger auto-captures the bookings INSERT
↓
Final state: bookings.status = "upcoming"
```

### Workflow: Payment → Plan Activation (full detail in §23)
```
Trigger: client clicks "Purchase Plan"
↓
Precondition: no existing active/awaiting_activation subscription
↓
User action: completes Razorpay Checkout
↓
Validation: HMAC-SHA256 signature verification (client callback path) AND independently via webhook (server-to-server safety net)
↓
Backend processing: purchaseMyPlan → subscriptions row inserted at "awaiting_activation"
↓
Database update: payments.status → "paid"; subscriptions row created
↓
Notification: plan_purchased_client
↓
UI update: "Congratulations!" modal → dismiss → dashboard
↓
Other affected users: none yet (no coach assigned until schedule setup)
↓
Audit log: DB trigger captures the subscriptions INSERT
↓
Final state: client redirected by the journey gate to /client/activate next
```

### Workflow: Session Completion (Coach side, full detail in §28/§29)
```
Trigger: coach clicks "Present"/"Late"/"Absent" on a due session
↓
Precondition: session has ended (scheduled_start + duration < now); for today's sessions, coach must have already clicked Join
↓
Backend processing: markAttendance → attendance row upserted; if Absent → booking flips straight to "missed", terminal
↓
Notification: attendance_present_client/coach or attendance_absent_client/coach
↓
[If present/late] User action: coach fills Session Notes (Summary required) → submitSessionNotes
↓
Validation: attendance must be present/late (server-enforced, independent of UI)
↓
Database update: workout_notes row inserted; bookings.status → "completed"
↓
Audit log: DB trigger captures the bookings UPDATE
↓
Final state: bookings.status ∈ {completed, missed}, terminal either way
```

### Workflow: Coach Leave → Automatic Shadow Coverage (full detail in §37/§38)
```
Trigger: admin clicks "Approve" on a pending leave request
↓
Precondition: request status = "pending"
↓
Backend processing: coach_leave.status → "approved"; notify the coach AND every one of their active clients;
  for each affected client, findShadowCoachCandidates (per-occurrence, leave-aware) → planShadowAssignments (greedy, grouped) → assignShadowCoach per planned group
  cascade: any client this coach was themselves shadow-covering for someone else → reassignShadowCoverage
↓
Database update: shadow_coach_assignments rows inserted ("active"); affected bookings.coach_id repointed to the shadow coach
↓
Notification: leave_approved (coach), coach_on_leave_client (every active client), shadow_coach_assigned (affected clients), shadow_assignment_for_coach (shadow coaches), admin_alert (any occurrence with zero available candidates)
↓
UI update: admin sees an inline "Shadow coverage auto-assigned" / "Needs manual assignment" summary
↓
Other affected users: shadow coach's own schedule now shows these sessions
↓
Final state: bookings for the leave window point at the shadow coach; NO automatic reversion exists once the leave ends (confirmed gap, §38/§52)
```

### Workflow: Escalation Resolution (full detail in §34)
```
Trigger: client raises a concern, or admin logs one on the client's behalf
↓
Precondition (to raise): none
↓
escalations row inserted, status="open"
↓
GATE: admin must click "Confirm I've Called the Client" (confirmCalledClientAction) before ANYTHING else can happen — server-enforced, not just hidden UI
↓
[unlocked] Admin action: classify (Issue Type/Fault/Case Summary, full-replace), add client-visible progress notes (repeatable), optionally "Mark In Progress"
↓
Admin action: "Mark Resolved & Close" (Resolution Notes)
↓
Database update: escalations.status → "resolved" (terminal, no reopen)
↓
Notification: escalation_resolved_client
↓
Audit log: no DB-trigger audit exists for this table (escalations is not one of the 5 auto-audited tables, §41) — only the client_timeline_events entry
↓
Final state: escalations.status = "resolved"
```

### Workflow: Coach Change Request
```
Trigger: client submits "Request Coach Change" (reason required)
↓
coach_change_requests row inserted, status="pending", current_coach_id server-resolved
↓
Admin action: Approve (optionally picking the new coach directly) or Reject
↓
Branch A (approve + coach picked): reassignClientCoach — checks new coach's availability covers the client's full pattern (refuses, naming uncovered days, unless force=true) → repoints existing recurring_slots + bookings in place
↓
Branch B (approve, no coach yet / reject): client notified; if approved, client self-serves via findCoachChangeOptions → completeCoachChange (retires old pattern, creates new one)
↓
Database update: coach_change_requests.status → approved/rejected (terminal); recurring_slots/bookings repointed or replaced
↓
Notification: coach_change_request_approved_client / _rejected_client / coach_changed_client
↓
Final state: request terminal; client's active coach relationship updated; chat conversation closes-and-reopens with the new coach (§32)
```

### Workflow: Client Migration (Admin "Add Client" wizard, §18.3)
```
Trigger: admin submits the /admin/clients/new form for a client already mid-plan elsewhere
↓
Precondition: if any schedule days selected, a passing "Check Availability" result matching the exact current coach/days/time combo
↓
Backend processing: createMigratedClientAction — creates the auth user (service-role), profiles+client_profiles rows, a subscription pre-set to the client's ACTUAL remaining sessions (not the original plan size — a deliberate, documented distinction, §48), and (if a schedule was set) a recurring_slots pattern
↓
Database update: full client record created in one action
↓
UI update: one-time credential display ("won't be shown again")
↓
Final state: client can log in immediately at /login/client with the shown credentials
```

---

# 14. Conditional Logic

The following are the most consequential IF/ELSE/SWITCH-shaped business rules found in the code, organized by the dimension they key off. (Every numeric threshold below is admin-configurable only where explicitly noted in §18.23; all others are hard-coded constants.)

### By STATUS
- `subscriptions.status === "active" && sessions_remaining <= 5` → client's own renewal purchase gate **relaxes** (would otherwise reject "you already have an active plan").
- `subscriptions.status === "paused"` **takes priority over** `"active"` in the derived client-status bucket, even if another subscription row is simultaneously active — priority order is fixed: paused > active > created(awaiting_activation) > expired > demo > not_paid.
- `escalations.status === "open"` → "Mark In Progress" button is shown; once `"in_progress"`, that button disappears (no path back to "open").
- `conversations.status === "closed"` → chat becomes read-only for **both** participants, not just the departing coach.

### By ROLE
- `ctx.role === "admin"` → `enforceCutoff = false` for both cancel and reschedule (the only role-based cutoff exemption in the codebase).
- `ctx.role === "client"` in `createProgressLog` → the caller's own client id is used regardless of what id was passed (server-side identity substitution, preventing a client from ever writing another client's log even via a tampered call); `ctx.role === "admin"` → the passed id is trusted as-is, and the weekly cap does not apply.
- `ctx.role === "client"` in `cancelBooking` → notifies the coach **and** admins; any other role cancelling → notifies the client instead.

### By PLAN / SUBSCRIPTION
- No active/awaiting_activation subscription exists → purchase is allowed; one exists and isn't within the low-session-renewal exception → purchase is rejected outright.
- `pause_days_allowed > 0` → pause-days UI is shown at all; otherwise hidden entirely (not shown as "0 of 0").

### By SESSION STATUS
- `status !== "upcoming"` → cancel/reschedule both reject unconditionally, regardless of role or cutoff.
- Today's session, `coach_joined_at` not set → attendance marking blocked ("Join the session before marking attendance"); a backlog (previous-day) session skips this requirement entirely.

### By PAYMENT STATUS
- `payments.status === "created"` → the only state eligible for both the client-callback and webhook fulfillment paths; any other status short-circuits both (idempotency for "paid", terminal-rejection for "failed"/"paid_unfulfilled").

### By COACH STATUS
- `coach_profiles.status === "on-leave"`/an approved `coach_leave` row covering the date → the coach is excluded from `is_slot_within_working_hours` regardless of what their `coach_availability`/`coach_shifts` say.
- `findAvailableCoach` (fresh pattern search) **deliberately ignores leave**; `findShadowCoachCandidates` (existing-pattern coverage search) **deliberately respects it** — these are NOT the same "is this coach available" check despite sounding similar, and must not be conflated in a mobile rebuild.

### By CLIENT STATUS (derived, never stored)
- Six mutually exclusive buckets, fixed priority: `paused > active > created > expired > demo > not_paid` (§13/§21). This single function is the one and only place "what state is this client in" is decided across the entire application — client dashboard routing, admin/coach client-list badges, and renewal-opportunity classification all call the same derivation.

### By AVAILABILITY / DATE-TIME
- A `coach_shifts` row exists for a date → it **fully overrides** (not merges with) the recurring `coach_availability` template for that date.
- Sunday (`day_of_week === 0`) is **always** rejected in any custom day-pattern validation, platform-wide, with no override.
- Same-day booking is **disallowed everywhere** — the earliest bookable date is always "tomorrow" in IST, for both demo and regular sessions.

### By ATTENDANCE
- No attendance row exists for a completed-looking session → the session is not actually "completed" in the data model at all — the absence of an attendance/notes row *is* the unmarked state; there is no explicit "pending" attendance status.

---

# 15. Status / State Machines

(Consolidated from §13/§23/§27/§34/§36/§37/§38/§42 — see those sections for full derivation detail and exact setter functions.)

| Entity | States | Transitions & who triggers them |
|---|---|---|
| `bookings.status` | upcoming → {completed, cancelled, missed} | upcoming: set at confirm. completed: coach, via submit-notes only. cancelled: client/coach/admin via cancel-booking, or bulk on schedule change/coach change. missed: automatic time-elapsed sweep, OR coach marking Absent. All three end-states are terminal — no path back to upcoming. |
| `temporary_bookings.status` | held → {confirmed, expired} (released defined, never used) | held: at hold creation. confirmed: at booking confirm. expired: automatic sweep past the hold window. |
| `subscriptions.status` | awaiting_activation → active ⇄ paused; also → inactive | awaiting_activation: client-initiated purchase. active (direct): admin-initiated purchase (no activation step) OR activation OR resume. paused: self-service or admin pause (active only). inactive: only as the side effect of a *different* subscription being activated as its renewal. |
| `payments.status` | created → {paid, failed, paid_unfulfilled} | created: at order creation. paid: signature-verified AND fulfilled. failed: signature mismatch. paid_unfulfilled: captured but fulfillment threw, or (demo purpose via webhook) unconditionally, since no server-to-server demo fulfillment path exists. |
| `attendance.status` | present / absent / late (set once, never transitioned after) | coach only, via markAttendance. |
| `coach_leave.status` | pending → {approved, rejected} | pending: coach request. approved/rejected: admin only (or admin's one-day block, inserted directly at approved). |
| `escalation_status` | open → in_progress → resolved (terminal, no reopen) | open: at creation. in_progress: admin, optional/skippable. resolved: admin, gated behind the call-confirmation. |
| `coach_change_status` | pending → {approved, rejected} (terminal) | pending: client request. approved/rejected: admin only. |
| `shadow_coach_assignments.status` | active → cancelled (completed defined, never used) | active: on assignment (leave-triggered or manual). cancelled: only when superseded by a re-assignment (reassignShadowCoverage) — **never** cancelled simply because the covered period ended. |
| `recurring_slots.status` | active → cancelled (paused defined, never used) | active: on creation. cancelled: on schedule change or coach change (old pattern retirement). |
| `coach_profiles.status` | active / inactive / on-leave | admin sets via updateCoachStatus; "Disable Coach" always sets inactive (no hard delete exists). |
| Derived `ClientStatus` | not_paid / demo / created / active / paused / expired (never stored) | Recomputed live on every read from `subscriptions.status` history + demo-booking existence; logged as a `client_status_changed` timeline event (not a column) whenever it actually moves. |
# 16. Client Portal

Source: `src/app/client/**`, `src/components/client/**`. 18 routes + 3 global gate modals.

## 16.0 Shared Client Layout, Navigation, and Global Gates

**`src/app/client/layout.tsx`** (server component wrapping every `/client/*` route) on each request:
1. Resolves portal identity (`getMyPortalIdentity(token, "client")`) — failure leaves it undefined (middleware assumed to have already redirected unauthenticated users).
2. Runs 7 server actions in parallel: `getMyMeasurementStatusAction` → `measurementsStale`; `getMyJourneyStateAction` → `hasActivePlan`; `hasAnyChatAction` → `hasAnyChat`; `getSessionsLowStatusAction` → `sessionsLow{isLow,sessionsRemaining}`; `getMyUnreadChatCountAsClientAction` → `chatUnreadCount`; `getMyUnresolvedConcernsCountAction` → `escalationBadgeCount`; `getMyProfileAction` → `phoneMissing = !phone` (only reachable via Google OAuth signup, since manual signup requires phone).
3. Renders `PortalShell` (role="client") with `hideBookSessionNav={hasActivePlan}`, `showChatNav={hasAnyChat}`, badge counts.
4. Renders three **mutually exclusive, stacked, priority-ordered** gate modals — phone first, then measurements (already blocks booking/joining outright), then low-sessions:
   `<PhoneGateModal missing={phoneMissing}/>` → `{!phoneMissing && <MeasurementGateModal initiallyStale={measurementsStale}/>}` → `{!phoneMissing && !measurementsStale && <SessionsLowGateModal .../>}`.

**Nav items** (`NAV.client`, in order): Dashboard (`/client/dashboard`), My Sessions (`/client/sessions`), Book a Session (`/client/book`, **hidden** once `hideBookSessionNav`), My Schedule (`/client/schedule`), My Chats (`/client/chats`, **hidden** unless any chat exists; red unread badge), My Coach (`/client/coach`), Subscription (`/client/subscription`), Progress (`/client/progress`), My Concerns (`/client/concerns`, red escalation badge), Notifications (`/client/notifications`), Profile (`/client/profile`). Fallback identity: `{name:"Client", photo: pravatar #68}`.

**`useJoinCountdown(scheduledStart, durationMinutes)`** (shared, ticks every 30s): join window opens 10 min before start through session end. States: `now>=end` → "Session ended" (canJoin=false); `now>=start` → "Live now" (canJoin=true); within 10 min of start → canJoin=true, "Join in N min"/"Join in Xh Ym"; else canJoin=false, same label format.

## 16.1 Journey/Stage Routing Model

`getMyJourneyStateAction()` returns `{stage, demoSession, subscriptionId, packageName}`. Stages: `marketing`, `awaiting_activation`, `onboarding`, `renewal_checkin`, `renewal_scheduling`, `slot_selection`, `demo_booked`, `demo_completed`, and an implicit `active` (no branch fires). This single action is the gate deciding which experience every client-facing screen renders — see §13 for its full derivation logic.

## 16.2 Dashboard — `/client/dashboard`

**Purpose:** home screen — plan/package progress, next session, streak, weekly measurement compliance, progress-since-Day-1 deltas, recent completed sessions.

**Data:** `getMyJourneyStateAction` (stage routing), `getClientDashboardAction` → `{firstName, journeyDay, sessionsUsed, sessionsTotal, sessionsRemaining, packageName, subscriptionStatus, pauseDaysAllowed, pauseDaysUsed, nextSession, completedCount, streakWeeks, recentCompleted[]}`, `getMyProgressAction` → `{dayOne, latest, canSubmitThisWeek, logs[]}`.

**Stage branches:** `marketing`→redirect `/client/plans`; `awaiting_activation`→redirect `/client/activate`; `onboarding`→redirect `/client/onboarding`; `renewal_checkin`→redirect `/client/renewal-checkin`; `renewal_scheduling`/`slot_selection`→redirect `/client/schedule`; `demo_booked`→"Your Demo Session" card (coach, date/time); `demo_completed`→"Welcome back" card with Button **"Choose Your Plan"** → `/client/plans`.

**Default/active UI:** `ProgressRing` (sessions used/total) + package name + paused badge; `NextSessionCard` (see below); 3 `StatCard`s (Sessions Completed, Current Streak "{n} wks", Package Progress %); "Progress Since Day 1" card (8 metrics: Weight/Body Fat %/Muscle %/Waist/Chest/Hip/Arms/Thigh, each with a directional delta, colored by whether the direction is an improvement — lower-is-better for all except Muscle %/Chest/Arms/Thigh); weekly-measurement compliance banner (green "all set" or red "action required, booking/joining/demos on hold" linking to `/client/progress`); "Recent Sessions" list (date, coach notes or "No notes yet", star rating if present).

**`NextSessionCard`:** empty state → "No upcoming sessions" + Button **"Go to My Schedule"**. With session: coach photo, type badge (Assessment or "Regular Session") + "Next Up" badge, coach name/specialization, date/time, "Live Video Session" (always video, hardcoded). Button **"Join Now"/"Join"** (`href=zoomJoinUrl ?? "#"`, `target=_blank`, `disabled={!canJoin || !zoomJoinUrl || measurementsStale}`). Helper text: stale-measurements warning (red, links to progress) > "Join link not ready yet" > countdown label.

## 16.3 Activate Your Plan — `/client/activate`

**Purpose:** one-time start-date pick for a purchased-but-not-yet-started plan. **Guard:** redirects to `/client/dashboard` unless `stage === "awaiting_activation"` and a `subscriptionId` exists.

**Fields:** Start Date (`type=date`, `min`=tomorrow, default=tomorrow). **Button "Confirm Start Date"** → `activatePlanAction(subscriptionId, startDate)` → on success `router.push("/client/dashboard")` + refresh; failure shows inline error. (Server side: this call is a one-time lock — a second call throws "This plan has already been activated.")

## 16.4 Onboarding (Initial Assessment) — `/client/onboarding`

**Purpose:** first-time intake establishing Day-1 baseline before first session. No further page-level guard beyond the dashboard's stage redirect.

**Fields:** *Personal Details* — Age (number, optional), Gender (select: Male/Female/Other, optional), Height cm (number, optional). *Starting Measurements* — Weight kg (number, **required**, only required measurement system-wide), Body Fat %/Muscle %/Waist/Chest/Hip/Arms/Thigh (all number, optional). *Fitness Goal* — single-select pill (Fat Loss/Muscle Gain/Strength/General Fitness/Rehabilitation), required. *Medical Details* — 4 optional textareas (Medical Conditions, Injuries, Medications, Exercise Restrictions).

**Validation:** `canSubmit = weightKg.trim() !== "" && fitnessGoal !== ""`. **Button "Complete Assessment"** → `submitOnboardingAction(...)` → on success `router.push("/client/dashboard")` + refresh. (Server: one-time insert; a second submission throws "Onboarding has already been submitted — contact support to make changes.")

## 16.5 Book a Session — `/client/book`

**Purpose:** ad-hoc single-session wizard, used only before a client has an active recurring plan. Once subscribed, nav hides this item and redirects here to `/client/schedule`.

**Guards/branches:** `subscriptionId != null` → redirect `/client/schedule`; `demo_booked` → "Demo Already Booked" card; `demo_completed` → renders `DemoFeedbackGateClient` (rate-or-skip the just-completed demo, then "Choose Your Plan" CTA); `marketing` → "No Subscription Found" card with **"Book Free Demo"**/**"Choose Your Plan"** buttons.

**Wizard (`intro`→`schedule`→`confirm`):** measurements-stale banner shown throughout if applicable (booking still selectable but confirm is blocked). Intro: first-session gets an "Assessment" framing card; returning client sees their coach card + "Request a coach change" link. Schedule: grid of open slots (2-week horizon), select highlights. Confirm: review card (Coach/When/Type) → **"Confirm Booking"** (`disabled` if measurements stale) → `confirmBookingAction({slotStart, durationMinutes, sessionType})`. Success: booked confirmation + **"Back to Dashboard"**/**"View My Sessions"**.

## 16.6 Demo Booking — `/client/demo-booking`

**Purpose:** free, no-payment demo; client picks date/time/gender preference only — **system auto-assigns the coach** (client never chooses).

**Fields:** Preferred Date (`min`=tomorrow, default=tomorrow), Preferred Time (optional select, hourly 5 AM–9 PM or "No preference"), Coach Gender (optional: No preference/Male/Female/Other). Measurements-stale banner blocks the button. **Button "Book Free Demo Session"** → `bookDemoSessionAction({date, preferredTime, genderPreference})` (server: takes the **first** utilization-ranked available option — no client choice of coach). Success: coach photo/name/date/time + **"Go to Dashboard"**.

## 16.7 Demo Feedback Gate (embedded in Book a Session)

Gates "Choose a Plan" behind optionally rating the just-completed demo. If nothing to rate (missed/already rated) → skips straight to CTA. Two `StarPicker`s (overall / coach) + optional note. **"Skip"** or **"Submit"** (`rateSessionAction`) → done state → **"Choose Your Plan"** → `/client/plans`.

## 16.8 Plans (Marketing / Purchase) — `/client/plans`

**Data:** `listMarketingPlansAction` → active packages. Top banner: "Try a free demo" → `/client/demo-booking`. Grid of plan cards (highlighted badge, sessions count, price with struck-through original + savings, feature bullets). **Button "Purchase Plan"** → full Razorpay lifecycle (§23): `createPackagePurchaseOrderAction` → `openCheckout` (Razorpay Checkout UI) → on success, "Congratulations!" modal (does **not** auto-navigate) → dismiss (**"Understood"**) → `router.push("/client/dashboard")`.

## 16.9 My Coach — `/client/coach`

**Data:** `getMyCoachAction` (prefers real recurring-slot coach; falls back to upcoming-demo coach with `isDemoCoach:true`; else null), `getMyCoachChangeRequestAction`.

**States:** no coach → "No Active Coach" + Book Demo CTA. Demo coach → simplified card, no rating/change-request UI. Real coach: full profile card (photo, rating, bio, certifications, languages, experience) + **"Request Coach Change"** modal (Reason required, optional 1–5 ratings, optional comments → `requestCoachChangeAction`). Pending/rejected/approved-but-incomplete/approved-and-complete states each render a distinct status card; the "needs completion" state (approved, no new coach yet) exposes a day/time picker → **"Find Available Coach"** (`findCoachChangeOptionsAction`) → **"Confirm {name}"** (`completeCoachChangeAction`).

## 16.10 My Concerns — `/client/concerns`

**Data:** `listMyConcernsAction` → `{id, category, status, description, createdAt, resolvedAt, resolutionNotes, notes[]}`. **Button "Raise a Concern"** opens modal: Category (select, from the 7-value `CONCERN_CATEGORIES` vocabulary), Details (optional textarea) → `raiseConcernAction`. List shows status badges (open=red/in_progress=outline-yellow/resolved=green), admin progress notes ("Updates from LEANR"), and final resolution text once resolved.

## 16.11 My Chats — `/client/chats`

**Data:** `getMyChatsAsClientAction`. Empty → "A chat opens automatically once you've purchased a plan and a coach is assigned" (chat is gated on **having ever purchased**, not merely having an assigned coach — a demo-only client has no chat channel at all, see §32/§48). Active conversation → `ConversationThread` (full composer). Past/closed conversations (previous coaches) → expandable, read-only history with an explanatory `readOnlyReason`.

## 16.12 My Sessions — `/client/sessions`

**Data:** `getClientSessionsAction`, `getSchedulingRulesAction` (cutoffs/reschedule counters), `getMyShadowCoachNoticeAction`. Shadow-coach banner with **"Acknowledge"**. Tabs: Upcoming/Completed/Cancelled/Missed/Rescheduled. Each upcoming card: **"Reschedule"** (disabled inside cutoff) opens `RescheduleModal`; **"Cancel"** (disabled inside cutoff) opens `ConfirmDialog` → `cancelSessionAction`. Completed cards without a rating show **"Rate Session"** → `FeedbackModal` → `rateBooking` (server: capped at 1 rating/7 days across ALL the client's bookings, not per-booking).

**`RescheduleModal`** (three paths, see §27 for full mechanics): "Fastest Available" per-coach soonest slot; "Browse open slots" (30-day grid, rule text shown inline: max 2/week, cutoff hours, no same-day-double-booking); "Prefer a specific date & time?" custom check, with substitute-coach fallback if the client's own coach isn't free.

## 16.13 My Schedule — `/client/schedule`

**Data:** `getMyJourneyStateAction`, `getScheduleSetupOptionsAction`. Branches mirror the journey stages (renewal_scheduling → `ScheduleSetupClient` in renewal mode; demo_booked/marketing/demo_completed → informational cards). `existingSchedule` present → `ChangeScheduleClient` (read-only summary + **"Change My Schedule"** toggle to the picker); none → `ScheduleSetupClient` directly.

**`ScheduleSetupClient`** (most complex client screen — full mechanics in §27): renewal-only "Keep My Schedule"/"No, Change It" fork; Time select; pattern picker (standard 3-day presets → 2-day pair fallback → fully custom 2–5 days, Sunday always excluded); Trainer Preference (Same/New/No Preference, renewal excludes "No Preference"); New-Trainer Gender preference; **"Check Availability"** → `matchScheduleAction` (fallback ladder, §27) → match or "no match" (with **"Notify Support"** escape hatch → `reportScheduleUnmatchedAction`) → **"Confirm"/"Save"** → `confirmScheduleAction`/`changeScheduleAction`.

## 16.16 Progress — `/client/progress`

**Data:** `getMyProgressAction`, `getClientSessionsAction`. Stale-measurement red banner (7+ days or never logged). Stat grid (Sessions Completed; **"Log This Week's Update"** action or "submitted" checkmark). Latest Measurements card (8 metrics). "Progress Over Time" chart (`MeasurementChart`) if any logs exist. Session History & Coach Notes list. **Modal** "Log This Week's Update" — 8 optional numeric fields → `submitMyProgressAction` (server-enforced 7-day cap, see §31).

## 16.17 Renewal Check-in — `/client/renewal-checkin`

**Guard:** redirects to dashboard unless `stage === "renewal_checkin"`. Purpose: post-renewal re-baseline before new plan's schedule setup. Shows prior-measurement chart (or empty state) + a fresh "Log Today's Measurements" form (8 optional fields, explicitly NOT overwriting history) → **"Continue"** → `submitRenewalCheckinAction` (server: bypasses the normal weekly cap via `skipWeeklyLimit:true`) → dashboard. No explicit "mark stage complete" call — the stage clears naturally once a log exists (server-side `checkRenewalStage`).

## 16.18 Subscription & Payments — `/client/subscription`

**Data:** `getMyJourneyStateAction`, `getMySubscriptionAction` → `{status, packageName, sessionsUsed/Remaining/Total, pauseDaysAllowed/Used, payments[]}`. Non-subscribed stages show informational cards + "Choose Your Plan". Active view: status badge, usage progress bar, pause-days-remaining line, **"Pause Plan"**/**"Resume Plan"** (self-service, `ConfirmDialog`-gated) → `pauseMySubscriptionAction`/`resumeMySubscriptionAction`. Payment History list (empty state if none).

## 16.19 Notifications — `/client/notifications`

`listMyNotificationsAction` → list with type icon (booking/reminder/feedback/system), unread items highlighted + clickable → `markNotificationReadAction` (optimistic). No "mark all read."

## 16.20 Profile — `/client/profile`

**Data:** `getMyProfileAction` → `{name, phone, email, photo, goals[], equipment[], medicalNotes, heightCm, weightKg, bmi, packageName}`. Main card + **"Edit"** modal: Photo (upload to Storage bucket `avatars`), Name, Phone, Goals (`TagEditor`), Equipment (`TagEditor`), Medical Notes → `updateMyProfileAction`. **"Change Password"** modal: New/Confirm Password (client-side ≥8 chars + match check) → direct `supabase.auth.updateUser({password})` call (not a server action).

## 16.21 Global Gate Modals (layout-level, not routes)

- **PhoneGateModal** — forced when `profiles.phone` is null (Google OAuth signups only); not backdrop-dismissible; two-step phone→OTP flow (`sendPhoneOtpAction`/`verifyPhoneOtpAction`/`setMyPhoneAction`); includes a **"Skip for now (demo — MSG91 not verified yet)"** bypass that saves the number **unverified** (see §46, §48 — a real, currently-live authentication weakness, not a hypothetical one).
- **MeasurementGateModal** — forced when the last log is ≥7 days old or never logged; not backdrop-dismissible (only "Skip for now" or a successful save); explicitly blocks booking/joining/demos until resolved (though "skip" does allow bypassing the modal itself, keeping the underlying stale-state gate active elsewhere).
- **SessionsLowGateModal** — reappears every login while sessions are low (no persisted dismissal); **"Renew Now"** → `/client/plans`.

## 16.22 Cross-Cutting Client-Portal Notes

- **No toast system anywhere** — every success/failure is either inline red/green text near the control, or a state/route change.
- Only two true confirm-dialog flows in the whole client portal: cancel session, pause/resume subscription. Everything else (raise concern, request coach change, submit measurements) proceeds directly.
- The 8-field measurement set (Weight, Body Fat %, Muscle %, Waist, Chest, Hip, Arms, Thigh) is duplicated verbatim across onboarding, the measurement gate, "Log This Week's Update," and renewal check-in — Weight is the only ever-required field.
- All currency is formatted `₹{value.toLocaleString("en-IN")}`.
# 17. Coach Portal

Source: `src/app/coach/**`, `src/components/coach/**`. 13 routes.

## 17.0 Shared Coach Layout / Navigation

`src/app/coach/layout.tsx`: resolves identity (`getMyPortalIdentity(token,"coach")`, fallback `{name:"Coach", photo: pravatar #12}`), loads unread-chat count / pending-tasks / unresolved-escalations count in parallel (each defaults to 0/[] on failure), renders `PortalShell` + a global `CoachPendingTasksGateModal`.

**Nav** (`NAV.coach`): Dashboard, Schedule, Clients, Renewal Opportunities, My Chats (red unread badge), Search, Escalations (red badge), Performance, Availability, Notifications, Profile. No nav items are conditionally hidden for coaches (unlike client's book-session/chat hiding).

**`CoachPendingTasksGateModal`** — every-login **soft nudge** (not a hard block), shown if `initialPendingTasks.length > 0`: lists up to 5 past sessions still missing attendance or notes, each with a **"Resolve"** button → `/coach/session/{id}`. **"Skip for now"** just dismisses (no persistence — reappears next full page load). **"Review Now"** → `/coach/schedule`.

## 17.1 Dashboard — `/coach/dashboard`

**Data (6 parallel actions):** `getCoachDashboardAction` → `{firstName, utilization, todayCount, thisWeekCount, completedCount, missedCount, avgRating, activeEscalationsCount, recentClients[]}`; `getCoachCancelledSessionsAction`/`getCoachRescheduledSessionsAction` (sliced to 5 each); `getCoachTodayTasksAction`, `getCoachUpcoming3DaysAction`, `getCoachPendingTasksAction`.

**UI:** 7 `StatCard`s (Today, Sessions This Week, Completed, Missed, Utilization %, Avg. Rating, Active Escalations) → Today's Tasks widget → Pending Tasks widget → Upcoming (Next 3 Days) widget → Cancelled Sessions list (with "Cancelled by Admin/Coach/Client" attribution) → Rescheduled Sessions list (original→new time) → "Your Clients" preview (top 3).

## 17.2 Today's Tasks / Pending Tasks widgets (shared `TaskRow`)

Also reused by `/coach/schedule`'s "Day" view. **Today's Tasks** = today's `upcoming` bookings. **Pending Tasks** = any-day `upcoming` bookings whose time has already passed (owed attendance/notes). Both run `sweepOverdueAttendance`/`sweepOverdueNotes` (RPCs `flag_overdue_attendance`/`flag_overdue_notes`) on load so overdue flags are current.

**Row logic:** red-tinted if overdue. Client-side `useJoinCountdown` mirrors the server join-window rule (10 min before start). `canMarkAttendance = isPast && joined` — a **client-side convenience only**; the real gate is server-side (§28). Buttons: **Join** (`markSessionJoinedAction` → opens `zoomStartUrl` in a new tab or routes to session detail if already past) → **Present/Late/Absent** (`markAttendanceAction`, each disabled until `canMarkAttendance`) → once present/late and notes not yet submitted, **"Add Notes"** → `/coach/session/{id}`.

## 17.3 Upcoming (Next 3 Days) widget

Pure read list — bookings strictly in `[tomorrow, tomorrow+3 days)`, i.e. excludes today. No actions.

## 17.4 Schedule — `/coach/schedule`

**Data:** `getCoachScheduleAction` (all upcoming+completed bookings), `getCoachTodayTasksAction`. Toggle **Day/Week**. Day view = the same `CoachTodayTasksClient` widget as the dashboard. Week view = 7-column grid (Sunday-based), each day showing a session count; clicking a day with ≥1 session opens a modal listing every session that day, each linking (full page nav, not client-routed) to `/coach/session/{id}`.

## 17.5 Clients (list) — `/coach/clients`

**Data:** `getCoachClientsAction` → roster of assigned clients: `{clientCode, name, photo, goals, medicalNotes, equipment, joinedDate, packageName, days[], startTime, sessionsCompleted, sessionsPurchased, status, lastMeasurementAt, measurementsStale}`. Client-side search (name/code) + status-chip filter (all/not_paid/demo/created/active/paused/expired) + Plan filter + Day filter — all client-side, no re-fetch. Table row → `/coach/clients/{id}`; "Overdue" badge if measurements stale.

## 17.6 Client Detail — `/coach/clients/[id]`

Fully server-rendered, 100% **read-only** for the coach role (no forms/buttons anywhere on this page). **Data:** `getCoachClientDetailAction(id)` → extends the list-row shape with `history[]` (completed sessions + notes + ratings), `demographics` (age/gender/height/weight/BMI/fitnessGoal), `sessionSummary` (purchased/completed/remaining/upcoming), `weeklyProgress` (8-metric start-vs-current comparison), `progressHistory` (chart feed), `timeline`, and `isAssignedToMe`.

**Global-search fallback:** if the client isn't actually assigned to this coach (reached via `/coach/search`), the page still loads (RLS permits read since migration `0033`'s "global client search" widening) but shows a **"Read-only — this client isn't assigned to you"** banner; billing/progress/session detail are still visible (RLS-permitted) but understood to be informational only.

Sections: profile/demographics/goals/medical/equipment, Session Summary (2×2 grid), Weekly Progress mini-cards (colored diff), "Progress Over Time" chart (only if history exists), Session History & Notes, and `ClientTimeline` (shared component, full journey feed — see §5a in the admin section for its detailed behavior, reused verbatim here).

## 17.7 Renewal Opportunities — `/coach/renewals`

Shared `RenewalOpportunitiesClient` (`role="coach"`, Coach column hidden since every row is already "my client"). Two tabs: Renewal Opportunities / Expired, each with a "Converted"/"Not Converted" badge. Rows link to `/coach/clients/{id}`.

## 17.8 My Chats — `/coach/chats`

**Data:** `getMyChatsAsCoachAction` → conversations tagged into 4 categories: `active` (Active Client Chat), `old` (a closed thread — this coach was replaced), `expired` (client's plan has lapsed), `pause` (client's plan is paused). Default tab/selection: first `active` conversation.

**Thread** (shared `ConversationThread`): `readOnly = status==="closed"`, with reason "A new coach has been assigned to this client." Realtime subscription on `messages` INSERT/UPDATE (read receipts). Composer: text + image upload (bucket `chat-attachments`) + 30-emoji picker; Enter sends, Shift+Enter newlines. Read receipts: `Check` (sent) vs `CheckCheck` (read).

## 17.9 Search — `/coach/search`

**Global** client lookup (not limited to own roster) — `searchAllClientsAction` fetches every client once, filters client-side by name/code. Each result shows a status badge and "Your client"/"Read-only" badge; links to `/coach/clients/{id}` (applies the read-only banner from §17.6 if not assigned).

## 17.10 Escalations — `/coach/escalations`

**Explicitly read-only** ("only Admin can respond to or resolve these" — stated in the page header itself). `getCoachEscalationsAction` → escalations tied to the coach's own clients. Two tabs: active (open+in_progress) / resolved. No buttons anywhere.

## 17.11 Performance — `/coach/performance`

Fully server-rendered, no interactivity. `getMyPerformanceAction` (14-stat `CoachPerformance` object, formulas in §13/§40) + `getMyActivityAction` (derived 30-item activity feed merging completed/missed sessions, leave submissions/decisions, shadow assignments — no dedicated activity table). Explicitly labeled "read only" in the page description.

## 17.12 Availability — `/coach/availability`

**Weekly Working Hours** — **read-only** ("Only admin can change your working hours" — coaches lost write access in migration `0045`). **Leave Requests** card — own leave history + **"Request Leave"** modal:
- Type toggle: Full day / Partial day.
- Full day: From/To dates (`min`=tomorrow).
- Partial: single Date + Unavailable-from/until times.
- Static reminder: "Leave must be requested at least 24 hours before it starts" (no bypass exists server-side either — see §37).
- `requestLeaveAction` — server validation mirrors client validation exactly (end≥start, partial-single-day, partial-times-required-and-ordered, 24h notice computed against IST midnight).
- On success: optimistic prepend to the local list at `status:"pending"`.

## 17.13 Notifications — `/coach/notifications`

Reuses the **client-portal** `NotificationsClient` component verbatim (no coach-specific variant exists). Same read/unread/click-to-mark-read behavior as §16.19.

## 17.14 Profile — `/coach/profile`

**Data:** `getMyCoachProfileAction` → `{phone, emergencyContact, photo, name, email, specialization, yearsExperience, bio, certifications[], languages[], skills[], rating, reviewCount, employeeCode, joiningDate, workingHours, currentCapacity, maxCapacity, availableCapacity}`.

**Editable by coach:** Mobile Number, Emergency Contact, Profile Picture (modal, → `updateMyCoachProfileAction`) — explicitly captioned "Professional details are managed by Admin." Skills: coach may **append only** via an inline add-skill row (`addMySkillAction`, server-enforced append-only — no remove button exists, and the server would reject a full replace from this action even if one were added client-side). **Change Password** modal (direct `supabase.auth.updateUser`, same 8-char/match validation as client portal).

**Read-only:** email, bio, certifications, languages, employee code, joining date, working hours, capacity, name, specialization, years of experience — all admin-owned.

## 17.15 Session Detail — `/coach/session/[id]` (core operational workflow)

**Data:** `getCoachSessionDetailAction(bookingId)` → status/type/date/duration/amountPaid, `client{id,name,photo,goals,medicalNotes,equipment}`, `previousNotes` (up to 3 most recent other sessions' notes for this client), `attendanceStatus`, `notes` (existing session notes if any), `zoomStartUrl` (only populated while `status==="upcoming"`, lazily created), `coachJoinedAt`.

**Client-side state machine:** `attendance`, `joined`, `completed`, `missed` all seeded from server state; `sessionEnded` is computed **once at render** (not a ticking countdown, unlike the dashboard task rows) — a coach sitting on this exact page as the clock crosses the session-end boundary must refresh/re-navigate to unlock attendance marking. `canMarkAttendance = joined && sessionEnded`.

**Panel 1 — Join/Meeting status** (hidden once completed/missed): not-joined → **"Join Zoom Meeting"** (`markSessionJoinedAction`, opens `zoomStartUrl` in new tab if present); joined & not ended → **"Reopen Zoom"** available; joined & ended → prompts to mark attendance below.

**Panel 2 — Attendance** (hidden once attendance is present/late, or completed/missed): **Present**/**Late**/**Absent** buttons, all disabled until `canMarkAttendance`; optional remark textarea (only sent when marking Absent). Present/Late → reveals Panel 3. **Absent → terminal**: booking flips to `missed` immediately, no notes phase (Panel 4 shown instead).

**Panel 3 — Session Notes** (mandatory before completion, shown once attendance is present/late or already completed; fields disabled once completed): Session Summary (textarea, **the only client-side-required field** — submit disabled until non-blank), Exercises Performed, Client Performance (4-way button group: Excellent/Good/Average/Needs Improvement), Improvements Seen (`TagEditor`), Homework, Additional Remarks. **"Mark Completed"** → `submitSessionNotesAction` — **server-gated**: attendance row must be `present`/`late` (else throws "Attendance must be marked Present or Late before session notes can be submitted") and booking must still be `upcoming`. Success → booking becomes `completed`, notes become read-only, **"Back to Dashboard"** appears.

**Panel 4 — Missed/Absent terminal state**: "Client marked absent — no session notes are required" + **"Back to Dashboard"**.

**Full state machine (server-verified gates in bold):**
1. Not joined → only Join is actionable.
2. Joined, session not ended → Attendance buttons visible but disabled ("unlocks once the session's scheduled time has ended" — **also enforced server-side**: `markAttendance` throws if called before `scheduled_start + duration`).
3. Joined, session ended → Attendance enabled. **Server additionally requires**, for bookings scheduled *today* specifically, that `coach_joined_at` is set ("Join the session before marking attendance") — backlog bookings from a previous day skip this join requirement entirely (no live join moment could have existed for them by now).
4. Mark Absent → `missed`, `no_show_party:"client"`, terminal, no notes.
5. Mark Present/Late → attendance upserted, `attendance_overdue` cleared, reveals notes.
6. Submit notes (client-required: summary; server-required: attendance present/late) → booking → `completed`.
7. Revisiting an already-closed session renders the correct terminal panel immediately from initial server state.

## 17.16 Cross-Cutting Coach-Portal Notes

- No toast system; no `window.confirm`/`ConfirmDialog` anywhere in the coach portal's action flows — the only "are you sure" mechanism is a disabled-until-conditions-met button.
- Coach cannot cancel or reschedule any session — no such action exists in the coach portal's file set; cancellation/reschedule history shown on the dashboard is read-only, sourced from client- or admin-initiated actions elsewhere.
- Shared components reused verbatim from other portals: `PortalShell`, `ConversationThread`, `NotificationsClient`, `RenewalOpportunitiesClient`, `JoinCountdown`, `TagEditor`, `MeasurementChart`, `ClientTimeline`.
# 18. Admin Portal

Source: `src/app/admin/**`, `src/components/admin/**`. 25 routes — the largest and most operationally complete portal.

## 18.0 Shared Admin Shell

`PortalShell` (role="admin", `Badge` "admin Portal"), fallback identity `{name:"Admin", photo: pravatar #5, sub:"Operations Team"}`. **Nav** (17 items, exact order): Dashboard, Search, Clients, Renewal Opportunities, Coaches, Sessions, Sales, Scheduling, Availability Check, Coach Change Requests, Leave Requests, Shadow Coverage, Escalations, Notifications, Activity Log, Reports, Settings. "Escalations" carries a red unresolved-count badge.

## 18.1 Dashboard — `/admin/dashboard`

Platform-wide KPI overview. **Data:** `getAdminDashboardAction` (§13/§40 for exact formulas) computing: Total Clients, Active PT Clients, Sessions Booked Today, Cancelled Today, Trainer Utilization %, Peak Booking Hour, Empty Slots, Revenue This Month, Active Coaches, Avg. Coach Rating, Avg. Sessions/Day, Renewal Rate % (or "—" if zero flagged opportunities, distinguishing "no data" from "0%"). **UI:** 12 `StatCard`s, a 6-month Revenue Trend line chart, "Avg. Sessions/Client" + top-5 coach utilization mini-bars, a Bookings-by-Hour bar chart.

## 18.2 Clients (list) — `/admin/clients`

**Data:** `listAdminClientsAction` → full roster with status/package/coach/slot/sessions/measurement-staleness. Search (name/ID/phone) + 6-way status filter, all client-side. Table row → `/admin/clients/{id}`. **Header action:** **"+ Add Client"** → `/admin/clients/new`. No explicit zero-results empty state (table just renders with no rows).

## 18.3 Add Client (migration wizard) — `/admin/clients/new`

**Purpose:** "Create an existing client's account directly — for migrating a roster tracked outside LEANR mid-plan." This is the one screen explicitly designed around **importing an already-in-progress client** rather than a fresh signup.

**Fields:** *Identity* — Full Name (required), Phone (optional), Login Email (required), Temporary Password (required, randomly pre-generated, shuffle button). *Plan* — Plan Name (select, resets Sessions Remaining/Pause Days to package defaults on change), **Sessions Remaining** (required, must be >0 — explicit help text: enter what's actually left on the legacy plan, e.g. 2 of 24, **not** the original total — see §48 edge case on why this matters), Original Plan Size (optional, timeline-note only), Pause Days Allowed (defaults from package). *Coach & Weekly Schedule* (optional — "leave no days selected to create the client without a schedule yet") — Coach select, Time select, 7-day toggle, **"Check Availability"** (`checkSlotAvailabilityAction`) required to pass before submission is enabled if any days are selected; shows alternative times/coaches on failure.

**Submit gate:** `fullName && email && password && packageId && sessionsRemaining>0 && scheduleConfirmed`. **Button "Create Client"** → `createMigratedClientAction`. Success: shows the generated email+password once ("won't be shown again") + **"View Client"**/**"Add Another Client"**.

## 18.4 Client Detail — `/admin/clients/[id]` (richest screen)

**Data (5 parallel):** `getAdminClientDetailAction`, `listAdminCoachOptionsAction`, `getClientTimelineAction`, `listEscalationsForClientAction`, `getClientChatsForAdminAction`.

**Left column:** Identity card (photo/name/status/email/phone/height-weight-BMI/goals/medical notes). Assigned Coach card. Package card (usage bar, pause-days-remaining, **"Grant Pause-Days"**). **Manual Controls card** — the admin's full direct-intervention surface:
- **"Adjust Package / Sessions"** (±1 stepper) → `adjustClientSessionsAction`.
- **"Transfer to Another Coach"** → `transferClientCoachAction(force=false)`; on the specific "coach hasn't set availability for" failure, shows an amber **"Transfer Anyway"** retry with `force=true` — the **only** two-step force-override pattern anywhere in the admin portal.
- **"Assign Shadow Coach"** → `ShadowCoachAssignModal` (§38).
- **"Pause Subscription"** → `ConfirmDialog` → `pauseClientSubscriptionAction`.
- **"Log Measurement"** → 8-field modal → `logMeasurementAction` (admin, unlike client, has **no** weekly cap).
- **"Log Escalation"** → `logEscalationAction` (admin-initiated on the client's behalf, `raisedBy: null`).
- **"Log Refund Request"** (destructive) → amount + reason → `logRefundRequestAction` — explicit disclaimer in the modal itself: **"This platform has no payment gateway yet — this logs a refund request to the audit trail for finance to action manually; it does not move money."**
Open Escalations card (only if any are open) with inline **"Mark Resolved"** per row.

**Right column ("journey"):** `ClientTimeline` (§18.4a), `AdminClientChats` (§18.4b, view-only), Progress Over Time chart (if history exists), Session History list.

### 18.4a `ClientTimeline` component

Split/Merged view toggle (Split = two-column, "LEANR Event"/internal on the left vs "Customer Event" on the right, per timestamp group). Filter by event type (26 mapped types, e.g. `plan_purchased`→"Subscription purchased", `escalation_created`→"Support ticket created"). Paginated (20/page, infinite-scroll via `IntersectionObserver`). Grouped by same-minute timestamp. Cards with metadata are clickable → detail modal. Red stale-measurement banner at top when applicable. This is the canonical **cross-portal client narrative feed** — the same component (or its data) is reused verbatim on the coach's client-detail page.

### 18.4b `AdminClientChats` component

**Admin can see, never send** (explicit code intent) — a view-only list of every historical coach conversation for this client, each expandable to the full message thread. No composer, no realtime subscription.

## 18.5 Coaches (list) — `/admin/coaches`

Search (name) + table (Coach/Utilization/Active Clients/Rating/Status). Row → `/admin/coaches/{id}`. Header action **"+ Add Coach"** → `/admin/coaches/new`.

## 18.6 Add Coach — `/admin/coaches/new`

**Fields:** *Identity* — Full Name, Employee Code, Login Email, Temporary Password (all required, same shuffle pattern). *Skills* — Primary Specialization (select from `COACH_SKILLS` constant), Additional Skills (multi-toggle). *Languages* — multi-toggle from `COACH_LANGUAGES`, ≥1 required. *Weekly Slot Openings* — repeatable Time+7-day-toggle rows (**"Add Slot"**, delete icon on rows beyond the first); only rows with ≥1 day count as valid.

**Submit gate:** `fullName && email && employeeCode && password && languages.length>0 && validSlots.length>0`. **Button "Create Coach"** → `createCoachAction`. Success screen mirrors Add Client's (credentials shown once).

## 18.7 Coach Detail — `/admin/coaches/[id]` (second-richest screen)

**Data (5 parallel):** `getAdminCoachDetailAction`, `listAdminCoachOptionsAction`, `getCoachPerformanceAction`, `getCoachWeekCalendarAction` (today+6 days), `getCoachAvailabilityForAdminAction`.

**Left column:** Profile card (+ **Edit** modal: Name, Specialization, Years of Experience, Bio, Additional Specializations, Languages → `updateCoachAction`). `CoachPerformancePanel` (13 stats, same formulas as §17.11/§40, viewed by admin for any coach). Skills card — **admin has full edit/remove** via `TagEditor` (unlike the coach's own append-only view) → dirty-state **"Save Skills"** → `updateCoachSkillsAction`. **Admin Controls card:**
- **"Override / Block Slots"** → date+reason modal → `blockCoachSlotAction` (inserts a pre-approved one-day `coach_leave` row — reuses the leave mechanism, see §37/§48 for the confusability risk this creates).
- **"Reassign Clients"** → bulk-move every active client to a new coach → `reassignCoachClientsAction`; **per-client independent try/catch** (one client's failure — e.g. uncovered availability — never blocks the rest), returns a `{reassignedCount, failed[]}` summary shown inline.
- **"Disable Coach"** (destructive) → `ConfirmDialog` → `disableCoachAction` (sets `status:"inactive"` — there is no hard delete; this is the only "removal" mechanism, preserving booking/audit FK history).

**Right column:** Assigned Clients list. **Weekly Working Hours** — the **only** admin write-surface for a coach's recurring template (coaches themselves are read-only here, migration `0045`) — per-day enable checkbox + Start/End time inputs → **"Save Working Hours"** → `setCoachAvailabilityAction` (full replace). **7-Day Schedule** (`CoachWeekCalendar` — color-coded open/booked/unavailable grid, booked cells link to `/admin/clients/{id}`).

## 18.8 Escalations (global queue) — `/admin/escalations`

`listAllEscalationsAction` (joined with client identity). Active (open+in_progress) / Resolved tabs. Rows link to `/admin/escalations/{id}`.

## 18.9 Escalation Detail (gated resolution workflow) — `/admin/escalations/[id]`

**The canonical "gated workflow" screen in the entire application.** Card 1 (always visible, read-only): the client's original report. **Hard gate:** if `calledClientAt` is not set, **everything else is replaced** by a single card — "Call the client first" + **"Confirm I've Called the Client"** (`confirmCalledClientAction`). This is enforced **independently server-side** (`requireCalledClient` throws on every subsequent mutation), not merely hidden in the UI.

Once unlocked: **Admin Assessment** card (Issue Type / Who's at Fault / Case Summary → `updateEscalationDetailsAction` — a **full-replace** of all three fields together, not a merge — see §48); **Progress Notes** card (client-visible append-only note trail → `addEscalationNoteAction`); **Resolve** card — **"Mark In Progress"** (only shown while still `open`) and **"Mark Resolved & Close"** (Resolution Notes textarea) → `resolveEscalationAction`. Resolved state is terminal (green success card, no further actions — no reopen control exists).

## 18.10 Leave Requests (approval workflow) — `/admin/leave-requests`

Each pending request card: coach name (+ "{n}+ days" badge if full-day and ≥14 days), date range, reason, **"Reject"**/**"Approve"** → `resolveLeaveAction`.

**On approve success**, a rich inline summary replaces the row — this is where the **automatic shadow-coverage cascade** (§38) surfaces to the admin: "Shadow coverage auto-assigned" (per-client, per-shadow-coach breakdown) and/or a red **"Needs manual assignment"** list (uncovered clients/dates) with a **"Review clients"** link. A ≥14-day leave additionally shows an amber advisory nudging toward a *permanent* coach change instead of ongoing shadow coverage — **purely advisory, never automatic**.

## 18.11 Coach Change Requests (approval workflow) — `/admin/coach-change-requests`

For still-`pending` requests, the current-coach display is **re-resolved live** (not the frozen snapshot on the row) since the client's coach may have changed since the request was filed by a separate admin action. **Reject** is immediate; **Approve** opens a two-step modal: optionally pick a new coach directly now (skips the client's own self-serve step entirely) or leave blank (client picks their own day/time/coach afterward) → `resolveCoachChangeRequestAction`.

## 18.12 Shadow Coach Required (gap queue) — `/admin/shadow-coverage`

**Purpose:** "Sessions whose coach is on approved leave and still have no shadow coverage" — a live-derived (no stored table) persistent backlog. Each gap → **"Assign shadow coach"** links to `/admin/clients/{id}` (the actual assignment UI lives on Client Detail, not here).

### `ShadowCoachAssignModal` (the manual shadow-assignment tool, invoked from Client Detail)

From/To dates + optional Reason → **"Find Coverage"** (`previewShadowAssignmentPlanAction`) — shows a **preview only** (per-occurrence best-matching candidate, grouped into contiguous date ranges, plus any uncovered dates in a red box) — then **"Confirm Assignment(s)"** (`confirmShadowAssignmentPlanAction`) actually commits. This preview→confirm separation is deliberate: the identical matching algorithm also runs fully automatically on leave approval (§18.10), but this manual path exists specifically for "a coach who never applied for leave in the system" (undocumented/emergency absence).

## 18.13 Scheduling (grouped activity view) — `/admin/scheduling`

Read-only, six sections (Today's Changes, Cancelled Sessions, Rescheduled Sessions, Manual Sessions Created, Demo Sessions, Shadow Sessions) — all derived from the same `listAllBookings` result bucketed six different ways, plus an audit-log-based heuristic for "manually created" (no `bookings.created_by_admin` column exists — see §48). Deliberately separate from the flat Sessions master list (§18.16) — this view is about *activity/change*, not inventory.

## 18.14 Availability Check — `/admin/availability`

Cross-coach, single-day view: every active coach × every working-hour grid slot, Booked/Free, with a date navigator (`?date=` query param, defaults to today IST). Booked rows link to the client. Free rows show `freeReason` (e.g. "Cancelled by X") when the slot was previously booked and released.

## 18.15 Universal Client Search — `/admin/search`

Unrestricted (admin has full read access, unlike the coach-side equivalent which needs the "global search" RLS widening) — search by name/ID/phone → `/admin/clients/{id}`.

## 18.16 Sessions (master list) — `/admin/sessions`

Coach + Status filters. Row actions (upcoming only): reschedule (icon → modal, `rescheduleSessionAction`) and **cancel** (icon, **no confirmation dialog** — immediate `cancelSessionAction`, the one admin destructive action with no "are you sure" step). Rows link to `/admin/sessions/{id}`.

## 18.17 Session Detail — `/admin/sessions/[id]`

Fully read-only. `getAdminSessionDetailAction` → basic info (incl. `wasManuallyAdded` derived as `recurring_slot_id === null`), Outcome Detail (rescheduled/no-show/technical-issue/coach-on-leave/cancel-reason — shown only if any is truthy), Attendance (4 join/leave timestamps), Coaching Notes, Weekly Progress Snapshot (measurements as of that session's date), and a linked Escalation card if `escalation_id` is set.

## 18.18 Sales — `/admin/sales`

Transaction-level list from `sales_view` (§42): client/plan/amount/date. Header shows filtered total. Search by client/plan.

## 18.19 Renewal Opportunities — `/admin/renewals`

Shared `RenewalOpportunitiesClient` (`role="admin"`, Coach column shown, unlike the coach's own view). Platform-wide.

## 18.20 Reports — `/admin/reports`

5 fixed report cards, each independently exportable as **CSV** or **PDF** (PDF via lazily-imported `jspdf`/`jspdf-autotable`, only loaded on first PDF click): Client Report, Coach Report, Monthly PT Report (completion-rate %), Revenue Report, Cancellation/No-Show Report. No server fetch on page load — each export triggers its own action on demand.

## 18.21 Notifications — `/admin/notifications`

Reuses the **client-portal** `NotificationsClient` verbatim (no admin-specific component exists — confirmed identical to §16.19/§17.13).

## 18.22 Activity Log — `/admin/activity-log`

Flat, filterable (by entity type: Bookings/Subscriptions/Coach Changes/Client Profiles/Coach Profiles/Packages/Settings, via full-page navigation `Link`s, not client state) feed of the DB audit trigger's output (§42/§41). Each row: action badge (INSERT/UPDATE/DELETE), entity type, actor name ("System" if no actor, "Unknown" if actor id present but unresolvable), and a computed diff summary (up to 3 changed keys for UPDATE).

## 18.23 Settings — `/admin/settings`

**Package Types card:** list of active packages with Edit/Delete per row; **"+ Add Package"** modal (Name, Category advance/addon, Sessions, Price, Original Price, Default Pause-Days, Features `TagEditor`, "Highlight as featured" checkbox) → `createPackageAction`/`updatePackageAction`. **Delete is a soft delete** (`ConfirmDialog` → `deletePackageAction` → `updatePackage(id,{is_active:false})`, never a real row delete — explicit in the confirm copy: "Clients with an active subscription on this package keep it.").

**Session Rules card:** 4 range sliders — Default Session Duration (30–90 min), Cancellation Cutoff (4–48h), Reschedule Cutoff (1–24h), Inactivity Threshold (7–90 days) — **"Save Settings"** writes all 4 in parallel (`updateSettingAction` × 4). These are the **only** 4 of the 7 `system_settings` keys exposed to any admin UI (§24/§42 — `join_window_minutes`, `assessment_session_duration_minutes`, `temporary_booking_hold_minutes` exist in the DB but have no admin-facing control).

## 18.24 Cross-Cutting Admin-Portal Observations

- **`ConfirmDialog`** (distinct from the generic `Modal`) is reserved for genuinely high-stakes single actions: Pause Subscription, Disable Coach, Delete Package. Every other mutating action (adjustments, transfers, escalation logging, reassignment, edits) uses a plain in-modal submit with no separate "are you sure" step.
- **Transfer Coach's "force" retry** is the **only** two-step soft-failure-then-override pattern in the entire admin portal.
- **No real payment/refund processing exists anywhere** — confirmed at both the client-detail modal (explicit disclaimer) and the reports/sales screens (read-only reporting on `subscriptions`/`sales_view`, no write-back to any payment provider).
- **`router.refresh()`** (server re-fetch), not optimistic local mutation, is the dominant post-success pattern — the one notable exception is the Coach Change Requests list, which does both.
- Status color conventions are consistent platform-wide via the shared `Badge`/`SessionStatusBadge`: green=active/completed/approved/converted; red=paused/missed/rejected/cancelled(escalation)/overdue; gray=expired/cancelled(session)/not_paid; black=created/upcoming; outline-yellow=demo/on-leave/pending/in_progress.
# 19. Public / Landing Experience

Source: `src/app/(marketing)/**`, `src/components/landing/**`. Single page (`src/app/(marketing)/page.tsx`), server-rendered, fetching active packages server-side for the pricing section.

**Global ambient layer** (marketing/login/signup only — never mounted in the authenticated portals, an explicit performance decision): `BackgroundScene` (fixed full-viewport `@react-three/fiber` canvas — scroll-driven camera drift through 9 waypoints, two `<Sparkles>` fields, pulsing point light) + `SmoothScrollProvider` (Lenis smooth scroll, respects `prefers-reduced-motion`).

**Section order:** Navbar → Hero → TrustBar → CoachingShowsUp → WhatIsLeanR → HowItWorks → Coaches → ReadyWhenYouAre → PricingSection → WhyLeanR → Testimonials → Footer.

- **Navbar** — pill bar with scroll-progress indicator; in-page smooth-scroll links (How It Works/Coaches/Plans/Why LeanR/Transformations) + 3 login buttons (Coach/Admin/Client) + mobile hamburger drawer.
- **Hero** — "Train Live. Anywhere." headline, CTA **"Book Your First Session"** → `/signup`, secondary **"Explore Plans"** (scroll), a hand-built animated "phone/photo" mockup with fake call-control icons (purely decorative — **no real embedded video exists anywhere on the marketing site**, confirmed by full search).
- **TrustBar** — 4 stat chips (120+ Coaches, 48,000+ Sessions, 4.9/5 Rating, 100% Verified).
- **CoachingShowsUp** — 3 value-prop cards (Live Coaching / Train From Your Space / Real-Time Guidance).
- **WhatIsLeanR** — product-in-a-paragraph + 4 pillar cards (Your Space/Coach/Schedule/Goal).
- **HowItWorks** — 5-step numbered process: Choose Package → Choose Coach → Pick Schedule → Join Live Session → Track Progress.
- **Coaches** — draggable carousel of 3 coach bios (**all three placeholder-named "Hare Krishna"** with the same reused photo — confirmed non-final content, flagged for the client to replace before any real launch).
- **ReadyWhenYouAre** — mid-page conversion push, animated flippable phone mockups, CTA **"Continue to Sign Up"** → `/signup`.
- **PricingSection** — **data-driven** from `listPublicActivePackages()` (falls back to "Pricing is being updated" if zero rows); each card → **"Get Started"** → `/signup`.
- **WhyLeanR** — 6-item benefit grid.
- **Testimonials** — draggable before/after carousel, 4 fabricated transformation stories (illustrative silhouette graphics, not real photos).
- **Footer** — Logo + tagline + 3 **non-functional decorative** social icons; Portals column (3 login links); Company column (in-page anchors); "Get in Touch" (plain-text email/phone, not `mailto:`/`tel:` links); **"Privacy Policy"/"Terms of Service" are both `href="#"` stubs — no legal pages exist in the codebase.**

---

# 20. Authentication

Source: `src/app/login/**`, `src/app/signup/**`, `src/app/auth/callback/**`, `src/middleware.ts`, plus the auth-related synthesis in the client/admin-ops audit.

## 20.1 Routes

- `/login/client`, `/login/coach`, `/login/admin` — three separate role-scoped pages, all rendering the same `AuthLayout` + `LoginForm` pair with different copy/icon/redirect target. **No unified `/login` page exists.**
- `/signup` — **client-only**; there is no coach or admin signup route anywhere in the codebase (confirmed by absence, and by explicit code comments) — those accounts are provisioned exclusively via privileged server-side code (`supabaseAdmin.auth.admin.createUser`).
- `/auth/callback` — Google OAuth landing route (no UI, a Route Handler).

## 20.2 Login (`LoginForm.tsx`, shared, parameterized by role)

**Fields:** "Email or Phone" (in practice, only email works — no phone-login logic is actually wired up despite the label) + Password (show/hide toggle).

**Submit flow:** `signInWithPassword` → on success, queries `profiles.role`; if it **doesn't match** the portal's expected role → signs the user back out and shows *"This account isn't registered as a/an {role}. Log in with the correct account, or use the right portal."* (a client-side UX guard layered in front of middleware's own silent redirect, added specifically so the button doesn't appear stuck). On match → `router.push(redirectTo)` (`/{role}/dashboard`).

**"Forgot password?" is a fully dead button** — `<button type="button">` with no `onClick`, no route, no `resetPasswordForEmail` call anywhere in the repository. **There is no password-reset flow at all in this application, on any platform.** This must be either built for mobile parity or explicitly scoped out — see §52.

**Google button** (shared, identical on login+signup): `signInWithOAuth({provider:"google", redirectTo:"{origin}/auth/callback"})` — the same call transparently signs in an existing account or silently creates a new one (always role `client`); the destination portal is decided purely by the account's *actual* role after the fact, never by which login page the click originated from.

**Client-only extra link:** "New here? Create an account" → `/signup` (absent on coach/admin login, consistent with no self-serve signup for those roles).

## 20.3 Signup (`/signup`, client-only)

**Three-step state machine:** `form → email-otp → phone-otp` (or straight to `phone-otp` if a session already exists post-signup).

**Step "form":** Google button + Full Name, Email, Mobile Number (helper: "required for every account"), Password (≥8 chars). Client validation: password length, phone matches `/^\+?[0-9]{10,15}$/`. `signUp({email, password, data:{role:"client", full_name}})` — the client-supplied `role:"client"` metadata is **inert** by design (see §46 — the DB trigger only ever honors a privileged `app_metadata` field, never the public `user_metadata` a signup caller can set). **Phone is deliberately never sent through `signUp()`** — it's only written to `profiles.phone` later, after OTP proof.

**Step "email-otp":** 6-digit numeric code → `verifyOtp({type:"signup"})`; 30s-cooldown resend.

**Step "phone-otp":** auto-fires an MSG91 OTP send on entry; 6-digit code → `verifyPhoneOtpAction` then `setMyPhoneAction` (the actual write of `profiles.phone`) → `/client/plans`. 30s-cooldown resend. **Contains a "Skip for now (demo — MSG91 not verified yet)" button that saves the phone number unverified**, explicitly marked TEMPORARY in code comments pending MSG91 KYC/DLT approval — **phone verification is not actually enforced in the current production configuration** (see §46, §48, §52).

## 20.4 Google OAuth Callback (`/auth/callback/route.ts`)

Exchanges the `code` for a session, looks up the account's `profiles.role`, redirects to that role's dashboard (or `/login/client?error=oauth_failed` on any failure). A brand-new Google account has no pre-existing profile row, so `handle_new_user()` (DB trigger) defaults it to `client` — **there is no code path anywhere that lets a Google sign-in land as coach or admin.**

## 20.5 Phone Gate for Google Sign-ins (`PhoneGateModal`)

Since OAuth never collects a phone number, every client-portal page force-opens this modal (not backdrop-dismissible) whenever `profiles.phone` is null. Same two-step phone→OTP flow and the same temporary unverified-skip bypass as signup's phone step (§16.21).

## 20.6 Route Protection (`middleware.ts`)

Matches `/{client,coach,admin}/:path*`. The **required role is derived purely from the URL's first path segment** — there is no separate route-to-role config table. Calls `supabase.auth.getClaims()` (local JWT verification via cached JWKS, not a network round-trip — the project signs asymmetrically, ES256). Reads `claims.user_role` (a **custom claim** injected by a Supabase Auth Hook, migration `0054`) with a **DB-query fallback** (`profiles.role` by `claims.sub`) if the claim is absent (session issued before the hook was enabled). No session **or** wrong role → identical redirect to `/login/{requiredRole}` (a wrong-role session is treated exactly like no session at the middleware layer; it's `LoginForm`'s own post-login role check, §20.2, that actually explains the mismatch to the user).

## 20.7 Role Provisioning Security History (load-bearing for a mobile rebuild's auth design)

The `handle_new_user()` DB trigger that auto-provisions a `profiles` row on signup was rewritten **five times** across the migration history specifically around this exact vulnerability class:
- **Original state:** trusted `raw_user_meta_data->>'role'` — a field any unauthenticated caller of the public `signUp()` endpoint can set directly, meaning **any visitor could self-register as `role:'admin'`.**
- **Fix (migration `0051`):** hardcoded `'client'` for every public signup, closing the hole but also making it impossible for an admin-created coach account to actually receive the `coach` role through the normal insert path.
- **Fix (migration `0055`):** moved the trust boundary to `raw_app_meta_data` — settable **only** via the privileged, service-role-only Admin API — and additionally provisions a `coach_profiles` row when `role='coach'` is present in that privileged field.
- **A genuine drift was found and documented**: production had, at one point, already been hot-patched to this `app_metadata`-based behavior *outside any committed migration* — `0055` formalizes that live-but-undocumented state into history. **The lesson for a mobile rebuild: role is never trustworthy from any client-suppliable signup payload, on any platform — it must always be assigned server-side, post-creation, via the service-role API.**

---

# 21. Profiles

**Data model:** `profiles` (auth-linked, one per user, any role): `full_name`, `phone`, `photo_url`, `emergency_contact`, `role`, `account_status`. `client_profiles` (client-only extension, 1:1 via `profile_id`): `client_code` (auto-generated `CL0001`-style sequence), `status`, `goals[]`, `equipment[]`, `medical_notes`, `joined_date`. `coach_profiles` (coach-only extension): `specialization`, `secondary_specializations[]`, `years_experience`, `bio`, `certifications[]`, `languages[]`, `rating`, `review_count`, `status`, `employee_code`, `max_capacity`, `gender`, `skills[]`.

**Edit rights (exact, code-verified):**
- Any role edits their own `profiles.full_name/phone/photo_url/emergency_contact` via `updateMyProfile` — no field-level admin-only lock in code; RLS enforces "own row only" for every role, including admins editing their own name.
- Client additionally self-edits `client_profiles.medical_notes/equipment/goals` freely — **no admin approval gate exists on this**.
- Coach's own professional fields (name, specialization, bio, certifications, languages, employee code, working hours, capacity) are **admin-owned**; the coach's own action file exposes only phone/emergency-contact/photo + append-only skills.
- **Admin's write surface on a client is *not* a generic "edit client_profiles" action** — it is the specific subscription/pause/coach-transfer/refund-log/onboarding-correction actions (§18.4). No action file in the entire codebase lets an admin directly edit `client_profiles.goals/medical_notes/equipment` on a client's behalf.
- `client_profiles.status` is **never a column the app trusts directly** — it is *derived live* every time (`deriveClientStatus`, priority order: `paused > active > created(awaiting_activation) > expired > demo > not_paid`, see §13) from the client's full `subscriptions.status` history plus demo-booking existence — never cached, never client-editable.

**Portal identity subtitle** (`getMyPortalIdentity`): admin → hardcoded "Operations Team"; coach → specialization or "Coach"; client → active subscription's package name or "Client".

---

# 22. Plans

Package catalog lives in `package_tiers`: `name`, `category` (`advance`|`addon`), `sessions_count`, `price`, `original_price` (for was/now display), `features[]`, `highlighted`, `is_active`, `default_pause_days`. Public/marketing reads only `is_active` rows (`listPublicActivePackages`, no auth). Admin manages the full catalog (`/admin/settings`, §18.23) — creation/edit are real writes; **deletion is always a soft delete** (`is_active:false`), preserving history for clients already on that package. A client purchasing a plan sees only active packages (`listMarketingPlansAction`).

---

# 23. Payments / Razorpay

**No SDK is used** — raw `fetch` + Node `crypto` against Razorpay's REST API (`razorpay.service.ts`). `payments` (migration `0038`) is the financial ledger: one row per order, `purpose` (`package_purchase`|`demo_session`), `status` (`created`|`paid`|`failed`|`paid_unfulfilled`), `razorpay_order_id`(unique)/`payment_id`/`signature`, linking to a `subscription_id` or `booking_id` once fulfilled.

## 23.1 Full Lifecycle

1. **Plan selection** (client UI, `/client/plans`) → `createPackagePurchaseOrderAction(packageId)`.
2. **Order + ledger creation** (server, pre-payment): rejects if the client already has an `active`/`awaiting_activation` subscription; loads the package's current price; `POST /v1/orders` (amount in paise, Basic-auth'd); **inserts a `payments` row at `status:"created"` *before* the client ever sees a checkout modal.**
3. **Checkout** (client browser, `useRazorpayCheckout` hook): loads `checkout.razorpay.com/v1/checkout.js`, opens `window.Razorpay(...)` — the app never sees card/UPI details.
4. **Primary fulfillment** (Checkout success handler → `verifyPaymentAction` → `verifyAndFulfillPayment`): loads the `payments` row by order id; ownership check; **idempotent** if already `paid`; rejects if not still `created`; **verifies `HMAC-SHA256(orderId|paymentId, RAZORPAY_KEY_SECRET)` against the supplied signature — this is the sole trust boundary for a client-reported payment.** Signature failure → row marked `failed`. Success → `package_purchase` calls `purchaseMyPlan` (creates `subscriptions` row at `status:"awaiting_activation"`) or `demo_session` calls `confirmDemoBooking`; marks the row `paid`. **Any fulfillment exception** (slot taken meanwhile, plan already purchased in another tab) marks the row `paid_unfulfilled` — **money is never silently lost track of**; the client sees a support-reference error, not a generic failure.
5. **Reconciliation fulfillment** (Razorpay server → `POST /api/webhooks/razorpay`, safety net for the browser-tab-closes-before-callback case): verifies `HMAC-SHA256(rawBody, RAZORPAY_WEBHOOK_SECRET)` (a **separate secret** from the API key) against `x-razorpay-signature`, over the **raw unparsed body**; only handles `payment.captured` (ignores redundant `order.paid`); no-ops if the payment row is missing or already left `created`; always returns `200` regardless of internal outcome (a retry can't fix an application bug — `paid_unfulfilled` already captures it for manual follow-up).
6. **Final DB state:** `created→paid` (happy path), `created→failed` (bad signature), `created→paid_unfulfilled` (captured but fulfillment failed, either path). Client-initiated `subscriptions` always start `awaiting_activation` (separate activation step, §22/§27); the admin-driven purchase path (`purchaseSubscription`, no Razorpay involved) creates them directly `active`.
7. **UI result:** "Congratulations!" modal on success — does **not** auto-navigate; only dismissing it (**"Understood"**) routes to `/client/dashboard`.

## 23.2 Dormant / Unused Path

`createDemoSessionOrder`/the `demo_session` payment purpose/webhook branch are **fully built but never called by the live UI** — the actual demo-booking flow (`bookDemoSessionAction`) is entirely free and bypasses Razorpay. If this dormant path is ever wired back up, its webhook reconciliation branch is a **guaranteed `paid_unfulfilled`** today (no server-to-server fulfillment path exists for a demo, since it requires a live user access token) — this must be fixed before any future paid-demo feature goes live (§52).

---

# 24. Sessions

A **session is always a `bookings` row** — the central scheduled-session record (client, coach, time, duration, type, status, Zoom links, rating, outcome flags). Two ways a booking comes into existence: (a) expansion of a `recurring_slots` weekly pattern (§27), or (b) a one-off hold→confirm flow (ad-hoc booking, demo, or a reschedule-to-substitute). Session types: `regular` and `assessment` (demos AND free physical assessments both use `assessment` — there is no distinct "demo" enum value; §42 §9.13 notes `amount_paid` exists specifically because this was previously financially untraceable).

**Default session duration:** 45 minutes (`system_settings.default_session_duration_minutes`, admin-configurable, §18.23). **Assessment duration:** 60 minutes (not admin-exposed). **Booking window:** 5 AM–10 PM (`booking_window_start_hour`/`end_hour`), **whole-hour slots only — no half-hour slots exist anywhere on the platform.**

---

# 25. Zoom

**Server-to-Server OAuth**, one shared business Zoom account hosts *every* meeting — **no coach has an individual Zoom OAuth grant.** No meeting is created at booking time for any booking type; creation is **lazy**, on the first call to `ensureZoomMeetingForBooking` (idempotent — if both URLs already exist, returns them unchanged; a duplicate meeting is never created for the same booking). Settings: `join_before_host:true`, `waiting_room:false`, `mute_upon_entry:true`. `join_url` → client; `start_url` → coach (host controls). **No Zoom webhook/callback is consumed anywhere** — session completion is driven entirely by the coach's own in-app actions (join → attendance → notes), never by Zoom itself reporting anyone actually attended. **Cleanup:** cancel/reschedule both delete the old meeting (tolerating a 404, swallowing any other error rather than failing the cancel/reschedule) and null the three Zoom columns; a fresh meeting is lazily created next time anyone needs to join the (now-moved) booking. Access token cached only in an in-process module variable — resets on cold start/redeploy, never persisted.

---

# 26. Availability

Two layers, with an **override, not merge** rule between them: `coach_availability` (recurring weekly template, `day_of_week`/`start_time`/`end_time`) is the **admin-only-writable** default (coaches lost self-service write access in migration `0045` — they retain read-only); `coach_shifts` (concrete per-date override) **completely supersedes** the template for any date it covers, even if narrower — this override is enforced at the database level (`is_slot_within_working_hours`) but **not surfaced anywhere in the client/admin-facing "open slots" UI**, which never queries `coach_shifts` at all — a real, silent UI/DB-truth divergence flagged in §48/§52. Approved leave (full-day or the overlapping portion of partial-day) always wins over both layers. Admin's "Override / Block Slots" and "Weekly Working Hours" controls (§18.7) are the only write surfaces; a coach's own `/coach/availability` screen is 100% read-only for the weekly template.

---

# 27. Scheduling

**Two booking models:**
1. **Recurring slots** (`recurring_slots`) — a permanent weekly pattern, optionally tied to a subscription. The slot itself is never "booked" — it's a template that `generate_bookings_from_recurring_slot` periodically expands into concrete `bookings` rows (4 generated at creation, 1 backfilled each time an occurrence is cancelled). Walks forward from tomorrow (never today), up to 60 calendar days, skipping leave-blocked or conflicting dates.
2. **One-off/"temporary" bookings** — any single booking (ad-hoc, demo, substitute-coach reschedule) goes through a two-phase **hold → confirm** RPC flow (`create_temporary_booking` → `confirm_booking`) specifically to prevent a race between two clients eyeing the same slot. A hold expires automatically (`expire_temporary_bookings`, run opportunistically at the top of every conflict check — no separate cron) after `temporary_booking_hold_minutes` (10 min default).

**Pattern presets:** Mon/Wed/Fri, Tue/Thu/Sat, or 6-day (Mon–Sat) — **Sunday is never part of any preset and is explicitly rejected** ("Sunday is a holiday") wherever custom day-lists are validated (2–5 days).

**Coach matching fallback ladder** (`matchRecurringPattern`, for an *already-assigned* client changing schedule with the same coach): (1) exact pattern @ requested time → (2) exact pattern @ any grid time → (3) same-trio 2-day pair @ requested time → (4) same-trio pair @ any grid time → `null` (offers "custom days," or "Notify Support" if custom was already tried). **First-time/coach-change search** (`findAvailableCoach`, across the *whole* active roster) has **no fallback ladder at all** — exact day/time match on the whole pattern, or nothing; candidates are sorted by ascending utilization for load-balancing.

**Availability computation, single source of truth:** `is_slot_within_working_hours` (DB function) — leave always wins; else `coach_shifts` override if present (full override, not merged with the template); else the weekly `coach_availability` template.

**Conflict detection, single source of truth:** `has_scheduling_conflict` (DB function) — checked at hold-creation, hold-confirmation, reschedule, and recurring generation; backed by a **hard Postgres exclusion constraint** (`bookings_no_coach_overlap`, GIST index) as the final, unconditional backstop even if every application-layer check were somehow bypassed.

**Session-credit / balance check:** enforced **only inside `confirm_booking`** (added late, migration `0053`, closing a real historical gap — see §48) — locks the subscription row, counts `upcoming + completed` bookings against it, rejects once that reaches `sessions_total`. **No equivalent check exists for demo/assessment bookings** — demo eligibility is instead gated purely by "has this client ever demoed" (`getMyLatestDemoSession` returning non-null), at the client-journey-stage level, not inside the booking RPC.

**Confirm / Cancel / Reschedule / Expire / Missed / Completed — who can trigger each, and the cutoffs:**
| Transition | Who | Rule |
|---|---|---|
| Confirm | Client (self), or admin/system on their behalf | Credit check (real plans only); working-hours + conflict re-check |
| Cancel | Client (12h cutoff), Coach, Admin (no cutoff) | Only `upcoming`; recurring-generated bookings immediately backfill the next occurrence |
| Reschedule | Client (1h cutoff + 30-day forward window + max 2/week + no same-IST-day double-booking), Coach, Admin (no cutoff) | Updates the **same row in place** (preserves attendance/notes FK), never regenerates a recurring occurrence; may move to a **substitute coach for that one occurrence only** — the recurring slot's own coach is untouched, so future auto-generated occurrences revert to the original coach automatically |
| Expire (temporary hold) | Automatic | No cron — runs as the first step of every conflict check |
| Missed | Automatic | `mark_missed_bookings()`, opportunistic on every booking-list read, no cron |
| Completed | Coach only | Two-step: mark attendance present/late, **then** submit session notes (§28/§29) |

**Two distinct cutoffs, easy to conflate:** cancellation requires **12 hours'** notice; reschedule requires only **1 hour's** — a client can reschedule a session too close to cancel outright. Both admin-configurable (`system_settings`, §18.23).

---

# 28. Attendance

`markAttendance(bookingId, "present"|"absent"|"late", remark?)` — coach-only. **Timing gate:** cannot be marked before `scheduled_start + duration_minutes` has elapsed ("Attendance can only be marked after the session has ended"). **Join gate (today's sessions only):** for a booking scheduled *today*, `coach_joined_at` must already be set ("Join the session before marking attendance") — a backlog booking from a previous day skips this requirement entirely (no live join moment could have existed for it by now). Present/Late → upserts `attendance` (checked-in at scheduled start, not checked out — session still "open" pending notes); Absent → immediately closes it out (`checked_out_at:now`) **and** flips the booking straight to `missed` with `no_show_party:"client"` — no notes phase for an absence. Clears `attendance_overdue` unconditionally regardless of outcome. Both parties are notified either way.

---

# 29. Session Notes

`submitSessionNotes` — coach-only, **the actual transition to `booking.status = "completed"`.** **Server-enforced gate:** the booking must still be `upcoming` and its attendance row must be `present` or `late` — otherwise throws "Attendance must be marked Present or Late before session notes can be submitted," independent of and in addition to the UI's own conditional rendering (this is not merely a UI convenience gate). Fields: `notes` (repurposed in-app as "Session Summary" — the only client-side-required field), `homework`, `exercises_performed`, `performance_rating` (excellent/good/average/needs_improvement), `improvements[]`, `additional_remarks`. Once submitted, notes become read-only in the UI (booking is terminal-completed).

---

# 30. Feedback & Ratings

`rateBooking(bookingId, {qualityRating, trainerRating, note?})` — client-only, splits "how was the session" from "how was the trainer" into two independent 1–5 scores (a schema evolution from an original single `rating`/`client_feedback` pair, now legacy/superseded — §42 §9.4). **Capped at once per 7 days across *all* of a client's bookings** (not per-booking) — "You've already submitted a rating this week." Only a `completed` booking owned by the caller can be rated. On submit, `recomputeCoachRating` averages every non-null `trainer_rating` ever given to that coach and updates `coach_profiles.rating`/`review_count` — the coach's public rating is a live-recomputed average, not a stored running mean.

---

# 31. Progress & Measurements

8 fixed fields, duplicated verbatim across every intake surface (onboarding, weekly log, measurement gate, renewal check-in): **Weight (kg)** (the only field ever required, and only at onboarding), Body Fat %, Muscle %, Waist, Chest, Hip, Arms, Thigh (all in).

**Client self-service cadence: capped at 1 log per rolling 7 days** ("You've already submitted a measurement update this week"). **Admin backfill has no cap** — explicitly for correction/migration purposes, and does **not** notify the client's coach (the client-triggered path does). **"Measurements stale" threshold:** last log ≥7 days old, or never logged — this single pure function (`isMeasurementStale`) is the shared source of truth used by admin/coach staleness badges, the booking gate, and the client-portal's compulsory-update modal.

**This staleness gate is a hard, server-enforced precondition, not a UI nag:** `confirmBookingAction` (regular session) and `bookDemoSessionAction` (demo) both independently throw before creating any booking if the caller's measurements are stale — "Please update your measurements before booking a session/demo."

Renewal check-in (`submitRenewalCheckinAction`) explicitly **bypasses** the weekly cap (`skipWeeklyLimit:true`) since it's plan-activation-triggered, not calendar-triggered.

---

# 32. Chat

One `conversations` row per (client, coach) relationship; **at most one `active` conversation per client at any time** (DB-enforced unique partial index). Opened/closed automatically as a side effect of a coach assignment changing (`ensureConversationForCoachAssignment`) — **never** by direct client/coach action. **Gated on "has ever purchased a plan," not on "has an assigned coach"** — a demo-only client, even with an assigned coach for that one-off demo, has **no chat channel at all** (a real, confirmed limitation, §48).

When a client's coach changes: the old conversation is **closed forever** (never merged, never reopened — RLS only permits inserts into an `active` conversation) and a fresh one opens with the new coach. A former coach **retains read access** to their now-frozen thread but can never post to it again — even the client on the other end of that same frozen thread cannot post to it either; only a brand-new conversation reopens communication.

**Messages:** `sender_role`+`sender_profile_id`, optional `body` and/or `attachment_url` (an image-only message is valid, migration `0044`), `read_at` (recipient-set read receipt). Realtime via Supabase `postgres_changes` on `messages` (INSERT + UPDATE for read receipts). Attachments in Storage bucket `chat-attachments` (public read, participant-scoped write). Admin has full read across every client's chat history (all coaches, all time) but **can never send** — an explicit, deliberate view-only design (§18.4b).

---

# 33. Notifications

Two tables: `notification_templates` (key-based, `{{placeholder}}` interpolation) and `notifications` (per-user instance, `read` boolean, a `channels` jsonb column that exists in the schema but is **never actually populated by any code** — a planned per-channel-status dispatcher that was out of scope when built).

**Delivery channels:**
- **In-app** — always, on every `createFromTemplate` call (the in-app bell is the one channel treated as load-bearing: this is the **only** step in the whole notification pipeline that actually throws on failure, e.g. an unknown template key — everything downstream of it is fail-soft).
- **Email** (Resend) — for any notification routed through `notifyUser`/`notifyClient`/`notifyCoach`. **Fail-soft by design**: a missing/broken `RESEND_API_KEY` produces no user-visible error anywhere, only a server log warning.
- **SMS** (MSG91) — **client-only**, and only for a fixed enum of session-lifecycle events (booked, demo booked, schedule/coach changed, attendance present/absent, rescheduled) — each requiring its own DLT-approved template id (India's telecom regulation forbids freeform SMS bodies). Coaches never receive SMS. Also fail-soft.

**Template interpolation silently drops unknown variables** (`{{unmapped_var}}` → empty string, not an error and not the literal placeholder) — a template referencing a variable a call site forgot to pass fails silently as odd blank text, never a crash.

**Notification catalog grew organically** across many migrations (0008 → 0024 → 0050 → 0056/0057) — earlier-looking "this event has no notification" gaps in the app's history were a known, iteratively-fixed condition, not a deliberate design choice; the final (latest-migration) template catalog should be treated as the current, complete spec.

**The one time-based (non-user-action-triggered) notification path:** the session-reminders Vercel Cron (`/api/cron/session-reminders`), firing 5h45m–6h15m before a session's start, gated by `CRON_SECRET` if set (otherwise effectively public — a stated risk), with `reminder_sent_at` (not the query window) as the actual no-duplicate guard.

---

# 34. Escalations

Client-raised (or admin-logged-on-client's-behalf) concern, category-vocabulary-constrained both at the DB (CHECK constraint) and app (`CONCERN_CATEGORIES` TS array) layers — kept in sync manually, a data-integrity risk if either is ever edited alone (§48).

**Category vocabulary** (exact 7 values): `slot_not_available`, `coach_missed_session`, `need_schedule_change`, `payment_issue`, `technical_issue`, `want_coach_change`, `other`.

**Status lifecycle:** `open` (default) → `in_progress` (optional, admin-only) → `resolved` (terminal — **no reopen control exists anywhere**). "Unresolved" badge counts = open + in_progress combined.

**The hard call-first gate:** every status-mutating admin action (classify, mark in-progress, resolve, add a progress note) first calls an internal check that throws unless `called_client_at` is already set — **an escalation literally cannot be worked in any way until an admin has confirmed (via a dedicated button) that they called the client**, enforced at the service layer regardless of caller, not just a UI hint.

**Resolution sequence:** confirm-called → (optional, repeatable) classify (Issue Type + Fault + internal Case Summary — a **full-replace of all three together**, not a merge, on every call) → (optional, repeatable) client-visible progress notes → mark in-progress and/or resolve (Resolution Notes, notifies the client with reason + resolution text appended). Only admin can mutate at any stage; the coach's own view is **explicitly read-only** ("only Admin can respond to or resolve these," stated in the coach portal's own page header); client can only create and read their own.

**`fault`** (internal-only vocabulary: coach/client/platform/third_party/none/other) is **never exposed** to any client- or coach-facing view — confirmed absent from both `MyConcernView` and `CoachEscalationView`.

---

# 35. Renewals

Two intentionally different thresholds, both defined in code (not configurable via admin settings):
- **Client's own "running low" nudge:** `SESSIONS_LOW_THRESHOLD = 5` — also, not coincidentally, the exact threshold that unlocks the client's *own* self-serve renewal purchase while an existing active plan is still present (so the client's own "Renew Now" button is never blocked by "you already have an active plan").
- **Staff-facing "Renewal Opportunities" list:** wider `RENEWAL_OPPORTUNITY_THRESHOLD = 10` — deliberately earlier than the client's own nudge, so staff can act before the client even sees a reminder. Classifies every client as `"opportunity"` (active sub, ≤10 remaining) or `"expired"` (no active sub, but has ever subscribed); `converted:true` once a client has purchased more than one plan ever (the code's own reasoning: the only way to reach >1 subscription row at all, used as an exact proxy without needing timestamp comparisons).

**The renewal purchase/activation itself is the same Razorpay/plan-purchase flow as §23** — a renewal always produces a **new** `subscriptions` row rather than mutating the old one. The follow-on schedule choice offers a **"Keep My Schedule"** shortcut (repoints the existing active recurring slot to the new subscription, coach/day/time untouched, logs `plan_renewed` not `session_rescheduled`) or a full re-pick via the same scheduling wizard (§27). `submitRenewalCheckinAction` logs a fresh baseline measurement tied to plan activation, bypassing the normal weekly cadence cap.

---

# 36. Coach Changes

**Initiation:** only a client can create a `coach_change_requests` row (`requestCoachChange`), always tied to their own *current* coach (server-resolved, never client-supplied), with a mandatory reason and optional 1–5 feedback ratings. Starts `pending`. **There is no admin-initiated request-table entry** — an admin swapping a client's coach directly (bulk transfer, migration, escalation follow-up) uses the entirely separate `reassignClientCoach` mechanism, bypassing this request/approval table.

**Resolution** (admin-only, terminal at `approved`/`rejected` — no further state modeled):
- **Approve + admin picks the new coach directly** → immediate `reassignClientCoach` — checks the new coach's availability actually covers every day/time in the client's current recurring pattern (refusing, with the specific uncovered days named, unless force-overridden); **repoints** (does not retire+recreate) the existing recurring slot and its matching bookings in place — day/time preserved, only the coach changes.
- **Approve without picking a coach, or reject** → client notified; on "approved, no coach yet," the client must self-serve (`findCoachChangeOptions` → `completeCoachChange`), which **retires** the old pattern (cancels old slots + their still-upcoming bookings, reason "Client changed coaches") and creates a brand-new one with the chosen coach — **no reminder/expiry mechanism exists** for a client who never completes this step; the request can sit `approved` with `new_coach_id: null` indefinitely.

---

# 37. Leave Management

Coach-only request (`requestLeave`): date range, `leave_type` full_day (default) or partial (single date only, explicit start/end time window). **Hard, unconditional 24-hour advance-notice rule, computed against IST midnight of the start date — no admin bypass, no emergency fast-track exists anywhere in code.** A genuinely last-minute absence never produces a `coach_leave` row at all; it must go through the entirely separate manual shadow-assignment tool (§38) instead — meaning the "Shadow Coverage" gap queue (which is derived from *approved leave rows*) will **not** surface a gap caused by an emergency absence handled this way.

**Admin's "block a slot" shortcut** (`createOneDayLeave`) reuses the exact same `coach_leave` table at `status:"approved"` directly (default reason "Blocked by admin") rather than a distinct concept — meaning it will appear in the coach's own "My Leave Requests" list indistinguishably from real leave, differentiated only by that default reason string (§48).

**Approval** (`resolveLeave`, admin-only, the single most complex function in the coach-lifecycle domain): rejection is a simple status flip + coach notification, no downstream effects. Approval: notifies the coach **and every one of that coach's active clients** (a broader set than strictly "has a session in the leave window" — a client whose sessions don't actually overlap the leave dates still gets the notice), then runs the full shadow-coverage matching engine (§38) for (a) every affected client of the leaving coach, and (b) cascade: any *other* client this coach was themselves currently shadow-covering for someone else, since their own leave now needs re-covering too. Leave itself **never cancels a booking** — affected bookings are silently reassigned in place to the shadow coach for the duration.

---

# 38. Shadow Coverage

**Purpose:** temporary reassignment of a client's sessions to a covering coach without disturbing the primary coach relationship, preserving continuity (§4).

**Trigger paths (four):** (1) automatic, on the leaving coach's own leave approval; (2) automatic cascade, when a coach who was *themselves* covering as a shadow for someone else also goes on leave; (3) manual, admin-initiated for an undocumented/emergency absence (preview → confirm, never touches `coach_leave`); (4) a persistent, **live-derived (no stored table)** "Shadow Coach Required" gap queue surfacing any booking whose coach is on approved leave with no shadow ever assigned.

**Candidate scoring** (`scoreShadowCandidate`, quoted exactly): exact specialization match `+40` (secondary-specialization match only `+20`); shared languages `min(shared,3)*10` (up to `+30`); `rating*6` (up to `+30` at 5.0); `(100-utilizationPct)*0.2` (up to `+20` at 0% utilization) — max ≈120, rounded to 1 decimal. Utilization is the *lowest*-weighted factor despite having previously been the *only* factor scored (per the code's own comment history).

**Matching is per-occurrence, not per-date-range** — a coach free for only 3 of a client's 5 weekly sessions during the leave window is a valid, expected candidate for exactly those 3; different sessions can and do land on different shadow coaches. Feasibility per occurrence uses the same conflict-safe DB functions the live booking engine uses (does account for the outgoing coach's leave — unlike the fresh-pattern search used for coach changes, which deliberately does not check leave). Consecutive occurrences assigned to the same coach are grouped into one contiguous `(startsOn, endsOn)` assignment row; an uncovered occurrence forces a hard group break (a deliberate guard preventing a later same-coach occurrence from incorrectly extending a date-range reassignment *across* the gap day).

**Resulting state:** inserts a `shadow_coach_assignments` row (`status:"active"`) and **directly rewrites `bookings.coach_id`** for every matching upcoming booking — the booking is never duplicated or cancelled, just repointed for the covered dates. Reassigning a shadow's own shadow coverage marks the superseded assignment `cancelled` (never deleted) before inserting the replacement.

**Confirmed gap — no automatic reversion:** there is no function anywhere in the audited codebase that reassigns a booking back to the primary coach once a shadow assignment's `ends_on` passes, and no scheduled sweep does this either. This is a genuine, identified missing lifecycle step, not an assumption — flagged for explicit product decision in §52.

**Any occurrence with zero available candidates is never silently dropped** — it is flagged (`unassignedFlagged`) and triggers an admin-alert notification for manual intervention, both in the automatic and manual paths.

---

# 39. Search

Two distinct implementations with different scope, reflecting the role's actual permission model:
- **Coach's "Global Search"** (`/coach/search`) — fetches every client on the platform once (RLS widened specifically for this in migration `0033`), filters client-side; results are tagged "Your client" vs "Read-only" (§17.9/§17.6's read-only banner on non-assigned clients).
- **Admin's Universal Search** (`/admin/search`) — same client-side-filter pattern, but no RLS-widening was ever needed since admin already has unrestricted read access.

Neither exists for the client role (a client has no reason to search other clients).

---

# 40. Reports

Five fixed, on-demand-generated reports (`/admin/reports`, §18.20), each independently exportable as CSV or lazily-loaded-library PDF: **Client Report** (roster + package/status/coach), **Coach Report** (utilization/rating/active-client-load), **Monthly PT Report** (session volume + **Completion Rate % = round(completed/total*100)**, 0 if zero total, + assessment-session counts), **Revenue Report** (reads `revenue_trend_view` directly), **Cancellation/No-Show Report** (concatenated cancelled+missed bookings).

**Admin Dashboard metrics** (§18.1, all computed live on every page load, no caching): total/active clients, sessions booked/cancelled today, average trainer utilization, peak booking hour, empty-slot count (`totalSlotsToday - sessionsBookedToday`, floored at 0), revenue this month (last row of the revenue-trend view), average sessions/client, active-coach count + average rating, average sessions/day (trailing 30 days), renewal opportunity count + rate (explicitly `null`, not `0`, when zero opportunities exist — distinguishing "no data" from "0% conversion").

**Sales/revenue figures are price-*at-query-time*, not price-*at-sale-time***: both `sales_view` and `revenue_trend_view` join to the package's *current* price (since `subscriptions` stores no `amount_paid` of its own) — editing a package's price after the fact **retroactively changes** how historical sales/revenue reports read (§42/§48).

---

# 41. Activity Logs

Automatic, **DB-trigger-based** capture (`fn_audit_trigger`, a `SECURITY DEFINER` Postgres function) — not something any service function has to remember to call — attached to exactly five tables: `bookings`, `subscriptions`, `coach_change_requests`, `client_profiles`, `coach_profiles` (`package_tiers`/`system_settings` added later, migration `0029`). Captures a **whole-row before/after JSONB snapshot** (not field-level) plus actor, action (INSERT/UPDATE/DELETE), entity type/id, and timestamp, on *every* mutation to those tables regardless of which code path performed it.

**One manual-write path exists** for events that aren't a simple row diff on those tables: `writeAuditLog`, used exactly once in the entire codebase — for `logRefundRequest`.

**Admin's Activity Log screen** (`/admin/activity-log`, §18.22) reads up to **200 most-recent rows** (hard cap, no further pagination), computes a display summary at read time (up to 3 changed keys for an UPDATE, `"Created"`/`"Deleted"` otherwise), and resolves `actor_id` to a name (or "System" if null, "Unknown" if unresolvable).

**Coverage is asymmetric and must not be assumed complete:** changes to `profiles`, `progress_logs`, `client_onboarding`, `notifications`, `messages`, `conversations`, `escalations`, `coach_leave`, `shadow_coach_assignments` are **not** captured in `audit_logs` at all — a compliance reviewer or mobile-parity auditor should not assume audit coverage extends to those tables.
# 42. Database Specification

Derived from all 57 migrations (`supabase/migrations/0001_enums.sql` through `0057_schedule_and_coach_change_notification_templates.sql`), reconciled to the **final** schema state (later migrations frequently alter earlier tables — every column/constraint below reflects the current shape, with "added by" notes for anything not present at table creation).

## 42.1 Enums

| Enum | Final values | Used by |
|---|---|---|
| `user_role` | admin, coach, client | `profiles.role` |
| `account_status` | active, suspended | `profiles.account_status` |
| `coach_status` | active, inactive, on-leave | `coach_profiles.status` |
| `client_status` | active, inactive, paused | `client_profiles.status` (raw; UI uses the *derived* 6-bucket status, §13/§21) |
| `package_category` | advance, addon | `package_tiers.category` |
| `subscription_status` | active, inactive, paused, **awaiting_activation** (added 0019) | `subscriptions.status` |
| `session_type` | assessment, regular | `bookings.session_type` |
| `booking_status` | upcoming, completed, cancelled, missed | `bookings.status` |
| `shift_source` | generated, override | `coach_shifts.source` |
| `leave_status` | pending, approved, rejected | `coach_leave.status` |
| `recurring_slot_status` | active, paused, cancelled | `recurring_slots.status` (**`paused` never set by any code**) |
| `temporary_booking_status` | held, confirmed, expired, **released** (never set by any code) | `temporary_bookings.status` |
| `assessment_status` | scheduled, completed, cancelled, missed | `assessment_sessions.status` |
| `shadow_assignment_status` | active, completed, cancelled | `shadow_coach_assignments.status` (**`completed` never set by any code**) |
| `coach_change_status` | pending, approved, rejected | `coach_change_requests.status` |
| `attendance_status` | present, absent, late | `attendance.status` |
| `notification_type` | booking, reminder, feedback, system | `notification_templates.type`, `notifications.type` |
| `escalation_status` | open, **in_progress** (added 0019), resolved | `escalations.status` |
| `fitness_goal` | fat_loss, muscle_gain, strength, general_fitness, rehabilitation | `client_onboarding.fitness_goal` |
| `leave_type` | full_day, partial | `coach_leave.leave_type` |

## 42.2 Tables (grouped by domain; final shape after all migrations)

### Identity
- **`profiles`** — PK `id` (FK→`auth.users`, cascade). `role`, `full_name`, `phone`, `photo_url`, `account_status`, `emergency_contact` (added 0023), `created_at`/`updated_at`.
- **`coach_profiles`** — PK `id`; `profile_id` (unique FK→profiles). `specialization`, `secondary_specializations[]`, `years_experience`, `bio`, `certifications[]`, `languages[]`, `rating` (0–5 check), `review_count`, `status`, `employee_code` (unique, added 0016), `max_capacity` (default 50, added 0018), `gender` (added 0020), `skills[]` (added 0034, append-only via RPC).
- **`client_profiles`** — PK `id`; `profile_id` (unique FK→profiles). `medical_notes`, `equipment[]`, `goals[]`, `joined_date`, `status`, `client_code` (unique, sequence-backed `CL0001`-style, added 0022).
- **`client_onboarding`** — PK `id`; `client_id` (unique FK→client_profiles, one row per client). `age`, `gender`, `height_cm`, `weight_kg`, `medical_conditions`, `injuries`, `medications`, `exercise_restrictions`, `fitness_goal`, `submitted_at`. One-insert, admin-only-update afterward (app-layer, not RLS-expressible).

### Commerce / Payments
- **`package_tiers`** — `name`, `category`, `sessions_count` (>0), `price` (≥0), `original_price`, `features[]`, `highlighted`, `is_active`, `default_pause_days` (added 0036).
- **`subscriptions`** — `client_id`, `package_id` (FK, no cascade — RESTRICT), `sessions_total` (>0), `status`, `started_at`, `paused_at`, `resumed_at`, `activated_at` (added 0020, separate from purchase time), `pause_days_allowed` (added 0036). **`pause_days_used` is deliberately not a column** — derived at query time from `client_timeline_events` pause_started/pause_ended pairs, to avoid a second drifting counter.
- **`payments`** (added 0038) — `client_id`, `purpose` (package_purchase|demo_session), `package_id`/`demo_coach_id`/`demo_slot_start`, `amount`, `currency` (default INR), `razorpay_order_id` (unique), `razorpay_payment_id`, `razorpay_signature`, `status` (created|paid|failed|paid_unfulfilled), `subscription_id`/`booking_id`, `paid_at`.

### Coaching / Scheduling
- **`coach_availability`** — `coach_id`, `day_of_week` (0–6), `start_time`/`end_time`, `is_active`. **Admin-write-only since migration 0045.**
- **`coach_shifts`** — `coach_id`, `shift_date`, `start_time`/`end_time`, `source` (generated|override). Overrides the weekly template entirely for that date (not merged).
- **`coach_leave`** — `coach_id`, `starts_on`/`ends_on`, `reason`, `status`, `leave_type` (added 0031), `partial_start_time`/`partial_end_time` (added 0031, CHECK-enforced consistency with leave_type and single-day-only for partial).
- **`recurring_slots`** — `client_id`, `coach_id`, `subscription_id` (FK, SET NULL on delete), `day_of_week`, `start_time`, `duration_minutes` (default 45), `status`.
- **`temporary_bookings`** — `client_id`, `coach_id`, `slot_start`, `duration_minutes`, `expires_at`, `status`.
- **`assessment_sessions`** — `prospect_name`/`email`/`phone` (no account required), `assigned_coach_id`, `scheduled_start`, `status`, `converted_client_id` (FK, SET NULL) — the public/logged-out lead-capture table, distinct from the authenticated demo flow's real `bookings` rows.
- **`bookings`** — the central table. `client_id`, `coach_id`, `subscription_id`/`recurring_slot_id`/`assessment_session_id` (all nullable FKs), `scheduled_start`, `duration_minutes`, `session_type`, `status`, `cancelled_by`/`cancel_reason`, `escalation_id` (added 0018), `no_show_party`/`technical_issue`/`coach_on_leave`/`was_rescheduled`/`original_scheduled_start` (added 0018), `amount_paid` (added 0027), `quality_rating`/`trainer_rating`/`rating_note`/`rated_at` (added 0030, superseding legacy `rating`/`client_feedback`), `attendance_overdue` (added 0032), `zoom_meeting_id`/`zoom_join_url`/`zoom_start_url` (added 0037), `coach_joined_at` (added 0047), `notes_overdue` (added 0048), `reminder_sent_at` (added 0056). **Hard exclusion constraint** `bookings_no_coach_overlap` (GIST index) prevents any two overlapping `upcoming` bookings for the same coach, unconditionally, at the database level.
- **`shadow_coach_assignments`** — `client_id`, `primary_coach_id`, `shadow_coach_id` (CHECK: must differ), `starts_on`/`ends_on`, `reason`, `status`.
- **`coach_change_requests`** — `client_id`, `current_coach_id`, `new_coach_id` (nullable, FK SET NULL), `reason`, `status`, `resolved_by`/`resolved_at`, `overall_experience`/`coach_rating`/`additional_comments` (1–5 checks, added 0020).

### Session Content
- **`attendance`** — `booking_id` (unique FK, 1:1), `status`, `checked_in_at`/`checked_out_at`, `marked_by`, `client_joined_at`/`client_left_at`/`coach_joined_at`/`coach_left_at` (added 0018).
- **`workout_notes`** — `booking_id` (unique FK, 1:1), `client_id`, `coach_id`, `notes` (repurposed as "Session Summary"), `homework`, `exercises_performed`/`performance_rating`/`improvements[]`/`additional_remarks` (added 0021).
- **`progress_logs`** — `client_id`, `logged_at`, `weight`, `body_fat_pct`, `streak_count`, `notes`, `photo_url`, `muscle_pct`/`waist`/`chest`/`hip`/`arms`/`thigh` (added 0018).
- **`client_timeline_events`** — `client_id`, `event_type` (free-form string), `title`, `description`, `metadata` (jsonb), `actor_id` (SET NULL). **Append-only — no update/delete RLS policy exists for any role, including admin.**

### Escalations
- **`escalations`** — `client_id`, `coach_id`, `raised_by` (null=admin-logged), `reason`, `description`, `status`, `resolved_by`/`resolved_at`/`resolution_notes`, `category` (7-value CHECK, added 0020), `admin_issue_type`/`fault`/`admin_summary`/`called_client_at`/`called_by` (added 0049).
- **`escalation_notes`** (added 0049) — `escalation_id`, `author_id`, `note` — append-only, client-visible.

### Chat
- **`conversations`** (added 0042) — `client_id`, `coach_id`, `status` (active|closed), `opened_at`/`closed_at`. **Unique partial index: at most one `active` row per client.**
- **`messages`** (added 0042, extended 0044) — `conversation_id`, `sender_role`, `sender_profile_id`, `body` (nullable since 0044), `attachment_url` (added 0044), `read_at` (added 0044). CHECK: body **or** attachment must be present (never neither).

### Notifications / Audit / Settings
- **`notification_templates`** — `key` (unique), `type`, `title_template`, `body_template` (`{{var}}` placeholders); ~45 keys by migration 0057.
- **`notifications`** — `user_id`, `template_key`, `type`, `title`, `message`, `related_entity_type`/`id`, `read`, `channels` (jsonb, schema exists, never populated by code).
- **`audit_logs`** — `actor_id`, `action` (INSERT/UPDATE/DELETE), `entity_type`, `entity_id`, `old_data`/`new_data` (jsonb whole-row snapshots), `created_at`. Written exclusively by trigger (or, once, `writeAuditLog` for refund requests).
- **`system_settings`** — `key` (PK), `value` (jsonb), `description`, `updated_at`. Keys: `reschedule_cutoff_hours` (1, repurposed from an original 12 by migration 0025), `cancellation_cutoff_hours` (12, added 0025), `default_session_duration_minutes` (45), `inactivity_threshold_days` (30), `join_window_minutes` (10, **not admin-exposed**), `assessment_session_duration_minutes` (60, **not admin-exposed**), `temporary_booking_hold_minutes` (10, **not admin-exposed**).

## 42.3 Views (all `security_invoker=true`, so RLS applies as the calling user, not the view owner)

`subscription_usage_view` (sessions_used/remaining per subscription, counts only *completed* bookings — note this differs from `confirm_booking`'s own credit check, which counts upcoming+completed), `coach_utilization_view` (active_clients, utilization_pct), `revenue_trend_view` (6-month rolling revenue/sessions), `bookings_by_hour_view`, `inactive_clients_view`, `sales_view` (added 0035, joins subscriptions→packages→clients for transaction-level reporting, priced at *current* package price, not sale-time price — §40).

## 42.4 Key Database Functions (RPCs called from application code)

`is_slot_within_working_hours`, `has_scheduling_conflict` (the two conflict-safety chokepoints, called from nearly every scheduling write path), `create_temporary_booking`/`confirm_booking` (hold→confirm, the latter carrying the session-credit check since migration 0053), `generate_bookings_from_recurring_slot`, `cancel_booking`/`reschedule_booking` (cutoff-enforcing), `assign_shadow_coach`/`reassign_shadow_coverage`, `mark_missed_bookings`/`expire_temporary_bookings`/`flag_overdue_attendance`/`flag_overdue_notes` (all opportunistic sweeps, no cron), `append_coach_skill` (append-only, SECURITY DEFINER with an internal ownership re-check), `custom_access_token_hook` (Supabase Auth Hook injecting `user_role` into JWTs, migration 0054 — requires a manual Supabase Dashboard toggle, not settable via migration), plus RLS helper functions `is_admin()`/`my_role()`/`my_coach_id()`/`my_client_id()`/`coach_client_linked()`.

## 42.5 RLS Authorization Model Summary (per table, condensed — see the coach-lifecycle and client-ops sections for the exact business rules this enforces)

Every application table has RLS enabled. General pattern: admin sees/writes everything; a user always sees/edits their own `profiles` row; `coach_profiles` is fully readable by any authenticated user (booking flow needs to browse coaches) but self/admin-writable only; `client_profiles`/`profiles`(-as-client-identity) were widened in migration 0033 to let **any** coach read **any** client's identity+timeline (global search) while `progress_logs` was deliberately **not** widened (health data stays assigned-only); `bookings` rows are globally *readable* by any authenticated user (documented tradeoff, needed for slot-availability checks) but writable only by the owning client/coach, with a **BEFORE UPDATE trigger** (migration 0052) closing the column-level gap RLS itself cannot express (a client/coach could otherwise PATCH `status`/`scheduled_start`/`coach_id` directly, bypassing every cutoff/conflict rule the RPCs enforce); `messages` has an equivalent trigger restricting a non-admin's UPDATE to `read_at` only; `client_timeline_events` and `audit_logs` have **no client/coach write policy at all** — system/trigger-written only; `payments` has **no client/coach write policy at all** — every write goes through the service-role client after signature verification.

## 42.6 Storage Buckets

`avatars` (public read, owner-write) and `chat-attachments` (public read, participant-scoped write) are **actively used**. `progress-photos` and `coach-certifications` were created with full RLS policy sets (migration 0013) but are **never referenced by any application code** — schema-only, unbuilt features; do not describe them as live in a mobile spec.

## 42.7 Entity Relationship Summary

```
auth.users → profiles → {coach_profiles, client_profiles}
client_profiles → client_onboarding (1:1)
{client_profiles, coach_profiles} → recurring_slots → subscriptions (0:1)
recurring_slots → generates → bookings ← assessment_sessions (0:1, demo conversion)
bookings → attendance (1:1), workout_notes (1:1)
client_profiles → progress_logs (1:N), client_timeline_events (1:N, append-only)
package_tiers → subscriptions → payments (0:N) → bookings (0:1, demo) / subscriptions (0:1, plan)
{client_profiles, coach_profiles} → conversations (≤1 active) → messages (1:N)
{client_profiles, coach_profiles, profiles} → escalations → escalation_notes (1:N)
shadow_coach_assignments: client_id, primary_coach_id, shadow_coach_id → their respective profiles
coach_change_requests: client_id, current_coach_id, new_coach_id, resolved_by → profiles
notification_templates → notifications → profiles
audit_logs → profiles (actor); system_settings (standalone key-value)
```

## 42.8 Schema Evolution Notes Material to a Mobile Rebuild

1. **A real IST/UTC timezone bug** (fixed migration 0026): booking/leave/shadow-assignment date+time math originally used the server's UTC session timezone instead of India wall-clock time, off by 5.5 hours. Pre-fix data may still carry this skew.
2. **Cancel vs. reschedule cutoffs were split from one setting into two** (migration 0025) — a subtle repurposing of an existing key's *meaning*, not just a new key.
3. **Rating model split** (migration 0030) — `rating`/`client_feedback` are legacy, superseded by `quality_rating`/`trainer_rating`/`rating_note`/`rated_at`; do not build new features against the old columns.
4. **Coach availability write access was revoked from coaches** (migration 0045) — any reference material predating this would incorrectly describe coaches as self-service on their own hours.
5. **Global client visibility for coaches was added** (migration 0033) — identity/timeline only, deliberately excluding `progress_logs`.
6. **A real, documented role-escalation vulnerability and its fix** spans migrations 0002→0040→0050→0051→0055 (§20.7) — the canonical account-provisioning model is: role can only ever come from `raw_app_meta_data`, settable only by privileged service-role code.
7. **Column-level RLS gaps were closed by triggers, not RLS itself** (migration 0052) — a materially incomplete authorization picture would result from describing only the RLS policies for `bookings` and `messages`.
8. **A real session-credit-check bypass existed for ~40 migrations** (0011→0053) and required an explicit `DROP FUNCTION` of a stale overload to fully close — a cautionary precedent for any future RPC signature change.
9. **`temporary_booking_status.released`, `recurring_slots.status='paused'`, and `shadow_coach_assignments.status='completed'`** are all defined enum values with **no producing code path anywhere in the audited codebase** — treat as dead/reserved values, not planned states to reproduce functionality for.

---

# 43. API Specification

**There is no conventional REST/GraphQL API to document endpoint-by-endpoint** (see §7) — the real "API surface" is the set of Server Action functions plus the Postgres RPCs they call. This section enumerates the actual callable surface, organized by domain, so a mobile rebuild (or a new shared API layer, §8 Option B) knows exactly what must be reproduced.

## 43.1 Server Action files (34) and primary responsibility

| File | Domain |
|---|---|
| `admin-audit.actions.ts` | Activity log reads (§41) |
| `admin-availability.actions.ts` | Availability-check screen (§26) |
| `admin-clients.actions.ts` | Client CRUD, adjustments, refund/escalation/measurement logging (§18.3/18.4) |
| `admin-coach.actions.ts` | Coach CRUD, bulk reassignment, slot-blocking (§18.6/18.7) |
| `admin-coach-change.actions.ts` | Coach-change-request resolution (§36) |
| `admin-coach-performance.actions.ts` | Coach performance read (§40) |
| `admin-dashboard.actions.ts` | Dashboard KPIs (§40) |
| `admin-escalations.actions.ts` | Full escalation admin workflow (§34) |
| `admin-leave.actions.ts` | Leave approval (§37) |
| `admin-progress.actions.ts` | Admin progress-log actions |
| `admin-reports.actions.ts` | 5 report generators (§40) |
| `admin-sales.actions.ts` | Sales list (§40) |
| `admin-scheduling.actions.ts` | Grouped scheduling-activity view (§18.13) |
| `admin-session-detail.actions.ts` | Single-session admin detail (§18.17) |
| `admin-sessions.actions.ts` | Sessions master list, cancel/reschedule (§18.16) |
| `admin-settings.actions.ts` | Platform settings + package CRUD (§18.23) |
| `admin-shadow-coach.actions.ts` | Shadow-coverage gap queue + manual preview/confirm (§38) |
| `admin-timeline.actions.ts` | Client timeline read for admin |
| `action-result.ts` | Shared `ActionResult`/`runAction` error-normalization wrapper — not a domain action file |
| `chat.actions.ts` | Send/read/mark-read messages (§32) |
| `client-coach.actions.ts` | "My Coach" resolution (§36) |
| `client-coach-change.actions.ts` | Client-side coach-change request/complete (§36) |
| `client-concerns.actions.ts` | Raise/list concerns (§34) |
| `client-journey.actions.ts` | Journey-stage gate, marketing plans, demo booking (§13/§23) |
| `client-notifications.actions.ts` | Notification list/read (§33) |
| `client-portal.actions.ts` | Booking confirm, reschedule options, scheduling rules (§27/§31) |
| `client-profile.actions.ts` | Own profile edit (§21) |
| `client-progress.actions.ts` | Own progress log CRUD (§31) |
| `coach-portal.actions.ts` | The largest coach action file — dashboard, schedule, session detail, attendance, notes, activity feed (§17/§28/§29) |
| `coach-profile.actions.ts` | Own coach profile edit, skill append (§21) |
| `payments.actions.ts` | Razorpay order creation + verification (§23) |
| `phone-otp.actions.ts` | MSG91 phone OTP send/verify (§20) |
| `renewals.actions.ts` | Renewal opportunity/low-session status (§35) |
| `schedule.actions.ts` | Recurring-schedule setup/change/match (§27) |

## 43.2 Service files (35) — the actual business logic layer

`_auth.ts` (caller context/role guard, §46), `adminDashboard.service.ts`, `audit.service.ts` (§41), `availability.service.ts` (§26/§37), `bookings.service.ts` (§24/§27/§28/§29/§30), `chat.service.ts` (§32), `clientStatus.ts`/`client-status.ts` (§13/§21 derivation), `clients.service.ts`, `coachChange.service.ts` (§36/§38), `coachPerformance.service.ts` (§40), `coaches.service.ts` (§21), `demoBooking.service.ts` (§23/§27), `email.service.ts` (Resend wrapper), `escalations.service.ts` (§34), `notifications.service.ts` (§33), `onboarding.service.ts` (§21), `packages.service.ts` (§22), `payments.service.ts` (§23), `planPurchase.service.ts` (§22/§23/§35), `profiles.service.ts` (§21), `progressLogs.service.ts` (§31), `razorpay.service.ts` (§23), `renewals.service.ts` (§35), `sales.service.ts` (§40), `scheduling.service.ts` (§27/§38 — the largest, most complex service file), `sessionNotifications.service.ts` (§33), `settings.service.ts` (§18.23), `sms.service.ts` (MSG91 wrapper), `subscriptions.service.ts` (§22/§35), `timeline.service.ts` (client-timeline read/write), `zoom.service.ts` (§25).

## 43.3 The two real HTTP Route Handlers

- `POST /api/webhooks/razorpay` — server-to-server payment reconciliation (§23).
- `GET /api/cron/session-reminders` — Vercel Cron-triggered, `CRON_SECRET`-gated (§33).

## 43.4 Reuse Principle for a Mobile Rebuild

Because business logic is concentrated in the 35 service files (not scattered across UI code), a new shared API layer (§8 Option B) is a relatively contained rewrite: each Server Action's body is already a thin call into exactly one or two service functions — porting each to a Route Handler is largely mechanical. Conversely, if Option A (mobile talks to Supabase directly) is chosen, every one of these service functions' *validation and side-effect logic* (not just its final query) would need to be either reproduced in the mobile client or migrated into Postgres functions — a materially larger undertaking, since much of the logic (cutoff math, fallback ladders, shadow-coach scoring, notification fan-out) is TypeScript, not SQL.

---

# 44. Integration Specification

## 44.1 Razorpay (full detail in §23)
Raw REST + HMAC, no SDK. Two independent signature-verification paths (Checkout success signature vs. webhook signature, different secrets). `payments` table is the ledger; `paid_unfulfilled` is the explicit "money captured, action needed" state — never silently dropped. Failure handling is fail-safe (webhook always 200s; a fulfillment exception downgrades to a support-referenceable state rather than losing track of the payment).

## 44.2 Zoom (full detail in §25)
Server-to-Server OAuth, one shared business account, lazy per-booking meeting creation, in-memory-only access-token cache (no persistence). No webhook consumption — session completion is entirely coach-action-driven, not Zoom-verified.

## 44.3 Resend (Email)
Used for essentially every notification with a resolvable recipient email (`notifyUser`/`notifyClient`/`notifyCoach`). Requires `RESEND_API_KEY` + a verified `EMAIL_FROM` sender identity. **Fail-soft**: any failure (missing config, API error) is caught and logged, never surfaced to the end user or the triggering flow.

## 44.4 MSG91 (SMS + OTP)
Two distinct uses: (a) **OTP** (`sms.service.ts#sendPhoneOtp`/verify, `POST /api/v5/otp` and `/otp/verify`, 6-digit code, 10-minute expiry) for signup/phone-gate verification; (b) **transactional SMS**, client-only, for a fixed enum of 7 session-lifecycle events, each requiring its own India-DLT-approved template id in environment configuration (`MSG91_TEMPLATE_ID_<EVENT>`) — a freeform SMS body is not legally usable under India's telecom regulation. **Currently operating with a known, temporary, code-commented gap**: MSG91 KYC/DLT approval is not yet complete, so OTPs are accepted by the API but do not actually deliver — every phone-verification surface in the app currently ships a "Skip for now" bypass that saves a phone number **unverified** (§20.3, §46, §48, §52). Any mobile rebuild must decide explicitly whether to reproduce this bypass (matching current, if imperfect, production behavior) or require this be fixed first (a real product decision, not this document's to make).

## 44.5 Supabase (Auth, Storage, Realtime — the platform itself, not a third party in the traditional sense, but architecturally load-bearing)
Auth: email/password + Google OAuth, JWT-based sessions, a Custom Access Token Hook (migration 0054) embedding role as a claim (requires a manual, non-migratable Supabase Dashboard toggle — see §53 open question on whether this is actually enabled in production). Storage: `avatars` and `chat-attachments` buckets, both public-read with owner/participant-scoped write RLS. Realtime: `postgres_changes` subscriptions on `messages` for live chat delivery and read receipts — the **only** realtime feature in the entire application; every other screen is request/response (server-fetch-on-navigation), not live-updating.
# 45. Web–Mobile Synchronization

**Governing rule** (per stakeholder requirement, §10 of the master instruction): any action on one platform must be reflected on the other. Because both platforms would read/write the **same** Postgres database (§8), most of this is automatic *at the data layer* — the open questions are about **how fresh** each screen needs to be, not whether the data itself is shared.

## 45.1 Classification of every mutable entity by required freshness

| Entity / Action | Web today | Required sync behavior |
|---|---|---|
| Booking created/cancelled/rescheduled | Server-fetch on next page load (no realtime) | **Re-fetch on screen focus** is sufficient — the existing web app itself does not push live updates to other open tabs/sessions; mobile should match this (a push notification, §33, is the actual "you should know now" mechanism, not a live query subscription) |
| Coach assignment changed (coach change, shadow coverage) | Server-fetch + notification | Push notification (already exists as an in-app/email notification, §33) should trigger a **background refresh** of "My Coach"/schedule screens if the mobile app is open; otherwise refresh-on-open is sufficient |
| Chat messages | **Realtime** (`postgres_changes` subscription) | **Must** be realtime on mobile too — this is the one feature the web app itself already treats as live, and users will directly notice a lag their web counterpart doesn't have |
| Payment/subscription status | Server-fetch (webhook is the actual async-completion signal) | Re-fetch on screen focus; the Razorpay webhook already guarantees eventual consistency regardless of which client initiated the payment |
| Leave/coach-change/escalation approvals | Server-fetch + notification | Refresh-on-open + notification, matching web's own non-realtime pattern |
| Admin dashboard KPIs | Computed live on every load, no caching | Same on mobile — do not introduce a caching layer the web app itself doesn't have, or the two platforms will visibly disagree |

**Explicit non-recommendation:** do **not** introduce a general-purpose realtime/WebSocket layer for entities the web app itself only refreshes on navigation (bookings, subscriptions, escalations, leave, coach changes) — this would be new architecture the web app doesn't have and isn't asked for; it also risks the two platforms disagreeing about "how live is live" in ways that are hard to test. Reserve realtime for chat only, mirroring what already exists.

## 45.2 Immediate-refresh vs. background-sync examples (per the master instruction's format)

```
Client books session on mobile
        ↓
bookings row inserted (shared DB)
        ↓
Client's own mobile schedule updates immediately (it just made the call)
        ↓
Client's web session shows it on next page load/refresh (no push needed — same as web-to-web today)
        ↓
Coach's web/mobile schedule shows it on next page load (or a booking-confirmation notification if one exists for coaches — confirm against §33's template catalog)
        ↓
Admin's scheduling/sessions views show it on next load (no realtime needed — matches today's admin-portal behavior)
```

```
Admin changes a client's coach on web
        ↓
recurring_slots/bookings repointed (shared DB)
        ↓
Client's web/mobile "My Coach" + schedule reflect the new coach on next load, PLUS a coach_changed_client notification (push, if mobile push is wired up)
        ↓
New coach's web/mobile client list includes the client on next load
        ↓
Old coach's chat thread with the client freezes (conversations.status → closed) immediately at the DB level — reflected instantly on whichever platform that former coach next opens the thread on
```

## 45.3 What must NOT be duplicated into a mobile-only store

Per §8/§42: no mobile-only database, no mobile-only derived-status cache (client status must always be recomputed the same way, §13, not cached differently per platform), no mobile-only notification-read state (the `notifications.read` column is the single source of truth for both platforms' unread badges).

---

# 46. Security & Permissions

## 46.1 Three-Layer Authorization (the load-bearing architecture fact for any mobile rebuild)

1. **Route-level gate** (`middleware.ts`, web-only — a mobile app has no equivalent middleware layer and must re-implement role-gating at the navigation/screen level instead): derives required role from the URL, verifies the JWT locally via cached JWKS, reads a custom `user_role` claim (with a DB-query fallback if the claim is absent).
2. **Service-layer `requireRole()`**: an early, friendlier rejection in front of the real boundary — removing it would not open any new access, only degrade error messages.
3. **Postgres RLS on every table** — the actual, non-bypassable enforcement layer. **A mobile app calling Supabase directly (§8 Option A) inherits this automatically and correctly**, which is a strong argument for that architecture option: RLS does not care which platform issued the query.

A small number of **BEFORE UPDATE triggers** (migration `0052`) close a genuine RLS blind spot (row-level RLS cannot restrict *which columns* an otherwise-permitted UPDATE touches) on `bookings` and `messages` specifically — any mobile write path to these two tables must go through the same RPCs/service functions the web app uses, not a raw table UPDATE, or it will hit the same trigger-enforced rejection (which is correct and must not be "fixed" by weakening the trigger).

## 46.2 Role Provisioning (the only way accounts get their role)

- **Client:** self-serve (email/password or Google OAuth) — always defaults to `client`, cannot be escalated via any client-suppliable field.
- **Coach/Admin:** provisioned exclusively via privileged, service-role-only server code (`supabaseAdmin.auth.admin.createUser` with `app_metadata.role`) — there is no in-app, self-serve, or even admin-UI-driven path to create an admin account (only coach creation has a UI, `/admin/coaches/new`).
- **Historical vulnerability, now fixed** (§20.7, migrations 0051/0055): role must never be trusted from a public-signup-suppliable field on any platform. A mobile signup flow must follow the identical pattern — client role only, server-assigned, never client-declared.

## 46.3 Currently-Live, Known Security-Relevant Weaknesses (not hypothetical — confirmed present in the reviewed code)

1. **Phone verification is not actually enforced** — every phone-OTP surface (signup, PhoneGateModal) ships a "Skip for now" bypass, explicitly because MSG91 KYC/DLT approval is pending. A phone number can be saved to a profile today with zero proof of ownership.
2. **No password-reset flow exists on any platform** — "Forgot password?" is a dead button. A locked-out user currently has no self-service recovery path at all (must be admin-assisted out of band, if even that exists — no admin "reset a user's password" action was found either).
3. **CRON_SECRET is optional** — if unset, the session-reminders endpoint is effectively a public, unauthenticated trigger.
4. **The Supabase Custom Access Token Hook requires a manual Dashboard toggle** not expressible in a migration — its actual enabled/disabled state in any given deployment cannot be verified from source alone (§53).

## 46.4 Authorization Model a Mobile App Must Reproduce Exactly

The full permission matrix in §6 and the per-domain "who can do what" statements throughout §21–41 are not simplifications for this document — they are the literal RLS/service-layer rules. A mobile app must not grant a role any permission the web app's RLS wouldn't already allow that same authenticated user, and should not attempt to be "more permissive for convenience" on mobile — doing so would either (a) fail against RLS anyway (if using Supabase directly) or (b) create a real security divergence between platforms (if using a new API layer that doesn't mirror RLS faithfully).

---

# 47. Error Handling

**Universal pattern:** every Server Action returns a discriminated union `ActionResult` (`{success:true, data}` or `{success:false, error:{code, message}}`), produced by a shared `runAction()` wrapper that catches any thrown error — including RLS/Postgrest rejections and `requireRole()`'s `Forbidden: ...` messages — and normalizes it. **The literal thrown-error string is shown to the end user verbatim** in the vast majority of cases (e.g., "You've already submitted a measurement update this week -- next update available in a few days.") — there is no separate user-facing-copy layer distinct from the server's own error messages. A mobile rebuild reusing the same service functions (§8 Option A/B) inherits these exact strings "for free"; a from-scratch reimplementation must reproduce them verbatim to match behavior, not paraphrase them.

**No toast/snackbar system exists anywhere in the application** (confirmed independently across all three portals) — failures render as inline red text near the triggering control; successes are communicated via a state/route change, not a transient banner.

**Fail-soft vs. fail-hard, by design, not by accident:**
- **Fail-hard** (throws, blocks the caller): every cutoff/cap/gate violation (booking credit, cancellation cutoff, weekly measurement cap, escalation call-gate, attendance/notes sequencing) — these are business-rule violations, not infrastructure failures, and are meant to stop the user.
- **Fail-soft** (catches internally, logs, never surfaces): every outbound notification (email/SMS), the Zoom-meeting-cleanup-on-cancel step, and the coach-change "background" chat-conversation side effect — the reasoning throughout the codebase is consistent: a secondary side effect failing must never roll back or block the primary action that already succeeded.
- **The one deliberate exception inside the fail-soft group:** `createFromTemplate` (the in-app notification row itself) **does** throw on an unknown template key or insert failure, since a failure there would silently lose the *only* durable record of the event (the in-app bell), unlike email/SMS which are best-effort copies of it.

**Webhook-specific pattern:** the Razorpay webhook always returns HTTP 200 regardless of internal processing outcome — a retry cannot fix an application-level bug, and the `paid_unfulfilled` payment state already captures the failure for manual follow-up, so retry-storming the endpoint would add no value.

---

# 48. Existing Edge Cases

Consolidated from every audit pass's "edge cases" section — these are **confirmed, code-verified behaviors**, not hypothetical risks, and must be reproduced (not "fixed") in a mobile rebuild unless a deliberate product decision changes them (see §52 for which of these are flagged as candidates for an actual fix).

## 48.1 Data model / lifecycle gaps
- **No automatic reversion of shadow-coach coverage** back to the primary coach once the covering period ends — confirmed absent from every service file that touches shadow assignments.
- **`temporary_booking_status.released`, `recurring_slots.status='paused'`, and `shadow_coach_assignments.status='completed'`** are all defined enum values with zero producing code paths.
- **Sales/revenue reporting is priced at query-time, not sale-time** — editing a package's price retroactively changes how historical reports read, since neither `subscriptions` nor the reporting views store a frozen `amount_paid`.
- **Migrated clients' `sessionsRemaining` must be manually set to their true remaining count**, not their original plan size — because the system always derives remaining sessions as `total - completed-in-this-system`, setting it to the original size would silently over-grant already-used sessions from before the migration.
- **`coach_shifts` overrides silently supersede the weekly availability template** at the database level but are invisible in every client/admin-facing "open slots" UI (which never queries `coach_shifts` at all) — a genuine UI/DB-truth divergence, not merely an omission from this document.
- **Admin's "block a slot" reuses the leave table directly at `approved`** with a default reason of "Blocked by admin" — indistinguishable from real coach-requested leave anywhere `coach_leave` is displayed, except by that reason string.

## 48.2 Authentication / verification
- **Phone-number verification is not actually enforced** — a live, currently-shipping "Skip for now" bypass on every phone-OTP surface.
- **No password-reset flow exists at all**, on any platform.
- **The demo Razorpay payment path is fully built but dead code** — the live demo flow is entirely free and bypasses Razorpay; if ever reactivated via the dormant action, its webhook-reconciliation branch is a guaranteed `paid_unfulfilled` (no server-to-server fulfillment path exists for a demo purchase).

## 48.3 Business-rule asymmetries worth calling out explicitly
- **Reschedule cutoff (1h) is far shorter than cancellation cutoff (12h)** — a session too close to cancel outright can still be rescheduled.
- **Reschedule updates the booking row in place; cancellation regenerates a fresh occurrence** from the recurring slot — a client who habitually cancels-and-rebooks instead of rescheduling will accumulate more generated future occurrences over time than one who reschedules.
- **A substitute-coach reschedule never touches the recurring slot itself** — the very next auto-generated occurrence automatically reverts to the original coach, with no explicit "reversion" step needed (by design) — but this also means a client wanting a *permanent* coach swap must go through the coach-change flow, not repeated one-off reschedules.
- **`findAvailableCoach` ignores leave; `findShadowCoachCandidates` respects it** — two similarly-named "is this coach available" checks with genuinely different semantics.
- **Chat is gated on "has ever purchased a plan," not "has an assigned coach"** — a demo-only client has no chat channel even with an assigned demo coach.
- **`escalations.category` (client-facing) and `admin_issue_type` (admin-internal)** share the exact same 7-value vocabulary defined independently in both a DB CHECK constraint and a TypeScript constant — nothing guarantees they stay in sync if either is edited alone.
- **`updateEscalationDetails` is a full-replace of three fields together**, not a per-field merge — omitting one on a later call silently nulls it out.
- **The renewal "expired" classification is dependent on a `hasEverSubscribed` flag** computed in a service file outside the coach-lifecycle audit's scope — flagged for direct verification if precision here matters (§53).
- **Coach-performance date windows are not IST-normalized**, unlike almost every other date computation in the scheduling engine — a small but real timezone-boundary inconsistency.
- **`coachChangeRequestsReceived` and `totalWeeklySessions`/`totalMonthlySessions` performance metrics count ALL statuses** (including rejected requests, or cancelled/missed sessions respectively) — these are raw counts, not quality-filtered ones, and should not be read as "successful" activity.
- **`escalationsRaised` (coach performance metric) is a misnomer** — it counts escalations *about* the coach, not escalations the coach raised.

## 48.4 Notification / audit coverage gaps
- **Notification template interpolation silently drops unknown variables** rather than erroring or leaving a visible placeholder.
- **Audit-log coverage is asymmetric** — only 7 of the ~25 application tables are auto-audited; `profiles`, `progress_logs`, `messages`, `conversations`, `escalations`, `coach_leave`, and `shadow_coach_assignments` (among others) have no audit trail at all unless a specific call site explicitly writes one (only one such call site exists, for refund requests).
- **"Log Refund Request" moves no money** — it is audit-trail-only, by explicit design, since no payment-gateway refund integration exists.

## 48.5 Infrastructure / configuration
- **Two deployment configs exist side by side** (`vercel.json` and `netlify.toml`) — worth confirming which is the actual production target (§53).
- **The repo contains four separate Next.js build outputs** (base, admin, client, coach) suggesting the three portals may be deployed as separate instances of one codebase — worth confirming operationally (§53), though it does not change any of the application-layer behavior documented in this PRD.
# 49. Acceptance Criteria

Derived directly from the confirmed code behavior in §13/§23/§27/§34/§37/§38 — each criterion below is something the *existing* web application actually does, stated so a mobile implementation can be tested against it.

### Feature: Session Booking (ad-hoc)
```
Given a client with valid measurements (logged within 7 days) and no scheduling conflict,
When the client selects an open slot and confirms,
Then a bookings row is created at status "upcoming",
And the selected slot becomes unavailable to every other client for that coach/time,
And the session appears in the client's "My Sessions" (Upcoming tab),
And the session appears in the coach's Today's/Upcoming Tasks once its date arrives,
And the session appears in the admin's Sessions master list and Scheduling view,
And session_booked_client and session_booked_coach notifications are sent,
And the DB audit trigger captures the INSERT.

Given a client whose measurements are stale (≥7 days old or never logged),
When the client attempts to confirm any booking (regular or demo),
Then the booking is rejected server-side with "Please update your measurements before booking a session/demo,"
And no bookings row is created, regardless of what the client-side UI allowed them to select.
```

### Feature: Payment → Subscription Activation
```
Given a client with no active or awaiting-activation subscription,
When they complete Razorpay Checkout for a package,
And the payment signature verifies successfully,
Then a subscriptions row is created at status "awaiting_activation",
And the payments row is marked "paid" with the subscription_id attached,
And a plan_purchased_client notification is sent,
And the client is NOT yet able to book ongoing sessions until they separately activate the plan (pick a start date).

Given the Razorpay signature does not verify,
When verifyAndFulfillPayment runs,
Then the payments row is marked "failed",
And no subscription is created,
And the client sees "Payment verification failed -- signature mismatch."

Given a payment is captured by Razorpay but the subsequent subscription/booking creation throws (e.g., a race condition),
Then the payments row is marked "paid_unfulfilled" (never silently dropped),
And the client sees a support-reference error naming the order id.
```

### Feature: Coach Leave Approval → Shadow Coverage
```
Given an admin approves a coach's pending leave request,
When the leave covers dates on which that coach has active clients with recurring sessions,
Then for each such client, the system searches for the best-scoring available substitute coach for each affected occurrence individually,
And assigns coverage (creating shadow_coach_assignments rows and repointing the affected bookings' coach_id) wherever a candidate is found,
And flags any occurrence with zero available candidates for manual admin follow-up (never silently leaving it uncovered),
And notifies the leaving coach, every one of their active clients, each affected client's shadow coach, and admins (for any uncovered gap).

Given a coach's leave request does not meet the 24-hour advance-notice minimum,
When they attempt to submit it,
Then the request is rejected server-side with the exact notice-shortfall reason,
And no coach_leave row is created,
And no admin override exists to bypass this — a genuinely last-minute absence must go through the separate manual shadow-assignment tool instead.
```

### Feature: Escalation Resolution
```
Given a client-raised escalation with status "open",
When an admin has NOT yet confirmed a phone call with the client,
Then every resolution-workflow action (classify, add note, mark in-progress, resolve) is rejected server-side,
And only the "Confirm I've Called the Client" action is available.

Given the admin has confirmed the call,
When they submit Resolution Notes and click "Mark Resolved & Close,"
Then the escalation's status becomes "resolved" (terminal, no reopen path exists),
And the client is notified with the reason and resolution text,
And the client's "My Concerns" screen shows the resolution notes.
```

### Feature: Attendance → Session Notes (Coach two-step gate)
```
Given a session whose scheduled end time has not yet passed,
When the coach attempts to mark attendance,
Then the action is rejected server-side ("Attendance can only be marked after the session has ended"),
regardless of any client-side button state.

Given attendance has not been marked Present or Late,
When the coach attempts to submit session notes,
Then the action is rejected server-side ("Attendance must be marked Present or Late before session notes can be submitted"),
And the booking's status remains "upcoming."

Given attendance is marked Present or Late and Session Summary is non-blank,
When the coach submits notes,
Then a workout_notes row is created,
And the booking's status becomes "completed" (terminal),
And the notes become read-only in the UI.
```

---

# 50. Web vs Mobile Feature Matrix

`Same` = identical functionality and UI pattern is appropriate; `Mobile-adapted` = same functionality, different presentation (e.g., modal→full screen, hover→tap); `Admin-only`/`Coach-only`/`Client-only` = role-scoped; `Web-only (recommend)` = genuinely unsuited to mobile per this audit's own judgment, not a removal of function.

| Feature | Web | Mobile | Shared Backend | Shared DB | Role |
|---|---|---|---|---|---|
| Marketing landing page (packages, how-it-works) | Yes | Mobile-adapted (drop 3D/WebGL layer, §51.5) | Yes (package data) | Yes | Public |
| Signup / Login (email+password, Google OAuth) | Yes | Same (native OAuth flow) | Yes | Yes | Public→Client |
| Phone OTP verification | Yes (currently skippable) | Same — reproduce the current bypass unless product decides otherwise (§52) | Yes | Yes | Client |
| Dashboard (all 3 roles) | Yes | Same (KPIs translate directly to cards) | Yes | Yes | All |
| Book/Cancel/Reschedule session | Yes | Same | Yes | Yes | Client |
| Recurring schedule setup/change | Yes | Mobile-adapted (multi-step wizard → sequential screens instead of a single scrolling form) | Yes | Yes | Client |
| Live session join (Zoom) | Yes (opens Zoom web/app via link) | Same (deep-link into the native Zoom app if installed, else browser) | Yes | Yes | Client, Coach |
| Attendance marking / Session notes | Yes | Same | Yes | Yes | Coach |
| Progress / measurements | Yes | Same | Yes | Yes | Client |
| Chat | Yes (realtime) | Same, realtime (§45.1 — the one feature that must stay live) | Yes | Yes | Client, Coach; Admin read-only |
| Notifications (in-app feed) | Yes | Same + push (new capability, not a web equivalent) | Yes | Yes | All |
| Coach change request | Yes | Same | Yes | Yes | Client, Admin |
| Escalations (raise/view) | Yes | Same | Yes | Yes | Client (raise/view own), Coach (view own clients', read-only) |
| Escalation resolution workflow | Yes | **Admin-only** — recommend tablet-first or web-console-only given data density (per the master instruction's own §11 admin note) | Yes | Yes | Admin-only |
| Leave request / approval | Yes | Coach: same. Admin approval: mobile-adapted or web-only per data density | Yes | Yes | Coach (request), Admin (approve) |
| Shadow coverage assignment (manual tool) | Yes | **Admin-only, recommend web/tablet** — a preview→confirm data-table interaction, low mobile ergonomic value | Yes | Yes | Admin-only |
| Renewal opportunities list | Yes | Same (simple list) | Yes | Yes | Coach, Admin |
| Reports (CSV/PDF export) | Yes | **Web-only (recommend)** — PDF/CSV generation and file handling is a poor mobile fit; a mobile "view report" read-only screen could be added later as a genuinely new capability, not a port | Yes | Yes | Admin-only |
| Activity Log | Yes | **Admin-only**, mobile-adapted list view is feasible if desired, otherwise web-only | Yes | Yes | Admin-only |
| Settings (platform config, package catalog) | Yes | **Admin-only**, recommend web/tablet given form density | Yes | Yes | Admin-only |
| Client/Coach management (search, detail, manual controls) | Yes | Admin: mobile-adapted (search + detail screens work well on mobile; bulk operations like "Reassign Clients" recommend web/tablet) | Yes | Yes | Admin (full), Coach (own roster, read-heavy) |
| Global client search | Yes | Same | Yes | Yes | Coach, Admin |
| Sales list | Yes | Mobile-adapted (simple list) | Yes | Yes | Admin-only |

---

# 51. UI/UX Requirements

Source: `src/app/globals.css`, `tailwind.config.ts`, `src/components/ui/*`. This section also serves as the UI/UX portion of §16–19's detail.

## 51.1 Visual Identity

- **Theme:** entirely dark (`color-scheme: dark`) — **there is no light theme anywhere in the codebase.** A mobile app should not assume a light-mode variant exists to "port" — one must be designed from scratch if desired, or the product should stay dark-only for brand consistency.
- **Fonts:** Anton (display/headings/stat numbers/prices, weight 400 only, `.text-display` utility with tightened tracking) + Manrope (body, weights 400–800). No custom font-size scale — relies on Tailwind's default `text-xs`…`text-7xl`.
- **Color tokens:** `brand.black #000`, `brand.charcoal #111`/`#1A1A1A`, `brand.yellow #F5D90A` (primary accent, everywhere), `brand.yellow2 #FFE94D` (hover/gradient endpoint), `bg.DEFAULT #060606`, `bg.elevated #0c0c0c`, `bg.soft #141414`, `muted #9a9a95`/`#6f6f6b`. Status colors are ad hoc Tailwind palette, not tokenized: `emerald-400` (positive), `red-400/500` (destructive), `amber-400` (warning/temporary).
- **Glassmorphism system** (the dominant visual signature): four graduated utility classes — `.glass` (base cards), `.glass-strong` (navbar/modals/active states), `.glass-faint` (chips/pills), `.glass-yellow` (brand-tinted/highlighted surfaces) — each a translucent gradient + backdrop blur/saturate + hairline border + layered shadow. Plus `.glow-yellow` (stackable glow shadow) and `.noise` (subtle SVG-fractal film-grain overlay on section panels).
- **Motion-first codebase:** scroll-reveal primitives (`Reveal`, `SlideReveal`), a scroll-linked "3D page-flip" wrapper (`FlipSection`) applied to nearly every marketing section, hand-rolled mouse-tilt 3D cards (duplicated independently per component, not a shared hook), and two independently-implemented drag-carousels (Coaches, Testimonials) with an identical 60px-swipe-threshold pattern. Standard ease curve: `[0.16,1,0.3,1]`.

## 51.2 Reusable UI Primitives (`src/components/ui/*`)

`Button` (variants: primary/secondary/outline/ghost/destructive/destructive-outline; sizes sm/md/lg; pill-shaped, `active:scale-[0.98]`), `GlassCard` (motion-enabled, for marketing), `Card` (non-motion, for dashboards — deliberately split from `GlassCard` since portal pages render dozens per screen and can't pay framer-motion's per-instance cost), `Badge` (+ `AssessmentBadge`, `SessionStatusBadge` status-string-to-variant mapper), `Avatar`, `Modal`, `ConfirmDialog` (built on `Modal`, adds a warning icon + destructive-red confirm option), `EmptyState`, `Lightbox`, `Skeleton`/`CardSkeleton`/`TableRowSkeleton`, `StatCard`, `ProgressRing`, `TagEditor`.

## 51.3 Layout & Navigation Pattern

Every authenticated portal shares one `PortalShell` component (parameterized by `role`): fixed/collapsible sidebar with logo, a `"{role} Portal"` badge, a flat nav list (active-state highlighted via pathname match), and a footer identity block + logout. Mobile: hamburger-triggered slide-in drawer with backdrop. This structural parallelism across all three roles is the strongest signal for how a mobile app's own three role-specific navigation shells should be designed — same shell shape, different item lists.

## 51.4 Empty / Loading / Error State Conventions

- **Loading:** Next.js route-level `loading.tsx` skeletons only (title bar + description + 1–3 `CardSkeleton`s) — individual widgets have no independent loading phase after initial server-side data fetch (data is already resolved by the time client components mount).
- **Error:** virtually every screen follows the same pattern — `isFailure(result)` → a full-page `EmptyState` (icon `AlertTriangle`, title + the raw server error message) for a hard top-level fetch failure, or inline red text near the specific failed control for an action failure. **No toast/snackbar system exists anywhere in the application** — confirmed independently across all three portals.
- **Empty:** `EmptyState` component (icon + title + description + optional action) used consistently for "no data yet" states across every list screen.
- **Confirmation dialogs:** used sparingly and specifically for genuinely hard-to-reverse single actions (cancel session, pause/resume subscription, disable coach, delete package) — most other mutating actions (raise concern, request coach change, log measurement, escalation logging) proceed directly on submit with no separate confirm step.

## 51.5 Mobile-Adaptation Recommendations (preserving, not removing, functionality)

- The existing web app is already fully responsive per-screen (grid columns collapse, sidebar becomes a drawer) rather than having a distinct "mobile mode" — but it is not a native app, and several patterns (hover-based mouse-tilt cards, drag-carousels, a persistent WebGL background canvas) are explicitly marketing-site-only and were never intended to run inside a data-dense dashboard (confirmed by the code's own "never mounted inside the authenticated portals" comment) — a mobile app's marketing/pre-auth surface should adopt the *content* of the landing page (packages, how-it-works, coach carousel) but does not need to reproduce the 3D/WebGL layer.
- The dashboard/portal screens' `Card`/`StatCard`/`Badge`/`EmptyState` visual language (flat glass cards, no heavy motion) is the correct reference for mobile screen design — it is already optimized for data density over spectacle.
- Bottom-tab navigation (per the stakeholder's own §11 proposal) maps cleanly onto each portal's existing flat nav list; conditional hiding (client's "Book a Session" once subscribed, "My Chats" until any chat exists) should be preserved as-is since it reflects real business state, not arbitrary simplification.
# 52. Recommended Improvements

**These are observations, not instructions to change existing behavior** — per the master instruction, they are flagged separately from the specification itself so the mobile team (or the web team) can make a deliberate product decision rather than the mobile app silently "fixing" something the web app doesn't do.

1. **Password reset** — currently absent on every platform. A mobile app with no equivalent will have the identical gap unless this is built (ideally once, shared, before or alongside the mobile project).
2. **Phone verification bypass** — the "Skip for now" affordance should be removed (or a decision made to keep it) once MSG91 KYC/DLT approval completes; until then, decide explicitly whether mobile reproduces the bypass or requires verification.
3. **Shadow-coverage reversion** — add an explicit mechanism (scheduled sweep or admin action) to return bookings to the primary coach once a shadow assignment's `ends_on` passes; today this requires manual admin intervention that isn't even surfaced anywhere as a to-do.
4. **`coach_shifts` override visibility** — either surface it in the client/admin-facing "open slots" views, or confirm it's unused in production and consider removing the dead code path.
5. **Dormant demo-payment path** — either remove `createDemoSessionOrder`/the `demo_session` payment purpose (if a paid demo is never planned) or fix its guaranteed-`paid_unfulfilled` webhook branch before ever wiring it back into the UI.
6. **Sales/revenue historical accuracy** — consider storing a frozen `amount_paid` on `subscriptions` at purchase time rather than deriving historical reports from the package's current price.
7. **Escalation audit coverage** — consider adding `escalations`/`coach_leave`/`shadow_coach_assignments` to the DB-trigger-audited table set, given how operationally significant these workflows are.
8. **Admin "block slot" clarity** — give it a distinct reason/marker so it doesn't read identically to a real coach leave request in list views.
9. **Deployment target clarity** — resolve whether Vercel or Netlify (both configured) is the actual production target, and confirm whether the four separate Next.js build outputs represent an intentional multi-instance deployment.

---

# 53. Open Questions / Undetermined

Per the master instruction's explicit rule: these could not be determined from source code alone and must not be guessed.

1. **Mobile architecture decision** (§8): should mobile talk to Supabase directly (Option A) or through a new shared API layer (Option B)? This is the single highest-leverage decision for the entire mobile project and is a genuine product/engineering call, not something derivable from the existing code.
2. **Is the Supabase "Custom Access Token" Auth Hook actually enabled in production?** This is a Supabase Dashboard setting, not expressible in a migration, and cannot be verified from source alone — it affects whether `middleware.ts`'s fast-path JWT-claim role check is actually active or silently falling back to a DB query on every request.
3. **Which deployment target (Vercel vs. Netlify) is authoritative for production?** Both are configured.
4. **Do the four separate Next.js build directories (`.next`, `.next-admin`, `.next-client`, `.next-coach`) represent three genuinely separate deployed instances (e.g., separate subdomains) of the same codebase, or a build artifact of local development/testing?** This affects whether a mobile app should expect three different API base URLs or one.
5. **`hasEverSubscribed`'s exact derivation** (used in renewal "expired" classification) lives in a service file (`clients.service.ts`) outside the coach-lifecycle audit's required file set and was not independently re-verified in this pass — confirm directly before relying on its exact semantics.
6. **Whether `coach_shifts` is genuinely used in production** or is a legacy/unused table whose override behavior (§26/§48) has simply never been triggered in practice — this determines whether the client/admin-facing availability-UI gap is a live bug or a moot point.
7. **Exact literal DB write inside `submitSessionNotes`** that flips a booking to `completed` — its precondition gate and side effects were fully captured, but the exact update statement/column list was not re-confirmed character-for-character in this pass (noted by the coach-screens audit); does not affect the UI-level spec in this document but should be re-checked before a backend rebuild.
8. **Prop contracts of several shared UI primitives** (`ConversationThread`, `MeasurementChart`, `ClientTimeline`, and the base `Button`/`Modal`/`Card` components) were documented from their call sites, not read line-by-line — sufficient for a functional spec, but a pixel-exact mobile port of these specific components would need a direct read.
9. **Whether any coach-facing notification exists for "your client just booked/cancelled a session"** independent of the general `session_booked_coach`/`session_cancelled_by_client` templates already documented — the notification-template catalog (§33) lists ~45 keys total; a full key-by-key enumeration was not the explicit deliverable of any single audit pass and should be pulled directly from `notification_templates` if an exhaustive list is needed.

---

# 54. Implementation Dependencies

- **A mobile app cannot be built before §53 Q1 (architecture decision) is resolved** — every subsequent engineering choice (how auth is handled, how business rules are enforced, how offline/caching works) depends on it.
- **Push notifications are a genuinely new capability** (§50) with no existing web equivalent to port — they depend on the notification-template catalog (§33/§42) as their content source, but need new infrastructure (device token registration, a push provider) not present anywhere in the current codebase.
- **Zoom's native mobile SDK vs. deep-linking to the Zoom app** is a mobile-specific technical decision not addressed by any existing code (the web app simply opens a URL) — should be resolved alongside §53 Q1 since it affects whether meeting URLs need any different shape for mobile.
- **Phone-OTP (MSG91) and email (Resend) integrations are backend-agnostic** — whichever architecture is chosen, these remain server-side calls; mobile does not integrate with either provider directly.
- **The RLS policy set (§42.5) is a hard dependency for Option A** — any RLS policy considered "too permissive for mobile" or "missing for a mobile-specific need" must be changed at the database level (affecting web too, since it's the same policy), not worked around client-side.

---

# 55. Development Phases

A suggested phasing (not derived from any existing roadmap document, since those were excluded from this audit — this is a fresh recommendation based on dependency order and risk):

**Phase 1 — Foundation & Architecture Decision.** Resolve §53 Q1 (API architecture). Stand up mobile project scaffolding, authentication (email/password + Google OAuth on mobile), and role-based navigation shell (client/coach/admin), matching §5/§6/§46 exactly.

**Phase 2 — Client Core Loop (read-heavy first).** Dashboard, My Coach, My Sessions (read), Progress (read), Notifications (read) — establishes the data-fetching pattern against real Supabase/API data before tackling write flows.

**Phase 3 — Client Booking Engine.** Book a Session, My Schedule (setup/change), Reschedule/Cancel — the highest-complexity client-side domain (§27), reproducing the exact fallback ladders and cutoff rules.

**Phase 4 — Payments & Subscriptions.** Razorpay mobile Checkout integration, plan activation, pause/resume, renewal flow (§23/§35) — gate this phase on the payment-verification architecture matching §23.1 step 4 exactly (signature verification must happen the same way regardless of platform).

**Phase 5 — Coach Portal Core.** Dashboard, Schedule, Session Detail (join→attendance→notes state machine, §17.15/§28/§29), Clients list/detail.

**Phase 6 — Cross-Cutting Client-Coach Features.** Chat (realtime, §32/§45.1), Escalations (raise/view), Coach Change requests, Leave requests (coach side).

**Phase 7 — Notifications Infrastructure.** Push notification registration/delivery — a genuinely new capability (§54) layered on top of the existing `notifications`/`notification_templates` data model.

**Phase 8 — Admin Portal (scope decision required).** Per §50's own recommendations, decide which admin screens genuinely belong on mobile (client/coach search+detail, approval-queue actions) versus which should stay web/tablet-only (reports, settings, bulk reassignment, shadow-coverage manual tool) before building any admin mobile screens.

**Phase 9 — Testing & Parity Verification.** Systematic pass through every acceptance criterion in §49 and every edge case in §48, run against the mobile app, not just the web app.

**Phase 10 — Store Release.** Android + iOS submission.

---

# Final Validation Checklist (per the master instruction's §26)

- ✅ Every route reviewed (64 total across all portals + marketing, §10).
- ✅ Every role reviewed (client/coach/admin/visitor, §5).
- ✅ Every major component/screen reviewed (§16–19, sourced from full reads of all page/component files in three independent frontend audits).
- ✅ Every API surface reviewed — no REST/GraphQL layer exists; the full Server Action + service-function + RPC surface is enumerated (§43).
- ✅ Every database entity reviewed (30 tables, 19 enums, 22 functions, 6 views, 4 storage buckets — §42).
- ✅ Every external integration reviewed (Razorpay, Zoom, Resend, MSG91, Supabase itself — §44).
- ✅ Every major workflow documented end-to-end (§13).
- ✅ Every significant conditional behavior documented (§14).
- ✅ Every permission documented (§6).
- ✅ Every status value and its exact setter documented (§15).
- ✅ Every notification trigger's mechanism documented; the full 45-key template catalog itself was not individually enumerated (flagged, §53 Q9).
- ✅ Every important validation documented (cutoffs, caps, gates — throughout §21–41).
- ✅ Every discovered edge case documented (§48), separated from recommended fixes (§52).
- ✅ Every web feature mapped to a mobile equivalent or an explicit web-only recommendation (§50).
- ✅ Shared database and shared backend/API requirements made explicit (§8/§45).
- ✅ Razorpay and Zoom behavior documented from the actual implementation, including a dormant/dead code path each system has (§23.2, §25).
- ✅ Web/mobile synchronization requirements made explicit, distinguishing realtime-required (chat) from refresh-on-open-sufficient (everything else) (§45).
- ⚠️ A small number of items could not be fully determined from source alone and are explicitly listed, not guessed (§53).

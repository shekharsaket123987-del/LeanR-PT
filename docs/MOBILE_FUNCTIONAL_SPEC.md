# LEANR by Fitelo — Web Application Functional Specification for Mobile Development

**Purpose of this document:** This is the single source of truth for building a mobile application with full functional parity to the existing LEANR web app. It was produced by systematically inspecting every route, component, server action, service, and database migration in the current codebase (`LeanR-PT-main/`) — not by reading the project's own architecture docs (`docs/DOMAIN_MODEL.md`, `docs/business-rules.md`, `docs/erd.md`, `docs/api.md`, etc.), which predate real payments, chat, Zoom, shadow-coach v2, escalations v2, and 40+ other migrations and are stale in numerous places. Every stale-doc contradiction found is called out explicitly where relevant.

**Verification standard:** Every claim below is traced to a file, function, or migration. Where behavior could not be conclusively determined from code, it is marked **"Unknown / requires verification"** rather than assumed. Nothing in this document is invented.

**Scope covered:** Marketing/landing page, authentication (signup/login/OAuth/OTP), Client portal (15 screens), Coach portal (13 screens), Admin portal (23 screens), all server actions/services, the full Supabase schema (57 migrations), RPC functions, Razorpay/Zoom/Resend/MSG91 integrations, and one cron route.

---

# 1. Application Overview

LEANR by Fitelo is a **live online Personal Training operating system** — not just a booking app. It manages the full lifecycle of a PT client relationship: marketing → signup → plan purchase → onboarding → recurring coach-led video sessions → progress tracking → renewal, plus all the operational machinery behind it (coach scheduling, leave, shadow-coverage, escalations, sales/reporting) for the business's own staff.

Three portals, one shared shell (`PortalShell.tsx`), one Next.js 14 App Router codebase, one Supabase Postgres backend:

- **Client portal** (`/client/*`) — the paying customer. Books/manages sessions, purchases plans, tracks progress, messages their coach, raises concerns, requests coach changes.
- **Coach portal** (`/coach/*`) — the trainer. Runs sessions (join → attendance → notes), manages availability/leave, views assigned clients, sees performance stats, messages clients.
- **Admin portal** (`/admin/*`) — Fitelo operations staff. Full CRUD superuser: onboards clients/coaches, resolves escalations/leave/coach-change requests, manages scheduling exceptions, shadow-coverage, sales/reports, and system-wide settings.

A fourth, unauthenticated surface — the **marketing site** (`/`, `(marketing)` route group) — sells the product and funnels visitors into signup or one of the three logins.

**What's real vs. what the old README claims:** The project's own `README.md` calls this a "design/UX prototype... not a production build." That is **no longer accurate**. The current codebase has a real Supabase Postgres backend (57 migrations), real Razorpay payment collection, real Zoom meeting creation, real MSG91 SMS/OTP, real Resend email, real RLS-based authorization, and a real (if imperfectly scheduled) cron job. `src/lib/mock-data.ts` and `src/lib/types.ts` are confirmed dead code (only remaining reference is an explanatory comment). Treat this as a real, live-data production application when building the mobile app.

---

# 2. Technology / Architecture Overview

| Layer | Technology |
|---|---|
| Frontend framework | Next.js 14.2 (App Router), React 18, TypeScript |
| Styling | Tailwind CSS |
| Charts | Recharts |
| Animation (marketing only) | Framer Motion, Lenis smooth-scroll |
| Backend | Supabase (Postgres + Auth + Storage + Realtime), accessed via `@supabase/ssr` |
| Payments | Razorpay (Checkout.js + Orders API + webhook) |
| Video | Zoom (Server-to-Server OAuth, one shared business account) |
| Email | Resend |
| SMS/OTP | MSG91 (Flow API for transactional SMS, separate OTP API for phone verification) |
| Hosting | Vercel and/or Netlify (both configs present; `@netlify/plugin-nextjs` configured) |
| PDF export | jsPDF + jspdf-autotable (admin Reports, client-side generation) |

**Request architecture:**
- Every portal-facing mutation is a Next.js **Server Action** (`"use server"`) in `src/lib/actions/*.ts`, one file per portal-domain (`client-*`, `coach-portal`, `admin-*`, plus shared `payments`, `phone-otp`, `chat`, `renewals`, `schedule`).
- Every action: (1) resolves the caller's access token from the server-side cookie, (2) wraps the call in `runAction()` which normalizes both success and thrown errors into `ActionResult<T> = {success:true,data} | {success:false,error:{code,message}}` — **no raw Postgrest/service error ever reaches the client**, only a `.message` string, (3) delegates to a service function in `src/lib/services/*.ts`.
- Every service function starts with `getCallerContext(accessToken)` (resolves `{userId, role, fullName, photoUrl}`, memoized per-request via React `cache()`), then `requireRole(ctx, [...])` throws `Forbidden` before any query runs for role-gated operations.
- **Two-layer authorization, defense in depth:** app-layer `requireRole()` (throws before querying) + Postgres RLS policies (the real data-access boundary — even a direct PostgREST call bypassing the service layer is constrained). A few numeric business rules (booking cutoffs, cancel/reschedule) are *additionally* re-enforced by `BEFORE UPDATE` triggers directly on the table (migration 0052), closing a gap where a client could `PATCH` their own row via PostgREST and skip the RPC-layer checks entirely.
- Privileged system-internal writes (notification dispatch, timeline logging, Zoom cleanup, admin-provisioned accounts) use `supabaseAdmin` (service-role key, bypasses RLS) — never exposed directly to a portal action.
- Four Supabase client constructors: browser (cookie storage, `"use client"` auth forms), server-component (cookie-aware, memoized), request-scoped (`Authorization: Bearer` header, used inside Server Actions so RLS sees the correct caller), and admin (service-role, RLS-bypassing).

**No global toast/snackbar system exists anywhere in the web app.** Every success/error surface across all three portals is inline: red-bordered banners for errors, full-card/state swaps for success, or a `ConfirmDialog`'s own error slot. This is a deliberate design note for the mobile team — see §15.

---

# 3. User Roles & Permissions

Exactly one role per user (`profiles.role`): **client**, **coach**, **admin**. No sub-permission tiers exist within a role — a single admin account can do everything the admin portal exposes; a single coach account can do everything the coach portal exposes for their own assigned clients (plus limited read-only access to any client via Global Search).

**Role assignment is airtight against self-escalation:**
- Public self-signup (email/password **and** Google OAuth) can **only ever create client accounts.** The `handle_new_user()` DB trigger reads role from `raw_app_meta_data` (privileged, service-role-only), never `raw_user_meta_data` (fully caller-controlled) — this closed a real self-escalation hole (migration 0051, "QA finding C1": a POST could previously pass `{"data":{"role":"admin"}}` and self-grant admin).
- Coach and Admin accounts are **exclusively ops-provisioned** — created by an existing admin via the Add Coach / Add Client (migration) flows, using the service-role Admin API. There is no coach/admin self-signup screen, and the mobile app should not build one.

## 3.1 Screen-level access matrix

| Screen/Feature area | Client | Coach | Admin |
|---|:---:|:---:|:---:|
| Marketing/landing, login, signup | ✅ (public) | ✅ (public) | ✅ (public) |
| Own dashboard/sessions/schedule | ✅ own | ✅ own | ✅ (via lists) |
| Book/reschedule/cancel own sessions | ✅ own, cutoff-gated | — | ✅ any, cutoff-exempt |
| View any client (read-only) | — | ✅ via Global Search (not own clients) | ✅ full CRUD, all clients |
| Edit client profile/measurements | ✅ own | — | ✅ any |
| Mark attendance / submit session notes | — | ✅ own sessions | — |
| Set coach working hours | — | ❌ read-only since migration 0045 | ✅ |
| Request leave | — | ✅ own | ✅ approve/reject anyone's |
| Resolve escalations | — | ❌ read-only | ✅ (gated behind "called client" confirmation) |
| Resolve coach-change requests | request only | — | ✅ approve/reject |
| Assign shadow coach | — | — | ✅ |
| Purchase / pause / resume subscription | ✅ own (purchase); pause/resume server function also allows client self-service, though no admin-portal-equivalent client-initiated pause UI was found in this pass | — | ✅ any client |
| System settings (cutoffs, durations, packages) | — | — | ✅ |
| View audit log | — | — | ✅ |
| Chat | ✅ with own active coach | ✅ with assigned clients | ❌ view-only (`AdminClientChats`, cannot send) |
| Reports/exports | — | — | ✅ |

**Cutoff-hour bypass:** Admin is exempt from the `cancellation_cutoff_hours`/`reschedule_cutoff_hours` enforcement that binds client- and coach-initiated cancel/reschedule (`enforceCutoff = ctx.role !== "admin"` in `bookings.service.ts`).

**Global client visibility is intentional, not a bug:** any authenticated coach can read any client's profile/timeline platform-wide (RLS widened in migration 0033, "Global Search") — but billing, progress logs, and full session detail stay restricted to the assigned coach or admin. A non-assigned coach viewing a client via search sees a "read-only" banner and a materially thinner data set.

---

# 4. Complete Navigation Map

All three portals share **one layout shell** (`PortalShell.tsx`); nav items differ by role. Active-state: exact path match OR path starts with `item.href + "/"`. Icons are `lucide-react`. **No submenus/nested dropdowns in the sidebar anywhere — flat list only.**

### Client (role="client") — in order, with conditional visibility
1. Dashboard — `/client/dashboard`
2. My Sessions — `/client/sessions`
3. Book a Session — `/client/book` — **hidden once client has an active subscription** (only useful pre-first-session)
4. My Schedule — `/client/schedule`
5. My Chats — `/client/chats` — **hidden until ≥1 chat thread exists**; red unread-count badge when >0
6. My Coach — `/client/coach`
7. Subscription — `/client/subscription`
8. Progress — `/client/progress`
9. My Concerns — `/client/concerns` — red badge = unresolved-concerns count
10. Notifications — `/client/notifications`
11. Profile — `/client/profile`

### Coach (role="coach") — in order, no conditional hiding
1. Dashboard — `/coach/dashboard`
2. Schedule — `/coach/schedule`
3. Clients — `/coach/clients`
4. Renewal Opportunities — `/coach/renewals`
5. My Chats — `/coach/chats` — always visible (empty inbox is normal for a coach); red unread badge
6. Search — `/coach/search` (global, platform-wide client lookup)
7. Escalations — `/coach/escalations` — red badge = unresolved count for own clients
8. Performance — `/coach/performance`
9. Availability — `/coach/availability`
10. Notifications — `/coach/notifications`
11. Profile — `/coach/profile`

### Admin (role="admin") — in order, no conditional hiding
1. Dashboard — `/admin/dashboard`
2. Search — `/admin/search`
3. Clients — `/admin/clients`
4. Renewal Opportunities — `/admin/renewals`
5. Coaches — `/admin/coaches`
6. Sessions — `/admin/sessions`
7. Sales — `/admin/sales`
8. Scheduling — `/admin/scheduling`
9. Availability Check — `/admin/availability`
10. Coach Change Requests — `/admin/coach-change-requests`
11. Leave Requests — `/admin/leave-requests`
12. Shadow Coverage — `/admin/shadow-coverage`
13. Escalations — `/admin/escalations` — red badge = platform-wide unresolved count
14. Notifications — `/admin/notifications`
15. Activity Log — `/admin/activity-log`
16. Reports — `/admin/reports`
17. Settings — `/admin/settings`

### Unauthenticated
- `/` — Landing page (anchors: How It Works, Coaches, Plans `#pricing`, Why LeanR, Transformations `#stories`)
- `/login/client`, `/login/coach`, `/login/admin`
- `/signup` (client only)
- `/auth/callback` (OAuth exchange, not user-facing)
- 404 → `not-found.tsx`

### Existing web-app mobile-responsive behavior (for reference, not to be copied verbatim)
Below the `lg` breakpoint, the sidebar becomes a slide-in drawer (hamburger + backdrop), auto-closing on nav click. This is the **only** responsive pattern in the web app — there is no separate bottom-tab-bar mode. The mobile app is expected to design native bottom-nav/drawer patterns per §15, not port this drawer.

### Route guarding (`src/middleware.ts`)
- Matches only `/client/:path*`, `/coach/:path*`, `/admin/:path*`. Marketing/login/signup/API routes are not gated.
- Verifies the session JWT locally (WebCrypto against cached JWKS, ES256) via `supabase.auth.getClaims()`; falls back to a `profiles` table query if the `user_role` JWT claim isn't present yet (pre-hook session).
- No session → redirect to `/login/{requiredRoleFromURL}`. Wrong role → same redirect, **silently** (no error at the middleware layer — the login form's own post-submit role check is what actually surfaces an explanatory error to a user who lands there after being signed in as the wrong role).
- No redirect-if-already-logged-in anywhere — an authenticated client can still view the landing page or any login page.

---

# 5. Complete Feature Inventory

*(Module | Feature | Sub-feature | User Action | Expected Result | Dependencies. Organized by portal. This is the flat checklist — screen-level detail is in §6, workflows in §11.)*

## 5.1 Auth / Shared

| Module | Feature | Sub-feature | User Action | Expected Result | Dependencies |
|---|---|---|---|---|---|
| Auth | Signup | Form step | Fill name/email/phone/password, submit | Supabase account created (role=client always) | — |
| Auth | Signup | Email OTP | Enter code, verify | Email confirmed | Supabase email OTP |
| Auth | Signup | Phone OTP | Enter code, verify | Phone saved verified to `profiles.phone` | MSG91 |
| Auth | Signup | Skip phone (temporary) | Click "Skip for now" | Phone saved unverified, or left blank | none |
| Auth | Login | 3 role-specific screens | Email+password, submit | Session created; role mismatch → auto sign-out + error | Supabase Auth |
| Auth | Login | Forgot password | Click | **Dead button — no handler, no reset flow exists anywhere** | — |
| Auth | OAuth | Google sign-in | Click "Continue with Google" | Creates (if new) or signs into existing account; routes by actual role, not clicked login page | Supabase OAuth |
| Auth | Phone gate | Google-signup phone backfill | Enter+verify or skip phone | `profiles.phone` populated | blocks portal until resolved (or skipped) |
| Auth | Logout | — | Click "Log out" in sidebar | Session ends, redirect to `/` | no confirmation dialog |
| Shared | Notifications | In-app inbox (all 3 roles) | View, click unread | Mark-as-read, badge updates | `notifications` table |
| Shared | Portal nav | Role-based sidebar | — | Correct nav set per role, conditional items per client-only rules | `PortalShell` |

## 5.2 Client Portal

See the full feature table already compiled in the client-portal research pass — reproduced here in full:

| Module | Feature | Sub-feature | User Action | Expected Result | Dependencies |
|---|---|---|---|---|---|
| Onboarding | Signup phone gate | OTP verify | Enter phone → send/verify OTP | Phone saved & verified | MSG91 SMS |
| Onboarding | Signup phone gate | Skip (temporary) | Click "Skip for now" | Phone saved unverified, or blank | none |
| Journey | Measurement gate | Weekly compulsory log | Fill ≥0 fields, Save | `progress_logs` row inserted; gate closes | booking/join still blocked separately if stale |
| Journey | Sessions-low nudge | Renew prompt | Click "Renew Now" | Navigate to `/client/plans` | `SESSIONS_LOW_THRESHOLD=5` |
| Dashboard | Journey routing | Stage redirect | Load `/client/dashboard` | Redirect to correct stage screen | `getMyJourneyStateAction` |
| Dashboard | Progress deltas | Day-1 vs latest | passive | 8-metric delta grid w/ arrows | `progress_logs` |
| Dashboard | Streak | Consecutive weeks | passive | "N wks" stat (derived, not stored) | — |
| Booking (ad-hoc) | Assessment/first session | 3-step wizard | Pick slot → confirm | Booking created (assessment if 0 prior bookings) | `getOpenSlots`, measurement gate |
| Booking (ad-hoc) | Demo rating | Post-demo feedback | Rate 2 dimensions or Skip | rating recorded or skipped | — |
| Demo booking | Free trial booking | Auto-coach-match | Pick date/time-pref/gender-pref | Top-ranked coach auto-booked, no confirm step | measurement gate |
| Plans | Purchase | Razorpay checkout | Click Purchase → pay | Order→Checkout→server-verified→subscription (awaiting_activation) | Razorpay; existing-plan guard |
| Plans | Purchase failure recovery | paid_unfulfilled | system | Client told to contact support with order ref | webhook reconciliation |
| Activation | Start date | One-time date pick | Pick date ≥ tomorrow, Confirm | Subscription active; old sub retired if renewal | — |
| Onboarding form | Initial assessment | One-time intake | Fill required fields, submit | `client_onboarding` + Day-1 `progress_logs`; locked after | client cannot self-edit after |
| My Coach | View profile | — | passive | Coach bio/certs/rating shown | active recurring slot or demo-coach fallback |
| My Coach | Coach change request | Raise | Fill reason (required) + optional ratings, submit | `coach_change_requests` row, pending | 1 active request at a time |
| My Coach | Coach change request | Complete (post-approval) | Pick days+time, find coach, confirm | Old slots retired + bookings cancelled; new pattern created | request must be approved |
| Concerns | Raise concern | Category + details | Select category, optional details, submit | `escalations` row (open), coach notified | current coach if any |
| Concerns | Track resolution | — | passive | View status/notes/resolution | admin-driven only |
| Notifications | Inbox | Mark read | Click unread item | `read=true`, badge updates | — |
| Notifications | Shadow-coach notice | Acknowledge | Click Acknowledge (on My Sessions banner) | notification marked read | — |
| Chats | Message coach | Send/receive | Type message, send | `messages` row; recipient notified | active conversation only (closed = read-only) |
| Profile | Edit info | Name/phone/goals/equipment/medical/photo | Edit modal, Save | `profiles`+`client_profiles` updated | photo → Supabase Storage `avatars` |
| Profile | Change password | New+confirm | Fill, Update | Supabase Auth password updated | client-side only, ≥8 chars |
| Progress | Weekly log | 8 optional metrics | Fill, Save | `progress_logs` row; ≤1/week self-service | coach notified |
| Progress | History view | Chart+list | passive | `MeasurementChart` + session/coach-notes list | — |
| Renewal check-in | Fresh baseline | 8 optional metrics | Fill, Continue | `progress_logs` row, bypasses weekly cap | only reachable mid-renewal |
| Schedule | First-time setup | Pattern+time picker | Pick pattern/time, Check Availability, Confirm | `recurring_slots` created + upcoming bookings generated | coach roster search |
| Schedule | Change schedule | Pattern+time+trainer pref | same flow, +trainer/gender pref | old pattern replaced, new bookings generated | — |
| Schedule | Renewal — keep as-is | Shortcut | Click "Keep My Schedule" | exact pattern carried to new subscription | renewal mode only |
| Schedule | No-match escalation | Notify support | Click "Notify Support" | admins notified, no client waitlist | — |
| Sessions | Filter by status | Tabs | Click tab | client-side filter, sorted newest-first | — |
| Sessions | Cancel | Cutoff-gated | Click Cancel, confirm dialog | status→cancelled; Zoom deleted; notifications sent | `cancellation_cutoff_hours` |
| Sessions | Reschedule — fastest | Per-coach soonest slot | Click "Book This" | booking moved (own or substitute coach) | 30-day window, weekly cap |
| Sessions | Reschedule — browse | Grid of own-coach slots | Pick slot, confirm | booking moved | busy-date exclusion |
| Sessions | Reschedule — specific time | Date+time input, check, confirm/assign substitute | booking moved to exact time | availability check RPCs |
| Sessions | Rate session | 2-dimension stars+note | Rate, submit | rating fields set; coach rating recomputed | ≤1 rating/7 days account-wide |
| Subscription | View plan | Usage/status/pause-days | passive | progress bar, pause-days remaining | `subscription_usage_view` |
| Subscription | Pause | Confirm dialog | Click Pause, confirm | status→paused; notifications sent | only if active |
| Subscription | Resume | Confirm dialog | Click Resume, confirm | status→active; notifications sent | only if paused |
| Subscription | Payment history | passive | View list | `sales_view` rows | — |

## 5.3 Coach Portal

| Module | Feature | Sub-feature | User Action | Expected Result | Dependencies |
|---|---|---|---|---|---|
| Dashboard | KPI summary | — | View | 7 live stat cards | bookings, coach_utilization_view, escalations |
| Dashboard | Today's Tasks | Join / mark attendance | Click Join/Present/Late/Absent | Booking state updates | Zoom (optional), attendance table |
| Dashboard | Pending Tasks | backlog attendance/notes | Click Resolve → session page | Navigates to session detail | overdue sweep RPCs |
| Dashboard | Cancelled/Rescheduled feed | — | View | Last 5 of each | bookings.cancelled_by, was_rescheduled |
| Availability | View working hours | — | View only (read-only since migration 0045) | Read-only weekly grid | admin-set |
| Availability | Request leave | Full-day or partial-day | Submit form | New `coach_leave` row, pending | 24h notice rule, no admin bypass |
| Schedule | Day/Week toggle | — | Click tab | Switch view, no refetch | — |
| Schedule | Week day drill-in | — | Click day cell | Modal with that day's sessions | — |
| Session Detail | Join session | — | Click Join | `coach_joined_at` set, opens Zoom (or no-op if unconfigured) | Zoom service |
| Session Detail | Mark attendance | Present/Late/Absent | Click button | Present/Late unlocks notes; Absent closes as missed | session must have ended; today's sessions also require join |
| Session Detail | Submit session notes | 6 fields | Click Mark Completed | booking → completed, `workout_notes` row | attendance must be present/late |
| Clients | Search/filter roster | text, status, plan, day | Type/select | Client-side filtered list | own clients only |
| Clients | Client detail | full profile view | Click row | Full detail if assigned; thin read-only if not | — |
| Escalations | Read-only concern list | Active/Resolved tabs | Click tab | Filtered list | **no coach action exists — view only** |
| Notifications | Inbox | — | View/mark read (shared component) | — | notifications table |
| Performance | KPI dashboard | 13 metrics | View | Read-only stats | bookings, coach_profiles, escalations |
| Performance | Activity timeline | — | View | Merged 30-item feed | bookings, coach_leave, shadow_coach_assignments |
| Profile | Edit contact info | phone, emergency contact, photo | Submit modal | `profiles` row updated | Supabase Storage `avatars` |
| Profile | Add skill | append-only | Submit | `coach_profiles.skills` appended | `append_coach_skill` RPC — no coach-side remove |
| Profile | Change password | — | Submit modal | Supabase Auth password updated directly | bypasses app's server-action/audit layer |
| Renewals | Opportunity/Expired list | tabs | View | Filtered roster subset (own clients) | subscriptions, coach_utilization |
| Search | Global client lookup | — | Type query | Live-filtered platform-wide client list | RLS-widened (migration 0033) |
| Chats | Category tabs + thread | 4 categories (Active/Old/Expired/Pause) | Click conversation | Loads thread | conversations/messages tables |

## 5.4 Admin Portal

| Module | Feature | Sub-feature | User Action | Expected Result | Dependencies |
|---|---|---|---|---|---|
| Clients | Roster | Search/filter | type/click | client-side filtered list | — |
| Clients | Migration | Create client | fill AddClientForm, submit | new Auth user + client_profiles + active subscription (+optional schedule) | package_tiers, coach availability check |
| Clients | Detail | Adjust sessions | stepper + save | `subscriptions.sessions_total` updated, timeline event if increased | active subscription required |
| Clients | Detail | Grant pause-days | stepper + save | `pause_days_allowed` adjusted (floored at 0) | active subscription |
| Clients | Detail | Transfer coach | pick coach, confirm (or force) | recurring_slots + upcoming bookings repointed | availability coverage check, force-override |
| Clients | Detail | Assign shadow coach | date range, find, confirm | shadow assignment rows created, bookings reassigned | candidate scoring algorithm |
| Clients | Detail | Pause subscription | confirm dialog | status→paused, notifications sent | must be active |
| Clients | Detail | Log measurement | fill 8 fields, save | new `progress_logs` row | — |
| Clients | Detail | Log escalation | reason+details, save | new `escalations` row, appears on timeline | — |
| Clients | Detail | Log refund request | amount+reason, submit | audit log + timeline entry only — **no money moved** | see §8 payments reconciliation note |
| Coaches | Roster | Search | type | client-side filtered list | — |
| Coaches | Create | Add coach | fill form incl. weekly slots, submit | Auth user + coach_profiles + coach_availability rows | COACH_SKILLS/LANGUAGES constants |
| Coaches | Detail | Edit identity | edit modal, save | `profiles`+`coach_profiles` fields updated | — |
| Coaches | Detail | Edit skills | TagEditor, save | `coach_profiles.skills` replaced (full add/remove, admin only) | — |
| Coaches | Detail | Set working hours | per-day checkbox+time, save | `coach_availability` full week replaced | admin-only since migration 0045 |
| Coaches | Detail | Block a slot/day | date+reason, submit | pre-approved single-day `coach_leave` row | does **not** trigger shadow-coverage cascade |
| Coaches | Detail | Reassign all clients | pick target coach, confirm | each client's slots+bookings moved; per-client failure tolerant | availability coverage |
| Coaches | Detail | Disable coach | confirm dialog | status→inactive | does **not** auto-reassign clients |
| Coach Change Requests | Queue | Approve (direct) | pick new coach, confirm | request approved + coach reassigned immediately | — |
| Coach Change Requests | Queue | Approve (deferred) | leave coach blank, confirm | request approved, client self-serves later | client-portal flow |
| Coach Change Requests | Queue | Reject | click | request rejected, client notified | no confirmation dialog |
| Leave Requests | Queue | Approve | click | leave approved; automatic shadow-coverage cascade for every affected client | scoring algorithm |
| Leave Requests | Queue | Reject | click | leave rejected, coach notified | no reason required |
| Escalations | Detail | Confirm called client | click | unlocks rest of workflow | hard server gate |
| Escalations | Detail | Save assessment | issue type + fault + summary, save | admin-internal fields updated (never shown to client/coach) | requires called-client gate |
| Escalations | Detail | Add progress note | text, add | client-visible note appended | requires called-client gate |
| Escalations | Detail | Mark in progress / Resolve | click / notes+submit | status transitions; client notified on resolve | one-way — no reopen |
| Scheduling | Sessions | Reschedule/Cancel | modal / click | booking updated, cutoff bypassed for admin | no reason field on Cancel, no confirm dialog |
| Settings | Rules | Edit cutoffs/duration/inactivity | sliders, save | `system_settings` updated, read live everywhere | 4 independent non-atomic saves |
| Settings | Packages | CRUD package tiers | add/edit/delete (soft) | `package_tiers` created/updated/`is_active=false` | existing subscriptions unaffected |
| Reports | Export | Generate CSV/PDF | click | client-side file download | jsPDF dynamic import, no date-range filter |
| Activity Log | Audit | Filter by entity | click tab (real URL nav) | server refetch filtered | DB trigger `fn_audit_trigger` |
| Shadow Coverage | Queue | Identify gaps | passive | shows bookings with on-leave coach + no coverage | derived live |
| Availability Check | Day view | Change date / filter | date picker / tab | server refetch / client filter | — |
| Renewals | Opportunity/Expired list | tabs | View | platform-wide roster subset | shared component w/ coach portal |
| Sales | List | Search | type | client-side filtered list + live total ₹ | `sales_view` |

---

# 6. Screen-by-Screen Functional Specification

*(Structure per screen: Purpose / Entry Point / Components / User Actions / Inputs / Data Displayed / Interactions / Navigation / States. Condensed from full research; see linked source files in the repo's `docs/` companion research if deeper trace-through is needed. All portal pages that fetch data render `EmptyState` with the raw server error message on load failure unless noted otherwise, and each portal has its own `loading.tsx` skeleton fallback.)*

## 6.1 Marketing & Auth

### Landing Page — `/`
**Purpose:** Public marketing homepage, only unauthenticated entry point besides direct login/signup links.
**Entry point:** Root URL; "Back to Home" from 404; logo click from any auth screen.
**Components (order):** Navbar (sticky, glass) → Hero (3D mockup, CTAs) → TrustBar → CoachingShowsUp → WhatIsLeanR → HowItWorks → Coaches (carousel+lightbox) → ReadyWhenYouAre → PricingSection (`#pricing`, **live package data**) → WhyLeanR → Testimonials (`#stories`) → Footer.
**User actions:** 5 anchor nav links (smooth-scroll); 3 login buttons; "Book Your First Session" → `/signup`; "Explore Plans" → scroll to pricing; package card "Get Started" → `/signup`; coach carousel drag/lightbox.
**Data displayed:** Package pricing = live (`listPublicActivePackages()`). **Coach roster on this page is 100% hardcoded fake data** (3 cards, all literally named "Hare Krishna") — disconnected from the real `coach_profiles` table. Do not use this as a source for how coaches should display in mobile.
**States:** Empty package list → "Pricing is being updated — check back shortly." No loading/error state otherwise (single server-side await).
**Dead links:** Social icons (Instagram/YouTube/Facebook) and Privacy/Terms links are all non-functional placeholders (`href="#"`/none).

### Login — `/login/client`, `/login/coach`, `/login/admin`
**Purpose:** Role-specific authentication.
**Entry point:** Navbar/Footer links, direct URL, middleware redirect on unauthorized access.
**Components:** `AuthLayout` (branding + testimonial panel) + `LoginForm`.
**Inputs:** Email or Phone (label misleading — only email actually authenticates), Password (show/hide toggle). Both native-`required` only, no client-side format validation.
**Interactions:** Submit → `signInWithPassword`. Success → separately checks `profiles.role` matches the page's role; **mismatch signs the session back out immediately** and shows "This account isn't registered as a/an {role}...". "Forgot password?" is rendered but **has no onClick handler and no reset flow exists anywhere in the codebase — dead button.**
**Navigation:** Success → `/{role}/dashboard`. Client login only: "Create an account" → `/signup`.
**States:** Loading = spinner + "Signing in...", disabled. Error = inline red banner (raw Supabase message).

### Signup — `/signup`
**Purpose:** Self-service **client-only** account creation.
**Entry point:** Client login page, Navbar/Hero CTAs.
**3-step flow:** (1) Form: Full Name, Email, Mobile (`/^\+?[0-9]{10,15}$/`), Password (≥8 chars) → `signUp()`. (2) Email OTP (numeric, ≥4 digits, 30s client-side resend cooldown). (3) Phone OTP (6-digit, MSG91) — includes a **temporary "Skip for now"** bypass (explicitly commented as temporary pending MSG91 KYC) that saves the phone unverified.
**Navigation:** Success (verified or skipped) → `/client/plans`.
**Google OAuth** button present too — bypasses this whole form; new Google signups always land as `client` (no coach/admin profile pre-exists for a first-time Google account).

### 404 — `not-found.tsx`
Static page: "404", "Lost your rep count?", "Back to Home" → `/`.

## 6.2 Client Portal (15 screens)

Every `/client/*` route sits inside `client/layout.tsx`, which layers three **stacked, priority-ordered gate modals** on top of `PortalShell`, only one visible at a time:
1. **PhoneGateModal** (phone missing — Google signups only) → phone+OTP, with the same temporary "Skip for now" unverified-save bypass.
2. **MeasurementGateModal** (latest `progress_logs` >7 days old or never logged) → "Skip for now" closes the modal but does **not** unblock booking/joining (enforced independently server-side).
3. **SessionsLowGateModal** (active subscription has 1–5 sessions remaining) → "Renew Now" → `/client/plans`. Reappears every login while still low (no persisted dismissal).

**The Client Journey State Machine** (`getMyJourneyStateAction`) is the single gate deciding what Dashboard/Book/Schedule/Subscription each render — **this is the most load-bearing piece of logic to replicate exactly in mobile:**
```
has subscription?
  status=awaiting_activation           → "awaiting_activation"
  status=active:
    no client_onboarding row           → "onboarding"
    (renewal only) no progress log since activated_at → "renewal_checkin"
    (renewal only) no recurring_slots on this sub      → "renewal_scheduling"
    no active recurring_slots at all   → "slot_selection"
    else                               → "active"
no subscription, has demo booking:
  demo status=upcoming                 → "demo_booked"
  demo status=completed/missed         → "demo_completed"
no subscription, no demo               → "marketing"
```

### Dashboard — `/client/dashboard`
**Purpose:** Home screen — plan progress, next session, recent sessions, measurement deltas.
**Redirects (evaluated first):** marketing→`/client/plans`, awaiting_activation→`/client/activate`, onboarding→`/client/onboarding`, renewal_checkin→`/client/renewal-checkin`, renewal_scheduling|slot_selection→`/client/schedule`.
**Data displayed (active stage):** "Day N of your journey"; progress ring (sessions used/total, remaining, paused badge); `NextSessionCard` (see below); 3 stat cards (Completed, Streak — derived not stored, Package Progress %); "Progress Since Day 1" 8-metric grid (only if Day-1 + latest logs both exist; arrow color depends on `lowerIsBetter` per metric — false for Muscle%/Chest/Arms/Thigh); weekly-measurement compliance banner; last 3 completed sessions.
**`NextSessionCard` Join button logic:** enabled only if within join window (10 min pre-start through session end) AND a Zoom URL exists (lazily created) AND measurements aren't stale; stale measurements **replace** the countdown text with "Update measurements to join".

### Activate Plan — `/client/activate`
**Purpose:** One-time start-date selection after purchase, before coach/schedule setup.
**Input:** Start Date, `min=tomorrow`, required.
**Validation (server):** rejects if already activated (one-time only); rejects same-day start (IST).
**On submit:** subscription → active; if renewal, old subscription → inactive; timeline logged; client notified. → `/client/dashboard`.

### Onboarding — `/client/onboarding`
**Purpose:** One-time initial assessment intake.
**Fields (4 sections):** Personal Details (Age/Gender/Height, all optional); Starting Measurements (8 fields, **Weight required**, rest optional); Fitness Goal (single-select pill, **required**: Fat Loss/Muscle Gain/Strength/General Fitness/Rehabilitation); Medical Details (4 optional textareas).
**Submit gate:** enabled only if weight filled AND goal selected.
**On submit:** rejects if a `client_onboarding` row already exists — **client cannot self-edit after submit, only admin can.** If any measurement filled, also inserts a `progress_logs` row tagged "Day 1 — initial assessment" (permanent baseline). → `/client/dashboard`.

### Book a Session — `/client/book`
**Purpose:** Ad-hoc single-session wizard — **only reachable for the very first (assessment) session**; once a recurring schedule exists, nav is hidden and direct navigation server-redirects to `/client/schedule`.
**3 steps:** Intro (assessment info card, or assigned-coach card + "Request coach change" if not first session) → Schedule (grid of assigned coach's open slots, next 14 days, max 20 shown) → Confirm (review + submit, disabled if measurements stale).
**Business logic:** session type = **assessment** (60min) if 0 prior bookings ever, else **regular** (45min) requiring an active subscription. ⚠️ Duration is hardcoded at this specific call site rather than read from `system_settings` — possible drift vs. the admin-configurable duration settings; flag for reconciliation, don't necessarily replicate the hardcoding.
**Demo feedback gate** (embedded when stage=demo_completed): two 5-star pickers, optional note, both required to actually record a rating but "Skip" is always available and functionally equivalent for flow purposes.

### My Chats — `/client/chats`
**Purpose:** 1:1 messaging with assigned coach. Nav hidden until ≥1 chat thread exists (auto-created on coach assignment).
**Structure:** one **active** conversation (live thread) + any **closed** past-coach conversations (permanently read-only, collapsed under "Past Coaches").
**Interactions:** free text + attachment (empty message with no attachment rejected client- and server-side). Sending notifies the coach.

### My Coach — `/client/coach`
**Purpose:** View assigned coach; request/complete a coach change.
**Fallbacks:** active recurring-slot coach → full profile; else demo-assigned coach (only while demo upcoming) → simpler card, no change option; else "No Active Coach".
**Coach Change flow (one active request at a time):** Raise (reason **required**, optional 2 star-ratings + comments; disabled while a request is pending) → Pending (yellow banner, current coach stays) → Rejected (red banner, can raise a new one) → Approved-no-coach-yet (pick days+time → Find Available Coach → Confirm — retires old slots/bookings, creates new pattern) → Approved-complete (green banner). Admin can also resolve by picking the coach directly, skipping the client's own completion step.

### My Concerns — `/client/concerns`
**Purpose:** Support-ticket-style issue reporting (replaces WhatsApp/email).
**Raise form:** Category (select, from a fixed 7-value enum: slot_not_available, coach_missed_session, need_schedule_change, payment_issue, technical_issue, want_coach_change, other), Details (optional textarea).
**Display:** category/status badges (open=red/in_progress=yellow/resolved=green), admin's progress notes pre-resolution, final resolution notes once resolved. **Client cannot change status or edit after raising — admin-driven only.**

### Notifications — `/client/notifications`
Flat reverse-chronological inbox. Click unread → optimistic mark-read + fire-and-forget server call. Icon per type (booking/reminder/feedback/system). No filter/sort UI. Empty: "You're all caught up." Separately, a shadow-coach-assignment banner surfaces on **My Sessions**, not here.

### Plans (Marketing/Purchase) — `/client/plans`
**Purpose:** Package catalog + purchase entry, reachable any time.
**Data:** active packages only, each with name/session count/price/original price (strikethrough+"Save ₹X")/features/"Most Popular" flag.
**Purchase flow (Razorpay, full detail in §8/§10):** rejects if client already has an active/awaiting-activation subscription. Order created server-side first (before any money moves) → Razorpay Checkout → server verifies HMAC signature (never trusts client) → subscription created (`awaiting_activation`) → "Congratulations!" modal → `/client/activate`. **Failure states:** signature mismatch → `failed`, retryable. Fulfillment throws post-verification → `paid_unfulfilled` — a real dead-end requiring manual support contact (webhook independently reconciles the tab-closed case).
**Note:** a dormant paid-demo code path exists (`DEMO_SESSION_FEE=₹700`) but is unreachable from any current UI — don't resurrect unless asked.

### Demo Booking — `/client/demo-booking`
**Purpose:** Free trial session, auto-matched coach — **client never picks a coach.**
**Inputs:** Preferred Date (≥tomorrow), Preferred Time (optional, hourly 5AM–9PM IST), Coach Gender (optional).
**Blocked entirely if measurements stale.**
**On submit:** searches every active coach (gender-filtered if set), tries preferred time then full grid, ranked by **lowest utilization first** (load-balancing), takes the **first match with zero user confirmation step.** Zero matches → "No coaches are available for that date or time."

### Profile — `/client/profile`
**Data:** name, active package, email (read-only), phone, height/weight/BMI (computed client-side, **not editable here** — only via onboarding/admin), goals/equipment (tags), medical notes.
**Edit modal:** Photo (upload to Supabase Storage `avatars`), Name, Phone (no re-validation here), Goals/Equipment (tag editors), Medical Notes.
**Change Password (separate modal, bypasses server-action layer):** New Password ≥8 chars, Confirm must match → `supabase.auth.updateUser` directly.

### Progress — `/client/progress`
**Purpose:** Full measurement history + weekly log + session/coach-notes history.
**Log form:** same 8 optional metrics as onboarding. **Hard-blocked to once per 7 days for client self-service** (admin logging on the client's behalf bypasses this). Notifies current coach — only for client-initiated logs, not admin backfills.
**Display:** latest measurements card, `MeasurementChart` (shared with coach/admin client-detail view) if ≥1 log, and every session (any status) with rating/notes.

### Renewal Check-in — `/client/renewal-checkin`
**Purpose:** Fresh baseline required before a renewed plan proceeds to scheduling; only reachable at journey stage `renewal_checkin`.
**Form:** same 8 fields, **all optional here** (no "weight required" rule, unlike onboarding). Bypasses the once-a-week cap (`skipWeeklyLimit:true`). → `/client/dashboard`.

### My Schedule — `/client/schedule`
**Purpose:** Set up or change the client's **recurring weekly slot pattern** — the primary/only ongoing booking mechanism once a plan is active.
**Renders vary by journey stage:** renewal_scheduling → setup client in "renewal" mode; demo_booked → read-only card; marketing/demo_completed → CTA card; has active schedule → `ChangeScheduleClient` wrapper; first-time → setup in "setup" mode.
**Core picker:** Time (restricted to booking-window hourly grid) → Pattern, 3-tier: Standard (MWF/TTS/6-day presets, default) → Pair (6 curated 2-day presets) → Custom (2–5 days, **Sunday always excluded, hardcoded**). Trainer Preference (Same/New/No Preference; renewal mode omits "No Preference") shown only in change/renewal modes.
**"Check Availability"** searches per a specific fallback ladder depending on preference (see §8.9). No match → "Try Other Options" + **"Notify Support"** (admins notified, **no automatic client waitlist**).
**Confirm** → **immediately generates real upcoming bookings**, not just a pattern row.

### My Sessions — `/client/sessions`
**Purpose:** Full session list with cancel/reschedule/rate actions.
**Tabs:** Upcoming/Completed/Cancelled/Missed/Rescheduled (derived filter, cuts across statuses) — client-side, sorted newest-first, **no server pagination.**
**Per-card:** coach, Assessment/Regular badge, status badge, Shadow-Coach badge (computed client-side per row, not a stored flag), "Originally: {date}" if rescheduled, coach notes (completed only), Rate button if completed+unrated.
**Cancel:** cutoff-gated (`hoursUntil > cancellation_cutoff_hours`), `ConfirmDialog` → RPC → Zoom deleted, timeline logged, coach + **all admins** notified (client-initiated) or client notified with reason (coach/admin-initiated).
**Reschedule (`RescheduleModal`, 3 paths):** (1) "Fastest Available" per-coach soonest slot, 1-click. (2) Browse own-coach's open-slot grid (excludes already-busy IST dates). (3) Type an exact date/time → check → confirm with own coach, or pick a substitute coach if own coach isn't free then. Common server-enforced preconditions regardless of path: ≤2 reschedules/calendar-week, within 30 days, ≥cutoff hours before the *original* start, no double-booking a day.
**Rate:** 2 star pickers (quality, trainer) + optional note. **Capped at once per 7 days across ALL the client's bookings** (not per-booking) — rating one session blocks rating a different one for a week; flagged as a possibly-unintended quirk, confirmed current server behavior. Recomputes coach's aggregate rating immediately.

### Subscription — (surfaced via Dashboard/Progress package cards; dedicated `/client/subscription` route also exists)
**Purpose:** View plan usage/status/pause-days, pause/resume, payment history. Pause/Resume both `ConfirmDialog`-gated, only available in the matching current state (active→pause, paused→resume).

## 6.3 Coach Portal (13 screens)

Every `/coach/*` route sits inside `coach/layout.tsx` → `PortalShell` (role=coach) + `CoachPendingTasksGateModal` (lists up to 5 overdue attendance/notes items on every login while backlog > 0; "Skip for now" is a **soft, non-persisted** dismissal — reappears next login, nothing else in the coach portal is gated on clearing it).

### Coach Dashboard — `/coach/dashboard`
**Stat cards (7):** Today, This Week, Completed, Missed (red-tinted), Utilization %, Avg Rating, Active Escalations.
**Widgets:** Today's Tasks (Join/Present/Late/Absent actions), Pending Tasks (any-day attendance/notes backlog), Upcoming (next 3 days), last 5 Cancelled / last 5 Rescheduled, first 3 "Your Clients".

### Availability — `/coach/availability`
**Weekly hours: read-only** ("Only admin can change your working hours").
**Request Leave modal:** Leave type (Full day/Partial, segmented toggle); Full-day: From/To dates (min=tomorrow); Partial: single Date + Unavailable-from/until times.
**Server validation:** end ≥ start; partial leave must be a single date; partial end-time > start-time; **24-hour minimum notice, computed in IST, no admin bypass, no emergency fast-track.**
**Consequence (admin-side, documented here since it's this screen's direct effect):** approval auto-cascades shadow-coach search across every affected client occurrence — see §8.11.

### Schedule — `/coach/schedule`
Day/Week toggle (client-state, no refetch). Week view: 7-column grid, session count per day, click a non-empty day → modal listing that day's sessions → links to Session Detail.

### Session Detail — `/coach/session/[id]`
**Purpose:** Live in-session workflow: join → attendance → mandatory notes → close-out.
**Step 1 — Join:** enabled per `useJoinCountdown` (10-min pre-start window); sets `coach_joined_at`, opens Zoom in new tab if configured (silently degrades — Join still "works," just no real link — if Zoom is unconfigured or the API call fails).
**Step 2 — Attendance** (Present/Late/Absent): enabled only once `now ≥ scheduled_start + duration`; for **today's** sessions specifically, also requires `coach_joined_at` set (backlog/previous-day sessions skip this join requirement entirely). Absent (+ optional remark) → booking `missed`, flow ends immediately, no notes phase. Present/Late → unlocks notes, booking stays `upcoming`.
**Step 3 — Session Notes** (only once attendance present/late): Summary (**required**), Exercises Performed, Client Performance (4-way select), Improvements Seen (tag editor), Homework, Additional Remarks — all but Summary optional. Submit → booking `completed`. Once completed, all fields render read-only.
**Sidebar:** client info (goals/medical notes/equipment, read-only), last 3 prior session notes for this client.

### Clients — `/coach/clients`
Roster of assigned clients only. Search (name/code substring) + Status chip (7-way) + Plan select (dynamic) + Day-of-week select — all client-side, AND-composed, no explicit reset.

### Client Detail — `/coach/clients/[id]`
Reachable for **any** client platform-wide via Global Search — if not assigned, shows a read-only banner and a materially thinner data set (billing/progress/session-detail sections blank). If assigned: full demographics, session summary, 8-metric weekly-progress comparison (start vs. current, green if diff ≤ 0 for all 8 — no metric-specific direction logic here, unlike the client's own dashboard delta grid), `MeasurementChart`, full session history w/ notes, shared `ClientTimeline`. **Fully read-only for a coach — no edit actions on this page.**

### Client Escalations — `/coach/escalations`
**Explicitly read-only** ("only Admin can respond to or resolve these" — no coach-side update action exists at all). Active/Resolved tabs.

### Notifications — `/coach/notifications`
Shared `NotificationsClient` component (same as client portal).

### Performance — `/coach/performance`
**13 read-only stat cards** + a merged, capped-30, sorted-desc activity timeline (sessions + leave lifecycle + shadow-assignments-received) — fully derived, no dedicated table.

### Profile — `/coach/profile`
Read-only admin-owned fields (name, specialization, bio, certifications, languages, employee code, working hours, capacity, rating). Coach-editable: Mobile Number, Emergency Contact, Profile Picture (via modal). **Skills: append-only** (free-text + Add; no coach-side remove — admin only). Change Password bypasses the server-action layer identically to the client portal.

### Renewal Opportunities — `/coach/renewals`
Shared component with admin (`role="coach"` scopes to own clients, omits the Coach column admin sees). Tabs: Opportunity (≤10 sessions left) / Expired.

### Global Search — `/coach/search`
Platform-wide client lookup (not just own roster) — deliberate RLS-widened design (migration 0033). Results show green "Your client" or gray "Read-only" badge.

### My Chats — `/coach/chats`
**4 category tabs** (Active/Old/Expired/Pause Client Chat, each with a live count) — master-detail layout. Closed conversations (client reassigned away) are permanently read-only.

## 6.4 Admin Portal (23 screens)

Every `/admin/*` route sits inside `admin/layout.tsx` → `PortalShell` (role=admin).

### Dashboard — `/admin/dashboard`
**12 stat cards**, all live-computed (never stored): Total/Active Clients, Sessions Booked/Cancelled Today, Trainer Utilization %, Peak Booking Hour, Empty Slot Count (`floor(today's total availability minutes / default_session_duration) − booked`), Revenue This Month, Avg Sessions/Client, Active Coaches, Avg Coach Rating, Avg Sessions/Day (trailing 30d), **Renewal Rate %** (null/"—" distinguished from 0% when no opportunities exist). Plus a 6-month revenue trend chart, today's bookings-by-hour chart, top-5 coach utilization bars.

### Clients list — `/admin/clients`
All clients, admin sees everything. Search (name/phone/code, client-side) + status pill filter. **No pagination anywhere in admin lists.** ⚠️ Gap: zero-match state renders an empty container with no explanatory message here (unlike Search/Sales/Sessions, which do show one).

### Add Client — `/admin/clients/new`
**This is a migration flow** — onboarding an already-paying-elsewhere client, explicitly not a "new sale" screen. Key fields: Full Name (required), Login Email (required), Temporary Password (auto-generated, shuffle button), Plan Name (select), **Sessions Remaining (required, must be >0 — this is what the client actually gets in LEANR, not the package's full size)**, Original Plan Size (descriptive only), Pause Days Allowed, optional Coach/Time/Days.
**Availability check gate:** if any day selected, "Check Availability" must run and pass before submit is enabled; changing coach/day/time invalidates the prior check. Result shows up to 5 alternate times (same coach) and 5 alternate coaches (same time) if the exact combo is unavailable.
**On submit:** real Supabase Auth user created; cascades to `profiles`+`client_profiles`; active subscription created with `sessions_total = sessionsRemaining`; timeline logged with migration note; optional recurring slots created. **No server-side re-check of availability** — trusts the client-side check already ran.

### Client Detail — `/admin/clients/[id]`
Full 360° record. **Manual Controls card:** Adjust Package/Sessions (stepper), Transfer Coach, Assign Shadow Coach, Pause Subscription, Log Measurement, Log Escalation, **Log Refund Request** (writes audit+timeline only — see §8 reconciliation note on payments).
**Transfer Coach:** blocked unless the new coach's weekly availability fully covers the client's existing pattern — unless admin clicks **"Transfer Anyway"** (force override) after a specific coverage-gap error.
**Assign Shadow Coach:** date range → "Find Coverage" (per-occurrence candidate scoring, see §8.11) → shows plan (grouped assignments + any uncovered dates in red) → "Confirm Assignment(s)".
**Client Journey Timeline** (`ClientTimeline`, shared with coach detail): Split view (LEANR-internal column vs. customer column) or Merged view; filter by event type; infinite-scroll (20/page); 26 distinct event types, two of which (`session_cancelled`, `session_rescheduled`) render on whichever side matches the actual actor.
**Client Chats card:** view-only, per-coach history — **admin cannot send messages, by design.**

### Coaches list — `/admin/coaches`
All coaches, columns incl. Utilization bar+%, Active Clients, Rating. Search on name only (not specialization/code).

### Add Coach — `/admin/coaches/new`
Fields: Full Name, Employee Code, Login Email, Temp Password, Primary Specialization (select, 12 fixed values), Additional Skills (multi-toggle), Languages Spoken (**required, ≥1**, 8 fixed values), Weekly Slot Openings (repeatable start-time + day-multi-toggle rows, **required, ≥1 valid row**).
**Submit:** creates Auth user with `app_metadata.role='coach'`. Because the DB trigger always shapes a client-style row first regardless of intended role, the function explicitly **deletes** the auto-created `client_profiles` row and builds the real `coach_profiles` row + bulk-inserts `coach_availability` rows from the slot patterns.

### Coach Detail — `/admin/coaches/[id]`
Identity card, `CoachPerformancePanel` (13 stats, same formulas as coach's own Performance page), Skills editor (full add/remove, admin-only), **Admin Controls:** Override/Block Slots, Reassign Clients, Disable Coach. Weekly Working Hours (admin-editable, 7 rows). 7-Day Schedule grid (open/booked/unavailable cells, booked cells link to client detail).
**Block Slot:** reuses `coach_leave` as a pre-approved single-day row — reuses the exact same "on leave" scheduling-engine enforcement, but **does NOT trigger the shadow-coverage auto-assignment cascade** that a real Leave Request approval does (inferred from code structure — flagged for verification). A slot blocked this way can silently produce a gap only the Shadow Coverage queue later surfaces.
**Reassign Clients:** bulk-move, **per-client failure-tolerant** (one blocked client doesn't abort the batch — an explicit fix over the old prototype's all-or-nothing behavior).
**Disable Coach:** sets inactive; warns clients need separate manual reassignment — **does not auto-reassign.**

### Coach Change Requests — `/admin/coach-change-requests`
Pending (Approve/Reject) + Resolved (read-only) sections. "Currently with" coach resolved **live** for pending requests (another admin action may have moved the client since). **Reject: single click, no confirmation, no reason field.** **Approve (2-step):** optional direct coach pick (immediately reassigns) or leave blank (client self-serves later) — this is the fix over "the old prototype silently discarded the chosen coach."

### Leave Requests — `/admin/leave-requests`
Pending only (resolved not shown here, unlike Coach Change's Resolved tab). Badge if full-day leave ≥14 days ("N+ days" — advisory nudge only, never auto-converts to a coach change). **Approve triggers the full automatic shadow-coverage cascade** (§8.11) and renders an inline result summary (auto-assigned list / needs-manual-assignment list / "no clients affected"). **Reject: no reason required.**

### Escalations (global) — `/admin/escalations`
Active/Resolved tabs, platform-wide.

### Escalation Detail — `/admin/escalations/[id]`
**Hard sequential gate:** nothing below step 1 is actionable until "Confirm I've Called the Client" is clicked (`called_client_at` stamped) — enforced **server-side**, not just hidden in the UI. Then: Admin Assessment (Issue Type, Who's at Fault — **never shown to client/coach**, Case Summary — internal), Progress Notes (client-visible running log, distinct from final resolution notes), Mark In Progress / Mark Resolved & Close (notifies client). **Resolution is a one-way door — no reopen action exists in the UI.**

### Sales — `/admin/sales`
Search (name/code/package), live count + total ₹ of the filtered set. No date range, no pagination.

### Scheduling — `/admin/scheduling`
Read-only, 6 grouped sections (each capped at 10 items, no "view all" link — gap): Today's Changes, Cancelled Sessions, Rescheduled Sessions, Manual Sessions Created (admin-created, via audit-trigger actor lookup), Demo Sessions, Shadow Sessions.

### Availability Check — `/admin/availability`
Every coach's slots for one day, chronological. Date picker drives a real `?date=` query param (survives refresh). All/Booked/Free filter tabs.

### Shadow Coach Required — `/admin/shadow-coverage`
Persistent queue: upcoming bookings whose coach is on approved leave with no shadow assigned yet (derived live — resolving it makes it vanish automatically). "Assign shadow coach" links to that client's detail page (not an inline action here).

### Renewal Opportunities — `/admin/renewals`
Same shared component as coach portal, platform-wide scope.

### Reports — `/admin/reports`
5 canned reports (Client, Coach, Monthly PT, Revenue, Cancellation/No-Show), each its own server action → CSV, or client-side jsPDF (dynamically imported on click). **No date-range picker anywhere — always all-time/current-state.**

### Settings — `/admin/settings`
**Session Rules** (4 sliders, backed by `system_settings`, read live everywhere): Default Session Duration (30–90/step15, current default 45), Cancellation Cutoff (4–48/step4, default **12**), Reschedule Cutoff (1–24/step1, default **1**), Inactivity Threshold (7–90/step7, default 30). **Save is not atomic** — 4 independent parallel calls; a partial failure leaves some saved, only the first error is shown.
**Package Types:** full CRUD, **delete is always soft** (`is_active=false`) — existing subscriptions on a deleted package are unaffected.

### Search — `/admin/search`
Global lookup, name/code/phone, no debounce, no minimum length, no pagination.

### Sessions — `/admin/sessions`
Flat master list, all bookings. Coach + Status filters (client-side, composable). **Reschedule** (modal) and **Cancel** (immediate, **no confirmation dialog, no reason field**) only shown for `status='upcoming'` rows. Admin bypasses cutoff-hour enforcement here.

### Session Detail — `/admin/sessions/[id]`
Read-only deep-dive: Basic Info (incl. Source: "Manually added" vs. "Auto-generated," derived from `recurring_slot_id`), conditionally-rendered Outcome Detail, Attendance timestamps, Coaching Notes, Weekly Progress Snapshot (measurement log **as of before this session**), Linked Escalation if any.

### Activity Log — `/admin/activity-log`
Immutable audit trail, last 200 rows. **The only admin filter that's a real URL-driven navigation** (`?entityType=`) — survives refresh, unlike every other client-side-only filter in the portal. INSERT=green/UPDATE=yellow/DELETE=red, up to 3 changed-field diffs per UPDATE row.

### Notifications — `/admin/notifications`
Reuses the client portal's `NotificationsClient` component, scoped to admin-relevant templates (e.g., shadow-coverage-gap alerts).

---

# 7. Forms & Validation

*(Consolidated master table. "Server" validation means enforced regardless of client-side checks — the authoritative rule for mobile to replicate.)*

## 7.1 Auth

| Form | Field | Type | Required | Validation | Default | Error Behavior |
|---|---|---|---|---|---|---|
| Login (all 3 roles) | Email or Phone | text | yes | none client-side | "" | Supabase error verbatim, inline banner |
| Login (all 3 roles) | Password | password | yes | none client-side | "" | same banner |
| Signup — step 1 | Full Name | text | yes | non-empty | "" | none dedicated |
| Signup — step 1 | Email | email | yes | native `type=email` only | "" | Supabase signUp error verbatim |
| Signup — step 1 | Mobile Number | tel | yes | `^\+?[0-9]{10,15}$` post-normalize | "" | "Enter a valid mobile number (10-15 digits)." |
| Signup — step 1 | Password | password | yes | length ≥ 8 | "" | "Password must be at least 8 characters." |
| Signup — step 2 (email OTP) | Code | text | yes | length ≥4, max 10 | "" | "Enter the code from your email." |
| Signup — step 3 (phone OTP) | Code | text | yes | length ≥4, max 6 | "" | "Enter the code from the text message." |
| PhoneGateModal | Phone / OTP | tel / text | yes | same as signup | "" | same messages |

## 7.2 Client Portal

| Form | Field | Type | Required | Validation | Default | Error Behavior |
|---|---|---|---|---|---|---|
| Activate plan | Start Date | date | yes | `min=tomorrow`; server rejects same-day (IST) + re-activation | tomorrow | inline red text |
| Onboarding | Weight kg | number | **yes** | non-empty | — | submit disabled |
| Onboarding | Fitness Goal | pill-select | **yes** | one of 5 enum values | — | submit disabled |
| Onboarding | Age/Gender/Height/BodyFat/Muscle/Waist/Chest/Hip/Arms/Thigh, Medical fields | number/select/textarea | no | none | — | — |
| Demo booking | Preferred Date | date | yes | `min=tomorrow` | tomorrow | — |
| Demo booking | Preferred Time / Coach Gender | select | no | 17 hourly slots / 3 genders | "No preference" | — |
| Plans purchase | (button only) | — | — | server: no existing active/pending plan | — | inline error below plan grid |
| Coach change request | Reason | textarea | **yes** | non-empty trimmed | — | submit disabled |
| Coach change request | Overall Experience / Coach Rating / Comments | star / star / textarea | no | — | 0 / 0 / "" | — |
| Coach change completion | Days + Time | multi-toggle + time | yes | ≥1 day + time to enable Find Coach | — | button disabled |
| Raise concern | Category | select | yes (has default) | 7 enum values | first value | — |
| Raise concern | Details | textarea | no | — | — | — |
| Profile edit | Name/Phone/Goals/Equipment/Medical Notes/Photo | mixed | implicit | none (no phone re-check here) | current value | inline red on photo-upload failure |
| Change Password | New / Confirm | password | yes | length ≥8, must match | "" | inline red text |
| Progress / gate / renewal check-in | 8 metric fields | number | no (weight not required outside onboarding) | none | empty | — |
| Schedule setup | Pattern | button-select | yes | custom requires 2–5 days | mwf | disabled until valid |
| Schedule setup | Time / Trainer Preference / Trainer Gender | select / toggle / toggle | yes / conditional / conditional | booking-window grid / same-new-nopref / 4 values | first hour / same / none | — |
| Reschedule — specific time | Date / Time | date / select | yes | `min=today` / booking window | — | — |

## 7.3 Coach Portal

| Form | Field | Type | Required | Validation | Default | Error Behavior |
|---|---|---|---|---|---|---|
| Request Leave | Leave type | toggle | yes | full_day / partial | full_day | — |
| Request Leave | From/To or Date | date | yes | min=tomorrow (client); server: 24h-notice IST, end≥start | "" | server messages, inline |
| Request Leave | Unavailable from/Until (partial) | time | yes (partial) | end > start | "" | client + server checks |
| Session Notes | Summary | textarea | **yes** | non-empty | "" | Mark Completed disabled |
| Session Notes | Exercises/Performance/Improvements/Homework/Remarks | mixed | no | none | — | — |
| Edit Contact Info | Mobile/Emergency Contact/Photo | text/text/file | no | none client-side; Storage upload for photo | current value | inline red on upload failure |
| Add Skill | Skill | text | yes to submit | non-empty trimmed | "" | server error inline |
| Change Password | New / Confirm | password | yes | length ≥8, must match | "" | inline red text |

## 7.4 Admin Portal

| Form | Field | Type | Required | Validation | Default | Error Behavior |
|---|---|---|---|---|---|---|
| Add Client | Full Name / Login Email / Password | text/email/text | yes | non-empty (no email regex) | random 12-char password | submit disabled |
| Add Client | Sessions Remaining | number | yes | `>0` (client gate + server throw) | package default | inline + disabled button |
| Add Client | Schedule days/coach/time | composite | conditional | must pass availability check before submit; any change invalidates prior check | none / 06:00 | submit disabled until re-confirmed |
| Add Coach | Full Name/Employee Code/Email/Password | text/email/text | yes | non-empty | random password | submit disabled |
| Add Coach | Languages | multi-select | yes, ≥1 | length check | none | submit disabled |
| Add Coach | Weekly Slots | composite | yes, ≥1 valid row | empty-day rows silently filtered | 1 row, 06:00 | submit disabled |
| Adjust Sessions / Grant Pause-Days | delta | stepper | — | button disabled at 0; server rejects `pause delta===0` | 0 | inline error |
| Transfer Coach | new coach | select | yes | server availability-coverage check, force-override available | — | inline warning + override button |
| Assign Shadow Coach | From/To dates | date | yes | `endsOn >= startsOn` | today/today | inline error |
| Log Refund | amount / reason | number / textarea | yes | `>0` (disabled-button gate) | — | button disabled until both filled |
| Log Escalation | reason | text | yes | — | — | button disabled |
| Settings sliders | 4 numeric | range | — | clamped by min/max/step only | see §6.4 | first-failure message, partial save possible |
| Package form | name/sessions/price | text/number/number | yes | `sessions≥1`, `price≥0` (client-side `if` guard) | 12 / 0 | silently no-ops if invalid — no inline message |
| Session Reschedule (admin) | new date/time | date+time | yes | disabled until both set | — | inline red text |

---

# 8. Business Logic & Calculations

*(Every formula/threshold found, with exact current values verified against live code — not the stale docs. `system_settings` values are read live at call time by every RPC/service that uses them, never compiled-in, unless explicitly noted as hardcoded below.)*

### 8.1 `system_settings` — current values
| Key | Default | Meaning |
|---|---|---|
| `reschedule_cutoff_hours` | **1** | Min hours before start to reschedule (client/coach; admin exempt) |
| `cancellation_cutoff_hours` | **12** | Min hours before start to cancel (client/coach; admin exempt) |
| `join_window_minutes` | 10 | Minutes before start the Join button enables (UI constant duplicated in `JoinCountdown.tsx`, not confirmed to read this setting directly — verify before assuming full wiring) |
| `default_session_duration_minutes` | 45 | Regular session length |
| `assessment_session_duration_minutes` | 60 | Assessment/demo session length |
| `inactivity_threshold_days` | 30 | Days with no completed session → flagged inactive |
| `temporary_booking_hold_minutes` | 10 | Slot hold before auto-expiry |
| `booking_window_start_hour` | 5 | Earliest bookable hour (IST) |
| `booking_window_end_hour` | 22 | End of bookable window |

**IMPORTANT correction to the project's own `docs/business-rules.md`:** that doc claims `reschedule_cutoff_hours` defaults to 12 and was "never wired." Current code shows reschedule=**1** and cancellation=**12** as two genuinely separate settings (split by migration 0025) — treat the values above as authoritative.

### 8.2 Booking lifecycle
`upcoming → {completed | cancelled | missed}`, one-way, enforced at two layers (RPC + a `BEFORE UPDATE` trigger closing a direct-PostgREST-PATCH bypass, migration 0052). Admin and service-role calls are exempt from the trigger.

- **Cancel:** IF hours-until-start < `cancellation_cutoff_hours` (client/coach) → reject. ELSE cancel; IF booking came from a recurring slot → immediately regenerate the next occurrence so the ongoing pattern isn't lost.
- **Reschedule:** IF hours-until-start < `reschedule_cutoff_hours` → reject. ELSE IF new time fails working-hours/conflict checks → reject. ELSE update in place (same row id, notes/attendance survive), `was_rescheduled=true`, `original_scheduled_start` preserved (first reschedule only). Does **not** regenerate a recurring occurrence (unlike cancel). May move to a **substitute coach** for just this one instance — the `recurring_slot_id` stays pointed at the original coach for future auto-generated occurrences.
- **Additional client-only reschedule rules** (app layer, admin bypasses all): new time within next 30 days; max 2 reschedules per Monday-start calendar week (derived by counting `client_timeline_events`, not a stored counter); no two upcoming bookings the same IST calendar date.

### 8.3 Slot fitness (`is_slot_within_working_hours`)
IF coach has approved leave covering this date/time → unavailable. ELSE IF an explicit `coach_shifts` override exists for this date → use **only** that shift's hours (fully overrides the template, even if the template would otherwise cover it). ELSE fall back to the recurring weekly `coach_availability` template. All comparisons explicit **Asia/Kolkata (IST)** wall-clock (fixed in migration 0026 after a real production bug: 7:00 AM IST was being stored/read as UTC).

### 8.4 Booking credit / session-balance check (migration 0053, critical fix)
IF confirming a booking against a subscription → count bookings already `upcoming OR completed` against it; IF ≥ `sessions_total` → reject "No sessions remaining on this package." This closed a real gap where `upcoming` bookings could stack up unboundedly (the display metric only ever counted `completed`).
⚠️ **Note the resulting display/enforcement split**: `subscription_usage_view.sessions_remaining` (shown to the client) counts only `completed` bookings; the actual booking gate counts `upcoming + completed`. The two numbers can legitimately differ — don't assume the displayed "remaining" figure is exactly what a new booking attempt will be gated against.

### 8.5 Pause-days "promise"
`pauseDaysAllowed` = `subscriptions.pause_days_allowed` (admin-adjustable, package default + grants). `pauseDaysUsed` is **never stored** — derived by pairing chronological `pause_started`/`pause_ended` timeline events; an unclosed pause counts elapsed time to "now."

### 8.6 Client status derivation (`deriveClientStatus`) — used everywhere across admin/coach
```
IF any subscription.status = 'paused'                    → "paused"
ELSE IF any subscription.status = 'active'                → "active"
ELSE IF any subscription.status = 'awaiting_activation'    → "created"
ELSE IF client has ≥1 subscription ever                    → "expired"
ELSE IF client has a demo/assessment booking on record      → "demo"
ELSE                                                        → "not_paid"
```
This 6-value derived status is DIFFERENT and richer than the raw DB `client_profiles.status` enum (active/inactive/paused) — the app uses the derived status everywhere in UI/filters/reports.

### 8.7 Measurement staleness
IF `lastLoggedAt` is null OR older than 7 days → stale. Blocks: demo booking, regular ad-hoc session booking, session Join button. Does NOT block: navigation, chat, raising concerns.

### 8.8 Rating logic
- **Session rating cap:** once per 7 days **across all of a client's bookings** (not per-booking — rating session A blocks rating session B for a week; confirmed current behavior, flagged as possibly unintended, don't silently "fix" this without confirming intent).
- **Coach rating recompute:** `AVG(trainer_rating)` over all that coach's rated bookings, rounded to 2 decimals, recomputed synchronously on every new rating (no cron/batch) — the "recompute on the write that could invalidate it" pattern used throughout this codebase for derived numbers.

### 8.9 Recurring pattern matching fallback ladder
For a given pattern (MWF/TTS/6-day) + preferred time, tried in order until one fits: (1) exact pattern @ exact time, (2) exact pattern @ any other grid time, (3) same-trio day-pairs @ exact time (MWF pairs=[1,3]/[1,5]/[3,5], TTS pairs=[2,4]/[2,6]/[4,6]), (4) same-trio pairs @ any grid time. Custom patterns (2–5 days) skip the pair-fallback tiers. No match → null → UI offers "custom days" or "Notify Support."

### 8.10 Coach performance formulas
- `attendancePct = round(100 × count(present, among completed bookings) / count(completed))`
- `clientNoShowPct` / `coachNoShowPct` = `round(100 × count(no_show_party=X, among completed+missed+cancelled) / total-outcomes)`
- `avgSessionDurationMinutes = round(avg(duration_minutes) over completed)`
- `availableCapacity = max(0, maxCapacity − currentCapacity)`; `maxCapacity` defaults to 50 if unset
- Coach utilization %: `round(100 × booked_minutes_this_week / available_minutes)` — ⚠️ this view's week-boundary math is **server/UTC time, not IST-converted** like the rest of the scheduling logic, a likely inconsistency (see §18 Edge Cases)

### 8.11 Shadow coach candidate scoring (`scoreShadowCandidate`)
```
score = 0
+ 40 if candidate.specialization == primary.specialization
  (else +20 if primary.specialization ∈ candidate.secondary_specializations)
+ min(shared_languages_count, 3) × 10       (max 30)
+ candidate.rating × 6                       (0–5 → 0–30)
+ (100 − candidate.utilization_pct) × 0.2    (lower utilization scores higher, 0–20)
```
Resolved **per individual session occurrence** (not once for the whole leave range) — a coach free for 3 of 5 sessions is a valid partial candidate. `planShadowAssignments` greedily assigns top-scored per occurrence, groups consecutive same-coach occurrences into one assignment row; a gap breaks the grouping.

**Leave approval cascade (full):**
```
IF leave approved:
  FOR EACH active client of this coach whose sessions fall in the leave window
    (filtered to the partial time window if leave_type=partial):
    search for shadow candidates per occurrence, auto-create shadow_coach_assignments
    IF any occurrence uncovered: notify all admins (admin_alert) — flagged, never silently dropped
  ALSO: FOR EACH assignment where THIS coach is currently a SHADOW for someone else:
    re-run the search over the overlap, reassign or flag
ELSE (rejected): only notify the coach, no cascade.
```
**"Block Slot" (admin, coach detail) does NOT trigger this cascade** — it's a pre-approved leave row but bypasses `resolveLeave()`'s logic entirely (inferred from code structure, flagged for a second look).

### 8.12 Coach post-session workflow gate
Step 1 (`markAttendance`): only reachable after `now ≥ scheduled_start + duration`; for **today's** bookings, additionally requires `coach_joined_at` set. Absent → `missed` immediately, no notes phase. Present/Late → stays `upcoming` until notes submitted.
Step 2 (`submitSessionNotes`): only reachable if attendance is present/late → sets `completed`.

### 8.13 Overdue sweeps — no cron, run opportunistically
- `flag_overdue_attendance`: `upcoming` bookings 2+ hours past end with no attendance → flag + notify coach once (idempotent — only unflagged→flagged transitions notify).
- `flag_overdue_notes`: present/late but no notes 2+ hours past end → flag + notify once.
- `mark_missed_bookings`: any `upcoming` booking whose end time has fully elapsed → `missed`. Runs as a side effect of `has_scheduling_conflict()` (called on nearly every scheduling read/write) and explicitly at the top of every session-list fetch — **so no view can show a stale "upcoming" past-due session, even without a real cron.**

### 8.14 Admin-specific business logic
- **Empty Slot Count:** `max(0, floor(sum(today's active availability minutes)/default_session_duration) − sessionsBookedToday)`.
- **Renewal Rate %:** IF opportunities>0 THEN `round(converted/opportunities × 100)` ELSE `null` (shown "—", distinguished from 0%). Opportunity = active sub with ≤10 sessions remaining (`RENEWAL_OPPORTUNITY_THRESHOLD`, wider than the client's own self-serve nudge at 5). Converted = client has ever had >1 subscription row (a proxy, not a timestamp comparison).
- **Client-transfer availability guard:** blocked unless the new coach's weekly template fully covers every day/time window in the client's active pattern (force-overridable).
- **Admin slot-assignment check:** exact combo first; if unavailable, same coach at other grid times (closest-first, capped 5) and other coaches at the exact time (capped 5).
- **Long-leave advisory:** ≥14 days is purely a UI nudge suggesting a permanent coach change — never automatic.

### 8.15 Journey day / streak (client dashboard, display-only, not persisted)
`journeyDay = max(1, floor((now − journeyStart)/86400000) + 1)` where `journeyStart = activeSub.started_at ?? client.joined_date`.
`Streak` = count of consecutive Monday-start weeks (incl. current) with ≥1 completed session, walking backward until a gap.

---

# 9. Data Entities & Relationships

*(Canonical current schema, post-migration-0057. `src/lib/types.ts`/`mock-data.ts` are confirmed dead code — do not use them as a schema reference.)*

### Enums
`user_role` (admin/coach/client) · `account_status` (active/suspended) · `coach_status` (active/inactive/on-leave) · `client_status` DB enum (active/inactive/paused — narrower than the app-level derived status, §8.6) · `package_category` (advance/addon) · `subscription_status` (active/inactive/paused/awaiting_activation) · `session_type` (assessment/regular) · `booking_status` (upcoming/completed/cancelled/missed) · `shift_source` (generated/override) · `leave_status` (pending/approved/rejected) · `recurring_slot_status` (active/paused/cancelled) · `temporary_booking_status` (held/confirmed/expired/released) · `assessment_status` (scheduled/completed/cancelled/missed) · `shadow_assignment_status` (active/completed/cancelled) · `coach_change_status` (pending/approved/rejected) · `attendance_status` (present/absent/late) · `notification_type` (booking/reminder/feedback/system) · `escalation_status` (open/in_progress/resolved) · `fitness_goal` (fat_loss/muscle_gain/strength/general_fitness/rehabilitation) · `leave_type` (full_day/partial)

### `profiles` — every authenticated user
`id` (PK = `auth.users.id`), `role`, `full_name`, `phone`, `photo_url`, `emergency_contact`, `account_status`. Auto-created by `handle_new_user()` trigger.

### `coach_profiles`
`id`, `profile_id` (FK, unique), `specialization`, `secondary_specializations[]`, `years_experience`, `bio`, `certifications[]`, `languages[]`, `rating` (auto-recomputed), `review_count`, `status`, `employee_code` (unique), `max_capacity` (default 50), `gender`, `skills[]` (append-only via RPC, distinct from `secondary_specializations`).

### `client_profiles`
`id`, `profile_id` (FK, unique), `medical_notes`, `equipment[]`, `goals[]`, `joined_date`, `status`, `client_code` (unique, auto `'CL' + sequence`).

### `client_onboarding` — one row per client, one-time
`client_id` (unique FK), `age`, `gender`, `height_cm`, `weight_kg`, `medical_conditions`, `injuries`, `medications`, `exercise_restrictions`, `fitness_goal`, `submitted_at`. Client can INSERT once; only admin can UPDATE after.

### `package_tiers`
`name`, `category`, `sessions_count` (>0), `price`, `original_price`, `features[]`, `highlighted`, `is_active`, `default_pause_days`.

### `subscriptions`
`client_id`, `package_id` (FKs), `sessions_total`, `status`, `started_at`, `activated_at`, `paused_at`, `resumed_at`, `pause_days_allowed`.

### `coach_availability` — recurring weekly template
`coach_id`, `day_of_week` (0=Sun), `start_time`, `end_time`, `is_active`. **Admin-managed only since migration 0045** (coach write policy dropped).

### `coach_shifts` — per-date override
`coach_id`, `shift_date`, `start_time`, `end_time`, `source`. If any row exists for a coach+date, it **fully** overrides the template for that date.

### `coach_leave`
`coach_id`, `starts_on`, `ends_on`, `reason`, `status`, `leave_type`, `partial_start_time`, `partial_end_time`. Partial leave constrained to a single day.

### `recurring_slots` — the permanent weekly reservation
`client_id`, `coach_id`, `subscription_id` (nullable), `day_of_week`, `start_time`, `duration_minutes` (default 45), `status`. One row per day-of-week in a pattern.

### `temporary_bookings` — short-lived slot hold
`client_id`, `coach_id`, `slot_start`, `duration_minutes`, `expires_at`, `status`. Expires after `temporary_booking_hold_minutes`.

### `assessment_sessions` — pre-account prospect leads
No auth account required. `prospect_name/email/phone`, `assigned_coach_id`, `scheduled_start`, `status`, `converted_client_id`.

### `bookings` — the central entity
`client_id`, `coach_id`, `subscription_id`, `recurring_slot_id`, `assessment_session_id`, `escalation_id`, `scheduled_start`, `duration_minutes`, `session_type`, `status`, `cancelled_by`, `cancel_reason`. **Hard DB guarantee:** `bookings_no_coach_overlap` gist exclusion constraint — no coach can have two overlapping `upcoming` bookings, enforced at the database level regardless of application code.
Rating: `quality_rating`, `trainer_rating` (both 1-5), `rating_note`, `rated_at` (legacy `rating`/`client_feedback` columns still exist but are dead). Outcome: `no_show_party`, `technical_issue`, `coach_on_leave`, `was_rescheduled`, `original_scheduled_start`. Payment: `amount_paid` (demo/assessment fees only, currently). Zoom: `zoom_meeting_id`, `zoom_join_url`, `zoom_start_url` (created lazily). Join gate: `coach_joined_at`. Overdue flags: `attendance_overdue`, `notes_overdue`. Reminder: `reminder_sent_at` (dedup guard).

### `shadow_coach_assignments`
`client_id`, `primary_coach_id`, `shadow_coach_id` (must differ from primary), `starts_on`, `ends_on`, `reason`, `status`.

### `coach_change_requests`
`client_id`, `current_coach_id`, `new_coach_id` (nullable — only set on direct-approve), `reason`, `status`, `resolved_by`, `resolved_at`, `overall_experience`, `coach_rating`, `additional_comments`.

### `attendance`
`booking_id` (unique FK), `status`, `checked_in_at`, `checked_out_at`, `marked_by`. Also has `client_joined_at/left_at`, `coach_joined_at/left_at` columns — **Unknown/requires verification** whether `attendance.coach_joined_at` is actually written anywhere; the real join-gate code writes to `bookings.coach_joined_at` instead, so this column may be vestigial.

### `workout_notes`
`booking_id` (unique FK), `client_id`, `coach_id`, `notes` (UI label: "Session Summary"), `homework`, `exercises_performed`, `performance_rating`, `improvements[]`, `additional_remarks`. Immutable once created — no edit path found anywhere.

### `progress_logs`
`client_id`, `logged_at`, `weight`, `body_fat_pct`, `muscle_pct`, `waist`, `chest`, `hip`, `arms`, `thigh`, `streak_count`, `notes`, `photo_url`.

### `escalations`
`client_id`, `coach_id` (nullable), `raised_by` (null = admin logged on client's behalf), `reason`, `description`, `status`, `category` (7 values). Resolution workflow: `admin_issue_type`, `fault` (coach/client/platform/third_party/none/other — **never shown to client/coach**), `admin_summary`, `called_client_at`, `called_by`, `resolved_by`, `resolved_at`, `resolution_notes`. **No status change or detail update permitted until `called_client_at` is set** (`requireCalledClient()` server guard).

### `escalation_notes` — append-only, client-visible
`escalation_id`, `author_id` (admin only), `note`. Distinct from `escalations.resolution_notes` (final closing summary) — this is the running progress trail.

### `client_timeline_events` — permanent, append-only, NO update/delete policy for any role
`client_id`, `event_type`, `title`, `description`, `metadata` (jsonb), `actor_id` (nullable = system). ~26 event types, each tagged internal(staff/system)/customer(client) side.

### `notification_templates` — ~50 rows
`key` (unique PK), `type`, `title_template`, `body_template` (both `{{var}}` interpolated).

### `notifications`
`user_id`, `template_key`, `type`, `title`, `message`, `related_entity_type/id`, `read`, `channels` (jsonb placeholder — **unused, nothing reads/writes per-channel delivery status here**).

### `audit_logs` — append-only, admin-read-only
`actor_id`, `action` (INSERT/UPDATE/DELETE or a custom string like `refund_requested`), `entity_type`, `entity_id`, `old_data`/`new_data` (jsonb). Auto-populated by trigger on `bookings`, `subscriptions`, `coach_change_requests`, `client_profiles`, `coach_profiles`, `package_tiers`, `system_settings`.

### `system_settings`
`key` (PK), `value` (jsonb), `description`. Full current values in §8.1.

### `payments` — Razorpay ledger
`client_id`, `package_id` (nullable), `demo_coach_id`/`demo_slot_start` (nullable), `purpose` (package_purchase/demo_session), `amount`, `currency`, `razorpay_order_id` (unique), `razorpay_payment_id`, `razorpay_signature`, `status` (created/paid/failed/paid_unfulfilled), `subscription_id`/`booking_id` (fulfillment pointers), `paid_at`. **No client insert/update RLS policy at all** — every write goes through the service-role client after server-side signature verification.

### `conversations` — one per (client, coach) relationship
`client_id`, `coach_id`, `status` (active/closed). **Unique index: one active conversation per client at a time** — a coach change closes the old thread (frozen, read-only forever) and opens a new one.

### `messages`
`conversation_id`, `sender_profile_id`, `sender_role`, `body` (nullable — must have body OR attachment, checked constraint), `attachment_url`, `read_at` (set by the recipient, WhatsApp-style receipt). Realtime-enabled. A participant may only ever patch `read_at` — enforced by a column-scope trigger (migration 0052).

### Key views (all `security_invoker=true`)
- **`subscription_usage_view`**: `sessions_used`=count of `completed` bookings; `sessions_remaining`=`sessions_total − sessions_used`. ⚠️ Counts only `completed`, while the actual credit-gate (§8.4) counts `upcoming+completed` — the two numbers can differ.
- **`coach_utilization_view`**: `active_clients`, `utilization_pct` — week boundary is server/UTC, not IST (§8.10, flagged edge case).
- **`revenue_trend_view`**: 6 months, revenue = sum of package price for subscriptions started that month.
- **`bookings_by_hour_view`**: grouped by **UTC hour, not IST** — likely display inconsistency, flagged.
- **`inactive_clients_view`**: no completed booking within `inactivity_threshold_days`, or ever.
- **`sales_view`**: one row per subscription — reads the package's **current** price, not a sale-time snapshot; a later price change retroactively alters historical sales figures shown here.

### Storage buckets
`avatars` (public read), `progress-photos` (private: owner/linked-coach/admin), `coach-certifications` (private: owner/admin), `chat-attachments` (public read, participant-scoped write) — all with RLS-backed `{auth.uid()}/...` folder-ownership.

---

# 10. API / Backend Operations

### 10.1 Database RPC functions (`.rpc(...)`)
| Function | Purpose |
|---|---|
| `get_setting_int(key)` | Read one `system_settings` int value |
| `expire_temporary_bookings()` | Flip stale holds to `expired` |
| `is_slot_within_working_hours(coach, start, duration)` | §8.3 |
| `has_scheduling_conflict(coach, start, duration, exclude?)` | Overlap check; also sweeps expired holds + missed bookings as a side effect |
| `create_temporary_booking(client, coach, start, duration)` | Booking step 1: hold |
| `confirm_booking(temp_id, subscription?, recurring_slot?, assessment?, session_type, amount_paid?)` | Booking step 2: promote hold → real booking, runs credit check |
| `generate_bookings_from_recurring_slot(slot_id, count)` | Generate next N occurrences |
| `cancel_booking(booking_id, cancelled_by, reason?, enforce_cutoff)` | §8.2 |
| `reschedule_booking(booking_id, new_start, new_duration?, enforce_cutoff, new_coach?)` | §8.2 |
| `assign_shadow_coach(client, primary, shadow, starts_on, ends_on, reason?)` | Bulk-repoint upcoming bookings for a date range |
| `reassign_shadow_coverage(...)` | Re-cover when a shadow coach themself goes on leave |
| `mark_missed_bookings()`, `flag_overdue_attendance()`, `flag_overdue_notes()` | §8.13 |
| `append_coach_skill(coach_id, skill)` | Append-only, ownership-checked internally |
| `custom_access_token_hook(event)` | JWT role-claim injection; not user-callable |

⚠️ **Stale overload removed in migration 0053**: `confirm_booking` had accumulated a leftover 5-argument overload (pre-0028) that bypassed the credit check — `CREATE OR REPLACE FUNCTION` does not replace a function with a different arg signature, it adds a second overload. Worth an audit lesson for the mobile backend team if extending any multi-signature RPC.

### 10.2 HTTP Route Handlers (not Server Actions)
| Route | Method | Auth | Purpose |
|---|---|---|---|
| `/api/webhooks/razorpay` | POST | Razorpay webhook signature (`x-razorpay-signature`, `RAZORPAY_WEBHOOK_SECRET`) | Payment-capture reconciliation safety net, §10.4 |
| `/api/cron/session-reminders` | GET | `Authorization: Bearer $CRON_SECRET` if set; **open/unauthenticated otherwise** | 6-hour-ahead session reminder emails. ⚠️ **Neither `vercel.json` nor `netlify.toml` has any scheduled-trigger config for this route** — it may be wired via the Vercel dashboard outside this repo, or may be effectively dead/manual-only. **Unknown / requires verification.** |
| `/auth/callback` | GET | Supabase OAuth `code` param | Google OAuth session exchange, routes by `profiles.role` |

### 10.3 Server Actions pattern
See §2 (Architecture) for the full request pipeline. One file per portal-domain in `src/lib/actions/*.ts`; every action returns `ActionResult<T>`.

### 10.4 Payments — Razorpay (full flow)
1. **Order creation** (`createPackagePurchaseOrder`/`createDemoSessionOrder`): guards against an existing active/awaiting-activation subscription; creates a Razorpay order (Orders API) AND a local `payments` row (`status='created'`) in the same call, before any money moves.
2. **Client-side checkout confirmation** (primary path): Razorpay Checkout hands back `orderId/paymentId/signature` → server verifies HMAC-SHA256 (never trusts the client) → on success, package purchase calls `purchaseMyPlan()` (creates subscription), demo calls `confirmDemoBooking()`. Idempotent (`status==='paid'` short-circuits). Signature invalid → `failed`. Fulfillment throws post-verification (e.g. race with another tab) → **`paid_unfulfilled`** — money captured, nothing provisioned, surfaced as a support-contact error, never silently dropped.
3. **Webhook reconciliation** (secondary/safety-net): Razorpay's own `payment.captured` server-to-server event, verified with a **different** secret/scheme than Checkout's (`RAZORPAY_WEBHOOK_SECRET`, HMAC over the raw body). No-ops if already `paid`; only does real work for the tab-closed/crashed case the client-side path can't cover. Demo-session fulfillment via webhook is dormant/unreachable (no current UI flow reaches a Razorpay-paid demo path).
4. **Refunds:** `logRefundRequest()` writes an **audit log entry + timeline event only** — it does **not** call Razorpay's refund API or move money. **This reconciles the apparent contradiction found by two independent research passes**: the admin UI's "Log Refund Request" copy says "no payment gateway exists," which is stale/misleading given purchases ARE real — but the underlying behavior (refunds are manual/ops-only, never automated) is accurate and should be replicated as-is in mobile: a refund request is a support ticket, not a self-service financial operation.

### 10.5 Third-party integrations
- **Zoom** (`zoom.service.ts`): Server-to-Server OAuth, **one shared business account** hosts every meeting (never per-coach). Meeting created lazily on first join attempt; settings `join_before_host:true`, `waiting_room:false`, `mute_upon_entry:true`. Deleted (best-effort) on cancel/reschedule; a reschedule always creates a fresh meeting rather than updating. **Without env configured, every call throws — Join becomes a styled no-op.**
- **Email** (`email.service.ts`, Resend): **fail-soft always** — broken config only logs a warning, never throws, since a notification failure must never break the flow that triggered it.
- **SMS/OTP** (`sms.service.ts`, MSG91): two separate APIs — Flow API for templated transactional SMS (DLT-registered per event, clients only, coaches never get SMS) and a separate OTP API for phone verification. Both fail-soft.
- **Session reminder cron:** queries `upcoming` bookings with `reminder_sent_at IS NULL` and start within a ±15-min window around exactly 6 hours out; emails both parties; stamps `reminder_sent_at` as the real dedup guard (not the window). Per-booking failures caught and logged, never abort the sweep.

### 10.6 Notification templates (all `notification_templates.key` values)
Booking/session: `booking_confirmed`, `booking_cancelled`, `session_reminder`, `session_booked_client/coach`, `demo_booked_client/coach`, `session_cancelled_by_client`, `session_rescheduled_by_client`, `session_cancelled_client`, `session_rescheduled_client`, `attendance_present_client/coach`, `attendance_absent_client/coach`, `attendance_overdue`, `notes_overdue`, `session_reminder_client/coach`.
Schedule/coach: `schedule_changed_client/coach`, `schedule_assigned_client/coach`, `coach_changed_client/coach`, `coach_change_approved`, `coach_change_request_approved_client`, `coach_change_request_rejected_client`, `new_client_assigned`, `client_transferred`, `admin_changed_schedule`, `recurring_schedule_unmatched`.
Leave/shadow: `leave_approved`, `leave_rejected`, `shadow_coach_assigned`, `shadow_assignment_for_coach`, `coach_on_leave_client`.
Plan/subscription: `plan_purchased_client`, `plan_activated_client`, `subscription_paused_client/coach`, `subscription_resumed_client/coach`.
Escalation/concern: `escalation_raised_to_coach`, `escalation_resolved_client`.
Chat: `new_chat_message`. Progress: `client_progress_updated`. System: `inactivity_warning`, `assessment_reminder`, `admin_alert`.
All use simple `{{var}}` regex interpolation — missing vars silently become empty string, no error.

### 10.7 Authorization/RLS summary
Helper functions (`is_admin()`, `my_role()`, `my_coach_id()`, `my_client_id()`, `coach_client_linked()`) are all `security definer` to avoid RLS self-recursion. Broad-read tables by design (any authenticated user — booking-conflict checks need system-wide visibility): `coach_profiles`, `coach_availability`, `coach_shifts`, `package_tiers` (active only), `bookings` (existence/timing only, content restricted). Widened further (migration 0033): any coach can read any `client_profiles`/`client_timeline_events` row — but `progress_logs` stays assigned-coach-only. Financial (`payments`) and append-only (`audit_logs`, `client_timeline_events`) tables have **no client/coach write policy at all**.

---

# 11. User Workflows

### 11.1 Signup → Purchase → Activate → Onboard → Schedule → First Session
1. Client signs up → lands on `/client/plans` (journey stage `marketing`).
2. Optionally books a free demo first — auto-matched coach, immediate confirmation, zero payment.
3. Selects a plan → Razorpay Checkout → server verifies signature → subscription created (`awaiting_activation`).
4. "Congratulations!" modal → dismiss → dashboard → auto-redirect to `/client/activate`.
5. Picks start date (≥tomorrow) → Confirm → subscription `active`.
6. Dashboard redirect → `/client/onboarding` → fills intake (weight+goal required) → Complete.
7. Dashboard redirect → `/client/schedule` → picks pattern/time (+coach if none yet) → Check Availability → Confirm → recurring slots created + upcoming bookings generated.
8. Dashboard now shows the full active view.
**Failure paths:** signature fails → error, no subscription, retryable. Signature succeeds but fulfillment throws → `paid_unfulfilled`, must contact support (no self-service recovery). Onboarding double-submit → rejected server-side. Schedule "no match" at every tier → "Notify Support," client left without a schedule until an admin manually resolves it — **no automatic waitlist/retry.**

### 11.2 Renewal (client already had a prior subscription)
1. Sessions-low gate (≤5 remaining) → "Renew Now" → `/client/plans`.
2. Purchase identical to first-time, but only permitted because the existing active sub's remaining ≤5 — otherwise hard-rejected.
3. Activate (pick start date) — old subscription retired to `inactive` at this step.
4. Dashboard redirect → `renewal_checkin` → fresh measurements (history preserved, weekly cap bypassed) → Continue.
5. Dashboard redirect → `renewal_scheduling` → "Keep training with {coach} at {days}?" → Keep (carries over exactly) or Change (full picker, Same/New trainer only, no "No preference").
6. Dashboard active again.

### 11.3 Cancel a Session
1. My Sessions → Upcoming → Cancel (disabled if within cutoff).
2. `ConfirmDialog` → confirm → RPC (cutoff enforced server-side unless admin).
3. Success: status→cancelled locally; Zoom deleted; coach notified + **all admins** alerted (client-initiated) or client notified with reason (coach/admin-initiated).
**Failure:** cutoff passed between page-load and click (race) → server rejects, inline error in dialog, session stays upcoming.

### 11.4 Reschedule a Session (3 alternate paths)
Common server-enforced preconditions regardless of path: ≤2 reschedules this calendar week, new time within 30 days and in the future, no other session already booked that IST day, ≥cutoff hours before the ORIGINAL start (bypassed only for admin).
- Path A: "Fastest Available" per-coach list → 1 click.
- Path B: browse own-coach's open-slot grid → select → confirm.
- Path C: exact date/time → "Check This Time" → confirm with own coach, or pick a one-off substitute if unavailable.
All converge on: delete old Zoom meeting (new one lazily created later), log timeline, notify client always, notify coach only if admin-initiated, notify coach+all-admins if client-initiated.

### 11.5 Coach Change
1. `/client/coach` → "Request Coach Change" → reason (+optional ratings) → submit → `pending`.
2. Admin reviews: (a) picks new coach directly → client's active slots + upcoming bookings immediately repointed, request `approved` with `new_coach_id` set, OR (b) approves with no coach chosen → request `approved`, client self-serves.
3. If (b): client picks days+time → "Find Available Coach" (excludes current coach) → match → confirm → old slots + their upcoming bookings CANCELLED, new pattern created.
4. If rejected: red banner, client keeps current coach, can raise a new request later.

### 11.6 Run a Session End-to-End (coach side)
1. Coach sees Today's Tasks row, Join disabled until within join window.
2. Join → `coach_joined_at` set; Zoom opens (or informational no-op if unconfigured).
3. Present/Late/Absent enabled only after scheduled end.
4. Present/Late → booking stays `upcoming`, "Add Notes" now available. Absent (+optional remark) → `missed` immediately, flow ends, no notes.
5. Notes form (Summary required) → Mark Completed → `workout_notes` inserted, booking → `completed`.
**Alternate:** backlog/previous-day sessions skip the "must have joined today" gate.
**Failures:** attendance before session end → server error; today's session without joining → server error; notes before attendance present/late → server error.

### 11.7 Approve Coach Leave (admin side)
1. Leave Requests → Approve.
2. System auto-cascades: for every active client of this coach whose sessions fall in the window, search shadow candidates per occurrence, auto-create assignments; uncovered occurrences flagged to all admins.
3. Also re-runs the search for any client this coach was themselves shadow-covering, if overlapping.
4. Inline result summary: auto-assigned list / needs-manual-assignment list / "no clients affected."

### 11.8 Resolve an Escalation (admin side)
1. Escalation Detail → **must** "Confirm I've Called the Client" first (hard server gate, blocks everything else).
2. Save Admin Assessment (issue type, fault — internal only, case summary).
3. Add Progress Notes (client-visible) as needed.
4. Mark In Progress (optional) → Mark Resolved & Close (resolution notes, client notified). **One-way — cannot reopen.**

### 11.9 Migrate an Existing Client (admin, "Add Client")
1. Admin fills name/email/temp password/plan/**sessions remaining (the actual balance to grant, not the package's full size)**/optional schedule.
2. If a schedule is picked, "Check Availability" must pass (with alternates offered if not) before submit unlocks.
3. Submit creates a real Auth user + client_profiles + active subscription + optional recurring slots, all in one action; timeline logged with a migration note.
4. Success screen shows credentials once ("won't be shown again").

---

# 12. Notifications & Error Handling

**There is no toast/snackbar system anywhere in the web app**, across all three portals and the marketing site. Every success/error surface is one of:
- An inline red-bordered banner under the relevant form/field (`bg-red-500/10`, identical pattern reused everywhere).
- A full-card/state swap (booking success screens, escalation "resolved" confirmation).
- `ConfirmDialog`'s own built-in error slot.
- Optimistic local state update (e.g. mark-notification-read) with no explicit success confirmation at all.

This is a genuine, deliberate design decision point for the mobile team (§15) — none of these mechanisms rely on auto-dismiss timing, so promoting them to native toasts/snackbars is safe from a functional-parity standpoint, but is a UX addition, not a straight port.

**Confirmation dialogs (`ConfirmDialog`, the app's one confirmation pattern)** are used for: Cancel session (client), Pause/Resume subscription (client + admin), Disable Coach (admin), Delete Package (admin). **Notably NOT used for:** Admin Sessions-list Cancel (immediate, no confirm, no reason), Escalation Resolve, Leave Reject, Coach-Change Reject (all fire immediately on click).

**In-app notifications** (full template list in §10.6) cover: booking lifecycle (booked/cancelled/rescheduled/reminders), attendance outcomes, overdue attendance/notes nudges to coaches, leave decisions, shadow-coach assignment, coach-change resolution, subscription pause/resume, escalation resolution, new chat messages, client progress updates, and generic admin alerts (uncovered shadow gaps, client-initiated cancellations).

**Explicit "contact support" dead-ends (not silently retryable):** `paid_unfulfilled` payment state (money captured, nothing provisioned); schedule "no match" after exhausting every fallback tier (mitigated by a self-service "Notify Support" button, but no automatic resolution or waitlist).

---

# 13. Search / Filter / Sorting Behavior

**Universal rule across the entire application:** every list/table's search and filter is **client-side, in-memory, over a fully pre-fetched dataset.** Case-insensitive substring match (`.includes()`), never exact/prefix-only, never a server `ilike` query. No debouncing anywhere. No pagination anywhere (no "N per page" control exists in any portal). No minimum query length.

**The two confirmed exceptions** (real server-side navigation, state survives refresh):
- Admin **Activity Log**'s entity-type filter (`?entityType=` query param).
- Admin **Availability Check**'s date picker (`?date=` query param).

| Portal | List | Search fields | Filters | Sort | Notes |
|---|---|---|---|---|---|
| Client | My Sessions | — | 5 status tabs (incl. derived "Rescheduled") | newest-first | — |
| Coach | Clients | name, clientCode | Status (7-way), Plan (dynamic), Day-of-week | server order | 4 filters AND together, no reset control |
| Coach | Global Search | name, clientCode | — | — | results only render once query non-empty |
| Coach | Chats | — | 4 category tabs | as returned | — |
| Admin | Clients | name, phone, clientCode | 7-way status pills | insertion order | **no empty-results message — a gap** |
| Admin | Coaches | name only | — | — | — |
| Admin | Sessions | — | Coach select, Status select | date desc (fixed) | — |
| Admin | Sales | name, code, package | — | as returned | live count+total ₹ of filtered set |
| Admin | Search | name, code, phone | — | — | empty query → hint text, no results shown |
| Admin | Activity Log | — | entity-type tabs (real nav) | — | only true server-side filter in the app |

---

# 14. Authentication & Session Behavior

*(Full detail; see §6.1 for the corresponding screens.)*

**Architecture:** Supabase Auth, cookie-based session (not localStorage) — required so both `middleware.ts` and Server Components can see it. Four client constructors (browser/server-component/request-scoped/admin) — see §2.

**Route protection:** `middleware.ts` matches only `/client|coach|admin/:path*`; verifies the JWT locally (no round trip); missing/wrong role → silent redirect to that portal's own login (no error shown at this layer — the login form's own post-signin role check is what surfaces an explanatory message).

**Role assignment on signup:** reads `raw_app_meta_data.role` (privileged-only), defaults to `client` if absent — **public signup, including Google OAuth, can only ever create client accounts.** Coach/Admin are exclusively ops-provisioned. (Full detail and the migration-0051 security-fix history in §3.)

**Login:** three near-identical screens sharing one `LoginForm`; on success, an explicit client-side check compares the account's actual role to the page's role and **signs the session back out** on mismatch, surfacing a clear error — this is what prevents an infinite "signing in..." loop that the middleware's silent redirect alone would otherwise cause.

**"Forgot password?" is rendered but has no handler — dead. No password-reset flow exists anywhere in the codebase.** Password *change* (while logged in) exists separately in Profile, on both client and coach portals, calling `supabase.auth.updateUser()` directly (bypasses the app's own server-action/audit layer).

**Google OAuth:** same button/call on every login+signup screen; Supabase doesn't distinguish "signup" from "login" for OAuth — the same call transparently creates or signs into an account. `/auth/callback` exchanges the code and redirects purely by the account's **actual** role, never by which of the three login pages initiated it (so an existing client clicking "Continue with Google" on the admin login page still lands in the client portal, not an error — and a brand-new Google account can never land as coach/admin since no such profile pre-exists to route into).

**Phone verification:** collected+OTP-verified at signup for manual accounts; Google OAuth signups never collect a phone at all, so a dedicated `PhoneGateModal` (client portal only) backfills it post-signup, blocking the portal until resolved (or skipped via the temporary bypass, §17).

**Session persistence:** cookie-based; no "Remember me" option; no client-side expiry countdown or idle-timeout UI. Refresh is handled transparently by `middleware.ts`.

**Logout:** one implementation (`PortalShell`), `signOut()` + redirect to `/`, no confirmation dialog.

---

# 15. Mobile Application Mapping

*(Web Screen → Mobile Screen → Mobile Navigation → Required Functionality. The goal is functional parity with mobile-native interaction patterns, not a visual port. Web-specific patterns explicitly NOT to be copied are called out.)*

## 15.1 Structural mapping decisions

| Web pattern | Mobile equivalent | Rationale |
|---|---|---|
| Collapsing sidebar drawer (only responsive pattern in the web app) | Native bottom tab bar (primary sections) + drawer/"More" screen for overflow items | Web's drawer-only pattern was never designed mobile-first; each portal has 10–17 nav items — too many for a bottom bar, so a hybrid (5-ish primary tabs + "More" sheet) is appropriate |
| Inline red-banner error/success text (no toast system exists) | Native toast/snackbar for transient success; inline banners retained for form-field validation errors and blocking states (gate modals, payment dead-ends) | Since nothing currently depends on auto-dismiss timing, promoting simple success confirmations to toasts is safe; keep blocking errors (paid_unfulfilled, schedule-no-match) as persistent, dismissible surfaces, not toasts, since the user must act on them |
| Full-screen non-dismissible gate modals (Phone/Measurement/SessionsLow) | Full-screen native modal/bottom-sheet flows, same trigger conditions and priority order | Functionally must be preserved exactly — these gate real business logic (booking/join blocking), not just UI nagging |
| 3-step client-side wizards (Signup, Book Session, Schedule Setup) | Native multi-step screens or a single scrollable stepper — either is fine as long as step-gating logic (e.g. OTP before proceeding, Weight+Goal required before Onboarding submit) is preserved exactly | — |
| Desktop data tables (Admin Clients/Coaches/Sessions/Sales/Activity Log) | Mobile list/cards, one row → one card, tap → detail screen | Straightforward web-table-to-mobile-list swap; preserve all displayed fields and the exact search/filter semantics (client-side substring, AND-composed) |
| Modals (`Modal`/`ConfirmDialog`) | Bottom sheets for short forms (leave request, log measurement); full-screen for longer forms (add client, add coach); native alert/action-sheet for `ConfirmDialog` equivalents | — |
| Week/day calendar grids (Coach Schedule, Admin Coach Detail 7-day view, Availability Check) | Native calendar/agenda list view; a 2D grid is a poor mobile fit — an agenda (chronological list grouped by day) preserves the same information more usably | Preserve every cell's information (client name, status, reschedule indicator) in the agenda-row equivalent |
| Recharts line/bar charts (Dashboard trends, MeasurementChart) | Native mobile charting library equivalent, same metrics/axes/thresholds (e.g. "≥2 points to render a trend line") | — |
| Landing page (marketing site) | App store listing + a lightweight in-app "About/Plans" screen, OR a WebView fallback to the existing marketing site if the business wants full parity of marketing copy | The landing page is not a portal screen — decide with the business whether the mobile app needs its own native marketing surface or just deep-links out to the existing site for pre-signup browsing |

## 15.2 Screen-by-screen mapping (abbreviated — full functional requirement for each is in §6)

| Web Screen | Mobile Screen | Mobile Navigation | Required Functionality |
|---|---|---|---|
| `/login/{role}` × 3 | Role-aware single login screen, or 3 entry points from a role picker | Auth stack (pre-tab-bar) | Exact same fields/validation/role-mismatch-signout logic; **do not build a working "forgot password" unless the business wants to add it now — it doesn't exist in web either** |
| `/signup` | Native multi-step signup | Auth stack | Same 3-step gating (form→email OTP→phone OTP), same regex/length validation, same temporary skip-phone bypass (flag to product: is this still needed, or was it web-only demo scaffolding?) |
| `/client/dashboard` | Client Home tab | Bottom tab: Home | Exact journey-state-machine redirect logic (§6.2) is the single most important thing to replicate — get this wrong and users get stuck |
| `/client/sessions` | Sessions tab | Bottom tab: Sessions | 5 status filters, cancel/reschedule/rate actions with identical cutoff/limit rules |
| `/client/schedule`, `/client/book` | Booking flow (native stepper) | Reachable from Home CTA or a Book tab (hide once schedule exists, same as web) | Full pattern-matching fallback ladder, "Notify Support" no-match path |
| `/client/chats`, `/coach/chats` | Chats tab | Bottom tab: Chats (conditionally shown for client, matching web) | Active/closed conversation distinction, read-only history preservation, category tabs (coach side) |
| `/client/coach` | My Coach screen | From Home or a dedicated tab | Full coach-change request state machine (raise/pending/rejected/approved-needs-completion/complete) |
| `/client/concerns` | Concerns/Support screen | Menu/More | Same category enum, same read-only-after-raise behavior |
| `/client/profile`, `/coach/profile` | Profile tab | Bottom tab: Profile | Same editable-vs-admin-owned field split; separate Change Password flow |
| `/client/progress` | Progress tab | Bottom tab: Progress | Same weekly-cap logic, same 8-metric set, same chart-if-≥1-log rule |
| `/coach/session/[id]` | In-Session screen | Pushed from Today's Tasks | Exact 2-step gate (join→attendance→notes), same today-vs-backlog join-requirement distinction |
| `/coach/availability` | Availability screen | Coach tab | Read-only hours (do not build a coach-editable hours screen — that would be a functionality *addition*, not parity, since web explicitly removed coach write access in migration 0045) |
| Admin's 23 screens | Admin console — recommend as a responsive/tablet-first section of the mobile app or a separate admin app, NOT a phone-first redesign | Own nav structure | Every CRUD flow in §6.4 must be preserved; admin's data-density (7-day calendars, audit diffs, multi-field forms) is a poor fit for a phone form-factor — flag this to the business as a design conversation, not a silent scope cut |

## 15.3 Explicit non-goals for the mobile port

- Do **not** build a coach-editable working-hours screen (web explicitly locked this to admin-only).
- Do **not** resurrect the dormant paid-demo-session flow (`DEMO_SESSION_FEE`) unless the business asks — it's unreachable in current web.
- Do **not** build a real "forgot password" flow believing it already exists in web — it doesn't; treat this as a net-new feature decision, not a port.
- Do **not** treat the landing page's hardcoded coach roster as real data — use the portal-side coach service/components as the source of truth for how coaches should display.
- Do **not** silently drop the temporary phone-OTP-skip bypass without flagging it to product — it's explicitly marked temporary in the web code (pending MSG91 KYC) and its permanence in mobile should be a deliberate decision, not an accident of copying code.

---

# 16. Web-to-Mobile Feature Parity Matrix

*(Every distinct feature from §5's inventory, condensed to a checklist. "Same Logic Required" = the exact business rule/formula from §8 must be replicated, not just the UI shape.)*

| # | Web Functionality | Mobile Equivalent | Same Logic Required | Status |
|---|---|---|---|---|
| 1 | Signup (3-step, email+phone OTP) | Native multi-step signup | Yes — regex/length validation, role-always-client | Must port |
| 2 | Login ×3 roles + role-mismatch signout | Unified/role-routed login | Yes — exact mismatch handling | Must port |
| 3 | Google OAuth | Native OAuth (or web-view OAuth) | Yes — role-by-account, not by-clicked-screen | Must port |
| 4 | Forgot password | — | N/A | **Does not exist in web — decide as new scope, don't silently invent or silently omit without a decision** |
| 5 | Phone gate (Google signups) | Full-screen gate flow | Yes — priority order vs. other gates | Must port |
| 6 | Client journey state machine | Same redirect logic | **Yes — critical, exact stage list** | Must port |
| 7 | Measurement staleness gate | Same 7-day rule | Yes | Must port |
| 8 | Sessions-low nudge | Same 5-session threshold | Yes | Must port |
| 9 | Onboarding intake (one-time) | Same form, same lock-after-submit | Yes | Must port |
| 10 | Ad-hoc/assessment booking wizard | Native stepper | Yes — assessment-vs-regular type logic | Must port |
| 11 | Demo booking (auto-match, no confirm) | Same auto-match | Yes — utilization-based ranking | Must port |
| 12 | Plan purchase (Razorpay) | Native Razorpay SDK checkout | **Yes — server-side signature verify, paid_unfulfilled handling** | Must port |
| 13 | Plan activation (start date) | Same form | Yes — one-time, IST same-day block | Must port |
| 14 | Recurring schedule setup/change/renewal-keep | Native stepper | **Yes — full fallback ladder** | Must port |
| 15 | My Sessions list + cancel/reschedule/rate | List + actions | **Yes — cutoffs, weekly reschedule cap, account-wide rating cap** | Must port |
| 16 | My Coach + coach-change request | Screen + flow | Yes — full request state machine | Must port |
| 17 | Concerns/escalation raising | Form + list | Yes — category enum, read-only-after | Must port |
| 18 | Chat (client↔coach) | Native chat UI | Yes — active/closed distinction, read receipts | Must port |
| 19 | Notifications inbox | Native list | Yes | Must port |
| 20 | Profile edit + change password | Screen | Yes | Must port |
| 21 | Progress log + history + chart | Screen | Yes — weekly cap, ≥2-point chart rule | Must port |
| 22 | Subscription view + pause/resume | Screen | Yes | Must port |
| 23 | Coach dashboard KPIs | Screen | Yes — all 7 formulas | Must port |
| 24 | Coach availability (read-only) + leave request | Screen + form | **Yes — 24h IST notice rule, no bypass** | Must port |
| 25 | Coach schedule day/week view | Agenda view | Yes | Must port (redesign grid→agenda) |
| 26 | Coach in-session workflow | Screen | **Yes — exact join/attendance/notes gate sequence** | Must port |
| 27 | Coach clients roster + detail | List + detail | Yes — assigned-vs-readonly distinction | Must port |
| 28 | Coach escalations (read-only) | List | Yes — no action surface | Must port |
| 29 | Coach performance | Screen | Yes — all 5 formulas | Must port |
| 30 | Coach profile (narrow edit + skills append-only) | Screen | Yes — append-only enforcement | Must port |
| 31 | Coach renewals | List | Yes | Must port |
| 32 | Coach global search | Screen | Yes — RLS-widened read model | Must port |
| 33 | Coach chats (4 categories) | Native chat UI | Yes | Must port |
| 34 | Admin dashboard KPIs | Screen (tablet-first recommended) | Yes — all formulas incl. Renewal Rate null-handling | Must port |
| 35 | Admin client CRUD + migration flow | Screens | **Yes — availability-check gate before submit** | Must port |
| 36 | Admin client detail manual controls (7 actions) | Screen | Yes — each control's own validation/side-effects | Must port |
| 37 | Admin coach CRUD | Screens | Yes — DB-trigger workaround is backend-only, no UI implication | Must port |
| 38 | Admin coach detail controls (block/reassign/disable) | Screen | **Yes — block-slot does NOT cascade shadow coverage; reassign is failure-tolerant** | Must port |
| 39 | Coach change request resolution | Screen | Yes — direct-vs-deferred approve paths | Must port |
| 40 | Leave request resolution | Screen | **Yes — full shadow-cascade side effect** | Must port |
| 41 | Escalation detail resolution workflow | Screen | **Yes — hard called-client gate, one-way resolve** | Must port |
| 42 | Sales list | Screen | Yes | Must port |
| 43 | Scheduling grouped overview | Screen | Yes (redesign to mobile-friendly grouping) | Must port |
| 44 | Availability check (day view) | Agenda view | Yes | Must port |
| 45 | Shadow coverage queue | List | Yes — derived-live, no manual sync needed | Must port |
| 46 | Renewal opportunities (admin) | List | Yes | Must port |
| 47 | Reports (5 canned CSV/PDF) | Screen w/ share-sheet export | Yes — same 5 report definitions | Must port |
| 48 | Settings (cutoffs/durations/packages) | Screen | **Yes — non-atomic 4-slider save behavior should be fixed, not replicated, unless product wants it kept** | Should port, flagged for improvement |
| 49 | Global search (admin) | Screen | Yes | Must port |
| 50 | Sessions master list + admin cancel/reschedule | List + actions | Yes — admin cutoff-bypass | Must port |
| 51 | Session detail (admin read-only) | Screen | Yes | Must port |
| 52 | Activity log (audit trail) | Screen | Yes — only true server-filtered list in the app | Must port |
| 53 | Admin notifications | Screen | Yes | Must port |
| 54 | Landing/marketing page | App-store listing + optional lightweight in-app screen | No (marketing content, not business logic) | Discuss scope with business |
| 55 | Toast/snackbar system | Native toasts for success; inline for blocking errors | No — this is a **deliberate UX upgrade opportunity**, web has no such system to port | New scope, not parity |

---

# 17. Hidden / Non-Obvious Functionality

*(Consolidated from all research passes — things easy to miss from a surface read of the UI.)*

**Auth/Shared**
- "Forgot password?" is a fully dead button — no handler, no reset flow exists anywhere.
- The "Email or Phone" login label is misleading — only email actually authenticates.
- Landing-page coach roster is 100% hardcoded fake data, disconnected from the real coach table.
- No global toast system anywhere — confirmed independently by all five research passes across all three portals.
- Signup's `role:"client"` passed via `user_metadata` is inert — the real trigger reads `app_metadata` only.
- Coach/Admin accounts cannot be created through any public-facing flow, by design.
- `router.refresh()` (not local state) is what closes `PhoneGateModal` — it re-runs the server-side profile fetch.
- The logo's `mix-blend-screen` CSS means it's dark-background-only — needs a different asset for a light mobile theme.

**Client Portal**
- The Measurement gate's "Skip" only closes the modal — booking/join stay blocked by independent server-side checks regardless.
- `/client/book` becomes unreachable (nav hidden + server redirect) the moment a plan is active.
- Shadow-coach badges on session cards are computed client-side per row (date-range match), not a stored flag.
- The session-rating 7-day cap is account-wide, not per-booking.
- Reschedule-count-this-week is derived from the audit/timeline log, not a stored counter.
- Zoom links are created lazily on first "ensure" call, not at booking time — and failures are swallowed silently.
- Confirming a schedule setup **immediately generates real bookings**, not just a preference row.
- Sunday is unconditionally excluded from every custom day-picker, hardcoded, not a system setting.
- The dormant paid-demo Razorpay code path (`DEMO_SESSION_FEE`) is unreachable from any current UI.

**Coach Portal**
- Zoom join is best-effort and silently degrades — Join still "works" (marks joined) with zero Zoom configuration.
- Any coach can view (read-only) ANY client platform-wide via Global Search — deliberate RLS design, not a bug.
- Coach skills are append-only in the coach's own UI — only admin can remove one.
- Password change bypasses the app's own server-action/audit layer entirely.
- `CoachPendingTasksGateModal`'s "Skip for now" has no persisted dismissal — reappears every login.
- The `coach_joined_at` join-requirement gate only applies to **today's** sessions — backlog sessions skip it.
- A coach on leave who was *also* covering someone else as a shadow gets an automatic second re-shadow-search pass.

**Admin Portal**
- Refund logging is a pure audit-trail stub, never touches Razorpay's refund API (see §10.4 reconciliation).
- Admin bypasses cutoff-hour rules entirely for cancel/reschedule.
- Package deletion is always soft — no hard delete path exists.
- Coach-account creation silently discards a `client_profiles` row created as an unavoidable DB-trigger side effect.
- "Reassign Clients" is partial-failure-tolerant (an explicit fix over the old all-or-nothing prototype behavior).
- Escalation resolution is a one-way door — no reopen action exists in the UI.
- Leave approval can silently generate several shadow assignments + notifications from one click, no per-client confirmation.
- "Block Slot" does **not** trigger the same shadow-coverage cascade a real Leave approval does.
- Admin Sessions-list Cancel has no confirmation dialog and no reason field — a single click cancels immediately.
- Settings' 4-slider Save is not atomic — a partial failure can leave some settings saved, others not, with only the first error surfaced.

**Backend**
- No cron infrastructure exists for scheduling maintenance (missed/overdue sweeps) — everything runs opportunistically on read/write, meaning a portal that's never opened can show stale state indefinitely.
- The one cron that does exist (session reminders) has no confirmed trigger mechanism in this repo.
- A stale 5-argument RPC overload for `confirm_booking` existed and bypassed the credit check until explicitly dropped in migration 0053 — a cautionary tale for any future multi-signature RPC changes.
- `notifications.channels` is a completely unused placeholder column.
- Legacy `bookings.rating`/`client_feedback` columns still exist but nothing writes to them anymore.
- `coach_availability` write access was revoked from coaches (migration 0045) — worth double-checking no residual coach-facing edit UI exists anywhere.

---

# 18. Edge Cases

- **Race condition on cancel/reschedule cutoff:** the cutoff check happens both client-side (button disabled state) and server-side (RPC re-check); if the cutoff passes in the gap between page load and click, the server rejects and the UI must handle this as a normal error, not a crash.
- **`paid_unfulfilled` payment state:** money captured by Razorpay, but subscription/booking never created (e.g., a second tab already completed the same purchase in the interim). No self-service recovery — mobile must surface a clear "contact support with reference {orderId}" path, matching web.
- **Schedule "no match" after exhausting every fallback tier:** client is left with no schedule until an admin manually resolves it; there's no automatic waitlist or retry — mobile's "Notify Support" action is the only self-service recourse, same as web.
- **`subscription_usage_view.sessions_remaining` vs. the actual booking-credit gate** can disagree — the view counts only `completed` bookings, the gate counts `upcoming+completed`. Don't assume the number displayed to a client is exactly what a new booking attempt will be checked against.
- **IST vs. UTC inconsistency in two dashboard views:** `coach_utilization_view`'s week boundary and `bookings_by_hour_view`'s hour grouping use server/UTC time, while virtually all other scheduling logic explicitly converts through Asia/Kolkata. Numbers on these two specific admin dashboard widgets could shift by several hours around midnight IST relative to actual local business hours — treat as a known discrepancy to either replicate faithfully (for consistency with the web dashboard) or fix (flag the decision to product, don't silently pick one).
- **`sales_view` reads the package's current price, not a sale-time snapshot** — a price change retroactively alters historical revenue figures shown in this view. Whether this is accepted business behavior or an unnoticed gap is unverified; flag to product before building a mobile Sales/Revenue screen that might expose the same drift.
- **Partial-day coach leave only affects sessions inside the specified time window** on a single date — sessions on that date outside the window are untouched and not reconsidered for shadow coverage.
- **A client's chat history with a past (reassigned-away) coach is frozen read-only forever**, never merged or deleted — mobile must preserve this permanently-archived, non-deletable thread behavior.
- **Session-type/duration hardcoding at the ad-hoc-booking call site** (45/60 min) rather than reading the admin-configurable `system_settings` duration values at that specific point — a possible drift between what admin configures in Settings and what actually gets booked for a first-time client. Flag to product; don't silently "fix" without confirming intent, since replicating the current behavior exactly is safer for parity unless told otherwise.
- **Renewal Rate % is `null` (not `0%`) when zero clients are currently flagged as a renewal opportunity** — a UI must distinguish "no data" from "everyone renewed," same as web's "—" display.
- **Escalation `fault` classification is never shown to the client or coach** — purely internal; a mobile admin console must keep this field admin-only, not accidentally surface it via a shared component reused from the client/coach side.

---

# 19. Open Questions / Unknown Behavior

*(Everything flagged as unverifiable from code alone across all five research passes. Resolve these with the LEANR team or by inspecting the live Supabase dashboard before finalizing mobile behavior that depends on them.)*

1. **Is `/api/cron/session-reminders` actually invoked by anything in production?** Neither `vercel.json` nor `netlify.toml` has a scheduled-trigger config for it; it may be set up directly in a hosting dashboard outside this repo, or it may be effectively dead/manual-only.
2. **Is Supabase's "Confirm email" setting actually enabled in production** (determines whether the signup email-OTP step is ever reached in practice)? Dashboard-only setting, not in code/migrations.
3. **Is the Custom Access Token Hook (migration 0054) actually enabled in the Supabase dashboard?** Code handles both cases correctly either way, but which path executes per-request is unknown from code alone.
4. **Does `JoinCountdown`'s hardcoded 10-minute window actually read `system_settings.join_window_minutes`, or is it fully independent of that setting?** If independent, changing the admin setting would silently do nothing to the client/coach Join button behavior.
5. **Does `adjustSubscriptionSessions` (admin "Adjust Package/Sessions") validate `newTotal ≥ 1` server-side**, or does only the admin UI's own gate prevent an invalid value?
6. **Exact SQL for `coach_utilization_view.utilization_pct`** was not read in full by any research pass — the IST-vs-UTC edge case (§18) should be confirmed directly against this view's definition before mobile relies on it.
7. **Is `attendance.coach_joined_at`/`client_joined_at`/`client_left_at`/`coach_left_at` written by any current code path**, or are these columns vestigial (the real join-gate logic writes to `bookings.coach_joined_at` instead)?
8. **Full `ConversationCategory` derivation rule** (Active/Old/Expired/Pause tabs in coach chat) was not fully traced — likely correlates with the client status derivation (§8.6) but this wasn't confirmed line-by-line.
9. **Rate limiting on login attempts, OTP resend, or signup** beyond MSG91's own server-side OTP limits and a trivially-bypassable 30-second client-side cooldown — no app-level throttle was found.
10. **`RenewalOpportunitiesClient`'s exact admin-vs-coach `role` prop behavior differences** (shared component) were not read in full by any pass.
11. **Whether "Block Slot" (admin coach detail) genuinely never triggers the shadow-coverage cascade** is a strong code-structure inference, not a fully traced confirmation — worth a direct second read of `createOneDayLeave` vs. `resolveLeave` before finalizing mobile's version of this feature.

---

# 20. Final Mobile Development Checklist

## 20.1 Foundational (build first — everything else depends on these)
- [ ] Client journey state machine (§6.2, §11.1) — exact stage list and redirect targets
- [ ] Auth: signup (3-step), login ×3 roles + role-mismatch handling, Google OAuth, phone gate
- [ ] `ActionResult<T>`-equivalent error handling convention (never surface raw backend errors)
- [ ] Role-based navigation shell (bottom tabs + overflow) per §15.1
- [ ] All `system_settings`-driven values fetched live, never hardcoded client-side (§8.1)

## 20.2 Client Portal
- [ ] Dashboard (journey redirect, progress ring, next-session Join logic, streak/delta calculations)
- [ ] Activate Plan, Onboarding (one-time lock), Renewal Check-in
- [ ] Book a Session wizard (assessment-vs-regular logic), Demo Booking (auto-match, no confirm step)
- [ ] Plans + Razorpay purchase flow (order→checkout→server-verify→`paid_unfulfilled` handling)
- [ ] My Schedule (pattern/time picker, fallback ladder, immediate booking generation)
- [ ] My Sessions (5 filters, cancel/reschedule ×3 paths/rate, all cutoffs and caps exact)
- [ ] My Coach + Coach Change request state machine
- [ ] My Concerns (raise + read-only tracking)
- [ ] Chats (active/closed distinction)
- [ ] Notifications inbox
- [ ] Profile (edit + change password), Progress (weekly cap + chart + history)
- [ ] Subscription (view/pause/resume)
- [ ] All 3 gate modals (Phone/Measurement/SessionsLow), correct priority order

## 20.3 Coach Portal
- [ ] Dashboard (7 KPIs, Today's/Pending Tasks, Cancelled/Rescheduled feeds)
- [ ] Availability (read-only) + Leave Request (24h IST notice, full-day/partial)
- [ ] Schedule (agenda redesign of day/week grid)
- [ ] Session Detail (join→attendance→notes gate sequence, today-vs-backlog distinction)
- [ ] Clients roster + detail (assigned-vs-readonly distinction)
- [ ] Escalations (strictly read-only)
- [ ] Performance (13 stats + activity timeline)
- [ ] Profile (narrow edit, append-only skills, separate password change)
- [ ] Renewals, Global Search, Chats (4 categories)

## 20.4 Admin Portal (recommend tablet-first or a companion admin app given data density)
- [ ] Dashboard (12 KPIs incl. null-vs-zero Renewal Rate handling)
- [ ] Clients: list, migration-flow creation (with availability-check gate), full detail + 7 manual controls
- [ ] Coaches: list, creation (weekly-slots form), full detail + block/reassign/disable
- [ ] Coach Change Requests: direct vs. deferred approve, reject
- [ ] Leave Requests: approve (full shadow-cascade side effect) vs. reject
- [ ] Escalations: hard called-client gate, one-way resolve workflow
- [ ] Sales, Scheduling overview, Availability Check (agenda), Shadow Coverage queue, Renewal Opportunities
- [ ] Reports (5 canned CSV/PDF exports)
- [ ] Settings (cutoffs/duration/inactivity sliders, package CRUD — consider fixing the non-atomic save)
- [ ] Search, Sessions master list + admin cancel/reschedule (cutoff-exempt), Session Detail
- [ ] Activity Log (only true server-filtered list — preserve as real navigation, not client state)
- [ ] Notifications

## 20.5 Cross-cutting / do-not-skip
- [ ] Every business-logic formula in §8 replicated exactly (not approximated) — especially: booking credit check, cutoff enforcement, shadow-coach scoring, client status derivation, rating caps, pause-days derivation
- [ ] Every notification template trigger in §10.6 wired to the equivalent mobile event
- [ ] Zoom/Razorpay/MSG91/Resend integration behavior (fail-soft where web is fail-soft; hard-fail where web hard-fails — don't invert either)
- [ ] Resolve or explicitly carry forward the open questions in §19 with the LEANR team before shipping
- [ ] Confirm with product whether the temporary phone-OTP-skip bypass should exist in mobile at all
- [ ] Confirm with product whether "Forgot password" should finally be built for mobile (it doesn't exist in web)
- [ ] Decide and document a toast/snackbar strategy (net-new UX, not a port) — §12, §15.1
- [ ] Sign off using §16's parity matrix, row by row, before considering the mobile app functionally complete

# CLIENT PORTAL — WEB APPLICATION COMPLETE WORKFLOW & BUSINESS LOGIC DOCUMENTATION

**Application:** LEANR by Fitelo — 1:1 live personal-training platform (Client, Coach, Admin portals)
**Scope of this document:** the **Client Portal** only (`src/app/client/**`), including every server action, service, database table, and cross-portal effect (Coach/Admin actions) that changes what a client sees or can do.
**Audit basis:** direct inspection of the live source tree — `src/app/client/**`, `src/components/client/**`, `src/lib/actions/*.actions.ts`, `src/lib/services/*.service.ts`, `supabase/migrations/*.sql` (57 migrations), `src/middleware.ts`, `src/app/api/**`. No prior documentation (including this repo's own `docs/CLIENT_PORTAL_MOBILE_SPEC.md` and `README.md`, both of which predate or diverge from the current implementation in places) was taken as ground truth — every claim below was independently re-derived from code and cross-checked against a second pass. Claims are marked **Observed** (read directly, cited by file), **Inferred** (derived, reasoning shown), or **UNKNOWN — REQUIRES VERIFICATION**.
**Purpose:** this document is intended as an independent source of truth for the WEB client portal, to be diffed against a separate APP (mobile) audit. It does not assume the web implementation is correct, does not withhold observed defects to make the two audits agree, and does not speculate about the APP.

---

## Table of Contents
1. Executive Summary
2. Scope & Methodology
3. Complete Client Portal Feature Discovery
4. Client Lifecycle & States
5. Pre-Purchase Workflows
6. Purchase/Conversion Workflows
7. Post-Purchase Workflows
8. Complete Business Logic
9. State Transition Map
10. Database / Data Model
11. API & Service Architecture
12. Authentication & Authorization
13. Navigation & Route Map
14. Events & Notifications
15. Integrations
16. Workflow Dependencies
17. Edge Cases & Error Handling
18. Current Implementation Issues
19. Inconsistencies
20. Missing / Incomplete Functionality
21. Unknowns / Requires Verification
22. Complete End-to-End Client Lifecycle
23. Master Functionality Inventory
24. Master Workflow Inventory
25. Master Business Rules Inventory
26. Master Issue Inventory

---

## 1. Executive Summary

LEANR's Client Portal is not a content-delivery or self-serve fitness app — it is the client-facing half of a **live, coach-mediated coaching service**. The only "product" a client consumes is: (a) a bucket of purchased **session credits** (`subscriptions.sessions_total`, never a calendar duration), (b) **live 1:1 video sessions** delivered over Zoom with a matched human coach, (c) **coach-authored session notes** (one free-text field visible to the client), and (d) **client-authored weekly measurement logs**. There is no diet/meal-plan/nutrition module, no self-guided workout library, no coupons/discounts, no refunds, and no plan cancellation (only pause) anywhere in the schema or code.

Every top-level client page is governed by one server-derived, request-fresh state machine, `ClientJourneyStage` (`src/lib/actions/client-journey.actions.ts:getMyJourneyStateAction`), which is re-evaluated on every page load with no client-side caching. This single function is the de facto router for the entire portal: it decides whether a client sees the dashboard, gets redirected to checkout, activation, onboarding, renewal check-in, renewal scheduling, or slot selection. Independently of this routing state machine, three cross-cutting **blocking gate modals** are layered onto every `/client/*` page by the shared portal layout (`src/app/client/layout.tsx`), evaluated in strict precedence order and mutually exclusive (only one rendered at a time): **phone missing → measurements stale (≥7 days) → sessions low (≤5 remaining)**.

Commerce is **session-count-based, not calendar-based**. A `subscriptions` row never expires by date; "expired" is a UI-only derived label (`src/lib/client-status.ts`) for a client who has purchase history but no row currently `active`/`paused`/`awaiting_activation`. Reaching 0 sessions remaining does not itself change any stored status.

Money is handled with a strict trust boundary: the client's own claim of payment success is **never** trusted. The only two paths that create a paid subscription are (1) server-side HMAC signature verification of the Razorpay checkout callback, and (2) a Razorpay webhook reconciling the same order server-to-server. Every other client-facing money-adjacent action (pause days, sessions remaining, payment history) is a **read-only derived view**, never a second source of truth for entitlement.

This document catalogs 19 client-reachable route groups, ~30 distinct client-facing workflows, ~45 explicit business rules, 21 relevant database entities, and identifies 11 concrete implementation issues (ranging from a security-relevant "temporary" OTP bypass to silent under-delivery of generated sessions) — detailed in §18–§21 and tabulated in §26.

## 2. Scope & Methodology

**In scope:** every route under `src/app/client/**`; every component under `src/components/client/**`; every server action and service function reachable from those routes (`src/lib/actions/*.actions.ts`, `src/lib/services/*.service.ts`); every Postgres table/view/function/RLS policy those touch (`supabase/migrations/*.sql`, 57 files); `src/middleware.ts`; the two client-relevant HTTP routes under `src/app/api/**` (Razorpay webhook, session-reminders cron). Admin and Coach portal code is referenced only where it produces a state change or artifact the client consumes (e.g., a coach marking attendance, an admin resolving a coach-change request or escalation).

**Out of scope:** Coach Portal and Admin Portal UI/workflows in their own right; infrastructure/deployment configuration; anything gated by an external dashboard setting not visible in code (e.g., whether Supabase "Confirm email" is toggled on in production — flagged as unknown where relevant).

**Method:** static reading of the full call chain for every route — `page.tsx` (server component: auth, data fetch, stage-gate redirect) → `*Client.tsx` (client component: forms/interaction/local state) → `*.actions.ts` (`"use server"`: token check, input validation, calls service, wraps in `ActionResult`) → `*.service.ts` (Supabase queries/writes; RLS-scoped client or `supabaseAdmin` for privileged writes) → Postgres (tables, views, RPC functions, RLS policies, triggers). Business-rule claims were cross-verified by re-reading the underlying migration or RPC function directly (not just the calling action), and load-bearing claims (journey-stage logic, portal-wide gates, threshold constants, DB enums, middleware) were independently re-confirmed against the live source during this pass (cited inline).

**Stack (Observed):** Next.js 14 App Router; Supabase (Postgres + Auth + Storage + Realtime); Razorpay (Orders API + Checkout.js + webhook); Zoom Server-to-Server OAuth (meeting creation); Resend (email); MSG91 (SMS/OTP, India DLT-gated). No independent public REST/GraphQL API exists — all business logic is invoked via Next.js Server Actions, callable only from this app's own client bundle (§11).

## 3. Complete Client Portal Feature Discovery

### 3.1 Route inventory (`src/app/client/**`, Observed)

| Route | Component | Reachability |
|---|---|---|
| `/client/dashboard` | `DashboardClient` (via `page.tsx`) | Hard redirect target; only renders in `active`-adjacent stages |
| `/client/plans` | `PlansMarketingClient` | No nav entry; reached via CTA / `marketing` stage redirect |
| `/client/demo-booking` | `DemoBookingClient` | No nav entry; reached via CTA from Plans/Dashboard |
| `/client/activate` | `ActivatePlanClient` | Stage-gated (`awaiting_activation` only); no nav entry |
| `/client/onboarding` | `OnboardingFormClient` | Stage-gated (`onboarding` only); no nav entry |
| `/client/renewal-checkin` | `RenewalCheckinClient` | Stage-gated (`renewal_checkin` only, renewal clients only); no nav entry |
| `/client/sessions` | `MySessionsClient` | Nav: "My Sessions" |
| `/client/book` | `BookSessionClient` | Nav: "Book a Session" (hidden once subscribed); redirects to `/client/schedule` if a subscription id exists |
| `/client/schedule` | `ScheduleSetupClient` / `ChangeScheduleClient` | Nav: "My Schedule"; also stage-gate target for `slot_selection`/`renewal_scheduling` |
| `/client/subscription` | `MySubscriptionClient` | Nav: "Subscription" |
| `/client/coach` | `MyCoachClient` | Nav: "My Coach" |
| `/client/chats` | `ClientChatsClient` | Nav: "My Chats" (hidden until ≥1 conversation exists) |
| `/client/progress` | `ProgressClient` | Nav: "Progress" |
| `/client/concerns` | `MyConcernsClient` | Nav: "My Concerns" |
| `/client/notifications` | `NotificationsClient` | Nav: "Notifications" |
| `/client/profile` | `ClientProfileClient` | Nav: "Profile" |
| `/signup` | `SignupForm` | Public (visitor only) |
| `/login/client` | `LoginForm` | Public |
| `/auth/callback` | Google OAuth exchange handler | Public (redirect target from OAuth provider) |

Cross-cutting, non-route overlays rendered on **every** `/client/*` page by `src/app/client/layout.tsx` (Observed, re-verified this pass): `PhoneGateModal`, `MeasurementGateModal`, `SessionsLowGateModal` — see §4.4 and §8 for precedence and business rule.

### 3.2 Non-obvious functionality discovered beyond the visible nav

- **Demo/assessment booking system** — a parallel, no-payment booking flow (`demoBooking.service.ts`) sharing the coach-matching engine but bypassing Razorpay and subscription checks entirely.
- **Shadow coaching** — a temporary coach-substitution mechanism (coach on approved leave) that surfaces a one-time acknowledgeable banner on the client's session list; not reachable via any client action, only produced by admin-side leave approval.
- **Coach-change request lifecycle** with a "fast path" (admin picks replacement immediately) and a "needs completion" path (client picks new day/time and the system re-runs coach matching), each with distinct client-visible banner states.
- **Renewal-specific journey branches** (`renewal_checkin`, `renewal_scheduling`) that only exist for clients who have had a prior subscription — invisible to first-time clients entirely, and skip the normal once-a-week progress-log rate limit.
- **A dormant/unreachable code path**: `createDemoSessionOrder` in `payments.service.ts` — a Razorpay order-creation function for a *paid* demo, never called from any current UI (demo booking is unconditionally free). Classified in §18 as DEAD/UNUSED.
- **A vestigial schema column**: `notifications.channels` (jsonb) — present in the schema "for a future dispatcher," read/written by no code path found.
- **A vestigial schema column**: `progress_logs.photo_url` — exists, but no client UI writes it (no progress-photo upload feature is implemented).
- **A background sweep with no cron**: `mark_missed_bookings()`, a Postgres RPC invoked opportunistically on every booking-list read (dashboard, sessions page), not on a schedule — flips `upcoming` bookings whose time has passed with no attendance marked to `missed`.
- **One genuinely time-triggered process**: `/api/cron/session-reminders` (CRON_SECRET-protected), emailing client + coach ~6h before a session, deduped via `reminder_sent_at`.
- **Server-side "coach session-join gate"** (`bookings.coach_joined_at`, migration `0047`) — gates when a *coach* can mark attendance; has no client-facing effect but shares the same `bookings` row the client's join button reads.
- **`ClientStatus`** (`src/lib/client-status.ts`) — a second, staff-facing 6-bucket derived status label, computed independently of `ClientJourneyStage`, never shown to the client directly but worth documenting because it is a second, parallel implementation of "what state is this client in" (see §19 inconsistency).

## 4. Client Lifecycle & States

The implementation contains **two independent, overlapping state models**, plus one raw DB enum. All three must be documented because different parts of the codebase consult different ones.

### 4.1 `ClientJourneyStage` — the routing state machine (Observed, `client-journey.actions.ts:getMyJourneyStateAction`, re-read in full this pass)

Nine states: `marketing`, `demo_booked`, `demo_completed`, `awaiting_activation`, `onboarding`, `renewal_checkin`, `renewal_scheduling`, `slot_selection`, `active`.

**Exact evaluation order (first match wins), as implemented:**
```
1. Fetch latest subscription row for this client (getMyLatestSubscription).
2. IF a subscription row exists:
   a. IF status == 'awaiting_activation'  → STAGE = awaiting_activation.  [STOP]
   b. IF status == 'active':
        i.   IF no client_onboarding row exists       → STAGE = onboarding.  [STOP]
        ii.  checkRenewalStage(clientId, subscriptionId, activatedAt):
               - only evaluates non-null if this is NOT the client's first-ever subscription
               - IF renewal AND no progress_logs row since activated_at → STAGE = renewal_checkin. [STOP]
               - IF renewal AND no recurring_slots billed against THIS subscription id → STAGE = renewal_scheduling. [STOP]
        iii. IF no active recurring_slots exist at all  → STAGE = slot_selection.  [STOP]
        iv.  ELSE → STAGE = active.  [STOP]
   c. IF status IN ('paused','inactive') → NO STOP: falls through to step 3 as if no subscription existed.
3. Fetch latest demo/assessment booking (getMyLatestDemoSession):
   a. IF exists AND status == 'upcoming'                 → STAGE = demo_booked.
   b. IF exists AND status IN ('completed','missed')      → STAGE = demo_completed.
4. ELSE → STAGE = marketing.
```
This is recomputed from scratch on **every** request that calls `getMyJourneyStateAction` — there is no cached/stored stage column. A client with a `paused` or fully lapsed (`inactive`, nothing newer) subscription is deliberately never permanently stuck: they fall through to the demo/marketing branch and can always re-purchase.

**Routing consumers (Observed):**
- `/client/dashboard` is the **hard-redirect gate**: `marketing`→`/client/plans`, `awaiting_activation`→`/client/activate`, `onboarding`→`/client/onboarding`, `renewal_checkin`→`/client/renewal-checkin`, `renewal_scheduling`/`slot_selection`→`/client/schedule`; only `active` (and the demo stages, which render a Dashboard-adjacent empty state rather than redirecting) render the real dashboard.
- `/client/activate` independently re-checks `stage === 'awaiting_activation'` server-side before rendering — cannot be reached by direct URL navigation outside that stage.
- `/client/subscription`, `/client/book`, `/client/schedule`, `/client/coach` each branch on the **same** stage value again for their own contextual empty-states, independently of the dashboard redirect — this is a second read of the same fact, not a shared derived prop (see §19).

### 4.2 `ClientStatus` — staff-facing derived label (Observed, `src/lib/client-status.ts`)

6 buckets, strict priority order: `paused > active > created (awaiting_activation) > expired (has history, none live) > demo (never subscribed, has a demo booking) > not_paid`. Purely derived from `subscriptions.status` history plus existence of an assessment-type booking. Never rendered to the client directly; used in Coach/Admin views. Documented here because it is a **second, independent implementation** of "what state is this client in," computed by different code with a different priority order than `ClientJourneyStage` (§19, Inconsistency INC-1).

### 4.3 Raw database enum (Observed, `supabase/migrations/0001_enums.sql`, `0019_client_journey_enum_values.sql`)
```sql
create type subscription_status as enum ('active', 'inactive', 'paused');
alter type subscription_status add value 'awaiting_activation';   -- added later, migration 0019
create type booking_status as enum ('upcoming', 'completed', 'cancelled', 'missed');
create type session_type as enum ('assessment', 'regular');
```
**No "expired" value exists at the database level for `subscription_status`.** It is exclusively a derived UI label (§4.2, §9).

### 4.4 Portal-wide blocking gates (Observed, re-verified this pass against `src/app/client/layout.tsx`)

Computed in parallel on every `/client/*` page load (`Promise.all` in the layout), rendered with strict precedence — **only one shown at a time**:
```
1. PhoneGateModal          — profiles.phone is null.
2. MeasurementGateModal    — (only if phone present) last progress_logs entry missing or >7 days old.
3. SessionsLowGateModal    — (only if phone present AND measurements fresh) active subscription has
                              1..5 sessions remaining (SESSIONS_LOW_THRESHOLD = 5, planPurchase.service.ts:11).
```
If the identity/journey/measurement fetches fail (e.g., mid-auth-transition), the layout fails soft: gates default to "not shown" rather than blocking the whole portal render (`catch { identity = undefined }`, `!isFailure(...) && ...` pattern) — a deliberate fail-open choice for availability over strictness.

### 4.5 Lifecycle stages, described (maps §4.1's machine states onto lifecycle phases)

**Visitor (pre-account):** Not authenticated. Can reach marketing pages, `/signup`, `/login/client`. `middleware.ts` redirects any unauthenticated request under `/client/*` to `/login/client`.

**Registered Client, pre-purchase (`marketing` / `demo_booked` / `demo_completed`):** Account exists; no paid plan yet. Full detail §5.

**Checkout / Payment (transition, not a stored stage):** Client clicks "Purchase Plan" → Razorpay order → Checkout.js → signature verification. Full detail §6.

**Post-purchase, pre-activation (`awaiting_activation`):** Subscription row exists and is paid for, but has no start date and unlocks nothing yet.

**Post-purchase, onboarding/setup (`onboarding` → `renewal_checkin`/`renewal_scheduling` OR `slot_selection`):** One-time (first-time) or renewal-specific setup steps. Full detail §7.

**Active Subscription (`active`):** Full portal access, subject to the three gates in §4.4.

**Paused (`subscriptions.status='paused'`):** Client-initiated, reversible. Blocks new regular-session bookings only (booking requires `status='active'`); does not touch already-booked upcoming sessions, chat, coach view, progress, or concerns.

**Expired (derived label only, `subscriptions.status` is `inactive` or no row exists):** Occurs the instant a renewal's new subscription is activated (old one force-set `inactive` atomically) or when a subscription simply has no successor. Never a calendar-date event.

**Cancelled (subscription/plan-level):** **Not implemented.** No client-facing action exists to cancel a plan outright (as distinct from pausing it) — verified absent from `payments.actions.ts`, `client-portal.actions.ts`, and all subscription-related services.

## 5. Pre-Purchase Workflows

### 5.1 Registration

**STARTING CONDITION:** Unauthenticated visitor on `/signup`.
**USER ACTION:** Fills 3-step wizard — details form → email OTP → phone OTP — OR clicks "Continue with Google."
**UI/FRONTEND:** `SignupForm.tsx`. Manual-path field validation: full name required; email required + format-checked; phone required, regex `^\+?[0-9]{10,15}$`; password required, ≥8 characters.
**API/SERVICE:** `supabase.auth.signUp({ email, password, options: { data: { role: "client", full_name } } })` client-side call directly to Supabase Auth (not a custom server action for the signup call itself).
**BACKEND LOGIC:** A `handle_new_user()` Postgres trigger fires on the new `auth.users` row, reading `raw_app_meta_data` (server-controlled) — **not** the client-supplied `role` field — to set `profiles.role`. This is a deliberate security fix (migrations `0051_fix_signup_role_escalation.sql`, `0055_handle_new_user_role_via_app_metadata.sql`) closing a prior privilege-escalation gap where a client could self-declare `role: 'admin'`.
**DATABASE OPERATION:** Insert into `auth.users`, trigger-cascaded insert into `profiles` (role hard-coded server-side) and `client_profiles`. These rows exist **before** phone verification completes.
**STATE CHANGE:** Account exists; `ClientJourneyStage` immediately evaluates to `marketing` (no subscription, no demo yet).
**RESPONSE / UI RESULT:** Email OTP step shown (**only if** the Supabase project's "Confirm email" dashboard setting is enabled — UNKNOWN/environment-dependent, not visible in code; if disabled, `signUp()` returns a live session immediately and this step is skipped) → phone OTP step (MSG91) → `setMyPhoneAction` writes `profiles.phone` → redirect to `/client/plans`.
**NEXT POSSIBLE ACTION:** Browse plans, book a free demo, or log out.

**PRECONDITIONS:** None (open registration).
**VALIDATION RULES:** As above; server-side `signUp` also enforces Supabase's own email/password policy.
**FAILURE BEHAVIOR:** Supabase Auth error surfaces inline (e.g., "User already registered").
**ALTERNATIVE PATH — Google OAuth:** `signInWithOAuth({ provider: "google" })` → `/auth/callback` exchanges the code, looks up `profiles.role` for the authenticated user, routes to that role's dashboard. A brand-new Google sign-in always lands as `client` (no pre-existing coach/admin profile row could match) — this is the actual enforcement point preventing self-granted elevated roles via OAuth, not a role check on the OAuth payload itself. Google signups skip email OTP (pre-verified by Google) but lack a phone number, which forces `PhoneGateModal` open on first portal page load.
**CANCELLATION PATH:** Abandoning the wizard mid-flow leaves an `auth.users`/`profiles` row with no phone — the account is recoverable by logging back in and resuming at whichever OTP step is incomplete (**Inferred** from the fact phone is set by a separate action, not part of the signup transaction; exact resume-step UI behavior not fully traced — UNKNOWN — REQUIRES VERIFICATION for the precise resume screen shown).
**KNOWN GAP (see §18, ISS-1):** Both `SignupForm.tsx` and `PhoneGateModal.tsx` ship a "Skip for now (demo — MSG91 not verified yet)" button, explicitly commented `TEMPORARY` pending MSG91 KYC approval, which saves the typed phone number **unverified** through the identical write path as a verified save (`setMyPhoneAction`). Phone verification is nominally mandatory but is currently bypassable in both the manual-signup and Google-OAuth-gate flows.

### 5.2 Login

**STARTING CONDITION:** Registered client, unauthenticated, on `/login/client`.
**USER ACTION:** Submits email + password, or clicks "Continue with Google."
**API/SERVICE:** `supabase.auth.signInWithPassword`.
**BACKEND LOGIC:** On success, client-side code explicitly re-queries `profiles.role`; if `role !== 'client'`, calls `signOut()` and shows *"This account isn't registered as a client. Log in with the correct account, or use the right portal."* — a deliberate UX fix so a wrong-portal login doesn't show a silently-stuck "Signing in…" state. `middleware.ts` separately and redundantly enforces the same role boundary on every subsequent request via the JWT `user_role` claim (or a `profiles` fallback query if the claim is absent — covers sessions issued before the custom-claims hook was enabled, migration `0054`).
**STATE CHANGE:** Session cookie set; `ClientJourneyStage` evaluated fresh on next page load.
**FAILURE BEHAVIOR:** Invalid credentials → inline Supabase Auth error. Wrong role → forced sign-out + explicit error, not a silent redirect loop.
**NOT IMPLEMENTED:** "Forgot password" — button is present in `LoginForm.tsx` with no `onClick` handler wired (Observed — dead UI element, ISS-6).

### 5.3 Browsing Plans

**STARTING CONDITION:** Authenticated client, any stage.
**USER ACTION:** Navigates to `/client/plans` (via CTA or `marketing`-stage redirect).
**API/SERVICE:** `listMarketingPlansAction` → `listPackages(token)` [`packages.service.ts`].
**BACKEND LOGIC:** Filters `package_tiers` to `is_active = true`; maps to a `MarketingPlan` view (id, name, category, sessions, price, originalPrice, features, highlighted).
**DATABASE OPERATION:** Read-only `select` on `package_tiers`.
**UI RESULT:** Card grid — session count, price, original price/savings, feature bullets, "Most Popular" highlight.
**NEXT POSSIBLE ACTION:** "Purchase Plan" (§6) or navigate to Demo Booking.
**EMPTY STATE:** No active packages → empty grid (exact copy not traced — UNKNOWN — REQUIRES VERIFICATION).

### 5.4 Demo / Assessment Booking

**STARTING CONDITION:** Client has never had a demo booking (stage `marketing`) or had one that is `upcoming` (stage `demo_booked`, shows "already booked" instead) or `completed`/`missed` (stage `demo_completed`, shows a rate-the-demo prompt before funneling to Plans).
**PRECONDITION (business rule):** `getMeasurementStatus` must return `isStale = false` — a stale (>7 days old or never-logged) measurement **server-side blocks demo booking outright**, independent of the portal-wide `MeasurementGateModal`'s own dismiss button (`bookDemoSessionAction` throws *"Please update your measurements before booking a demo session."*).
**USER ACTION:** Picks a date (and optionally a preferred time / gender preference) on `/client/demo-booking`.
**API/SERVICE:** `bookDemoSessionAction` → `findDemoSlots` (ranks candidate coaches by a lowest-utilization algorithm — the client never picks a coach) → `confirmDemoBooking(token, topCoachId, topSlotStart)`.
**BACKEND LOGIC:** No payment step — free, confirmed immediately. The client is **not** shown a ranked list; the system silently takes the top-ranked (least-utilized available) coach.
**DATABASE OPERATION:** Insert a `bookings` row, `session_type='assessment'`, `status='upcoming'`.
**STATE CHANGE:** `ClientJourneyStage` → `demo_booked`.
**RESPONSE:** Confirmation showing coach name/photo/slot time.
**NOTIFICATIONS:** Client + coach notified in-app + email; client also SMS (MSG91 `demo_booked`).
**FAILURE BEHAVIOR:** No coaches available for the requested date/time → *"No coaches are available for that date or time -- try a different date or time."*
**NEXT POSSIBLE ACTION:** Await the session, or (after completion) rate it and proceed to Plans.
**DEAD CODE NOTE:** A parallel paid-demo order-creation function (`createDemoSessionOrder`, `payments.service.ts`) exists but is called by no current UI — the demo flow is unconditionally free (§18, ISS-9).

### 5.5 Pre-Purchase Access Summary

| Function | Available pre-purchase? | Notes |
|---|---|---|
| Register / Login | Yes | |
| Verify email/phone | Yes, nominally mandatory | Phone OTP currently skippable — ISS-1 |
| Edit profile (name/phone/photo/goals/equipment/medical notes) | Yes | Not gated by purchase state |
| View/complete onboarding | No | Only reachable once a subscription is `active` |
| View/compare/purchase plans | Yes | |
| Coupons/offers | No | Not implemented anywhere |
| View payment status | Partial | No history before a first purchase |
| Contact support (Concerns) | Yes | No plan required |
| Book a session | Conditional | Free demo/assessment only |
| Subscription page | Yes (empty state) | "No Subscription Found," or a static "Demo Package — Expired" card post-demo |
| Coach page | Conditional | Demo coach only, simplified read-only card |
| Chat | No | Nav hidden; no conversation exists until a coach is linked via booking/slot |
| Progress / measurement logging | Yes | Pre-purchase logging is in fact a prerequisite gate for booking a demo |

## 6. Purchase / Conversion Workflows

### 6.1 Purchase & Checkout

```
STARTING CONDITION: Authenticated client on /client/plans, no blocking existing subscription.
  ↓ USER ACTION: clicks "Purchase Plan" on a package card.
  ↓ UI/FRONTEND: PlansMarketingClient calls createPackagePurchaseOrderAction(packageId).
  ↓ API/SERVICE: createPackagePurchaseOrder() [payments.service.ts]
      • BUSINESS RULE (BR-1): requires role=client.
      • BUSINESS RULE (BR-2, "purchase gate"): REJECTS if the client already has a subscription with
        status IN ('active','awaiting_activation') UNLESS that active one has sessions_remaining <= 5
        (the renewal exception). Error: "You already have an active or pending plan."
      • Looks up package_tiers row (must be is_active=true).
      • createRazorpayOrder(price, receipt) → Razorpay Orders API (amount converted to paise).
      • DATABASE OPERATION: inserts a `payments` row: purpose='package_purchase', status='created',
        razorpay_order_id attached.
      • RESPONSE: {orderId, amountPaise, currency, keyId} returned to the browser.
  ↓ UI: Razorpay Checkout.js (hosted payment UI) opens client-side with the returned order id.
  ↓ [Razorpay collects payment: card/UPI/etc.]
  ↓ ON RAZORPAY SUCCESS CALLBACK: browser receives {razorpay_order_id, razorpay_payment_id, razorpay_signature}
  ↓ API/SERVICE: verifyPaymentAction(orderId, paymentId, signature)
      → verifyAndFulfillPayment() [payments.service.ts] — THE ONLY TRUSTED FULFILLMENT PATH
        • Loads the `payments` row by razorpay_order_id; confirms it belongs to this client.
        • IDEMPOTENCY: already 'paid' → no-op success; status not 'created' → reject.
        • BUSINESS RULE (BR-3): verifies HMAC-SHA256(order_id|payment_id, RAZORPAY_KEY_SECRET) SERVER-SIDE.
          Mismatch → payments.status='failed'; throws "Payment verification failed -- signature mismatch."
          The client's own reported success is NEVER trusted on its own.
        • ON VALID SIGNATURE → purchaseMyPlanForClient():
            - Re-checks BR-2 (renewal exception still applies).
            - DATABASE OPERATION: inserts `subscriptions` row: status='awaiting_activation',
              sessions_total = package.sessions_count.
            - Logs timeline event 'plan_purchased'; notifies client (in-app + email,
              template plan_purchased_client).
        • DATABASE OPERATION: updates `payments` row: status='paid', paid_at, subscription_id attached.
        • FAILURE MODE (BR-4): if fulfillment throws AFTER money is captured (e.g. a race condition):
          payments.status='paid_unfulfilled'; client told "Your payment was received, but we couldn't
          finish setting things up automatically... contact support with reference {orderId}." No
          automatic refund exists anywhere in the code.
  ↓ UI RESULT: "Congratulations!" modal (plan name + feature list) → client clicks "Understood" →
      redirect to /client/dashboard.
  ↓ NEXT POSSIBLE ACTION: Dashboard's journey-state gate reads stage='awaiting_activation' →
      auto-redirects to /client/activate (§7.1).
```

**Webhook reconciliation (server-to-server, Observed, `POST /api/webhooks/razorpay`):** On a `payment.captured` event, verifies a *separate* webhook signature (HMAC over the raw request body, `RAZORPAY_WEBHOOK_SECRET`), then calls `fulfillPaymentByWebhook()` — repeats the identical subscription-creation logic with no user token, covering the case where the client browser never got to report success (tab closed, crash, lost network). No-ops if already resolved. **Always returns HTTP 200 to Razorpay** even on internal failure, to avoid infinite retry storms, marking `paid_unfulfilled` instead.

**PRECONDITIONS:** Authenticated client; package `is_active=true`; no blocking existing subscription (BR-2).
**PERMISSIONS:** `role=client` only.
**CANCELLATION PATH:** Client closes/abandons Razorpay Checkout before completing payment → `payments` row stays `status='created'` forever (no expiry/cleanup job found — **UNKNOWN — REQUIRES VERIFICATION** whether stale `created` rows are ever purged or block a future purchase attempt at the `payments` table level; they do not block a new order per BR-2's logic, which only inspects `subscriptions`, not `payments`).
**RETRY BEHAVIOR:** A client can simply click "Purchase Plan" again, creating a new `payments`/order row; there is no dedupe against an abandoned prior order.

### 6.2 Demo → Paid Conversion (business path, not a separate action)

There is no distinct "convert demo to paid" function — a client who completed a demo simply follows the normal purchase workflow (§6.1) from `/client/plans`; the only special-cased UI is the `demo_completed` stage's rating prompt before funneling there, and the fact that the demo coach is *not* guaranteed to be the client's real coach post-purchase (the recurring-schedule coach-matching engine runs independently, §7.3).

## 7. Post-Purchase Workflows

### 7.1 Plan Activation

```
STARTING CONDITION: subscriptions.status='awaiting_activation', activated_at=null. Stage = awaiting_activation.
  ↓ USER ACTION: client picks a start date on /client/activate.
  ↓ VALIDATION: start date must be >= tomorrow (IST business-day rule).
  ↓ API/SERVICE: activatePlanAction(subscriptionId, startDate) → activateMyPlan() [planPurchase.service.ts]
      • BUSINESS RULE (BR-5, "one-time lock"): a second activation attempt on the same subscription
        throws "This plan has already been activated."
      • DATABASE OPERATION: subscriptions.status → 'active', activated_at = startDate.
      • BUSINESS RULE (BR-6, "renewal supersession", ATOMIC with the above): any OTHER subscription
        for this client still status='active' is force-set to 'inactive' in the same operation — this
        IS the entire mechanism behind "old plan retired on renewal"; there is no separate cancel step.
      • Logs timeline event 'plan_activated'; notifies client (in-app + email).
  ↓ STATE CHANGE: ClientJourneyStage recomputes → onboarding (first-time) OR renewal_checkin/
      renewal_scheduling (renewal) OR slot_selection (if onboarding/renewal steps already satisfied).
  ↓ NEXT POSSIBLE ACTION: proceed through whichever gate stage is next; no going back to /client/activate
      (server re-checks stage=='awaiting_activation' and will redirect away once it no longer holds).
```

### 7.2 Onboarding (first-time clients only)

```
STARTING CONDITION: subscription active, no client_onboarding row exists yet. Stage = onboarding.
  ↓ USER ACTION: submits the one-time medical/goals/measurement intake form.
  ↓ FIELDS: age, gender, height(cm, optional); weight(kg, REQUIRED); body fat %, muscle %,
      waist/chest/hip/arms/thigh (in, optional); fitness goal (REQUIRED, 1 of 5 enum values:
      fat_loss/muscle_gain/strength/general_fitness/rehabilitation); medical conditions/injuries/
      medications/exercise restrictions (free text, optional).
  ↓ API/SERVICE: submitOnboardingAction → submitOnboarding() [onboarding.service.ts]
      • BUSINESS RULE (BR-7, "insert-once"): enforced BOTH at the RLS layer and in application code —
        throws "Onboarding has already been submitted -- contact support to make changes." if a row
        already exists. Client cannot self-correct onboarding data after submission; only an admin can.
      • DATABASE OPERATION: insert client_onboarding row.
      • SIDE EFFECT (BR-8): if any measurement field was filled in, ALSO inserts a "Day 1" progress_logs
        row — a deliberate duplication: onboarding = static demographic snapshot; progress_logs = the
        time-series anchor later trend charts compare against.
  ↓ STATE CHANGE: ClientJourneyStage advances past onboarding toward slot_selection/active.
```

### 7.3 Recurring Schedule Setup (first-time: `slot_selection`; renewal: `renewal_scheduling`)

```
STARTING CONDITION: no recurring_slots row billed against the CURRENT subscription id.
  ↓ USER ACTION: picks a weekly pattern — 3 standard patterns, OR "more options" → 2-day pairing OR fully
      custom 2–5-day selection (Sunday always excluded — "Sunday is a holiday and isn't available for
      scheduling."). Renewal/change flows add a trainer-preference step (Same/New) and, if "New," a
      gender-preference sub-step (no "no preference" option on renewal, unlike first-time setup, which
      allows no-preference). Renewal flow also offers a one-click "Keep My Schedule" shortcut that carries
      over the exact days/time/coach from the retired subscription.
  ↓ API/SERVICE: schedule.actions.ts → scheduling.service.ts (findAvailableCoach / matchRecurringPattern)
      • BUSINESS RULE (BR-9, first-time/no-preference matching, findAvailableCoach): resolves target
        weekdays, pulls all active coaches (optionally gender-filtered), sorts by a utilization view
        ASCENDING (least-busy first), returns the FIRST coach for whom every day in the pattern is free
        at the requested time. Strict single-best-match search — no ranked shortlist is ever surfaced.
      • BUSINESS RULE (BR-10, known/preferred-coach ladder, matchRecurringPattern — schedule
        changes/renewals): for STANDARD patterns (3-day pairs or 6-day), tries in order: (1) exact
        pattern at preferred time, (2) exact pattern at any other grid time, (3) alternate day-pairing
        (e.g. Tue/Thu/Sat instead of Mon/Wed/Fri) at preferred time, (4) alternate pairing at any other
        time. CUSTOM patterns (2–5 client-chosen days) only get steps (1)–(2) — no pairing fallback.
      • KNOWN GAP (BR-11 / ISS-2): the "is this coach free" check (isDayTimeFreeForCoach) only verifies
        the slot fits the coach's weekly availability template and doesn't collide with another client's
        recurring commitment for that exact day/time — it does NOT check coach leave or actual booked/
        held sessions. That real conflict check only happens later, per calendar occurrence, in booking
        generation below. A schedule can be confirmed "matched" and still have specific future
        occurrences silently skipped.
  ↓ DATABASE OPERATION: insert recurring_slots row(s) against this subscription_id + matched coach_id.
  ↓ BACKEND LOGIC (generate_bookings_from_recurring_slot, Postgres function, BR-12):
      starts from tomorrow, walks forward ONE CALENDAR DAY at a time (not week-by-week), generating a
      booking on each date matching the slot's weekday, until either the requested count (4 for a normal
      setup, 1 when backfilling a single cancellation) is reached OR 60 calendar days have been scanned.
      Each candidate date is SILENTLY skipped (no error) if the coach has approved leave that day, a
      booking already exists for that slot, or a real scheduling conflict exists.
      ISS-3 (real gap, not hypothetical): it is possible for FEWER than the requested number of sessions
      to actually be created for a "confirmed" schedule, with NO client-facing signal that generation
      came up short.
  ↓ STATE CHANGE: ClientJourneyStage → active (full steady-state portal). "Book a Session" nav item
      disappears; "My Coach" upgrades to full profile + change-request card; "My Chats" nav item appears
      (a conversation is auto-created the moment a coach is linked, ensureConversationForCoachAssignment).
  ↓ FAILURE BEHAVIOR: no coach match found at all → "No coach is available for that day/time -- try a
      different combination," client can retry with a different pattern or (renewal/coach-change context)
      is offered a support-notify fallback.
```

### 7.4 Renewal Check-in (`renewal_checkin`, renewal clients only)

```
STARTING CONDITION: subscription active, NOT the client's first-ever subscription, no progress_logs row
  exists since the NEW subscription's activated_at.
  ↓ USER ACTION: views full historical measurement chart (untouched/preserved) + submits a fresh-baseline
      measurement entry.
  ↓ BUSINESS RULE (BR-13): this specific flow BYPASSES the normal once-per-7-days client self-log rate
      limit — a renewal check-in is exempted by design, not a bug.
  ↓ DATABASE OPERATION: insert progress_logs row anchored at/after the new subscription's activation.
  ↓ STATE CHANGE: ClientJourneyStage advances past renewal_checkin toward renewal_scheduling/active.
```

### 7.5 What Becomes Newly Available Post-Activation (aggregate)

- Ongoing session booking via the recurring schedule; `/client/book` (ad-hoc wizard) becomes unreachable — redirects to `/client/schedule` server-side even on direct navigation.
- "My Coach" upgrades from empty/demo-simplified to a full profile card with coach-change-request capability.
- "My Chats" nav item appears; a conversation is auto-created the moment a coach is linked via a recurring slot or booking.
- Full Subscription page: plan name, sessions used/remaining, pause/resume control, pause-days balance, payment history list.
- Progress module (already accessible pre-purchase) now also feeds "Progress Since Day 1" dashboard comparisons anchored to the onboarding submission's baseline.

## 8. Complete Business Logic

This section catalogs every discrete business rule found across frontend, actions, services, and Postgres functions/RLS. Each rule is numbered `BR-#` and reused by ID in the workflows above and the master inventory (§25).

| ID | Rule | Where implemented | Trigger | Data evaluated | Result |
|---|---|---|---|---|---|
| BR-1 | Only `role=client` may purchase/book | `payments.service.ts`, `client-portal.actions.ts` (action-level checks) | Any purchase/booking action | `profiles.role` (from token) | Non-client callers rejected |
| BR-2 | Purchase gate: block 2nd purchase unless renewal-eligible | `createPackagePurchaseOrder` [payments.service.ts] | Client attempts checkout | Existing `subscriptions.status`, `subscription_usage_view.sessions_remaining` | Reject unless no blocking sub, or blocking sub has `sessions_remaining <= 5` |
| BR-3 | Payment signature is the only fulfillment trust boundary | `verifyAndFulfillPayment` [payments.service.ts] | Checkout callback | HMAC-SHA256(order\|payment, key secret) | Mismatch → hard fail, no subscription created |
| BR-4 | Post-capture fulfillment failure never silently loses money | `verifyAndFulfillPayment`, `fulfillPaymentByWebhook` | Exception after payment captured | — | `payments.status='paid_unfulfilled'`, client told to contact support with order ref; no auto-refund |
| BR-5 | Plan activation is one-time and locked | `activateMyPlan` [planPurchase.service.ts] | 2nd activation attempt on same subscription | `subscriptions.activated_at` | Throws "already been activated" |
| BR-6 | Renewal supersession is atomic with activation | `activateMyPlan` | Client activates a new subscription while an older one is still `active` | `subscriptions.status`, `client_id` | Old `active` row force-set `inactive` in the same operation |
| BR-7 | Onboarding is insert-once | `submitOnboarding` [onboarding.service.ts] + RLS | 2nd onboarding submission | `client_onboarding` row existence | Rejected at both RLS and application layer |
| BR-8 | Onboarding measurement fields double-write to `progress_logs` | `submitOnboarding` | Onboarding submit with any measurement field filled | Onboarding form fields | Inserts a "Day 1" `progress_logs` row |
| BR-9 | First-time coach matching = least-utilized-first, single result | `findAvailableCoach` [scheduling.service.ts] | First-time slot selection, no trainer preference | Coach utilization view, availability template | Returns first coach satisfying every pattern day |
| BR-10 | Preferred-coach matching ladder (4-step fallback for standard patterns) | `matchRecurringPattern` [scheduling.service.ts] | Schedule change/renewal with a trainer preference | Availability grid, pattern type | Falls back through pattern/time/day-pairing combinations; custom patterns get only 2 of 4 steps |
| BR-11 | Pattern-match availability check excludes leave/real conflicts | `isDayTimeFreeForCoach` [scheduling.service.ts] | Any schedule match/confirm | Coach weekly availability template, other clients' recurring commitments | Does NOT check coach leave or actual bookings — real check deferred to generation (BR-12) |
| BR-12 | Recurring booking generation may silently under-deliver | `generate_bookings_from_recurring_slot` (Postgres fn) | New/renewed recurring slot confirmed | Coach leave, existing bookings, real conflicts, 60-day scan window | Generates up to N (usually 4) bookings; skips blocked dates with no error, may return fewer than requested |
| BR-13 | Renewal check-in bypasses the weekly progress-log rate limit | `RenewalCheckinClient` flow / `progressLogs.service.ts` | Renewal client's first log after new subscription activation | `renewal_checkin` stage | Log accepted regardless of 7-day cap |
| BR-14 | Progress-log rate limit (general) | `progressLogs.service.ts` | Client self-service log submit | Last `progress_logs.created_at` for this client | Reject if <7 days since last log ("next update available in a few days") — admin and renewal-checkin bypass this |
| BR-15 | Measurement staleness gate | `getMeasurementStatus` [progressLogs.service.ts] | Demo booking, regular booking, session join | Last `progress_logs` timestamp vs. now | `isStale=true` if missing or >7 days old → server-side block on all three actions (not just a UI nudge) |
| BR-16 | Session credit enforcement (booking-time) | `confirm_booking()` (Postgres fn, migration `0053`) | Any regular-session booking confirmation | Count of `bookings` with `status IN (upcoming, completed)` for the subscription vs. `sessions_total` | Reject with "No sessions remaining on this package" if count already reached |
| BR-17 | Sessions-remaining DISPLAY figure is a different computation than BR-16's enforcement | `subscription_usage_view` (Postgres view) vs. `confirm_booking()` | Subscription page render vs. booking confirm | Same underlying `bookings`/`subscriptions` data, different aggregation | The two numbers are NOT guaranteed identical — display is informational only |
| BR-18 | First session with a real coach is always free `assessment` type | Booking creation logic (`scheduling.service.ts` / `client-portal.actions.ts`) | Client's very first non-demo booking | Booking history with this coach/subscription | 60 min, free, does not count against package; every subsequent booking is `regular`, 45 min, requires active-subscription credit |
| BR-19 | Cancellation cutoff (client-enforced only) | `cancel_booking` RPC, gated in `client-portal.actions.ts` | Client-initiated cancellation | `settings.cancellation_cutoff_hours` (default 12), booking start time, `role` | Reject if inside cutoff window; admins bypass entirely |
| BR-20 | Cancellation backfills one replacement occurrence | `cancel_booking` RPC | Cancellation of a booking tied to a `recurring_slot_id` | `recurring_slot_id` on the cancelled booking | Generates exactly one replacement future occurrence |
| BR-21 | Reschedule cutoff (client-enforced only) | `reschedule_booking`, gated in `client-portal.actions.ts` | Client-initiated reschedule | `settings.reschedule_cutoff_hours` (default 1), booking start time, `role` | Reject if inside cutoff; admins bypass |
| BR-22 | Reschedule weekly cap | `client-portal.actions.ts` reschedule action | Client-initiated reschedule | Count of `session_rescheduled` timeline events this Monday-start week | Reject at 2 reschedules/week (counted from events, not a stored counter) |
| BR-23 | Reschedule window | `client-portal.actions.ts` reschedule action | Client-initiated reschedule | Target date vs. today | Reject outside a rolling 30-day window |
| BR-24 | No double-booking same IST day | `client-portal.actions.ts` reschedule/booking action | Any new booking/reschedule | Client's other bookings on the same IST calendar date | Reject if a session already exists that day |
| BR-25 | Substitute coach is single-session only | `reschedule_booking` | Reschedule falls back to a substitute (up to 3 tried) | `bookings.coach_id` updated directly; `recurring_slot_id` left untouched | Only that one occurrence uses the substitute; later occurrences of the same pattern return to the original coach automatically |
| BR-26 | Session rating: once per week, global | Rating action in `client-portal.actions.ts` | Client submits a rating | Any booking rated in the last 7 days (any booking, not just this one) | Reject a 2nd rating within 7 days; on success, recomputes coach's aggregate `rating`/`review_count` immediately |
| BR-27 | Zoom meeting is created lazily, one shared host account | `ensureZoomMeetingForBooking` [zoom.service.ts] | First "Join" attempt on a booking | `bookings` row, Zoom env vars | Idempotent creation; reused link on subsequent joins; disabled with "Join link not ready yet" if Zoom env vars are unset |
| BR-28 | Missed-session detection (passive sweep) | `mark_missed_bookings()` (Postgres RPC) | Any booking-list read (dashboard, sessions page) | `upcoming` bookings whose start time has passed with no attendance | Flips to `missed`; not cron-driven, opportunistic only |
| BR-29 | A client can never self-complete a session | `client-portal.actions.ts` (no client-facing "complete" action exists) | — | — | Completion requires coach `markAttendance` then `submitSessionNotes`; enforced by absence of any client-callable equivalent, not an explicit denial |
| BR-30 | Coach-change request requires an existing coach | `client-coach-change.actions.ts` | Client submits a change request | Client's current coach assignment | Throws if the client has no current coach |
| BR-31 | Coach-change "needs completion" excludes the current coach from re-matching | `completeCoachChangeAction` / `matchRecurringPattern` | Client picks new day/time after an approved-without-replacement request | Current `coach_id` | Matching search explicitly excludes it |
| BR-32 | Coach change cascades to slots, bookings, and chat | `completeCoachChange` | Coach-change request completed | Active `recurring_slots`, `upcoming` bookings, `conversations` with the old coach | Cancels old recurring slots + upcoming bookings (reason: "Client changed coaches"), creates new slots against the new coach, closes old conversation, opens a new one |
| BR-33 | One active conversation per client (DB-enforced) | Partial unique index `conversations_one_active_per_client` (migration `0042`) | Any attempt to open a 2nd active conversation | `conversations.client_id`, `status='active'` | Insert rejected at the database level, not just application logic |
| BR-34 | Closed conversations are permanently read-only | RLS on `messages`/`conversations` | Any send attempt into a `closed` conversation | `conversations.status` | Rejected at the RLS layer |
| BR-35 | Read receipts settable only by the recipient | RLS on `messages.read_at` | Any update to `read_at` | Caller identity vs. message sender | Rejected if the caller is the message's own sender |
| BR-36 | Concern/escalation status requires a logged phone call first | Admin-side transition guard (migration `0049`, `called_client_at`) | Admin attempts to change concern status or edit details | `escalations.called_client_at` | Blocked until set — internal rule, never surfaced to the client directly |
| BR-37 | Client cannot edit/cancel/delete a raised concern | RLS on `escalations` (insert-only for client role) | Any client update/delete attempt | `escalations` row ownership | Rejected at RLS |
| BR-38 | Role is always server-assigned, never client-declared | `handle_new_user()` trigger reading `raw_app_meta_data` (migrations `0051`, `0055`) | Any signup (manual or OAuth) | `raw_app_meta_data`, never the client-supplied form/profile field | Closes a prior privilege-escalation vulnerability |
| BR-39 | Role-portal boundary enforced twice | `LoginForm.tsx` (UX-level) + `middleware.ts` (JWT `user_role` claim or `profiles` fallback) | Any authenticated request to `/client/*`, `/coach/*`, `/admin/*` | `profiles.role` / JWT claim vs. path segment | Wrong-role session redirected to that path's own login page |
| BR-40 | Notification dispatch never blocks the triggering action | Every `notify*`/`createFromTemplate` call site | Any action that also notifies | — | Fail-soft: notification errors are caught/logged, never propagated to fail the primary action |
| BR-41 | SMS is India-DLT-gated and coach-exclusive-from-SMS | `sms.service.ts` (MSG91) | Any SMS-eligible event | Recipient role | Coaches never receive SMS, only email — by code structure, not incidental |
| BR-42 | Webhook always returns HTTP 200 regardless of internal outcome | `/api/webhooks/razorpay` route handler | Any Razorpay webhook delivery | — | Prevents Razorpay's own retry storm; internal failure recorded as `paid_unfulfilled` instead |
| BR-43 | Pause blocks new regular bookings only | `confirm_booking()` requires `subscriptions.status='active'` | Booking attempt while `status='paused'` | `subscriptions.status` | Rejected; already-booked upcoming sessions are untouched by pausing itself |
| BR-44 | Pause-days balance is informational, not enforced | Subscription page derivation (`pause_days_allowed` vs. live-derived `pause_days_used` from paired `pause_started`/`pause_ended` timeline events) | Client pauses beyond their allowance | Timeline events | No code path blocks pausing once the allowance is exhausted — display-only |
| BR-45 | Demo booking is unconditionally free | `bookDemoSessionAction` (never calls `createDemoSessionOrder`) | Any demo booking | — | No payment step; the paid-demo code path exists but is dead (ISS-9) |

## 9. State Transition Map

### 9.1 `ClientJourneyStage` transitions (full detail of triggers/exit conditions per state)

| State | Meaning | DB basis | Entry condition | Exit condition / next states | Who/what changes it | Client actions available | Restricted actions |
|---|---|---|---|---|---|---|---|
| `marketing` | No purchase history, no demo | No `subscriptions` row usable; no demo booking | Default state for a new or fully-lapsed client | → `demo_booked` (books demo) or `awaiting_activation` (purchases) | Client action (book demo / purchase) | Browse plans, book demo, edit profile, log progress, raise concerns | Booking regular sessions, onboarding, schedule setup, full coach/chat |
| `demo_booked` | Free assessment scheduled | `bookings` row, `session_type='assessment'`, `status='upcoming'` | Demo booking confirmed | → `demo_completed` (session occurs / passes) | Coach (attendance) or passive time-based sweep | View demo details, cancel/reschedule (if within cutoffs, same rules as any booking), progress logging | Purchasing while unresolved not blocked, but rebooking another demo blocked (only one demo relevant at a time — **Inferred**) |
| `demo_completed` | Demo occurred, no plan yet | Latest demo booking `status IN (completed, missed)` | Demo session ends | → `awaiting_activation` (purchases) | Coach (marks attendance) / sweep (marks missed) | Rate the demo, purchase a plan | Booking another demo (UNKNOWN — REQUIRES VERIFICATION exact re-demo rule, §21) |
| `awaiting_activation` | Paid, not started | `subscriptions.status='awaiting_activation'` | Payment signature verified | → `onboarding`/`renewal_checkin`/`renewal_scheduling`/`slot_selection`/`active` (activation confirmed) | Client (picks start date) | Only `/client/activate` | Everything else portal-wide is redirect-gated to this screen |
| `onboarding` | Active sub, no intake form yet | `subscriptions.status='active'`, no `client_onboarding` row | Plan activated, first-time client | → `renewal_checkin`/`renewal_scheduling`/`slot_selection`/`active` | Client (submits onboarding) | Only `/client/onboarding` | Everything else redirect-gated |
| `renewal_checkin` | Renewal client, no fresh measurement since new sub | Non-first subscription; no `progress_logs` since `activated_at` | Renewal activated | → `renewal_scheduling`/`active` | Client (submits check-in log) | Only `/client/renewal-checkin` | Everything else redirect-gated |
| `renewal_scheduling` | Renewal client, no slots on new sub | Non-first subscription; no `recurring_slots` on new `subscription_id` | Renewal check-in done (or N/A) | → `active` | Client (confirms schedule) | Only `/client/schedule` | Everything else redirect-gated |
| `slot_selection` | First-time client, active+onboarded, no recurring slots | `subscriptions.status='active'`, onboarding exists, no `recurring_slots` | Onboarding done | → `active` | Client (confirms schedule) | Only `/client/schedule` | Everything else redirect-gated |
| `active` | Steady state | Active sub + onboarding + recurring slots all present | All setup gates cleared | → falls through toward `marketing`/demo states only if subscription becomes `paused`/`inactive` with nothing newer; → `awaiting_activation` on a fresh renewal purchase | Client (renews, pauses) / Admin (adjusts) | Full portal | None (subject to the 3 cross-cutting gates, §4.4) |

### 9.2 `subscriptions.status` raw enum transitions

```
(none) --[purchase + payment verified]--> awaiting_activation --[client confirms start date]--> active
active --[client: Pause]--> paused --[client: Resume]--> active
active --[renewal: new subscription activated]--> inactive   (atomic, BR-6)
paused --[no further action]--> (stays paused indefinitely; no auto-expiry)
No stored "expired" value exists. Reaching 0 sessions_remaining does NOT change status (stays `active`
  showing 0 remaining until the client renews).
```

### 9.3 `bookings.status` transitions

```
(created) --> upcoming
upcoming --[coach: markAttendance('present'|'late') then submitSessionNotes]--> completed
upcoming --[coach: markAttendance('absent')]--> missed (no_show_party='client')
upcoming --[time passes, no attendance marked, next list-read triggers sweep]--> missed
upcoming --[client or admin: cancel, cutoff permitting]--> cancelled
upcoming --[client or admin: reschedule, cutoff/cap/window permitting]--> upcoming (new time, was_rescheduled=true)
```
No transition ever returns a booking from a terminal state (`completed`/`cancelled`/`missed`) back to `upcoming`.

## 10. Database / Data Model

Every entity read or written, directly or indirectly, by Client Portal workflows (Observed, cross-referenced against migrations):

| Entity | Purpose | Primary ID | Key fields | Status field(s) | Client relationship | Other relationships | R/W by client actions |
|---|---|---|---|---|---|---|---|
| `profiles` | 1 row per auth user, role + identity | `id` (= `auth.users.id`) | `role`, `phone`, `full_name`, `avatar_url`, `emergency_contact` | `account_status` | Self | Shared by client/coach/admin | R: profile page. W: name/phone/photo/goals/equipment/medical notes via `client-profile.actions.ts`; NOT role, NOT email |
| `client_profiles` | Client-specific extension of `profiles` | `id` (FK profiles) | goals, equipment, medical notes | — | 1:1 with `profiles` | Parent of most client-scoped tables below | R/W via profile actions |
| `client_onboarding` | One-time medical/goals/measurement intake | `id` | age, gender, height, weight, fitness_goal, medical fields | — (insert-once, BR-7) | 1:0..1 per client | Feeds a `progress_logs` "Day 1" row (BR-8) | Insert-only by client; update only by admin |
| `subscriptions` | The commercial entitlement — a bucket of N sessions | `id` | `status`, `sessions_total`, `activated_at`, `client_id`, `package_id` | `subscription_status` enum | 1:many per client (≤1 active/awaiting_activation, ≤1 paused, any number inactive) | FKs `package_tiers`; FK target of `bookings`, `recurring_slots`, `payments` | R: subscription page, journey-stage checks. W: only via `payments`/`planPurchase` service (activation, pause/resume) |
| `package_tiers` | Plan catalog/definition | `id` | name, sessions_count, price, original_price, features, is_active, category, default_pause_days | `is_active` | Read-only reference for clients | FK target of `subscriptions` | Read-only to clients |
| `payments` | Money ledger | `id` | `status`, `razorpay_order_id`, `paid_at`, `subscription_id`, `purpose` | created/paid/failed/paid_unfulfilled | 1:many per client | Optionally FKs `subscriptions` or `bookings` | Read-only to clients (history list); writes are server-only via `supabaseAdmin` |
| `bookings` | Every session (demo or regular) | `id` | `coach_id`, `client_id`, `session_type`, `status`, `subscription_id`, `recurring_slot_id`, `coach_joined_at`, `reminder_sent_at`, `was_rescheduled`, `no_show_party` | `booking_status` enum, `session_type` enum | 1:many per client | FKs `subscriptions`, `recurring_slots`, `profiles`(coach) | R: sessions/dashboard. W: create (booking actions), cancel/reschedule (client, within rules); status transitions to completed/missed are coach/system-only |
| `attendance` | 1:1 attendance record per booking | `id` | `status` (present/absent/late), `marked_at` | `attendance_status` enum | Indirect (via booking) | 1:1 with `bookings` | Read-only to client |
| `workout_notes` | Coach's post-session record | `id` | `notes`, `homework`, `exercises_performed`, `performance_rating`, `improvements[]`, `additional_remarks` | — | Indirect (via booking) | 1:1 with `bookings` | Client: **select-only on `notes`** (RLS); homework/exercises/rating/improvements/remarks are never surfaced client-side |
| `recurring_slots` | The client's standing weekly pattern | `id` | `client_id`, `coach_id`, `subscription_id`, weekday/time fields, `status` | `recurring_slot_status` enum | 1:many per client | FKs `subscriptions` (billing attribution — critical for renewal gating), `profiles`(coach) | R: schedule page. W: create/cancel via schedule/coach-change actions |
| `progress_logs` | Client-authored measurement history | `id` | weight, body fat %, muscle %, waist/chest/hip/arms/thigh, note, `photo_url` (unused), `created_at` | — | 1:many per client, independent of bookings | Feeds dashboard/progress trend charts | Insert by client (rate-limited, BR-14), by admin (unrestricted), by renewal-checkin flow (bypasses limit, BR-13) |
| `coach_change_requests` | Coach-change lifecycle | `id` | `reason`, ratings, `status`, `needs_completion`, new `coach_id` | `coach_change_status` enum | 1:many per client | FKs `profiles`(old/new coach) | Insert by client; status update by admin only; completion write by client via `completeCoachChangeAction` |
| `escalations` (Concerns) | Support ticket | `id` | `category`, `description`, `status`, `called_client_at`, `resolution_notes` | `escalation_status` enum (open/in_progress/resolved) | 1:many per client | Linked coach (optional) | Insert-only by client (RLS, BR-37); status/notes admin-only |
| `escalation_notes` | Admin-authored update trail on a concern | `id` | `note`, `created_at` | — | Indirect (via escalation) | 1:many per escalation | Read-only to client |
| `conversations` | Client↔coach chat thread | `id` | `client_id`, `coach_id`, `status` | active/closed | 1:many (effectively 1 active + N closed) per client | FK `profiles`(coach); DB-unique-constrained to ≤1 active (BR-33) | Auto-created by system (`ensureConversationForCoachAssignment`); status changed only by coach-change completion |
| `messages` | Individual chat messages | `id` | `body`, `attachment_url`, `read_at`, `sender_id` | — | Indirect (via conversation) | 1:many per conversation | Insert by client (if conversation active, RLS BR-34); `read_at` update by recipient only (BR-35) |
| `notifications` | In-app notification feed | `id` | `user_id`, `type`, `template_key`, `channels` (vestigial), `read_at` | `notification_type` enum (4 values) | 1:many per client (table shared across all roles) | Populated by `createFromTemplate` from every triggering service | Read by client (list + mark-read); never written directly by client |
| `notification_templates` | Stored copy per `template_key` | `id` | `template_key`, subject/body text | — | Reference table | Consumed by `createFromTemplate` | Read-only, server-side only |
| `settings` | Admin-tunable business constants | `key` | e.g. `cancellation_cutoff_hours`, `reschedule_cutoff_hours` | — | Global (not per-client) | Read by booking/reschedule/cancel logic | Read-only to client; write is admin-only |
| `timeline` (events) | Audit/event log used to derive several rules | `id` | `event_type`, `client_id`, timestamp, metadata | — | 1:many per client | Source for pause-days-used, reschedule-weekly-count, renewal "converted" flag | System-written only; never client-writable |
| `subscription_usage_view` | Derived view: sessions used/remaining for display | (view) | `sessions_used`, `sessions_remaining` | — | Per subscription | Reads `bookings` + `subscriptions` | Read-only display source (§8, BR-17 — differs from real enforcement) |
| `sales_view` | Derived view: payment-history display rows | (view) | package name, sale date, amount | — | Per client | Reads `payments` (+ possibly other sale sources — not fully traced, §21) | Read-only display source |

**Cross-entity access/status control (summary):** `subscriptions.status` is the primary gate (regular-session booking, journey stage, chat existence indirectly via coach assignment). `client_onboarding` existence and `recurring_slots` existence are secondary journey-stage gates. `package_tiers` and `payments` never gate access directly — only the `subscriptions` row they produce does.

## 11. API & Service Architecture

**No independently-versioned public REST/GraphQL API exists for third-party or mobile-native consumption (Observed).** All client business logic is invoked through Next.js **Server Actions** (`"use server"` functions in `src/lib/actions/*.actions.ts`), callable only via Next's internal RPC mechanism from this app's own client bundle — not a stable external HTTP contract.

**The two real, independently-callable HTTP endpoints (Observed):**
| Endpoint | Caller | Auth | Purpose |
|---|---|---|---|
| `POST /api/webhooks/razorpay` | Razorpay (server-to-server) | Webhook HMAC signature (`RAZORPAY_WEBHOOK_SECRET`) over raw body — no user token | Reconciles `payment.captured` events the browser never reported (§6.1) |
| `GET/POST /api/cron/session-reminders` | Scheduled job runner | `CRON_SECRET` header/query check | Emails client + coach ~6h pre-session, deduped via `reminder_sent_at` (§14) |

**Server Action layering (Observed, every route follows this pattern):**
```
page.tsx (server component: getAccessToken() from cookies, initial data fetch, stage-gate redirect)
  → *Client.tsx ("use client": forms, local state, calls actions via <form action> or event handlers)
    → *.actions.ts ("use server": requireToken(), input shape validation, calls service, wraps in ActionResult)
      → *.service.ts (Supabase query/write; either RLS-scoped client using the caller's token, or
        supabaseAdmin for privileged writes where the "is this allowed" check is done in application
        code rather than by RLS — e.g. subscriptions, payments)
        → Postgres (tables, RPC functions, RLS policies, triggers)
```
Every server action returns a discriminated `ActionResult<T>` (`{ok:true,data}` / `{ok:false,error}`); `runAction()` wraps the action body so **no server action throws to the caller** — the UI always receives a typed success/failure, never an unhandled exception.

**Notable API/service characteristics found:**
- **Dead/unreachable**: `createDemoSessionOrder` [`payments.service.ts`] — a paid-demo Razorpay order creator, never invoked by any current UI (ISS-9).
- **Duplicate-purpose, different computation**: `subscription_usage_view` (display) vs. `confirm_booking()`'s inline count (enforcement) both answer "how many sessions does this client have left," with different logic (BR-17, ISS-4).
- **Duplicate-purpose, different priority order**: `ClientJourneyStage` (routing) vs. `ClientStatus` (staff display label) both answer "what state is this client in" (§4.2, INC-1).
- **Vestigial/unused column, not an API but affects service contracts**: `notifications.channels` (jsonb) — schema exists, no service reads/writes it (ISS-10); `progress_logs.photo_url` — schema exists, no client write path (ISS-11).
- **A privileged write path with no independent HTTP surface**: subscription creation/activation, pause/resume, and payment fulfillment all go through `supabaseAdmin` inside server actions — a future mobile-native client cannot call these directly against Supabase; it would need either a thin HTTP wrapper or continue to rely on server actions via a webview, per the mobile spec's own architectural note (`docs/CLIENT_PORTAL_MOBILE_SPEC.md §23`, itself Observed-consistent with this pass).

## 12. Authentication & Authorization

**Authentication (Observed):**
- Supabase Auth, JWT-based, cookie session via `@supabase/ssr`.
- Manual signup: `supabase.auth.signUp` with `role` embedded in `raw_app_meta_data` server-side only (BR-38).
- Google OAuth: `signInWithOAuth({provider:'google'})` → `/auth/callback` exchange.
- Session refresh/expiry: standard Supabase cookie lifecycle; no device-binding or "new device" notification found (§17).

**Authorization layers (Observed, all three independently enforce the client/coach/admin boundary — defense in depth, not a single point of failure):**
1. **`middleware.ts`** — every `/client/*`, `/coach/*`, `/admin/*` request: no session → redirect to that path's login; session present but `user_role` JWT claim (or `profiles.role` fallback query) doesn't match the path segment → redirect to that path's login. Uses `getClaims()` (local JWT verification via cached JWKS, ES256) rather than a server round-trip when the custom-claims hook (migration `0054`) has populated `user_role`.
2. **Server action-level role checks** — e.g., `createPackagePurchaseOrder` explicitly requires `role=client` (BR-1) independent of middleware having already gated the route.
3. **RLS policies at the database layer** — e.g., `workout_notes` grants clients `select`-only on the `notes` column path (enforced by policy, not by the UI hiding other fields); `escalations` is insert-only for the client role (BR-37); `conversations`/`messages` reject writes into closed conversations or from non-participants (BR-34) regardless of what the application layer does.

**Access conditions beyond role (Observed):**
- **Subscription/entitlement-based**: regular-session booking requires `subscriptions.status='active'` with unused credit (BR-16, BR-43).
- **Ownership-based**: every client-scoped table's RLS filters to the caller's own `client_id`/`user_id`.
- **State-based**: onboarding/activation/renewal screens are only renderable in their exact matching `ClientJourneyStage`.
- **Time-based**: cancellation/reschedule cutoffs (BR-19, BR-21), 30-day reschedule window (BR-23), weekly rate limits (BR-14, BR-22, BR-26) — all client-role-only; admin actions bypass every one of these.
- **Relationship-based**: chat send requires being a current participant of an `active` conversation (BR-34); coach-change completion requires an existing coach relationship (BR-30).

**Denial behavior:** Route-level denial is a redirect (never a rendered 403 page, per `middleware.ts`). Action-level denial returns `ActionResult` failure rendered as an inline error/empty state. RLS-level denial surfaces as a Postgres/PostgREST error caught by the calling service and converted to an `ActionResult` failure — the client never sees a raw database error (Observed pattern, consistent across all traced services).

## 13. Navigation & Route Map

**Primary nav (persistent sidebar/tab bar, `PortalShell`, Observed):** Dashboard, My Sessions, Book a Session (conditionally hidden), My Schedule, Subscription, My Coach, My Chats (conditionally hidden), Progress, My Concerns, Notifications, Profile, Logout.

**Conditional nav rules:**
- "Book a Session" hidden whenever `hasActivePlan` (a subscription id exists on the journey state) — `hideBookSessionNav` prop, computed in `layout.tsx`.
- "My Chats" hidden until `hasAnyChatAction()` returns true (at least one conversation, active or closed, exists).
- Unread badges: `chatUnreadCount` (from `getMyUnreadChatCountAsClientAction`) and `escalationBadgeCount` (from `getMyUnresolvedConcernsCountAction`) are computed on every page load and passed into `PortalShell`.

**Redirect/route-guard map:**
| From | Condition | To |
|---|---|---|
| Any `/client/*` | No session | `/login/client` (middleware) |
| Any `/client/*` | Session but `role != client` | `/login/client` (middleware) |
| `/client/dashboard` | stage=`marketing` | `/client/plans` |
| `/client/dashboard` | stage=`awaiting_activation` | `/client/activate` |
| `/client/dashboard` | stage=`onboarding` | `/client/onboarding` |
| `/client/dashboard` | stage=`renewal_checkin` | `/client/renewal-checkin` |
| `/client/dashboard` | stage IN (`renewal_scheduling`,`slot_selection`) | `/client/schedule` |
| `/client/activate` | stage != `awaiting_activation` | (redirected away — cannot be deep-linked into) |
| `/client/book` | a subscription id exists on the journey state | `/client/schedule` |
| `/auth/callback` | Google OAuth exchange complete | that role's dashboard (role looked up from `profiles`) |

**Non-route navigation (modals/overlays, not URLs):** `PhoneGateModal`, `MeasurementGateModal`, `SessionsLowGateModal` (portal-wide, precedence order §4.4); coach-change "needs completion" mini-wizard (day/time picker → search → confirm, inline on `/client/coach`); "Edit Profile" and "Change Password" sheets on `/client/profile`; "Raise a Concern" sheet on `/client/concerns`.

**Back-navigation / deep-link considerations (Observed/Inferred):** Stage-gated screens (`/client/activate`, `/client/onboarding`, `/client/renewal-checkin`) re-verify their exact stage server-side on every render, so browser back/forward or a stale bookmark cannot reopen a completed one-time gate — the server redirects away again based on current DB state, not client-side history.

## 14. Events & Notifications

All notifications are **event-triggered** (fired inline by the service function that caused them), with exactly **one time-based exception**: session reminders (cron). Every notification writes an in-app `notifications` row via `createFromTemplate`, interpolating a stored `notification_templates` row. The `notification_type` enum has only 4 coarse values (`booking | reminder | feedback | system`); the ~30+ distinct events are differentiated by a free-text `template_key`, not the enum (ISS-10 candidate — enum granularity mismatch, noted in §19).

| Trigger | Event logic | Data change | Recipient | Notification/action | Client UI result |
|---|---|---|---|---|---|
| Plan purchased | `purchaseMyPlanForClient` succeeds | `subscriptions` insert | Client | In-app + email (`plan_purchased_client`) | Notification bell increments; email received |
| Plan activated | `activateMyPlan` succeeds | `subscriptions.status→active` | Client | In-app + email (`plan_activated_client`) | Same |
| Subscription paused/resumed | Client action | `subscriptions.status` change | Client + Coach | In-app + email, both parties | Both see it |
| Session booked (regular) | Booking action succeeds | `bookings` insert | Client + Coach | In-app + email; client also SMS (`session_booked`) | Sessions list updates |
| Demo booked | `confirmDemoBooking` | `bookings` insert (`assessment`) | Client + Coach | In-app + email; client also SMS (`demo_booked`) | Same |
| Session cancelled (by client) | `cancel_booking` | `bookings.status→cancelled` | Coach + all Admins | In-app + email | The cancelling client is NOT re-notified of their own action |
| Session cancelled (by coach/admin) | `cancel_booking` | `bookings.status→cancelled` | Client | In-app + email | Sessions list updates, cancellation banner |
| Session rescheduled | `reschedule_booking` | `bookings` time fields updated | Client (always) + Coach (if client/admin-initiated) + Admins (if client-initiated) | In-app + email; client also SMS (`session_rescheduled`) | Sessions list updates |
| Attendance marked | `markAttendance` | `attendance` insert/update | Client + Coach | In-app + email; client also SMS (`attendance_present`/`attendance_absent`) | Sessions/dashboard reflect completed/missed |
| Session reminder (~6h before) | Cron job (`/api/cron/session-reminders`) | `bookings.reminder_sent_at` set | Client + Coach | Email only (no SMS, no push) | None until email opened |
| New chat message | `sendMessage` | `messages` insert | The other participant | In-app only (preview truncated to 80 chars) | Chat badge/unread count updates |
| Progress/measurement updated | Client self-update only (not admin backfill) | `progress_logs` insert | Client's current coach | In-app only | Coach-side only; no client-visible effect beyond their own log appearing |
| Coach-change approved/rejected (no immediate replacement) | Admin resolves request | `coach_change_requests.status` | Client | In-app + email | Banner state changes on My Coach |
| Schedule changed / coach changed | Schedule/coach-change completion | `recurring_slots` change | Client | In-app + email + SMS (`schedule_changed`, `coach_changed`) | Schedule/coach page updates |
| Shadow coach assigned | Admin approves coach leave, assigns shadow | `shadow_assignments` insert | Client + the shadow coach (separate templates) | In-app + email, both | One-time acknowledgeable banner on My Sessions |
| Escalation raised (linked coach) | Client raises a concern naming/implying a coach | `escalations` insert | That coach | In-app + email (`escalation_raised_to_coach`) | None client-visible beyond ticket appearing in their own list |
| Escalation resolved | Admin resolves | `escalations.status→resolved` | Client | In-app + email (`escalation_resolved_client`) | Green "Resolution" callout on Concerns screen |

**No push notifications, no WhatsApp integration exist anywhere in the code (Observed — confirmed absent from `notifications.service.ts`, `sms.service.ts`, `email.service.ts`, and all migrations).**

## 15. Integrations

| Integration | Purpose | Trigger | Data sent | Data received | Auth | Failure handling | Client-facing impact |
|---|---|---|---|---|---|---|---|
| Razorpay (Orders API + Checkout.js) | Payment collection | Purchase click | Amount (paise), receipt id | `razorpay_order_id`, `payment_id`, `signature` | `RAZORPAY_KEY_ID`/`RAZORPAY_KEY_SECRET` | Signature mismatch → hard fail, no subscription; capture-but-fulfillment-fails → `paid_unfulfilled` (BR-4) | Checkout UI opens in-browser; failures show inline errors |
| Razorpay Webhook | Server-to-server payment reconciliation | `payment.captured` event | — | Webhook payload + `RAZORPAY_WEBHOOK_SECRET`-signed body | Webhook HMAC | Always returns HTTP 200 regardless of internal outcome (BR-42) | Invisible to client unless it's the only path that saved a lost-browser-session purchase |
| Zoom (Server-to-Server OAuth) | Video meeting creation | First "Join" attempt on a booking | Meeting request (topic, time, host) | `join_url` | `ZOOM_ACCOUNT_ID`/`ZOOM_CLIENT_ID`/`ZOOM_CLIENT_SECRET`/`ZOOM_HOST_EMAIL` (one shared host account for all coaches) | Env vars unset → "Join" stays disabled, "Join link not ready yet," no crash | Join button behavior |
| Resend (email) | All email notifications | Every notification event in §14 | Recipient, template-rendered subject/body | — | `RESEND_API_KEY` | Fail-soft — never blocks the triggering action (BR-40) | Email received or silently not, no client-visible error |
| MSG91 (SMS + OTP) | Phone OTP verification; SMS notifications | Signup phone step, PhoneGateModal, SMS-eligible events (§14) | Phone number, template id | OTP code (out of band) | `MSG91_AUTH_KEY`, per-event `MSG91_TEMPLATE_ID_<EVENT>` | India DLT template approval required; currently has a temporary bypass for OTP (ISS-1) | Phone OTP screen; SMS receipt for booking/reschedule/attendance events |
| Supabase (Auth/Postgres/Storage/Realtime) | Identity, data, file storage, live chat | Continuous | All application data | All application data | Session JWT (client-scoped) / `SUPABASE_SERVICE_ROLE_KEY` (admin-scoped, server-only) | RLS-enforced denial surfaces as a caught error → `ActionResult` failure | Entire portal's data layer |

**No other third-party integrations found** (no analytics SDK, no push-notification provider, no calendar-sync integration observed in the client-portal code path — **UNKNOWN — REQUIRES VERIFICATION** whether an analytics tag exists at the root layout level outside the traced client-portal-specific files).

## 16. Workflow Dependencies

Cross-function dependencies where one workflow's data/state change alters another's behavior:

| A (upstream) | Change produced | B (downstream) affected |
|---|---|---|
| Payment verification (§6.1) | `subscriptions` row created (`awaiting_activation`) | Journey-stage redirect gate (§4.1) now forces `/client/activate` on every page |
| Plan activation (§7.1) | Old `active` subscription force-`inactive` (BR-6) | Subscription page's "expired" derivation (§9.2); that old subscription's `recurring_slots` are NOT automatically cancelled by this step alone — cancellation only happens via coach-change or explicit schedule change (**Inferred boundary** — activation itself doesn't touch `recurring_slots`) |
| Onboarding submission (§7.2) | `client_onboarding` row + possible "Day 1" `progress_logs` row (BR-8) | Dashboard's "Progress Since Day 1" comparison; journey stage advances past `onboarding` |
| Recurring schedule confirmed (§7.3) | `recurring_slots` + generated `bookings` | "Book a Session" nav hidden; My Coach upgrades to full card; My Chats nav appears (conversation auto-created); journey stage reaches `active` |
| Coach marks attendance + submits notes (Coach Portal) | `bookings.status→completed`, `workout_notes` row | Client's Sessions/Progress pages show a "Coach notes" line; enables session rating (BR-26 requires `completed` status) |
| Coach-change completion (§12) | Old `recurring_slots`/`upcoming bookings` cancelled, new ones created; old conversation closed, new one opened | My Coach card updates; My Chats shows a new active thread + the old one moved to "Past Coaches" (read-only forever) |
| Admin approves coach leave + assigns shadow (Admin Portal) | `shadow_assignments` row | Client's My Sessions shows a temporary "Covering for {coach}" banner for affected bookings, no change to `recurring_slots` |
| Client cancels a recurring-slot-linked booking (§10, Session module) | `bookings.status→cancelled` | `cancel_booking` immediately generates one replacement occurrence (BR-20) — a same-transaction dependency |
| Client raises a concern naming a coach | `escalations` insert | That coach is notified; admin must log `called_client_at` before status can move (BR-36) — a downstream admin-workflow gate invisible to the client |
| Session count reaches ≤5 remaining | `SessionsLowGateModal` becomes visible (client) and staff-side "Renewal Opportunity" flag becomes visible at ≤10 (wider staff threshold) | Enables the purchase-gate renewal exception (BR-2) — this is what makes "Renew Now" functionally possible at all |
| A demo booking's status becomes `completed`/`missed` | Journey stage `demo_booked→demo_completed` | Coach page reverts from demo-coach card to no-coach state (a deliberate design choice, per code comments) unless a plan is purchased |

## 17. Edge Cases & Error Handling

| Edge case | Observed behavior |
|---|---|
| Required data missing (e.g., no phone) | `PhoneGateModal` forces open on every portal page; currently dismissible via a temporary skip (ISS-1) |
| Invalid data submitted | Server actions validate and return `ActionResult` failure; UI renders inline error, no crash |
| Payment provider API fails mid-checkout | Razorpay Checkout surfaces its own error UI; no `payments` row is marked paid; client can retry |
| Payment successful but subscription not immediately visible | `paid_unfulfilled` status; client shown a support-escalation message with an order reference; no auto-retry, no auto-refund (BR-4) |
| Payment pending (browser closed mid-checkout) | Webhook reconciliation (`fulfillPaymentByWebhook`) completes it server-to-server if Razorpay confirms `payment.captured` |
| Database operation fails | Caught by the service/action layer, surfaced as a typed `ActionResult` failure — no unhandled crash path observed anywhere in the traced code |
| User loses connection mid-action | Standard fetch/Server-Action failure; action simply doesn't complete, no partial-write pattern observed (actions are effectively single-request) |
| User refreshes mid-flow | Server-rendered pages recompute stage/data fresh on every load — no stale client cache to reconcile |
| User navigates backward to a completed one-time gate | Server re-verifies the exact stage condition and redirects away again (§13) |
| User repeats an action (e.g., double-clicks Purchase) | `payments`/order creation has no explicit dedupe against a just-created `created` order — **UNKNOWN — REQUIRES VERIFICATION** whether the UI disables the button during the request (likely, but not independently confirmed this pass) |
| Concurrent action (e.g., two tabs booking the last session slot) | `confirm_booking()` runs inside one transaction row-locking the subscription row and the temporary slot hold — this specific race is handled; whether the SAME protection extends to two different session-type bookings racing on the same coach/time slot was not independently re-verified this pass (**Inferred** consistent based on `0053`'s transactional design, not exhaustively re-traced for every booking path) |
| Related entity changes (coach relationship ends) | Coach-change cascades correctly close chat/cancel slots (BR-32); a lapsed subscription does NOT itself touch the coach relationship |
| Status changes unexpectedly (e.g., admin pauses a client) | Same `subscriptions.status='paused'` path as client-initiated pause — client sees the same blocked-booking behavior and Resume option regardless of who paused it |
| Record no longer exists (e.g., a coach is deactivated) | **UNKNOWN — REQUIRES VERIFICATION**: exact client-facing behavior when a currently-assigned coach's `profiles`/`coach_profiles` row is deactivated outside of the coach-change flow was not traced in this pass |
| Workflow interrupted (e.g., abandons onboarding form) | No partial-save observed — `client_onboarding` is a single insert; an interrupted attempt simply leaves no row, and the client is presented the same form again on return |
| Workflow cancelled (e.g., abandons checkout) | `payments` row stays `status='created'` indefinitely; no expiry/cleanup job found (§6.1) |
| Workflow expires (e.g., reschedule cutoff passes while the page is open) | UI-disabled button plus a server-side re-check on submit — both layers enforce the cutoff independently (§8, "Validation & Error Handling" pattern) |
| Recurring schedule matched but coach has intervening leave/conflicts on some future dates | Generation function silently produces fewer than the requested number of upcoming sessions; no error surfaces to the client (BR-12, ISS-3) |
| Client books right up against their package's session limit | Server-side count of `upcoming + completed` bookings against `sessions_total` blocks the booking even if the differently-computed "remaining" display still showed a nonzero number a moment earlier (BR-16/BR-17, ISS-4) |
| Client with an "expired" status attempts to book a free demo again | The demo gate and subscription gate are evaluated independently; the exact intersection for a fully-lapsed client was not conclusively traced this pass (§21) |
| Google OAuth signup with no phone | `PhoneGateModal` forced open on every portal page until resolved or skipped (ISS-1) |
| Client purchases another plan while already active | Blocked unless `sessions_remaining <= 5` (BR-2) |
| Network/API failure generally | Every server action catches internally and returns a typed failure the UI renders as an inline error/empty state |

## 18. Current Implementation Issues

Each issue is classified per the required taxonomy (WORKING CORRECTLY / WORKING BUT INCORRECT / PARTIALLY IMPLEMENTED / BROKEN / NOT IMPLEMENTED / IMPLEMENTED DIFFERENTLY IN DIFFERENT PLACES / DEAD-UNUSED / UNKNOWN). Only non-"working correctly" items are itemized here (the full functionality inventory in §23 records every item's status, including the many that ARE working correctly).

**ISS-1 — Phone OTP verification is bypassable (WORKING BUT INCORRECT / security-relevant).**
- **Current behavior:** `SignupForm.tsx` and `PhoneGateModal.tsx` both expose a "Skip for now (demo — MSG91 not verified yet)" button that saves the typed phone number through the identical write path (`setMyPhoneAction`) as a verified OTP save, with no verified/unverified flag stored.
- **Expected behavior (per the code's own stated intent):** phone verification is supposed to be mandatory and non-skippable; the bypass is explicitly commented `TEMPORARY`, pending MSG91 KYC/DLT template approval.
- **Evidence:** literal code comments in both components; identical downstream write regardless of path taken.
- **Root cause:** external dependency (MSG91 DLT template approval) not yet complete; a temporary workaround was shipped instead of gating signup entirely.
- **Frontend:** `SignupForm.tsx`, `PhoneGateModal.tsx`. **Backend:** `phone-otp.actions.ts` → `setMyPhoneAction`. **DB:** `profiles.phone` (no "verified" boolean tracked at all — see ISS-1b below).
- **Severity:** Medium-High (identity/contact-channel integrity; SMS notifications may silently fail to an unverified/mistyped number).
- **Dependencies:** SMS notification delivery (§14) assumes a real, reachable number.

**ISS-1b — No `phone_verified` flag exists at all (PARTIALLY IMPLEMENTED).**
- **Current behavior:** `profiles.phone` stores the number with no column distinguishing OTP-verified from skip-bypassed entries.
- **Expected behavior:** a verification-state column would let the rest of the system (and a future non-skippable enforcement) distinguish trusted from untrusted numbers.
- **Evidence:** absent from all `profiles`-related migrations reviewed.
- **Severity:** Medium. **Dependencies:** ISS-1.

**ISS-2 — Schedule-pattern match check is weaker than the real per-booking conflict check (WORKING BUT INCORRECT).**
- **Current behavior:** `isDayTimeFreeForCoach` (used when matching/confirming a weekly pattern, BR-11) only checks the coach's availability template and other clients' recurring commitments. It does not check coach leave or actual booked sessions.
- **Expected behavior:** a "confirmed" schedule match should reflect true availability at generation time, or the client should be warned the match is provisional.
- **Evidence:** direct comparison of `isDayTimeFreeForCoach` vs. `generate_bookings_from_recurring_slot`'s later, stricter checks (leave, existing bookings, real conflicts).
- **Root cause:** two-phase design (match, then generate) where the cheaper first phase was never tightened to match the second phase's rigor.
- **Frontend:** `ScheduleSetupClient.tsx` (shows "matched" as final). **Backend:** `scheduling.service.ts`. **DB:** `recurring_slots`, coach `availability`/`leave` tables.
- **Severity:** Medium. **Dependencies:** ISS-3 (this is the root cause of that downstream symptom).

**ISS-3 — Recurring-schedule generation can silently under-deliver (PARTIALLY IMPLEMENTED / WORKING BUT INCORRECT).**
- **Current behavior:** `generate_bookings_from_recurring_slot` scans up to 60 calendar days trying to place the requested count (usually 4), silently skipping any date blocked by leave/an existing booking/a real conflict. If fewer than requested are placeable, it simply returns fewer rows with no exception and no signal to the client.
- **Expected behavior:** a client who confirms "4 sessions/week" should either get 4 or be told why they didn't.
- **Evidence:** function logic itself (migration containing `generate_bookings_from_recurring_slot`); no calling code path surfaces a shortfall count to the client.
- **Root cause:** the function was designed to be permissive/non-blocking (never fail schedule confirmation outright) but this trades away visibility into partial success.
- **Frontend:** `ScheduleSetupClient.tsx`/`MySessionsClient.tsx` (would show fewer upcoming sessions with no explanation). **Backend:** the Postgres function itself. **DB:** `bookings`, `recurring_slots`.
- **Severity:** Medium-High (client-perceived: "I paid/scheduled for 4 and only got 2, with no explanation").
- **Dependencies:** ISS-2.

**ISS-4 — "Sessions remaining" display figure and booking-time enforcement are two different computations (IMPLEMENTED DIFFERENTLY IN DIFFERENT PLACES).**
- **Current behavior:** `/client/subscription` shows `sessions_remaining` from `subscription_usage_view` (a derived Postgres view). `confirm_booking()` (migration `0053`) independently counts bookings with `status IN (upcoming, completed)` against `sessions_total` at the moment of booking confirmation.
- **Expected behavior:** a single source of truth for "how many sessions does this client have left," or an explicit, documented reason the two differ (e.g., display should also count `upcoming` — unclear which is "more correct" from the client's point of view).
- **Evidence:** direct reading of both computations — they are structurally different (view aggregation vs. inline transactional count).
- **Root cause:** the enforcement function (`confirm_booking`) was hardened later (migration `0053`'s own comment notes an earlier version had NO usage check at all) without the display view being revisited to match.
- **Frontend:** `MySubscriptionClient.tsx`. **Backend:** `subscription_usage_view` vs. `confirm_booking()`. **DB:** `bookings`, `subscriptions`.
- **Severity:** Medium (can show a nonzero "remaining" count to a client who then gets rejected at booking time with "No sessions remaining on this package").
- **Dependencies:** Any consumer of `subscription_usage_view` for anything beyond casual display (e.g., a future mobile app must not treat it as authoritative).

**ISS-5 — `ClientJourneyStage` and `ClientStatus` are two independent, differently-prioritized state derivations (IMPLEMENTED DIFFERENTLY IN DIFFERENT PLACES).**
- **Current behavior:** `ClientJourneyStage` (9 states, routing-authoritative) and `ClientStatus` (6 buckets: `paused > active > created > expired > demo > not_paid`, staff-display-only) are computed by separate functions reading overlapping but not identical inputs (the former also consults `client_onboarding`/`recurring_slots`; the latter does not).
- **Expected behavior:** UNKNOWN whether this divergence is intentional (routing vs. display are legitimately different concerns) or an unintentional duplication that should share a single derivation.
- **Evidence:** `src/lib/actions/client-journey.actions.ts` vs. `src/lib/client-status.ts`, read side by side.
- **Severity:** Low-Medium (no client-facing bug identified — `ClientStatus` is never shown to the client directly — but a maintenance/consistency risk: any future change to one will not automatically apply to the other).
- **Dependencies:** Any Coach/Admin UI relying on `ClientStatus` should not be assumed to agree with what the client's own portal is showing them.

**ISS-6 — "Forgot password" is a dead UI element (NOT IMPLEMENTED / BROKEN, depending on framing).**
- **Current behavior:** `LoginForm.tsx` renders a "Forgot password?" button with no `onClick` handler wired.
- **Expected behavior:** either a working password-reset flow, or the button should not be rendered at all.
- **Evidence:** direct inspection of `LoginForm.tsx`.
- **Root cause:** UNKNOWN — likely an incomplete feature left in the UI.
- **Severity:** Medium (a real client-facing dead end for locked-out users).
- **Dependencies:** None (self-contained login-page issue).

**ISS-7 — Pause-days allowance is not enforced (PARTIALLY IMPLEMENTED).**
- **Current behavior:** `pause_days_allowed` (from `package_tiers.default_pause_days`) is shown alongside a live-derived `pause_days_used`, but no code path found blocks a client from pausing once the allowance is exhausted (BR-44).
- **Expected behavior:** UNKNOWN whether this is intended as a soft/informational limit or should be hard-enforced — no explicit product rule found stating either way in code comments.
- **Evidence:** absence of any check against `pause_days_allowed` in the pause action.
- **Severity:** Low-Medium (business/financial impact only, not a crash risk).
- **Dependencies:** None identified.

**ISS-8 — Demo-booking re-eligibility for a fully lapsed ("expired") client is not conclusively traceable (UNKNOWN — REQUIRES VERIFICATION, tentatively PARTIALLY IMPLEMENTED).**
- **Current behavior:** the demo gate (`getMyLatestDemoSession`) and the subscription/journey-stage gate are evaluated by separate code paths; a client with prior subscription history but nothing currently `active`/`paused`/`awaiting_activation` falls through to the demo/marketing branch (§4.1 step 3) exactly like a brand-new client, which would suggest they CAN book another demo — but this specific intersection (does the system correctly treat a lapsed client as demo-eligible again, and is that the intended product behavior at all) was not exercised end-to-end in this pass.
- **Severity:** Low-Medium. **Dependencies:** §21 unknowns.

**ISS-9 — Paid-demo code path is dead/unused (DEAD/UNUSED).**
- **Current behavior:** `createDemoSessionOrder` [`payments.service.ts`] creates a Razorpay order for a demo session but is called by no current UI; `bookDemoSessionAction` always takes the free path.
- **Evidence:** no call site found for `createDemoSessionOrder` outside its own definition and (possibly) tests.
- **Severity:** Low (dead code, no runtime risk, but a maintenance trap if someone assumes it's live).

**ISS-10 — `notifications.channels` column is vestigial (DEAD/UNUSED schema).**
- **Current behavior:** a jsonb `channels` column exists on `notifications`, described in migration comments as being "for a future dispatcher," but no service reads or writes it — every notification's channel (in-app/email/SMS) is instead decided ad hoc, separately, by each calling service.
- **Severity:** Low. **Dependencies:** None functionally, but represents an unrealized abstraction — see ISS-11 for the parallel `notification_type` granularity issue.

**ISS-10b — `notification_type` enum is far coarser than actual event variety (WORKING BUT INCORRECT, design-level).**
- **Current behavior:** only 4 enum values (`booking | reminder | feedback | system`) represent ~30+ distinct events; real differentiation happens via a free-text `template_key` column instead.
- **Expected behavior:** UNKNOWN whether finer-grained typing was ever intended — the enum may simply be intentionally coarse for filtering purposes while `template_key` carries the real granularity.
- **Severity:** Low (works, but is an architectural inconsistency worth flagging for the APP-audit comparison).

**ISS-11 — `progress_logs.photo_url` has no writer (PARTIALLY IMPLEMENTED / DEAD schema).**
- **Current behavior:** the column exists in the schema; no client UI (Progress page, onboarding form) implements an upload flow that populates it.
- **Expected behavior:** UNKNOWN — either progress-photo upload was planned and never finished, or the column is entirely vestigial.
- **Evidence:** column present in migrations; absent from `ProgressClient.tsx` and all traced progress-log write paths.
- **Severity:** Low. Treat as a genuine product gap only if progress photos are an explicit requirement elsewhere (§20 discusses the "do not assume missing" rule applied here).

## 19. Inconsistencies

- **INC-1 (= ISS-5):** `ClientJourneyStage` vs. `ClientStatus` — two independent state derivations for "what state is this client in," different priority orders, different inputs, no shared implementation.
- **INC-2 (= ISS-4):** Sessions-remaining display (`subscription_usage_view`) vs. sessions-remaining enforcement (`confirm_booking()`'s inline count) — two different computations answering the same question, capable of disagreeing.
- **INC-3:** Stage-gate redirect logic exists in two forms simultaneously: a single hard redirect at `/client/dashboard`, AND independent re-branching on the same `ClientJourneyStage` value inside `/client/subscription`, `/client/book`, `/client/schedule`, and `/client/coach` for their own contextual empty states. These are two separate reads/interpretations of the same underlying value rather than one shared derived prop passed down — functionally consistent today (both consult the same source function), but structurally duplicated logic that could drift if one call site is updated and another isn't.
- **INC-4:** Cancellation cutoff (`cancellation_cutoff_hours`, default 12h) and reschedule cutoff (`reschedule_cutoff_hours`, default 1h) are both admin-configurable via the same `settings` table pattern, but use very different default magnitudes (12h vs. 1h) with no code comment explaining the asymmetry — plausibly intentional (rescheduling is less costly to the business than cancelling outright) but not confirmed by any explicit business-rule documentation in code.
- **INC-5:** Pre-purchase demo booking and post-purchase regular booking share the same underlying `bookings` table and much of the coach-matching machinery, but demo booking has no "sessions remaining" concept at all (exempt from BR-16 entirely) — consistent by design (BR-45), listed here only because it means a mobile/API client cannot treat "booking" as one uniform operation without branching on `session_type` first.

## 20. Missing / Incomplete Functionality

Per the source-of-truth principle in this audit's brief, an item is only listed here where the codebase itself provides evidence of an incomplete or absent-but-referenced capability — not because a "typical" coaching app might have it.

- **Forgot-password flow** — referenced by a rendered (but non-functional) UI button in `LoginForm.tsx`; the button's existence is direct evidence the feature was intended (ISS-6).
- **Phone-verified flag** — the presence of an OTP-verification UI step, alongside a bypass that produces indistinguishable stored data, is evidence the system intends to track verification state but currently has no field to do so (ISS-1b).
- **Progress-photo upload** — the `progress_logs.photo_url` column's existence is direct schema evidence a photo-attached measurement log was intended; no client write path exists (ISS-11).
- **Shortfall signaling for recurring-schedule generation** — the generation function's own permissive, no-exception design (BR-12) combined with the client-facing "confirmed" language in `ScheduleSetupClient.tsx` is evidence of a gap between what's promised and what's guaranteed (ISS-3).
- **Email-change UI** — no code path found anywhere in the client portal; unlike forgot-password, there is no dead button or other in-code evidence this was ever built or planned, so this is recorded as an absence, not a confirmed gap — **do not treat as "missing" in the strict sense of this audit's own rule**; it simply does not exist and nothing in the code claims it should.
- **Account deletion/deactivation (client-initiated)** — same treatment as email-change: absent, with no in-code evidence of intent. Not classified as "missing," simply "not implemented" with no further evidence trail.
- **Subscription cancellation (distinct from pause) and refunds** — absent, with no in-code evidence of intent (no dormant action, no schema column, no dead button found). Recorded as NOT IMPLEMENTED, not MISSING.
- **Coupons/discounts/promo codes** — same treatment: absent, no evidence of intent anywhere in `package_tiers` or `payments` schema or code.
- **Diet/nutrition/meal-plan module** — same treatment: absent entirely; the coaching artifacts are sessions + notes + progress logs only (§1, §11 of the mobile-spec's own equivalent analysis, independently reconfirmed by this pass's schema/route inventory).

## 21. Unknowns / Requires Verification

- Whether the Supabase project's "Confirm email" dashboard setting is actually enabled in the live production environment — this is infrastructure configuration invisible in code, and it determines whether the email-OTP signup step is ever actually shown.
- The exact resume-step UI behavior for a client who abandons the signup wizard mid-flow and later logs back in with an incomplete phone/email verification.
- Whether stale `payments` rows left in `status='created'` (abandoned checkout) are ever purged by any job, or persist indefinitely; and whether an accumulation of them has any downstream effect (none identified, but not exhaustively traced).
- The exact client-facing demo-re-booking eligibility rule for a client whose subscription history exists but is not currently active/paused/awaiting (ISS-8).
- Whether `sales_view` (the client payment-history source) includes demo-session line items or only package purchases.
- Whether the `jspdf`/`jspdf-autotable` npm dependencies (present in `package.json`) are used anywhere to generate a client-visible invoice/receipt — not found in the traced client-portal code; may be admin-only or entirely unused.
- The full content/trigger list of `notification_templates` beyond the `template_key`s actually referenced in the traced action/service files — additional templates may exist that no code path in this pass exercised.
- Whether the day-one-vs-latest progress comparison is rendered directly on the Progress screen itself or only on the Dashboard — both consume the same underlying data; exact screen placement for the Progress screen specifically was not conclusively confirmed.
- Exact client-facing behavior when a currently-assigned coach's profile is deactivated by an admin outside of the formal coach-change-request flow.
- Whether any client-side analytics/tracking integration exists outside the specifically-traced client-portal files (root-level layout/scripts were not exhaustively audited in this pass, which was scoped to `src/app/client/**` and its direct dependencies).
- Whether double-submission protection (e.g., a disabled button during an in-flight request) is consistently implemented across all mutation forms, or only some — not exhaustively verified form-by-form.
- The precise concurrency behavior when two different clients' actions could race on the same coach/timeslot outside the specific `confirm_booking()` transaction (e.g., two clients rescheduling into the same open slot simultaneously) — the credit-check transaction (BR-16) is confirmed row-locked; broader slot-contention locking was not independently re-verified for every code path this pass.

## 22. Complete End-to-End Client Lifecycle

```
ENTRY: Visitor lands on marketing site / /signup / /login/client
  → CLIENT STATE: unauthenticated
  → AVAILABLE FUNCTIONALITY: register (manual or Google), log in
  → USER ACTION: completes signup wizard or logs in
  → BUSINESS LOGIC: BR-38 (server-assigned role), BR-39 (role-portal boundary)
  → DATA CHANGE: auth.users + profiles + client_profiles created (signup) or none (login)
  → STATE CHANGE: authenticated, ClientJourneyStage = marketing (new) or recomputed (returning)
  → RESULT: redirected into the portal shell
  → NEXT AVAILABLE WORKFLOW: browse Plans, book a free Demo, or (returning client) land wherever
    their current stage routes them

STAGE: marketing
  → AVAILABLE FUNCTIONALITY: browse/compare/view plans, book free demo, edit profile, log progress,
    raise concerns, view (empty) subscription/sessions/coach/notifications
  → USER ACTION: books a demo OR purchases a plan
  → BUSINESS LOGIC: BR-15 (measurement staleness blocks demo booking), BR-45 (demo always free),
    BR-1/BR-2 (purchase gate)
  → DATA CHANGE: bookings insert (demo) OR payments+subscriptions insert (purchase, after BR-3 verification)
  → STATE CHANGE: → demo_booked, OR → awaiting_activation
  → RESULT: demo confirmation screen, OR "Congratulations!" purchase modal
  → NEXT AVAILABLE WORKFLOW: (demo path) await session → demo_completed → purchase; (purchase path) →
    /client/activate

STAGE: demo_booked → demo_completed
  → AVAILABLE FUNCTIONALITY: view/cancel/reschedule the demo (same cutoff rules as any booking), rate
    the completed demo
  → USER ACTION: attends (or misses) the demo; optionally rates it
  → BUSINESS LOGIC: coach marks attendance (Coach Portal); BR-28 (missed sweep) as fallback
  → DATA CHANGE: bookings.status→completed/missed; attendance row; workout_notes (coach-authored)
  → STATE CHANGE: → demo_completed
  → RESULT: rating prompt, funneled back to Plans
  → NEXT AVAILABLE WORKFLOW: purchase a plan (back to the marketing-stage purchase path)

STAGE: awaiting_activation
  → AVAILABLE FUNCTIONALITY: only /client/activate (hard-gated)
  → USER ACTION: picks a start date (>= tomorrow)
  → BUSINESS LOGIC: BR-5 (one-time lock), BR-6 (atomic renewal supersession)
  → DATA CHANGE: subscriptions.status→active, activated_at set; (renewal only) old subscription→inactive
  → STATE CHANGE: → onboarding (first-time) OR renewal_checkin/renewal_scheduling (renewal) OR
    slot_selection (if earlier gates already satisfied)
  → RESULT: redirect chain continues automatically
  → NEXT AVAILABLE WORKFLOW: onboarding OR renewal check-in/scheduling OR schedule setup

STAGE: onboarding (first-time only)
  → AVAILABLE FUNCTIONALITY: only /client/onboarding
  → USER ACTION: submits one-time medical/goals/measurement intake
  → BUSINESS LOGIC: BR-7 (insert-once), BR-8 (Day-1 progress_logs side effect)
  → DATA CHANGE: client_onboarding insert; conditional progress_logs insert
  → STATE CHANGE: → renewal steps (N/A for first-time) → slot_selection
  → NEXT AVAILABLE WORKFLOW: recurring schedule setup

STAGE: renewal_checkin (renewal only)
  → AVAILABLE FUNCTIONALITY: only /client/renewal-checkin
  → USER ACTION: reviews historical chart, submits a fresh baseline measurement
  → BUSINESS LOGIC: BR-13 (bypasses the weekly rate limit)
  → DATA CHANGE: progress_logs insert
  → STATE CHANGE: → renewal_scheduling
  → NEXT AVAILABLE WORKFLOW: renewal schedule confirmation

STAGE: slot_selection / renewal_scheduling
  → AVAILABLE FUNCTIONALITY: only /client/schedule
  → USER ACTION: picks a weekly pattern (+ trainer/gender preference if renewal/change), confirms
  → BUSINESS LOGIC: BR-9/BR-10 (coach matching), BR-11 (known gap), BR-12 (generation, known gap)
  → DATA CHANGE: recurring_slots insert; bookings auto-generated
  → STATE CHANGE: → active
  → RESULT: "Book a Session" nav disappears; My Coach upgrades; My Chats appears (conversation
    auto-created)
  → NEXT AVAILABLE WORKFLOW: full active-portal steady state

STAGE: active (steady state)
  → AVAILABLE FUNCTIONALITY: full portal — sessions (view/cancel/reschedule/rate/join), schedule
    changes, coach view + change-request, chat, progress logging, concerns, notifications, profile,
    subscription self-service (pause/resume, payment history), renewal purchase
  → USER ACTION: any of the above, repeatedly, indefinitely
  → BUSINESS LOGIC: the full BR-1..BR-45 set as applicable per action; the three portal-wide gates
    (phone/measurement/sessions-low, §4.4) continuously layered on top
  → DATA CHANGE / STATE CHANGE: per-action, detailed in §5–§9
  → RESULT: ongoing coaching relationship
  → NEXT AVAILABLE WORKFLOW (exit branches):
      a) sessions_remaining reaches 1-5 → SessionsLowGateModal → renewal purchase → back to
         awaiting_activation (renewal path)
      b) client pauses → paused (booking blocked, everything else open) → client resumes → active
      c) client requests a coach change → pending → admin resolves → (completion sub-flow if needed) →
         new coach, new chat thread, cascade-cancelled old slots/bookings → active (with new coach)
      d) subscription lapses to inactive with nothing newer (rare — normally superseded by renewal
         before this happens) → falls through to demo/marketing stage evaluation, client is never
         permanently stuck → can re-purchase from marketing-equivalent state

TERMINAL/RECURRING NOTE: There is no true "terminal" client state in the implementation — even a fully
  lapsed subscription always falls through to a bookable/purchasable state (§4.1 step 3). The only
  irreversible-from-the-client's-side actions are: onboarding submission (BR-7), plan activation (BR-5),
  and a closed chat conversation (BR-34) — all three remain permanently in that state but do not block
  the client from continuing to use the rest of the portal or from renewing/changing coaches again.
```

## 23. Master Functionality Inventory

Status legend: **OK** = working correctly · **BUG** = working but incorrect · **PARTIAL** = partially implemented · **DEAD** = dead/unused · **N/A-DEAD** = not implemented, no evidence of intent.

| ID | Module/Area | Functionality | Entry Point | Route | Frontend | API/Service | Backend | Database | Permission | Client State (any applicable) | Status | Dependencies |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| F-01 | Auth | Manual signup (name/email/phone/password) | `/signup` | `/signup` | `SignupForm.tsx` | Supabase `auth.signUp` (direct, not a server action) | `handle_new_user()` trigger | `auth.users`, `profiles`, `client_profiles` | Public | pre-account | OK | BR-38 |
| F-02 | Auth | Google OAuth signup/login | `/signup`, `/login/client` | `/auth/callback` | `GoogleAuthButton.tsx` | Supabase `signInWithOAuth` | Role lookup on callback | `profiles` | Public | pre-account or any | OK | BR-38, BR-39 |
| F-03 | Auth | Email OTP verification | Signup wizard step 2 | `/signup` | `SignupForm.tsx` | Supabase `verifyOtp(type:'signup')` | Supabase Auth | `auth.users` | Public | pre-account | PARTIAL (env-dependent, may be skipped entirely) | — |
| F-04 | Auth | Phone OTP verification | Signup wizard step 3 / `PhoneGateModal` | `/signup`, any `/client/*` | `SignupForm.tsx`, `PhoneGateModal.tsx` | `phone-otp.actions.ts` (MSG91) | `sms.service.ts` | `profiles.phone` | Public / any client | pre-account or phone-missing | BUG (ISS-1, skippable) | ISS-1, ISS-1b |
| F-05 | Auth | Login (email/password) | `/login/client` | `/login/client` | `LoginForm.tsx` | Supabase `signInWithPassword` | Role check | `profiles.role` | Public | any | OK | BR-39 |
| F-06 | Auth | Role-mismatch login rejection | Login | `/login/client` | `LoginForm.tsx` | Client-side role check + `middleware.ts` | — | `profiles.role` | Public | any | OK | BR-39 |
| F-07 | Auth | Logout | Portal shell | any `/client/*` | `PortalShell` | Supabase `signOut` | — | session cookie | any authenticated | any | OK | — |
| F-08 | Auth | Forgot password | Login | `/login/client` | `LoginForm.tsx` (button, no handler) | none | none | none | Public | any | DEAD/BROKEN (ISS-6) | ISS-6 |
| F-09 | Plans | Browse/compare plans | Plans CTA | `/client/plans` | `PlansMarketingClient.tsx` | `listMarketingPlansAction` | `packages.service.ts` | `package_tiers` | any client | marketing/renewal-eligible | OK | — |
| F-10 | Demo | Book free demo/assessment | Demo CTA | `/client/demo-booking` | `DemoBookingClient.tsx` | `bookDemoSessionAction` | `demoBooking.service.ts` | `bookings` | any client, never demoed / stage `marketing` | marketing | OK | BR-15, BR-45 |
| F-11 | Demo | Rate a completed demo | Demo-completed prompt | `/client/demo-booking` or `/client/plans` funnel | `DemoBookingClient.tsx` | rating action (shared w/ session rating) | `client-portal.actions.ts` | `bookings`/rating fields | any client | demo_completed | OK | BR-26 |
| F-12 | Purchase | Create purchase order | "Purchase Plan" | `/client/plans` | `PlansMarketingClient.tsx` | `createPackagePurchaseOrderAction` | `payments.service.ts` | `payments` (insert `created`) | role=client | any (subject to BR-2) | OK | BR-1, BR-2 |
| F-13 | Purchase | Verify payment & fulfill | Razorpay callback | (in-page callback, no route) | Checkout.js callback handler | `verifyPaymentAction` | `payments.service.ts` | `payments`, `subscriptions` | role=client, owns order | any | OK | BR-3, BR-4, BR-6 |
| F-14 | Purchase | Webhook reconciliation | Razorpay server event | `POST /api/webhooks/razorpay` | n/a (server-to-server) | route handler | `payments.service.ts` | `payments`, `subscriptions` | webhook HMAC | n/a | OK | BR-3, BR-42 |
| F-15 | Activation | Activate plan (pick start date) | Stage redirect | `/client/activate` | `ActivatePlanClient.tsx` | `activatePlanAction` | `planPurchase.service.ts` | `subscriptions` | role=client, stage=awaiting_activation | awaiting_activation | OK | BR-5, BR-6 |
| F-16 | Onboarding | Submit onboarding intake | Stage redirect | `/client/onboarding` | `OnboardingFormClient.tsx` | `submitOnboardingAction` | `onboarding.service.ts` | `client_onboarding`, `progress_logs` | role=client, stage=onboarding | onboarding | OK | BR-7, BR-8 |
| F-17 | Renewal | Renewal check-in measurement | Stage redirect | `/client/renewal-checkin` | `RenewalCheckinClient.tsx` | progress-log action (renewal variant) | `progressLogs.service.ts` | `progress_logs` | role=client, stage=renewal_checkin | renewal_checkin | OK | BR-13 |
| F-18 | Schedule | First-time recurring schedule setup | Stage redirect | `/client/schedule` | `ScheduleSetupClient.tsx` | schedule actions | `scheduling.service.ts` | `recurring_slots`, `bookings` | role=client, stage=slot_selection | slot_selection | PARTIAL (BR-12 shortfall risk) | BR-9, BR-11, BR-12, ISS-2, ISS-3 |
| F-19 | Schedule | Renewal schedule confirm (keep/change) | Stage redirect | `/client/schedule` | `ScheduleSetupClient.tsx` (renewal mode) | schedule actions | `scheduling.service.ts` | `recurring_slots`, `bookings` | role=client, stage=renewal_scheduling | renewal_scheduling | PARTIAL | BR-10, BR-11, BR-12 |
| F-20 | Schedule | Change schedule (active client, non-renewal) | Nav | `/client/schedule` | `ChangeScheduleClient.tsx` | schedule actions | `scheduling.service.ts` | `recurring_slots`, `bookings` | role=client, stage=active | active | PARTIAL | BR-10, BR-11 |
| F-21 | Sessions | Ad-hoc single-session booking (demo-only) | Nav (hidden once subscribed) | `/client/book` | `BookSessionClient.tsx` | booking action | `client-portal.actions.ts` | `bookings` | any client, no active subscription | pre-purchase | OK | Redirects to F-18/20 once subscribed |
| F-22 | Sessions | View sessions list (tabs) | Nav | `/client/sessions` | `MySessionsClient.tsx` | `getMySessionsAction`-style read | `client-portal.actions.ts` | `bookings`, `attendance`, `workout_notes` | any client | any | OK | BR-28 |
| F-23 | Sessions | Cancel a session | Sessions list | `/client/sessions` | `MySessionsClient.tsx` | cancel action | `cancel_booking` RPC | `bookings` | role=client, owns booking | any | OK | BR-19, BR-20 |
| F-24 | Sessions | Reschedule a session | Sessions list | `/client/sessions` | `MySessionsClient.tsx` | reschedule action | `reschedule_booking` RPC | `bookings` | role=client, owns booking | any | OK | BR-21–BR-25 |
| F-25 | Sessions | Join a session (Zoom) | Session card | `/client/sessions`, dashboard | `NextSessionCard`/`MySessionsClient.tsx` | join action | `zoom.service.ts` | `bookings` | role=client, owns booking, measurements fresh | any | OK | BR-15, BR-27 |
| F-26 | Sessions | Rate a completed session | Sessions list | `/client/sessions` | `MySessionsClient.tsx` | rating action | `client-portal.actions.ts` | `bookings`/rating fields, `coach_profiles` aggregate | role=client, booking completed | any | OK | BR-26 |
| F-27 | Coach | View coach profile (no-coach/demo/full states) | Nav | `/client/coach` | `MyCoachClient.tsx` | coach profile action | `coaches.service.ts` | `coach_profiles`, `profiles` | any client | varies | OK | — |
| F-28 | Coach | Request coach change | My Coach page | `/client/coach` | `MyCoachClient.tsx` | `client-coach-change.actions.ts` | `coachChange.service.ts` | `coach_change_requests` | role=client, has a current coach | active | OK | BR-30 |
| F-29 | Coach | Complete coach change (needs-completion) | My Coach page (post-approval) | `/client/coach` | `MyCoachClient.tsx` | `completeCoachChangeAction` | `coachChange.service.ts` | `recurring_slots`, `bookings`, `conversations`, `coach_change_requests` | role=client, request approved+needs_completion | active | OK | BR-31, BR-32 |
| F-30 | Subscription | View subscription / pause / resume | Nav | `/client/subscription` | `MySubscriptionClient.tsx` | `getMySubscriptionAction`, pause/resume actions | `subscriptions.service.ts` | `subscriptions`, `subscription_usage_view` | any client | any | PARTIAL (BR-17 display/enforcement mismatch; BR-44 unenforced) | ISS-4, ISS-7 |
| F-31 | Subscription | View payment history | Subscription page | `/client/subscription` | `MySubscriptionClient.tsx` | payment history read | `sales_view` | `sales_view`/`payments` | any client | any | OK (no receipts, §21 unknown re: `sales_view` scope) | — |
| F-32 | Chat | Send/receive messages (text + image) | Nav (hidden until ≥1 conversation) | `/client/chats` | `ClientChatsClient.tsx` | `chat.actions.ts` | `chat.service.ts`, Supabase Realtime | `messages`, `conversations`, Storage bucket `chat-attachments` | role=client, active conversation | active | OK | BR-33, BR-34 |
| F-33 | Chat | Read receipts | Chat thread | `/client/chats` | `ClientChatsClient.tsx` | `chat.actions.ts` | `chat.service.ts` | `messages.read_at` | recipient only | active | OK | BR-35 |
| F-34 | Chat | View past (closed) conversations | Chat page | `/client/chats` | `ClientChatsClient.tsx` | `chat.actions.ts` | `chat.service.ts` | `conversations` (status=closed) | any client with history | any | OK | BR-32, BR-34 |
| F-35 | Progress | Log weekly progress/measurement | Progress page | `/client/progress` | `ProgressClient.tsx` | `client-progress.actions.ts` | `progressLogs.service.ts` | `progress_logs` | any client | any (rate-limited) | OK | BR-14 |
| F-36 | Progress | View progress trends / Day-1 comparison | Progress/Dashboard | `/client/progress`, `/client/dashboard` | `ProgressClient.tsx`, `DashboardClient` | `getMyProgressAction` | `progressLogs.service.ts` | `progress_logs`, `client_onboarding` | any client | any | OK (exact Progress-page placement of Day-1 compare: UNKNOWN §21) | BR-8 |
| F-37 | Concerns | Raise a concern | Concerns page | `/client/concerns` | `MyConcernsClient.tsx` | `client-concerns.actions.ts` | `escalations.service.ts` | `escalations` | any client | any | OK | BR-37 |
| F-38 | Concerns | View concern status/updates | Concerns page | `/client/concerns` | `MyConcernsClient.tsx` | `client-concerns.actions.ts` | `escalations.service.ts` | `escalations`, `escalation_notes` | any client | any | OK | BR-36 |
| F-39 | Notifications | View / mark-read notification feed | Nav | `/client/notifications` | `NotificationsClient.tsx` | `client-notifications.actions.ts` | `notifications.service.ts` | `notifications` | any client | any | OK | §14 trigger list |
| F-40 | Profile | Edit profile (name/phone/photo/goals/equipment/medical notes) | Nav | `/client/profile` | `ClientProfileClient.tsx` | `client-profile.actions.ts` | `profiles.service.ts` | `profiles`, `client_profiles`, Storage bucket `avatars` | any client | any | OK (email/role/height/weight not client-editable — by design) | — |
| F-41 | Profile | Change password | Profile page | `/client/profile` | `ClientProfileClient.tsx` | Supabase `updateUser` | Supabase Auth | `auth.users` | any client | any | OK | — |
| F-42 | Gates | Phone gate modal | Portal-wide overlay | any `/client/*` | `PhoneGateModal.tsx` | `client-profile.actions.ts` | `profiles.service.ts` | `profiles.phone` | any client, phone missing | any | BUG (skippable, ISS-1) | ISS-1 |
| F-43 | Gates | Measurement gate modal | Portal-wide overlay | any `/client/*` | `MeasurementGateModal.tsx` | `client-progress.actions.ts` | `progressLogs.service.ts` | `progress_logs` | any client, phone present, stale ≥7d | any | OK (dismiss doesn't waive server-side block, BR-15) | BR-15 |
| F-44 | Gates | Sessions-low gate modal | Portal-wide overlay | any `/client/*` | `SessionsLowGateModal.tsx` | `renewals.actions.ts` | `renewals.service.ts` | `subscription_usage_view` | any client, phone present, measurements fresh, ≤5 remaining | active | OK | BR-2 |
| F-45 | Dashboard | Aggregate dashboard view | Nav | `/client/dashboard` | `DashboardClient.tsx` | `getClientDashboardAction`, `getMyJourneyStateAction`, `getMyProgressAction` | multiple services | `subscriptions`, `bookings`, `progress_logs` | any client | active-adjacent (redirects otherwise) | OK | §4.1 |
| F-46 | System | Session reminder email | Time-based | `/api/cron/session-reminders` | n/a | route handler | email/sms services | `bookings.reminder_sent_at` | `CRON_SECRET` | n/a | OK | §14 |
| F-47 | System | Missed-booking sweep | Passive, on read | any booking-list read | n/a | n/a | `mark_missed_bookings()` RPC | `bookings.status` | n/a | n/a | OK | BR-28 |
| F-48 | System | Paid-demo order creation | none (unreachable) | none | none | `createDemoSessionOrder` [payments.service.ts] | — | `payments` | n/a | n/a | DEAD (ISS-9) | ISS-9 |

## 24. Master Workflow Inventory

| ID | Workflow | Starting Condition | User Action | Business Logic | API/Service | Data Changes | State Change | Result | Dependencies | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| WF-01 | Registration (manual) | Unauthenticated visitor | Fills 3-step signup wizard | BR-38 | `auth.signUp`, `phone-otp.actions.ts` | `auth.users`, `profiles`, `client_profiles` insert | none → `marketing` | Account created, routed to Plans | F-01, F-03, F-04 | PARTIAL (ISS-1) |
| WF-02 | Registration (Google OAuth) | Unauthenticated visitor | Clicks "Continue with Google" | BR-38, BR-39 | `signInWithOAuth`, `/auth/callback` | `profiles` (if new) | none → `marketing` (phone missing) | Routed to dashboard; `PhoneGateModal` opens | F-02, F-42 | OK |
| WF-03 | Login | Registered client | Submits credentials | BR-39 | `signInWithPassword` | none | recomputed on load | Routed to dashboard (or stage redirect) | F-05, F-06 | OK |
| WF-04 | Plan browsing | Authenticated client | Views `/client/plans` | — | `listMarketingPlansAction` | none (read) | none | Card grid rendered | F-09 | OK |
| WF-05 | Free demo booking | Stage `marketing`, measurements fresh | Picks date/time on `/client/demo-booking` | BR-15, BR-45 | `bookDemoSessionAction` | `bookings` insert (assessment) | `marketing` → `demo_booked` | Confirmation + notifications | F-10 | OK |
| WF-06 | Demo completion & rating | Demo `upcoming` | Coach marks attendance; client rates | BR-26 (rating cap) | Coach Portal action; client rating action | `bookings.status`, `attendance`, rating fields | `demo_booked` → `demo_completed` | Rating prompt, funneled to Plans | F-11 | OK |
| WF-07 | Purchase & checkout | No blocking subscription | Clicks "Purchase Plan," completes Razorpay Checkout | BR-1, BR-2, BR-3, BR-4 | `createPackagePurchaseOrderAction`, `verifyPaymentAction` | `payments` insert→update, `subscriptions` insert | any → `awaiting_activation` | "Congratulations" modal → dashboard → activate | F-12, F-13 | OK |
| WF-08 | Webhook reconciliation | `payments.status='created'`, browser never confirmed | Razorpay sends `payment.captured` | BR-3, BR-42 | webhook route → `fulfillPaymentByWebhook` | same as WF-07 | same as WF-07 | Subscription created without client action | F-14 | OK |
| WF-09 | Plan activation | `awaiting_activation` | Picks start date | BR-5, BR-6 | `activatePlanAction` | `subscriptions` update (this + old row) | `awaiting_activation` → `onboarding`/`renewal_*`/`slot_selection` | Redirect chain continues | F-15 | OK |
| WF-10 | Onboarding | `onboarding`, first-time | Submits intake form | BR-7, BR-8 | `submitOnboardingAction` | `client_onboarding` insert, conditional `progress_logs` insert | `onboarding` → next gate | Advances toward active | F-16 | OK |
| WF-11 | Renewal check-in | `renewal_checkin` | Submits fresh baseline measurement | BR-13 | renewal progress-log action | `progress_logs` insert | `renewal_checkin` → `renewal_scheduling` | Advances | F-17 | OK |
| WF-12 | First-time schedule setup | `slot_selection` | Picks weekly pattern, confirms | BR-9, BR-11, BR-12 | schedule actions → `scheduling.service.ts` | `recurring_slots`, `bookings` insert | `slot_selection` → `active` | Nav updates (Book hidden, Coach/Chat unlocked) | F-18 | PARTIAL (ISS-2, ISS-3) |
| WF-13 | Renewal schedule confirm | `renewal_scheduling` | "Keep My Schedule" or picks new pattern + trainer pref | BR-10, BR-11, BR-12 | schedule actions | `recurring_slots`, `bookings` insert | `renewal_scheduling` → `active` | Same as WF-12 | F-19 | PARTIAL |
| WF-14 | Schedule change (active client) | `active` | Picks a new pattern | BR-10, BR-11 | schedule actions | `recurring_slots` change | remains `active` | Schedule page updates | F-20 | PARTIAL |
| WF-15 | Session cancellation | Booking `upcoming`, outside cutoff | Clicks Cancel | BR-19, BR-20 | cancel action → `cancel_booking` RPC | `bookings.status→cancelled`; possible replacement booking insert | none | Slot released, coach/admins notified | F-23 | OK |
| WF-16 | Session reschedule | Booking `upcoming`, outside cutoff, under weekly cap, within window | Picks a new time (own coach / fastest / specific+substitute) | BR-21–BR-25 | reschedule action → `reschedule_booking` RPC | `bookings` time/coach fields updated | none | Old Zoom meeting deleted, client always notified | F-24 | OK |
| WF-17 | Session join | Booking `upcoming`, within join window, measurements fresh | Clicks Join | BR-15, BR-27 | join action → `ensureZoomMeetingForBooking` | `bookings` (Zoom meeting id/url cached) | none | Zoom link opens | F-25 | OK |
| WF-18 | Attendance & completion | Booking `upcoming`, time has passed | Coach marks attendance + submits notes | BR-29 | Coach Portal actions | `attendance` insert, `workout_notes` insert, `bookings.status→completed`/`missed` | `upcoming` → `completed`/`missed` | Client sees notes preview, can rate | (Coach Portal, cross-portal) | OK |
| WF-19 | Missed-session sweep | Booking `upcoming`, time passed, no attendance | Any booking-list read | BR-28 | `mark_missed_bookings()` RPC | `bookings.status→missed` | `upcoming` → `missed` | Session shows as missed | F-47 | OK |
| WF-20 | Session rating | Booking `completed`, no rating in last 7 days | Submits 2-dimension rating | BR-26 | rating action | rating fields on `bookings`; coach aggregate recompute | none | Coach's aggregate rating updates immediately | F-26 | OK |
| WF-21 | Coach-change request | Client has a current coach | Submits reason (+optional ratings/comments) | BR-30 | `client-coach-change.actions.ts` | `coach_change_requests` insert | none (request `pending`) | Yellow "under review" banner | F-28 | OK |
| WF-22 | Coach-change resolution (admin) | Request `pending` | Admin approves (w/ or w/o replacement) or rejects | (Admin Portal) | `admin-coach-change.actions.ts` | `coach_change_requests.status` update | none | Banner updates on My Coach | (cross-portal) | OK |
| WF-23 | Coach-change completion | Request `approved`, `needs_completion=true` | Client picks new day/time, system matches | BR-31, BR-32 | `completeCoachChangeAction` | `recurring_slots`, `bookings`, `conversations`, `coach_change_requests` updated | none | New coach assigned, old chat closed, new chat opened | F-29 | OK |
| WF-24 | Subscription pause | `subscriptions.status='active'` | Clicks "Pause Plan" | BR-43 | pause action | `subscriptions.status→paused`, `paused_at` set | `active` → `paused` | New bookings blocked; upcoming untouched | F-30 | OK |
| WF-25 | Subscription resume | `subscriptions.status='paused'` | Clicks "Resume Plan" | — | resume action | `subscriptions.status→active`, `resumed_at` set | `paused` → `active` | Booking unblocked | F-30 | OK |
| WF-26 | Renewal purchase trigger | `sessions_remaining` 1–5 | Clicks "Renew Now" from `SessionsLowGateModal` | BR-2 | same as WF-07 | same as WF-07 | `active` (old) + `awaiting_activation` (new), then old→`inactive` on activation | Same as WF-07/WF-09 | F-44, WF-07 | OK |
| WF-27 | Chat messaging | Active conversation exists | Sends text/image | BR-33, BR-34, BR-40 | `chat.actions.ts` | `messages` insert | none | Realtime delivery, recipient notified | F-32 | OK |
| WF-28 | Progress logging | Any client | Submits weekly measurement | BR-14 (or BR-13 if renewal check-in) | `client-progress.actions.ts` | `progress_logs` insert | Clears `MeasurementGateModal`/BR-15 block | Chart updates, coach notified | F-35 | OK |
| WF-29 | Raise & resolve a concern | Any client | Submits category + description | BR-36, BR-37 | `client-concerns.actions.ts` (client) + admin actions (resolution) | `escalations` insert; `escalation_notes`, `status` updates (admin) | `open` → `in_progress` → `resolved` | Resolution callout shown to client | F-37, F-38 | OK |
| WF-30 | Profile edit | Any client | Edits name/phone/photo/tags/notes | — | `client-profile.actions.ts` | `profiles`, `client_profiles`, Storage | none | Shell identity card updates | F-40 | OK |

## 25. Master Business Rules Inventory

(Full narrative detail for BR-1..BR-45 is in §8; this table restates each in the requested comparison-ready format. Trigger/Condition/Result columns are intentionally terse — see §8 for the complete rationale of each.)

| ID | Business Rule | Trigger | Condition | Result | Data Used | Data Changed | Implementation Location | Dependent Workflows |
|---|---|---|---|---|---|---|---|---|
| BR-1 | Role=client required for purchase/booking | Purchase/booking action call | `profiles.role` | Reject non-client | `profiles.role` | none | `payments.service.ts`, `client-portal.actions.ts` | WF-07 |
| BR-2 | Purchase gate (renewal exception at ≤5 remaining) | Checkout initiation | Existing `subscriptions.status`, `sessions_remaining` | Reject unless no blocker or ≤5 remaining | `subscriptions`, `subscription_usage_view` | none | `payments.service.ts` | WF-07, WF-26 |
| BR-3 | Signature is the sole payment trust boundary | Checkout callback / webhook | HMAC(order+payment, secret) | Mismatch = hard fail | Razorpay payload | `payments.status` | `payments.service.ts` | WF-07, WF-08 |
| BR-4 | Post-capture failure never loses the payment silently | Exception after capture | — | `paid_unfulfilled` + support message | `payments` | `payments.status` | `payments.service.ts` | WF-07, WF-08 |
| BR-5 | Activation is one-time/locked | 2nd activation attempt | `subscriptions.activated_at` | Throw error | `subscriptions` | none | `planPurchase.service.ts` | WF-09 |
| BR-6 | Renewal supersession atomic w/ activation | Activation while an older sub is `active` | `subscriptions.status`, `client_id` | Old row → `inactive` | `subscriptions` | `subscriptions.status` | `planPurchase.service.ts` | WF-09, WF-26 |
| BR-7 | Onboarding insert-once | 2nd onboarding submit | `client_onboarding` existence | Reject (RLS + app) | `client_onboarding` | none | `onboarding.service.ts` + RLS | WF-10 |
| BR-8 | Onboarding → Day-1 progress log | Onboarding submit w/ any measurement | form fields | Insert `progress_logs` row | onboarding form | `progress_logs` | `onboarding.service.ts` | WF-10 |
| BR-9 | First-time coach match = least-utilized-first | First-time slot selection | utilization view, availability template | Return first fully-free coach | coach utilization, availability | none | `scheduling.service.ts` | WF-12 |
| BR-10 | Preferred-coach 4-step fallback ladder | Renewal/change w/ preference | pattern type, availability grid | Falls back pattern→time→pairing→pairing+time | availability grid | none | `scheduling.service.ts` | WF-13, WF-14 |
| BR-11 | Pattern-match check excludes leave/real conflicts | Any match/confirm | availability template only | Weaker than real conflict check | availability template | none | `scheduling.service.ts` | WF-12, WF-13, WF-14 |
| BR-12 | Generation may silently under-deliver | New/renewed slot confirmed | leave, existing bookings, 60-day scan | May return <N bookings, no error | leave, bookings | `bookings` insert (partial) | `generate_bookings_from_recurring_slot` (Postgres fn) | WF-12, WF-13 |
| BR-13 | Renewal check-in bypasses weekly log cap | Renewal client's first log post-activation | stage=`renewal_checkin` | Log accepted regardless of 7-day cap | — | `progress_logs` | renewal check-in flow | WF-11 |
| BR-14 | Progress-log weekly rate limit | Client self-log submit | last `progress_logs.created_at` | Reject if <7 days | `progress_logs` | none (on reject) | `progressLogs.service.ts` | WF-28 |
| BR-15 | Measurement staleness gate | Demo booking, session booking, session join | last `progress_logs` vs. now | Block all three server-side if stale | `progress_logs` | none | `progressLogs.service.ts` (`getMeasurementStatus`) | WF-05, WF-12-14, WF-17 |
| BR-16 | Session credit enforcement at booking time | Regular-session booking confirm | count(`upcoming`+`completed`) vs. `sessions_total` | Reject if at/above total | `bookings`, `subscriptions` | none (on reject) | `confirm_booking()` (Postgres fn, migration 0053) | WF-12-14 |
| BR-17 | Display "remaining" ≠ enforcement count | Subscription page render vs. booking confirm | `subscription_usage_view` vs. inline count | Two different numbers possible | `bookings`, `subscriptions` | none | `subscription_usage_view` vs. `confirm_booking()` | F-30, WF-12-14 |
| BR-18 | First real-coach session is free `assessment` | Client's first non-demo booking | booking history w/ this coach | 60min free, doesn't count against package | `bookings` | `bookings.session_type` | scheduling/booking logic | WF-12 |
| BR-19 | Cancellation cutoff (client-only) | Client cancels | `settings.cancellation_cutoff_hours` (default 12) | Reject inside cutoff; admin bypass | `settings`, `bookings` | none (on reject) | `client-portal.actions.ts`, `cancel_booking` | WF-15 |
| BR-20 | Cancellation backfills one occurrence | Cancel of a recurring-linked booking | `recurring_slot_id` | Generate 1 replacement | `bookings` | `bookings` insert | `cancel_booking` RPC | WF-15 |
| BR-21 | Reschedule cutoff (client-only) | Client reschedules | `settings.reschedule_cutoff_hours` (default 1) | Reject inside cutoff; admin bypass | `settings`, `bookings` | none (on reject) | `client-portal.actions.ts`, `reschedule_booking` | WF-16 |
| BR-22 | Reschedule weekly cap (2/week) | Client reschedules | count of `session_rescheduled` timeline events this week | Reject at 2 | `timeline` | none (on reject) | `client-portal.actions.ts` | WF-16 |
| BR-23 | Reschedule 30-day window | Client reschedules | target date vs. today | Reject outside window | — | none | `client-portal.actions.ts` | WF-16 |
| BR-24 | No double-booking same IST day | Any new booking/reschedule | client's other bookings that date | Reject if conflict | `bookings` | none (on reject) | `client-portal.actions.ts` | WF-16 |
| BR-25 | Substitute coach is single-session only | Reschedule falls back to substitute | `bookings.coach_id` vs `recurring_slot_id` | Only that occurrence changes coach | `bookings` | `bookings.coach_id` | `reschedule_booking` | WF-16 |
| BR-26 | Session rating: once/week global cap | Client submits rating | any booking rated in last 7 days | Reject 2nd within 7 days | `bookings` | rating fields, coach aggregate | rating action | WF-06, WF-20 |
| BR-27 | Zoom lazy creation, shared host | First "Join" click | `bookings`, Zoom env vars | Idempotent create/reuse; disabled if env unset | `bookings` | `bookings` (meeting id/url) | `zoom.service.ts` | WF-17 |
| BR-28 | Missed-session passive sweep | Any booking-list read | `upcoming` bookings past start time | Flip to `missed` | `bookings` | `bookings.status` | `mark_missed_bookings()` RPC | WF-19 |
| BR-29 | Client cannot self-complete a session | — (absence of action) | — | Completion requires coach flow only | — | — | (no client action exists) | WF-18 |
| BR-30 | Coach-change requires existing coach | Client submits request | current coach assignment | Throw if none | `recurring_slots`/`bookings` | none | `client-coach-change.actions.ts` | WF-21 |
| BR-31 | Coach-change re-match excludes current coach | Needs-completion sub-flow | current `coach_id` | Excluded from search | `coach_change_requests` | none | `completeCoachChangeAction` | WF-23 |
| BR-32 | Coach change cascades to slots/bookings/chat | Request completed | old `recurring_slots`, `bookings`, `conversations` | Cancel old, create new, close/open chat | multiple | multiple | `completeCoachChange` | WF-23 |
| BR-33 | One active conversation per client (DB-enforced) | 2nd active-conversation attempt | `conversations.client_id`+status | Insert rejected at DB | `conversations` | none | unique index `conversations_one_active_per_client` | WF-23, WF-27 |
| BR-34 | Closed conversations permanently read-only | Send into closed conversation | `conversations.status` | Rejected at RLS | `conversations` | none | RLS on `messages` | WF-27 |
| BR-35 | Read receipts settable by recipient only | `read_at` update attempt | caller vs. sender | Rejected if caller=sender | `messages` | `messages.read_at` | RLS on `messages` | WF-27 |
| BR-36 | Concern status requires a logged call first | Admin status/detail change attempt | `escalations.called_client_at` | Blocked until set | `escalations` | none (on reject) | Admin-side guard, migration 0049 | WF-29 |
| BR-37 | Client cannot edit/cancel/delete a concern | Client update/delete attempt | `escalations` ownership | Rejected at RLS | `escalations` | none | RLS on `escalations` | WF-29 |
| BR-38 | Role always server-assigned | Any signup | `raw_app_meta_data` | Client-supplied role field ignored | `auth.users` metadata | `profiles.role` | `handle_new_user()` trigger | WF-01, WF-02 |
| BR-39 | Role-portal boundary enforced twice | Any authenticated request / login | `profiles.role`/JWT claim vs. path | Redirect wrong-role sessions | `profiles`/JWT | none | `middleware.ts` + `LoginForm.tsx` | WF-01-03 |
| BR-40 | Notification dispatch never blocks the action | Any notifying action | — | Errors caught/logged, not propagated | — | `notifications` (best-effort) | every `notify*` call site | WF-05-29 (all notifying flows) |
| BR-41 | SMS is DLT-gated, coach-exclusive-from-SMS | Any SMS-eligible event | recipient role | Coaches never get SMS | recipient role | none | `sms.service.ts` | WF-05, WF-15, WF-16, WF-18 |
| BR-42 | Webhook always returns HTTP 200 | Any webhook delivery | — | Prevents Razorpay retry storm | — | `payments.status` (internal) | `/api/webhooks/razorpay` | WF-08 |
| BR-43 | Pause blocks new bookings only | Booking attempt while paused | `subscriptions.status` | Reject; existing bookings untouched | `subscriptions` | none (on reject) | `confirm_booking()` | WF-24 |
| BR-44 | Pause-days balance is informational only | Client pauses past allowance | `pause_days_allowed`/`used` | Not blocked (display-only) | timeline events | none | subscription page derivation | WF-24 |
| BR-45 | Demo booking always free | Any demo booking | — | No payment step | — | — | `bookDemoSessionAction` | WF-05 |

## 26. Master Issue Inventory

| ID | Area | Functionality | Issue | Current Behavior | Expected/Required Behavior | Evidence | Root Cause | Severity | Dependencies |
|---|---|---|---|---|---|---|---|---|---|
| ISS-1 | Auth | Phone OTP verification | Bypassable via a temporary skip button | Unverified numbers saved through the same path as verified ones | Non-skippable OTP verification (code's own stated intent) | `TEMPORARY` comments in `SignupForm.tsx` and `PhoneGateModal.tsx` | MSG91 DLT template approval pending | Medium-High | SMS delivery (§14), F-04, F-42 |
| ISS-1b | Auth/Data | Phone verification state | No `phone_verified` column exists | Cannot distinguish verified from skip-bypassed numbers | A verification-state field | Absent from `profiles` migrations | Follows from ISS-1's workaround design | Medium | ISS-1 |
| ISS-2 | Scheduling | Pattern-match availability check | Weaker than the real per-booking conflict check | `isDayTimeFreeForCoach` ignores leave/actual bookings | Match check should reflect true availability, or be marked provisional | Direct comparison of `isDayTimeFreeForCoach` vs. `generate_bookings_from_recurring_slot` | Two-phase design never reconciled | Medium | WF-12-14, ISS-3 |
| ISS-3 | Scheduling | Recurring booking generation | Can silently under-deliver requested session count | Returns fewer than N bookings with no error/signal | Client told 4/week should get 4, or be informed of shortfall | `generate_bookings_from_recurring_slot` logic; no shortfall-reporting call site | Function designed to be permissive rather than fail-visible | Medium-High | WF-12, WF-13, ISS-2 |
| ISS-4 | Subscription | Sessions-remaining figure | Display and enforcement use different computations | `subscription_usage_view` (display) vs. `confirm_booking()` inline count (enforcement) can disagree | Single source of truth, or explicitly documented divergence | Side-by-side reading of both computations | Enforcement hardened later (migration 0053) without revisiting the display view | Medium | F-30, WF-12-14 |
| ISS-5 | State management | Client state derivation | `ClientJourneyStage` and `ClientStatus` are independent, differently-prioritized derivations | Two functions compute overlapping but non-identical "client state" | UNKNOWN whether unification is warranted (routing vs. display may be legitimately separate) | `client-journey.actions.ts` vs. `client-status.ts` | Parallel evolution of routing logic vs. staff-display logic | Low-Medium | Any Coach/Admin view trusting `ClientStatus` to match the client's own portal state |
| ISS-6 | Auth | Forgot password | Dead UI element | Button rendered, no `onClick` handler | Working reset flow or remove the button | `LoginForm.tsx` inspection | Incomplete feature | Medium | F-08 |
| ISS-7 | Subscription | Pause-days allowance | Not enforced | Client can pause past `pause_days_allowed` with no block | UNKNOWN — soft vs. hard limit was never specified in code | Absence of any check against the allowance in the pause action | Undecided product rule | Low-Medium | F-30, WF-24 |
| ISS-8 | Demo booking | Demo re-eligibility for lapsed clients | Not conclusively traceable | Falls through to demo/marketing branch same as a new client (inferred, not exercised end-to-end) | UNKNOWN — needs explicit test | Independent gate evaluation for demo vs. subscription state | Untested interaction | Low-Medium | §21 |
| ISS-9 | Payments | Paid-demo order creation | Dead/unused code path | `createDemoSessionOrder` exists, called by no UI | N/A — either remove or document as reserved for a future paid-demo model | No call sites found | Feature never wired up / reserved for later | Low | F-48 |
| ISS-10 | Notifications | `channels` column | Vestigial schema | jsonb column exists "for a future dispatcher," unused | N/A — either implement the dispatcher or remove the column | No reader/writer found | Unrealized abstraction | Low | — |
| ISS-10b | Notifications | `notification_type` enum | Coarser than actual event variety | 4 enum values represent ~30+ events; real differentiation via `template_key` | UNKNOWN whether finer typing was intended | Enum definition vs. `template_key` usage across services | Possibly intentional coarse-filtering design | Low | §14 |
| ISS-11 | Progress | `photo_url` column | No writer implemented | Column exists, no upload UI anywhere | UNKNOWN — treat as a gap only if product wants progress photos | Column present in migrations; absent from `ProgressClient.tsx` | Feature planned, not finished (or reserved) | Low | F-35, F-36 |

---

**End of document.** This audit reflects the Client Portal implementation as read from source on 2026-09-13. Any future code change invalidates specific line-item claims above; re-verify against source before relying on this document for a compatibility decision.

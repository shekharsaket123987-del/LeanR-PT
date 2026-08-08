# LeanR Portal Enhancement Spec — Coach / Admin / Client

**Purpose:** This document is a build-ready requirements spec, not code. It exists so an AI coding agent (or a developer) can implement the features below against the *existing* LeanR codebase without re-discovering what's already built. Every item below is tagged with a status based on a full audit of the current repo (`docs/`, `src/app/{admin,coach,client}`, `src/lib/services`, `src/lib/actions`, `supabase/migrations/0001–0029`).

**Status legend**

| Tag | Meaning |
|---|---|
| ✅ Exists | Already implemented and working as described. Verify only, don't rebuild. |
| 🔶 Extend | Partially built. The underlying data/logic exists; UI, a rule, or an edge case is missing. |
| ❌ New | Not present. Needs new schema and/or new logic. |

Where a table, function, or file is named below, it is a **real, confirmed name in the current codebase** — reuse it, don't rename it, unless a change is explicitly called for.

---

## 0. Data Model Already in Place (reference)

Core tables you'll be extending, not replacing:

- Identity: `profiles`, `coach_profiles`, `client_profiles`
- Billing: `package_tiers`, `subscriptions`
- Scheduling: `coach_availability`, `coach_shifts`, `coach_leave`, `recurring_slots`, `temporary_bookings`, `bookings`
- Continuity: `shadow_coach_assignments`, `coach_change_requests`
- Coaching content: `attendance`, `workout_notes`, `progress_logs`
- Notifications: `notification_templates`, `notifications`
- Audit/settings: `audit_logs`, `system_settings`
- Client-facing history: `escalations`, `client_timeline_events`
- Journey: `client_onboarding`

Key functions already implemented: `assign_shadow_coach()`, `cancel_booking()`, `confirm_booking()`, `create_temporary_booking()`, `expire_temporary_bookings()`, `generate_bookings_from_recurring_slot()`, `has_scheduling_conflict()`, `is_slot_within_working_hours()`, `mark_missed_bookings()`, `reschedule_booking()`, `booking_end_time()`, `get_setting_int()`, plus RLS helpers `coach_client_linked()`, `my_client_id()`, `my_coach_id()`, `my_role()`, `is_admin()`.

Confirmed relevant enums (`0001_enums.sql`): `booking_status` = `upcoming` / `completed` / `cancelled` / `missed` (no separate "scheduled"/"confirmed"/"pending" literal — map any spec language using those words onto `upcoming`). `client_status` = `active` / `inactive` / `paused` (no "expired" literal). `attendance_status` = `present` / `absent` / `late` (the enum already includes `late`, even though the UI currently only exposes present/absent — confirm before treating "late" as net-new). `coach_status` = `active` / `inactive` / `on-leave`. `escalation_status`, `leave_status` (`pending`/`approved`/`rejected`), `shadow_assignment_status`, `coach_change_status` also exist.

`client_timeline_events` (append-only, system-write-only via `timeline.service.ts::logTimelineEvent`) already logs: `session_cancelled`, `session_rescheduled`, `session_missed`, `session_completed`, `coach_notes_uploaded`, `manual_session_added`, `coach_changed`, `shadow_coach_assigned`, `client_raised_concern`, `escalation_resolved`, `plan_purchased`, `plan_activated`, `plan_extended`, `pause_started`, `pause_ended`, `weekly_measurements_updated`, `coach_assigned`, `slot_assigned`, `refund_requested`. **New event types introduced below must follow this same pattern** — write through `logTimelineEvent`, never insert into `client_timeline_events` directly from a route handler.

---

## 1. Coach Portal

### 1.1 Dashboard KPI cards
File: `src/app/coach/dashboard/page.tsx`, action: `getCoachDashboardAction` (`src/lib/actions/coach-portal.actions.ts`)

Currently shows: Sessions This Week, Completed, Missed, Utilization %.

| Requirement | Status | Notes |
|---|---|---|
| Today's scheduled session count | 🔶 Extend | Count `bookings` where `coach_id = me`, `scheduled_start::date = today`, `status = 'upcoming'` (confirmed enum: `booking_status` is `upcoming`/`completed`/`cancelled`/`missed` — there is no separate `scheduled`/`confirmed` literal). |
| Total active client count | 🔶 Extend | Reuse `deriveClientStatus()` (already used in `CoachClientsClient.tsx`) over `listMyClients`; count `active`. |
| Total paused client count | 🔶 Extend | Same source, count `paused`. |
| Average overall rating by clients | ❌ New | Depends on §1.7 rating fields existing at the booking level. Aggregate `AVG(rating)` across the coach's completed bookings. Decide whether this averages the trainer-specific rating dimension only (recommended) once §5.4 splits quality vs. trainer rating. |
| Escalations active today | 🔶 Extend | `escalations` table already has coach linkage and status; filter `coach_id = me AND status = 'active'`. Clarify with product owner whether "today" means raised today or currently open regardless of raise date — spec assumes **currently open**, ignore "today" as a hard filter unless you want two separate cards (opened today vs. total open). |

### 1.2 Sidebar — Profile
File: `src/app/coach/profile/page.tsx`, `coach-profile.actions.ts`

✅ Exists: profile view/edit, `specialization`, working hours derived from `coach_availability`.

❌ New: **Skills** as a distinct field, add-only from the coach side.
- Add `coach_profiles.skills text[]`.
- Coach-facing action only supports `array_append` (no remove/edit) — enforce this server-side, not just in the UI, since a client could otherwise call the action directly.
- Admin retains full edit/remove rights on the same field from the admin coach-detail page (§2.3).

### 1.3 Sidebar — Today's Tasks
❌ New sidebar widget (data already exists via `getCoachScheduleAction`, just not surfaced as this component).

Each row: client ID (clickable → client profile, §5), client name, plan, time, slot, join link, and a **live countdown** to session start (e.g. "join in 59 min") — this must be a client-side ticking timer (`setInterval`/`Intl` diff), not the current boolean join-window enable/disable used elsewhere in the app.

Post-session, each row exposes:
1. Mark Present / Absent → existing `markAttendanceAction` (`bookings.service.ts`).
2. Upload notes → existing `submitSessionNotesAction`.
3. On save, both must: write to `client_timeline_events` (present/absent as its own identifiable event, not folded into `session_completed`), decrement the client's remaining session count (already occurs via subscription usage views — confirm the decrement is transactional with the attendance write, not a separately-computed view that could drift), and persist to `client_profiles` visibly (already true via the client-detail action).

**2-hour overdue rule (❌ New):** if attendance is not marked within 2 hours of `scheduled_start + duration`, the system must notify the coach and visually highlight the session in this sidebar until resolved.
- Implement as a new scheduled sweep alongside the existing `mark_missed_bookings()` pattern (see migrations `0011`, `0026` for the cron/sweep convention already used in this codebase) — e.g. `flag_overdue_attendance()` — that finds bookings where `attendance IS NULL` and `now() > booking_end_time(booking) + interval '2 hours'`, sets a boolean like `bookings.attendance_overdue`, and inserts a `notifications` row using a new `notification_templates` entry (follow the existing template pattern in migration `0024`).
- The sidebar reads `attendance_overdue` to render the highlight; clearing happens automatically once attendance is marked (§1.3.3).

### 1.4 Sidebar — Upcoming Sessions (next 3 days)
❌ New as a sidebar (data source `getCoachScheduleAction` already returns this shape more broadly — just needs a 3-day filter + chronological sort). Columns: client ID, client name, plan, date, time.

### 1.5 Sidebar — Global Search
❌ New. Today, coach queries (`getCoachClientsAction`) only ever return the coach's own assigned clients — there is no path to look up an arbitrary client.

- **Case A — client not assigned to this coach:** read-only client profile (§5). No edit affordances of any kind, including no "add notes" option.
- **Case B — client assigned to this coach:** same profile view, plus the ability to add exercise/session notes (the same notes flow as §1.3.2, reachable both from the Today's Tasks sidebar post-session and from here).
- Requires loosening the current coach RLS read policy on `client_profiles`/`client_timeline_events` from "assigned only" to "read-all, write-if-assigned." Write policies (`session notes`, attendance, etc.) stay scoped to assigned clients only — confirm this doesn't unintentionally widen any other write policy while you're in the RLS file (migration `0012`).

### 1.6 Sidebar — Pending Tasks
❌ New. Query: bookings where `coach_id = me`, `scheduled_start < now()`, and (`attendance IS NULL` OR notes missing). This is a derived query, not a new table — reuses existing `bookings`/`workout_notes` shape.
- Row disappears automatically once both attendance and notes are saved (i.e., re-run the same query — don't maintain a separate "pending" flag that could get out of sync).
- Same completion also updates the client profile timeline (already true via §1.3.3).

### 1.7 Sidebar — Active / Paused Clients
File: `src/app/coach/clients/page.tsx`, `CoachClientsClient.tsx` — ✅ mostly exists (status/plan/day filters, text search, `deriveClientStatus`).

🔶 Extend: add **average rating out of 5** per client as a column (new aggregate, see §5.4 for the rating fields this depends on) and confirm **start date** is already surfaced (likely is, via subscription start). Client ID must be clickable → client profile (✅ pattern already used elsewhere in this file).

### 1.8 Sidebar — Escalations
File: `src/app/coach/escalations`, `getCoachEscalationsAction` — 🔶 Extend. Currently a full read-only page with no active/resolved toggle.
- Add filter tabs: Active / Resolved.
- Columns: client ID, client name, plan, escalation summary, escalated date, status. `escalations` has both `reason text` (short) and `description text` (detail) — map "escalation summary" to `reason`.
- Stays read-only for coach (resolution is admin-only, §2.6 — don't add a resolve action here).

### 1.9 Leave Requests
File: `src/app/coach/availability`, `CoachAvailabilityClient.tsx`, `requestLeaveAction` → `availability.service.ts::requestLeave`. Table: `coach_leave` (`starts_on`/`ends_on`, date-only, `reason text`, `status leave_status`).

🔶 Extend, two gaps:
1. **Hour-wise / partial-day leave** — today `coach_leave` only supports whole days. Add a `leave_type` distinction (`full_day` vs `partial`) and, for partial, a way to scope which specific sessions are covered on that date (either explicit `booking_ids uuid[]`, or `start_time`/`end_time` bounds that get resolved against that day's bookings at approval time). This matters because the existing shadow-coach flow (§4.2) currently reasons about whole leave-date ranges — it needs to reason about individual session slots when `leave_type = partial`.
2. **Minimum 24-hour advance-notice rule** — currently the only validation confirmed is `ends_on >= starts_on` (a DB check constraint). Add server-side validation rejecting any leave request submitted less than 24 hours before `starts_on`, so admin always has time to review before it takes effect. This rule is **unconditional** — there is no in-system fast-track or "emergency leave" type that bypasses it. Genuine same-day/undocumented absences (a coach who doesn't/can't formally apply at all) are handled outside this flow entirely, via the client-profile manual shadow-assignment tool in §4.2.3 — not by adding an exception to this rule.

---

## 2. Admin Portal

### 2.1 Dashboard KPIs
File: `src/lib/services/adminDashboard.service.ts` (`AdminDashboardData`) — 🔶 Extend. Already returns `totalClients`, `activePTClients`, `sessionsBookedToday`, `sessionsCancelledToday`, `trainerUtilization`, `revenueThisMonth` (= total sales this month, already correct), `avgSessionsPerClient`.

Missing:
- **Active coaches count** ❌ New — count `coach_profiles` with active status.
- **Average overall rating by clients** ❌ New — same aggregate dependency as §1.1, rolled up platform-wide instead of per-coach (per-coach version already exists in `coachPerformance.service.ts`, just isn't surfaced on the main dashboard).
- **Average sessions per day** ❌ New — distinct from the existing `avgSessionsPerClient` (that's per-client, not per-day). Compute as completed sessions / active days over a rolling window (define window — 30 days recommended).
- **Universal client search** ❌ New — no search of this kind exists anywhere in admin today. Search by client ID/code/name, results link straight into the client profile (§5).

### 2.2 Sidebar — Manage Client Profile
File: `src/app/admin/clients/[id]`, `AdminClientDetailClient`, list at `AdminClientsListClient.tsx` — ✅ mostly exists: timeline, escalations, coach reassignment, filters on the list page.

🔶 Extend:
- Confirm/add an **Expired** filter state. Confirmed `client_status` enum is only `active`/`inactive`/`paused` — "expired" likely needs to be derived from subscription end date rather than added as a fourth literal status, to avoid a dual source of truth. Decide and document which approach you take.
- Columns requested: client ID, name, plan, time, day-of-slot, coach, status — confirm all are already present on the list view; add whichever are missing.
- **Edit cascades to coach schedule:** ✅ Already confirmed via `reassignClientCoach` (`clients.service.ts:199`) — updates `recurring_slots.coach_id` and in-flight `bookings.coach_id`, blocks the change unless the new coach covers the client's existing slot days (`findUncoveredDays`), overridable with `force`. This already satisfies "changing day/time cascades to coach and updates DB/timeline" — just confirm timeline write (`coach_changed`) fires on every path that mutates this, including the admin fast-path in `clients.service.ts`, not just the client-requested flow.

### 2.3 Sidebar — Coaches Profile
File: `src/app/admin/coaches/[id]`, `CoachPerformancePanel.tsx` — 🔶 Extend.

✅ Exists: employee code (migration `0016`), availability/slots, performance panel (avg rating, escalations raised).

❌ New: a proper **7-day slot calendar** (today through today+6) showing, per slot, whether it's open or booked, which client holds it, and a status label. Confirmed `booking_status` enum is `upcoming` / `completed` / `cancelled` / `missed` — map "pending" in the spec's language to `upcoming`, "cancelled" to `cancelled` directly. "Rescheduled" is **not** a status value — it's the existing boolean `bookings.was_rescheduled` (migration `0018`) layered on top of whichever status the booking currently has; render it as a badge/tag alongside the status label, not as a fourth status.

🔶 Extend: coach name edit — `profiles`/`coach_profiles` are single source of truth so this should already propagate everywhere by construction; explicitly test it (session cards, timeline actor names, client-facing coach display) rather than assuming.

Also confirm this page already shows active/paused client counts for the coach and current escalations — if the performance panel doesn't yet surface these, add them here (same aggregates as §1.1/§1.7, just admin-facing).

### 2.4 New Coach Creation
File: `src/app/admin/coaches/new/page.tsx` — ✅ Exists, full form already built.

### 2.5 Plans, Promises & Pricing
Table: `package_tiers` (migration `0003`, extended with audit logging in `0029`) — ✅ fully admin-editable (name, category, sessions_count, price, original_price, features, highlighted, is_active). Confirmed no pause/promise-related columns exist on `package_tiers` or `subscriptions` today (`subscriptions` only has `sessions_total`, `status`, `started_at`, `paused_at`, `resumed_at`).

❌ New: **promise-level overrides**, e.g. "client has 15 pause-days remaining, admin grants 15 more → 30 total." This is a *per-client* override on top of the plan template, not just a template edit:
- Add `pause_days_allowed` (and `pause_days_used`, or compute usage from existing `pause_started`/`pause_ended` timeline events) to `subscriptions`, defaulting from a new `package_tiers.default_pause_days` field.
- Admin action to increment a specific client's `pause_days_allowed`, logged to `client_timeline_events` (new event type, e.g. `plan_promise_adjusted`) and reflected immediately in the client's subscription/payments view (§3.11) and the admin sales/plan views.
- Generalize this pattern if other "promises" beyond pause-days are in scope (e.g. session extensions, freeze credits) — currently only pause-days was specified, so scope to that unless told otherwise.

### 2.6 Sales List
❌ New dedicated page. `/admin/reports` currently exports revenue trend CSVs but there's no transaction-level "sales list." Build a page/view listing client ID, client name, plan, sale date, plan amount — sourced from `subscriptions` (purchase/renewal events) joined to `package_tiers`. Consider adding a DB view (`sales_view`) following the existing convention in migration `0010_views.sql` rather than computing this ad hoc in the service layer.

### 2.7 Escalation Query Management
`escalations.service.ts` — ✅ Exists: `markEscalationInProgress`, `resolveEscalation(escalationId, resolutionNotes)`, admin-only, logs `escalation_resolved` to timeline, notifies relevant parties.

🔶 Extend: confirm the admin-facing page itself has the Active/Resolved filter toggle requested (the coach-side equivalent was confirmed missing in §1.8 — verify the admin page separately since it may differ).

---

## 3. Client Portal

### 3.1 Pre-auth Landing Page
`src/app/page.tsx` + `src/components/landing/*` (Hero, HowItWorks, PricingSection, Testimonials, TrustBar, TrainerCarousel) — ✅ Exists, matches the "attractive platform, reviews, ratings" brief.

### 3.2 Signup vs. Login Differentiation
✅ Exists: separate `/signup`, `/login/{admin,client,coach}`. The journey-state machine (`getMyJourneyStateAction`) already redirects unpaid/new users toward `/client/plans` / `/client/activate` / `/client/onboarding` — confirm this already delivers the "plan advertisement and sales content before payment" requirement; if `/client/plans` is purely a checkout form today rather than a sales/marketing page, extend its content rather than building a new route.

### 3.3 Dashboard
`NextSessionCard` and related components — 🔶 Extend.

| Requirement | Status | Notes |
|---|---|---|
| Today's session + join timer | 🔶 Extend | Currently a boolean join-window (enabled ≤10 min before start), not a live countdown. Replace with the same ticking-timer pattern requested for the coach side (§1.3). |
| Total available PT sessions | ✅ Exists | sessions used/remaining already shown. |
| Progress (weight, inches) | ✅ Exists | "Progress Since Day 1" diffs already computed. |
| Journey date (start → current) | ❌ New | No explicit "Day N of your journey" display found despite the journey-state machine existing server-side. Compute from `client_onboarding`/subscription start date. |
| Assigned coach + rating | 🔶 Extend | Coach info is embedded in `NextSessionCard`; confirm the coach's aggregate rating is displayed alongside it, add if not. |

### 3.4 Sidebar — Today's Tasks
🔶 Extend. Reschedule/cancel are already policy-enforced server-side (`cancel_booking()` 12h cutoff, `reschedule_booking()` 1h cutoff, migration `0025`), but currently live on `/client/sessions`/`/client/schedule` rather than a persistent sidebar, and the policy explanation is only surfaced as a server error message today. Add: sidebar widget (join link, time, reschedule, cancel) plus a **confirmation popup that states the policy before the action is submitted**, not just after a rejection.

### 3.5 Sidebar — Upcoming Sessions (next 6 days)
❌ New as a dedicated widget, with reschedule/cancel available inline per row (reuse §3.4 actions).

### 3.6 Sidebar — Current Coach
`/client/coach`, `MyCoachClient.tsx` — ✅ Exists.

### 3.7 Sidebar — Rating
`bookings.service.ts::rateBooking()` — 🔶 Extend, two gaps:
1. **Two rating dimensions** — spec calls for both "session quality" and "trainer" ratings (plus notes/why). Current implementation appears to be a single rating value per booking (`bookings.rating smallint`, `bookings.client_feedback text`); split into `quality_rating` and `trainer_rating` (or a small `ratings` table keyed on `booking_id` if you want to support future dimensions without more column sprawl), each with an optional free-text reason.
2. **Once-per-week constraint** ❌ New for ratings, but **the exact pattern already exists elsewhere in this codebase** — reuse it rather than inventing a new approach: `client-progress.actions.ts::getMyProgressAction` (line 58-60) already computes `canSubmitThisWeek` by checking whether any `progress_logs` row has `logged_at >= (now - 7 days)`. Do the same thing for ratings: if a rating exists with `created_at` within the last 7 days for this client, block another. Confirm which UX is intended — spec text implies both the post-session prompt *and* the ad-hoc "rate your trainer" sidebar page share this same weekly cap.
- All ratings continue to feed `client_timeline_events` and the aggregates in §1.1/§1.7/§2.1 — no separate propagation logic needed once the write path is correct.

### 3.8 Sidebar — Update Measurement
`progress_logs` + `progressLogs.service.ts` — ✅ Exists (weight, body_fat_pct, muscle_pct, waist, chest, hip, arms, thigh; logs `weekly_measurements_updated`).

🔶 Extend: a weekly-cadence *hint* already exists (`canSubmitThisWeek` in `getMyProgressAction`, see §3.7) but it's advisory only — `submitMyProgressAction` doesn't check it server-side, so nothing currently stops a client from submitting more than once a week, and nothing forces a submission to happen at all. "Mandatory" needs an actual decision on mechanism (e.g., block dashboard/session-join until the weekly measurement is logged, vs. a soft reminder banner) — implement that gate explicitly rather than assuming the existing flag already provides it.

### 3.9 Sidebar — Progress
`/client/progress`, `client-progress.actions.ts` — 🔶 Extend. Day-1-vs-latest numeric diffs already exist; **graphs are missing** (dashboard/progress page currently shows numbers only). `recharts` is already a project dependency — use it for weight/inches history over the journey timeline rather than adding a new charting library.

### 3.10 Sidebar — Help & Support
`/client/concerns`, `MyConcernsClient.tsx` — ✅ Mostly exists. This is functionally the help/support flow already (raises `escalations`, reflected in admin panel and client timeline). Confirmed `escalations` already has **both** `reason text not null` (short) and `description text` (detail) — this already satisfies "type + detail" structurally. 🔶 Extend only if "type" needs to be a **fixed dropdown of categories** rather than freeform text — `reason` is currently unconstrained text, not an enum, so confirm whether the concern-type list should be a controlled vocabulary (e.g. billing / coach conduct / technical / scheduling) before deciding whether a schema change is actually needed.

### 3.11 Sidebar — Subscription & Payments
`/client/plans` — 🔶 Extend. Session-remaining tracking exists (`subscription_usage_view`). Missing:
- **Promise-remaining tracking** ❌ New — depends on §2.5's `pause_days_allowed`/`pause_days_used` fields; display "11 of 15 pause-days remaining" once those exist.
- **Payments/invoice history** ❌ New — `bookings.amount_paid` (migrations `0027`/`0028`) tracks per-booking amounts, but no consolidated payment ledger view was found for the client. Build one, likely reusing the `sales_view` proposed in §2.6 filtered to the current client.

---

## 4. Cross-Cutting Systems

### 4.1 Timeline
`client_timeline_events` + `timeline.service.ts::logTimelineEvent` — ✅ Robust and already cross-portal (admin, coach, and client actions all write through it; append-only via RLS). Treat this as the backbone for every new feature above that mentions "should show in timeline" — always write through `logTimelineEvent` with a clearly named new event type rather than reusing an existing one loosely (e.g. don't overload `session_completed` to also mean "attendance marked present" — see §1.3).

New event types this spec implies you'll need: attendance marked present/absent (explicit, separate from `session_completed`), `plan_promise_adjusted` (§2.5), rating submitted (if not already covered by an existing type — confirm), concern-type-tagged escalation raised (if §3.10's category field is added, consider including it in the existing `client_raised_concern` event metadata rather than a new event type).

Separately, `audit_logs` (raw DB-level trigger-based audit, migration `0009`/`0029`, powers `/admin/activity-log`) is a **different system** from the client timeline — don't conflate the two. New features that need admin-visible "what changed" already get this for free via the existing triggers; only the client-facing narrative timeline needs explicit new event types.

### 4.2 Shadow Coach Assignment — Must Be Fully Automatic

**Governing principle (explicit product decision):** there are exactly two ways a shadow-coach assignment happens, nothing else.
1. **Automatic — the only path for documented leave.** Coach applies for leave in the system → admin reviews and approves it → the system automatically finds and assigns shadow coach(es) for every affected session, with no separate "assign shadow coach" action required from anyone. This is the standard path and should cover the large majority of cases.
2. **Manual — scoped to one specific situation: a coach who is absent without ever having applied for leave in the system at all** (genuine emergency — sick same-day, no-show, anything where there's no `coach_leave` record for the system to trigger off of). Since nothing was formally submitted, there's no approval event to auto-trigger the shadow search, so admin assigns a shadow coach directly from the client's profile. This is the only designed use of manual assignment — it is not a general-purpose override for the automatic path, and it is not a separate "emergency leave" type inside the leave-request system (see §1.9 — leave requests always require the same minimum notice, with no in-system fast-track).

A leave request that goes through the normal apply → approve flow should never require manual intervention by design; if the automatic search comes up empty for a properly-submitted leave (§4.2.4), that's resolved using the same client-profile manual-assignment tool described above, not a separate third workflow.

#### 4.2.1 What's already correct — keep this, don't rebuild it
- **"Primary coach never changes" is already structurally true.** `shadow_coach_assignments` (migration `0006`) stores `primary_coach_id` and `shadow_coach_id` as distinct columns. The `assign_shadow_coach()` RPC (migrations `0011`/`0026`) only ever does `update bookings set coach_id = shadow_coach_id where ... scheduled_start::date between starts_on and ends_on` — it **never touches `recurring_slots.coach_id`**. Since `generate_bookings_from_recurring_slot()` always reads the coach from `recurring_slots`, any booking generated after the leave's `ends_on` automatically carries the primary coach again with zero extra code. "Restore primary coach after leave ends" is already true by construction — verify it, don't build a revert step.
- **Auto-assignment already fires without a manual admin trigger**, for the planned-leave path specifically: the moment an admin approves a leave request, `resolveLeave()` (`availability.service.ts:139`) loops every client affected by that coach's schedule, calls `findShadowCoachCandidates()`, and calls `assignShadowCoach()` — no separate "assign shadow coach" button exists or is needed today.
- **Client and shadow-coach notifications already fire automatically** and are already reassuring rather than alarming: `shadow_coach_assigned` template reads *"{{shadow_coach_name}} will cover your sessions with {{primary_coach_name}} from {{starts_on}} to {{ends_on}}"* (migration `0008`), sent to the client; `shadow_assignment_for_coach` notifies the shadow coach. Extend the copy (e.g. explicitly add "your regular coach will continue after returning") rather than redesigning the mechanism.
- **"Don't cancel if no shadow found" already holds** — `resolveLeave()` pushes the client onto `unassignedFlagged` and calls `notifyAdmins()` instead of cancelling anything.

#### 4.2.2 Real gap: the matching logic itself (🔶 Extend)
Two concrete problems found in `findShadowCoachCandidates()` (`scheduling.service.ts:402`):
1. **It requires one coach to be free for every single session in the entire leave range before considering them a candidate at all** (binary all-or-nothing loop — if any one occurrence conflicts, the coach is dropped completely). This directly conflicts with your requirement: *"no issues if there is multiple shadow coaches assigned on different session days."* A coach free on day 1 but booked on day 3 is excluded entirely today, instead of covering day 1. **Fix: resolve a shadow coach independently per affected session/occurrence, not once for the whole date range.** Different shadow coaches covering different days for the same client during one leave period is the correct, expected outcome, not an edge case to prevent.
2. **Ranking today is utilization-only** (`candidates.sort((a,b) => a.utilizationPct - b.utilizationPct)`) — lowest-utilization coach always wins, nothing else factored in. Build a real compatibility score instead. The good news: most of the factors you listed already exist as real columns on `coach_profiles` — `specialization`, `secondary_specializations`, `languages text[]`, `rating` — so a specialization-match + language-overlap + rating + utilization score is buildable **today with no schema change**. Two factors from your reference list are not modeled anywhere yet: **gender** (no such column on `profiles`) and **"team"/"shift grouping"** (no such concept exists — `coach_shifts` records worked hours, not team membership). Treat those two as optional net-new fields, only add them if gender-preference matching is actually a requirement you want to commit to now versus later.
   - Keep the actual weighting in one place (a single scoring function) so it's easy to tune later — don't hardcode a rigid 10-tier priority ladder; a weighted score is more maintainable and still fully respects "never pick randomly."

#### 4.2.3 Manual assignment for undocumented absence (❌ New)
This is the one legitimate manual path, and it's deliberately narrow: a coach is unavailable but **never applied for leave in the system**, so there's no `coach_leave` record and therefore no approval event to trigger the automatic flow in §4.2.1. Nothing today handles this — it needs a standalone action.
- Add a "Assign Shadow Coach" action directly on the client profile (§5 in the main spec) that admin can invoke ad hoc for a specific client/session, independent of the `coach_leave`/`resolveLeave()` pipeline entirely. It should call the same underlying assignment logic (§4.2.2's per-occurrence search + scoring) rather than a separate code path, just triggered manually instead of by a leave approval event.
- This is not an "emergency leave type" inside the leave-request flow, and it doesn't bypass or shorten the 24-hour advance-notice rule in §1.9 — that rule is unconditional for anything submitted through the system. This path exists specifically for the case where nothing was submitted at all.

#### 4.2.4 No shadow coach found for a properly-submitted leave (🔶 Extend)
This is an *outcome* of the automatic path (§4.2.1), not a separate trigger. Today it's a notification only (`notifyAdmins`), easy to lose in a notification feed. Add a persistent "Shadow Coach Required" list in the admin portal — reuse the same list/filter UI pattern already specified for escalations (§1.8/§2.7) rather than inventing new conventions — so unresolved cases stay visible. Resolution uses the exact same client-profile manual-assignment tool from §4.2.3 — there is only one manual-assignment surface in the product, this is just the second circumstance that leads an admin to it.

#### 4.2.5 Shadow coach becomes unavailable mid-assignment (❌ New)
Not handled at all today — once `assign_shadow_coach()` runs, nothing re-checks that assignment. Add: if the assigned shadow coach later goes on leave themselves, or otherwise can't cover a session, re-run the per-occurrence search (§4.2.2) for just that session, notify the client and new shadow coach, and update `shadow_coach_assignments` accordingly.

#### 4.2.6 Long leave (❌ New — lower priority than 4.2.1–4.2.5)
No duration threshold exists today. If wanted: add a configurable day threshold via `system_settings` (same pattern as the existing `reschedule_cutoff_hours` entry). Past the threshold, route to an admin review step offering either continued shadow coverage or a permanent coach change — the permanent change should go through the existing `coach_change_requests` flow (§4.3) and only take effect after explicit admin approval, never automatically.

#### 4.2.7 Deliberately out of scope for this pass
You asked to take ideas from the longer reference workflow without building all of it. These are genuinely good future enhancements, but each adds real new surface area (new tables, timers, or UI) beyond what's needed for a working automatic system — defer unless you specifically prioritize them:
- Timed accept/decline window for the shadow coach (e.g. 5 minutes to confirm before cascading to the next candidate).
- A dedicated "shadow coach pool" as a distinct concept from the general active-coach list.
- Shadow-specific performance metrics (acceptance rate, average response time, client satisfaction isolated to shadow sessions).
- Progress-photo handoff — no photo storage/table exists anywhere in the current schema; this is a separate feature unrelated to shadow coaching specifically, not something to bolt on here.
- A 🟡 "Shadow Session" badge on the shadow coach's own dashboard — cheap to add (`shadow_coach_assignments` already lets you detect this per booking) and fine to include if time allows, but not load-bearing for the core requirement, so it's listed here rather than in §4.2.1–4.2.5.

### 4.3 Coach Reassignment (non-leave-driven)
Two existing paths — ✅ both already cascade correctly:
1. **Admin fast path** — `reassignClientCoach` (`clients.service.ts:199`): repoints `recurring_slots.coach_id` and open `bookings.coach_id` directly, same day/time, blocked unless the new coach covers those days (`findUncoveredDays`), overridable via `force`.
2. **Client-requested path** (day/time also changes) — `completeCoachChange` (`coachChange.service.ts`): cancels old `recurring_slots` and their still-upcoming `bookings`, creates fresh recurring slots for the new coach (`createRecurringSlots`).

Both log `coach_changed` to the timeline. 🔶 Extend only if the "no coach available → revert" messaging (same question as §4.2) needs to be more explicit/user-facing than today's block-unless-forced behavior — otherwise this system already satisfies the requirement as written.

---

## 5. Client Profile (the record searched by coach/admin global search)

### 5.1 Identity
`client_profiles.client_code` (migration `0022`) — ✅ Exists, already surfaced in coach client list, admin client list, session cards.

### 5.2 Dashboard tab
- Client ID, name, plan, assigned coach — ✅ Exists.
- Coach-change history (from-date/to-date) — ✅ Exists, derived from `client_timeline_events` filtered to `coach_changed`, rendered in `ClientTimeline.tsx` on the admin client detail page.
- Age, weight, height, fat % — ✅ Exists across `client_onboarding` (age, height_cm, weight_kg, gender, fitness_goal) and `progress_logs` (weight, body_fat_pct, etc.).
- **BMI** ❌ New — no auto-calculation found. Compute in the service layer as `weight_kg / (height_cm/100)^2` at read time (don't store it — it should always reflect the latest weight/height, so persisting a stale value would drift).

### 5.3 Progress tab
`getCoachClientDetailAction` already computes weekly progress (day-1 vs. latest across 8 measurement fields) — ✅ Exists. 🔶 Extend to add graphs (same `recharts` work as §3.9 — build one shared chart component and reuse it in both places rather than duplicating).

### 5.4 Timeline tab
✅ Exists — `listClientTimeline` already wired into both the coach client-detail action and the admin client-detail page.

### 5.5 Subscription & Payments tab
🔶 Extend — session summary (purchased/completed/remaining/upcoming) already exists on both admin and coach client-detail views. Add the promise-remaining display and payment ledger described in §3.11 here as well (same underlying data, just also surfaced on this admin/coach-facing view).

---

## 6. Consolidated Schema Changes Needed

This is the full list of net-new schema work implied by the sections above, gathered in one place for migration planning. Follow the existing migration numbering convention (`00XX_description.sql`) and keep each change scoped/reversible like the existing 29 migrations.

1. `coach_profiles.skills text[]` — append-only from coach, full edit from admin (§1.2).
2. `bookings.attendance_overdue boolean default false` + new sweep function (pattern-match `mark_missed_bookings()`) + new `notification_templates` row for the 2-hour overdue alert (§1.3).
3. Rating split — either `bookings.quality_rating`, `bookings.trainer_rating`, `bookings.rating_note` or a dedicated `ratings` table keyed on `booking_id`/`client_id`/`coach_id` — plus the once-per-week enforcement query (§3.7).
4. `coach_leave.leave_type` enum (`full_day`/`partial`) + a way to scope partial leave to specific sessions (`booking_ids uuid[]` or time bounds), plus server-side 24-hour-advance-notice validation with no exception path (§1.9).
10. Shadow-coach matching logic changes (§4.2.2) — no new tables required, but `findShadowCoachCandidates()`/`resolveLeave()` need to move from "one coach free for the whole date range" to per-occurrence resolution, and from utilization-only sorting to a weighted score using existing `coach_profiles` columns (`specialization`, `secondary_specializations`, `languages`, `rating`, utilization). Only add schema (`profiles.gender`, a team/shift concept) if you decide those specific factors are in scope now rather than later.
11. "Shadow Coach Required" admin queue (§4.2.4) — no new table needed if built as a filtered view over `unassignedFlagged` clients / failed `resolveLeave()` outcomes, reusing the escalations-style list UI already specified elsewhere in this doc.
12. Client-profile "Assign Shadow Coach" manual action (§4.2.3) — new UI action + server action calling the same per-occurrence assignment logic as the automatic path directly (bypassing `coach_leave`/`resolveLeave()`), used only for undocumented-absence cases and for resolving items in the queue from item 11. No new table required — reuses `shadow_coach_assignments`.
5. `subscriptions.pause_days_allowed`, `subscriptions.pause_days_used` (or derive "used" from existing `pause_started`/`pause_ended` timeline events instead of storing it — recommended, avoids a second source of truth), `package_tiers.default_pause_days` (§2.5, §3.11).
6. `escalations` concern-type/category column, only if a controlled vocabulary is actually wanted — `reason`/`description` already cover free-text type+detail (§3.10).
7. New `sales_view` (or equivalent query) joining `subscriptions`/`package_tiers` for §2.6 and §3.11's payment ledger.
8. RLS policy update on `client_profiles`/`client_timeline_events`: coach read access widened to all clients (not just assigned), write access unchanged (assigned-only) — migration on top of `0012_rls_policies.sql` (§1.5).
9. New `client_timeline_events` event types: explicit attendance present/absent, `plan_promise_adjusted`, and any rating-submitted event not already covered — no schema change needed (the table is already `event_type text` + `metadata jsonb`), just a services-layer convention to follow (§4.1).

---

## 7. Open Decisions (resolve before building)

1. **§1.1 / §2.1** — Does "escalations active today" mean *raised today* or *currently open regardless of raise date*? Spec assumes the latter unless told otherwise.
2. **§2.2** — Should "expired" be a stored `client_profiles.status` value or derived from subscription end date? Recommend derived, to avoid a second source of truth that can drift.
3. **§3.7** — Does the once-per-week rating cap apply to the mandatory post-session prompt, the ad-hoc "rate your trainer" sidebar, or both combined into a single weekly allowance? Spec text implies both share the same cap.
4. **§3.8** — What does "mandatory" measurement update actually block — dashboard access, session join, or nothing (just a persistent reminder)?
5. **§4.2 — RESOLVED by product direction:** exactly two paths exist — automatic assignment triggered solely by leave approval (§4.2.1/§4.2.2), and a single manual tool on the client profile scoped to undocumented/unapplied absences (§4.2.3), which is also reused to resolve the rare case where the automatic search finds no candidate (§4.2.4). Leave requests always require 24 hours' notice with no in-system exception — undocumented emergencies are handled entirely outside the leave-request flow. No further decision needed here; §4.2 and §1.9 reflect this. **§4.3 still open:** for non-leave-driven coach reassignment (admin/client requested), should "no coach available" release the slot automatically or stay flagged for manual resolution, as it does today?
6. **§2.5** — Is "promises" scoped to pause-days only (as literally requested) or should the override pattern generalize to other plan terms (session extensions, freeze credits, etc.)? Building it generalized now is cheap; retrofitting later is not.

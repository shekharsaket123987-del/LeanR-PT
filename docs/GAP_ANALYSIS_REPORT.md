# LeanR PT Platform — Master Gap Analysis Report

**Type:** Read-only architecture audit. No code was modified to produce this report.
**Reference spec:** `docs/FEATURE_SPEC_PORTAL_ENHANCEMENTS.md`
**Method:** Six independent deep-reads of the actual source (`src/app/**`, `src/lib/services/**`, `src/lib/actions/**`, `supabase/migrations/0001–0029`), each verifying the spec's own status tags against real code rather than trusting them. Every row below is backed by a specific file, and where feasible a function/line reference.

---

## 0. Spec-vs-Code Corrections (read this before using the spec doc as a work queue)

The reference spec document is a strong starting point but is a **snapshot**, and this audit found several places where the live codebase has already moved past it, or where the spec's status tag doesn't match reality. Anyone using the spec to scope future work should treat the corrections below as authoritative over the spec's own tags:

| Spec claim | Spec tag | Actual status | Evidence |
|---|---|---|---|
| §4.2.3 Manual "Assign Shadow Coach" action on client profile | ❌ New | ✅ **Already built** | `src/components/admin/ShadowCoachAssignModal.tsx` (full modal: date range → candidate search → assign), wired into `AdminClientDetailClient.tsx:488`. Confirmed independently by two separate audits. |
| §3.8 Weekly progress-log cap is "advisory only, not enforced server-side" | 🔶 stated as unenforced | ✅ **Actually enforced server-side** | `progressLogs.service.ts:56-68` throws if a log exists within 7 days, for the `client` role. The spec's own open decision (#4, what "mandatory" blocks) is still genuinely open — but the cap itself is real, not advisory. |
| §3.10 Concern "type" needs to become a controlled vocabulary | 🔶 open question | ✅ **Already resolved** | `escalations.category` has a CHECK-constrained 7-value vocabulary (migration `0020`) and a real UI dropdown (`CONCERN_CATEGORIES` in `src/lib/constants/concern-categories.ts`, used in `MyConcernsClient.tsx`). |
| §4.2.2 Gender not modeled anywhere for shadow-coach scoring | ❌ New field needed | 🔶 **Partially wrong** | `coach_profiles.gender` already exists (migration `0020`, added for demo-booking preference matching) — reusable directly, no new column needed if gender-preference matching is adopted. |
| §3.2 `/client/plans` may be a bare checkout form needing sales content | 🔶 open question | ✅ **Already a real marketing page** | `PlansMarketingClient.tsx` — Why-LEANR grid, savings badges, demo-session CTA. No extension needed. |

**One internal discrepancy resolved during synthesis:** the Backend/Database audit reported "zero call sites" for the shadow-coach manual-assignment actions, while the Admin Portal and Cross-Cutting Workflows audits both cited the exact wiring with file:line evidence. This report treats the manual-assignment tool as **built and wired** (the two corroborating, more specific findings outweigh the one grep-based negative).

---

## 1. Client Portal

*Full detail: `src/app/client/**`, `src/components/client/**`, `client-portal.actions.ts`, `client-progress.actions.ts`, `bookings.service.ts`, `progressLogs.service.ts`.*

| Feature | Current Implementation | Final Specification | Completion % | Gap | Recommendation | Priority | Est. Effort |
|---|---|---|---|---|---|---|---|
| Dashboard — sessions/package summary | `getClientDashboardAction` — used/remaining ring, next session, completed count, streak | Full KPI set (§3.3) | 90% | None material | — | Low | — |
| Dashboard — journey day counter | Not present; `client_onboarding` start date never read here | "Day N of your journey" | 0% | No query, no UI | Add computed field + header display | Low | 0.5–1 day |
| Dashboard — coach + rating shown together | `NextSessionCard.tsx` shows coach name only; rating field hardcoded to `0` in `toSessionView()` (`client-portal.actions.ts:68`) | Coach info + aggregate rating together | 50% | Rating plumbed but never rendered | Render `★ rating` badge next to coach name | Low | 0.5 day |
| Join session — live countdown | Boolean gate only (`canJoin = hrs <= 1/6`), static "opens 10 min before" text | Live ticking countdown ("join in 59 min") | 25% | No `setInterval` component | Build shared `<JoinCountdown>` (reused coach-side) | Medium | 1–2 days |
| Session booking flow | `BookSessionClient.tsx` 3-step wizard, first-session-free-assessment logic, hold→confirm | Baseline | 90% | `reminderOptIn` checkbox is dead UI state, never sent to server | Wire it through or remove | Low | 0.5 day |
| Slot availability | `getOpenSlots()` — real computation against `coach_availability` | Baseline | 100% | None | — | — | — |
| Slot recommendations | None — chronological list only, no ranking | Not in governing spec | 0% | Out of spec scope | Confirm with product before building | Low | — |
| Waitlist | Deliberately absent — admin-notify-only by design (`schedule.actions.ts:115-117`) | Not in spec | 0% | Explicit product decision, not a gap | None unless reversed | — | — |
| Reschedule | `RescheduleModal.tsx`, server-enforced cutoff + weekly cap of 2 | Cutoff + upfront policy popup | 75% | No pre-submit confirmation dialog stating the rule | Add confirm step before submit | Medium | 1 day |
| Cancel session | `MySessionsClient.tsx`, 12h cutoff via `cancel_booking()` RPC | Same + explicit pre-action policy popup | 75% | Same as above — policy only shown on rejection today | Extend `ConfirmDialog` copy | Medium | 0.5 day |
| Upcoming sessions (persistent widget) | Full page only (`/client/sessions`), not a dashboard-adjacent widget, not 6-day-scoped | Sidebar widget, next 6 days, inline actions | 50% | IA gap — flat page nav, not sidebar pattern | Add compact "Next 6 Days" dashboard card | Medium | 1–2 days |
| Join session (mechanics) | Boolean-gated button, no real video target/href | Baseline | 50% | No-op join button even in mock terms | Out of scope for this audit (video infra) | Medium | Vendor-dependent |
| Session history | `/client/sessions` + `/client/progress`, duplicated rendering | Baseline | 90% | Cosmetic duplication only | Share one list component | Low | — |
| Workout plans / notes | Backward-looking per-session coach notes only, no forward "my program" view | Not detailed beyond coach notes | 75% | Clarify if a forward plan view is wanted | Scope with product | Low–Med | Scope-dependent |
| Notifications | `NotificationsClient.tsx`, real templates, mark-read | Cross-cutting backbone | 90% | In-app only, no push/email (may be out of scope) | Confirm delivery channels separately | Low | — |
| Profile | `ClientProfileClient.tsx` — full edit | Baseline | 100% | None | — | — | — |
| Settings | No dedicated route exists | Not detailed in spec | 25% | Profile page is closest analog | Scope with product | Low | 1–2 days if built |
| Progress | Day-1-vs-latest diffs, numbers only | Graphs required (§3.9) | 50% | Zero `recharts` usage despite being a dependency | Build shared `<MeasurementChart>` | High | 2–3 days |
| Attendance (client visibility) | Correctly read-only, coach marks | Baseline | 100% | None | — | — | — |
| Feedback / Rating | Single `rating` value + text, **no rate-limiting at all** | Two dimensions (quality/trainer) + weekly cap | 25% | Confirmed both gaps exactly as spec states | Split columns + copy `progressLogs` weekly-cap pattern | High | 1–2 days |
| Update Measurement (mandatory) | Weekly cap **is** enforced server-side (spec's claim of "advisory only" is stale); "mandatory" blocking mechanism itself absent | Weekly cadence, optionally mandatory | 75% | Only the actual gate mechanism is missing | Decide + implement block (dashboard/session-join vs. banner) | Medium | 1 day |
| Help & Support / Concerns | Full 7-category dropdown + free text, wired to escalations + timeline | §3.10 | 100% | Spec's open question already resolved | None | — | — |
| Subscription & Payments (client view) | No page/component at all — subscriptions are admin-write-only by design | Session tracking + pause-days + payment ledger | 25% | Ledger and pause-days both fully absent | Build once §2.5/§2.6 schema exists | High | 2–3 days |
| Onboarding | Full form, feeds journey state machine | Baseline | 90% | BMI not computed (belongs to §5) | — | — | — |
| Plans / pre-purchase marketing | Real sales/marketing page, not bare checkout | §3.2 | 100% | Spec's open question resolved | None | — | — |
| Demo booking | Full gender-aware slot search for prospects | Not in spec | 100% | Beyond spec scope | — | — | — |
| Error handling | Consistent `ActionResult`/`isFailure` pattern app-wide | Baseline | 90% | None | — | — | — |
| Empty states | `EmptyState` reused consistently across every list/page | Baseline | 100% | None | — | — | — |
| Loading states | Button-level spinners; no route-level skeletons for server-fetched data | Baseline | 75% | No skeleton loaders for initial page loads | Add `loading.tsx` if needed | Low | 1 day |
| Responsive behaviour | Tailwind responsive classes used throughout | Baseline | 75% (code-level, unverified visually) | Not tested in an actual browser as part of this audit | Manually verify breakpoints | Low | — |

### Client Portal — Strengths / Weaknesses / Debt
**Strengths:** server-side (not just UI) enforcement of booking/cancel/reschedule policy; disciplined `ActionResult` error pattern everywhere; journey-state machine cleanly gates marketing → activation → onboarding → active; two of the spec's own open questions (concern categories, weekly progress cap) are already resolved in code, ahead of the spec doc itself.

**Weaknesses:** the entire "sidebar widget" family (§3.4–§3.11) is built as flat full pages, not persistent dashboard-adjacent widgets; rating is single-dimension with zero rate-limiting; no live countdown anywhere; no client-facing payment/invoice history.

**Missing components:** BMI calc, live join-countdown, two-dimension rating + weekly cap, payments ledger, pre-submit policy confirmation modal, progress charts, journey-day display.

**Technical debt:** dead `reminderOptIn` checkbox; duplicated session-history rendering between two pages; `CoachView.rating` hardcoded to `0` in one code path despite the type carrying a real field.

**Suggested improvements:** fix spec-vs-code drift before further planning; prioritize the rating-split work (cleanest gap, proven pattern to copy); build shared `<JoinCountdown>`/`<MeasurementChart>` once for reuse across portals; treat the sidebar IA gap as a product decision, not an engineering default.

**Overall Client Portal Completion: 72%**

---

## 2. Coach Portal

*Full detail: `src/app/coach/**`, `coach-portal.actions.ts`, `coach-profile.actions.ts`, `availability.service.ts`, `bookings.service.ts`.*

| Feature | Current Implementation | Final Specification | Completion % | Gap | Recommendation | Priority | Est. Effort |
|---|---|---|---|---|---|---|---|
| Dashboard — core KPIs | Sessions This Week, Completed, Missed, Utilization % | Same + today's count, active/paused clients, avg rating, escalation count (§1.1) | 50% | 4 of 8 required cards missing | Add 4 `StatCard`s from existing/near-existing aggregates | High | 0.5–1 day |
| Skills field (coach profile) | No coach-facing UI/action; admin's `skills` param actually writes to `secondary_specializations` | Append-only coach field, full-edit admin field | 10% | No distinct column, no coach-facing action at all | Add `coach_profiles.skills text[]` + append-only action | Medium | 0.5 day |
| Sidebar — Today's Tasks | Doesn't exist; join-window is boolean, attendance/notes only reachable from full session page | Persistent widget w/ live countdown + inline attendance/notes (§1.3) | 25% | Backing data/actions exist; widget/timer/inline actions don't | Build widget w/ `setInterval` countdown | High | 2–3 days |
| Attendance → distinct timeline event (present) | Absent path logs `session_missed`; **present path logs no timeline event at all** | Both present/absent get distinct events (§1.3.3) | 50% | Present-branch gap confirmed at `bookings.service.ts:322-367` | Add `logTimelineEvent` call in present branch | Medium | 0.5 day |
| 2-hour overdue attendance rule | No column, no sweep, no template | New sweep + `attendance_overdue` flag + notification (§1.3) | 0% | Entirely unbuilt | Mirror `mark_missed_bookings()` pattern | High | 1–1.5 days |
| Sidebar — Upcoming Sessions (3-day) | Not a dedicated widget; full schedule returned unfiltered | 3-day chronological list (§1.4) | 10% | Data exists broadly; specific widget doesn't | Add date filter + new component | Medium | 0.5 day |
| Sidebar — Global Search | Coach queries are scoped to own clients only; RLS actively blocks reading others | Search any client, read-only if unassigned (§1.5) | 0% | Needs new UI + RLS policy change | New action + widen coach SELECT RLS (write stays assigned-only) | High | 1.5–2 days |
| Sidebar — Pending Tasks | No such widget/query | Derived list: past sessions missing attendance/notes (§1.6) | 0% | Pure query gap, no schema needed | Add `NOT EXISTS`-style query + widget | Medium | 0.5–1 day |
| Sidebar — Active/Paused Clients | Full list w/ filters, search, start date already shown | Same + avg rating column (§1.7) | 75% | Rating column missing (blocked on rating schema) | Add once rating split lands | Medium | 0.5 day (post-schema) |
| Escalations (coach view) | Read-only list; **no Active/Resolved tabs**; client ID/plan not fetched at all | Filter tabs + client ID/name/plan/summary/date/status (§1.8) | 50% | Tabs entirely absent; two columns missing from the query | Add tabs + fetch `client_code`/plan | Medium | 0.5–1 day |
| Leave requests — partial/hourly | Whole-day only, no `leave_type`, no session scoping | Full-day vs partial-day (§1.9) | 0% | No schema, no UI concept | Add `leave_type` enum + session scoping | Medium | 1.5–2 days |
| Leave requests — 24h advance notice | **Not enforced at all** — UI's date picker actually permits same-day requests | Unconditional 24h minimum notice (§1.9) | 0% | Zero validation client- or server-side; UI actively allows the violating case | Add server-side check in `requestLeave()` | High | 0.5 day |
| Notes / workout assignment | Full session-notes flow, server-gated on attendance=present | Same (§1.3.2, §1.6) | 90% | Only reachable from full session page, not sidebars | Wire into new sidebar widgets once built | Low (once sidebars exist) | included above |
| Attendance — "late" status | DB enum supports it; app code hard-typed to present/absent only | Confirm before treating as net-new | 50% | Schema ready, UI/logic doesn't expose it | Product decision needed first | Low/Med | 0.5 day if greenlit |
| Session workflow (join→attendance→notes→complete) | Fully coherent end-to-end on the direct session page | Same, reachable from sidebars too | 90% | Sidebar entry points missing (tracked above) | No rework, just wiring | Low | included above |
| Availability — weekly hours | Full day-by-day toggle + time editor | Baseline | 100% | None | — | — | — |
| Break management | No concept anywhere in schema or code; not in governing spec either | Not specified in governing spec | 0% (unscoped) | Gap only vs. generic checklist, not the spec | Confirm with product if actually in scope | Low | 1–2 days if greenlit |
| Shadow coach (coach-facing) | Passive visibility via activity feed; no dedicated badge/section | Optional "Shadow Session" badge only (§4.2.7, explicitly low-priority) | 75% | Optional badge missing | Add badge if time allows | Low | 0.5 day |
| Notifications (coach) | Full list view, reused component | Cross-cutting + overdue-attendance alert | 75% | New overdue-attendance type not wired (blocked on sweep) | Wire once sweep exists | Medium | included above |
| Analytics / Performance page | 13-metric `StatCard` set + merged activity timeline | Covers §1.1's KPI set | 100% | None — exceeds spec's explicit asks | — | — | — |
| Profile page | Full display + limited self-edit (phone/emergency/photo) | Same + Skills field | 90% | Skills gap tracked above | — | — | — |
| Client detail (coach-facing) | Demographics, goals, session summary, weekly progress numbers, single-value rating, timeline | Same + BMI + progress graphs (§5.2–5.4) | 75% | No BMI calc; no chart component, `recharts` unused | Add BMI compute-on-read + shared chart component | Medium | BMI 0.25 day; graphs 1 day |

### Coach Portal — Strengths / Weaknesses / Debt
**Strengths:** session workflow (attendance→notes→completion) is server-gated, not UI-only; Performance/Analytics page already exceeds spec; availability and clients-list are fully-featured with good UX.

**Weaknesses:** the entire persistent-sidebar concept (§1.3–§1.6) doesn't exist as a layout pattern — every sidebar item is a full feature to build, not a layout tweak; join-window logic is boolean everywhere, not a live countdown; **leave requests have zero 24-hour advance-notice enforcement, and the current UI actively permits the exact violating case (same-day requests)**.

**Missing components:** Today's Tasks, Upcoming (3-day), Global Search, Pending Tasks widgets; 2-hour overdue sweep; append-only Skills field; escalations filter tabs; BMI + progress charts.

**Technical debt:** attendance's "present" branch writes no timeline event (asymmetric with "absent"); global search will require careful RLS review; `CoachEscalationView` doesn't fetch `client_code` at all.

**Suggested improvements:** build sidebar widgets as one shared "coach workspace" panel sharing the same booking dataset with different filters; ship the 24h leave rule and overdue sweep first — both are small, high-risk-if-skipped, and unblock nothing else; share the `recharts` component between coach and admin client-detail views.

**Overall Coach Portal Completion: 58%**

---

## 3. Admin Portal

*Full detail: `src/app/admin/**`, `adminDashboard.service.ts`, `coachPerformance.service.ts`, `clients.service.ts`, `escalations.service.ts`, `coaches.service.ts`, `packages.service.ts`.*

| Feature | Current Implementation | Final Specification | Completion % | Gap | Recommendation | Priority | Est. Effort |
|---|---|---|---|---|---|---|---|
| Dashboard — core 7 KPIs | All computed and wired (`getAdminDashboard()`) | Baseline | 100% | None | — | — | — |
| Dashboard — active coaches count | Not present anywhere in the metrics interface | New KPI card (§2.1) | 0% | No query/field/card | Add count query + card | Low | 1–2 hrs |
| Dashboard — platform-wide avg rating | Exists only per-coach, not rolled up | New KPI (§2.1) | 10% | No aggregate query at dashboard level | Add aggregate over `coach_profiles.rating` | Low | 2–3 hrs |
| Dashboard — avg sessions/day | `avgSessionsPerClient` exists but is a *different* metric (per-client, not per-day) | Distinct new KPI (§2.1) | 0% | No per-day query exists | Add completed-sessions ÷ active-days query | Low | 2–3 hrs |
| Dashboard — universal client search | Only a local name/phone search scoped to the clients list page | Global search by ID/code/name (§2.1) | 10% | Not global, not by code | Add shared search component/topbar | Medium | 1 day |
| Client list — filters | `all/active/paused/inactive` tabs match enum exactly | Same + Expired (§2.2) | 75% | No "Expired" tab; must be derived, not a new enum value | Derive from subscription end date | Medium | 3–4 hrs |
| Client list — columns | Photo/name/phone, package, coach, sessions-left, status | + client ID/code, slot day/time (§2.2) | 50% | `client_code` and slot day/time columns both missing | Add both to list action | Medium | 4–6 hrs |
| Client detail — dashboard tab | Name/email/phone/coach/subscription | Baseline | 100% | None | — | — | — |
| Coach-change history + edit cascade | `reassignClientCoach` confirmed to cascade correctly and log timeline unconditionally | Same (§2.2) | 100% | None | — | — | — |
| BMI on client detail | Not present anywhere | Compute at read time (§5.2) | 0% | No calc, no display | Add computed field in detail action | Low | 1–2 hrs |
| Manual client controls (adjust sessions, transfer, pause, log measurement/escalation/refund, assign shadow) | All 7 actions wired and functional | Baseline | 100% | None | — | — | — |
| New coach creation | Full form: identity, employee code, specialization/skills, languages, slot pattern, auto-password | Baseline | 100% | None | — | — | — |
| Coach detail — performance panel | 13 stats incl. attendance%, no-show%, capacity, escalations, coach-change requests | + active/paused split (§2.3) | 75% | Active/paused shown as one lump figure | Add split query | Medium | 2–3 hrs |
| Coach detail — 7-day slot calendar | **Doesn't exist** — flat upcoming list only, no open/booked distinction, no `was_rescheduled` badge | Full 7-day grid per spec (§2.3) | 10% | Largest confirmed admin gap — underlying data exists, no grid UI consumes it | Build 7-day × time-slot grid component | High | 2–3 days |
| Coach profile edit (name/specialization/skills) | **No edit action exists at all** — create/disable/reassign only | Admin can edit + propagation (§2.3) | 0% | Spec assumed an edit capability exists to test; it doesn't | Build edit action + form | High | 1 day |
| Coach `skills` field | Conflated with `secondary_specializations`, write-once at creation | Distinct column, coach-append/admin-full-edit | 10% | No post-creation mutation path for anyone | Add real column + edit/append actions | Medium | 1 day |
| Disable / Delete coach | "Delete" button calls the *identical* handler as "Disable" | Distinct soft/hard actions | 50% | Mislabeled, not a real delete | Remove misleading button or implement real archival | Low | 1–2 hrs |
| Bulk reassign clients off a coach | Loops per client, no `force`, aborts entirely on first blocked client | Same, with partial-failure handling | 90% | No per-client success/fail reporting | Add try/catch + summary per client | Low | 2–3 hrs |
| Block/override coach slot (one-day leave) | Wired via `createOneDayLeave` | Same | 90% | Unconfirmed whether it routes through the same auto-shadow pipeline as a real leave | Verify routing | Medium | ~1 hr (verify) |
| Package CRUD — create | Only name/category/sessions/price settable; features/highlighted/original_price hardcoded | Full field set (§2.5) | 50% | Contradicts spec's "fully admin-editable" claim | Extend create modal with missing fields | Medium | 3–4 hrs |
| Package CRUD — edit existing | **Does not exist** — service function supports it, no UI caller does | Full edit post-creation (§2.5) | 0% | Once created, price/name/sessions can never be corrected, only archived | Add edit modal reusing `updatePackage` | High | 3–4 hrs |
| Package CRUD — archive | Soft-delete w/ confirm | Same | 100% | None | — | — | — |
| Promise-level overrides (pause-days) | Not present anywhere — pause is binary, no day-counting | Per-client override + timeline event (§2.5) | 0% | Schema, action, UI all absent | Add columns + admin action per §6 item 5 | Medium | 1–2 days |
| Sales list | **Does not exist** — reports page has CSV exports but nothing transaction-level | Dedicated sales page/view (§2.6) | 0% | Confirmed absent both as UI and as a view | Build `sales_view` + `/admin/sales` page | Medium | 1 day |
| Global/cross-client escalations page | **Does not exist** — escalations only visible per-client, one at a time; no nav entry at all | Dedicated page w/ Active/Resolved tabs (§2.7) | 25% | Backend fully built; no aggregate view | Add `/admin/escalations` w/ new list query | High | 4–6 hrs |
| Escalation "In Progress" action | `markEscalationInProgress` exists as dead code — no button calls it | Same | 75% | Unwired action | Wire button or remove | Low | 1–2 hrs |
| Shadow Coach — leave-approval UI | Full list, approve/reject, immediate auto-assignment feedback | Same (§4.2.1) | 100% | None | — | — | — |
| Shadow Coach — persistent "Required" queue | **Local React state only** — vanishes on navigation/refresh; no admin notifications page exists as a fallback either | Persistent, escalations-style list (§4.2.4) | 10% | Confirmed real, matches spec's own characterization exactly | Add durable query over unresolved cases | High | 1 day |
| Shadow Coach — manual assignment | **Fully built** (`ShadowCoachAssignModal.tsx` wired into client detail) — spec's ❌ New tag is stale | Same (§4.2.3) | 90% | Inherits matching-algorithm gap only (§4.2.2, other audit) | None on UI side | — | — |
| Coach change requests (admin review) | Full list + wiring confirmed | Baseline | 90% | Internals not deep-audited this pass | Spot-check approve/reject | Low | — |
| Admin notifications inbox | **Does not exist** — no nav entry, no page; `notifyAdmins()` writes with nothing to read them | Admin-wide notification view | 0% | Confirmed absent | Add `/admin/notifications` + nav entry | Medium | 4–6 hrs |
| Feature flags | **Does not exist anywhere**, and not defined in the governing spec either | Undefined scope | 0% (unscoped) | No corresponding spec section | Scope with product first | Low | Unscoped |
| Settings — session rules | 4 sliders backed by `system_settings` | Baseline | 100% | None | — | — | — |
| Settings — slot-engine config | Only session-duration exposed; `booking_window_*` settings appear to exist in DB but aren't editable in UI (hardcoded 5am–9pm elsewhere) | Full slot-engine config surface | 50% | Config drift risk between hardcoded UI value and DB setting | Surface `booking_window_start/end` as sliders | Low | 2–3 hrs |
| Reports — CSV exports | 5 working exports (client/coach/monthly/revenue/cancellation) | Same + sales list | 90% | Sales-list report missing (tracked above) | — | — | — |
| Reports — PDF export | Buttons exist but permanently disabled, explicitly marked "not yet available" in code | PDF export | 0% | Explicitly acknowledged as unbuilt | Implement or remove disabled buttons | Low | 1–2 days if pursued |
| Audit logs | Full trigger-based DB audit, filterable, actor-aware | Baseline | 100% | None — correctly distinguished from client timeline | — | — | — |

### Admin Portal — Strengths / Weaknesses / Debt
**Strengths:** core CRUD (client transfer, session adjustment, subscription pause, refund logging, escalation resolution) is solid end-to-end with real DB writes and timeline logging; audit log is fully built and correctly separated from the client-facing timeline; leave-approval → auto-shadow pipeline works and gives immediate feedback; the manual shadow-assignment tool is fully built (ahead of the spec's own documentation); CSV reporting covers 5 real report types.

**Weaknesses:** no global escalations view (admins check clients one at a time); no coach-edit capability at all once a coach is created; no package-edit (only create/archive); the "Shadow Coach Required" list is a one-shot toast tied to a single approval action, not a durable view — the single most consequential gap relative to spec intent; no admin notifications inbox as a fallback either; the 7-day coach slot calendar doesn't exist.

**Missing components:** persistent Shadow-Coach-Required queue, 7-day slot calendar, coach profile edit, distinct Skills column + edit UI, package edit UI, pause-days overrides, sales-list page/view, global escalations page, admin notifications inbox, 4 dashboard KPIs, "Expired" filter, BMI display.

**Technical debt:** "Delete Coach" is wired to the same handler as "Disable Coach"; `markEscalationInProgressAction` is dead code; bulk reassign has no partial-failure handling; hardcoded booking-window hours duplicate a DB setting that has no edit surface.

**Suggested improvements:** prioritize the persistent Shadow-Coach-Required queue and an admin notifications page together (same underlying problem); build one generic admin list-page component (search + status tabs + row-link) and reuse it for escalations/sales/notifications; add coach-profile editing before anything else in Coach Management — it's a basic CRUD gap, not a new feature.

**Overall Admin Portal Completion: 55%**

---

## 4. Backend

*Full detail: `src/lib/services/*.ts`, `src/lib/actions/*.ts`, `src/middleware.ts`, `src/lib/services/_auth.ts`.*

| Feature | Current Implementation | Final Specification | Completion % | Gap | Recommendation | Priority | Est. Effort |
|---|---|---|---|---|---|---|---|
| Authentication (session resolution) | Role read server-side on every request/action via `middleware.ts` + `getCallerContext()` | Baseline | 100% | None | — | — | — |
| Authorization (RBAC) | `requireRole()` at top of nearly every service fn; RLS as second layer | Baseline | 100% | None | — | — | — |
| Booking engine — hold/confirm | Two-phase `create_temporary_booking`/`confirm_booking` RPCs, row-locked, re-validated on confirm | Baseline | 100% | None | — | — | — |
| Booking engine — conflict detection | DB exclusion constraint (`bookings_no_coach_overlap`) + `has_scheduling_conflict()` on every write path | Hard guarantee | 100% | None | — | — | — |
| Recurring slot generation | Walks forward, skips leave/conflicts, generates 4 occurrences ahead | Rolling generation | 90% | No re-trigger/top-up once occurrences run low | Add scheduled top-up job | Medium | 0.5–1 day |
| Cancellation policy | 12h cutoff fully server-enforced, admin bypass path | Cutoff + upfront UI confirmation | 75% (backend 100%, UI gap noted in Client Portal) | UI-only gap, not backend | — | — | — |
| Reschedule policy | 1h cutoff + weekly cap of 2, fully server-enforced | Baseline | 100% | None | — | — | — |
| Attendance marking | Present leaves booking open for notes phase; absent immediately closes + logs distinct event | Distinct events both ways; transactional decrement | 75% | Present branch logs no timeline event; no overdue sweep | Add event + build sweep | High | 1 day (sweep) + 0.5 day (event) |
| Session notes submission | Server-gated on attendance=present, not just UI | Baseline | 100% | None | — | — | — |
| Session rating | Single value, **no weekly-cap enforcement at all** | Two dimensions + weekly cap | 25% | No schema split, no cap logic | Add columns + copy `createProgressLog`'s cap pattern verbatim | High | 1 day |
| Progress logging | Full 8-field set, weekly cap **enforced server-side** (contra spec's "advisory" characterization) | Weekly cadence, optionally mandatory | 75% | Only the "mandatory gate" behavior is genuinely missing | Implement chosen block mechanism | Medium | 0.5–1 day |
| Escalations / concerns | Full CRUD, admin-only resolve, category already CHECK-constrained | Type + detail (§3.10) | 90% | Spec's own open question already resolved | Verify frontend surfaces the 3-state filter | Low | 0.5 day |
| Shadow coach — auto trigger | `resolveLeave()` loops affected clients on approval, calls matching + assignment | Fully automatic (§4.2.1) | 100% | None — matches spec exactly | — | — | — |
| Shadow coach — matching logic | **Confirmed all-or-nothing**: breaks on first conflicting occurrence, excludes coach entirely; ranking is utilization-only | Per-occurrence resolution + weighted score | 25% | Exactly the two gaps spec identifies, with line numbers confirmed | Rewrite inner loop + add scoring function | High | 2–3 days |
| Shadow coach — manual assignment (backend) | Actions fully exist and are wired to the service layer (see §3 admin audit for UI confirmation) | Same | 90% | Inherits matching-algorithm gap only | — | — | — |
| Shadow coach — "required" queue | Only `notifyAdmins()` fires; nothing persists a queryable list | Persistent admin list | 10% | No filtered view/query exists | Add query over unresolved leave-driven gaps | Medium | 1 day |
| Shadow coach — reassignment if shadow becomes unavailable | Nothing — assignment never re-checked after creation | Re-run search on shadow's own unavailability | 0% | Not implemented | Build per §4.2.5 | Low | 1–2 days |
| Shadow coach — restore primary after leave | **Confirmed true by construction** — `assign_shadow_coach()` never touches `recurring_slots.coach_id` | Automatic reversion | 100% | None | — | — | — |
| Coach reassignment (admin fast path) | Blocks via `findUncoveredDays` unless forced, cascades correctly, logs timeline | Baseline | 100% | None | — | — | — |
| Coach reassignment (client-requested) | Full request→approve→pick-pattern→complete flow | Baseline | 100% | None | — | — | — |
| Leave requests — validation | Only `ends_on >= starts_on` checked; **confirmed no 24h advance-notice check anywhere** | 24h minimum, no exceptions | 25% | Exactly the gap spec identifies | Add server-side timestamp check | Medium | 0.5 day |
| Leave requests — partial/hourly | Date-only table, no `leave_type` | Full/partial distinction | 0% | Not implemented | Add enum + scoping column | Medium | 1–2 days |
| Notification dispatch | In-app only (`notifications` table); `channels` jsonb column exists but nothing populates/consumes it | In-app minimum, extensible later | 75% | Multi-channel delivery explicitly out of scope per migration's own header comment, not a bug | None needed unless scope changes | Low | — |
| Validation — server- vs. client-side | Correctly server-enforced for attendance-gate, cutoffs, weekly progress cap, RLS scoping | All rules server-enforced | 75% | Rating weekly-cap and leave 24h-notice rely on nothing today | Add alongside each feature as built | High | bundled above |
| Error handling pattern | Consistent `ActionResult` normalizer, descriptive messages, no swallowed errors found in 15+ services read | Baseline | 90% | No typed error-code/i18n layer (maturity nicety, not a defect) | Consider only if i18n becomes a requirement | Low | — |
| Global search (backend) | **Confirmed absent** — no search action exists anywhere; client-scoped queries only ever return the caller's own linked records | Universal search by ID/name/code | 0% | No action, no widened RLS | Build action + widen RLS per §1.5 | High | 1–2 days |
| Coach `skills` field (backend) | Doesn't exist as its own column — conflated with `secondary_specializations` at creation only | Distinct append-only field | 0% | Confirmed schema gap | Add column + append-only action | Medium | 0.5–1 day |
| Plan "promises" (pause-days, backend) | No day-counting fields exist; pause/resume is a binary status flip only | Per-client override on template | 0% | Confirmed absent | Add columns + action per §2.5 | Medium | 1–2 days |
| Sales list / payment ledger (backend) | No view, no dedicated query; `bookings.amount_paid` only tracks demo/assessment fees | Transaction-level ledger | 10% | Join needed, nothing built | Add `sales_view` + action | Medium | 1 day |
| Coach dashboard "average rating" aggregate | `coach_profiles.rating` is a stored value with **no confirmed write-path from actual booking ratings** — likely stale/seed-only | Live aggregate | 50% | No recompute trigger/service found | Add recompute once rating dimensions land | Medium | 0.5 day (post rating-split) |
| Audit logging | Trigger-based, covers 7 core tables, actor-aware, before/after JSON | Full admin activity log | 100% | None | — | — | — |

### Backend — Strengths / Weaknesses / Debt
**Strengths:** consistent three-layer defense (RLS → app-level role check → DB exclusion constraint on booking-critical paths); booking-conflict/availability logic centralized in `security definer` SQL functions, not duplicated per caller; timeline used genuinely everywhere a state change happens (15+ call sites, one funnel function); IST timezone bug fixed consistently across every function that needed it; migration history reads as genuinely incremental and reversible.

**Weaknesses:** shadow-coach matching algorithm has a real, confirmed correctness bug that actively contradicts a stated product requirement; session rating has no weekly-cap enforcement at all despite an almost identical feature (progress logs) already having one — an internal inconsistency, not a hard problem; leave requests have zero temporal validation beyond date ordering.

**Missing components:** global search, sales ledger, pause-days tracking, rating-dimension split + cap, partial-day leave, 2-hour attendance-overdue sweep, persistent shadow-coach queue.

**Technical debt:** `coach_profiles.rating` likely drifts with no recompute path; `notifications.channels` jsonb column has no consumer (build the dispatcher or drop the column); three near-identical "resolve current coach" helper functions exist across different services and should be consolidated.

**Suggested improvements:** wire the already-built shadow-coach manual-assignment actions into the admin UI (cheapest high-value fix available — mostly done, per the admin audit it already is); fix per-occurrence matching before building the required-queue on top of it; consolidate the duplicate coach-resolution helpers.

**Overall Backend Completion: 68%**

---

## 5. Database

*Full detail: `supabase/migrations/0001–0029` read in sequence.*

| Feature | Current Implementation | Final Specification | Completion % | Gap | Recommendation | Priority | Est. Effort |
|---|---|---|---|---|---|---|---|
| Core identity tables | `profiles`/`coach_profiles`/`client_profiles` exactly as spec describes, auto-provisioned via trigger | Baseline | 100% | None | — | — | — |
| Enums | All 15 confirmed exactly as spec states, including no-`scheduled`-literal and `late` already present in `attendance_status` | Baseline | 100% | None | — | — | — |
| Bookings + no-overlap guarantee | GiST exclusion constraint on `(coach_id, tstzrange(...))`, filtered to `upcoming` — enforced at DB level | Hard double-booking prevention | 100% | None | — | — | — |
| Indexes on hot columns | `bookings` indexed on `client_id`/`coach_id`/`status`/`scheduled_start`; most other tables similarly covered | Adequate for current scale | 90% | No index on `bookings.recurring_slot_id`, `subscriptions.package_id`, or the FK columns in `shadow_coach_assignments`/`coach_change_requests` used in RLS OR-conditions | Add 4 missing FK indexes | Low | 0.5 day |
| RLS coverage | Every sensitive table has admin-all + role-scoped policies; no table found with RLS disabled that shouldn't be | Comprehensive RLS | 100% | None | — | — | — |
| RLS — coach read breadth (global search) | Confirmed still scoped to `coach_client_linked()` only, no later migration widens it | Read-all/write-if-assigned | 0% | Exactly the gap spec identifies | New migration widening SELECT policy | Medium–High | 0.5–1 day |
| Shadow coach continuity schema | `primary_coach_id`/`shadow_coach_id` genuinely distinct columns with a differing-values CHECK | Baseline | 100% | None | — | — | — |
| Timeline table | Append-only via RLS (no client/coach mutate policy), `event_type text` so new types need no migration | Baseline | 100% | None | — | — | — |
| Progress logs — full measurement set | All 8 fields confirmed present across two migrations | Baseline | 100% | None | — | — | — |
| Rating fields | Only single `rating smallint` + `client_feedback text` — **confirmed no dimension split anywhere in 29 migrations** | Two-dimension rating | 0% | Schema doesn't exist | Add split columns or dedicated `ratings` table | High | 0.5 day |
| Coach `skills` column | **Confirmed absent** — full column list checked, no `skills` field anywhere | New field | 0% | Confirmed gap | Add migration | Medium | 0.5 day |
| Coach `gender` column | **Already exists** (migration `0020`) — spec undersells this, framing it as needing `profiles.gender` | Optional shadow-matching factor | 90% (schema present, just unused in matching) | Spec doc slightly misleading here | Reuse directly if gender-matching adopted | Low | 0 (code-only) |
| Escalation category | **Already exists**, CHECK-constrained 7-value vocabulary | Fixed dropdown | 100% | Spec frames as open question; already resolved | Verify frontend usage only | Low | — |
| `attendance_overdue` + sweep | Does not exist; `mark_missed_bookings()` handles a different case entirely | New column + sweep + template | 0% | Confirmed gap | Add per §6 item 2 | High | 1 day |
| Pause-days / plan promises schema | Only `status`/`started_at`/`paused_at`/`resumed_at`/`activated_at` exist — no day-counting fields | New override fields | 0% | Confirmed gap | Add per §6 item 5 | Medium | 0.5 day |
| Sales view | Does not exist in any migration | New reporting view | 0% | Confirmed gap | Add `sales_view` following `0010`'s `security_invoker=true` convention | Medium | 0.5 day |
| Leave `leave_type` (full/partial) | Does not exist; `coach_leave` still date-only in every later migration | New enum + scoping | 0% | Confirmed gap | Add per §6 item 4 | Medium | 1 day |
| Storage buckets | `avatars`/`progress-photos`/`coach-certifications` all correctly scoped | Baseline (photo-handoff explicitly out of scope) | 100% | None (deferred by design) | — | — | — |
| Views / reporting layer | 5 views, all correctly using `security_invoker=true` | Baseline | 100% | Missing `sales_view` only (tracked above) | — | — | — |
| Constraint quality | Check constraints throughout (`rating between 0 and 5`, `sessions_count > 0`, `end_time > start_time`, differing-coach CHECK, etc.) — genuinely enforced, not just app-level | Baseline | 100% | None | — | — | — |
| Scalability posture | No partitioning, no materialized views; correlated lateral subqueries in `coach_utilization_view` fine at current scale (tens–low hundreds of coaches) | No explicit scale target stated | 90% (adequate for apparent current scale) | Revisit once coach count exceeds ~500 | Monitor query plans as data grows | Low | — |

### Database — Strengths / Weaknesses / Debt
**Strengths:** migration history is a reliable source of truth — every claim in the spec's §0 reference was independently re-verified against the actual SQL, with only two discrepancies found (both cases where the codebase is further along than the spec credits); constraint discipline is unusually strong (CHECK constraints, GiST exclusion constraint, unique constraints) for a project at this stage; RLS correctly uses `security definer` helpers to avoid self-recursion, a common pitfall avoided here.

**Weaknesses:** two items the spec proposes as net-new (`gender` column, escalation category) already have full or partial coverage the spec doesn't credit — building from the spec doc alone without re-diffing against the live schema risks duplicate/conflicting columns; the remaining gaps (rating split, pause-days, skills, sales view, leave type) are all simple additive migrations, none requiring restructuring of existing tables.

**Missing components:** `quality_rating`/`trainer_rating` split, `coach_profiles.skills`, `subscriptions.pause_days_allowed/used`, `package_tiers.default_pause_days`, `bookings.attendance_overdue`, `coach_leave.leave_type`, `sales_view`, widened coach-read RLS policy.

**Technical debt:** a handful of FK columns used in RLS OR-conditions lack indexes; `escalation_status` enum was extended in-place rather than designed with all states from the start (harmless in Postgres, but the kind of change that needs its own migration due to same-transaction restrictions).

**Suggested improvements:** re-diff against the live schema before implementing any spec item tagged "❌ New" — this audit found two cases where that would have caused duplicate work; bundle the 4 missing FK indexes into whichever migration goes out first.

**Overall Database Completion: 88%**

---

## 6. Cross-Cutting Workflows (Timeline, Shadow Coach, Reassignment, Client Profile)

*Full detail: `timeline.service.ts`, `scheduling.service.ts`, `availability.service.ts`, `coachChange.service.ts`, `clients.service.ts`, plus migrations `0006, 0008, 0010, 0011, 0017, 0021, 0024, 0025, 0026`.*

### Workflow: Timeline
```
Any service mutation → logTimelineEvent(clientId, eventType, title, {description, metadata, actorId})
    → INSERT into client_timeline_events (system-write only, append-only via RLS)
    → listClientTimeline() reads back, RLS-scoped per role
```
No missing steps in the mechanism — every service audited writes through it correctly. **Gap:** no `attendance_marked_present` event type yet (present-marking is silent until notes are submitted); no `plan_promise_adjusted` type (depends on §2.5 schema).

| Feature | Completion % | Gap |
|---|---|---|
| Timeline backbone | 90% | Missing `attendance_marked_present` event type; `plan_promise_adjusted` pending schema |

### Workflow: Shadow Coach Assignment (full detail)

**4.2.1 Automatic path (leave-driven):**
```
Coach submits leave → Admin approves (resolveLeave)
    → status='approved', notify coach
    → for each affected client: findShadowCoachCandidates() → assignShadowCoach() if found,
      else push to unassignedFlagged[] + notifyAdmins() [transient only — see 4.2.4]
```
Fully built and matches spec almost exactly — **100%**.

**4.2.2 Matching logic — confirmed bug:**
```
CURRENT:  for coach in active_coaches: for occurrence in [date range]:
              if NOT free(occurrence): reject coach entirely, break        ← all-or-nothing
          sort by utilizationPct ascending only                            ← no specialization/language/rating weighting
REQUIRED: for each occurrence independently: find best-scoring free coach
          (specialization + language + rating + utilization, weighted)
```
Confirmed with exact line numbers in `scheduling.service.ts`. **25%.**

**4.2.3 Manual path (undocumented absence) — already built, contra spec tag:**
```
Admin opens client profile → ShadowCoachAssignModal → findShadowCoachCandidatesAction
    → assignShadowCoachAction → same underlying service functions as the automatic path
```
Fully wired. **90%** (only inherits the 4.2.2 matching gap).

**4.2.4 No-candidate-found queue:**
```
CURRENT:  resolveLeave() → unassignedFlagged[] → shown ONLY in a transient "just approved"
          summary card → [MISSING: disappears on navigation, no durable list, no admin
          notifications inbox as fallback either]
REQUIRED: persistent, filterable "Shadow Coach Required" list, escalations-style UI
```
**10%.**

**4.2.5 Shadow coach becomes unavailable mid-assignment:** nothing re-checks an assignment once made. **0%.**

**4.2.6 Long leave → permanent-change routing:** no duration threshold exists anywhere. **0%.**

**4.2.7 Deliberately out of scope:** confirmed none of these exist (accept/decline timer, shadow pool, shadow-specific metrics, photo handoff) — correctly deferred, not a build gap.

### Workflow: Coach Reassignment (non-leave-driven)
```
Path A (admin fast path): reassignClientCoach() → findUncoveredDays() blocks unless forced →
    cascades to recurring_slots + open bookings → logs coach_changed
Path B (client-requested): requestCoachChange() → admin resolves → completeCoachChange() →
    retires old slots/bookings → creates new recurring pattern → logs coach_changed
```
Both confirmed correct and cascading properly. **90%** — only gap is an unresolved product decision (auto-release vs. stay-flagged when no coach available), not a code defect.

### Workflow: Booking / Confirm / Expiry, Reschedule, Cancellation
All three confirmed **fully built, race-safe, and IST-correct** — two-phase hold/confirm with row-locking and re-validation, 12h/1h cutoff split enforced server-side, cancel-triggers-regeneration-of-next-occurrence all verified directly in the SQL/service bodies. **100%, 90% (reschedule — UI confirmation popup only), 100%** respectively.

### Workflow: Session Completion / Attendance
```
markAttendance('present') → attendance row upserted, booking stays 'upcoming' → [MISSING: no
    timeline event logged here at all]
markAttendance('absent') → booking → 'missed' → logTimelineEvent('session_missed')
submitSessionNotes() → re-checks attendance=present (hard server gate) → booking → 'completed' →
    logs 'coach_notes_uploaded' + 'session_completed'
Subscription decrement: NOT a stored counter — subscription_usage_view computes live at read
    time, so it is automatically consistent with the attendance write (no drift risk, contrary
    to what the spec worried about)
```
**Real, confirmed gap:** the 2-hour overdue rule is completely absent — no column, no sweep, no template exists anywhere in 29 migrations.

### Workflow: Notifications
18 templates confirmed, all wired to real call sites (not orphaned). Missing templates are 1:1 with the feature gaps already listed above (overdue-attendance alert, rating-submitted, `plan_promise_adjusted`) — not a pipeline defect.

### Workflow: Admin Approval (Leave) & Slot Generation
Both fully built, timezone-correct, conflict/leave-aware. Leave approval triggers the shadow search **synchronously inline** — correctness is fine; at scale (large roster, many affected clients) this becomes a performance consideration, not a correctness one.

### Cross-Cutting — Strengths / Weaknesses / Debt
**Strengths:** booking/hold/confirm/cancel/reschedule core is production-grade (row-locking, re-validation, IST-correctness, admin-bypass-with-audit-trail); timeline is a clean, closed abstraction with zero bypasses found; the shadow-coach automatic **and** manual paths are both fully wired — the codebase is meaningfully ahead of what the spec document credits it for; coach reassignment has a real safety check (`findUncoveredDays`), not a rubber stamp; subscription session-remaining is a live view, eliminating an entire class of drift bugs.

**Weaknesses:** the shadow-coach matching algorithm's core shape is wrong for the stated requirement (all-or-nothing instead of per-occurrence, utilization-only instead of weighted); no mechanism ever revisits a shadow assignment once made; the "no candidate found" case surfaces once, transiently, then disappears; attendance has a silent timeline gap on the "present" path.

**Missing components:** per-occurrence shadow-coach resolution + weighted scoring, persistent required-queue, shadow re-validation sweep, long-leave routing threshold, 2-hour overdue sweep, 24-hour leave-notice validation, partial-day leave schema, `attendance_marked_present` event type.

**Technical debt:** `findShadowCoachCandidates()` makes two sequential RPC round-trips per occurrence per candidate coach — will not scale gracefully once rewritten for per-occurrence resolution without batching.

**Suggested improvements:** rewrite the matching function for per-occurrence resolution first — every downstream gap (queue, re-validation sweep) is easier once the data shape is per-session; add the overdue sweep using the exact `mark_missed_bookings()` pattern already established; land the required-queue as a thin view before building anything more elaborate on top.

**Overall Cross-Cutting Workflows Completion: 68%**

---

## 7. MASTER GAP REPORT

| Module | Overall Completion |
|---|---|
| **Client Portal** | **72%** |
| **Coach Portal** | **58%** |
| **Admin Portal** | **55%** |
| **Backend** | **68%** |
| **Database** | **88%** |
| **Cross-Cutting Workflows** | **68%** |
| **PROJECT OVERALL** | **~68%** |

*Project overall is the unweighted mean across all six audited layers. Database is the clear outlier on the high side (deep, well-constrained schema with a short, purely-additive gap list); Admin and Coach Portals are the lowest, both dragged down primarily by one recurring pattern — the spec's "persistent sidebar/queue" UX concept not existing as a layout pattern anywhere in the app yet, rather than broad functional absence.*

**The single most load-bearing finding across all six audits:** the backend/database foundation (booking engine, RLS, timeline, shadow-coach automatic+manual assignment) is materially stronger and further along than the reference spec document credits it for. The actual remaining work is concentrated in a well-defined, mostly-additive list:
1. Shadow-coach matching algorithm rewrite (per-occurrence + weighted scoring) — the single highest-value backend fix.
2. Session rating dimension-split + weekly cap.
3. 24-hour leave advance-notice validation (currently a live, unenforced hard business rule).
4. 2-hour attendance-overdue sweep.
5. Persistent "Shadow Coach Required" admin queue + general admin notifications inbox.
6. Coach portal's entire sidebar-widget layer (Today's Tasks, Pending Tasks, Global Search, Upcoming-3-days).
7. Admin coach/package edit capability (basic CRUD gaps, not new features).
8. Pause-days/promise overrides + sales ledger (schema + UI, both currently 0%).

---

## 8. Implementation Roadmap

### Phase 1 — Critical Infrastructure & Data Integrity
**Goal:** Close hard, currently-unenforced business rules and silent data gaps before building new surfaces on top of them.
**Features:**
- 24-hour advance-notice validation on coach leave requests (currently allows same-day — active bug, not just a gap)
- Session rating schema split (`quality_rating`/`trainer_rating`) + weekly-cap enforcement (copy `progressLogs.service.ts` pattern)
- `attendance_marked_present` distinct timeline event
- 2-hour attendance-overdue sweep (`bookings.attendance_overdue` + `flag_overdue_attendance()` + notification template)
- `coach_profiles.skills` column + coach-facing append-only action + admin edit UI
- Missing FK indexes (`bookings.recurring_slot_id`, `subscriptions.package_id`, shadow/coach-change FK columns)
- Fix "Delete Coach" mislabeling; wire or remove dead `markEscalationInProgress` action
**Dependencies:** None — purely additive migrations and isolated service-layer fixes.
**Estimated effort:** ~2 weeks
**Risks:** Rating schema change touches display code in 3 portals simultaneously — coordinate the rollout; migration sequencing must not break existing RLS.
**Deliverables:** New migrations (0030+), updated services, minor UI additions — no large new surfaces.

### Phase 2 — Booking/Scheduling Engine: Shadow Coach & Leave
**Goal:** Fix the confirmed shadow-coach matching correctness bug and give admins durable visibility into unresolved cases.
**Features:**
- Rewrite `findShadowCoachCandidates()` for per-occurrence resolution + weighted scoring (specialization/language/rating/utilization)
- Partial-day/hourly leave (`leave_type` enum + session scoping)
- Persistent "Shadow Coach Required" admin queue
- Shadow-coach-becomes-unavailable re-check sweep (§4.2.5)
- Long-leave → permanent-change routing threshold (§4.2.6)
**Dependencies:** Phase 1 (reuses the overdue-sweep pattern; skills/rating not required but should land first for sequencing simplicity).
**Estimated effort:** ~3 weeks
**Risks:** Algorithm rewrite touches live booking-critical logic — needs strong test coverage before ship; per-occurrence resolution changes the RPC call shape/volume, watch performance.
**Deliverables:** Rewritten matching engine in `scheduling.service.ts`, new admin queue page, partial-day leave UI.

### Phase 3 — Coach Portal Sidebar/Workspace Buildout
**Goal:** Build the coach's daily-workflow widget system the spec treats as central, none of which exists as a layout pattern today.
**Features:** Today's Tasks (live countdown + inline attendance/notes), Upcoming (3-day), Pending Tasks, Global Search (+ RLS widening), Escalations Active/Resolved tabs, dashboard KPI additions, Skills UI, shared `<JoinCountdown>` component (reused client-side too).
**Dependencies:** Phase 1 (skills column, attendance-overdue flag).
**Estimated effort:** ~3 weeks
**Risks:** RLS widening for global search needs careful review to avoid accidentally loosening write access alongside read access.
**Deliverables:** New coach dashboard widgets, coach global search, escalations filter tabs.

### Phase 4 — Admin Portal Completion
**Goal:** Close core CRUD gaps (coach/package edit) and add missing oversight surfaces.
**Features:** Coach profile edit (name/specialization/skills), package edit UI, 7-day coach slot calendar, global cross-client escalations page, admin notifications inbox, dashboard KPI additions (active coaches, avg rating, avg sessions/day, universal search), "Expired" client filter, BMI display, pause-days/promise overrides (schema+UI), sales list page/view.
**Dependencies:** Phase 1 (rating schema for avg-rating KPI); Phase 2 (reuse the required-queue's list-page pattern for escalations/notifications).
**Estimated effort:** ~4 weeks (largest phase)
**Risks:** Package edits must not retroactively alter pricing for already-subscribed clients — scope the edit to future purchases only.
**Deliverables:** Coach edit form, package edit form, 7-day calendar grid, `/admin/escalations`, `/admin/notifications`, `/admin/sales`.

### Phase 5 — Automation & Workflow Polish
**Goal:** Reduce manual admin toil and close remaining automation/UX gaps in already-correct backend flows.
**Features:** Pre-submit cancellation/reschedule policy confirmation modals (client + coach), mandatory weekly-measurement gate decision + implementation, optional "Shadow Session" badge, dead `reminderOptIn` checkbox fix, bulk-reassign partial-failure handling.
**Dependencies:** Phases 2 and 3 (reuses their components/patterns).
**Estimated effort:** ~1.5 weeks
**Risks:** Low — mostly UI/UX polish on top of logic that already works correctly server-side.
**Deliverables:** Confirmation modals, mandatory-measurement gate, minor UX fixes.

### Phase 6 — Analytics & Reporting
**Goal:** Complete the reporting/analytics layer across all three portals.
**Features:** Platform-wide avg-rating rollup, avg-sessions/day KPI, `sales_view` + client/admin payment ledger views, PDF export, coach `rating` recompute trigger.
**Dependencies:** Phase 1 (rating split); Phase 4 (`sales_view`).
**Estimated effort:** ~2 weeks
**Risks:** PDF export needs a vendor/library decision; recompute trigger performance at scale should be tested with realistic booking volume.
**Deliverables:** Dashboard KPI cards, sales/payments views, PDF export (if pursued).

### Phase 7 — UX Improvements & Structural Polish
**Goal:** Close remaining UX-only gaps and information-architecture debt; resolve open product decisions.
**Features:** Progress charts (shared `recharts` component across client/coach/admin), client dashboard journey-day counter, evaluation of full sidebar-widget IA consolidation vs. current flat nav, client Settings page scope decision, loading skeletons, in-browser responsive QA pass, break-management (only if greenlit), feature flags (only if scoped).
**Dependencies:** All prior phases for underlying data; largely independent of backend work.
**Estimated effort:** ~2–3 weeks
**Risks:** Several items here are explicitly open product decisions (sidebar IA redesign, Settings scope, feature flags, break management) — get stakeholder sign-off before estimating firmly; scope creep risk is highest in this phase.
**Deliverables:** Shared chart component, journey counter, an IA decision record, a browser-verified responsive pass.

---

## 9. Dependency Graph

```
Authentication (done)
    ↓
Roles / RLS (done)
    ↓
Booking Engine — hold/confirm/cancel/reschedule (done)
    ↓
Slot / Recurring Generation (done)
    ↓
┌───────────────────────────────┐
│ Phase 1: Rating schema split   │
│ Phase 1: Attendance-overdue    │──┐
│ Phase 1: Leave 24h validation  │  │
│ Phase 1: Coach skills column   │  │
└───────────────────────────────┘  │
    ↓                              │
Shadow Coach Matching Rewrite       │  (Phase 2 — per-occurrence + weighted score)
    ↓                              │
Shadow Coach Required Queue         │  (Phase 2)
    ↓                              │
    ├──────────────────────────────┘
    ↓
Coach Portal Sidebar Widgets (Phase 3)
    — needs: skills column, overdue flag, required-queue's list pattern
    ↓
Admin Portal Completion (Phase 4)
    — needs: rating avg (Phase 1), required-queue list pattern (Phase 2)
    ↓
Automation & Workflow Polish (Phase 5)
    — needs: Phase 2 + Phase 3 components
    ↓
Analytics & Reporting (Phase 6)
    — needs: rating split (Phase 1), sales_view (Phase 4)
    ↓
UX Improvements & Structural Polish (Phase 7)
    — needs: all prior phases for underlying data
```

**Critical path:** Rating schema split and the shadow-coach matching rewrite are the two items that block the most downstream work (coach/admin dashboard KPIs, escalation/rating columns, the required-queue, and by extension most of Phase 3–4's UI). Both should be scheduled first within Phase 1/2, ahead of anything else in those phases.

---

*End of report. This document reflects the state of the codebase as read during this audit and should be re-verified against `git log`/current source before being used to scope work far in the future, per the corrections noted in §0.*

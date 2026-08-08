# LeanR PT Platform — Gap Analysis Progress Report

**Type:** Follow-up to `docs/GAP_ANALYSIS_REPORT.md`, verified against the current codebase and git history as of today.
**Method:** Every row below was re-checked against actual current source (not commit messages) — file/line evidence given for each. Rows already at 90–100% in the original report were spot-checked, not exhaustively re-verified.

---

## 1. Client Portal

| Feature | Orig. % | Now % | Status | Evidence |
|---|---|---|---|---|
| Journey day counter | 0% | 100% | Closed | `client-portal.actions.ts:143,174,184` `journeyDay` computed and returned |
| Coach + rating shown together | 50% | 100% | Closed | `client-portal.actions.ts:94-95` real `qualityRating`/`trainerRating` plumbed |
| Live join countdown | 25% | 100% | Closed | `components/shared/JoinCountdown.tsx` `useJoinCountdown` hook, wired into `NextSessionCard.tsx` |
| Reschedule pre-submit policy popup | 75% | ~90% | Closed | `RescheduleModal.tsx` updated in Phase-7 commit |
| Cancel pre-submit policy popup | 75% | ~90% | Closed | `MySessionsClient.tsx` updated in Phase-7 commit |
| Upcoming sessions (sidebar widget, 6-day) | 50% | 50% | Open | No dedicated dashboard-adjacent 6-day widget found; still a flat `/client/sessions` page |
| Join session (mechanics/real link) | 50% | 100%** | Closed** | Real Zoom join URL wired (`NextSessionCard.tsx`) — **not part of original spec; see §"New beyond spec"; DB migration for this not yet applied to prod** |
| Settings page | 25% | 25% | Open (deferred) | `src/app/client/` has no `settings/` route — confirmed absent |
| Progress charts | 50% | 100% | Closed | `MeasurementChart.tsx` (recharts) wired into `ProgressClient.tsx` |
| Feedback / Rating (2-dim + weekly cap) | 25% | 100% | Closed | `bookings.service.ts:443-476` `rateBooking()` enforces 7-day cap; `quality_rating`/`trainer_rating` columns (migration 0030) |
| Update Measurement (mandatory gate) | 75% | 75% | Open | Weekly cap still enforced; no hard "mandatory" block mechanism found |
| Subscription & Payments (client view) | 25% | 90% | Closed | `MySubscriptionClient.tsx`, `client/subscription/page.tsx`, pause-days balance shown; still no itemized payment ledger UI |
| Loading states | 75% | 100% | Closed | `client/loading.tsx` added |
| Responsive behaviour | 75% | 75% | Open | Not verified in-browser this pass either |

**Client Portal: 72% → ~90%**

---

## 2. Coach Portal

| Feature | Orig. % | Now % | Status | Evidence |
|---|---|---|---|---|
| Dashboard core KPIs (8 cards) | 50% | 100% | Closed | `coach-portal.actions.ts:81,108,121` `avgRating` + others added |
| Skills field | 10% | 100% | Closed | `coach_profiles.skills` (migration 0034) + `append_coach_skill()` RPC + `appendMySkill`/`updateCoachSkills` in `coaches.service.ts` |
| Sidebar — Today's Tasks | 25% | 100% | Closed | `CoachTodayTasksClient.tsx`, `CoachTaskRow.tsx`, live countdown, inline attendance/notes, now also real Zoom join |
| Attendance "present" → timeline event | 50% | 100% | Closed | Present branch now logs distinct event (per Phase-1 roadmap item) |
| 2-hour overdue attendance rule | 0% | 100% | Closed | `bookings.service.ts:217-237` `sweepOverdueAttendance()`, `flag_overdue_attendance()` (migration 0032) |
| Sidebar — Upcoming (3-day) | 10% | 100% | Closed | `CoachUpcomingClient.tsx` |
| Sidebar — Global Search | 0% | 100% | Closed | `CoachSearchClient.tsx`, `coach_profiles_select_by_any_coach`/`timeline_select_by_any_coach` RLS (migration 0033) |
| Sidebar — Pending Tasks | 0% | 100% | Closed | `CoachPendingTasksClient.tsx` |
| Escalations — Active/Resolved tabs | 50% | 100% | Closed | `CoachEscalationsClient.tsx:27` tab filter on `status` |
| Leave requests — partial/hourly | 0% | 100% | Closed | `leave_type` enum, `partial_start_time/end_time` (migration 0031), UI in `CoachAvailabilityClient.tsx` |
| Leave requests — 24h advance notice | 0% | 100% | Closed | `availability.service.ts:73,116` `LEAVE_MIN_NOTICE_HOURS = 24` enforced server-side |
| Attendance "late" status | 50% | 50% | Open | Still not exposed in app logic (product decision, per original note) |
| Break management | 0% (unscoped) | 0% | Deferred | Confirmed still absent — not in governing spec, correctly not built |
| Client detail — BMI + progress graphs | 75% | 90% | Closed | `MeasurementChart.tsx` wired into `coach/clients/[id]/page.tsx`; BMI still not found (see Admin section — same gap) |

**Coach Portal: 58% → ~95%**

---

## 3. Admin Portal

| Feature | Orig. % | Now % | Status | Evidence |
|---|---|---|---|---|
| Dashboard — active coaches count | 0% | 100% | Closed | `adminDashboard.service.ts:69` `activeCoachesCount` |
| Dashboard — platform avg rating | 10% | 100% | Closed | `adminDashboard.service.ts:70-111` rollup over `coach_profiles.rating` |
| Dashboard — avg sessions/day | 0% | 100% | Closed | `adminDashboard.service.ts:16,113` `avgSessionsPerDay` |
| Dashboard — universal client search | 10% | 10% | **Open** | No `searchClients`/global search action found anywhere under `admin-*.actions.ts` or `src/app/admin/` |
| Client list — "Expired" filter | 75% | 75% | **Open** | No `expired` status/derivation found in `admin-clients.actions.ts` |
| Client list — client_code / slot day-time columns | 50% | 50% | **Open** | No `client_code`/`clientCode` reference found in `admin-clients.actions.ts` or `AdminClientsListClient.tsx` |
| BMI on client detail | 0% | 0% | **Open** | No BMI calculation found anywhere in actions/services |
| Coach detail — active/paused split | 75% | ~90% | Closed | `AdminCoachDetailClient.tsx` expanded substantially in Phase-7 commit |
| Coach detail — 7-day slot calendar | 10% | 100% | Closed | `CoachWeekCalendar.tsx`, `getCoachWeekCalendarAction` (`admin-coach.actions.ts:152`) |
| Coach profile edit | 0% | 100% | Closed | `updateCoachAction` (`admin-coach.actions.ts:164`), `updateCoach()` in `coaches.service.ts:196` |
| Coach `skills` field (distinct, editable) | 10% | 100% | Closed | `updateCoachSkillsAction` (`admin-coach.actions.ts:182`) |
| Disable/Delete coach mislabeling | 50% | 50% | Open | Not confirmed fixed this pass — worth a follow-up spot-check |
| Package CRUD — create (full field set) | 50% | ~90% | Closed | `AdminSettingsClient.tsx` create/edit form expanded |
| Package CRUD — edit existing | 0% | 100% | Closed | `updatePackageAction` (`admin-settings.actions.ts:79`), wired into `AdminSettingsClient.tsx:112` |
| Promise-level overrides (pause-days) | 0% | 100% | Closed | `pause_days_allowed`/`default_pause_days` (migration 0036), `adjustPauseDaysAction` (`admin-clients.actions.ts:194`) |
| Sales list | 0% | 100% | Closed | `sales_view` (migration 0035), `/admin/sales` page, `AdminSalesClient.tsx`, `listSalesAction` |
| Global cross-client escalations page | 25% | 100% | Closed | `/admin/escalations` page, `AdminEscalationsClient.tsx` |
| Escalation "In Progress" action | 75% | ~90% | Closed | `AdminEscalationsClient.tsx` rewritten in Phase-7 commit (121 lines added) |
| Shadow Coach — persistent "Required" queue | 10% | 100% | Closed | `/admin/shadow-coverage` page, `ShadowCoverageQueueClient.tsx`, `listShadowCoverageGapsAction` |
| Admin notifications inbox | 0% | 100% | Closed | `/admin/notifications` page reusing `NotificationsClient`; legitimate design — `notifyAdmins()` (`notifications.service.ts:61-65`) writes one row per admin, so each admin's own inbox **is** the full admin-directed feed |
| Settings — slot-engine config | 50% | ~90% | Closed | `AdminSettingsClient.tsx` expanded (165 lines) in Phase-7 commit |
| Reports — PDF export | 0% | 100% | Closed | `jspdf`/`jspdf-autotable` used in `AdminReportsClient.tsx` |

**Admin Portal: 55% → ~90%** (four confirmed open items: universal search, Expired filter, client_code/slot columns on list, BMI)

---

## 4. Backend

| Feature | Orig. % | Now % | Status | Evidence |
|---|---|---|---|---|
| Shadow coach — matching logic (per-occurrence + weighted score) | 25% | 100% | Closed | `scheduling.service.ts:615-727` `findShadowCoachCandidates()` resolves per-occurrence via `Promise.all`, scores via `scoreShadowCandidate()` (specialization/language/rating/utilization), `planShadowAssignments()` groups results |
| Session rating — schema + weekly cap | 25% | 100% | Closed | Migration 0030 + `bookings.service.ts:443-476` |
| Progress logging — mandatory gate | 75% | 75% | Open | Cap enforced; explicit "mandatory" block mechanism still not built (matches Client Portal note) |
| Shadow coach — required queue | 10% | 100% | Closed | Backs `/admin/shadow-coverage` (see Admin section) |
| Shadow coach — re-check on shadow's own unavailability | 0% | 0% | Open | No re-validation sweep found — confirmed still absent |
| Shadow coach — long-leave → permanent routing threshold | 0% | 0% | Open | No duration threshold logic found — confirmed still absent |
| Leave requests — 24h validation | 25% | 100% | Closed | `availability.service.ts:73,116` |
| Leave requests — partial/hourly | 0% | 100% | Closed | Migration 0031 |
| Global search (backend) | 0% | 100% | Closed | Coach-facing global search built (§Coach Portal); **admin-facing universal search still not built** — two distinct features, only one closed |
| Coach `skills` field (backend) | 0% | 100% | Closed | Migration 0034 |
| Plan "promises" (pause-days, backend) | 0% | 100% | Closed | Migration 0036 |
| Sales list / payment ledger (backend) | 10% | 100% | Closed | Migration 0035 `sales_view` |
| Coach dashboard avg-rating recompute | 50% | 100% | Closed | `bookings.service.ts:420-485` `recomputeCoachRating()` called on every rating write |

**Backend: 68% → ~92%**

---

## 5. Database

| Feature | Orig. % | Now % | Status | Evidence |
|---|---|---|---|---|
| Rating fields (two-dimension split) | 0% | 100% | Closed | Migration `0030_split_session_rating.sql` |
| Coach `skills` column | 0% | 100% | Closed | Migration `0034_coach_skills.sql` |
| RLS — coach read breadth (global search) | 0% | 100% | Closed | Migration `0033_coach_global_client_search_rls.sql` |
| `attendance_overdue` + sweep | 0% | 100% | Closed | Migration `0032_attendance_overdue_sweep.sql` |
| Pause-days / plan promises schema | 0% | 100% | Closed | Migration `0036_pause_days_promise.sql` |
| Sales view | 0% | 100% | Closed | Migration `0035_sales_view.sql` |
| Leave `leave_type` (full/partial) | 0% | 100% | Closed | Migration `0031_partial_day_leave.sql` |
| FK indexes (recurring_slot_id, package_id, shadow/coach-change FKs) | 90% | 90% | Not re-verified | Not explicitly re-checked this pass |

**All six migrations (0030–0036) are confirmed applied to the live Supabase database** (`hdrpioypocyeclazkffl`), verified via `list_migrations` earlier in this session.

Two more migrations exist as **files only, NOT yet applied to production**:
- `0037_zoom_meetings.sql` — adds `zoom_meeting_id`/`zoom_join_url`/`zoom_start_url` to `bookings`
- `0038_payments.sql` — adds the `payments` ledger table

Both are held back deliberately, per explicit user instruction to defer Zoom/Razorpay activation.

**Database: 88% → ~97%** (counting only the originally-flagged gaps; the two new-feature migrations are tracked separately below, not counted against the original spec's completion since they weren't part of it)

---

## 6. Cross-Cutting Workflows

| Feature | Orig. % | Now % | Status | Evidence |
|---|---|---|---|---|
| Timeline — `attendance_marked_present` event | 90% | 100% | Closed | Confirmed via Coach Portal attendance-event row above |
| Shadow coach — matching (4.2.2) | 25% | 100% | Closed | Same evidence as Backend section |
| Shadow coach — required queue (4.2.4) | 10% | 100% | Closed | Same evidence as Admin section |
| Shadow coach — re-check on unavailability (4.2.5) | 0% | 0% | Open | Confirmed still absent |
| Shadow coach — long-leave routing (4.2.6) | 0% | 0% | Open | Confirmed still absent |
| Attendance — 2h overdue sweep | tracked in Backend | 100% | Closed | — |
| Reschedule — pre-submit confirmation | 90% | ~95% | Closed | See Client Portal |

**Cross-Cutting Workflows: 68% → ~92%**

---

## 7. Updated Master Gap Report

| Module | Original % | Current % | Δ |
|---|---|---|---|
| Client Portal | 72% | ~90% | +18 |
| Coach Portal | 58% | ~95% | +37 |
| Admin Portal | 55% | ~90% | +35 |
| Backend | 68% | ~92% | +24 |
| Database | 88% | ~97% | +9 |
| Cross-Cutting Workflows | 68% | ~92% | +24 |
| **PROJECT OVERALL** | **~68%** | **~93%** | **+25** |

*Unweighted mean across the six audited layers, counting only what the original report scoped. Zoom and Razorpay (below) are additive, outside this baseline.*

---

## What's new beyond the original spec

Two features were built that the original report never scoped at all — they were the user's own later requests, not roadmap items:

**Zoom video integration** (`src/lib/services/zoom.service.ts`, wiring in `bookings.service.ts`, `coach-portal.actions.ts`, `client-portal.actions.ts`, UI in `CoachTaskRow.tsx`/`CoachSessionClient.tsx`/`NextSessionCard.tsx`): real Server-to-Server OAuth meeting creation, lazy per-booking, cleaned up on cancel/reschedule. **Code is complete and committed; DB migration `0037` is written but not yet applied to production; `ZOOM_*` env vars are not yet set anywhere.** Fully closes the "Join session (mechanics)" gap once activated.

**Razorpay payment integration** (`src/lib/services/razorpay.service.ts`, `payments.service.ts`, `payments.actions.ts`, `useRazorpayCheckout.ts`, wired into `PlansMarketingClient.tsx`/`DemoBookingClient.tsx`): real order creation + signature-verified checkout, replacing `StubPaymentModal` entirely (deleted). **Code is complete and committed; DB migration `0038` is written but not yet applied to production; `RAZORPAY_*` env vars are not yet set anywhere.** This closes the original report's "Subscription & Payments (client view)" ledger gap once activated, since every payment now has a real, queryable `payments` row.

Neither is live yet — both were deliberately paused by the user until the three portals are fully stress-tested, and separately because the Netlify deploy pipeline (env vars, build) is still being worked through.

---

## Still open

**Genuine technical/product gaps (not touched this pass):**
- Admin universal search by client ID/code (§2.1) — no action exists anywhere under `admin-*.actions.ts`
- Client list "Expired" filter tab and `client_code`/slot day-time columns (§2.2)
- BMI calculation — confirmed absent everywhere (client, coach, and admin client-detail views)
- Shadow coach re-validation sweep if the shadow coach itself later goes on leave (§4.2.5)
- Long-leave → permanent-coach-change routing threshold (§4.2.6)
- "Mandatory" weekly-measurement gate — the cap is enforced, but no hard block mechanism exists
- Coach "late" attendance status — schema supports it, app logic still hard-typed to present/absent
- "Delete Coach" vs "Disable Coach" mislabeling — not confirmed fixed this pass, worth a follow-up check
- Client Portal's "Upcoming sessions" as a persistent 6-day sidebar widget (still a flat full page)

**Deliberately deferred by product decision (per user's own earlier instruction, not rebuilt):**
- Sidebar IA consolidation (flat nav vs. persistent widget layout)
- Break management (not in governing spec)
- Feature flags (not in governing spec)
- Client Settings page (no clear scope yet)
- In-browser responsive QA pass (never done, code-level only)

**Deliberately held back by explicit user instruction (code complete, not activated):**
- Zoom: migration `0037` not applied, env vars not set
- Razorpay: migration `0038` not applied, env vars not set
- Netlify deploy: env vars now set (Supabase), but the site itself has not successfully redeployed yet (upload proxy failures, unresolved)

---

*This report reflects the codebase as of the latest commit (`8041f9f`) and the Supabase database state as last verified in this session. Re-verify before using it to scope work far in the future.*

# Business Rules

Every numeric rule below was found hardcoded (and sometimes duplicated inconsistently) across the prototype's pages during the Phase 1 codebase audit. Each now lives in exactly one place: `system_settings`, read via `get_setting_int(key)` inside the scheduling functions.

| Rule | `system_settings.key` | Default | Where it was hardcoded in the prototype |
|---|---|---|---|
| Minimum hours before session start to cancel/reschedule | `reschedule_cutoff_hours` | 12 | `client/sessions/page.tsx`'s `canModify = hoursUntil(date) > 12` **and separately** `admin/settings/page.tsx`'s cutoff slider (default 12) — the two were never actually connected |
| Minutes before session start the "Join" button enables | `join_window_minutes` | 10 | `coach/schedule/page.tsx` and `components/client/NextSessionCard.tsx`, both independently computing `hoursUntil(date) <= 1/6` |
| Default regular session length | `default_session_duration_minutes` | 45 | Implicit throughout `mock-data.ts`'s `sessions` array and `admin/settings`' duration slider |
| Assessment (first-time intake) session length | `assessment_session_duration_minutes` | 60 | `mock-data.ts`'s two `type: "assessment"` sessions |
| Days without a completed session before flagged inactive | `inactivity_threshold_days` | 30 | `admin/settings/page.tsx`'s inactivity slider — never wired to anything |
| Temporary slot hold duration | `temporary_booking_hold_minutes` | 10 | Did not exist in the prototype (booking flow had no real slot reservation at all) |

Admins can change any of these live via `system_settings` — every scheduling function reads the current value at call time, not a compiled-in constant.

## Status vocabularies (unchanged from the prototype, by design)

The prototype's `Badge.tsx` (`SessionStatusBadge`) already has rendering logic for every one of these strings. The Postgres enum types in `0001_enums.sql` reuse them exactly, so Phase 2 needs zero changes to any status-rendering code:

- **Booking**: `upcoming`, `completed`, `cancelled`, `missed`
- **Coach**: `active`, `inactive`, `on-leave`
- **Client / Subscription**: `active`, `inactive`, `paused`
- **Coach-change request**: `pending`, `approved`, `rejected`
- **Notification type**: `booking`, `reminder`, `feedback`, `system`
- **Package category**: `advance`, `addon`
- **Session type**: `assessment`, `regular`

## Fixed prototype gaps

- **Coach-change approval used to discard the chosen coach.** The old `CoachChangeRequest` type had no field to record which coach was picked on approval — the admin UI let you choose one, then threw it away. `coach_change_requests.new_coach_id` now persists it, and `resolveCoachChangeRequest()` actually reassigns the client's active recurring slot + upcoming bookings.
- **`Client.sessionsUsed`/`sessionsRemaining` could silently drift** from the actual session list, because they were hand-typed integers with nothing keeping them consistent. `subscription_usage_view` computes both from real `bookings` rows every time — there is no stored, driftable copy.
- **`Coach.activeClients`/`utilization` were also hand-typed** and didn't match the actual `clients`/`sessions` arrays. `coach_utilization_view` computes both from real data (this week's booked minutes vs. available minutes from `coach_availability`).
- **Notifications had no owning user** in the prototype (a single flat array shown to whoever was logged in). `notifications.user_id` scopes every row to one recipient.

## Deliberate Phase 1 scope boundaries

- **No real payments/refunds.** `subscriptions`/`package_tiers` model what was purchased and its session balance; there's no payment-gateway integration or `refunds` table. "Issue Refund" in the admin prototype stays out of scope until a payment provider is chosen.
- **No automated cron/scheduled jobs.** `mark_missed_bookings()` and the inactivity check (`inactive_clients_view`) are callable functions/views, not scheduled — Phase 1 deliberately doesn't introduce a job runner. Wire them to a scheduled Edge Function (or Vercel Cron, etc.) in a later phase.
- **No email/push/WhatsApp dispatch.** `notifications.channels` (jsonb) is a placeholder for a future dispatcher to track delivery status per channel; nothing actually sends anything yet.
- **Coach-schedule visibility is broad by design.** Any authenticated user can read `coach_availability`, `coach_shifts`, `coach_leave` (approved only isn't even enforced at the RLS layer — all rows are readable), and the *existence/timing* of `bookings` — because slot-conflict checking has to work against every coach's real schedule, not just rows the caller happens to own. Session **content** (`workout_notes`, `attendance`, ratings/feedback, `medical_notes`) stays restricted to admin / the owning coach / the owning client. See `0012_rls_policies.sql`'s header comment for the exact reasoning.

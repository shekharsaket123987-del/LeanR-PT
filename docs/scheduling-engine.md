# Scheduling Engine

All of this lives in `supabase/migrations/0011_scheduling_functions.sql` as Postgres functions, called from `src/lib/services/scheduling.service.ts` and `bookings.service.ts` via `.rpc(...)`. The design goal: **the hard guarantee lives in the database**, not application code, so it holds even against a bug in a future caller.

## The hard guarantee

`bookings` has a partial exclusion constraint:

```sql
constraint bookings_no_coach_overlap exclude using gist (
  coach_id with =,
  tstzrange(scheduled_start, scheduled_start + (duration_minutes || ' minutes')::interval) with &&
) where (status = 'upcoming')
```

A coach can never have two overlapping `status='upcoming'` bookings — Postgres itself rejects the insert/update, not just application logic. This is the **Capacity Validation** requirement satisfied at the strongest possible layer.

## Functions, in the order a booking flows through them

1. **`is_slot_within_working_hours(coach_id, slot_start, duration_minutes)`** — checks `coach_shifts` for that date first (an explicit override always wins), falls back to the `coach_availability` weekly template if no shift row exists for the date, and rejects if the coach has approved `coach_leave` covering that date.

2. **`has_scheduling_conflict(coach_id, slot_start, duration_minutes, ...)`** — checks for overlap against both `bookings` (status upcoming) and `temporary_bookings` (status held, not expired). This is the **Conflict Detection** rule — it's what stands between two clients racing for the same opening, since the DB exclusion constraint alone doesn't know about *holds*.

3. **`create_temporary_booking(...)`** — **Temporary Booking**. Validates working hours + conflicts, then inserts a `temporary_bookings` row with `expires_at = now() + system_settings.temporary_booking_hold_minutes` (default 10 min) and `status='held'`. This reserves the slot while the client finishes checkout without letting anyone else grab it.

4. **`confirm_booking(temp_booking_id, ...)`** — promotes a still-valid hold into a real `bookings` row (re-checks the conflict as defense-in-depth, since time has passed since step 3), then marks the hold `confirmed`.

5. **`expire_temporary_bookings()`** — flips stale `held` rows past their `expires_at` to `expired`, freeing the slot. This is **Released Slot Management** for the hold step — called automatically at the top of `has_scheduling_conflict()`, so it's always fresh before any availability check.

## Ongoing patterns

- **`generate_bookings_from_recurring_slot(recurring_slot_id, count)`** — materializes the next N occurrences of a client's weekly pattern (`recurring_slots`) into real `bookings` rows, skipping any date blocked by approved `coach_leave` or an existing conflict. This is what actually backs the booking wizard's "Mon/Wed/Fri 6:30 PM" pattern picker — in the prototype that picker was cosmetic with no real slots behind it.

- **`cancel_booking(booking_id, cancelled_by, reason, enforce_cutoff)`** — enforces `system_settings.reschedule_cutoff_hours` (default 12h) unless the caller is an admin, sets `status='cancelled'`, and — if the booking came from a `recurring_slot_id` — calls `generate_bookings_from_recurring_slot(..., 1)` to backfill the next occurrence. This is **Slot Recovery**: cancelling one occurrence of an ongoing pattern doesn't kill the pattern.

- **`reschedule_booking(booking_id, new_start, new_duration, enforce_cutoff)`** — moves the *same* booking row to a new time (re-validating working hours + conflicts), rather than cancel-and-recreate, so `workout_notes`/`attendance` foreign keys stay valid and it deliberately does **not** trigger recurring-slot regeneration.

## Coach continuity

- **`assign_shadow_coach(client_id, primary_coach_id, shadow_coach_id, starts_on, ends_on, reason)`** — records a `shadow_coach_assignments` row and reassigns the client's `upcoming` bookings with the primary coach, within that date range, to the shadow coach. If the shadow coach already has a conflicting booking, the exclusion constraint rejects the reassignment — the caller (an admin, via the service layer) sees that failure and needs to pick a different shadow coach or time.

## Inactivity

- **`inactive_clients_view`** (0010) flags any client whose most recent `completed` booking is older than `system_settings.inactivity_threshold_days` (default 30), or who has none at all. Phase 1 exposes this as a queryable view rather than an automated cron job — a future Phase can poll it and call `notifications.service.ts`'s `createFromTemplate('inactivity_warning', ...)`.

## Maintenance

- **`mark_missed_bookings()`** — flips any `upcoming` booking whose scheduled window has fully elapsed to `missed`. Nothing else in the system does this automatically (the prototype never transitions status without a UI click); call this periodically (e.g. from a scheduled Edge Function in a later phase, or on-demand from an admin action) to keep booking status accurate.

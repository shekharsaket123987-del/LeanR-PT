# Booking Flow Sequence Diagrams

## New booking (hold → confirm)

```mermaid
sequenceDiagram
    participant UI as Client Portal (browser)
    participant SA as Server Action
    participant SVC as bookings/scheduling.service.ts
    participant DB as Postgres (RLS as caller)

    UI->>UI: supabase.auth.getSession() -> accessToken
    UI->>SA: createBookingAction(accessToken, {coachId, slotStart, durationMinutes, subscriptionId})
    SA->>SVC: createBooking(accessToken, input)
    SVC->>SVC: holdSlot() -> getRequestClient(accessToken).rpc("create_temporary_booking")
    SVC->>DB: is_slot_within_working_hours() + has_scheduling_conflict()
    DB-->>SVC: ok
    DB->>DB: insert temporary_bookings (status='held', expires_at=+10min)
    SVC->>SVC: confirmHold() -> rpc("confirm_booking")
    DB->>DB: re-check conflict, insert bookings (status='upcoming')
    DB->>DB: exclusion constraint double-checks no overlap
    DB->>DB: update temporary_bookings.status='confirmed'
    DB-->>SVC: new booking id
    SVC-->>SA: booking id
    SA-->>UI: booking id
    Note over DB: fn_audit_trigger() fires on the bookings INSERT automatically
```

## Cancellation with slot recovery

```mermaid
sequenceDiagram
    participant UI as Client Portal
    participant SVC as bookings.service.ts
    participant DB as Postgres

    UI->>SVC: cancelBooking(accessToken, bookingId, reason)
    SVC->>DB: rpc("cancel_booking", {p_booking_id, p_cancelled_by, p_reason, p_enforce_cutoff})
    DB->>DB: check status='upcoming' and hours-until-start >= reschedule_cutoff_hours
    alt within cutoff and caller is not admin
        DB-->>SVC: exception "Too close to the session start to cancel"
    else ok
        DB->>DB: update bookings set status='cancelled'
        alt booking.recurring_slot_id is not null
            DB->>DB: generate_bookings_from_recurring_slot(recurring_slot_id, 1)
            Note over DB: next occurrence materialized -> pattern continues
        end
        DB-->>SVC: ok
    end
```

## Reschedule (same booking row, in place)

```mermaid
sequenceDiagram
    participant UI as Client or Admin Portal
    participant SVC as bookings.service.ts
    participant DB as Postgres

    UI->>SVC: rescheduleBooking(accessToken, bookingId, newStart, newDuration?)
    SVC->>DB: rpc("reschedule_booking", {...})
    DB->>DB: check status='upcoming' + cutoff (unless admin)
    DB->>DB: is_slot_within_working_hours(new time) + has_scheduling_conflict(new time)
    alt conflict or outside working hours
        DB-->>SVC: exception
    else ok
        DB->>DB: update bookings set scheduled_start=new, duration_minutes=new
        Note over DB: same id -> workout_notes/attendance FKs stay valid; no recurring regeneration
    end
```

## Coach-change request with shadow-coach fallback

```mermaid
sequenceDiagram
    participant Client
    participant Admin
    participant SVC as coachChange.service.ts
    participant DB as Postgres

    Client->>SVC: requestCoachChange(accessToken, reason)
    SVC->>DB: derive current_coach_id from active recurring_slot or latest booking
    SVC->>DB: insert coach_change_requests (status='pending')

    Admin->>SVC: resolveCoachChangeRequest(accessToken, requestId, {approve:true, newCoachId})
    SVC->>DB: update coach_change_requests (status='approved', new_coach_id, resolved_by, resolved_at)
    SVC->>DB: update recurring_slots.coach_id -> newCoachId (active slots for this client)
    SVC->>DB: update bookings.coach_id -> newCoachId (upcoming bookings with old coach)
    Note over DB: exclusion constraint rejects any reassignment that would double-book the new coach

    Note over Admin,DB: Separately, if a coach is on leave rather than permanently changed:
    Admin->>SVC: assignShadowCoach({clientId, primaryCoachId, shadowCoachId, startsOn, endsOn})
    SVC->>DB: rpc("assign_shadow_coach")
    DB->>DB: insert shadow_coach_assignments (status='active')
    DB->>DB: update bookings.coach_id -> shadowCoachId (upcoming, within date range)
```

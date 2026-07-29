# Service Layer API Reference

Every function's first parameter is `accessToken: string` (the caller's Supabase session access token) unless noted as a **system** function. "Authorization" describes what happens if the caller doesn't qualify: **RLS** means the query silently returns nothing / affects zero rows; **requireRole** means it throws `Error("Forbidden: ...")` before any query runs.

## `profiles.service.ts`
| Function | Params | Returns | Authorization |
|---|---|---|---|
| `getMyProfile` | — | own `profiles` row | RLS (own row only) |
| `updateMyProfile` | `patch: {full_name?, phone?, photo_url?}` | updated row | RLS (own row only) |

## `coaches.service.ts`
| Function | Params | Returns | Authorization |
|---|---|---|---|
| `listCoaches` | — | all coaches + profile + `coach_utilization_view` merged | RLS (readable by any authenticated user) |
| `getCoach` | `coachId` | one coach, same shape | same |
| `updateMyCoachProfile` | `patch: {specialization?, ...}` | updated row | requireRole `coach`; RLS restricts to own row |

## `clients.service.ts`
| Function | Params | Returns | Authorization |
|---|---|---|---|
| `listClients` | — | clients visible to caller (all for admin, linked-only for coach via RLS) | requireRole `admin,coach` |
| `getClient` | `clientId` | one client | RLS (own row, linked coach, or admin) |
| `updateMyClientProfile` | `patch: {medical_notes?, equipment?, goals?}` | updated row | requireRole `client`; RLS restricts to own row |

## `packages.service.ts`
| Function | Params | Returns | Authorization |
|---|---|---|---|
| `listPackages` | — | active packages (all for admin) | RLS |
| `createPackage` | `PackageInput` | new row | requireRole `admin` |
| `updatePackage` | `id, patch` | updated row | requireRole `admin` |

## `subscriptions.service.ts`
| Function | Params | Returns | Authorization |
|---|---|---|---|
| `getSubscriptionsForClient` | `clientId` | subscriptions + package + usage (from `subscription_usage_view`) | RLS (own, linked coach, or admin) |
| `purchaseSubscription` | `clientId, packageId` | new subscription | requireRole `admin` |
| `pauseSubscription` | `subscriptionId` | updated row | requireRole `admin` |
| `resumeSubscription` | `subscriptionId` | updated row | requireRole `admin` |

## `availability.service.ts`
| Function | Params | Returns | Authorization |
|---|---|---|---|
| `getCoachAvailability` | `coachId` | weekly template rows | RLS (any authenticated) |
| `setMyAvailability` | `windows: AvailabilityWindow[]` | replaces the caller's whole week | requireRole `coach` |
| `requestLeave` | `{starts_on, ends_on, reason?}` | new `coach_leave` row, `status='pending'` | requireRole `coach` |
| `listPendingLeave` | — | pending leave requests | requireRole `admin` |
| `resolveLeave` | `leaveId, status` | updated row | requireRole `admin` |

## `scheduling.service.ts`
| Function | Params | Returns | Authorization |
|---|---|---|---|
| `getOpenSlots` | `coachId, fromDate, toDate, durationMinutes` | `{start, end}[]` — advisory, UI-facing | RLS (reads availability/leave/bookings, all broadly readable) |
| `holdSlot` | `{clientId, coachId, slotStart, durationMinutes}` | temporary_booking id | calls `create_temporary_booking()`; RLS on the underlying insert requires `client_id = caller's own client id` |
| `confirmHold` | `{tempBookingId, subscriptionId?, recurringSlotId?, assessmentSessionId?, sessionType?}` | new booking id | calls `confirm_booking()`; RLS requires the booking's `client_id` to match caller |

## `bookings.service.ts`
| Function | Params | Returns | Authorization |
|---|---|---|---|
| `listMyBookingsAsClient` | `status?` | bookings + client/coach profile | requireRole `client` |
| `listMyBookingsAsCoach` | `status?` | same, filtered to caller's coach id | requireRole `coach` |
| `getBooking` | `bookingId` | one booking | RLS (broadly readable — see [business-rules.md](./business-rules.md)) |
| `createBooking` | `{clientId, coachId, slotStart, durationMinutes, subscriptionId?, recurringSlotId?, sessionType?}` | new booking id | holdSlot + confirmHold in sequence |
| `cancelBooking` | `bookingId, reason?` | — | calls `cancel_booking()`; cutoff enforced unless caller is admin |
| `rescheduleBooking` | `bookingId, newStart, newDurationMinutes?` | — | calls `reschedule_booking()`; cutoff enforced unless caller is admin |
| `rateBooking` | `bookingId, rating, feedback?` | updated row | requireRole `client`; only on `status='completed'` |
| `completeBooking` | `bookingId, {notes?, homework?}` | booking row | requireRole `coach`; only on `status='upcoming'`; also writes `workout_notes` + `attendance` |
| `createAssessmentBooking` **(system, no accessToken)** | `{prospectName, prospectEmail?, prospectPhone?, assignedCoachId, scheduledStart}` | new `assessment_sessions` row | uses admin client — public entry point, prospect has no account |

## `coachChange.service.ts`
| Function | Params | Returns | Authorization |
|---|---|---|---|
| `requestCoachChange` | `reason` | new request, `status='pending'` | requireRole `client`; current coach auto-derived from active recurring slot or latest booking |
| `listCoachChangeRequests` | `status?` | requests + client/coach names | requireRole `admin` |
| `resolveCoachChangeRequest` | `requestId, {approve, newCoachId?}` | updated request | requireRole `admin`; on approve, also reassigns the client's active recurring slot + upcoming bookings |
| `assignShadowCoach` | `{clientId, primaryCoachId, shadowCoachId, startsOn, endsOn, reason?}` | assignment id | requireRole `admin`; calls `assign_shadow_coach()` |

## `notifications.service.ts`
| Function | Params | Returns | Authorization |
|---|---|---|---|
| `listMyNotifications` | — | own notifications, newest first | RLS |
| `markNotificationRead` | `notificationId` | updated row | RLS (own row only) |
| `createFromTemplate` **(system)** | `templateKey, userId, vars?` | new notification | uses admin client — called internally after booking/coach-change events, not exposed to portals |

## `audit.service.ts`
| Function | Params | Returns | Authorization |
|---|---|---|---|
| `listAuditLogs` | `{entityType?, entityId?}` | last 200 matching rows | requireRole `admin` |
| `writeAuditLog` **(system)** | `actorId, action, entityType, entityId, meta?` | — | uses admin client — for actions not captured by the automatic DB trigger |

## Database functions called via `.rpc(...)`
(defined in `0011_scheduling_functions.sql`, documented in full in [scheduling-engine.md](./scheduling-engine.md))

`create_temporary_booking`, `confirm_booking`, `cancel_booking`, `reschedule_booking`, `generate_bookings_from_recurring_slot`, `assign_shadow_coach`, `mark_missed_bookings`.

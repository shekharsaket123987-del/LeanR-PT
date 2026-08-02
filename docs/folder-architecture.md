# Folder Architecture — Phase 1 Additions

Everything below is new; no existing file was modified except `package.json`/`package-lock.json` (new dependencies) and `.env.local` (new keys). See [../src/lib/supabase/README](#) — actually see the inline comments in each file below for the "why".

```
leanr-app/
├── supabase/
│   └── migrations/                  # Run in order via Supabase Dashboard -> SQL Editor
│       ├── 0001_enums.sql           # Enum types (reuse the UI's existing status strings)
│       ├── 0002_profiles.sql        # profiles, coach_profiles, client_profiles + auto-provision trigger
│       ├── 0003_packages_subscriptions.sql
│       ├── 0004_coach_scheduling.sql
│       ├── 0005_bookings_and_slots.sql
│       ├── 0006_continuity.sql
│       ├── 0007_coaching_content.sql
│       ├── 0008_notifications.sql
│       ├── 0009_audit_and_settings.sql
│       ├── 0010_views.sql           # Real equivalents of mock-data.ts's derived numbers
│       ├── 0011_scheduling_functions.sql  # The scheduling engine (Postgres functions)
│       ├── 0012_rls_policies.sql    # Row Level Security for every table
│       ├── 0013_storage_buckets.sql
│       └── 0014_seed_data.sql       # Dev-only
│
├── src/lib/
│   ├── supabase.ts                  # UNCHANGED — existing browser client (LoginForm, PortalShell logout)
│   ├── supabase/
│   │   ├── request-client.ts        # Request-scoped client for Server Actions (caller's access token -> RLS as that user)
│   │   └── admin-client.ts          # Service-role client, server-only, bypasses RLS — privileged ops only
│   │
│   └── services/                    # The "service layer" — called from Server Actions, not from the browser
│       ├── _auth.ts                 # getCallerContext() / requireRole() — every other service file starts here
│       ├── profiles.service.ts
│       ├── coaches.service.ts
│       ├── clients.service.ts
│       ├── packages.service.ts
│       ├── subscriptions.service.ts # purchase / pause / resume (admin-only)
│       ├── availability.service.ts  # coach_availability / coach_leave
│       ├── scheduling.service.ts    # getOpenSlots, holdSlot, confirmHold — wraps the DB scheduling functions
│       ├── bookings.service.ts      # create/cancel/reschedule/rate/complete a booking
│       ├── coachChange.service.ts   # request/resolve coach-change, shadow coach assignment
│       ├── notifications.service.ts
│       └── audit.service.ts
│
└── docs/                            # This directory
```

## Why two Supabase clients

`request-client.ts` and `admin-client.ts` exist so **no existing auth file needed to change** (see [../.claude/plans](#) Phase 1 plan, "Auth-integration approach"). A Server Action receives the caller's `access_token` (read client-side from the existing browser `supabase` client's session) and builds a request-scoped client with it — Postgres's `auth.uid()` then resolves correctly and every RLS policy in `0012_rls_policies.sql` applies exactly as if the user queried directly. `admin-client.ts` is reserved for the handful of operations that must legitimately bypass RLS (writing audit logs, notifications for a *different* user than the caller, the public assessment-booking entry point where the caller has no account yet).

## Why services aren't called directly from Client Components

Every service function's first argument is `accessToken`, not implicit — that token only exists in a trusted context (a Server Action invocation), not as something a Client Component should be trusted to fabricate for arbitrary user IDs. The intended call shape, once Phase 2 wires this into pages, is:

```ts
"use server";
import { cancelBooking } from "@/lib/services/bookings.service";

export async function cancelBookingAction(accessToken: string, bookingId: string) {
  return cancelBooking(accessToken, bookingId);
}
```

with the Client Component fetching `accessToken` via `supabase.auth.getSession()` right before calling it.

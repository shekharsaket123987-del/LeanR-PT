// Single source of truth for prices that aren't rows in package_tiers --
// shared by the client-facing UI (so the copy never drifts from what's
// actually charged) and demoBooking.service.ts (so what's persisted on the
// booking matches what the UI told the client they were paying).
export const DEMO_SESSION_FEE = 700;

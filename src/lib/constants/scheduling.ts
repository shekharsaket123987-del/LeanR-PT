/** Shared between scheduling.service.ts (server) and ScheduleSetupClient.tsx
 * (client) -- a plain constants module so the client component can import
 * the day-pair options as real values without pulling server-only code
 * (supabaseAdmin etc.) into the browser bundle. */

export const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export const DAY_GROUPS = {
  mwf: [1, 3, 5], // Mon, Wed, Fri
  tts: [2, 4, 6], // Tue, Thu, Sat
  sixday: [1, 2, 3, 4, 5, 6], // Mon–Sat, Sunday always off
} as const;

// Same-trio pairs only -- a 2-day subset of one of the two 3-day rotations,
// not all 21 possible day combinations.
export const PAIRS_MWF: number[][] = [
  [1, 3],
  [1, 5],
  [3, 5],
];
export const PAIRS_TTS: number[][] = [
  [2, 4],
  [2, 6],
  [4, 6],
];

/** All 6 curated "2 days a week" presets, offered to the client as an
 * explicit choice (not just an automatic no-match fallback) when none of
 * the three main patterns work for them. */
export const PAIR_OPTIONS: number[][] = [...PAIRS_MWF, ...PAIRS_TTS];

export const CONCERN_CATEGORIES = [
  { value: "slot_not_available", label: "Slot not available" },
  { value: "coach_missed_session", label: "Coach missed session" },
  { value: "need_schedule_change", label: "Need schedule change" },
  { value: "payment_issue", label: "Payment issue" },
  { value: "technical_issue", label: "Technical issue" },
  { value: "want_coach_change", label: "Want to change coach" },
  // AI RM pre-check (aiBuddySafety.service.ts) always maps pain/injury/
  // medical/self-harm triggers to this category -- see AI_RM_prd.md §11.2.
  { value: "injury_or_health", label: "Injury or health" },
  // A low score (session or coach dimension) on the AI RM's weekly rating
  // ask -- see aiWeeklyRatings.service.ts. A low platform-dimension score
  // uses "technical_issue" instead, since that category already fits it.
  { value: "service_feedback", label: "Low rating / service feedback" },
  { value: "other", label: "Other" },
] as const;

/** Admin's own classification during resolution -- reuses the same taxonomy
 * the client picks from (so there's one shared vocabulary), stored
 * separately from the client's original category so admin correcting/
 * refining it never overwrites what the client actually reported. */
export const ADMIN_ISSUE_TYPES = CONCERN_CATEGORIES;

/** "Who's at fault" -- admin-internal accountability field, never shown to
 * the client or coach (see AdminEscalationDetailClient's doc comment). */
export const FAULT_OPTIONS = [
  { value: "coach", label: "Coach" },
  { value: "client", label: "Client" },
  { value: "platform", label: "Platform / Technical" },
  { value: "third_party", label: "Third-party (Zoom, payments, etc.)" },
  { value: "none", label: "No fault -- miscommunication" },
  { value: "other", label: "Other" },
] as const;

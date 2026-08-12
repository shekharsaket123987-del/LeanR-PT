export const CONCERN_CATEGORIES = [
  { value: "slot_not_available", label: "Slot not available" },
  { value: "coach_missed_session", label: "Coach missed session" },
  { value: "need_schedule_change", label: "Need schedule change" },
  { value: "payment_issue", label: "Payment issue" },
  { value: "technical_issue", label: "Technical issue" },
  { value: "want_coach_change", label: "Want to change coach" },
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

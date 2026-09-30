/** AI RM safety layers 2 and 4 (AI_RM_prd.md §13.1) -- rules-engine checks
 * that run outside the model, so they can't be argued out of by a clever
 * prompt. Layer 2 runs on the client's message BEFORE the model is called at
 * all; layer 4 runs on the model's drafted reply AFTER it comes back, before
 * anything reaches the client. Both are deliberately keyword/regex based
 * (no second model call) -- cheap, fast, and auditable; if the pilot's
 * false-negative rate turns out too high, the natural next step is a small
 * classifier model behind the same two function signatures, not a rewrite
 * of the call sites. */

export type PreCheckCategory = "injury_or_health";

export interface PreCheckResult {
  triggered: boolean;
  category?: PreCheckCategory;
  matchedRule?: string;
}

/** English + Hindi (Devanagari) + Hinglish (romanized) phrasing for each L3
 * trigger family in PRD §11.1/§13.1. Word-boundary-ish matching (no stemming)
 * -- deliberately biased toward over-triggering: PRD requires L3 recall of
 * 100% and treats a false positive here as merely "an unnecessary concern",
 * while a miss is a safety incident (§17.1). */
const L3_TRIGGER_RULES: { rule: string; patterns: RegExp[] }[] = [
  {
    rule: "R-PAIN-INJURY",
    patterns: [
      /\b(pain|hurts?|hurting|injur(?:y|ed|ies))\b/i,
      /\b(sore|strain(?:ed)?|sprain(?:ed)?|pulled a muscle)\b/i,
      /dard|chot lagi|chot laga|खिंचाव|चोट|दर्द/i,
    ],
  },
  {
    rule: "R-CARDIAC-BREATHING",
    patterns: [
      /\b(dizzy|dizziness|light[\s-]?headed|faint(?:ed|ing)?|blacked?\s?out)\b/i,
      /\b(chest pain|can'?t breathe|breathless(?:ness)?|shortness of breath)\b/i,
      /chakkar|behosh|saans nahi|घबराहट|चक्कर|बेहोश|सांस नहीं/i,
    ],
  },
  {
    rule: "R-MEDICAL-MEDICATION",
    patterns: [
      /\b(medication|medicine|prescri(?:be|ption)|dosage|diagnos(?:is|ed))\b/i,
      /\b(pregnan(?:t|cy))\b/i,
      /dawai|dawa|garbhwati|pregnant hoon|दवा|गर्भवती/i,
    ],
  },
  {
    rule: "R-SAFETY-SELFHARM",
    patterns: [
      /\b(suicide|self[\s-]?harm|kill myself|end my life|hurt myself)\b/i,
      /\b(abuse[dsw]?|assault(?:ed)?)\b/i,
      /khud ko nuksan|आत्महत्या|खुद को नुकसान/i,
    ],
  },
];

export function preCheckMessage(message: string): PreCheckResult {
  for (const { rule, patterns } of L3_TRIGGER_RULES) {
    if (patterns.some((p) => p.test(message))) {
      return { triggered: true, category: "injury_or_health", matchedRule: rule };
    }
  }
  return { triggered: false };
}

/** Fixed safe reply for a pre-check hit -- PRD §11.1 L3 behaviour: "No
 * advice. Fixed safe message (stop training, seek medical help where the
 * rule says so)." Never model-generated, so its wording can't drift. */
export const L3_FIXED_REPLY =
  "Please stop training and don't push through this -- if it's urgent, get medical help right away. I've alerted your coach and our team immediately.";

export interface PostCheckResult {
  blocked: boolean;
  reason?: string;
}

const IDENTITY_BREAK_PATTERNS = [/\bi(?:'?m| am)\s+(a\s+)?(human|your coach|your trainer|a doctor|a dietitian)\b/i];

// Prescriptive framing ("you should", "try doing", "add in") combined with a
// fitness-content noun -- catches "try adding 10 minutes of cardio" without
// blocking "Good question for Coach Rahul" style deflections.
const WORKOUT_PRESCRIPTION_PATTERNS = [
  /\b(try (doing|adding)|you should (do|try)|do \d+\s*(sets|reps)|here'?s a (workout|routine|exercise))\b.{0,40}\b(cardio|reps|sets|squats?|deadlifts?|push[\s-]?ups?|stretch(?:es|ing)?|workout|exercise)\b/i,
];

// Same shape for diet/nutrition prescriptions -- "diet" alone is not enough
// to block (the required deflection line contains the word "diet").
const DIET_PRESCRIPTION_PATTERNS = [
  /\b(eat more|cut (down on|back on)|avoid eating|take \d+\s*(grams?|g)\s+of|increase your (protein|calorie|carb))\b/i,
];

export function postCheckReply(replyText: string): PostCheckResult {
  if (IDENTITY_BREAK_PATTERNS.some((p) => p.test(replyText))) return { blocked: true, reason: "identity_break" };
  if (WORKOUT_PRESCRIPTION_PATTERNS.some((p) => p.test(replyText))) return { blocked: true, reason: "workout_prescription" };
  if (DIET_PRESCRIPTION_PATTERNS.some((p) => p.test(replyText))) return { blocked: true, reason: "diet_prescription" };
  return { blocked: false };
}

/** Swapped in when postCheckReply() blocks a draft -- PRD's own "when
 * nothing fits" line (§10.2), reused here since the situation is the same
 * shape: something it can't safely answer from. */
export const POST_CHECK_FALLBACK_REPLY = "I don't want to give you the wrong information there -- I'll check with the team and get back to you.";

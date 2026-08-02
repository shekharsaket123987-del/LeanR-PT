// Shared vocabulary used by both the admin "Add Coach" form and anywhere a
// coach's skills/languages are displayed. Kept as a plain list (not a DB
// enum) so it stays easy to extend without a migration.

export const COACH_SKILLS = [
  "Rehab",
  "Posture Correction",
  "Weight Loss",
  "Strength Training",
  "Mobility",
  "Sports Performance",
  "Prenatal & Postnatal",
  "Senior Fitness",
  "Injury Recovery",
  "Flexibility & Stretching",
  "Nutrition Coaching",
  "Cardio Conditioning",
] as const;

export const COACH_LANGUAGES = ["English", "Hindi", "Tamil", "Telugu", "Kannada", "Marathi", "Bengali", "Punjabi"] as const;

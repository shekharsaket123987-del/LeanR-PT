import { clsx, type ClassValue } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function initials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function formatDate(date: string | Date, opts?: Intl.DateTimeFormatOptions) {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-US", opts ?? { weekday: "short", month: "short", day: "numeric" });
}

export function formatTime(date: string | Date) {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

export function hoursUntil(date: string | Date) {
  const d = typeof date === "string" ? new Date(date) : date;
  return (d.getTime() - Date.now()) / (1000 * 60 * 60);
}

/** Standard BMI = kg / m^2, rounded to 1 decimal. Null if either input is
 * missing or height is non-positive (can't divide by zero/negative). */
export function calculateBmi(heightCm: number | null | undefined, weightKg: number | null | undefined): number | null {
  if (!heightCm || !weightKg || heightCm <= 0) return null;
  const heightM = heightCm / 100;
  return Math.round((weightKg / (heightM * heightM)) * 10) / 10;
}

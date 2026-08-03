"use server";

import { getSessionUser } from "@/lib/supabase/server-client";
import { ActionResult, runAction } from "./action-result";
import { getMyProfile, updateMyProfile } from "@/lib/services/profiles.service";
import { getMyCoachProfile } from "@/lib/services/coaches.service";
import { getMyAvailability } from "@/lib/services/availability.service";
import { getMyCoachPerformance } from "@/lib/services/coachPerformance.service";

const FALLBACK_PHOTO = (seed: string) => `https://i.pravatar.cc/300?u=${seed}`;
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export interface CoachProfileView {
  // Editable by the coach (PRD §13): mobile number, emergency contact,
  // profile picture, password (password handled client-side via
  // supabase.auth.updateUser(), not through this action).
  phone: string | null;
  emergencyContact: string | null;
  photo: string;
  // Read-only for the coach — Admin-owned business/professional data.
  name: string;
  email: string;
  specialization: string;
  yearsExperience: number;
  bio: string;
  certifications: string[];
  languages: string[];
  rating: number;
  reviewCount: number;
  employeeCode: string | null;
  joiningDate: string;
  workingHours: string;
  currentCapacity: number;
  maxCapacity: number;
  availableCapacity: number;
}

async function requireSession() {
  const session = await getSessionUser();
  if (!session) throw new Error("Not authenticated");
  return session;
}

function formatWorkingHours(windows: any[]): string {
  if (!windows || windows.length === 0) return "Not set";
  return windows
    .filter((w) => w.is_active)
    .sort((a, b) => a.day_of_week - b.day_of_week)
    .map((w) => `${DAYS[w.day_of_week]} ${w.start_time.slice(0, 5)}–${w.end_time.slice(0, 5)}`)
    .join(", ");
}

export async function getMyCoachProfileAction(): Promise<ActionResult<CoachProfileView>> {
  return runAction(async () => {
    const session = await requireSession();
    const [profile, coachProfile, availability, performance] = await Promise.all([
      getMyProfile(session.token),
      getMyCoachProfile(session.token),
      getMyAvailability(session.token),
      getMyCoachPerformance(session.token),
    ]);

    return {
      phone: (profile as any).phone ?? null,
      emergencyContact: (profile as any).emergency_contact ?? null,
      photo: (profile as any).photo_url ?? FALLBACK_PHOTO(session.id),
      name: profile.full_name || "",
      email: session.email ?? "",
      specialization: (coachProfile as any).specialization ?? "",
      yearsExperience: (coachProfile as any).years_experience ?? 0,
      bio: (coachProfile as any).bio ?? "",
      certifications: (coachProfile as any).certifications ?? [],
      languages: (coachProfile as any).languages ?? [],
      rating: (coachProfile as any).rating ?? 0,
      reviewCount: (coachProfile as any).review_count ?? 0,
      employeeCode: (coachProfile as any).employee_code ?? null,
      joiningDate: (coachProfile as any).created_at,
      workingHours: formatWorkingHours(availability as any[]),
      currentCapacity: performance.currentCapacity,
      maxCapacity: performance.maxCapacity,
      availableCapacity: performance.availableCapacity,
    };
  });
}

export async function updateMyCoachProfileAction(input: {
  phone: string;
  emergencyContact: string;
  photoUrl?: string;
}): Promise<ActionResult<null>> {
  return runAction(async () => {
    const session = await requireSession();
    await updateMyProfile(session.token, {
      phone: input.phone,
      emergency_contact: input.emergencyContact,
      ...(input.photoUrl ? { photo_url: input.photoUrl } : {}),
    });
    return null;
  });
}

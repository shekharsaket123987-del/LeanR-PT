"use server";

import { getAccessToken } from "@/lib/supabase/server-client";
import { ActionResult, runAction } from "./action-result";
import { getMyRecurringCoachId } from "@/lib/services/clients.service";
import { getCoach } from "@/lib/services/coaches.service";
import { getMyLatestDemoSession } from "@/lib/services/demoBooking.service";

async function requireToken(): Promise<string> {
  const token = await getAccessToken();
  if (!token) throw new Error("Not authenticated");
  return token;
}

const FALLBACK_PHOTO = (seed: string) => `https://i.pravatar.cc/300?u=${seed}`;

export interface MyCoachView {
  id: string;
  name: string;
  photo: string;
  specialization: string;
  bio: string | null;
  certifications: string[];
  languages: string[];
  yearsExperience: number;
  rating: number;
  reviewCount: number;
  /** True when this is a demo-assigned coach (no ongoing plan/recurring
   * slot yet) -- the page renders a simpler card without the "Request
   * Coach Change" flow, which only makes sense for an ongoing relationship. */
  isDemoCoach: boolean;
}

export async function getMyCoachAction(): Promise<ActionResult<MyCoachView | null>> {
  return runAction(async () => {
    const token = await requireToken();
    const coachId = await getMyRecurringCoachId(token);
    if (coachId) {
      const coach: any = await getCoach(token, coachId);
      return {
        id: coach.id,
        name: coach.profile?.full_name ?? "Coach",
        photo: coach.profile?.photo_url ?? FALLBACK_PHOTO(coach.id),
        specialization: coach.specialization ?? "",
        bio: coach.bio,
        certifications: coach.certifications ?? [],
        languages: coach.languages ?? [],
        yearsExperience: coach.years_experience ?? 0,
        rating: Number(coach.rating ?? 0),
        reviewCount: coach.review_count ?? 0,
        isDemoCoach: false,
      };
    }

    // No recurring-slot coach yet -- fall back to the demo-assigned coach,
    // only while the demo is still upcoming (once it's completed, the
    // journey spec calls for "No Active Coach" until a real plan is bought).
    const demo = await getMyLatestDemoSession(token);
    if (!demo || demo.status !== "upcoming" || !demo.coachId) return null;
    const coach: any = await getCoach(token, demo.coachId);
    return {
      id: coach.id,
      name: coach.profile?.full_name ?? "Coach",
      photo: coach.profile?.photo_url ?? FALLBACK_PHOTO(coach.id),
      specialization: coach.specialization ?? "",
      bio: coach.bio,
      certifications: coach.certifications ?? [],
      languages: coach.languages ?? [],
      yearsExperience: coach.years_experience ?? 0,
      rating: Number(coach.rating ?? 0),
      reviewCount: coach.review_count ?? 0,
      isDemoCoach: true,
    };
  });
}

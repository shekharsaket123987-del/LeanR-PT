"use server";

import { getAccessToken } from "@/lib/supabase/server-client";
import { ActionResult, runAction } from "./action-result";
import { getMyCurrentCoachId } from "@/lib/services/clients.service";
import { getCoach } from "@/lib/services/coaches.service";

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
}

export async function getMyCoachAction(): Promise<ActionResult<MyCoachView | null>> {
  return runAction(async () => {
    const token = await requireToken();
    const coachId = await getMyCurrentCoachId(token);
    if (!coachId) return null;
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
    };
  });
}

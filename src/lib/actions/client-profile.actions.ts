"use server";

import { getSessionUser } from "@/lib/supabase/server-client";
import { ActionResult, runAction } from "./action-result";
import { getMyProfile, updateMyProfile } from "@/lib/services/profiles.service";
import { getMyClientProfile, updateMyClientProfile } from "@/lib/services/clients.service";
import { getSubscriptionsForClient } from "@/lib/services/subscriptions.service";
import { getMyOnboarding } from "@/lib/services/onboarding.service";
import { calculateBmi } from "@/lib/utils";

const FALLBACK_PHOTO = (seed: string) => `https://i.pravatar.cc/300?u=${seed}`;

export interface ClientProfileView {
  name: string;
  email: string;
  phone: string | null;
  photo: string;
  packageName: string | null;
  goals: string[];
  equipment: string[];
  medicalNotes: string | null;
  heightCm: number | null;
  weightKg: number | null;
  bmi: number | null;
}

async function requireSession() {
  const session = await getSessionUser();
  if (!session) throw new Error("Not authenticated");
  return session;
}

export async function getMyProfileAction(): Promise<ActionResult<ClientProfileView>> {
  return runAction(async () => {
    const session = await requireSession();
    const [profile, clientProfile, onboarding] = await Promise.all([
      getMyProfile(session.token),
      getMyClientProfile(session.token),
      getMyOnboarding(session.token),
    ]);
    const subscriptions = await getSubscriptionsForClient(session.token, (clientProfile as any).id);
    const activeSub = (subscriptions as any[]).find((s) => s.status === "active") ?? null;
    const heightCm = (onboarding as any)?.height_cm ?? null;
    const weightKg = (onboarding as any)?.weight_kg ?? null;

    return {
      name: profile.full_name || "",
      email: session.email ?? "",
      phone: profile.phone ?? null,
      photo: profile.photo_url ?? FALLBACK_PHOTO(session.id),
      packageName: activeSub?.package?.name ?? null,
      goals: (clientProfile as any).goals ?? [],
      equipment: (clientProfile as any).equipment ?? [],
      medicalNotes: (clientProfile as any).medical_notes ?? null,
      heightCm,
      weightKg,
      bmi: calculateBmi(heightCm, weightKg),
    };
  });
}

export async function updateMyProfileAction(input: {
  fullName: string;
  phone: string;
  goals: string[];
  equipment: string[];
  medicalNotes: string;
  photoUrl?: string;
}): Promise<ActionResult<null>> {
  return runAction(async () => {
    const session = await requireSession();
    await Promise.all([
      updateMyProfile(session.token, {
        full_name: input.fullName,
        phone: input.phone,
        ...(input.photoUrl ? { photo_url: input.photoUrl } : {}),
      }),
      updateMyClientProfile(session.token, {
        goals: input.goals,
        equipment: input.equipment,
        medical_notes: input.medicalNotes,
      }),
    ]);
    return null;
  });
}

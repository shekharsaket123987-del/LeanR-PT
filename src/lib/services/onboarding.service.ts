import { getCallerContext, requireRole } from "./_auth";
import { logTimelineEvent } from "./timeline.service";

export type FitnessGoal = "fat_loss" | "muscle_gain" | "strength" | "general_fitness" | "rehabilitation";

export interface OnboardingInput {
  age?: number;
  gender?: "male" | "female" | "other";
  heightCm?: number;
  weightKg?: number;
  medicalConditions?: string;
  injuries?: string;
  medications?: string;
  exerciseRestrictions?: string;
  fitnessGoal?: FitnessGoal;
}

/** One-time client-submitted assessment, taken right after plan activation.
 * RLS lets a client insert their own row but never update it -- enforced
 * here too (not just RLS) so the error message is clear rather than a raw
 * RLS-denied. Only admin can correct it afterward, via updateOnboarding. */
export async function submitOnboarding(accessToken: string, input: OnboardingInput) {
  const ctx = await getCallerContext(accessToken);
  requireRole(ctx, ["client"]);

  const { data: client, error: clientError } = await ctx.client.from("client_profiles").select("id").eq("profile_id", ctx.userId).single();
  if (clientError || !client) throw clientError ?? new Error("Client profile not found");

  const { data: existing } = await ctx.client.from("client_onboarding").select("id").eq("client_id", client.id).maybeSingle();
  if (existing) throw new Error("Onboarding has already been submitted -- contact support to make changes.");

  const { data, error } = await ctx.client
    .from("client_onboarding")
    .insert({
      client_id: client.id,
      age: input.age ?? null,
      gender: input.gender ?? null,
      height_cm: input.heightCm ?? null,
      weight_kg: input.weightKg ?? null,
      medical_conditions: input.medicalConditions ?? null,
      injuries: input.injuries ?? null,
      medications: input.medications ?? null,
      exercise_restrictions: input.exerciseRestrictions ?? null,
      fitness_goal: input.fitnessGoal ?? null,
    })
    .select()
    .single();
  if (error) throw error;

  await logTimelineEvent(client.id, "plan_activated", "Initial assessment completed", { actorId: ctx.userId });

  return data;
}

export async function getMyOnboarding(accessToken: string) {
  const ctx = await getCallerContext(accessToken);
  requireRole(ctx, ["client"]);
  const { data: client, error: clientError } = await ctx.client.from("client_profiles").select("id").eq("profile_id", ctx.userId).single();
  if (clientError || !client) throw clientError ?? new Error("Client profile not found");

  const { data, error } = await ctx.client.from("client_onboarding").select("*").eq("client_id", client.id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function getOnboardingForClient(accessToken: string, clientId: string) {
  const ctx = await getCallerContext(accessToken);
  const { data, error } = await ctx.client.from("client_onboarding").select("*").eq("client_id", clientId).maybeSingle();
  if (error) throw error;
  return data;
}

export async function updateOnboarding(accessToken: string, clientId: string, patch: Partial<OnboardingInput>) {
  const ctx = await getCallerContext(accessToken);
  requireRole(ctx, ["admin"]);
  const { data, error } = await ctx.client
    .from("client_onboarding")
    .update({
      ...(patch.age !== undefined && { age: patch.age }),
      ...(patch.gender !== undefined && { gender: patch.gender }),
      ...(patch.heightCm !== undefined && { height_cm: patch.heightCm }),
      ...(patch.weightKg !== undefined && { weight_kg: patch.weightKg }),
      ...(patch.medicalConditions !== undefined && { medical_conditions: patch.medicalConditions }),
      ...(patch.injuries !== undefined && { injuries: patch.injuries }),
      ...(patch.medications !== undefined && { medications: patch.medications }),
      ...(patch.exerciseRestrictions !== undefined && { exercise_restrictions: patch.exerciseRestrictions }),
      ...(patch.fitnessGoal !== undefined && { fitness_goal: patch.fitnessGoal }),
    })
    .eq("client_id", clientId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

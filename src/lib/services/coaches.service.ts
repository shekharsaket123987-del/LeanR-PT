import { getCallerContext, requireRole } from "./_auth";

// coach_utilization_view has no FK to coach_profiles, so PostgREST can't
// embed it as a relationship — fetch separately and merge in JS instead.
async function withUtilization(client: Awaited<ReturnType<typeof getCallerContext>>["client"], coachIds?: string[]) {
  let query = client.from("coach_utilization_view").select("coach_id, active_clients, utilization_pct");
  if (coachIds) query = query.in("coach_id", coachIds);
  const { data, error } = await query;
  if (error) throw error;
  return new Map((data ?? []).map((u) => [u.coach_id, u]));
}

export async function listCoaches(accessToken: string) {
  const ctx = await getCallerContext(accessToken);
  const { data, error } = await ctx.client
    .from("coach_profiles")
    .select("*, profile:profiles(full_name, photo_url, phone)");
  if (error) throw error;

  const utilByCoach = await withUtilization(ctx.client, (data ?? []).map((c) => c.id));
  return (data ?? []).map((c) => ({ ...c, utilization: utilByCoach.get(c.id) ?? null }));
}

export async function getCoach(accessToken: string, coachId: string) {
  const ctx = await getCallerContext(accessToken);
  const { data, error } = await ctx.client
    .from("coach_profiles")
    .select("*, profile:profiles(full_name, photo_url, phone)")
    .eq("id", coachId)
    .single();
  if (error) throw error;

  const utilByCoach = await withUtilization(ctx.client, [coachId]);
  return { ...data, utilization: utilByCoach.get(coachId) ?? null };
}

export async function updateMyCoachProfile(
  accessToken: string,
  patch: Partial<{
    specialization: string;
    secondary_specializations: string[];
    years_experience: number;
    bio: string;
    certifications: string[];
    languages: string[];
  }>
) {
  const ctx = await getCallerContext(accessToken);
  requireRole(ctx, ["coach"]);
  const { data, error } = await ctx.client
    .from("coach_profiles")
    .update(patch)
    .eq("profile_id", ctx.userId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

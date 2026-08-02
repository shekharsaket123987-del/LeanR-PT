import { getCallerContext, requireRole } from "./_auth";

export async function listClients(accessToken: string) {
  const ctx = await getCallerContext(accessToken);
  requireRole(ctx, ["admin", "coach"]);
  const { data, error } = await ctx.client
    .from("client_profiles")
    .select("*, profile:profiles(full_name, photo_url, phone, id)");
  if (error) throw error;
  return data;
}

export async function getClient(accessToken: string, clientId: string) {
  const ctx = await getCallerContext(accessToken);
  const { data, error } = await ctx.client
    .from("client_profiles")
    .select("*, profile:profiles(full_name, photo_url, phone, id)")
    .eq("id", clientId)
    .single();
  if (error) throw error;
  return data;
}

export async function updateMyClientProfile(
  accessToken: string,
  patch: Partial<{ medical_notes: string; equipment: string[]; goals: string[] }>
) {
  const ctx = await getCallerContext(accessToken);
  requireRole(ctx, ["client"]);
  const { data, error } = await ctx.client
    .from("client_profiles")
    .update(patch)
    .eq("profile_id", ctx.userId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getMyClientProfile(accessToken: string) {
  const ctx = await getCallerContext(accessToken);
  requireRole(ctx, ["client"]);
  const { data, error } = await ctx.client
    .from("client_profiles")
    .select("*, profile:profiles(full_name, photo_url, phone)")
    .eq("profile_id", ctx.userId)
    .single();
  if (error) throw error;
  return data;
}

/** Resolves the client's current coach: prefers an active recurring slot,
 * falls back to their most recent booking. Returns null if neither exists
 * (a brand-new client with no coach assigned yet — assignment isn't
 * automated in Phase 1, see docs/BUSINESS_OPERATIONS_SPEC.md §8). Shared by
 * coachChange.service.ts so the lookup lives in exactly one place. */
export async function getMyCurrentCoachId(accessToken: string): Promise<string | null> {
  const ctx = await getCallerContext(accessToken);
  requireRole(ctx, ["client"]);

  const { data: client, error: clientError } = await ctx.client
    .from("client_profiles")
    .select("id")
    .eq("profile_id", ctx.userId)
    .single();
  if (clientError || !client) throw clientError ?? new Error("Client profile not found");

  const { data: activeSlot } = await ctx.client
    .from("recurring_slots")
    .select("coach_id")
    .eq("client_id", client.id)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();
  if (activeSlot?.coach_id) return activeSlot.coach_id;

  const { data: latestBooking } = await ctx.client
    .from("bookings")
    .select("coach_id")
    .eq("client_id", client.id)
    .order("scheduled_start", { ascending: false })
    .limit(1)
    .maybeSingle();
  return latestBooking?.coach_id ?? null;
}

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

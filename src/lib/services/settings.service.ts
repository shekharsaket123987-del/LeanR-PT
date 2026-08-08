import { getCallerContext, requireRole } from "./_auth";

export async function getAllSettings(accessToken: string) {
  const ctx = await getCallerContext(accessToken);
  const { data, error } = await ctx.client.from("system_settings").select("*").order("key");
  if (error) throw error;
  return data as { key: string; value: unknown; description: string | null; updated_at: string }[];
}

export async function updateSetting(accessToken: string, key: string, value: unknown) {
  const ctx = await getCallerContext(accessToken);
  requireRole(ctx, ["admin"]);
  const { data, error } = await ctx.client.from("system_settings").update({ value }).eq("key", key).select().single();
  if (error) throw error;
  return data;
}

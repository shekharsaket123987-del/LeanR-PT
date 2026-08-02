import { getCallerContext } from "./_auth";

export async function getMyProfile(accessToken: string) {
  const ctx = await getCallerContext(accessToken);
  const { data, error } = await ctx.client.from("profiles").select("*").eq("id", ctx.userId).single();
  if (error) throw error;
  return data;
}

export async function updateMyProfile(
  accessToken: string,
  patch: Partial<{ full_name: string; phone: string; photo_url: string }>
) {
  const ctx = await getCallerContext(accessToken);
  const { data, error } = await ctx.client
    .from("profiles")
    .update(patch)
    .eq("id", ctx.userId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

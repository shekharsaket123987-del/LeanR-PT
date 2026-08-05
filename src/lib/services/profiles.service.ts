import { getCallerContext } from "./_auth";

const FALLBACK_PHOTO = (seed: string) => `https://i.pravatar.cc/300?u=${seed}`;

export async function getMyProfile(accessToken: string) {
  const ctx = await getCallerContext(accessToken);
  const { data, error } = await ctx.client.from("profiles").select("*").eq("id", ctx.userId).single();
  if (error) throw error;
  return data;
}

/** Name/photo/subtitle for the portal shell's sidebar identity card --
 * previously a hardcoded per-role placeholder (PortalShell.tsx's old
 * IDENTITY map) that showed the same fake name/plan/specialization to every
 * client, every coach, and "Admin"/"Operations Team" for every admin,
 * regardless of who was actually logged in. */
export async function getMyPortalIdentity(accessToken: string, role: "client" | "coach" | "admin") {
  const ctx = await getCallerContext(accessToken);
  const { data: profile, error } = await ctx.client.from("profiles").select("full_name, photo_url").eq("id", ctx.userId).single();
  if (error || !profile) throw error ?? new Error("Profile not found");

  let sub = "";
  if (role === "admin") {
    sub = "Operations Team";
  } else if (role === "coach") {
    const { data: coach } = await ctx.client.from("coach_profiles").select("specialization").eq("profile_id", ctx.userId).maybeSingle();
    sub = coach?.specialization || "Coach";
  } else {
    const { data: client } = await ctx.client.from("client_profiles").select("id").eq("profile_id", ctx.userId).maybeSingle();
    let packageName: string | null = null;
    if (client) {
      const { data: activeSub } = await ctx.client
        .from("subscriptions")
        .select("package:package_tiers(name)")
        .eq("client_id", client.id)
        .eq("status", "active")
        .limit(1)
        .maybeSingle();
      packageName = (activeSub as any)?.package?.name ?? null;
    }
    sub = packageName ?? "Client";
  }

  return {
    name: profile.full_name || "there",
    photo: profile.photo_url || FALLBACK_PHOTO(ctx.userId),
    sub,
  };
}

export async function updateMyProfile(
  accessToken: string,
  patch: Partial<{ full_name: string; phone: string; photo_url: string; emergency_contact: string }>
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

import { getRequestClient } from "@/lib/supabase/request-client";

export type AppRole = "admin" | "coach" | "client";

export interface CallerContext {
  client: ReturnType<typeof getRequestClient>;
  userId: string;
  role: AppRole;
}

/** Resolves the caller's identity + role from their access token. Every
 * service function starts by calling this, then uses `ctx.client` (RLS
 * enforced as this user) for the actual query. */
export async function getCallerContext(accessToken: string): Promise<CallerContext> {
  const client = getRequestClient(accessToken);
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) throw new Error("Not authenticated");

  const { data: profile, error: profileError } = await client
    .from("profiles")
    .select("role")
    .eq("id", data.user.id)
    .single();
  if (profileError || !profile) throw new Error("Profile not found");

  return { client, userId: data.user.id, role: profile.role as AppRole };
}

export function requireRole(ctx: CallerContext, roles: AppRole[]) {
  if (!roles.includes(ctx.role)) {
    throw new Error(`Forbidden: requires role ${roles.join(" or ")}`);
  }
}

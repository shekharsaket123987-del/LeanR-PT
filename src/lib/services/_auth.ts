import { cache } from "react";
import { getRequestClient } from "@/lib/supabase/request-client";

export type AppRole = "admin" | "coach" | "client";

export interface CallerContext {
  client: ReturnType<typeof getRequestClient>;
  userId: string;
  role: AppRole;
}

/** Resolves the caller's identity + role from their access token. Every
 * service function starts by calling this, then uses `ctx.client` (RLS
 * enforced as this user) for the actual query.
 *
 * Wrapped in React's `cache()` so the two network round-trips this makes
 * (auth.getUser() + a profiles lookup) happen once per request, not once
 * per service call — a single page render can call this dozens of times
 * (once per data fetch), and without memoization each one re-verified the
 * token against Supabase's auth server from scratch. */
export const getCallerContext = cache(async (accessToken: string): Promise<CallerContext> => {
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
});

export function requireRole(ctx: CallerContext, roles: AppRole[]) {
  if (!roles.includes(ctx.role)) {
    throw new Error(`Forbidden: requires role ${roles.join(" or ")}`);
  }
}

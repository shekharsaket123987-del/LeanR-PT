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
 * A single page render routinely calls this 3-5+ times (the portal layout's
 * identity lookup, then once per service function the page itself calls),
 * and each call was a fresh `auth.getUser()` + `profiles.role` round trip to
 * Supabase -- multiple seconds of pure re-authentication overhead stacked
 * before any real data query ran. `cache()` memoizes per request (same
 * accessToken -> same in-flight/resolved promise), so this now only hits
 * the network once per request no matter how many services call it. */
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

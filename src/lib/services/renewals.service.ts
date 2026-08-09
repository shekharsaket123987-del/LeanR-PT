import { getCallerContext, requireRole } from "./_auth";
import { listClients } from "./clients.service";

/** Same "running low" bar shown to coach/admin as a heads-up -- deliberately
 * wider than the client's own SESSIONS_LOW_THRESHOLD (5) so staff see it
 * coming before the client's self-serve renewal window even opens. */
export const RENEWAL_OPPORTUNITY_THRESHOLD = 10;

export interface RenewalOpportunityRow {
  clientId: string;
  clientCode: string;
  clientName: string;
  clientPhoto: string;
  packageName: string | null;
  coachName: string | null;
  sessionsRemaining: number;
  category: "opportunity" | "expired";
  /** Has this client ever purchased a second plan -- the only way a client
   * ends up with more than one subscription row at all in this system, so
   * "more than one subscription" is an exact proxy for "already renewed,"
   * no timestamp comparison needed. */
  converted: boolean;
}

const FALLBACK_PHOTO = (seed: string) => `https://i.pravatar.cc/300?u=${seed}`;

/** Both coach and admin callers share this: listClients() already scopes
 * itself correctly per caller via RLS (coach_client_linked for a coach,
 * unrestricted for admin) and already carries everything needed
 * (activeSubscription.sessionsRemaining, activeCoach, hasEverSubscribed) --
 * same "expired" derivation admin-clients.actions.ts::deriveAdminClientStatus
 * already uses, so the two stay consistent with each other. */
export async function listRenewalOpportunities(accessToken: string): Promise<RenewalOpportunityRow[]> {
  const ctx = await getCallerContext(accessToken);
  requireRole(ctx, ["admin", "coach"]);

  const rows = await listClients(accessToken);
  const flagged = (rows as any[]).filter((c) => {
    const remaining = c.activeSubscription?.sessionsRemaining;
    const isOpportunity = !!c.activeSubscription && typeof remaining === "number" && remaining <= RENEWAL_OPPORTUNITY_THRESHOLD;
    const isExpired = !c.activeSubscription && c.hasEverSubscribed;
    return isOpportunity || isExpired;
  });
  if (flagged.length === 0) return [];

  const { data: allSubs, error } = await ctx.client
    .from("subscriptions")
    .select("id, client_id")
    .in(
      "client_id",
      flagged.map((c) => c.id)
    );
  if (error) throw error;
  const subCountByClient = new Map<string, number>();
  for (const s of (allSubs ?? []) as any[]) subCountByClient.set(s.client_id, (subCountByClient.get(s.client_id) ?? 0) + 1);

  return flagged.map((c) => ({
    clientId: c.id,
    clientCode: c.client_code ?? "",
    clientName: c.profile?.full_name ?? "Client",
    clientPhoto: c.profile?.photo_url ?? FALLBACK_PHOTO(c.id),
    packageName: c.activeSubscription?.package?.name ?? null,
    coachName: c.activeCoach?.profile?.full_name ?? null,
    sessionsRemaining: c.activeSubscription?.sessionsRemaining ?? 0,
    category: c.activeSubscription ? "opportunity" : "expired",
    converted: (subCountByClient.get(c.id) ?? 0) > 1,
  }));
}

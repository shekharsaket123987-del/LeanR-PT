import { getCallerContext, requireRole } from "./_auth";

/** Transaction-level sales list (FEATURE_SPEC_PORTAL_ENHANCEMENTS.md §2.6),
 * backed by sales_view (migration 0035). Admin-only. */
export async function listSales(accessToken: string) {
  const ctx = await getCallerContext(accessToken);
  requireRole(ctx, ["admin"]);
  const { data, error } = await ctx.client.from("sales_view").select("*");
  if (error) throw error;
  return data;
}

/** Client's own payment history (§3.11) -- same sales_view, filtered to
 * self. RLS (subscriptions_select_own etc.) would already scope this even
 * without the explicit filter, but the filter keeps the query itself
 * declarative about scope rather than relying on RLS alone. */
export async function listMySales(accessToken: string) {
  const ctx = await getCallerContext(accessToken);
  requireRole(ctx, ["client"]);
  const { data: client, error: clientError } = await ctx.client.from("client_profiles").select("id").eq("profile_id", ctx.userId).single();
  if (clientError || !client) throw clientError ?? new Error("Client profile not found");

  const { data, error } = await ctx.client.from("sales_view").select("*").eq("client_id", client.id);
  if (error) throw error;
  return data;
}

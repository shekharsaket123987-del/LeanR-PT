import { getCallerContext, requireRole } from "./_auth";
import { supabaseAdmin } from "@/lib/supabase/admin-client";
import { logTimelineEvent } from "./timeline.service";

// Subscriptions are financial records — only admins can create/pause/resume
// them (matches the prototype: "Pause Subscription" lives on the admin
// client-detail page, never in the client portal). RLS grants admins direct
// write access already, but these use the admin client uniformly so a
// non-admin caller gets a clean "Forbidden" from requireRole() rather than a
// less obvious RLS-denied error.

export async function getSubscriptionsForClient(accessToken: string, clientId: string) {
  const ctx = await getCallerContext(accessToken);
  const { data, error } = await ctx.client
    .from("subscriptions")
    .select("*, package:package_tiers(*)")
    .eq("client_id", clientId);
  if (error) throw error;

  // subscription_usage_view has no FK to subscriptions, so PostgREST can't
  // embed it — fetch separately and merge.
  const { data: usage, error: usageError } = await ctx.client
    .from("subscription_usage_view")
    .select("subscription_id, sessions_used, sessions_remaining")
    .in("subscription_id", (data ?? []).map((s) => s.id));
  if (usageError) throw usageError;
  const usageBySub = new Map((usage ?? []).map((u) => [u.subscription_id, u]));

  return (data ?? []).map((s) => ({ ...s, usage: usageBySub.get(s.id) ?? null }));
}

export async function purchaseSubscription(accessToken: string, clientId: string, packageId: string) {
  const ctx = await getCallerContext(accessToken);
  requireRole(ctx, ["admin"]);

  const { data: pkg, error: pkgError } = await supabaseAdmin
    .from("package_tiers")
    .select("name, sessions_count")
    .eq("id", packageId)
    .single();
  if (pkgError || !pkg) throw pkgError ?? new Error("Package not found");

  const { data, error } = await supabaseAdmin
    .from("subscriptions")
    .insert({ client_id: clientId, package_id: packageId, sessions_total: pkg.sessions_count, status: "active" })
    .select()
    .single();
  if (error) throw error;

  await logTimelineEvent(clientId, "plan_purchased", `Purchased ${pkg.name}`, {
    description: `${pkg.sessions_count} sessions`,
    actorId: ctx.userId,
    metadata: { subscriptionId: data.id, packageId },
  });

  return data;
}

export async function pauseSubscription(accessToken: string, subscriptionId: string) {
  const ctx = await getCallerContext(accessToken);
  requireRole(ctx, ["admin"]);
  const { data, error } = await supabaseAdmin
    .from("subscriptions")
    .update({ status: "paused", paused_at: new Date().toISOString() })
    .eq("id", subscriptionId)
    .select()
    .single();
  if (error) throw error;

  await logTimelineEvent(data.client_id, "pause_started", "Subscription paused", { actorId: ctx.userId, metadata: { subscriptionId } });

  return data;
}

export async function adjustSubscriptionSessions(accessToken: string, subscriptionId: string, newTotal: number) {
  const ctx = await getCallerContext(accessToken);
  requireRole(ctx, ["admin"]);
  if (newTotal < 1) throw new Error("Session total must be at least 1");

  const { data: before, error: beforeError } = await supabaseAdmin
    .from("subscriptions")
    .select("client_id, sessions_total")
    .eq("id", subscriptionId)
    .single();
  if (beforeError || !before) throw beforeError ?? new Error("Subscription not found");

  const { data, error } = await supabaseAdmin
    .from("subscriptions")
    .update({ sessions_total: newTotal })
    .eq("id", subscriptionId)
    .select()
    .single();
  if (error) throw error;

  if (newTotal > before.sessions_total) {
    await logTimelineEvent(before.client_id, "plan_extended", `Plan extended to ${newTotal} sessions`, {
      description: `Was ${before.sessions_total} sessions`,
      actorId: ctx.userId,
      metadata: { subscriptionId, from: before.sessions_total, to: newTotal },
    });
  }

  return data;
}

export async function resumeSubscription(accessToken: string, subscriptionId: string) {
  const ctx = await getCallerContext(accessToken);
  requireRole(ctx, ["admin"]);
  const { data, error } = await supabaseAdmin
    .from("subscriptions")
    .update({ status: "active", resumed_at: new Date().toISOString() })
    .eq("id", subscriptionId)
    .select()
    .single();
  if (error) throw error;

  await logTimelineEvent(data.client_id, "pause_ended", "Subscription resumed", { actorId: ctx.userId, metadata: { subscriptionId } });

  return data;
}

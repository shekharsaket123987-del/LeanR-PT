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
    .select("name, sessions_count, default_pause_days")
    .eq("id", packageId)
    .single();
  if (pkgError || !pkg) throw pkgError ?? new Error("Package not found");

  const { data, error } = await supabaseAdmin
    .from("subscriptions")
    .insert({
      client_id: clientId,
      package_id: packageId,
      sessions_total: pkg.sessions_count,
      pause_days_allowed: pkg.default_pause_days ?? 0,
      status: "active",
    })
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

export interface PauseDaysStatus {
  pauseDaysAllowed: number;
  pauseDaysUsed: number;
}

/** Pause-days "promise" balance (§2.5/§3.11). pauseDaysAllowed is the stored
 * per-client override; pauseDaysUsed is derived from this subscription's own
 * pause_started/pause_ended timeline events (paired chronologically, an
 * still-open pause counts up to now) rather than a second stored counter --
 * nothing here can drift out of sync with the actual pause history. RLS-
 * scoped, so this works unmodified for admin, the assigned coach, or the
 * client themselves. */
export async function getPauseDaysStatus(accessToken: string, subscriptionId: string): Promise<PauseDaysStatus> {
  const ctx = await getCallerContext(accessToken);
  const { data: sub, error: subError } = await ctx.client
    .from("subscriptions")
    .select("id, client_id, pause_days_allowed")
    .eq("id", subscriptionId)
    .single();
  if (subError || !sub) throw subError ?? new Error("Subscription not found");

  const { data: events, error: eventsError } = await ctx.client
    .from("client_timeline_events")
    .select("event_type, metadata, created_at")
    .eq("client_id", sub.client_id)
    .in("event_type", ["pause_started", "pause_ended"])
    .order("created_at", { ascending: true });
  if (eventsError) throw eventsError;

  const relevant = (events ?? []).filter((e: any) => e.metadata?.subscriptionId === subscriptionId);
  let usedMs = 0;
  let openStartMs: number | null = null;
  for (const e of relevant as any[]) {
    const t = new Date(e.created_at).getTime();
    if (e.event_type === "pause_started") {
      openStartMs = t;
    } else if (e.event_type === "pause_ended" && openStartMs != null) {
      usedMs += t - openStartMs;
      openStartMs = null;
    }
  }
  if (openStartMs != null) usedMs += Date.now() - openStartMs; // still paused right now

  return {
    pauseDaysAllowed: sub.pause_days_allowed ?? 0,
    pauseDaysUsed: Math.round((usedMs / (1000 * 60 * 60 * 24)) * 10) / 10,
  };
}

/** Admin grants additional pause-days on top of whatever the client already
 * has (§2.5) -- a per-client override, logged as its own distinct timeline
 * event so it reads as "admin adjusted a promise," not a plan/package
 * change. */
export async function adjustPauseDaysAllowed(accessToken: string, subscriptionId: string, additionalDays: number) {
  const ctx = await getCallerContext(accessToken);
  requireRole(ctx, ["admin"]);
  if (additionalDays === 0) throw new Error("Enter a non-zero number of days");

  const { data: sub, error: subError } = await ctx.client
    .from("subscriptions")
    .select("id, client_id, pause_days_allowed")
    .eq("id", subscriptionId)
    .single();
  if (subError || !sub) throw subError ?? new Error("Subscription not found");

  const newTotal = Math.max(0, (sub.pause_days_allowed ?? 0) + additionalDays);
  const { error } = await ctx.client.from("subscriptions").update({ pause_days_allowed: newTotal }).eq("id", subscriptionId);
  if (error) throw error;

  await logTimelineEvent(sub.client_id, "plan_promise_adjusted", `Pause-days allowance ${additionalDays > 0 ? "increased" : "decreased"} by ${Math.abs(additionalDays)}`, {
    description: `New total: ${newTotal} pause-days`,
    actorId: ctx.userId,
    metadata: { subscriptionId, additionalDays, newTotal },
  });

  return { pauseDaysAllowed: newTotal };
}

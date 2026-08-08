import { getCallerContext, requireRole } from "./_auth";
import { supabaseAdmin } from "@/lib/supabase/admin-client";
import { logTimelineEvent } from "./timeline.service";

/** Client-initiated purchase (post stub-payment) -- distinct from
 * subscriptions.service.ts's purchaseSubscription(), which is the
 * admin-driven "buy on the client's behalf" path. Uses supabaseAdmin because
 * subscriptions RLS is admin-only-write by design (see 0012's comment);
 * the "is this client actually allowed to buy this" check (no existing
 * active/awaiting plan) lives here in application code instead. */
export async function purchaseMyPlan(accessToken: string, packageId: string) {
  const ctx = await getCallerContext(accessToken);
  requireRole(ctx, ["client"]);

  const { data: client, error: clientError } = await ctx.client.from("client_profiles").select("id").eq("profile_id", ctx.userId).single();
  if (clientError || !client) throw clientError ?? new Error("Client profile not found");

  const { data: existing, error: existingError } = await supabaseAdmin
    .from("subscriptions")
    .select("id")
    .eq("client_id", client.id)
    .in("status", ["active", "awaiting_activation"])
    .maybeSingle();
  if (existingError) throw existingError;
  if (existing) throw new Error("You already have an active or pending plan.");

  const { data: pkg, error: pkgError } = await supabaseAdmin.from("package_tiers").select("name, sessions_count").eq("id", packageId).eq("is_active", true).single();
  if (pkgError || !pkg) throw pkgError ?? new Error("Package not found");

  const { data, error } = await supabaseAdmin
    .from("subscriptions")
    .insert({ client_id: client.id, package_id: packageId, sessions_total: pkg.sessions_count, status: "awaiting_activation" })
    .select()
    .single();
  if (error) throw error;

  await logTimelineEvent(client.id, "plan_purchased", `Purchased ${pkg.name}`, {
    description: `${pkg.sessions_count} sessions -- awaiting activation`,
    actorId: ctx.userId,
    metadata: { subscriptionId: data.id, packageId },
  });

  return data;
}

/** One-time activation: the client picks their start date. Locked after
 * confirmation -- a second call is rejected rather than silently
 * overwriting the chosen date. */
export async function activateMyPlan(accessToken: string, subscriptionId: string, startDate: string) {
  const ctx = await getCallerContext(accessToken);
  requireRole(ctx, ["client"]);

  const { data: sub, error: subError } = await supabaseAdmin.from("subscriptions").select("id, client_id, activated_at, status").eq("id", subscriptionId).single();
  if (subError || !sub) throw subError ?? new Error("Subscription not found");
  if (sub.activated_at) throw new Error("This plan has already been activated.");

  // Business "today" is IST, same convention as the rest of scheduling --
  // compare calendar dates (not instants) so activating "today" itself is
  // never mistakenly rejected regardless of what time it currently is.
  const todayIST = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  if (startDate < todayIST) {
    throw new Error("Start date can't be in the past -- pick today or a future date.");
  }

  const { data: client, error: clientError } = await ctx.client.from("client_profiles").select("id").eq("profile_id", ctx.userId).single();
  if (clientError || !client || client.id !== sub.client_id) throw new Error("Not your subscription");

  const { data, error } = await supabaseAdmin
    .from("subscriptions")
    .update({ status: "active", activated_at: new Date(startDate).toISOString() })
    .eq("id", subscriptionId)
    .select()
    .single();
  if (error) throw error;

  await logTimelineEvent(sub.client_id, "plan_activated", "Plan activated", {
    description: `Start date: ${startDate}`,
    actorId: ctx.userId,
    metadata: { subscriptionId },
  });

  return data;
}

/** The client's current subscription, whatever state it's in -- used by the
 * dashboard journey-state gate to decide which view to render. */
export async function getMyLatestSubscription(accessToken: string) {
  const ctx = await getCallerContext(accessToken);
  requireRole(ctx, ["client"]);
  const { data: client, error: clientError } = await ctx.client.from("client_profiles").select("id").eq("profile_id", ctx.userId).single();
  if (clientError || !client) throw clientError ?? new Error("Client profile not found");

  const { data, error } = await ctx.client
    .from("subscriptions")
    .select("*, package:package_tiers(name)")
    .eq("client_id", client.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

import { getCallerContext, requireRole } from "./_auth";
import { supabaseAdmin } from "@/lib/supabase/admin-client";
import { logTimelineEvent } from "./timeline.service";

/** Shared by the renewal reminder (client-portal nudge to renew) and the
 * purchase-gate relaxation below, so the two always agree on when "running
 * low" starts -- "Renew Now" from the reminder must never hit the
 * already-have-a-plan rejection just below. */
export const SESSIONS_LOW_THRESHOLD = 5;

/** Client-initiated purchase (post stub-payment) -- distinct from
 * subscriptions.service.ts's purchaseSubscription(), which is the
 * admin-driven "buy on the client's behalf" path. Uses supabaseAdmin because
 * subscriptions RLS is admin-only-write by design (see 0012's comment);
 * the "is this client actually allowed to buy this" check (no existing
 * active/awaiting plan) lives here in application code instead. */
/** Core purchase logic, keyed off an already-resolved client_profiles.id
 * rather than a user access token -- shared by the normal client-initiated
 * path (purchaseMyPlan, below) and the Razorpay webhook reconciliation path
 * (payments.service.ts::fulfillPaymentByWebhook), which has no user session
 * to derive a caller context from (Razorpay calls the webhook server-to-
 * server) but already knows the paying client's id from the `payments` row
 * created at checkout time. actorId is the acting user's profile id for the
 * timeline log -- null for the system/webhook path. */
export async function purchaseMyPlanForClient(clientId: string, packageId: string, actorId: string | null) {
  const { data: existing, error: existingError } = await supabaseAdmin
    .from("subscriptions")
    .select("id, status")
    .eq("client_id", clientId)
    .in("status", ["active", "awaiting_activation"])
    .maybeSingle();
  if (existingError) throw existingError;

  if (existing) {
    // A pending (not-yet-activated) plan always blocks a second purchase --
    // only an ACTIVE plan can be superseded, and only once it's running low,
    // so "Renew Now" from the low-sessions reminder actually works instead
    // of hitting this same rejection.
    let isRenewable = false;
    if (existing.status === "active") {
      const { data: usage, error: usageError } = await supabaseAdmin
        .from("subscription_usage_view")
        .select("sessions_remaining")
        .eq("subscription_id", existing.id)
        .maybeSingle();
      if (usageError) throw usageError;
      isRenewable = ((usage as any)?.sessions_remaining ?? Infinity) <= SESSIONS_LOW_THRESHOLD;
    }
    if (!isRenewable) throw new Error("You already have an active or pending plan.");
  }

  const { data: pkg, error: pkgError } = await supabaseAdmin.from("package_tiers").select("name, sessions_count").eq("id", packageId).eq("is_active", true).single();
  if (pkgError || !pkg) throw pkgError ?? new Error("Package not found");

  const { data, error } = await supabaseAdmin
    .from("subscriptions")
    .insert({ client_id: clientId, package_id: packageId, sessions_total: pkg.sessions_count, status: "awaiting_activation" })
    .select()
    .single();
  if (error) throw error;

  await logTimelineEvent(clientId, "plan_purchased", `Purchased ${pkg.name}`, {
    description: `${pkg.sessions_count} sessions -- awaiting activation`,
    actorId,
    metadata: { subscriptionId: data.id, packageId },
  });

  return data;
}

export async function purchaseMyPlan(accessToken: string, packageId: string) {
  const ctx = await getCallerContext(accessToken);
  requireRole(ctx, ["client"]);

  const { data: client, error: clientError } = await ctx.client.from("client_profiles").select("id").eq("profile_id", ctx.userId).single();
  if (clientError || !client) throw clientError ?? new Error("Client profile not found");

  return purchaseMyPlanForClient(client.id, packageId, ctx.userId);
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

  // Business "today" is IST, same convention as the rest of scheduling.
  // Same-day is disallowed here too, matching earliestBookableDateIST's
  // rule for demo/regular session booking -- a plan activated today would
  // need a same-day first session, which the scheduling side already
  // refuses to offer.
  const todayIST = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  if (startDate <= todayIST) {
    throw new Error("Start date must be at least tomorrow -- same-day start isn't available.");
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

  // Renewal: retire whichever OLD subscription this one is superseding (the
  // purchase gate above only ever allows a second purchase while exactly one
  // other active plan exists) so it stops being picked up anywhere that
  // filters on status = 'active' (getSubscriptionsForClient, listClients,
  // Renewal Opportunities). A genuinely first-time purchase has no such row,
  // so this is a no-op for it.
  const { data: oldSub, error: oldSubError } = await supabaseAdmin
    .from("subscriptions")
    .select("id")
    .eq("client_id", sub.client_id)
    .eq("status", "active")
    .neq("id", subscriptionId)
    .maybeSingle();
  if (oldSubError) throw oldSubError;
  if (oldSub) {
    const { error: retireError } = await supabaseAdmin.from("subscriptions").update({ status: "inactive" }).eq("id", oldSub.id);
    if (retireError) throw retireError;
  }

  await logTimelineEvent(sub.client_id, "plan_activated", "Plan activated", {
    description: `Start date: ${startDate}`,
    actorId: ctx.userId,
    metadata: { subscriptionId },
  });

  return data;
}

/** Derives which (if either) renewal-only journey step the client's latest
 * ACTIVE subscription still needs, without ever touching a genuinely
 * first-time client (who has no older subscription at all, so this returns
 * null immediately). Both checks are pure existence queries against data
 * that's already written elsewhere -- no new columns anywhere:
 * - "renewal_checkin": no progress_logs entry since this plan activated yet
 *   (the measurement-continuity check-in hasn't happened).
 * - "renewal_scheduling": no recurring_slots row is billed against this
 *   subscription yet (covers both the "keep as-is" repoint and a fresh
 *   pattern choice) -- checked instead of the generic "any active slot"
 *   test the normal slot_selection stage uses, since the OLD slots (still
 *   pointing at the now-retired subscription) would otherwise satisfy that
 *   generic test and skip this step entirely. */
export async function checkRenewalStage(
  accessToken: string,
  input: { clientId: string; subscriptionId: string; activatedAt: string | null }
): Promise<"renewal_checkin" | "renewal_scheduling" | null> {
  const ctx = await getCallerContext(accessToken);
  requireRole(ctx, ["client"]);

  const { data: olderSubs, error: olderError } = await ctx.client
    .from("subscriptions")
    .select("id")
    .eq("client_id", input.clientId)
    .neq("id", input.subscriptionId)
    .limit(1);
  if (olderError) throw olderError;
  if (!olderSubs || olderSubs.length === 0) return null;

  if (input.activatedAt) {
    const { data: logs, error: logsError } = await ctx.client
      .from("progress_logs")
      .select("id")
      .eq("client_id", input.clientId)
      .gte("logged_at", input.activatedAt)
      .limit(1);
    if (logsError) throw logsError;
    if (!logs || logs.length === 0) return "renewal_checkin";
  }

  const { data: slots, error: slotsError } = await ctx.client
    .from("recurring_slots")
    .select("id")
    .eq("client_id", input.clientId)
    .eq("subscription_id", input.subscriptionId)
    .limit(1);
  if (slotsError) throw slotsError;
  if (!slots || slots.length === 0) return "renewal_scheduling";

  return null;
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

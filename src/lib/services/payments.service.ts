import { getCallerContext, requireRole, CallerContext } from "./_auth";
import { supabaseAdmin } from "@/lib/supabase/admin-client";
import { createRazorpayOrder, verifyRazorpaySignature, getRazorpayKeyId } from "./razorpay.service";
import { purchaseMyPlan, purchaseMyPlanForClient } from "./planPurchase.service";
import { confirmDemoBooking } from "./demoBooking.service";
import { DEMO_SESSION_FEE } from "@/lib/constants/pricing";

export interface RazorpayOrderView {
  orderId: string;
  amountPaise: number;
  currency: string;
  keyId: string;
}

export interface PaymentFulfillment {
  subscriptionId?: string;
  bookingId?: string;
}

async function requireClientId(ctx: CallerContext): Promise<string> {
  const { data: client, error } = await ctx.client.from("client_profiles").select("id").eq("profile_id", ctx.userId).single();
  if (error || !client) throw error ?? new Error("Client profile not found");
  return client.id as string;
}

/** Creates the Razorpay order AND the local payments row up front, before
 * any money moves -- so verifyAndFulfillPayment always has a row to look up
 * by razorpay_order_id no matter how the client-side checkout resolves. Runs
 * the same "no existing active/pending plan" guard purchaseMyPlan enforces
 * later, so we don't send a client to checkout for a purchase that's
 * guaranteed to be rejected once they've actually paid. */
export async function createPackagePurchaseOrder(accessToken: string, packageId: string): Promise<RazorpayOrderView> {
  const ctx = await getCallerContext(accessToken);
  requireRole(ctx, ["client"]);
  const clientId = await requireClientId(ctx);

  const { data: existing, error: existingError } = await supabaseAdmin
    .from("subscriptions")
    .select("id")
    .eq("client_id", clientId)
    .in("status", ["active", "awaiting_activation"])
    .maybeSingle();
  if (existingError) throw existingError;
  if (existing) throw new Error("You already have an active or pending plan.");

  const { data: pkg, error: pkgError } = await supabaseAdmin
    .from("package_tiers")
    .select("id, price")
    .eq("id", packageId)
    .eq("is_active", true)
    .single();
  if (pkgError || !pkg) throw pkgError ?? new Error("Package not found");

  const order = await createRazorpayOrder(pkg.price, `pkg_${clientId.slice(0, 8)}_${Date.now()}`);

  const { error: insertError } = await supabaseAdmin.from("payments").insert({
    client_id: clientId,
    purpose: "package_purchase",
    package_id: pkg.id,
    amount: pkg.price,
    currency: "INR",
    razorpay_order_id: order.id,
    status: "created",
  });
  if (insertError) throw insertError;

  return { orderId: order.id, amountPaise: order.amount, currency: order.currency, keyId: getRazorpayKeyId() };
}

export async function createDemoSessionOrder(accessToken: string, coachId: string, slotStart: string): Promise<RazorpayOrderView> {
  const ctx = await getCallerContext(accessToken);
  requireRole(ctx, ["client"]);
  const clientId = await requireClientId(ctx);

  const order = await createRazorpayOrder(DEMO_SESSION_FEE, `demo_${clientId.slice(0, 8)}_${Date.now()}`);

  const { error: insertError } = await supabaseAdmin.from("payments").insert({
    client_id: clientId,
    purpose: "demo_session",
    demo_coach_id: coachId,
    demo_slot_start: slotStart,
    amount: DEMO_SESSION_FEE,
    currency: "INR",
    razorpay_order_id: order.id,
    status: "created",
  });
  if (insertError) throw insertError;

  return { orderId: order.id, amountPaise: order.amount, currency: order.currency, keyId: getRazorpayKeyId() };
}

/** The only place that trusts a payment happened -- verifies the Checkout
 * signature server-side (never the client's say-so), then does exactly what
 * StubPaymentModal's onSuccess used to do: create the subscription or the
 * demo booking. If that fulfillment step itself fails (e.g. the demo slot
 * got taken while checkout was open, or a second tab already bought a plan),
 * the money is already captured on Razorpay's side -- so the row is marked
 * paid_unfulfilled rather than left looking like nothing happened, and the
 * caller gets an error that points them at support instead of a silent
 * failure. */
export async function verifyAndFulfillPayment(
  accessToken: string,
  orderId: string,
  paymentId: string,
  signature: string
): Promise<PaymentFulfillment> {
  const ctx = await getCallerContext(accessToken);
  requireRole(ctx, ["client"]);
  const clientId = await requireClientId(ctx);

  const { data: payment, error: paymentError } = await supabaseAdmin.from("payments").select("*").eq("razorpay_order_id", orderId).single();
  if (paymentError || !payment) throw paymentError ?? new Error("Payment record not found");
  if (payment.client_id !== clientId) throw new Error("Not your payment");

  // Idempotent: Checkout's handler is expected to fire once, but treat a
  // repeat call as a no-op success rather than double-fulfilling.
  if (payment.status === "paid") {
    return { subscriptionId: payment.subscription_id ?? undefined, bookingId: payment.booking_id ?? undefined };
  }
  if (payment.status !== "created") {
    throw new Error("This payment can't be verified anymore -- please start a new payment.");
  }

  if (!verifyRazorpaySignature(orderId, paymentId, signature)) {
    await supabaseAdmin.from("payments").update({ status: "failed" }).eq("id", payment.id);
    throw new Error("Payment verification failed -- signature mismatch.");
  }

  try {
    if (payment.purpose === "package_purchase") {
      const sub = await purchaseMyPlan(accessToken, payment.package_id);
      await supabaseAdmin
        .from("payments")
        .update({ status: "paid", paid_at: new Date().toISOString(), razorpay_payment_id: paymentId, razorpay_signature: signature, subscription_id: sub.id })
        .eq("id", payment.id);
      return { subscriptionId: sub.id };
    }

    const bookingId = await confirmDemoBooking(accessToken, payment.demo_coach_id, payment.demo_slot_start);
    await supabaseAdmin
      .from("payments")
      .update({ status: "paid", paid_at: new Date().toISOString(), razorpay_payment_id: paymentId, razorpay_signature: signature, booking_id: bookingId })
      .eq("id", payment.id);
    return { bookingId };
  } catch (err) {
    await supabaseAdmin
      .from("payments")
      .update({ status: "paid_unfulfilled", paid_at: new Date().toISOString(), razorpay_payment_id: paymentId, razorpay_signature: signature })
      .eq("id", payment.id);
    throw new Error(
      `Your payment was received, but we couldn't finish setting things up automatically (${(err as Error).message}). Your payment is safe -- contact support with reference ${orderId} to resolve this.`
    );
  }
}

/** Reconciliation path for src/app/api/webhooks/razorpay/route.ts (QA audit
 * finding C4). verifyAndFulfillPayment above is the PRIMARY fulfillment
 * path and fires the moment checkout's client-side handler runs -- in the
 * overwhelming majority of cases this function will find the payment
 * already `paid` and do nothing. It exists for the case that path can't
 * cover: the browser tab closes, crashes, or loses network after Razorpay
 * has actually captured the money but before the client-side callback
 * fires, leaving the local `payments` row stuck at `status='created'`
 * forever with no other code path that would ever revisit it. Unlike the
 * user-initiated path, there's no access token here -- Razorpay calls this
 * server-to-server -- so fulfillment runs directly against the client id
 * already stored on the `payments` row (written at order-creation time,
 * before any money moved), using the same admin-privileged writes the rest
 * of this file already relies on. Caller (the webhook route) is
 * responsible for verifying the webhook signature BEFORE calling this --
 * this function trusts orderId/paymentId once invoked, same trust boundary
 * verifyAndFulfillPayment has once verifyRazorpaySignature has passed. */
export async function fulfillPaymentByWebhook(orderId: string, paymentId: string): Promise<void> {
  const { data: payment, error: paymentError } = await supabaseAdmin.from("payments").select("*").eq("razorpay_order_id", orderId).maybeSingle();
  if (paymentError) throw paymentError;
  if (!payment) {
    console.error(`Razorpay webhook: no local payment row for order ${orderId} (payment ${paymentId})`);
    return;
  }

  // Already fulfilled by the client-side callback (the common case), or in
  // a terminal state a blind retry shouldn't silently override -- 'failed'
  // and 'paid_unfulfilled' both need a human, not an automatic re-attempt.
  if (payment.status !== "created") return;

  try {
    if (payment.purpose === "package_purchase") {
      const sub = await purchaseMyPlanForClient(payment.client_id, payment.package_id, null);
      await supabaseAdmin
        .from("payments")
        .update({ status: "paid", paid_at: new Date().toISOString(), razorpay_payment_id: paymentId, subscription_id: sub.id })
        .eq("id", payment.id);
      return;
    }

    // demo_session: dormant/unreachable from any current UI (see
    // demoBooking.service.ts's confirmDemoBooking comment -- the live demo
    // flow is free and never goes through Razorpay). Fulfilling it here
    // would need a real client access token (confirmDemoBooking calls
    // getCallerContext), which this server-to-server call doesn't have.
    // Rather than build and risk a fulfillment path for code nothing
    // reaches today, mark it for manual follow-up like any other fulfillment
    // failure -- consistent with, not a regression from, today's behavior.
    await supabaseAdmin
      .from("payments")
      .update({ status: "paid_unfulfilled", paid_at: new Date().toISOString(), razorpay_payment_id: paymentId })
      .eq("id", payment.id);
    console.error(`Razorpay webhook: demo_session payment ${payment.id} captured but has no automatic fulfillment path -- needs manual review.`);
  } catch (err) {
    await supabaseAdmin
      .from("payments")
      .update({ status: "paid_unfulfilled", paid_at: new Date().toISOString(), razorpay_payment_id: paymentId })
      .eq("id", payment.id);
    console.error(`Razorpay webhook: payment ${payment.id} captured but fulfillment failed:`, err);
  }
}

import { NextRequest, NextResponse } from "next/server";
import { verifyRazorpayWebhookSignature } from "@/lib/services/razorpay.service";
import { fulfillPaymentByWebhook } from "@/lib/services/payments.service";

/** Razorpay's server-to-server payment confirmation (QA audit finding C4).
 * Must be a real Route Handler, not a Server Action -- Razorpay's servers
 * POST here directly, with no browser/user session in the loop, which a
 * Server Action can't receive. Configure in the Razorpay Dashboard ->
 * Settings -> Webhooks with this route's URL and the "payment.captured"
 * event (subscribe "order.paid" too if desired -- handled the same way);
 * set the webhook's own secret (distinct from RAZORPAY_KEY_SECRET) as
 * RAZORPAY_WEBHOOK_SECRET.
 *
 * This is a reconciliation safety net, not the primary fulfillment path --
 * see fulfillPaymentByWebhook's own comment in payments.service.ts for why.
 *
 * Always read the raw body via request.text() -- Razorpay's signature is
 * computed over the exact bytes sent, and re-serializing parsed JSON before
 * verifying would produce a different (and thus rejected) signature. */
export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-razorpay-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let signatureValid: boolean;
  try {
    signatureValid = verifyRazorpayWebhookSignature(rawBody, signature);
  } catch (err) {
    console.error("Razorpay webhook: signature verification unavailable:", err);
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }
  if (!signatureValid) {
    console.error("Razorpay webhook: invalid signature");
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  let event: any;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Only payment.captured actually confirms money moved; order.paid fires
  // alongside it for the same payment and would just be redundant work
  // (fulfillPaymentByWebhook is idempotent either way, so this is an
  // optimization, not a correctness requirement).
  if (event.event === "payment.captured") {
    const paymentEntity = event.payload?.payment?.entity;
    const orderId = paymentEntity?.order_id;
    const paymentId = paymentEntity?.id;
    if (orderId && paymentId) {
      try {
        await fulfillPaymentByWebhook(orderId, paymentId);
      } catch (err) {
        // Signature is valid and the event is understood -- a failure here
        // is our own bug, not a delivery problem, so retrying the same
        // webhook call won't help. Log for investigation and still 200 the
        // webhook so Razorpay doesn't hammer retries for something a resend
        // can't fix; fulfillPaymentByWebhook already marks the payment
        // paid_unfulfilled for manual follow-up before it would ever throw.
        console.error(`Razorpay webhook: fulfillment threw for order ${orderId}:`, err);
      }
    }
  }

  return NextResponse.json({ received: true });
}

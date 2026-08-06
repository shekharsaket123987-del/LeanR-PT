import crypto from "crypto";

/** Thin wrapper around Razorpay's Orders API + Checkout signature
 * verification -- no SDK, just fetch + Node's crypto (same style as
 * zoom.service.ts), since both operations are a handful of lines each.
 *
 * Requires a Razorpay account (https://dashboard.razorpay.com) in Test Mode
 * to start -- Settings -> API Keys gives you a Key Id and Key Secret:
 *   RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET
 * Swap to the Live Mode key pair only once ready to accept real payments. */

interface RazorpayOrder {
  id: string;
  amount: number; // paise
  currency: string;
}

function requireRazorpayEnv() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    throw new Error("Razorpay isn't configured yet -- set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.");
  }
  return { keyId, keySecret };
}

/** The key id is not secret -- Razorpay Checkout.js needs it client-side --
 * but callers should still get it from the server (this function) rather
 * than a NEXT_PUBLIC_ env var, so there's exactly one place that decides
 * Razorpay is configured at all. */
export function getRazorpayKeyId(): string {
  return requireRazorpayEnv().keyId;
}

export async function createRazorpayOrder(amountRupees: number, receipt: string): Promise<RazorpayOrder> {
  const { keyId, keySecret } = requireRazorpayEnv();
  const basicAuth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
  const res = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: { Authorization: `Basic ${basicAuth}`, "Content-Type": "application/json" },
    body: JSON.stringify({ amount: Math.round(amountRupees * 100), currency: "INR", receipt }),
  });
  if (!res.ok) throw new Error(`Razorpay order creation failed (${res.status}): ${await res.text()}`);
  const data = await res.json();
  return { id: data.id, amount: data.amount, currency: data.currency };
}

/** Checkout's success handler hands back razorpay_order_id/payment_id/signature
 * -- the ONLY proof a payment actually happened; nothing else the client
 * says about the payment should be trusted. Razorpay's documented signature
 * scheme: HMAC-SHA256("<order_id>|<payment_id>", key_secret), hex digest. */
export function verifyRazorpaySignature(orderId: string, paymentId: string, signature: string): boolean {
  const { keySecret } = requireRazorpayEnv();
  const expected = crypto.createHmac("sha256", keySecret).update(`${orderId}|${paymentId}`).digest("hex");
  const expectedBuf = Buffer.from(expected, "utf8");
  const actualBuf = Buffer.from(signature, "utf8");
  if (expectedBuf.length !== actualBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, actualBuf);
}

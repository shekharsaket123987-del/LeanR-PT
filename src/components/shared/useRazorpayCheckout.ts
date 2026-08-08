"use client";

import { useCallback } from "react";
import { verifyPaymentAction, RazorpayOrderView, PaymentFulfillment } from "@/lib/actions/payments.actions";
import { isFailure } from "@/lib/actions/action-result";

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void; on: (event: string, handler: (resp: unknown) => void) => void };
  }
}

const CHECKOUT_SRC = "https://checkout.razorpay.com/v1/checkout.js";

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const existing = document.querySelector(`script[src="${CHECKOUT_SRC}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve(true));
      existing.addEventListener("error", () => resolve(false));
      return;
    }
    const script = document.createElement("script");
    script.src = CHECKOUT_SRC;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

/** Opens Razorpay's hosted Checkout for an order this app already created
 * server-side (via createPackagePurchaseOrderAction/createDemoSessionOrderAction),
 * then hands the resulting signature to verifyPaymentAction -- the only step
 * that actually creates the subscription/booking. Shared between the plans
 * page and demo booking since both flows are "create order, open Checkout,
 * verify on success" with nothing else that differs. */
export function useRazorpayCheckout() {
  const openCheckout = useCallback(
    (
      order: RazorpayOrderView,
      opts: { name: string; description: string },
      handlers: { onSuccess: (result: PaymentFulfillment) => void; onError: (message: string) => void; onDismiss?: () => void }
    ) => {
      void (async () => {
        const loaded = await loadRazorpayScript();
        if (!loaded || !window.Razorpay) {
          handlers.onError("Couldn't load the payment gateway -- check your connection and try again.");
          return;
        }

        const rzp = new window.Razorpay({
          key: order.keyId,
          amount: order.amountPaise,
          currency: order.currency,
          order_id: order.orderId,
          name: opts.name,
          description: opts.description,
          theme: { color: "#F5E400" },
          handler: async (response: unknown) => {
            const r = response as { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string };
            const result = await verifyPaymentAction(r.razorpay_order_id, r.razorpay_payment_id, r.razorpay_signature);
            if (isFailure(result)) {
              handlers.onError(result.error.message);
              return;
            }
            handlers.onSuccess(result.data);
          },
          modal: { ondismiss: () => handlers.onDismiss?.() },
        });
        rzp.on("payment.failed", (resp: unknown) => {
          const r = resp as { error?: { description?: string } };
          handlers.onError(r.error?.description ?? "Payment failed.");
        });
        rzp.open();
      })();
    },
    []
  );

  return { openCheckout };
}

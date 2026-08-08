"use server";

import { getAccessToken } from "@/lib/supabase/server-client";
import { ActionResult, runAction } from "./action-result";
import {
  createDemoSessionOrder,
  createPackagePurchaseOrder,
  PaymentFulfillment,
  RazorpayOrderView,
  verifyAndFulfillPayment,
} from "@/lib/services/payments.service";

async function requireToken(): Promise<string> {
  const token = await getAccessToken();
  if (!token) throw new Error("Not authenticated");
  return token;
}

export type { RazorpayOrderView, PaymentFulfillment };

export async function createPackagePurchaseOrderAction(packageId: string): Promise<ActionResult<RazorpayOrderView>> {
  return runAction(async () => {
    const token = await requireToken();
    return createPackagePurchaseOrder(token, packageId);
  });
}

export async function createDemoSessionOrderAction(coachId: string, slotStart: string): Promise<ActionResult<RazorpayOrderView>> {
  return runAction(async () => {
    const token = await requireToken();
    return createDemoSessionOrder(token, coachId, slotStart);
  });
}

export async function verifyPaymentAction(orderId: string, paymentId: string, signature: string): Promise<ActionResult<PaymentFulfillment>> {
  return runAction(async () => {
    const token = await requireToken();
    return verifyAndFulfillPayment(token, orderId, paymentId, signature);
  });
}

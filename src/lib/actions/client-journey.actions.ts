"use server";

import { getAccessToken } from "@/lib/supabase/server-client";
import { ActionResult, runAction } from "./action-result";
import { getMyLatestSubscription, purchaseMyPlan, activateMyPlan } from "@/lib/services/planPurchase.service";
import { getMyOnboarding, submitOnboarding, OnboardingInput } from "@/lib/services/onboarding.service";
import { getMyActiveRecurringSlots } from "@/lib/services/scheduling.service";
import { listPackages } from "@/lib/services/packages.service";
import { findDemoSlots, confirmDemoBooking, DemoSlotOption } from "@/lib/services/demoBooking.service";

async function requireToken(): Promise<string> {
  const token = await getAccessToken();
  if (!token) throw new Error("Not authenticated");
  return token;
}

export type ClientJourneyStage = "marketing" | "awaiting_activation" | "onboarding" | "slot_selection" | "active";

export interface ClientJourneyState {
  stage: ClientJourneyStage;
  subscriptionId: string | null;
  packageName: string | null;
}

/** Decides which experience client/dashboard renders -- the single gate
 * described in the plan, walking purchase -> activation -> onboarding ->
 * slot selection -> the real dashboard. Each stage reuses an existing,
 * already-verified read (getMyActiveRecurringSlots, getMyOnboarding). */
export async function getMyJourneyStateAction(): Promise<ActionResult<ClientJourneyState>> {
  return runAction(async () => {
    const token = await requireToken();
    const sub: any = await getMyLatestSubscription(token);

    if (!sub) return { stage: "marketing", subscriptionId: null, packageName: null };
    if (sub.status === "awaiting_activation") {
      return { stage: "awaiting_activation", subscriptionId: sub.id, packageName: sub.package?.name ?? null };
    }
    if (sub.status !== "active") {
      // paused/inactive with no newer subscription -- treat as marketing so
      // the client can see plans again rather than getting stuck.
      return { stage: "marketing", subscriptionId: null, packageName: null };
    }

    const onboarding = await getMyOnboarding(token);
    if (!onboarding) return { stage: "onboarding", subscriptionId: sub.id, packageName: sub.package?.name ?? null };

    const slots = await getMyActiveRecurringSlots(token);
    if (!slots || slots.length === 0) return { stage: "slot_selection", subscriptionId: sub.id, packageName: sub.package?.name ?? null };

    return { stage: "active", subscriptionId: sub.id, packageName: sub.package?.name ?? null };
  });
}

export interface MarketingPlan {
  id: string;
  name: string;
  category: "advance" | "addon";
  sessions: number;
  price: number;
  originalPrice: number | null;
  features: string[];
  highlighted: boolean;
}

export async function listMarketingPlansAction(): Promise<ActionResult<MarketingPlan[]>> {
  return runAction(async () => {
    const token = await requireToken();
    const rows = await listPackages(token);
    return (rows as any[])
      .filter((p) => p.is_active)
      .map((p) => ({
        id: p.id,
        name: p.name,
        category: p.category,
        sessions: p.sessions_count,
        price: p.price,
        originalPrice: p.original_price ?? null,
        features: p.features ?? [],
        highlighted: p.highlighted ?? false,
      }));
  });
}

export async function purchasePlanAction(packageId: string): Promise<ActionResult<{ subscriptionId: string }>> {
  return runAction(async () => {
    const token = await requireToken();
    const sub = await purchaseMyPlan(token, packageId);
    return { subscriptionId: sub.id };
  });
}

export async function activatePlanAction(subscriptionId: string, startDate: string): Promise<ActionResult<null>> {
  return runAction(async () => {
    const token = await requireToken();
    await activateMyPlan(token, subscriptionId, startDate);
    return null;
  });
}

export async function submitOnboardingAction(input: OnboardingInput): Promise<ActionResult<null>> {
  return runAction(async () => {
    const token = await requireToken();
    await submitOnboarding(token, input);
    return null;
  });
}

export async function findDemoSlotsAction(input: {
  date: string;
  preferredTime?: string;
  genderPreference?: "male" | "female" | "other";
}): Promise<ActionResult<DemoSlotOption[]>> {
  return runAction(async () => {
    const token = await requireToken();
    return findDemoSlots(token, input);
  });
}

export async function confirmDemoBookingAction(coachId: string, slotStart: string): Promise<ActionResult<{ bookingId: string }>> {
  return runAction(async () => {
    const token = await requireToken();
    const bookingId = await confirmDemoBooking(token, coachId, slotStart);
    return { bookingId };
  });
}

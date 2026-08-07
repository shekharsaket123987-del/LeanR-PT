"use server";

import { getAccessToken } from "@/lib/supabase/server-client";
import { ActionResult, runAction } from "./action-result";
import { getMyLatestSubscription, activateMyPlan } from "@/lib/services/planPurchase.service";
import { getMyOnboarding, submitOnboarding, OnboardingInput } from "@/lib/services/onboarding.service";
import { getMyActiveRecurringSlots } from "@/lib/services/scheduling.service";
import { listPackages } from "@/lib/services/packages.service";
import { findDemoSlots, confirmDemoBooking, getMyLatestDemoSession, DemoSessionSummary } from "@/lib/services/demoBooking.service";

async function requireToken(): Promise<string> {
  const token = await getAccessToken();
  if (!token) throw new Error("Not authenticated");
  return token;
}

export type ClientJourneyStage =
  | "marketing"
  | "demo_booked"
  | "demo_completed"
  | "awaiting_activation"
  | "onboarding"
  | "slot_selection"
  | "active";

export interface ClientJourneyState {
  stage: ClientJourneyStage;
  subscriptionId: string | null;
  packageName: string | null;
  /** Only populated for demo_booked/demo_completed -- the client's most
   * recent demo booking, auto-assigned coach and all. */
  demoSession: DemoSessionSummary | null;
}

/** Decides which experience client/dashboard renders -- the single gate
 * described in the plan, walking purchase -> activation -> onboarding ->
 * slot selection -> the real dashboard. Each stage reuses an existing,
 * already-verified read (getMyActiveRecurringSlots, getMyOnboarding).
 * Demo stages are checked only once a client has no active/pending
 * subscription -- a demo is a pre-subscription waypoint, not something
 * that coexists with (or blocks) an actual paid plan. */
export async function getMyJourneyStateAction(): Promise<ActionResult<ClientJourneyState>> {
  return runAction(async () => {
    const token = await requireToken();
    const sub: any = await getMyLatestSubscription(token);

    if (sub) {
      if (sub.status === "awaiting_activation") {
        return { stage: "awaiting_activation", subscriptionId: sub.id, packageName: sub.package?.name ?? null, demoSession: null };
      }
      if (sub.status === "active") {
        const onboarding = await getMyOnboarding(token);
        if (!onboarding) return { stage: "onboarding", subscriptionId: sub.id, packageName: sub.package?.name ?? null, demoSession: null };

        const slots = await getMyActiveRecurringSlots(token);
        if (!slots || slots.length === 0) {
          return { stage: "slot_selection", subscriptionId: sub.id, packageName: sub.package?.name ?? null, demoSession: null };
        }
        return { stage: "active", subscriptionId: sub.id, packageName: sub.package?.name ?? null, demoSession: null };
      }
      // paused/inactive with no newer subscription falls through below --
      // treat as if no subscription exists so the client isn't stuck.
    }

    const demoSession = await getMyLatestDemoSession(token);
    if (demoSession) {
      return {
        stage: demoSession.status === "upcoming" ? "demo_booked" : "demo_completed",
        subscriptionId: null,
        packageName: null,
        demoSession,
      };
    }

    return { stage: "marketing", subscriptionId: null, packageName: null, demoSession: null };
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

export interface DemoBookingResult {
  bookingId: string;
  coachName: string;
  coachPhoto: string;
  slotStart: string;
}

/** The client never picks a coach for a demo -- findDemoSlots already
 * ranks candidates (by utilization), so this just takes the top-ranked
 * option and confirms it immediately. No payment step: the demo is free.
 * (The Razorpay demo-payment path in payments.service.ts/payments.actions.ts
 * is left intact but unused by this flow, in case a paid-demo model is
 * wanted again later.) */
export async function bookDemoSessionAction(input: {
  date: string;
  preferredTime?: string;
  genderPreference?: "male" | "female" | "other";
}): Promise<ActionResult<DemoBookingResult>> {
  return runAction(async () => {
    const token = await requireToken();
    const options = await findDemoSlots(token, input);
    if (options.length === 0) {
      throw new Error("No coaches are available for that date or time -- try a different date or time.");
    }
    const top = options[0];
    const bookingId = await confirmDemoBooking(token, top.coachId, top.slotStart);
    return { bookingId, coachName: top.coachName, coachPhoto: top.coachPhoto, slotStart: top.slotStart };
  });
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarClock,
  BadgeCheck,
  Users2,
  Video,
  Sparkles,
  Trophy,
  Star,
  ImagePlus,
  PartyPopper,
  Check,
} from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import { MarketingPlan } from "@/lib/actions/client-journey.actions";
import { createPackagePurchaseOrderAction } from "@/lib/actions/payments.actions";
import { useRazorpayCheckout } from "@/components/shared/useRazorpayCheckout";
import { isFailure } from "@/lib/actions/action-result";

const WHY_LEANR = [
  { icon: BadgeCheck, title: "Certified Personal Trainers", description: "Every coach is certified and vetted before joining LeanR." },
  { icon: Users2, title: "Experienced Coaches", description: "Years of real coaching experience across strength, weight loss, and rehab." },
  { icon: Trophy, title: "Client Transformations", description: "Real results from clients who stuck with their plan." },
  { icon: Video, title: "Live One-to-One PT Sessions", description: "Real-time coaching over live video, never pre-recorded." },
  { icon: CalendarClock, title: "Flexible Scheduling", description: "Pick the days and times that fit your week." },
  { icon: Sparkles, title: "Personalized Coaching", description: "Your plan adapts to your goals, not the other way around." },
  { icon: Star, title: "Success Stories", description: "Hundreds of clients hitting their fitness goals." },
  { icon: ImagePlus, title: "Before & After Transformations", description: "See what consistent coaching actually looks like." },
];

export default function PlansMarketingClient({ plans }: { plans: MarketingPlan[] }) {
  const router = useRouter();
  const { openCheckout } = useRazorpayCheckout();
  const [purchasingId, setPurchasingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [purchasedPlan, setPurchasedPlan] = useState<MarketingPlan | null>(null);

  // Creates the Razorpay order server-side, then opens Checkout for the
  // client to actually pay. The congratulations modal (and the subscription
  // itself) only appears once verifyPaymentAction confirms the signature
  // server-side inside useRazorpayCheckout's handler -- never on the
  // client's say-so. Redirect happens only after the client dismisses that
  // modal (continueToActivation), not immediately on payment success.
  async function purchase(plan: MarketingPlan) {
    setPurchasingId(plan.id);
    setError("");
    const orderResult = await createPackagePurchaseOrderAction(plan.id);
    if (isFailure(orderResult)) {
      setPurchasingId(null);
      setError(orderResult.error.message);
      return;
    }
    openCheckout(
      orderResult.data,
      { name: "LEANR", description: plan.name },
      {
        onSuccess: () => {
          setPurchasingId(null);
          setPurchasedPlan(plan);
        },
        onError: (message) => {
          setPurchasingId(null);
          setError(message);
        },
        onDismiss: () => setPurchasingId(null),
      }
    );
  }

  function continueToActivation() {
    setPurchasedPlan(null);
    router.push("/client/dashboard");
    router.refresh();
  }

  return (
    <>
      {error && <p className="mb-4 text-sm text-red-400">{error}</p>}

      <Card className="mb-8 flex flex-col items-center gap-4 p-6 text-center sm:flex-row sm:justify-between sm:text-left">
        <div>
          <p className="text-sm font-bold">Not sure yet?</p>
          <p className="mt-1 text-xs text-white/50">Try a free demo session with a coach before committing to a plan.</p>
        </div>
        <Button variant="outline" onClick={() => router.push("/client/demo-booking")}>
          Book Free Demo Session
        </Button>
      </Card>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        {plans.map((p) => {
          const savings = p.originalPrice ? p.originalPrice - p.price : 0;
          return (
            <Card key={p.id} className={`flex flex-col p-6 ${p.highlighted ? "border-2 border-brand-yellow" : ""}`}>
              {p.highlighted && <Badge variant="yellow" className="mb-3 w-fit">Most Popular</Badge>}
              <p className="text-display text-xl font-bold italic">{p.name}</p>
              <p className="mt-1 text-sm text-white/50">{p.sessions} Live Personal Training Sessions</p>
              <div className="mt-4 flex items-baseline gap-2">
                <span className="text-display text-3xl font-bold italic">₹{p.price.toLocaleString("en-IN")}</span>
                {p.originalPrice && <span className="text-sm text-white/40 line-through">₹{p.originalPrice.toLocaleString("en-IN")}</span>}
              </div>
              {savings > 0 && <p className="mt-1 text-xs font-bold text-emerald-400">Save ₹{savings.toLocaleString("en-IN")}</p>}
              {p.features.length > 0 && (
                <ul className="mt-4 flex-1 space-y-1.5">
                  {p.features.map((f) => (
                    <li key={f} className="text-xs text-white/60">
                      • {f}
                    </li>
                  ))}
                </ul>
              )}
              <Button className="mt-6 w-full" loading={purchasingId === p.id} disabled={purchasingId !== null && purchasingId !== p.id} onClick={() => purchase(p)}>
                Purchase Plan
              </Button>
            </Card>
          );
        })}
        {plans.length === 0 && <p className="text-sm text-white/45">No active plans available right now.</p>}
      </div>

      <div className="mt-14">
        <h2 className="text-display mb-6 text-center text-2xl font-bold italic">Why Choose LeanR</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {WHY_LEANR.map((item) => (
            <Card key={item.title} className="p-5">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-brand-yellow/15">
                <item.icon className="h-5 w-5 text-white/70" />
              </div>
              <p className="text-sm font-bold">{item.title}</p>
              <p className="mt-1 text-xs text-white/50">{item.description}</p>
            </Card>
          ))}
        </div>
      </div>

      {purchasedPlan && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" />
          <div className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-bg-elevated p-6 text-center shadow-2xl animate-slide-up">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-yellow/15">
              <PartyPopper className="h-7 w-7" />
            </div>
            <p className="text-display text-2xl font-bold italic">Congratulations!</p>
            <p className="mt-2 text-sm text-white/60">
              You&apos;ve purchased the <span className="font-bold">{purchasedPlan.name}</span>. Wishing you a strong start and every
              success on your transformation journey — your coach is ready to help you get there.
            </p>
            {purchasedPlan.features.length > 0 && (
              <div className="mt-5 rounded-xl bg-white/[0.03] p-4 text-left">
                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-white/40">You now have full access to</p>
                <ul className="space-y-1.5">
                  {purchasedPlan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-white/70">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <Button className="mt-6 w-full" onClick={continueToActivation}>
              Understood
            </Button>
          </div>
        </div>
      )}
    </>
  );
}

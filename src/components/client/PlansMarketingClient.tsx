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
} from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import StubPaymentModal from "@/components/client/StubPaymentModal";
import { MarketingPlan, purchasePlanAction } from "@/lib/actions/client-journey.actions";
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
  const [payingPlan, setPayingPlan] = useState<MarketingPlan | null>(null);
  const [error, setError] = useState("");

  async function onPaymentSuccess() {
    if (!payingPlan) return;
    const result = await purchasePlanAction(payingPlan.id);
    setPayingPlan(null);
    if (isFailure(result)) {
      setError(result.error.message);
      return;
    }
    router.push("/client/dashboard");
  }

  return (
    <>
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      <Card className="mb-8 flex flex-col items-center gap-4 p-6 text-center sm:flex-row sm:justify-between sm:text-left">
        <div>
          <p className="text-sm font-bold">Not sure yet?</p>
          <p className="mt-1 text-xs text-black/50">Try a paid demo session with a coach before committing to a plan.</p>
        </div>
        <Button variant="outline" onClick={() => router.push("/client/demo-booking")}>
          Book a Demo Session
        </Button>
      </Card>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        {plans.map((p) => {
          const savings = p.originalPrice ? p.originalPrice - p.price : 0;
          return (
            <Card key={p.id} className={`flex flex-col p-6 ${p.highlighted ? "border-2 border-brand-yellow" : ""}`}>
              {p.highlighted && <Badge variant="yellow" className="mb-3 w-fit">Most Popular</Badge>}
              <p className="text-display text-xl font-bold italic">{p.name}</p>
              <p className="mt-1 text-sm text-black/50">{p.sessions} Live Personal Training Sessions</p>
              <div className="mt-4 flex items-baseline gap-2">
                <span className="text-display text-3xl font-bold italic">₹{p.price.toLocaleString("en-IN")}</span>
                {p.originalPrice && <span className="text-sm text-black/40 line-through">₹{p.originalPrice.toLocaleString("en-IN")}</span>}
              </div>
              {savings > 0 && <p className="mt-1 text-xs font-bold text-emerald-600">Save ₹{savings.toLocaleString("en-IN")}</p>}
              {p.features.length > 0 && (
                <ul className="mt-4 flex-1 space-y-1.5">
                  {p.features.map((f) => (
                    <li key={f} className="text-xs text-black/60">
                      • {f}
                    </li>
                  ))}
                </ul>
              )}
              <Button className="mt-6 w-full" onClick={() => setPayingPlan(p)}>
                Purchase Plan
              </Button>
            </Card>
          );
        })}
        {plans.length === 0 && <p className="text-sm text-black/45">No active plans available right now.</p>}
      </div>

      <div className="mt-14">
        <h2 className="text-display mb-6 text-center text-2xl font-bold italic">Why Choose LeanR</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {WHY_LEANR.map((item) => (
            <Card key={item.title} className="p-5">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-brand-yellow/15">
                <item.icon className="h-5 w-5 text-black/70" />
              </div>
              <p className="text-sm font-bold">{item.title}</p>
              <p className="mt-1 text-xs text-black/50">{item.description}</p>
            </Card>
          ))}
        </div>
      </div>

      {payingPlan && (
        <StubPaymentModal
          open={!!payingPlan}
          onClose={() => setPayingPlan(null)}
          amountRupees={payingPlan.price}
          title={`Purchase ${payingPlan.name}`}
          onSuccess={onPaymentSuccess}
        />
      )}
    </>
  );
}

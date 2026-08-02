import { Check, Info } from "lucide-react";
import { packages } from "@/lib/mock-data";
import Button from "../ui/Button";
import { cn } from "@/lib/utils";

export default function PricingSection() {
  return (
    <section id="pricing" className="bg-[#FAFAFA] py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="mb-4 text-center">
          <span className="text-xs font-bold uppercase tracking-widest text-black/40">Packages</span>
          <h2 className="text-display mt-2 text-4xl font-bold italic tracking-tight sm:text-5xl">
            Simple, Honest Pricing
          </h2>
        </div>
        <div className="mx-auto mb-14 flex max-w-xl items-center gap-2 rounded-xl bg-brand-yellow/15 px-4 py-3 text-center">
          <Info className="h-4 w-4 shrink-0 text-black/60" />
          <p className="text-xs font-medium text-black/60">
            Your assigned coach stays the same for the entire duration of your plan — every package included.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {packages.map((pkg) => (
            <div
              key={pkg.id}
              className={cn(
                "flex flex-col rounded-2xl border p-6",
                pkg.highlighted ? "border-black bg-black text-white shadow-glow" : "border-black/[0.08] bg-white"
              )}
            >
              {pkg.highlighted && (
                <span className="mb-3 inline-block w-fit rounded-full bg-brand-yellow px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-black">
                  Most Popular
                </span>
              )}
              <p className={cn("text-display text-xl font-bold italic", pkg.highlighted ? "text-white" : "text-black")}>
                {pkg.name}
              </p>
              <p className={cn("mt-1 text-xs font-medium", pkg.highlighted ? "text-white/50" : "text-black/40")}>
                {pkg.sessions} PT sessions
              </p>
              <div className="mt-5 flex items-baseline gap-2">
                <span className="text-display text-3xl font-bold italic">₹{pkg.price.toLocaleString("en-IN")}</span>
                {pkg.originalPrice && (
                  <span className={cn("text-sm line-through", pkg.highlighted ? "text-white/40" : "text-black/30")}>
                    ₹{pkg.originalPrice.toLocaleString("en-IN")}
                  </span>
                )}
              </div>
              <ul className="mt-6 flex-1 space-y-3">
                {pkg.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <Check className={cn("mt-0.5 h-4 w-4 shrink-0", pkg.highlighted ? "text-brand-yellow" : "text-black")} />
                    <span className={pkg.highlighted ? "text-white/70" : "text-black/60"}>{f}</span>
                  </li>
                ))}
              </ul>
              <Button href="/login/client" variant={pkg.highlighted ? "primary" : "secondary"} className="mt-7 w-full">
                Get Started
              </Button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

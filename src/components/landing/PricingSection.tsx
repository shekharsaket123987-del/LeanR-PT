import { Check, Info } from "lucide-react";
import Button from "../ui/Button";
import FlipSection from "../ui/FlipSection";
import GlassSectionPanel from "../ui/GlassSectionPanel";
import TiltCard from "../ui/TiltCard";
import { cn } from "@/lib/utils";

export interface PublicPackage {
  id: string;
  name: string;
  sessions: number;
  price: number;
  originalPrice: number | null;
  features: string[];
  highlighted: boolean;
}

export default function PricingSection({ packages }: { packages: PublicPackage[] }) {
  return (
    <section id="pricing" className="relative min-h-screen overflow-hidden pt-24 pb-4 md:pt-28">
      <FlipSection className="container-px">
        <GlassSectionPanel className="p-6 noise sm:p-9">
          <div className="mx-auto max-w-7xl">
            <div className="mb-4 text-center">
              <span className="text-xs font-bold uppercase tracking-widest text-brand-yellow/70">Packages</span>
              <h2 className="text-display mt-2 text-4xl tracking-tight text-white sm:text-5xl">
                Simple, Honest Pricing
              </h2>
            </div>
            <div className="mx-auto mb-14 flex max-w-xl items-center gap-2 rounded-xl bg-brand-yellow/10 px-4 py-3 text-center">
              <Info className="h-4 w-4 shrink-0 text-brand-yellow" />
              <p className="text-xs font-medium text-white/60">
                Your assigned coach stays the same for the entire duration of your plan — every package included.
              </p>
            </div>

            {packages.length === 0 ? (
              <p className="text-center text-sm text-white/45">Pricing is being updated -- check back shortly.</p>
            ) : (
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
                {packages.map((pkg) => (
                  <TiltCard key={pkg.id}>
                    <div
                      className={cn(
                        "flex h-full flex-col rounded-2xl p-6 transition-shadow duration-300",
                        pkg.highlighted ? "glass-accent text-white hover:shadow-[0_0_60px_-15px_rgba(245,217,10,0.65)]" : "glass-strong hover:shadow-[0_0_40px_-15px_rgba(245,217,10,0.4)]"
                      )}
                    >
                      {pkg.highlighted && (
                        <span className="mb-3 inline-block w-fit rounded-full bg-brand-yellow px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-black">
                          Most Popular
                        </span>
                      )}
                      <p className="text-display text-xl text-white">
                        {pkg.name}
                      </p>
                      <p className={cn("mt-1 text-xs font-medium", pkg.highlighted ? "text-white/50" : "text-white/40")}>
                        {pkg.sessions} PT sessions
                      </p>
                      <div className="mt-5 flex items-baseline gap-2">
                        <span className="text-display text-3xl text-white">₹{pkg.price.toLocaleString("en-IN")}</span>
                        {pkg.originalPrice && (
                          <span className={cn("text-sm line-through", pkg.highlighted ? "text-white/40" : "text-white/30")}>
                            ₹{pkg.originalPrice.toLocaleString("en-IN")}
                          </span>
                        )}
                      </div>
                      <ul className="mt-6 flex-1 space-y-3">
                        {pkg.features.map((f) => (
                          <li key={f} className="flex items-start gap-2 text-sm">
                            <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-yellow" />
                            <span className={pkg.highlighted ? "text-white/70" : "text-white/60"}>{f}</span>
                          </li>
                        ))}
                      </ul>
                      <Button href="/signup" variant={pkg.highlighted ? "primary" : "secondary"} className="mt-7 w-full">
                        Get Started
                      </Button>
                    </div>
                  </TiltCard>
                ))}
              </div>
            )}
          </div>
        </GlassSectionPanel>
      </FlipSection>
    </section>
  );
}

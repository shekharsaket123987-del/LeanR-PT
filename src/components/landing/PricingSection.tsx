"use client";

import { useMemo, useRef, useState } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { Check, Info } from "lucide-react";
import Button from "../ui/Button";
import FlipSection from "../ui/FlipSection";
import GlassCard from "../ui/GlassCard";
import GlassSectionPanel from "../ui/GlassSectionPanel";
import Reveal from "../ui/Reveal";
import SectionTag from "../ui/SectionTag";
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

function PackageCard({
  pkg,
  index,
  activeIndex,
  onFocus,
  onHoverEnter,
  onHoverLeave,
}: {
  pkg: PublicPackage;
  index: number;
  activeIndex: number;
  onFocus: () => void;
  onHoverEnter: () => void;
  onHoverLeave: () => void;
}) {
  const isActive = index === activeIndex;

  const ref = useRef<HTMLDivElement>(null);
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const rotateX = useSpring(useTransform(my, [-0.5, 0.5], [6, -6]), { stiffness: 220, damping: 22 });
  const rotateY = useSpring(useTransform(mx, [-0.5, 0.5], [-6, 6]), { stiffness: 220, damping: 22 });

  function handleMove(e: React.MouseEvent<HTMLDivElement>) {
    if (!isActive) return;
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    mx.set((e.clientX - rect.left) / rect.width - 0.5);
    my.set((e.clientY - rect.top) / rect.height - 0.5);
  }
  function handleLeave() {
    mx.set(0);
    my.set(0);
    onHoverLeave();
  }

  return (
    <div style={{ zIndex: isActive ? 10 : 1, position: "relative" }} className="h-full">
      <motion.div
        animate={{ scale: isActive ? 1.05 : 0.95, opacity: isActive ? 1 : 0.82, y: isActive ? -8 : 0 }}
        transition={{ type: "spring", stiffness: 220, damping: 26 }}
        className="h-full"
      >
        <div
          ref={ref}
          onMouseMove={handleMove}
          onMouseEnter={onHoverEnter}
          onMouseLeave={handleLeave}
          onClick={onFocus}
          className="h-full cursor-pointer [perspective:1000px]"
        >
          <motion.div
            style={{ rotateX: isActive ? rotateX : 0, rotateY: isActive ? rotateY : 0, transformStyle: "preserve-3d" }}
            className="h-full"
          >
            <GlassCard
              variant={isActive ? "yellow" : "default"}
              glow={isActive}
              className={cn(
                "relative flex h-full flex-col p-6 transition-[border-color,box-shadow] duration-300",
                isActive && "border-brand-yellow/50 shadow-[0_0_90px_-15px_rgba(245,217,10,0.6)]"
              )}
            >
              {pkg.highlighted && (
                <span className="absolute -top-3 left-1/2 w-fit -translate-x-1/2 rounded-full bg-brand-yellow px-3.5 py-1 text-[10px] font-bold uppercase tracking-wider text-black">
                  Most Popular
                </span>
              )}
              <p className="text-display text-xl font-bold italic text-white">{pkg.name}</p>
              <p className={cn("mt-1 text-xs font-medium", isActive ? "text-white/50" : "text-white/40")}>
                {pkg.sessions} PT sessions
              </p>
              <div className="mt-5 flex items-baseline gap-2">
                <span className="text-display text-3xl font-bold italic text-white">
                  ₹{pkg.price.toLocaleString("en-IN")}
                </span>
                {pkg.originalPrice && (
                  <span className={cn("text-sm line-through", isActive ? "text-white/40" : "text-white/30")}>
                    ₹{pkg.originalPrice.toLocaleString("en-IN")}
                  </span>
                )}
              </div>
              <ul className="mt-6 flex-1 space-y-3">
                {pkg.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <Check className={cn("mt-0.5 h-4 w-4 shrink-0", isActive ? "text-brand-yellow" : "text-white")} />
                    <span className={isActive ? "text-white/70" : "text-white/60"}>{f}</span>
                  </li>
                ))}
              </ul>
              <Button href="/signup" variant={isActive ? "primary" : "secondary"} className="mt-7 w-full">
                Get Started
              </Button>
            </GlassCard>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
}

export default function PricingSection({ packages }: { packages: PublicPackage[] }) {
  const defaultIndex = useMemo(() => {
    const i = packages.findIndex((p) => p.highlighted);
    return i === -1 ? 0 : i;
  }, [packages]);

  const [activeIndex, setActiveIndex] = useState(defaultIndex);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const displayIndex = hoverIndex ?? activeIndex;

  return (
    <section id="pricing" className="relative min-h-screen overflow-hidden pt-24 pb-4 md:pt-28">
      <FlipSection className="container-px">
        <GlassSectionPanel className="p-6 noise sm:p-9">
          <Reveal className="mx-auto max-w-2xl text-center">
            <SectionTag className="mx-auto">Packages</SectionTag>
            <h2 className="text-display mt-3 text-3xl sm:text-4xl md:text-5xl leading-[0.95]">
              SIMPLE, HONEST <span className="text-brand-yellow italic-skew">PRICING</span>
            </h2>
          </Reveal>

          <Reveal delay={0.15} className="mx-auto mb-10 mt-6 flex max-w-xl items-center gap-2 rounded-xl bg-brand-yellow/15 px-4 py-3 text-center">
            <Info className="h-4 w-4 shrink-0 text-white/60" />
            <p className="text-xs font-medium text-white/60">
              Your assigned coach stays the same for the entire duration of your plan — every package included.
            </p>
          </Reveal>

          {packages.length === 0 ? (
            <p className="text-center text-sm text-white/45">Pricing is being updated -- check back shortly.</p>
          ) : (
            <div className="grid grid-cols-1 gap-6 pt-3 sm:grid-cols-2 lg:grid-cols-4" style={{ perspective: 1800 }}>
              {packages.map((pkg, i) => (
                <PackageCard
                  key={pkg.id}
                  pkg={pkg}
                  index={i}
                  activeIndex={displayIndex}
                  onFocus={() => setActiveIndex(i)}
                  onHoverEnter={() => setHoverIndex(i)}
                  onHoverLeave={() => setHoverIndex(null)}
                />
              ))}
            </div>
          )}
        </GlassSectionPanel>
      </FlipSection>
    </section>
  );
}

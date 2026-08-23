"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import Logo from "@/components/shared/Logo";
import Reveal from "@/components/ui/Reveal";
import SectionTag from "@/components/ui/SectionTag";
import { cn } from "@/lib/utils";
import { PORTAL_LIST, type Portal } from "@/lib/portals";

function PortalCard({ portal, delay }: { portal: Portal; delay: number }) {
  const [hovered, setHovered] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const rotateX = useSpring(useTransform(my, [-0.5, 0.5], [8, -8]), { stiffness: 220, damping: 20 });
  const rotateY = useSpring(useTransform(mx, [-0.5, 0.5], [-8, 8]), { stiffness: 220, damping: 20 });

  function handleMove(e: React.MouseEvent<HTMLDivElement>) {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    mx.set((e.clientX - rect.left) / rect.width - 0.5);
    my.set((e.clientY - rect.top) / rect.height - 0.5);
  }

  function handleLeave() {
    mx.set(0);
    my.set(0);
    setHovered(false);
  }

  const Icon = portal.Icon;

  return (
    <Reveal delay={delay} className="h-full">
      <Link href={`/login/${portal.slug}`} className="block h-full">
        <div style={{ perspective: 1400 }} className="h-full">
          <motion.div
            animate={{ scale: hovered ? 1.03 : 1, z: hovered ? 40 : 0 }}
            transition={{ type: "spring", stiffness: 220, damping: 26 }}
            style={{ transformStyle: "preserve-3d" }}
            className="h-full"
          >
            <div ref={ref} onMouseEnter={() => setHovered(true)} onMouseMove={handleMove} onMouseLeave={handleLeave} className="h-full cursor-pointer [perspective:1000px]">
              <motion.div style={{ rotateX: hovered ? rotateX : 0, rotateY: hovered ? rotateY : 0, transformStyle: "preserve-3d" }} className="h-full">
                <div
                  className={cn(
                    "relative flex h-full flex-col items-center overflow-hidden rounded-2xl p-6 text-center transition-[border-color] duration-300 sm:p-8",
                    hovered ? "glass-strong glow-yellow border-brand-yellow/50" : "glass-strong"
                  )}
                >
                  <div
                    className="flex h-16 w-16 items-center justify-center rounded-2xl shadow-[0_15px_40px_-15px_rgba(0,0,0,0.7)]"
                    style={{ background: `linear-gradient(155deg, ${portal.from}, ${portal.to})` }}
                  >
                    <Icon className="h-9 w-9" />
                  </div>

                  <h3 className="text-display mt-4 text-xl">{portal.heading}</h3>
                  <p className="mt-1.5 text-xs leading-relaxed text-white/60">{portal.tagline}</p>

                  <ul className="mt-4 flex w-full flex-col gap-1.5 border-t border-white/10 pt-4 text-left">
                    {portal.bullets.map((b) => (
                      <li key={b} className="flex items-start gap-2 text-[11px] text-white/55">
                        <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-brand-yellow" />
                        {b}
                      </li>
                    ))}
                  </ul>

                  <span className="mt-5 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-brand-yellow">
                    Continue <span aria-hidden>→</span>
                  </span>
                </div>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </Link>
    </Reveal>
  );
}

export default function LoginPortalPickerPage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-surface">
      <div className="pointer-events-none absolute -top-32 left-1/2 h-[500px] w-[700px] -translate-x-1/2 rounded-full bg-brand-yellow/10 blur-[140px]" />

      <header className="container-px relative pt-8">
        <Logo height={30} />
      </header>

      <main className="container-px relative py-16">
        <div className="mx-auto max-w-5xl">
          <Reveal className="mx-auto max-w-2xl text-center">
            <SectionTag className="mx-auto">Member Access</SectionTag>
            <h1 className="text-display mt-3 text-3xl leading-[0.95] sm:text-4xl md:text-5xl">
              CHOOSE YOUR <span className="italic-skew text-brand-yellow">PORTAL</span>
            </h1>
            <p className="mt-2 text-sm text-white/60">Sign in to the workspace built for your role.</p>
          </Reveal>

          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3" style={{ perspective: 1800 }}>
            {PORTAL_LIST.map((portal, i) => (
              <PortalCard key={portal.slug} portal={portal} delay={i * 0.08} />
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}

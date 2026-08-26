"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { motion, useMotionValue, useScroll, useSpring, useTransform } from "framer-motion";
import { ShieldCheck, CalendarCheck, Headset, ArrowRight } from "lucide-react";
import Button from "../ui/Button";
import FlipSection from "../ui/FlipSection";
import GlassCard from "../ui/GlassCard";
import GlassSectionPanel from "../ui/GlassSectionPanel";
import Reveal from "../ui/Reveal";
import SectionTag from "../ui/SectionTag";
import { smoothScrollTo } from "@/lib/utils";

const COACH_PHOTO = "/ChatGPT Image Aug 22, 2026, 04_11_22 PM.png";

function TravelingLight() {
  return (
    <>
      <motion.div
        className="absolute inset-0 rounded-[100%]"
        animate={{ opacity: [0.35, 0.75, 0.35], scale: [1, 1.035, 1] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        style={{ boxShadow: "0 0 46px 8px rgba(245,217,10,0.35)" }}
      />
      <motion.div className="absolute inset-0" animate={{ rotate: 360 }} transition={{ duration: 6, repeat: Infinity, ease: "linear" }}>
        <span className="absolute left-1/2 top-0 h-2.5 w-2.5 -translate-x-1/2 rounded-full bg-brand-yellow shadow-[0_0_16px_4px_rgba(245,217,10,0.8)]" />
      </motion.div>
    </>
  );
}

function MatIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 40" className={className}>
      <rect x="2" y="4" width="60" height="32" rx="8" fill="#111110" stroke="white" strokeWidth="2" />
      <circle cx="15" cy="20" r="9" fill="none" stroke="white" strokeOpacity="0.25" strokeWidth="1.5" />
      <circle cx="15" cy="20" r="5" fill="none" stroke="white" strokeOpacity="0.25" strokeWidth="1.5" />
      <text x="42" y="24" textAnchor="middle" fontSize="8" fill="#f5d90a" fontWeight="700">LEANR</text>
    </svg>
  );
}

function DumbbellIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 56 24" className={className}>
      <rect x="2" y="6" width="10" height="12" rx="2.5" fill="#f5d90a" />
      <rect x="44" y="6" width="10" height="12" rx="2.5" fill="#f5d90a" />
      <rect x="12" y="10" width="32" height="4" rx="1" fill="white" />
    </svg>
  );
}

function BottleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 44" className={className}>
      <rect x="7" y="1" width="10" height="5" rx="1.5" fill="#f5d90a" />
      <rect x="4" y="7" width="16" height="35" rx="6" fill="#111110" stroke="white" strokeWidth="2" />
      <rect x="6.5" y="19" width="11" height="14" rx="2" fill="white" fillOpacity="0.08" />
    </svg>
  );
}

function EquipmentCluster() {
  return (
    <div className="relative h-24 w-56">
      <div className="absolute left-[16%] top-[72%] -translate-x-1/2 -translate-y-1/2">
        <motion.div animate={{ y: [0, -6, 0], rotate: [-3, 3, -3] }} transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}>
          <MatIcon className="h-10 w-16 drop-shadow-[0_10px_18px_rgba(0,0,0,0.55)]" />
        </motion.div>
      </div>
      <div className="absolute left-[52%] top-[60%] -translate-x-1/2 -translate-y-1/2">
        <motion.div animate={{ y: [0, -7, 0] }} transition={{ duration: 4.2, delay: 0.4, repeat: Infinity, ease: "easeInOut" }}>
          <DumbbellIcon className="h-6 w-14 drop-shadow-[0_10px_18px_rgba(0,0,0,0.55)]" />
        </motion.div>
      </div>
      <div className="absolute left-[84%] top-[38%] -translate-x-1/2 -translate-y-1/2">
        <motion.div animate={{ y: [0, -8, 0] }} transition={{ duration: 3.6, delay: 0.7, repeat: Infinity, ease: "easeInOut" }}>
          <BottleIcon className="h-11 w-6 drop-shadow-[0_10px_18px_rgba(0,0,0,0.55)]" />
        </motion.div>
      </div>
    </div>
  );
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function CoachPhone() {
  const ref = useRef<HTMLDivElement>(null);
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const rotateX = useSpring(useTransform(my, [-0.5, 0.5], [10, -10]), { stiffness: 150, damping: 18 });
  const rotateY = useSpring(useTransform(mx, [-0.5, 0.5], [-14, 6]), { stiffness: 150, damping: 18 });
  const [phase, setPhase] = useState<"front" | "toBack" | "back" | "toFront">("front");
  const floating = phase === "front";
  const showingBack = phase === "toBack" || phase === "back";

  function handleMove(e: React.MouseEvent<HTMLDivElement>) {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    mx.set((e.clientX - rect.left) / rect.width - 0.5);
    my.set((e.clientY - rect.top) / rect.height - 0.5);
  }
  function handleLeave() {
    mx.set(0);
    my.set(0);
  }

  async function handleClick() {
    if (phase !== "front") return;
    setPhase("toBack");
    await wait(900);
    setPhase("back");
    await wait(1400);
    setPhase("toFront");
    await wait(900);
    setPhase("front");
  }

  return (
    <div
      ref={ref}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      aria-label="Tap to rotate the phone and see weekly progress"
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") handleClick();
      }}
      className="cursor-pointer select-none"
      style={{ perspective: 1200 }}
    >
      <motion.div
        animate={floating ? { y: [0, -10, 0], rotateZ: [-2, 2, -2] } : { y: 0, rotateZ: 0 }}
        transition={floating ? { duration: 5, repeat: Infinity, ease: "easeInOut" } : { duration: 0.4 }}
        style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}
      >
        <motion.div
          animate={{ rotateY: showingBack ? 180 : 0 }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
          style={{ transformStyle: "preserve-3d" }}
          className="relative w-40"
        >
          <div
            className="relative overflow-hidden rounded-[1.8rem] border-2 border-brand-yellow/40 bg-[#0a0a0a] p-2 shadow-[0_0_45px_-10px_rgba(245,217,10,0.6)]"
            style={{ backfaceVisibility: "hidden", transform: "translateZ(30px)" }}
          >
            <div className="absolute left-1/2 top-1.5 z-10 h-1.5 w-10 -translate-x-1/2 rounded-full bg-black" />
            <div className="relative overflow-hidden rounded-[1.3rem] bg-gradient-to-b from-[#141310] to-black px-3 pb-4 pt-6">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(245,217,10,0.12),transparent_60%)]" />
              <p className="text-display relative text-center text-sm text-brand-yellow">LEANR</p>
              <p className="relative mt-3 text-center text-[9px] uppercase tracking-wider text-white/50">Your Coach</p>
              <div className="relative mx-auto mt-2 h-12 w-12 overflow-hidden rounded-full border border-brand-yellow/50">
                <Image src={COACH_PHOTO} alt="Your LeanR coach" fill sizes="48px" className="object-cover object-[50%_18%]" />
              </div>
              <div className="relative mt-3 flex items-center justify-center gap-1.5 text-[10px] font-semibold text-white/80">
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-brand-yellow text-[9px] text-black">✓</span>
                Session Confirmed
              </div>
              <p className="relative mt-1 text-center text-[9px] text-white/40">Today · 6:00 PM</p>
              <button className="relative mt-3 w-full rounded-full bg-brand-yellow py-1.5 text-[10px] font-bold text-black">Join Session</button>
              <div className="relative mt-3 flex items-center justify-between rounded-lg glass-faint px-2 py-1.5 text-[9px] text-white/60">
                <span>Progress</span>
                <span className="font-semibold text-brand-yellow">68%</span>
              </div>
            </div>
          </div>

          <div
            className="absolute inset-0 overflow-hidden rounded-[1.8rem] border-2 border-brand-yellow/40 bg-[#0a0a0a] p-2 shadow-[0_0_45px_-10px_rgba(245,217,10,0.6)]"
            style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg) translateZ(30px)" }}
          >
            <div className="absolute left-1/2 top-1.5 z-10 h-1.5 w-10 -translate-x-1/2 rounded-full bg-black" />
            <div className="relative h-full overflow-hidden rounded-[1.3rem] bg-gradient-to-b from-[#141310] to-black px-3 pb-4 pt-6">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(245,217,10,0.12),transparent_60%)]" />
              <p className="text-display relative text-center text-sm text-brand-yellow">LEANR</p>
              <p className="relative mt-3 text-center text-[9px] uppercase tracking-wider text-white/50">This Week</p>
              <div className="relative mt-4 flex h-14 items-end justify-center gap-2">
                {[40, 65, 50, 90, 70, 30, 55].map((h, i) => (
                  <div key={i} className="w-2 rounded-full bg-brand-yellow/80" style={{ height: `${h}%` }} />
                ))}
              </div>
              <div className="relative mt-4 flex items-center justify-between rounded-lg glass-faint px-2 py-1.5 text-[9px] text-white/60">
                <span>Sessions</span>
                <span className="font-semibold text-brand-yellow">3 / 4</span>
              </div>
              <div className="relative mt-1.5 flex items-center justify-between rounded-lg glass-faint px-2 py-1.5 text-[9px] text-white/60">
                <span>Calories Burned</span>
                <span className="font-semibold text-brand-yellow">1,240</span>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>

      <p className="mt-3 text-center text-[9px] uppercase tracking-wider text-white/30">Tap phone for weekly progress</p>
    </div>
  );
}

function CTAScene({ sectionRef }: { sectionRef: React.RefObject<HTMLElement | null> }) {
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ["start end", "end start"] });
  const z = useTransform(scrollYProgress, [0, 0.5, 1], [-70, 0, 70]);
  const rotateY = useTransform(scrollYProgress, [0, 1], [-6, 6]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 50 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -15% 0px" }}
      transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
      className="relative hidden h-full min-h-[22rem] items-center justify-center xl:flex"
      style={{ perspective: 1400, z, rotateY }}
    >
      <div className="absolute bottom-6 left-1/2 h-40 w-64 -translate-x-1/2">
        <div className="absolute inset-0 rounded-[100%] border border-brand-yellow/30" />
        <div className="absolute inset-4 rounded-[100%] border border-brand-yellow/10" />
        <TravelingLight />
      </div>
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_50%_60%,rgba(245,217,10,0.14),transparent_65%)]" />
      <div className="relative flex flex-col items-center gap-6">
        <CoachPhone />
        <EquipmentCluster />
      </div>
    </motion.div>
  );
}

export default function ReadyWhenYouAre() {
  const formRef = useRef<HTMLDivElement>(null);
  const sectionRef = useRef<HTMLElement>(null);

  return (
    <section id="book-demo" ref={sectionRef} className="relative min-h-screen overflow-hidden pt-24 pb-4 md:pt-28">
      <FlipSection className="container-px">
        <Reveal>
          <GlassSectionPanel className="p-6 noise sm:p-9">
            <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-brand-yellow/20 blur-[100px]" />
            <div className="pointer-events-none absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-brand-yellow/10 blur-[100px]" />

            <div className="relative grid gap-8 lg:items-center xl:grid-cols-[1fr_0.85fr_0.95fr]">
              <div>
                <SectionTag>Your Transformation Starts Now</SectionTag>
                <h2 className="text-display mt-4 text-4xl sm:text-5xl md:text-6xl leading-[0.9]">
                  READY
                  <br />
                  <span className="text-brand-yellow italic-skew">WHEN YOU ARE.</span>
                </h2>
                <p className="mt-4 max-w-md text-sm leading-relaxed text-white/65">
                  Book your first session now and take the first step towards a better you.
                </p>
                <div className="mt-5 flex flex-wrap gap-4 text-xs text-white/70">
                  {[
                    { label: "No Commitment", icon: ShieldCheck },
                    { label: "Personalized Guidance", icon: CalendarCheck },
                    { label: "Expert Support", icon: Headset },
                  ].map(({ label, icon: Icon }) => (
                    <div key={label} className="flex items-center gap-1.5">
                      <Icon className="h-4 w-4 shrink-0 text-brand-yellow" />
                      {label}
                    </div>
                  ))}
                </div>
                <div className="mt-5">
                  <Button size="lg" onClick={() => formRef.current && smoothScrollTo(formRef.current, -160)}>
                    Get Started
                    <span aria-hidden>→</span>
                  </Button>
                </div>
              </div>

              <CTAScene sectionRef={sectionRef} />

              <div ref={formRef}>
                <GlassCard className="p-5 sm:p-6">
                  <h3 className="text-display mb-2 text-lg text-white">Start Your Journey</h3>
                  <p className="text-sm leading-relaxed text-white/60">
                    Create your account to book a live 1:1 session with a certified coach — no commitment required
                    for your first assessment.
                  </p>
                  <Button href="/signup" size="lg" className="mt-5 w-full">
                    Continue to Sign Up
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </GlassCard>
              </div>
            </div>
          </GlassSectionPanel>
        </Reveal>
      </FlipSection>
    </section>
  );
}

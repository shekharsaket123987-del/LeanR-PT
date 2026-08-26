"use client";

import { useRef } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import FlipSection from "@/components/ui/FlipSection";
import GlassCard from "@/components/ui/GlassCard";
import GlassSectionPanel from "@/components/ui/GlassSectionPanel";
import Reveal from "@/components/ui/Reveal";
import SectionTag from "@/components/ui/SectionTag";

function SpaceIcon() {
  return (
    <svg viewBox="0 0 40 40" className="h-8 w-8" fill="none">
      <path d="M6 18 L20 7 L34 18" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9 16 V32 H31 V16" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="15" y="23" width="10" height="6" rx="1.5" fill="#f5d90a" />
    </svg>
  );
}

function CoachIcon() {
  return (
    <svg viewBox="0 0 40 40" className="h-8 w-8" fill="none">
      <circle cx="20" cy="13" r="6" stroke="white" strokeWidth="2" />
      <path d="M8 33 C8 24 14 21 20 21 C26 21 32 24 32 33" stroke="white" strokeWidth="2" strokeLinecap="round" />
      <circle cx="20" cy="24" r="2.5" fill="#f5d90a" />
    </svg>
  );
}

function ScheduleIcon() {
  return (
    <svg viewBox="0 0 40 40" className="h-8 w-8" fill="none">
      <rect x="6" y="10" width="22" height="20" rx="2" stroke="white" strokeWidth="2" />
      <path d="M6 16 H28" stroke="white" strokeWidth="2" />
      <path d="M12 7 V12 M22 7 V12" stroke="white" strokeWidth="2" strokeLinecap="round" />
      <circle cx="28" cy="26" r="7" fill="#0c0c0a" stroke="#f5d90a" strokeWidth="2" />
      <path d="M28 22 V26 L31 28" stroke="#f5d90a" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function GoalIcon() {
  return (
    <svg viewBox="0 0 40 40" className="h-8 w-8" fill="none">
      <circle cx="20" cy="20" r="13" stroke="white" strokeWidth="2" />
      <circle cx="20" cy="20" r="8" stroke="white" strokeWidth="2" />
      <circle cx="20" cy="20" r="3" fill="#f5d90a" />
      <path d="M27 8 L33 6 L31 12 Z" fill="#f5d90a" />
    </svg>
  );
}

type Pillar = {
  Icon: () => React.JSX.Element;
  title: string;
  desc: string;
  z: number;
  from: "top-left" | "top-right" | "bottom-left" | "bottom-right";
};

const PILLARS: Pillar[] = [
  { Icon: SpaceIcon, title: "Your Space", desc: "Train from the comfort of your home.", z: 0, from: "top-left" },
  { Icon: CoachIcon, title: "Your Coach", desc: "Expert coaches dedicated to your transformation.", z: 18, from: "top-right" },
  { Icon: ScheduleIcon, title: "Your Schedule", desc: "Flexible timings that fit your lifestyle.", z: 34, from: "bottom-left" },
  { Icon: GoalIcon, title: "Your Goal", desc: "Personalized plans focused on your goals.", z: 50, from: "bottom-right" },
];

function PillarCard({ pillar, index }: { pillar: Pillar; index: number }) {
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
  }

  const entrance =
    pillar.from === "top-left"
      ? { x: -60, y: -40 }
      : pillar.from === "top-right"
      ? { x: 60, y: -40 }
      : pillar.from === "bottom-left"
      ? { x: -60, y: 40 }
      : { x: 60, y: 40 };

  return (
    <div style={{ perspective: 1200 }}>
      <motion.div
        initial={{ opacity: 0, ...entrance, z: -220, scale: 0.8 }}
        whileInView={{ opacity: 1, x: 0, y: 0, z: pillar.z, scale: 1 }}
        viewport={{ once: true, margin: "0px 0px -15% 0px" }}
        transition={{ duration: 1, delay: index * 0.12, ease: [0.16, 1, 0.3, 1] }}
      >
        <div ref={ref} onMouseMove={handleMove} onMouseLeave={handleLeave} className="h-full [perspective:1000px]">
          <motion.div style={{ rotateX, rotateY, transformStyle: "preserve-3d" }} className="h-full">
            <GlassCard
              className="group h-full p-4"
              whileHover={{ y: -6, borderColor: "rgba(245,217,10,0.6)", boxShadow: "0 0 50px -12px rgba(245,217,10,0.45)" }}
              transition={{ type: "spring", stiffness: 260, damping: 20 }}
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-xl glass-faint transition-colors duration-300 group-hover:border-brand-yellow/50">
                <pillar.Icon />
              </div>
              <h3 className="text-display mt-2.5 text-base text-brand-yellow">{pillar.title}</h3>
              <span className="mt-1 block h-px w-8 bg-brand-yellow/60" />
              <p className="mt-1.5 text-xs leading-relaxed text-white/60">{pillar.desc}</p>
            </GlassCard>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
}

export default function WhatIsLeanR() {
  return (
    <section className="relative min-h-screen overflow-hidden pt-24 pb-4 md:pt-28">
      <FlipSection className="container-px">
        <GlassSectionPanel className="p-6 noise sm:p-9">
          <div className="pointer-events-none absolute -right-20 top-1/2 -z-10 h-[26rem] w-[26rem] -translate-y-1/2 rounded-full bg-brand-yellow/10 blur-[110px]" />

          <div className="grid items-center gap-8 lg:grid-cols-[0.85fr_1.15fr]">
            <Reveal>
              <SectionTag>What Is LeanR</SectionTag>
              <h2 className="text-display mt-4 text-3xl sm:text-4xl leading-[0.95]">
                WHAT IS
                <br />
                <span className="text-brand-yellow text-glow">LEANR?</span>
              </h2>
              <span className="mt-3 block h-px w-14 bg-brand-yellow" />
              <p className="mt-4 max-w-md text-sm leading-relaxed text-white/65">
                LeanR is an online 1:1 personal training platform that connects you with expert coaches for
                customized workouts, real-time guidance and measurable results.
              </p>
              <p className="mt-2 max-w-md text-sm leading-relaxed text-white/65">
                Train from the comfort of your home with flexible scheduling, professional support and a program
                built around your goals.
              </p>
            </Reveal>

            <div className="grid gap-4 sm:grid-cols-2" style={{ transformStyle: "preserve-3d" }}>
              {PILLARS.map((pillar, i) => (
                <PillarCard key={pillar.title} pillar={pillar} index={i} />
              ))}
            </div>
          </div>
        </GlassSectionPanel>
      </FlipSection>
    </section>
  );
}

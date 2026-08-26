"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { PackageSearch, UserCheck2, CalendarClock, Video, LineChart } from "lucide-react";
import FlipSection from "../ui/FlipSection";
import GlassCard from "../ui/GlassCard";
import GlassSectionPanel from "../ui/GlassSectionPanel";
import Reveal from "../ui/Reveal";
import SectionTag from "../ui/SectionTag";

const steps = [
  { icon: PackageSearch, title: "Choose Package", description: "Pick LeanR Advance or a PT Add-on tier that fits your goals." },
  { icon: UserCheck2, title: "Choose Coach", description: "Get matched with a certified coach who stays with you the whole way." },
  { icon: CalendarClock, title: "Pick Schedule", description: "Choose recurring slots that fit your week — as simple or custom as you need." },
  { icon: Video, title: "Join Live Session", description: "Train 1:1 over live video — real-time form checks, real coaching." },
  { icon: LineChart, title: "Track Progress", description: "See your streak, session history, and coach remarks after every workout." },
];

export default function HowItWorks() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 75%", "end 60%"] });
  const lineScale = useTransform(scrollYProgress, [0, 1], [0, 1]);

  return (
    <section id="how-it-works" className="relative min-h-screen overflow-hidden pt-24 pb-4 md:pt-28">
      <FlipSection className="container-px">
        <GlassSectionPanel className="p-6 noise sm:p-9">
          <Reveal className="mx-auto max-w-2xl text-center">
            <SectionTag className="mx-auto">The Process</SectionTag>
            <h2 className="text-display mt-3 text-3xl sm:text-4xl md:text-5xl leading-[0.95]">
              HOW <span className="text-brand-yellow italic-skew">LEANR</span> WORKS
            </h2>
          </Reveal>

          <div ref={ref} className="relative mt-10">
            <div className="absolute left-0 right-0 top-8 hidden h-px bg-white/10 lg:block" />
            <motion.div
              className="absolute left-0 top-8 hidden h-px origin-left bg-gradient-to-r from-brand-yellow via-yellow-bright to-brand-yellow lg:block"
              style={{ scaleX: lineScale, width: "100%" }}
            />

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-5">
              {steps.map((step, i) => (
                <Reveal key={step.title} delay={i * 0.12} className="relative">
                  <div className="mb-3 flex items-center gap-3 lg:block">
                    <div className="relative z-10 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-yellow">
                      <step.icon className="h-5 w-5 text-black" />
                    </div>
                    <span className="text-display text-4xl font-bold italic text-white/10 lg:mt-2 lg:block">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                  </div>
                  <GlassCard className="p-5 transition-colors hover:border-brand-yellow/40">
                    <p className="text-display text-lg font-bold italic text-white">{step.title}</p>
                    <p className="mt-1.5 text-sm leading-relaxed text-white/60">{step.description}</p>
                  </GlassCard>
                </Reveal>
              ))}
            </div>
          </div>
        </GlassSectionPanel>
      </FlipSection>
    </section>
  );
}

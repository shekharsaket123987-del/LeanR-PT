"use client";

import { motion } from "framer-motion";
import FlipSection from "../ui/FlipSection";
import GlassSectionPanel from "../ui/GlassSectionPanel";
import Reveal from "../ui/Reveal";
import SectionTag from "../ui/SectionTag";
import SlideReveal from "../ui/SlideReveal";

const BENEFITS = [
  { icon: "📡", title: "Live Sessions", desc: "Real-time coaching that keeps you accountable." },
  { icon: "🏠", title: "Train From Home", desc: "No commute. No excuses. Just results." },
  { icon: "🎯", title: "Goal Based", desc: "Customized plans designed for your goals." },
  { icon: "🗓️", title: "Flexible Schedule", desc: "Pick slots that fit your lifestyle." },
  { icon: "🧑‍🏫", title: "Expert Coaches", desc: "Learn from certified coaches who care." },
  { icon: "🔒", title: "Built-In Accountability", desc: "We track. We guide. You achieve." },
];

export default function WhyLeanR() {
  return (
    <section id="why-leanr" className="relative min-h-screen overflow-hidden pt-24 pb-4 md:pt-28">
      <FlipSection className="container-px">
        <GlassSectionPanel className="p-6 noise sm:p-9">
          <Reveal className="max-w-2xl mx-auto text-center">
            <SectionTag className="mx-auto">The LeanR Difference</SectionTag>
            <h2 className="text-display mt-3 text-3xl sm:text-4xl md:text-5xl leading-[0.95]">
              WHY <span className="italic-skew text-brand-yellow">LEANR</span>
            </h2>
          </Reveal>

          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {BENEFITS.map((b, i) => (
              <SlideReveal
                key={b.title}
                direction={i % 2 === 0 ? "left" : "right"}
                distance={36}
                delay={i * 0.07}
              >
                <motion.div
                  className="glass flex items-center gap-4 rounded-2xl p-4"
                  whileHover={{ x: 6, borderColor: "rgba(245,217,10,0.5)" }}
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl glass-yellow text-lg">
                    {b.icon}
                  </div>
                  <div>
                    <h3 className="text-display text-base">{b.title}</h3>
                    <p className="mt-0.5 text-xs text-white/60">{b.desc}</p>
                  </div>
                </motion.div>
              </SlideReveal>
            ))}
          </div>
        </GlassSectionPanel>
      </FlipSection>
    </section>
  );
}

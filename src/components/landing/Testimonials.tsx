"use client";

import { useRef, useState } from "react";
import {
  motion,
  useMotionValue,
  useScroll,
  useSpring,
  useTransform,
  type PanInfo,
} from "framer-motion";
import FlipSection from "../ui/FlipSection";
import GlassCard from "../ui/GlassCard";
import GlassSectionPanel from "../ui/GlassSectionPanel";
import Reveal from "../ui/Reveal";
import SectionTag from "../ui/SectionTag";
import { cn } from "@/lib/utils";

const TRANSFORMATIONS = [
  {
    name: "Rohit S.",
    age: 28,
    city: "Delhi",
    stat: "-12 KG",
    subStat: "-8% Body Fat",
    duration: "5 Months",
    quote: "LeanR gave me the right guidance and structure.",
    from: "#332f1e",
    to: "#0a0a08",
  },
  {
    name: "Neha K.",
    age: 31,
    city: "Mumbai",
    stat: "-15 KG",
    subStat: "-10% Body Fat",
    duration: "6 Months",
    quote: "The coaches actually cared about my progress.",
    from: "#2c2c1c",
    to: "#0a0a08",
  },
  {
    name: "Karan D.",
    age: 24,
    city: "Bengaluru",
    stat: "+6 KG",
    subStat: "-5% Body Fat",
    duration: "4 Months",
    quote: "I finally built real strength, not just weight.",
    from: "#302a1a",
    to: "#0a0a08",
  },
  {
    name: "Ananya R.",
    age: 35,
    city: "Pune",
    stat: "-18 KG",
    subStat: "-12% Body Fat",
    duration: "8 Months",
    quote: "This program changed how I see fitness, for good.",
    from: "#2f2c1c",
    to: "#0a0a08",
  },
];

const STATS: { value: string; label: string; icon: "people" | "star" | "target" | "shield" }[] = [
  { value: "25,000+", label: "Happy Transformations", icon: "people" },
  { value: "4.9/5", label: "Average Rating", icon: "star" },
  { value: "95%", label: "Goal Achievement", icon: "target" },
  { value: "5+", label: "Years of Trust", icon: "shield" },
];

function SilhouetteIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} fill="currentColor">
      <circle cx="20" cy="12" r="7" />
      <path d="M6 36c0-9 6-15 14-15s14 6 14 15z" />
    </svg>
  );
}

function ChevronIcon({ direction, className }: { direction: "left" | "right"; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d={direction === "left" ? "M15 6l-6 6 6 6" : "M9 6l6 6-6 6"}
      />
    </svg>
  );
}

function StatIcon({ type, className }: { type: "people" | "star" | "target" | "shield"; className?: string }) {
  const paths: Record<string, React.ReactNode> = {
    people: (
      <>
        <circle cx="8" cy="8" r="3" />
        <circle cx="16" cy="9" r="2.5" />
        <path d="M2 20c0-3.5 2.5-6 6-6s6 2.5 6 6" />
        <path d="M14.5 14.2c2.9.4 4.5 2.6 4.5 5.8" />
      </>
    ),
    star: <path d="M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6-5.4-3-5.4 3 1.2-6-4.5-4.2 6.1-.7L12 3z" />,
    target: (
      <>
        <circle cx="12" cy="12" r="8.5" />
        <circle cx="12" cy="12" r="4.5" />
        <circle cx="12" cy="12" r="0.8" fill="currentColor" />
      </>
    ),
    shield: <path d="M12 2.5l7.5 3.2v5.6c0 4.6-3.2 7.8-7.5 9.7-4.3-1.9-7.5-5.1-7.5-9.7V5.7L12 2.5z" />,
  };
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className={className}>
      {paths[type]}
    </svg>
  );
}

function TransformCard({
  t,
  index,
  activeIndex,
  onFocus,
  onHoverEnter,
  onHoverLeave,
}: {
  t: (typeof TRANSFORMATIONS)[number];
  index: number;
  activeIndex: number;
  onFocus: () => void;
  onHoverEnter: () => void;
  onHoverLeave: () => void;
}) {
  const isActive = index === activeIndex;
  const offset = index - activeIndex;

  const ref = useRef<HTMLDivElement>(null);
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const rotateX = useSpring(useTransform(my, [-0.5, 0.5], [7, -7]), { stiffness: 220, damping: 20 });
  const rotateY = useSpring(useTransform(mx, [-0.5, 0.5], [-7, 7]), { stiffness: 220, damping: 20 });
  const imgParallaxX = useSpring(useTransform(mx, [-0.5, 0.5], [-4, 4]), { stiffness: 200, damping: 22 });
  const imgParallaxY = useSpring(useTransform(my, [-0.5, 0.5], [-4, 4]), { stiffness: 200, damping: 22 });
  const sheenX = useSpring(useTransform(mx, [-0.5, 0.5], [-10, 110]), { stiffness: 150, damping: 24 });

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
    <div style={{ perspective: 1200 }} className="h-full">
      <motion.div
        initial={{ opacity: 0, y: 70, rotateX: 10 }}
        whileInView={{ opacity: 1, y: 0, rotateX: 0 }}
        viewport={{ once: true, margin: "0px 0px -10% 0px" }}
        transition={{ duration: 0.8, delay: Math.abs(offset) * 0.12, ease: [0.16, 1, 0.3, 1] }}
        style={{ transformStyle: "preserve-3d" }}
        className="h-full"
      >
        <motion.div
          animate={{
            scale: isActive ? 1 : 0.88,
            opacity: isActive ? 1 : 0.5,
            rotateY: isActive ? 0 : offset < 0 ? 14 : -14,
            z: isActive ? 40 : -60,
          }}
          transition={{ type: "spring", stiffness: 220, damping: 26 }}
          style={{ transformStyle: "preserve-3d" }}
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
            <motion.div style={{ rotateX: isActive ? rotateX : 0, rotateY: isActive ? rotateY : 0, transformStyle: "preserve-3d" }} className="h-full">
              <GlassCard
                variant={isActive ? "strong" : "default"}
                glow={isActive}
                className={cn("relative h-full overflow-hidden p-2.5 transition-[border-color] duration-300", isActive && "border-brand-yellow/50")}
              >
                {isActive && (
                  <motion.div
                    className="pointer-events-none absolute inset-y-0 z-10 w-1/3 -skew-x-12 bg-white/10 blur-md"
                    style={{ left: sheenX }}
                  />
                )}

                <div className="relative aspect-[4/3] overflow-hidden rounded-lg">
                  <motion.div style={{ x: isActive ? imgParallaxX : 0, y: isActive ? imgParallaxY : 0 }} className="grid h-full grid-cols-2">
                    <div className="relative flex items-end justify-center bg-white/5 pb-2">
                      <span className="absolute left-2 top-1.5 text-[9px] font-semibold uppercase tracking-wider text-white/50">Before</span>
                      <SilhouetteIcon className="h-9 w-9 text-white/20" />
                    </div>
                    <div className="relative flex items-end justify-center pb-2" style={{ background: `linear-gradient(155deg, ${t.from}, ${t.to})` }}>
                      <span className="absolute right-2 top-1.5 text-[9px] font-semibold uppercase tracking-wider text-brand-yellow">After</span>
                      <SilhouetteIcon className="h-9 w-9 text-brand-yellow/70" />
                    </div>
                  </motion.div>
                  <div className="absolute left-1/2 top-1/2 flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-brand-yellow text-[10px] font-bold text-black shadow-[0_0_20px_-2px_rgba(245,217,10,0.8)]">
                    →
                  </div>
                </div>

                <div className="p-2 text-center">
                  <p className="text-xs font-semibold text-white">{t.name}</p>
                  <p className="text-[10px] text-white/45">
                    {t.age} Years · {t.city}
                  </p>
                  <div className="mt-1.5 flex items-center justify-center gap-2">
                    <span className="text-display text-lg leading-none text-brand-yellow text-glow">{t.stat}</span>
                    <span className="text-[10px] text-white/55">{t.subStat}</span>
                  </div>
                  <p className="text-[9px] uppercase tracking-wider text-white/40">{t.duration}</p>
                  <p className="mt-1.5 border-t border-white/10 pt-1.5 text-[10px] italic leading-snug text-white/55">
                    &ldquo;{t.quote}&rdquo;
                  </p>
                </div>
              </GlassCard>
            </motion.div>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}

function JourneyLightTrail() {
  return (
    <>
      <motion.div
        className="absolute inset-0 rounded-[100%]"
        animate={{ opacity: [0.3, 0.7, 0.3], scale: [1, 1.04, 1] }}
        transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
        style={{ boxShadow: "0 0 40px 6px rgba(245,217,10,0.3)" }}
      />
      <motion.div className="absolute inset-0" animate={{ rotate: 360 }} transition={{ duration: 7, repeat: Infinity, ease: "linear" }}>
        <span className="absolute left-1/2 top-0 h-2 w-2 -translate-x-1/2 rounded-full bg-brand-yellow shadow-[0_0_14px_4px_rgba(245,217,10,0.75)]" />
      </motion.div>
      <motion.div className="absolute inset-0" animate={{ rotate: -360 }} transition={{ duration: 10, repeat: Infinity, ease: "linear" }}>
        <span className="absolute bottom-0 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-brand-yellow/70 shadow-[0_0_10px_3px_rgba(245,217,10,0.6)]" />
      </motion.div>
    </>
  );
}

function JourneyPhone({ sectionRef }: { sectionRef: React.RefObject<HTMLElement | null> }) {
  const ref = useRef<HTMLDivElement>(null);
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const rotateX = useSpring(useTransform(my, [-0.5, 0.5], [10, -10]), { stiffness: 150, damping: 18 });
  const rotateY = useSpring(useTransform(mx, [-0.5, 0.5], [-10, 10]), { stiffness: 150, damping: 18 });

  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ["start end", "end start"] });
  const z = useTransform(scrollYProgress, [0, 0.5, 1], [-60, 0, 60]);

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

  return (
    <div ref={ref} onMouseMove={handleMove} onMouseLeave={handleLeave} style={{ perspective: 1200 }} className="relative flex items-center justify-center">
      <div className="pointer-events-none absolute h-48 w-48 rounded-full bg-brand-yellow/10 blur-[70px]" />
      <div className="pointer-events-none absolute h-56 w-40">
        <JourneyLightTrail />
      </div>

      <motion.div style={{ z, transformStyle: "preserve-3d" }} animate={{ y: [0, -9, 0] }} transition={{ duration: 5.5, repeat: Infinity, ease: "easeInOut" }}>
        <motion.div
          animate={{ rotateY: [0, 10, 0, -10, 0] }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
          style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}
        >
          <div
            className="relative w-40 overflow-hidden rounded-[1.8rem] border-2 border-brand-yellow/40 bg-[#0a0a0a] p-2 shadow-[0_0_45px_-10px_rgba(245,217,10,0.6)]"
            style={{ transform: "translateZ(30px)" }}
          >
            <div className="absolute left-1/2 top-1.5 z-10 h-1.5 w-10 -translate-x-1/2 rounded-full bg-black" />
            <div className="relative overflow-hidden rounded-[1.3rem] bg-gradient-to-b from-[#141310] to-black px-3 pb-4 pt-6">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(245,217,10,0.12),transparent_60%)]" />
              <p className="text-display relative text-center text-sm text-brand-yellow">LEANR</p>
              <p className="relative mt-2 text-center text-[10px] font-semibold uppercase leading-tight tracking-wider text-white/80">
                Your Journey
                <br />
                <span className="text-brand-yellow">Your Results</span>
              </p>

              <div className="relative mt-3 rounded-lg glass-faint px-2 py-2">
                <div className="flex items-center justify-between text-[9px] text-white/60">
                  <span>Goal Progress</span>
                  <span className="font-semibold text-brand-yellow">82%</span>
                </div>
                <div className="mt-1 h-1 rounded-full bg-white/10">
                  <div className="h-full w-[82%] rounded-full bg-brand-yellow" />
                </div>
              </div>

              <div className="relative mt-2 grid grid-cols-2 gap-1.5">
                <div className="rounded-lg glass-faint px-2 py-1.5 text-center">
                  <p className="text-[11px] font-bold text-brand-yellow">-9 KG</p>
                  <p className="text-[8px] text-white/50">Weight</p>
                </div>
                <div className="rounded-lg glass-faint px-2 py-1.5 text-center">
                  <p className="text-[11px] font-bold text-brand-yellow">-7%</p>
                  <p className="text-[8px] text-white/50">Body Fat</p>
                </div>
              </div>

              <div className="relative mt-1.5 flex items-center justify-between rounded-lg glass-faint px-2 py-1.5 text-[9px] text-white/60">
                <span>Active Days</span>
                <span className="font-semibold text-brand-yellow">18 / 24</span>
              </div>

              <button className="relative mt-2 w-full rounded-full bg-brand-yellow py-1.5 text-[10px] font-bold text-black">View Progress</button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}

function StatsBar() {
  return (
    <motion.div animate={{ y: [0, -5, 0] }} transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}>
      <GlassCard variant="default" className="grid grid-cols-2 gap-3 px-4 py-3 sm:grid-cols-4 sm:gap-2 sm:px-6 sm:py-4">
        {STATS.map((s) => (
          <div key={s.label} className="flex items-center justify-center gap-2 text-center sm:flex-col sm:gap-1">
            <StatIcon type={s.icon} className="h-4 w-4 shrink-0 text-brand-yellow sm:h-5 sm:w-5" />
            <div>
              <p className="text-display text-base leading-none text-brand-yellow sm:text-lg">{s.value}</p>
              <p className="text-[9px] text-white/50 sm:text-[10px]">{s.label}</p>
            </div>
          </div>
        ))}
      </GlassCard>
    </motion.div>
  );
}

export default function Testimonials() {
  const sectionRef = useRef<HTMLElement>(null);
  const [activeIndex, setActiveIndex] = useState(1);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const displayIndex = hoverIndex ?? activeIndex;

  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ["start end", "end start"] });
  const carouselRotate = useTransform(scrollYProgress, [0, 0.5, 1], [-4, 0, 4]);

  function goPrev() {
    setActiveIndex((i) => Math.max(i - 1, 0));
  }
  function goNext() {
    setActiveIndex((i) => Math.min(i + 1, TRANSFORMATIONS.length - 1));
  }
  function handleDragEnd(_: unknown, info: PanInfo) {
    const threshold = 60;
    if (info.offset.x < -threshold) goNext();
    else if (info.offset.x > threshold) goPrev();
  }

  return (
    <section ref={sectionRef} id="stories" className="relative overflow-hidden pt-24 pb-16 md:pt-28">
      <FlipSection className="container-px">
        <GlassSectionPanel className="p-6 noise sm:p-9">
          <Reveal className="mx-auto max-w-2xl text-center">
            <SectionTag className="mx-auto">Real Results</SectionTag>
            <h2 className="text-display mt-3 text-3xl leading-[0.95] sm:text-4xl md:text-5xl">
              REAL PEOPLE. REAL <span className="text-brand-yellow italic-skew">RESULTS.</span>
            </h2>
            <p className="mt-2 text-sm text-white/60">Different journeys. Same goal. Healthier, stronger, happier.</p>
          </Reveal>

          <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_15rem] lg:items-center xl:grid-cols-[1fr_17rem]">
            <div className="flex items-center gap-2 sm:gap-3">
              <button
                aria-label="Previous transformation"
                onClick={goPrev}
                disabled={activeIndex === 0}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full glass-faint text-white/70 transition-colors hover:border-brand-yellow/40 hover:text-brand-yellow disabled:pointer-events-none disabled:opacity-30 sm:h-9 sm:w-9"
              >
                <ChevronIcon direction="left" className="h-4 w-4" />
              </button>

              <motion.div
                drag="x"
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.2}
                onDragEnd={handleDragEnd}
                style={{ rotateY: carouselRotate, perspective: 1600 }}
                className="grid flex-1 cursor-grab gap-4 py-4 active:cursor-grabbing sm:grid-cols-2 lg:grid-cols-4"
              >
                {TRANSFORMATIONS.map((t, i) => (
                  <TransformCard
                    key={t.name}
                    t={t}
                    index={i}
                    activeIndex={displayIndex}
                    onFocus={() => setActiveIndex(i)}
                    onHoverEnter={() => setHoverIndex(i)}
                    onHoverLeave={() => setHoverIndex(null)}
                  />
                ))}
              </motion.div>

              <button
                aria-label="Next transformation"
                onClick={goNext}
                disabled={activeIndex === TRANSFORMATIONS.length - 1}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full glass-faint text-white/70 transition-colors hover:border-brand-yellow/40 hover:text-brand-yellow disabled:pointer-events-none disabled:opacity-30 sm:h-9 sm:w-9"
              >
                <ChevronIcon direction="right" className="h-4 w-4" />
              </button>
            </div>

            <JourneyPhone sectionRef={sectionRef} />
          </div>

          <div className="mt-2 flex items-center justify-center gap-2.5">
            {TRANSFORMATIONS.map((t, i) => (
              <button
                key={t.name}
                aria-label={`Show ${t.name}'s transformation`}
                onClick={() => setActiveIndex(i)}
                className={cn(
                  "h-1.5 rounded-full transition-all duration-300",
                  i === activeIndex ? "w-8 bg-brand-yellow" : "w-1.5 bg-white/25 hover:bg-white/40"
                )}
              />
            ))}
          </div>

          <div className="mt-10">
            <StatsBar />
          </div>

          <Reveal className="mt-10 flex flex-col items-center gap-4 text-center">
            <p className="text-display text-xl sm:text-2xl text-white">
              Ready to start your <span className="text-brand-yellow italic-skew">transformation?</span>
            </p>
          </Reveal>
        </GlassSectionPanel>
      </FlipSection>
    </section>
  );
}

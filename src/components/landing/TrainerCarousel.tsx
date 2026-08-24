"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  type PanInfo,
} from "framer-motion";
import FlipSection from "../ui/FlipSection";
import GlassSectionPanel from "../ui/GlassSectionPanel";
import Lightbox from "../ui/Lightbox";
import Reveal from "../ui/Reveal";
import SectionTag from "../ui/SectionTag";
import { cn } from "@/lib/utils";

const COACHES = [
  {
    name: "Hare Krishna",
    role: "Strength Coach",
    cert: "ACE Certified",
    exp: "6+ Years Experience",
    quote: "I focus on building stronger, healthier versions of you.",
    bio: "Hare Krishna has spent years coaching strength blocks built around whatever equipment his clients actually have at home — from full racks to a single pair of dumbbells.",
    initials: "HK",
    from: "#3a3320",
    to: "#0c0c0a",
    image: "/leanr-brand/coach-1.png",
  },
  {
    name: "Hare Krishna",
    role: "Fitness Coach",
    cert: "NASM Certified",
    exp: "6+ Years Experience",
    quote: "Fitness is not a destination. It's a lifestyle.",
    bio: "Hare Krishna pairs every training block with a livable, sustainable approach — helping clients build fitness into daily life instead of chasing quick fixes.",
    initials: "HK",
    from: "#2a2418",
    to: "#0a0a08",
    image: "/leanr-brand/coach-1.png",
  },
  {
    name: "Hare Krishna",
    role: "Physique Coach",
    cert: "ISSA Certified",
    exp: "6+ Years Experience",
    quote: "Discipline today, results tomorrow.",
    bio: "Hare Krishna builds physique-focused programs around consistency and discipline, adjusting every session in real time based on how a client is progressing.",
    initials: "HK",
    from: "#333224",
    to: "#0b0b09",
    image: "/leanr-brand/coach-1.png",
  },
];

function CoachCard({
  coach,
  index,
  activeIndex,
  onFocus,
  onHoverEnter,
  onHoverLeave,
  onOpen,
}: {
  coach: (typeof COACHES)[number];
  index: number;
  activeIndex: number;
  onFocus: () => void;
  onHoverEnter: () => void;
  onHoverLeave: () => void;
  onOpen: () => void;
}) {
  const isActive = index === activeIndex;
  const offset = index - activeIndex;

  const ref = useRef<HTMLDivElement>(null);
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const rotateX = useSpring(useTransform(my, [-0.5, 0.5], [8, -8]), {
    stiffness: 220,
    damping: 20,
  });
  const rotateY = useSpring(useTransform(mx, [-0.5, 0.5], [-8, 8]), {
    stiffness: 220,
    damping: 20,
  });

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
    <div style={{ perspective: 1400 }} className="h-full">
      <motion.div
        animate={{
          scale: isActive ? 1 : 0.87,
          opacity: isActive ? 1 : 0.5,
          rotateY: isActive ? 0 : offset < 0 ? 16 : -16,
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
          className="h-full [perspective:1000px]"
        >
          <motion.div
            style={{
              rotateX: isActive ? rotateX : 0,
              rotateY: isActive ? rotateY : 0,
              transformStyle: "preserve-3d",
            }}
            className="h-full"
          >
            <div
              onClick={() => (isActive ? onOpen() : onFocus())}
              className={cn(
                "group relative h-full cursor-pointer overflow-visible rounded-2xl pt-10 transition-[border-color,box-shadow] duration-300",
                isActive ? "glass-strong glow-yellow border-brand-yellow/50" : "glass"
              )}
            >
              {/* coach photo popping out above the glass frame */}
              <div
                className="absolute -top-8 left-1/2 h-20 w-20 overflow-hidden rounded-[1.2rem] border-2 border-brand-yellow/40 shadow-[0_15px_40px_-10px_rgba(0,0,0,0.7)] sm:h-24 sm:w-24"
                style={{ transform: "translateX(-50%) translateZ(55px)" }}
              >
                <Image
                  src={coach.image}
                  alt={`${coach.name}, LeanR coach`}
                  fill
                  unoptimized
                  sizes="130px"
                  className="object-cover object-[50%_18%]"
                />
                <div className="absolute inset-x-0 bottom-0 h-6 bg-gradient-to-t from-black/40 to-transparent" />
              </div>

              {/* yellow rim light — only around the selected coach */}
              {isActive && (
                <div className="pointer-events-none absolute -inset-px -z-10 rounded-2xl shadow-[0_0_60px_-8px_rgba(245,217,10,0.55)]" />
              )}

              <div className="px-5 pb-5 pt-1 text-center">
                <h3 className="text-display text-lg leading-tight">{coach.name}</h3>

                <span className="mt-1.5 inline-flex items-center rounded-full glass-faint px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-brand-yellow">
                  {coach.role}
                </span>

                <div className="mt-2 flex items-center justify-center gap-3 text-[11px] text-white/50">
                  <span>{coach.cert}</span>
                  <span className="h-1 w-1 rounded-full bg-white/20" />
                  <span>{coach.exp}</span>
                </div>

                <p className="mt-2.5 border-t border-white/10 pt-2.5 text-xs italic leading-relaxed text-white/60">
                  &ldquo;{coach.quote}&rdquo;
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
}

export default function TrainerCarousel() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const displayIndex = hoverIndex ?? activeIndex;
  const active = openIndex !== null ? COACHES[openIndex] : null;

  function handleDragEnd(_: unknown, info: PanInfo) {
    const threshold = 60;
    if (info.offset.x < -threshold) {
      setActiveIndex((i) => Math.min(i + 1, COACHES.length - 1));
    } else if (info.offset.x > threshold) {
      setActiveIndex((i) => Math.max(i - 1, 0));
    }
  }

  return (
    <section id="coaches" className="relative min-h-screen overflow-hidden pt-24 pb-4 md:pt-28">
      <FlipSection className="container-px">
        <GlassSectionPanel className="p-6 noise sm:p-9">
          <Reveal className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <SectionTag>Meet The Team</SectionTag>
              <h2 className="text-display mt-3 text-3xl sm:text-4xl md:text-5xl leading-[0.95]">
                THE <span className="italic-skew text-brand-yellow">COACHES</span>
              </h2>
            </div>
            <p className="max-w-sm text-sm text-white/60">
              Every LeanR coach is certified, background-verified, and trained
              specifically for live online delivery. Drag or tap to browse —
              tap the highlighted coach to read more.
            </p>
          </Reveal>

          <motion.div
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.2}
            onDragEnd={handleDragEnd}
            className="mt-6 grid cursor-grab gap-5 pt-10 active:cursor-grabbing sm:grid-cols-2 lg:grid-cols-3"
            style={{ perspective: 1600 }}
          >
            {COACHES.map((coach, i) => (
              <CoachCard
                key={i}
                coach={coach}
                index={i}
                activeIndex={displayIndex}
                onFocus={() => setActiveIndex(i)}
                onHoverEnter={() => setHoverIndex(i)}
                onHoverLeave={() => setHoverIndex(null)}
                onOpen={() => setOpenIndex(i)}
              />
            ))}
          </motion.div>

          {/* carousel indicators */}
          <div className="mt-6 flex items-center justify-center gap-2.5">
            {COACHES.map((coach, i) => (
              <button
                key={i}
                aria-label={`Show ${coach.name} ${i + 1}`}
                onClick={() => setActiveIndex(i)}
                className={cn(
                  "h-1.5 rounded-full transition-all duration-300",
                  i === activeIndex ? "w-8 bg-brand-yellow" : "w-1.5 bg-white/25 hover:bg-white/40"
                )}
              />
            ))}
          </div>
        </GlassSectionPanel>
      </FlipSection>

      <Lightbox open={openIndex !== null} onClose={() => setOpenIndex(null)}>
        {active && (
          <div>
            <div
              className="relative flex aspect-[16/9] items-center justify-center overflow-hidden rounded-t-2xl"
              style={{ background: `linear-gradient(155deg, ${active.from}, ${active.to})` }}
            >
              <Image
                src={active.image}
                alt={`${active.name}, LeanR coach`}
                fill
                unoptimized
                sizes="512px"
                className="object-cover object-[50%_15%]"
              />
              <div className="absolute left-4 top-4 rounded-full border border-brand-yellow/30 bg-black/50 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-brand-yellow backdrop-blur-md">
                Certified
              </div>
            </div>
            <div className="p-6 sm:p-7">
              <h3 className="text-display text-2xl">{active.name}</h3>
              <p className="mt-1 text-sm text-brand-yellow">{active.role}</p>
              <div className="mt-3 flex items-center gap-4 text-xs text-white/50">
                <span>{active.cert}</span>
                <span>{active.exp}</span>
              </div>
              <p className="mt-5 text-sm leading-relaxed text-white/70">{active.bio}</p>
              <p className="mt-4 border-t border-white/10 pt-4 text-sm italic leading-relaxed text-white/60">
                &ldquo;{active.quote}&rdquo;
              </p>
            </div>
          </div>
        )}
      </Lightbox>
    </section>
  );
}

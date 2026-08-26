"use client";

import { useRef } from "react";
import Image from "next/image";
import {
  motion,
  useMotionValue,
  useScroll,
  useSpring,
  useTransform,
} from "framer-motion";
import { Radio } from "lucide-react";
import Button from "../ui/Button";
import GlassCard from "../ui/GlassCard";
import { smoothScrollTo } from "@/lib/utils";

const HERO_PHOTO = "/ChatGPT Image Aug 22, 2026, 01_43_26 PM.png";
const COACH_PHOTO = "/ChatGPT Image Aug 22, 2026, 02_04_47 PM.png";
const AVATARS = ["A", "P", "R", "S"];

function CallControls() {
  return (
    <div className="mt-2 flex items-center gap-1.5">
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/15 text-[9px]">🎤</span>
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[9px]">📞</span>
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/15 text-[9px]">🎥</span>
    </div>
  );
}

function Sparkline() {
  return (
    <svg viewBox="0 0 100 30" className="mt-1.5 h-6 w-full" preserveAspectRatio="none">
      <polyline
        points="0,25 15,20 30,22 45,12 60,15 75,6 100,8"
        fill="none"
        stroke="#f5d90a"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ScrollDownIndicator() {
  return (
    <motion.button
      onClick={() => window.scrollBy({ top: window.innerHeight * 0.85, behavior: "smooth" })}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 1, delay: 1.2 }}
      className="mx-auto mt-14 hidden flex-col items-center gap-2 text-white/50 transition-colors hover:text-brand-yellow lg:flex"
    >
      <motion.span
        className="flex h-8 w-5 items-start justify-center rounded-full border border-brand-yellow/50 p-1"
        animate={{ y: [0, 4, 0] }}
        transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-brand-yellow" />
      </motion.span>
      <span className="text-[10px] uppercase tracking-[0.2em]">Scroll Down</span>
    </motion.button>
  );
}

function TrainingScene({ sectionRef }: { sectionRef: React.RefObject<HTMLElement | null> }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const mx = useMotionValue(0);
  const my = useMotionValue(0);

  const tiltX = useSpring(useTransform(my, [-0.5, 0.5], [13, -7]), { stiffness: 90, damping: 18 });
  const tiltYMouse = useTransform(mx, [-0.5, 0.5], [-22, 2]);

  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ["start start", "end start"] });
  const scrollRotateY = useTransform(scrollYProgress, [0, 1], [0, 16]);
  const rotateY = useSpring(
    useTransform([tiltYMouse, scrollRotateY], ([mouse, scroll]) => (mouse as number) + (scroll as number)),
    { stiffness: 90, damping: 18 }
  );
  const driftY = useTransform(scrollYProgress, [0, 1], [0, -60]);
  const driftScale = useTransform(scrollYProgress, [0, 1], [1, 0.9]);
  const driftOpacity = useTransform(scrollYProgress, [0, 1], [1, 0.3]);

  function handleMove(e: React.MouseEvent<HTMLDivElement>) {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect) return;
    mx.set((e.clientX - rect.left) / rect.width - 0.5);
    my.set((e.clientY - rect.top) / rect.height - 0.5);
  }
  function handleLeave() {
    mx.set(0);
    my.set(0);
  }

  return (
    <motion.div style={{ y: driftY, scale: driftScale, opacity: driftOpacity }} className="relative mx-auto w-full max-w-sm sm:max-w-md lg:max-w-lg">
      <div ref={wrapRef} onMouseMove={handleMove} onMouseLeave={handleLeave} className="relative [perspective:2000px]">
        <motion.div
          className="absolute -bottom-8 left-1/2 h-16 w-[85%] rounded-[100%] border border-brand-yellow/40"
          style={{ x: "-50%", z: -80 }}
          animate={{ opacity: [0.4, 0.8, 0.4] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        />
        <div className="absolute -bottom-14 left-1/2 h-24 w-[70%] -translate-x-1/2 rounded-[100%] border border-brand-yellow/15" />

        <motion.div
          className="absolute -inset-10 -z-10 rounded-[3rem] bg-brand-yellow/25 blur-[110px]"
          animate={{ opacity: [0.45, 0.75, 0.45] }}
          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
        />

        <motion.div style={{ rotateX: tiltX, rotateY, transformStyle: "preserve-3d" }} className="relative">
          <div
            className="absolute inset-0 rounded-[2rem] border border-brand-yellow/20"
            style={{ transform: "translate(12px, 12px) translateZ(-40px)" }}
          />

          <GlassCard variant="strong" glow className="relative overflow-hidden rounded-[2rem] p-3 noise" style={{ z: 0 }}>
            {/*
              The source photo has "LIVE SESSION", "LIVE COACH", "Calories
              Burned" and "Workout Progress" baked into its pixels on the
              right edge and top-left corner, duplicating the floating glass
              cards below -- zoom + pan crops that baked-in UI out of frame,
              leaving just the athlete + laptop + room.
            */}
            <div className="relative aspect-[400/443] w-full overflow-hidden rounded-[1.6rem] bg-black">
              <div className="absolute left-0 top-0 aspect-[1449/1086] w-[181.1%]" style={{ transform: "translateY(-18.42%)" }}>
                <Image
                  src={HERO_PHOTO}
                  alt="LeanR athlete training live on a plank with a laptop open in front of him"
                  fill
                  priority
                  sizes="(max-width: 768px) 160vw, 1160px"
                  className="object-cover"
                />
              </div>
            </div>
          </GlassCard>

          {/* live session badge — top-left, nearest layer */}
          <motion.div
            style={{ z: 90 }}
            className="absolute -left-3 -top-3 sm:-left-6 sm:-top-4"
            animate={{ y: [0, -8, 0] }}
            transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
          >
            <GlassCard variant="yellow" className="flex items-center gap-2 px-3.5 py-2">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
              </span>
              <span className="text-[11px] font-semibold tracking-wide text-black">LIVE SESSION</span>
            </GlassCard>
          </motion.div>

          {/* right-side stack: live coach, calories, progress */}
          <motion.div
            style={{ z: 110 }}
            className="absolute -right-4 top-[3%] hidden w-32 sm:-right-8 sm:block sm:w-36"
            animate={{ y: [0, -10, 0] }}
            transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 0.2 }}
          >
            <GlassCard variant="strong" className="overflow-hidden p-2.5">
              <p className="text-[10px] uppercase tracking-wider text-white/70">Live Coach</p>
              {/*
                The source photo has its own baked "LIVE COACH" label and
                mic/hangup/camera row, duplicating the HTML label and
                CallControls below -- zoom + pan to a tight square crop on
                just his face/shoulders crops that baked-in UI out.
              */}
              <div className="relative mt-2 aspect-square w-full overflow-hidden rounded-lg bg-black">
                <div className="absolute left-0 top-0 aspect-[1369/1149] w-[232%]" style={{ transform: "translate(-34.33%, -12.19%) translateZ(30px)" }}>
                  <Image src={COACH_PHOTO} alt="Sarah K., LeanR live coach, on a video call" fill sizes="200px" className="object-cover" />
                </div>
              </div>
              <p className="mt-2 text-[11px] leading-tight text-white/70">
                Sarah K.
                <br />
                Fitelo Coach
              </p>
              <CallControls />
            </GlassCard>
          </motion.div>

          <motion.div
            style={{ z: 70 }}
            className="absolute -right-4 top-[58%] hidden w-36 sm:-right-6 sm:block sm:w-40"
            animate={{ y: [0, 8, 0] }}
            transition={{ duration: 4.2, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
          >
            <GlassCard variant="default" className="p-3">
              <p className="text-[10px] uppercase tracking-wider text-white/70">Calories Burned</p>
              <p className="text-display text-lg leading-none text-brand-yellow">
                320 <span className="text-xs">kcal</span>
              </p>
              <Sparkline />
            </GlassCard>
          </motion.div>

          <motion.div
            style={{ z: 100 }}
            className="absolute -right-3 bottom-[2%] w-40 sm:-right-6 sm:w-44"
            animate={{ y: [0, -6, 0] }}
            transition={{ duration: 4.8, repeat: Infinity, ease: "easeInOut", delay: 0.8 }}
          >
            <GlassCard variant="strong" className="px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[10px] uppercase tracking-wider text-white/70">Workout Progress</p>
                <span className="text-xs font-bold text-brand-yellow">68%</span>
              </div>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                <div className="h-full w-[68%] rounded-full bg-brand-yellow" />
              </div>
            </GlassCard>
          </motion.div>
        </motion.div>
      </div>
    </motion.div>
  );
}

export default function Hero() {
  const sectionRef = useRef<HTMLElement>(null);

  return (
    <section id="top" ref={sectionRef} className="relative overflow-hidden pb-4 pt-28 sm:pt-36">
      <div className="mx-auto grid max-w-7xl grid-cols-1 items-start gap-14 px-5 sm:px-8 lg:grid-cols-2">
        <div className="relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="mb-6 inline-flex items-center gap-2 rounded-full border border-brand-yellow/30 bg-brand-yellow/10 px-3.5 py-1.5"
          >
            <Radio className="h-3.5 w-3.5 text-brand-yellow" />
            <span className="text-xs font-bold uppercase tracking-wide text-brand-yellow">Live 1:1 Coaching</span>
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            className="text-display text-5xl font-bold italic leading-[1.05] text-white sm:text-6xl lg:text-7xl"
          >
            Train Live.
            <br />
            <span className="text-brand-yellow text-glow">Anywhere.</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="mt-6 max-w-md text-lg text-white/60"
          >
            Real coaches. Real-time coaching. LEANR pairs you with a dedicated personal trainer for live online
            sessions built around your goals — no gym required.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.45, ease: [0.16, 1, 0.3, 1] }}
            className="mt-9 flex flex-col gap-3 sm:flex-row"
          >
            <Button href="/signup" size="lg">
              Book Your First Session
            </Button>
            <Button variant="outline" size="lg" className="border-white/20 text-white hover:bg-white/5" onClick={() => smoothScrollTo("#pricing")}>
              Explore Plans
            </Button>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="mt-10 flex items-center gap-3"
          >
            <div className="flex -space-x-2.5">
              {AVATARS.map((letter) => (
                <div
                  key={letter}
                  className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-bg bg-brand-yellow/20 text-xs font-bold text-brand-yellow"
                >
                  {letter}
                </div>
              ))}
            </div>
            <p className="text-sm text-white/50">1000+ people already transforming</p>
          </motion.div>

          <ScrollDownIndicator />
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.9, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="relative z-10"
        >
          <TrainingScene sectionRef={sectionRef} />
        </motion.div>
      </div>
    </section>
  );
}

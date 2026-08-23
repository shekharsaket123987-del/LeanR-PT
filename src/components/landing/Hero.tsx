"use client";

import { useRef } from "react";
import Image from "next/image";
import { motion, useMotionValue, useSpring, useTransform, useScroll } from "framer-motion";
import Button from "../ui/Button";
import SectionTag from "../ui/SectionTag";
import { smoothScrollTo } from "@/lib/utils";

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
          <div className="absolute inset-0 rounded-[2rem] border border-brand-yellow/20" style={{ transform: "translate(12px, 12px) translateZ(-40px)" }} />

          <motion.div
            className="glass-strong glow-yellow noise relative overflow-hidden rounded-[2rem] p-3"
            style={{ z: 0 }}
            initial={{ opacity: 0, y: 60, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 1, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="relative aspect-[400/443] w-full overflow-hidden rounded-[1.6rem] bg-black">
              <div className="absolute left-0 top-0 aspect-[1449/1086] w-[181.1%]" style={{ transform: "translateY(-18.42%)" }}>
                <Image
                  src="/leanr-brand/hero-athlete.png"
                  alt="LeanR athlete training live on a plank with a laptop open in front of him"
                  fill
                  priority
                  unoptimized
                  sizes="(max-width: 768px) 160vw, 1160px"
                  className="object-cover"
                />
              </div>
            </div>
          </motion.div>

          {/* live session badge */}
          <motion.div
            style={{ z: 90 }}
            className="absolute -left-3 -top-3 sm:-left-6 sm:-top-4"
            animate={{ y: [0, -8, 0] }}
            transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
          >
            <div className="glass-yellow flex items-center gap-2 rounded-2xl px-3.5 py-2">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
              </span>
              <span className="text-[11px] font-semibold tracking-wide text-white">LIVE SESSION</span>
            </div>
          </motion.div>

          {/* live coach */}
          <motion.div
            style={{ z: 110 }}
            className="absolute -right-4 top-[3%] hidden w-32 sm:-right-8 sm:block sm:w-36"
            animate={{ y: [0, -10, 0] }}
            transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 0.2 }}
          >
            <div className="glass-strong overflow-hidden rounded-2xl p-2.5">
              <p className="text-[10px] uppercase tracking-wider text-white/70">Live Coach</p>
              <div className="relative mt-2 aspect-square w-full overflow-hidden rounded-lg bg-black">
                <div className="absolute left-0 top-0 aspect-[1369/1149] w-[232%]" style={{ transform: "translate(-34.33%, -12.19%) translateZ(30px)" }}>
                  <Image
                    src="/leanr-brand/live-coach.png"
                    alt="Sarah K., LeanR live coach, on a video call"
                    fill
                    unoptimized
                    sizes="200px"
                    className="object-cover"
                  />
                </div>
              </div>
              <p className="mt-2 text-[11px] leading-tight text-white/70">
                Sarah K.
                <br />
                Fitelo Coach
              </p>
              <CallControls />
            </div>
          </motion.div>

          {/* calories burned */}
          <motion.div
            style={{ z: 70 }}
            className="absolute -right-4 top-[58%] hidden w-36 sm:-right-6 sm:block sm:w-40"
            animate={{ y: [0, 8, 0] }}
            transition={{ duration: 4.2, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
          >
            <div className="glass-strong rounded-2xl p-3">
              <p className="text-[10px] uppercase tracking-wider text-white/70">Calories Burned</p>
              <p className="text-display text-lg leading-none text-brand-yellow">
                320 <span className="text-xs">kcal</span>
              </p>
              <Sparkline />
            </div>
          </motion.div>

          {/* workout progress */}
          <motion.div
            style={{ z: 100 }}
            className="absolute -right-3 bottom-[2%] w-40 sm:-right-6 sm:w-44"
            animate={{ y: [0, -6, 0] }}
            transition={{ duration: 4.8, repeat: Infinity, ease: "easeInOut", delay: 0.8 }}
          >
            <div className="glass-strong rounded-2xl px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[10px] uppercase tracking-wider text-white/70">Workout Progress</p>
                <span className="text-xs font-bold text-brand-yellow">68%</span>
              </div>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                <div className="h-full w-[68%] rounded-full bg-brand-yellow" />
              </div>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </motion.div>
  );
}

function ScrollDownIndicator() {
  return (
    <motion.button
      onClick={() => window.scrollBy({ top: window.innerHeight * 0.85, behavior: "smooth" })}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 1, delay: 1.2 }}
      className="mx-auto mt-4 hidden flex-col items-center gap-2 text-white/50 transition-colors hover:text-brand-yellow lg:flex"
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

const AVATARS = ["N", "V", "P", "K"];

export default function Hero() {
  const sectionRef = useRef<HTMLElement>(null);

  return (
    <section ref={sectionRef} className="relative min-h-screen overflow-hidden pb-4 pt-28 md:pt-32">
      <div className="container-px w-full">
        <div className="grid items-start gap-16 lg:grid-cols-[1.05fr_0.95fr]">
          <div>
            <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}>
              <SectionTag>Online Personal Training</SectionTag>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
              className="text-display mt-4 text-[11vw] leading-[0.92] sm:text-5xl md:text-6xl lg:text-[4.25rem]"
            >
              PERSONAL
              <br />
              TRAINING.
              <br />
              <span className="text-glow text-brand-yellow">FROM YOUR SPACE.</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="mt-5 max-w-md text-base text-white/70 sm:text-lg"
            >
              Live 1:1 coaching. Real-time guidance.
              <br className="hidden sm:block" /> Results that stay with you.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.45, ease: [0.16, 1, 0.3, 1] }}
              className="mt-6 flex flex-wrap items-center gap-4"
            >
              <Button href="/signup" size="lg">
                Book 1st Demo <span aria-hidden>→</span>
              </Button>
              <Button variant="secondary" size="lg" onClick={() => smoothScrollTo("#pricing")}>
                Explore Plans
              </Button>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 1, delay: 0.7 }}
              className="mt-8 flex items-center gap-3"
            >
              <div className="flex -space-x-3">
                {AVATARS.map((initial) => (
                  <div key={initial} className="glass-strong ring-surface flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold ring-2">
                    {initial}
                  </div>
                ))}
              </div>
              <p className="text-sm text-white/60">
                <span className="font-semibold text-white">1000+</span> people already transforming
              </p>
            </motion.div>
          </div>

          <TrainingScene sectionRef={sectionRef} />
        </div>

        <ScrollDownIndicator />
      </div>
    </section>
  );
}

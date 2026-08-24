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
import FlipSection from "../ui/FlipSection";
import Reveal from "../ui/Reveal";
import SectionTag from "../ui/SectionTag";
import { cn } from "@/lib/utils";

type Card = {
  icon: string;
  title: string;
  desc: string;
  image: string;
};

const CARDS: Card[] = [
  {
    icon: "🎧",
    title: "Live Coaching",
    desc: "Connect 1:1 with expert coaches in real time.",
    image: "/leanr-brand/live-coaching.png",
  },
  {
    icon: "🏠",
    title: "Train From Your Space",
    desc: "No commute. No distractions. Just you and your goals.",
    image: "/leanr-brand/train-from-space.png",
  },
  {
    icon: "📈",
    title: "Real-Time Guidance",
    desc: "Instant feedback. Correct form. Better results.",
    image: "/leanr-brand/real-time-guidance.png",
  },
];

function CoachCard({ card, index }: { card: Card; index: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const mx = useMotionValue(0);
  const my = useMotionValue(0);

  const rotateX = useSpring(useTransform(my, [-0.5, 0.5], [9, -9]), {
    stiffness: 220,
    damping: 20,
  });
  const rotateY = useSpring(useTransform(mx, [-0.5, 0.5], [-9, 9]), {
    stiffness: 220,
    damping: 20,
  });

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
    index === 0
      ? { x: -80, z: -180, rotateY: -20 }
      : index === 2
      ? { x: 80, z: -180, rotateY: 20 }
      : { y: 60, z: -260, scale: 0.86 };

  return (
    <div style={{ perspective: 1400 }} className="h-full">
      <motion.div
        initial={{ opacity: 0, ...entrance }}
        whileInView={{ opacity: 1, x: 0, y: 0, z: 0, rotateY: 0, scale: 1 }}
        viewport={{ once: true, margin: "0px 0px -15% 0px" }}
        transition={{ duration: 1.1, delay: index * 0.15, ease: [0.16, 1, 0.3, 1] }}
        className="h-full"
      >
        <motion.div
          animate={{ y: [0, -8, 0] }}
          transition={{
            duration: 4.5 + index * 0.5,
            repeat: Infinity,
            ease: "easeInOut",
            delay: index * 0.3,
          }}
          className="h-full"
        >
          <div
            ref={ref}
            onMouseMove={handleMove}
            onMouseLeave={handleLeave}
            className="h-full [perspective:1400px]"
          >
            <motion.div
              style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}
              className="h-full"
            >
              <div
                className={cn(
                  "group relative flex h-full flex-col overflow-hidden rounded-[1.75rem] p-0",
                  index === 1 ? "glass-yellow glow-yellow" : "glass-strong"
                )}
              >
                <div className="relative aspect-[16/9] w-full overflow-hidden bg-black">
                  <Image
                    src={card.image}
                    alt={`${card.title} — LeanR live session preview`}
                    fill
                    unoptimized
                    sizes="(max-width: 768px) 90vw, 420px"
                    className="object-cover transition-transform duration-500 group-hover:scale-110"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
                  <span className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-full border border-brand-yellow/30 bg-black/50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-brand-yellow backdrop-blur-md">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-yellow opacity-75" />
                      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-brand-yellow" />
                    </span>
                    Live
                  </span>
                </div>

                <div className="relative -mt-6 flex justify-center" style={{ transform: "translateZ(40px)" }}>
                  <div className="flex h-11 w-11 items-center justify-center rounded-full glass-strong text-lg glow-yellow">
                    {card.icon}
                  </div>
                </div>

                <div className="flex flex-1 flex-col items-center p-5 pt-2 text-center">
                  <h3 className="text-display text-lg">{card.title}</h3>
                  <p className="mt-1.5 text-xs leading-relaxed text-white/65">{card.desc}</p>
                </div>
              </div>
            </motion.div>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}

export default function CoachingShowsUp() {
  const sectionRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start end", "end start"],
  });

  const bgY = useTransform(scrollYProgress, [0, 1], [-50, 50]);
  const cardsY = useTransform(scrollYProgress, [0, 1], [-16, 16]);

  return (
    <section ref={sectionRef} className="relative min-h-screen overflow-hidden pt-24 pb-4 md:pt-28">
      <motion.div
        style={{ y: bgY }}
        className="pointer-events-none absolute inset-x-0 top-1/2 -z-10 h-[36rem] -translate-y-1/2 bg-[radial-gradient(ellipse_at_center,rgba(245,217,10,0.08),transparent_70%)]"
      />

      <FlipSection className="container-px">
        <Reveal className="max-w-2xl">
          <SectionTag>Why It Feels Different</SectionTag>
          <h2 className="text-display mt-3 text-3xl sm:text-4xl md:text-5xl leading-[0.95]">
            COACHING
            <br />
            <span className="italic-skew text-brand-yellow">THAT SHOWS UP.</span>
          </h2>
        </Reveal>

        <motion.div style={{ y: cardsY }} className="mt-6 grid gap-5 md:grid-cols-3">
          {CARDS.map((card, i) => (
            <CoachCard key={card.title} card={card} index={i} />
          ))}
        </motion.div>
      </FlipSection>
    </section>
  );
}

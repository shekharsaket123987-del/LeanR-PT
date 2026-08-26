"use client";

import { useRef } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { cn } from "@/lib/utils";

/**
 * Shared outer container for every major landing section — a floating
 * dark-glass slab with a subtle mouse-driven tilt, so each section reads as
 * a distinct panel rather than one continuous surface.
 */
export default function GlassSectionPanel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const rotateX = useSpring(useTransform(my, [-0.5, 0.5], [1.6, -1.6]), { stiffness: 100, damping: 24 });
  const rotateY = useSpring(useTransform(mx, [-0.5, 0.5], [-1.6, 1.6]), { stiffness: 100, damping: 24 });

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
    <div ref={ref} onMouseMove={handleMove} onMouseLeave={handleLeave} style={{ perspective: 1800 }}>
      <motion.div
        style={{
          rotateX,
          rotateY,
          transformStyle: "preserve-3d",
          background: "rgba(9, 9, 8, 0.78)",
          backdropFilter: "blur(26px) saturate(150%)",
          WebkitBackdropFilter: "blur(26px) saturate(150%)",
          boxShadow:
            "0 1px 0 0 rgba(255,255,255,0.08) inset, 0 30px 90px -25px rgba(0,0,0,0.85), 0 0 100px -35px rgba(245,217,10,0.22)",
        }}
        className={cn("relative overflow-hidden rounded-[2.5rem] border border-white/[0.14]", className)}
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />
        {children}
      </motion.div>
    </div>
  );
}

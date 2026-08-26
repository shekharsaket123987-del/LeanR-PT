"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { cn } from "@/lib/utils";

/**
 * Wraps a section's content so it rotates in 3D as it scrolls through the
 * viewport — flat and legible while centered, tipped back like a turning
 * page as it enters from below and exits past the top.
 */
export default function FlipSection({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });

  const rotateX = useTransform(scrollYProgress, [0, 0.5, 1], [14, 0, -14]);
  const opacity = useTransform(scrollYProgress, [0, 0.18, 0.82, 1], [0.35, 1, 1, 0.35]);
  const scale = useTransform(scrollYProgress, [0, 0.5, 1], [0.96, 1, 0.96]);

  return (
    <div ref={ref} style={{ perspective: 1600 }} className={cn("w-full", className)}>
      <motion.div
        suppressHydrationWarning
        style={{ rotateX, opacity, scale, transformOrigin: "center" }}
      >
        {children}
      </motion.div>
    </div>
  );
}

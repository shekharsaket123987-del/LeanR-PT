"use client";

import { motion, type HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/utils";

type Variant = "default" | "strong" | "faint" | "yellow";

type GlassCardProps = HTMLMotionProps<"div"> & {
  variant?: Variant;
  glow?: boolean;
  children: React.ReactNode;
};

const variantClass: Record<Variant, string> = {
  default: "glass",
  strong: "glass-strong",
  faint: "glass-faint",
  yellow: "glass-yellow",
};

/**
 * Motion-enabled glass surface for landing-page interactions (mouse tilt,
 * drag carousels, hover glow) — kept separate from `Card` so dashboard
 * pages (rendered dozens of times per screen) don't pay for framer-motion
 * props they never use.
 */
export default function GlassCard({
  variant = "default",
  glow = false,
  className,
  children,
  ...props
}: GlassCardProps) {
  return (
    <motion.div
      className={cn("relative rounded-2xl", variantClass[variant], glow && "glow-yellow", className)}
      {...props}
    >
      {children}
    </motion.div>
  );
}

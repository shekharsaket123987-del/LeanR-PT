"use client";

import { motion, type HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/utils";

type SlideRevealProps = HTMLMotionProps<"div"> & {
  direction?: "left" | "right";
  delay?: number;
  distance?: number;
  children: React.ReactNode;
};

export default function SlideReveal({
  direction = "left",
  delay = 0,
  distance = 60,
  className,
  children,
  ...props
}: SlideRevealProps) {
  const x = direction === "left" ? -distance : distance;
  const rotateY = direction === "left" ? -10 : 10;

  return (
    <motion.div
      initial={{ opacity: 0, x, rotateY }}
      whileInView={{ opacity: 1, x: 0, rotateY: 0 }}
      viewport={{ once: true, margin: "0px 0px -12% 0px" }}
      transition={{ duration: 0.9, delay, ease: [0.16, 1, 0.3, 1] }}
      className={cn(className)}
      {...props}
    >
      {children}
    </motion.div>
  );
}

"use client";

import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import Link from "next/link";
import { ButtonHTMLAttributes } from "react";

type NativeButtonProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "onDrag" | "onDragStart" | "onDragEnd" | "onAnimationStart" | "onAnimationEnd" | "onAnimationIteration"
>;

interface ButtonProps extends NativeButtonProps {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "destructive" | "destructive-outline";
  size?: "sm" | "md" | "lg";
  href?: string;
  target?: string;
  loading?: boolean;
}

const variants: Record<string, string> = {
  primary:
    "bg-brand-yellow text-black shadow-[0_0_40px_-8px_rgba(245,217,10,0.6)] hover:shadow-[0_0_55px_-6px_rgba(245,217,10,0.85)] hover:bg-brand-yellow2",
  secondary: "glass-strong text-white hover:border-white/30",
  outline: "bg-transparent border border-white/15 text-white hover:border-white/40",
  ghost: "bg-transparent text-white/70 hover:bg-white/5 hover:text-white",
  destructive: "bg-red-500/90 text-white hover:bg-red-500",
  "destructive-outline": "bg-transparent border border-red-500/30 text-red-400 hover:bg-red-500/10",
};

const motionProps = {
  whileHover: { scale: 1.035, y: -2 },
  whileTap: { scale: 0.97 },
  transition: { type: "spring", stiffness: 400, damping: 22 } as const,
};

const sizes: Record<string, string> = {
  sm: "px-3.5 py-1.5 text-sm",
  md: "px-5 py-2.5 text-sm",
  lg: "px-7 py-3.5 text-base",
};

export default function Button({
  variant = "primary",
  size = "md",
  href,
  target,
  loading,
  className,
  children,
  disabled,
  ...props
}: ButtonProps) {
  const classes = cn(
    "inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap",
    variants[variant],
    sizes[size],
    className
  );

  if (href) {
    // Link has no native disabled state -- a disabled link that still
    // navigates is worse than no link, so fall back to an inert span.
    if (disabled) {
      return (
        <span className={cn(classes, "opacity-50 cursor-not-allowed")} aria-disabled="true">
          {children}
        </span>
      );
    }
    return (
      <Link href={href} target={target} rel={target === "_blank" ? "noopener noreferrer" : undefined} className="inline-block">
        <motion.span {...motionProps} className={classes}>
          {children}
        </motion.span>
      </Link>
    );
  }

  return (
    <motion.button {...motionProps} className={classes} disabled={disabled || loading} {...props}>
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </motion.button>
  );
}

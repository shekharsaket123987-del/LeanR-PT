import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { ButtonHTMLAttributes } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "destructive" | "destructive-outline";
  size?: "sm" | "md" | "lg";
  href?: string;
  target?: string;
  loading?: boolean;
}

const variants: Record<string, string> = {
  primary: "bg-brand-yellow text-black hover:bg-brand-yellow2 shadow-soft",
  secondary: "bg-black text-white hover:bg-brand-charcoal2",
  outline: "bg-transparent border border-black/15 text-black hover:border-black/40",
  ghost: "bg-transparent text-black hover:bg-black/5",
  destructive: "bg-red-600 text-white hover:bg-red-700",
  "destructive-outline": "bg-transparent border border-red-300 text-red-600 hover:bg-red-50",
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
    "inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap",
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
      <Link href={href} target={target} rel={target === "_blank" ? "noopener noreferrer" : undefined} className={classes}>
        {children}
      </Link>
    );
  }

  return (
    <button className={classes} disabled={disabled || loading} {...props}>
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}

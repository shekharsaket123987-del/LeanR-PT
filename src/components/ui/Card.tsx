import { cn } from "@/lib/utils";
import { HTMLAttributes } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Dark/inverted variant (e.g. StatCard's `accent`). Deliberately a prop
   * rather than passing "bg-black" via `className` -- with plain clsx (no
   * tailwind-merge) two conflicting `bg-*` utility classes in one element
   * resolve by stylesheet order, not by which one appears later in the
   * className string, so an override via className can silently lose to
   * this component's own default and leave light text unreadable on a
   * white card. Keeping the bg/border choice inside Card's own single cn()
   * call means only one of them is ever present at a time. */
  dark?: boolean;
}

export default function Card({ className, dark = false, children, ...props }: CardProps) {
  return (
    <div
      className={cn("rounded-2xl shadow-card", dark ? "glass-yellow" : "glass", className)}
      {...props}
    >
      {children}
    </div>
  );
}

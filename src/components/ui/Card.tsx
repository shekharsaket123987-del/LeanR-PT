import { cn } from "@/lib/utils";
import { HTMLAttributes } from "react";

export default function Card({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("rounded-2xl border border-black/[0.06] bg-white shadow-card", className)}
      {...props}
    >
      {children}
    </div>
  );
}

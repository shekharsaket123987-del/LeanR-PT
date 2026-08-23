import { cn } from "@/lib/utils";

interface BadgeProps {
  children: React.ReactNode;
  variant?: "yellow" | "black" | "green" | "red" | "gray" | "outline-yellow";
  className?: string;
}

const variants: Record<string, string> = {
  yellow: "bg-brand-yellow text-black",
  black: "glass-faint text-white",
  green: "bg-emerald-400/15 text-emerald-400",
  red: "bg-red-400/15 text-red-400",
  gray: "bg-white/[0.06] text-white/60",
  "outline-yellow": "border border-brand-yellow/40 text-brand-yellow bg-brand-yellow/10",
};

export default function Badge({ children, variant = "gray", className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold uppercase tracking-wide",
        variants[variant],
        className
      )}
    >
      {children}
    </span>
  );
}

export function AssessmentBadge({ amountPaid }: { amountPaid?: number | null } = {}) {
  return <Badge variant="outline-yellow">Assessment · {amountPaid ? `₹${amountPaid.toLocaleString("en-IN")}` : "Free"}</Badge>;
}

export function SessionStatusBadge({ status }: { status: string }) {
  const map: Record<string, { variant: any; label: string }> = {
    upcoming: { variant: "black", label: "Upcoming" },
    completed: { variant: "green", label: "Completed" },
    cancelled: { variant: "gray", label: "Cancelled" },
    missed: { variant: "red", label: "Missed" },
    active: { variant: "green", label: "Active" },
    inactive: { variant: "gray", label: "Inactive" },
    paused: { variant: "red", label: "Paused" },
    pending: { variant: "outline-yellow", label: "Pending" },
    approved: { variant: "green", label: "Approved" },
    rejected: { variant: "red", label: "Rejected" },
    "on-leave": { variant: "outline-yellow", label: "On Leave" },
  };
  const m = map[status] ?? { variant: "gray", label: status };
  return <Badge variant={m.variant}>{m.label}</Badge>;
}

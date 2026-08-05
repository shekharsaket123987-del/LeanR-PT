import { LucideIcon } from "lucide-react";
import Card from "./Card";
import { cn } from "@/lib/utils";

export default function StatCard({
  icon: Icon,
  label,
  value,
  change,
  positive = true,
  accent = false,
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  change?: string;
  positive?: boolean;
  accent?: boolean;
}) {
  return (
    <Card dark={accent} className="p-5">
      <div className="flex items-start justify-between">
        <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl", accent ? "bg-brand-yellow" : "bg-brand-yellow/15")}>
          <Icon className={cn("h-5 w-5", accent ? "text-black" : "text-black/70")} strokeWidth={2} />
        </div>
        {change && (
          <span className={cn("text-xs font-bold", positive ? "text-emerald-500" : "text-red-500")}>{change}</span>
        )}
      </div>
      <p className={cn("mt-4 text-display text-3xl font-bold italic leading-none", accent && "text-white")}>{value}</p>
      <p className={cn("mt-1.5 text-sm font-medium", accent ? "text-white/60" : "text-black/50")}>{label}</p>
    </Card>
  );
}

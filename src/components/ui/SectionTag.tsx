import { cn } from "@/lib/utils";

export default function SectionTag({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-full glass-faint px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-brand-yellow",
        className
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-brand-yellow shadow-[0_0_10px_2px_rgba(245,217,10,0.8)]" />
      {children}
    </div>
  );
}

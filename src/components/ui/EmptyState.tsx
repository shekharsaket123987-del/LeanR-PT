import { LucideIcon } from "lucide-react";

export default function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-black/10 bg-white/60 px-6 py-16 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-brand-yellow/15">
        <Icon className="h-7 w-7 text-black/70" strokeWidth={1.75} />
      </div>
      <h3 className="text-display text-lg font-bold italic">{title}</h3>
      <p className="mt-1.5 max-w-sm text-sm text-black/50">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

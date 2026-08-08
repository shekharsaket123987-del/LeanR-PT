import { cn } from "@/lib/utils";

export default function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-lg bg-black/[0.07]", className)} />;
}

export function CardSkeleton() {
  return (
    <div className="rounded-2xl border border-black/[0.06] bg-white p-5 shadow-card">
      <div className="flex items-center gap-3">
        <Skeleton className="h-12 w-12 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3 w-1/2" />
          <Skeleton className="h-3 w-1/3" />
        </div>
      </div>
      <Skeleton className="mt-4 h-3 w-full" />
      <Skeleton className="mt-2 h-3 w-2/3" />
    </div>
  );
}

export function TableRowSkeleton() {
  return (
    <div className="flex items-center gap-4 border-b border-black/5 px-4 py-3">
      <Skeleton className="h-9 w-9 rounded-full" />
      <Skeleton className="h-3 w-1/4" />
      <Skeleton className="h-3 w-1/6" />
      <Skeleton className="h-3 w-1/6" />
      <Skeleton className="ml-auto h-6 w-16 rounded-full" />
    </div>
  );
}

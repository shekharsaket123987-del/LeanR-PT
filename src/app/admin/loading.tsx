import Skeleton, { TableRowSkeleton } from "@/components/ui/Skeleton";

/** Automatic Next.js loading boundary for every /admin/* page -- see
 * client/loading.tsx for the full rationale. Admin pages skew list-heavy
 * (clients, coaches, sessions, sales), so this uses TableRowSkeleton instead
 * of CardSkeleton. */
export default function AdminLoading() {
  return (
    <div className="mx-auto max-w-6xl">
      <Skeleton className="mb-2 h-7 w-56" />
      <Skeleton className="mb-8 h-4 w-72" />
      <div className="overflow-hidden rounded-2xl border border-black/[0.06] bg-white shadow-card">
        <TableRowSkeleton />
        <TableRowSkeleton />
        <TableRowSkeleton />
        <TableRowSkeleton />
      </div>
    </div>
  );
}

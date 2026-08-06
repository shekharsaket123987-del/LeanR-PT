import Skeleton, { CardSkeleton } from "@/components/ui/Skeleton";

/** Automatic Next.js loading boundary for every /coach/* page -- see
 * client/loading.tsx for the full rationale (same pattern, one per portal). */
export default function CoachLoading() {
  return (
    <div className="mx-auto max-w-6xl">
      <Skeleton className="mb-2 h-7 w-56" />
      <Skeleton className="mb-8 h-4 w-72" />
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </div>
    </div>
  );
}

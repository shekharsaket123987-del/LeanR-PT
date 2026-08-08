import Skeleton, { CardSkeleton } from "@/components/ui/Skeleton";

/** Automatic Next.js loading boundary for every /client/* page -- the
 * layout (PortalShell) already renders immediately, so only this content
 * area shows a skeleton while a page's async server component is still
 * fetching. Reuses the existing Skeleton/CardSkeleton primitives, which
 * had never actually been wired into a route before this. */
export default function ClientLoading() {
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

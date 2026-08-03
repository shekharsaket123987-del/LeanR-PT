import { AlertTriangle, MessageCircleWarning } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import { getCoachEscalationsAction } from "@/lib/actions/coach-portal.actions";
import { isFailure } from "@/lib/actions/action-result";
import { CONCERN_CATEGORIES } from "@/lib/constants/concern-categories";
import { formatDate } from "@/lib/utils";

const STATUS_BADGE: Record<string, { variant: any; label: string }> = {
  open: { variant: "red", label: "Open" },
  in_progress: { variant: "outline-yellow", label: "In Progress" },
  resolved: { variant: "green", label: "Resolved" },
};

function categoryLabel(value: string | null) {
  return CONCERN_CATEGORIES.find((c) => c.value === value)?.label ?? "Other";
}

export default async function CoachEscalationsPage() {
  const result = await getCoachEscalationsAction();

  if (isFailure(result)) {
    return (
      <div className="mx-auto max-w-4xl">
        <PageHeader title="Client Escalations" description="Concerns raised by your assigned clients." />
        <EmptyState icon={AlertTriangle} title="Couldn't load escalations" description={result.error.message} />
      </div>
    );
  }

  const escalations = result.data;

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Client Escalations" description="Read-only — only Admin can respond to or resolve these." />

      {escalations.length === 0 && (
        <EmptyState icon={MessageCircleWarning} title="No escalations" description="Your clients haven't raised any concerns." />
      )}

      <div className="space-y-3">
        {escalations.map((e) => {
          const badge = STATUS_BADGE[e.status] ?? STATUS_BADGE.open;
          return (
            <Card key={e.id} className="p-5">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="font-mono text-[11px] font-bold text-black/40">#{e.id.slice(0, 8).toUpperCase()}</span>
                <Badge variant="gray">{categoryLabel(e.category)}</Badge>
                <Badge variant={badge.variant}>{badge.label}</Badge>
                <span className="text-xs text-black/40">{formatDate(e.createdAt)}</span>
              </div>
              <p className="text-sm font-bold">{e.clientName}</p>
              {e.description && <p className="mt-1 text-sm text-black/65">{e.description}</p>}
              {e.status === "resolved" && e.resolutionNotes && (
                <p className="mt-2 rounded-lg bg-emerald-50 p-3 text-xs text-emerald-800">
                  <span className="font-bold">Resolution: </span>
                  {e.resolutionNotes}
                </p>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

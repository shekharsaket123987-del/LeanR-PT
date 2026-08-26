import { AlertTriangle } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import Card from "@/components/ui/Card";
import Badge, { AssessmentBadge } from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import { getAdminSchedulingViewAction, SchedulingEntry } from "@/lib/actions/admin-scheduling.actions";
import { isFailure } from "@/lib/actions/action-result";
import { formatDate, formatTime } from "@/lib/utils";

function Section({ title, entries, emptyLabel }: { title: string; entries: SchedulingEntry[]; emptyLabel: string }) {
  return (
    <div className="mt-8">
      <h2 className="text-display mb-4 text-xl font-bold italic">
        {title} <span className="text-sm font-normal not-italic text-white/40">({entries.length})</span>
      </h2>
      {entries.length === 0 ? (
        <p className="text-sm text-white/45">{emptyLabel}</p>
      ) : (
        <div className="space-y-3">
          {entries.slice(0, 10).map((e) => (
            <Card key={e.id} className="p-4">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-bold">{e.clientName}</p>
                <span className="text-xs text-white/40">with {e.coachName}</span>
                {e.sessionType === "assessment" ? <AssessmentBadge /> : <Badge variant="gray">Regular</Badge>}
                <Badge
                  variant={
                    e.status === "cancelled"
                      ? "red"
                      : e.status === "completed"
                      ? "green"
                      : e.status === "missed"
                      ? "red"
                      : "black"
                  }
                >
                  {e.status}
                </Badge>
              </div>
              <p className="mt-1.5 text-xs text-white/50">
                {formatDate(e.date)} · {formatTime(e.date)}
              </p>
              {e.note && <p className="mt-1.5 text-xs text-white/60">{e.note}</p>}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export default async function AdminSchedulingPage() {
  const result = await getAdminSchedulingViewAction();

  if (isFailure(result)) {
    return (
      <div className="mx-auto max-w-6xl">
        <PageHeader title="Scheduling" description="Cancellations, reschedules, and manual/demo/shadow session activity." />
        <EmptyState icon={AlertTriangle} title="Couldn't load scheduling data" description={result.error.message} />
      </div>
    );
  }

  const data = result.data;

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="Scheduling" description="Cancellations, reschedules, and manual/demo/shadow session activity." />

      <Section title="Today's Changes" entries={data.todaysChanges} emptyLabel="No scheduling changes today." />
      <Section title="Cancelled Sessions" entries={data.cancelled} emptyLabel="No cancelled sessions." />
      <Section title="Rescheduled Sessions" entries={data.rescheduled} emptyLabel="No rescheduled sessions." />
      <Section title="Manual Sessions Created" entries={data.manual} emptyLabel="No manually created sessions." />
      <Section title="Demo Sessions" entries={data.demo} emptyLabel="No demo sessions." />
      <Section title="Shadow Sessions" entries={data.shadow} emptyLabel="No shadow sessions." />
    </div>
  );
}

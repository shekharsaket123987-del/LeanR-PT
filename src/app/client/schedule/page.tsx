import { AlertTriangle } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import ScheduleSetupClient from "@/components/client/ScheduleSetupClient";
import { getScheduleSetupOptionsAction } from "@/lib/actions/schedule.actions";
import { isFailure } from "@/lib/actions/action-result";

const DAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default async function SchedulePage() {
  const result = await getScheduleSetupOptionsAction();

  if (isFailure(result)) {
    return (
      <div className="mx-auto max-w-2xl">
        <PageHeader title="Set Your Recurring Schedule" description="Reserve a permanent weekly training pattern with your coach." />
        <EmptyState icon={AlertTriangle} title="Can't set up your schedule right now" description={result.error.message} />
      </div>
    );
  }

  const data = result.data;

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Set Your Recurring Schedule" description="Reserve a permanent weekly training pattern with your coach." />

      {data.existingSchedule ? (
        <Card className="p-6">
          <p className="text-sm font-bold">You already have an active recurring schedule</p>
          <ul className="mt-3 space-y-1 text-sm text-black/60">
            {data.existingSchedule.map((s, i) => (
              <li key={i}>
                {DAY_LABELS[s.dayOfWeek]} at {s.startTime.slice(0, 5)}
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-black/40">Contact support to change your recurring schedule.</p>
        </Card>
      ) : (
        <ScheduleSetupClient options={data} />
      )}
    </div>
  );
}

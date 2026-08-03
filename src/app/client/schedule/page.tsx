import { AlertTriangle } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/ui/EmptyState";
import ScheduleSetupClient from "@/components/client/ScheduleSetupClient";
import ChangeScheduleClient from "@/components/client/ChangeScheduleClient";
import { getScheduleSetupOptionsAction } from "@/lib/actions/schedule.actions";
import { isFailure } from "@/lib/actions/action-result";

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
        <ChangeScheduleClient existingSchedule={data.existingSchedule} />
      ) : (
        <ScheduleSetupClient options={data} />
      )}
    </div>
  );
}

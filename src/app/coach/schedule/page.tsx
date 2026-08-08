import { AlertTriangle } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/ui/EmptyState";
import CoachScheduleClient from "@/components/coach/CoachScheduleClient";
import { getCoachScheduleAction } from "@/lib/actions/coach-portal.actions";
import { isFailure } from "@/lib/actions/action-result";

export default async function CoachSchedulePage() {
  const result = await getCoachScheduleAction();

  if (isFailure(result)) {
    return (
      <div className="mx-auto max-w-6xl">
        <PageHeader title="Schedule" description="Your upcoming bookings, day by day." />
        <EmptyState icon={AlertTriangle} title="Couldn't load your schedule" description={result.error.message} />
      </div>
    );
  }

  return <CoachScheduleClient sessions={result.data} />;
}

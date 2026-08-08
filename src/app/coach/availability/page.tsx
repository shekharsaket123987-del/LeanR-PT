import { AlertTriangle } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/ui/EmptyState";
import CoachAvailabilityClient from "@/components/coach/CoachAvailabilityClient";
import { getCoachAvailabilityAction } from "@/lib/actions/coach-portal.actions";
import { isFailure } from "@/lib/actions/action-result";

export default async function AvailabilityPage() {
  const result = await getCoachAvailabilityAction();

  if (isFailure(result)) {
    return (
      <div className="mx-auto max-w-3xl">
        <PageHeader title="Availability" description="Set your working hours and manage time off." />
        <EmptyState icon={AlertTriangle} title="Couldn't load your availability" description={result.error.message} />
      </div>
    );
  }

  return <CoachAvailabilityClient initialWindows={result.data.windows} initialLeave={result.data.leave} />;
}

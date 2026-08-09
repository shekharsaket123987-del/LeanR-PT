import { redirect } from "next/navigation";
import PageHeader from "@/components/shared/PageHeader";
import RenewalCheckinClient from "@/components/client/RenewalCheckinClient";
import { getMyJourneyStateAction } from "@/lib/actions/client-journey.actions";
import { getMyProgressAction } from "@/lib/actions/client-progress.actions";
import { isFailure } from "@/lib/actions/action-result";

export default async function RenewalCheckinPage() {
  const [journeyResult, progressResult] = await Promise.all([getMyJourneyStateAction(), getMyProgressAction()]);

  // Direct navigation from any other stage bounces back to the dashboard
  // gate, same guard convention as the other stage-specific pages.
  if (isFailure(journeyResult) || journeyResult.data.stage !== "renewal_checkin") {
    redirect("/client/dashboard");
  }

  const priorLogs = isFailure(progressResult) ? [] : progressResult.data.logs;

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Welcome Back" description="A quick check-in before we set up your renewed plan." />
      <RenewalCheckinClient priorLogs={priorLogs} />
    </div>
  );
}

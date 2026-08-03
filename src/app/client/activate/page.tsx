import { redirect } from "next/navigation";
import PageHeader from "@/components/shared/PageHeader";
import ActivatePlanClient from "@/components/client/ActivatePlanClient";
import { getMyJourneyStateAction } from "@/lib/actions/client-journey.actions";
import { isFailure } from "@/lib/actions/action-result";

export default async function ActivatePlanPage() {
  const result = await getMyJourneyStateAction();
  if (isFailure(result) || result.data.stage !== "awaiting_activation" || !result.data.subscriptionId) {
    redirect("/client/dashboard");
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Activate Your Plan" description="One last step before your PT journey begins." />
      <ActivatePlanClient subscriptionId={result.data.subscriptionId} packageName={result.data.packageName} />
    </div>
  );
}

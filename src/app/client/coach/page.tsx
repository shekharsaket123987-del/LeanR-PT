import PageHeader from "@/components/shared/PageHeader";
import MyCoachClient from "@/components/client/MyCoachClient";
import { getMyCoachAction } from "@/lib/actions/client-coach.actions";
import { getMyCoachChangeRequestAction } from "@/lib/actions/client-coach-change.actions";
import { isFailure } from "@/lib/actions/action-result";

export default async function MyCoachPage() {
  const [coachResult, requestResult] = await Promise.all([getMyCoachAction(), getMyCoachChangeRequestAction()]);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="My Coach" description="Your dedicated coach for this plan." />
      <MyCoachClient coach={isFailure(coachResult) ? null : coachResult.data} request={isFailure(requestResult) ? null : requestResult.data} />
    </div>
  );
}

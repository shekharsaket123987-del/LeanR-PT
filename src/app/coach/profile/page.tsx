import PageHeader from "@/components/shared/PageHeader";
import CoachProfileClient from "@/components/coach/CoachProfileClient";
import { getMyCoachProfileAction } from "@/lib/actions/coach-profile.actions";
import { isFailure } from "@/lib/actions/action-result";

export default async function CoachProfilePage() {
  const result = await getMyCoachProfileAction();

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Profile" description="How clients see you across LEANR." />
      {isFailure(result) ? (
        <p className="text-sm text-red-600">{result.error.message}</p>
      ) : (
        <CoachProfileClient profile={result.data} />
      )}
    </div>
  );
}

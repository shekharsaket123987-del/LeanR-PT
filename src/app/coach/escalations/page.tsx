import { AlertTriangle } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/ui/EmptyState";
import CoachEscalationsClient from "@/components/coach/CoachEscalationsClient";
import { getCoachEscalationsAction } from "@/lib/actions/coach-portal.actions";
import { isFailure } from "@/lib/actions/action-result";

export default async function CoachEscalationsPage() {
  const result = await getCoachEscalationsAction();

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Client Escalations" description="Read-only — only Admin can respond to or resolve these." />
      {isFailure(result) ? (
        <EmptyState icon={AlertTriangle} title="Couldn't load escalations" description={result.error.message} />
      ) : (
        <CoachEscalationsClient escalations={result.data} />
      )}
    </div>
  );
}

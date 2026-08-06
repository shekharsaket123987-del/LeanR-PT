import { AlertTriangle } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/ui/EmptyState";
import ShadowCoverageQueueClient from "@/components/admin/ShadowCoverageQueueClient";
import { listShadowCoverageGapsAction } from "@/lib/actions/admin-shadow-coach.actions";
import { isFailure } from "@/lib/actions/action-result";

export default async function ShadowCoverageQueuePage() {
  const result = await listShadowCoverageGapsAction();

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Shadow Coach Required"
        description="Sessions whose coach is on approved leave and still have no shadow coverage."
      />
      {isFailure(result) ? (
        <EmptyState icon={AlertTriangle} title="Couldn't load this list" description={result.error.message} />
      ) : (
        <ShadowCoverageQueueClient gaps={result.data} />
      )}
    </div>
  );
}

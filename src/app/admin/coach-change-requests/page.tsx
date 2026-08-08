import { AlertTriangle } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/ui/EmptyState";
import CoachChangeRequestsClient from "@/components/admin/CoachChangeRequestsClient";
import { listCoachChangeRequestsAction } from "@/lib/actions/admin-coach-change.actions";
import { isFailure } from "@/lib/actions/action-result";

export default async function CoachChangeRequestsPage() {
  const result = await listCoachChangeRequestsAction();

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Coach Change Requests" description="Review and resolve client requests to switch coaches." />
      {isFailure(result) ? (
        <EmptyState icon={AlertTriangle} title="Couldn't load requests" description={result.error.message} />
      ) : (
        <CoachChangeRequestsClient data={result.data} />
      )}
    </div>
  );
}

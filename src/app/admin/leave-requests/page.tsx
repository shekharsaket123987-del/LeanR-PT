import { AlertTriangle } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/ui/EmptyState";
import LeaveRequestsClient from "@/components/admin/LeaveRequestsClient";
import { listPendingLeaveAction } from "@/lib/actions/admin-leave.actions";
import { isFailure } from "@/lib/actions/action-result";

export default async function LeaveRequestsPage() {
  const result = await listPendingLeaveAction();

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Leave Requests" description="Review and resolve coach leave requests." />
      {isFailure(result) ? (
        <EmptyState icon={AlertTriangle} title="Couldn't load leave requests" description={result.error.message} />
      ) : (
        <LeaveRequestsClient requests={result.data} />
      )}
    </div>
  );
}

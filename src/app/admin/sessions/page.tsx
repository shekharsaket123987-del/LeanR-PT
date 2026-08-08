import { AlertTriangle } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/ui/EmptyState";
import AdminSessionsClient from "@/components/admin/AdminSessionsClient";
import { listAdminSessionsAction } from "@/lib/actions/admin-sessions.actions";
import { listAdminCoachOptionsAction } from "@/lib/actions/admin-clients.actions";
import { isFailure } from "@/lib/actions/action-result";

export default async function AdminSessionsPage() {
  const [sessionsResult, coachesResult] = await Promise.all([listAdminSessionsAction(), listAdminCoachOptionsAction()]);

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader title="Sessions" description="Master list of every session across the platform." />
      {isFailure(sessionsResult) ? (
        <EmptyState icon={AlertTriangle} title="Couldn't load sessions" description={sessionsResult.error.message} />
      ) : (
        <AdminSessionsClient sessions={sessionsResult.data} coaches={isFailure(coachesResult) ? [] : coachesResult.data} />
      )}
    </div>
  );
}

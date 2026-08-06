import { AlertTriangle } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/ui/EmptyState";
import AdminEscalationsClient from "@/components/admin/AdminEscalationsClient";
import { listAllEscalationsAction } from "@/lib/actions/admin-escalations.actions";
import { isFailure } from "@/lib/actions/action-result";

export default async function AdminEscalationsPage() {
  const result = await listAllEscalationsAction();

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Escalations" description="Every client concern raised across the platform." />
      {isFailure(result) ? (
        <EmptyState icon={AlertTriangle} title="Couldn't load escalations" description={result.error.message} />
      ) : (
        <AdminEscalationsClient escalations={result.data} />
      )}
    </div>
  );
}

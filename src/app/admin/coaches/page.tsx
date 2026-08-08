import { AlertTriangle } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import AdminCoachesListClient from "@/components/admin/AdminCoachesListClient";
import { listAdminCoachesAction } from "@/lib/actions/admin-coach.actions";
import { isFailure } from "@/lib/actions/action-result";

export default async function AdminCoachesPage() {
  const result = await listAdminCoachesAction();

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Coaches"
        description={isFailure(result) ? "Coaches on the platform." : `${result.data.length} coaches on the platform.`}
        action={<Button href="/admin/coaches/new">+ Add Coach</Button>}
      />
      {isFailure(result) ? (
        <EmptyState icon={AlertTriangle} title="Couldn't load coaches" description={result.error.message} />
      ) : (
        <AdminCoachesListClient coaches={result.data} />
      )}
    </div>
  );
}

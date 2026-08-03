import { AlertTriangle } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/ui/EmptyState";
import AdminDashboardClient from "@/components/admin/AdminDashboardClient";
import { getAdminDashboardAction } from "@/lib/actions/admin-dashboard.actions";
import { isFailure } from "@/lib/actions/action-result";

export default async function AdminDashboardPage() {
  const result = await getAdminDashboardAction();

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader title="Overview" description="Platform performance across clients, coaches, and sessions." />
      {isFailure(result) ? (
        <EmptyState icon={AlertTriangle} title="Couldn't load dashboard" description={result.error.message} />
      ) : (
        <AdminDashboardClient data={result.data} />
      )}
    </div>
  );
}

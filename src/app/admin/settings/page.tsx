import { AlertTriangle } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/ui/EmptyState";
import AdminSettingsClient from "@/components/admin/AdminSettingsClient";
import { getAdminSettingsAction } from "@/lib/actions/admin-settings.actions";
import { isFailure } from "@/lib/actions/action-result";

export default async function AdminSettingsPage() {
  const result = await getAdminSettingsAction();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title="Settings" description="Platform-wide rules and package configuration." />
      {isFailure(result) ? (
        <EmptyState icon={AlertTriangle} title="Couldn't load settings" description={result.error.message} />
      ) : (
        <AdminSettingsClient data={result.data} />
      )}
    </div>
  );
}

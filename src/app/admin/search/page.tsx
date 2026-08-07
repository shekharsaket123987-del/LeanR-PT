import { AlertTriangle } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/ui/EmptyState";
import AdminSearchClient from "@/components/admin/AdminSearchClient";
import { searchAdminClientsAction } from "@/lib/actions/admin-clients.actions";
import { isFailure } from "@/lib/actions/action-result";

export default async function AdminSearchPage() {
  const result = await searchAdminClientsAction();

  return (
    <div>
      <PageHeader title="Search" description="Look up any client on the platform by name, ID, or phone." />
      {isFailure(result) ? (
        <EmptyState icon={AlertTriangle} title="Couldn't load clients" description={result.error.message} />
      ) : (
        <AdminSearchClient clients={result.data} />
      )}
    </div>
  );
}

import { AlertTriangle } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import AdminClientsListClient from "@/components/admin/AdminClientsListClient";
import { listAdminClientsAction } from "@/lib/actions/admin-clients.actions";
import { isFailure } from "@/lib/actions/action-result";

export default async function AdminClientsPage() {
  const result = await listAdminClientsAction();

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Clients"
        description={isFailure(result) ? "All clients on the platform." : `${result.data.length} total clients on the platform.`}
        action={<Button href="/admin/clients/new">+ Add Client</Button>}
      />
      {isFailure(result) ? (
        <EmptyState icon={AlertTriangle} title="Couldn't load clients" description={result.error.message} />
      ) : (
        <AdminClientsListClient clients={result.data} />
      )}
    </div>
  );
}

import { AlertTriangle } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/ui/EmptyState";
import AdminSalesClient from "@/components/admin/AdminSalesClient";
import { listSalesAction } from "@/lib/actions/admin-sales.actions";
import { isFailure } from "@/lib/actions/action-result";

export default async function AdminSalesPage() {
  const result = await listSalesAction();

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Sales" description="Every plan purchase, transaction-level." />
      {isFailure(result) ? (
        <EmptyState icon={AlertTriangle} title="Couldn't load sales" description={result.error.message} />
      ) : (
        <AdminSalesClient sales={result.data} />
      )}
    </div>
  );
}

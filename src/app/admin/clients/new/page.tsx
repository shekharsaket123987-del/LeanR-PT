import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/ui/EmptyState";
import { AlertTriangle } from "lucide-react";
import AddClientForm from "@/components/admin/AddClientForm";
import { listPackageOptionsAction, listAdminCoachOptionsAction } from "@/lib/actions/admin-clients.actions";
import { isFailure } from "@/lib/actions/action-result";

export default async function NewClientPage() {
  const [packagesResult, coachesResult] = await Promise.all([listPackageOptionsAction(), listAdminCoachOptionsAction()]);

  if (isFailure(packagesResult) || isFailure(coachesResult)) {
    return (
      <div className="mx-auto max-w-3xl">
        <PageHeader title="Add Client" description="Migrate an existing client into LEANR." />
        <EmptyState
          icon={AlertTriangle}
          title="Couldn't load this form"
          description={isFailure(packagesResult) ? packagesResult.error.message : (coachesResult as any).error.message}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Add Client"
        description="Create an existing client's account directly -- for migrating a roster tracked outside LEANR (a spreadsheet, another system), mid-plan."
      />
      <AddClientForm packages={packagesResult.data} coaches={coachesResult.data} />
    </div>
  );
}

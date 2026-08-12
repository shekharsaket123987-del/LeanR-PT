import { AlertTriangle } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/ui/EmptyState";
import AdminEscalationDetailClient from "@/components/admin/AdminEscalationDetailClient";
import { getEscalationDetailAction } from "@/lib/actions/admin-escalations.actions";
import { isFailure } from "@/lib/actions/action-result";

export default async function AdminEscalationDetailPage({ params }: { params: { id: string } }) {
  const result = await getEscalationDetailAction(params.id);

  if (isFailure(result)) {
    return (
      <div className="mx-auto max-w-3xl">
        <PageHeader title="Escalation" description="" />
        <EmptyState icon={AlertTriangle} title="Couldn't load this escalation" description={result.error.message} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={`Escalation · ${result.data.clientName}`} description="Work this case through to resolution." />
      <AdminEscalationDetailClient escalation={result.data} />
    </div>
  );
}

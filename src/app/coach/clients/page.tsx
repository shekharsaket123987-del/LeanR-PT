import { AlertTriangle } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/ui/EmptyState";
import CoachClientsClient from "@/components/coach/CoachClientsClient";
import { getCoachClientsAction } from "@/lib/actions/coach-portal.actions";
import { isFailure } from "@/lib/actions/action-result";

export default async function CoachClientsPage() {
  const result = await getCoachClientsAction();

  if (isFailure(result)) {
    return (
      <div className="mx-auto max-w-4xl">
        <PageHeader title="Clients" description="Clients currently assigned to you." />
        <EmptyState icon={AlertTriangle} title="Couldn't load your clients" description={result.error.message} />
      </div>
    );
  }

  const clients = result.data;

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="Clients" description={`${clients.length} clients currently assigned to you.`} />
      <CoachClientsClient clients={clients} />
    </div>
  );
}

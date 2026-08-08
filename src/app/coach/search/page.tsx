import { AlertTriangle } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/ui/EmptyState";
import CoachSearchClient from "@/components/coach/CoachSearchClient";
import { searchAllClientsAction } from "@/lib/actions/coach-portal.actions";
import { isFailure } from "@/lib/actions/action-result";

export default async function CoachSearchPage() {
  const result = await searchAllClientsAction();

  return (
    <div>
      <PageHeader title="Search" description="Look up any client on the platform." />
      {isFailure(result) ? (
        <EmptyState icon={AlertTriangle} title="Couldn't load clients" description={result.error.message} />
      ) : (
        <CoachSearchClient clients={result.data} />
      )}
    </div>
  );
}

import { AlertTriangle } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/ui/EmptyState";
import PlansMarketingClient from "@/components/client/PlansMarketingClient";
import { listMarketingPlansAction } from "@/lib/actions/client-journey.actions";
import { isFailure } from "@/lib/actions/action-result";

export default async function ClientPlansPage() {
  const result = await listMarketingPlansAction();

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="Choose Your Plan" description="Pick a PT plan or try a demo session first." />
      {isFailure(result) ? (
        <EmptyState icon={AlertTriangle} title="Couldn't load plans" description={result.error.message} />
      ) : (
        <PlansMarketingClient plans={result.data} />
      )}
    </div>
  );
}

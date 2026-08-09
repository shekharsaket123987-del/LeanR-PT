import { AlertTriangle } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/ui/EmptyState";
import RenewalOpportunitiesClient from "@/components/shared/RenewalOpportunitiesClient";
import { getRenewalOpportunitiesAction } from "@/lib/actions/renewals.actions";
import { isFailure } from "@/lib/actions/action-result";

export default async function CoachRenewalsPage() {
  const result = await getRenewalOpportunitiesAction();
  if (isFailure(result)) {
    return (
      <div className="mx-auto max-w-5xl">
        <PageHeader title="Renewal Opportunities" description="Clients running low on sessions, and who's already renewed." />
        <EmptyState icon={AlertTriangle} title="Can't load renewals right now" description={result.error.message} />
      </div>
    );
  }
  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="Renewal Opportunities" description="Clients running low on sessions, and who's already renewed." />
      <RenewalOpportunitiesClient rows={result.data} role="coach" />
    </div>
  );
}

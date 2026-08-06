import { AlertTriangle } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/ui/EmptyState";
import MySubscriptionClient from "@/components/client/MySubscriptionClient";
import { getMySubscriptionAction } from "@/lib/actions/client-portal.actions";
import { isFailure } from "@/lib/actions/action-result";

export default async function ClientSubscriptionPage() {
  const result = await getMySubscriptionAction();

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Subscription & Payments" description="Your plan, remaining sessions, and payment history." />
      {isFailure(result) ? (
        <EmptyState icon={AlertTriangle} title="Couldn't load your subscription" description={result.error.message} />
      ) : (
        <MySubscriptionClient subscription={result.data} />
      )}
    </div>
  );
}

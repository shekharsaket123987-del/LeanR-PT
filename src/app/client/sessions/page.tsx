import { AlertTriangle } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/ui/EmptyState";
import MySessionsClient from "@/components/client/MySessionsClient";
import { getClientSessionsAction } from "@/lib/actions/client-portal.actions";
import { isFailure } from "@/lib/actions/action-result";

export default async function MySessionsPage() {
  const result = await getClientSessionsAction();

  if (isFailure(result)) {
    return (
      <div className="mx-auto max-w-4xl">
        <PageHeader title="My Sessions" description="Everything you've booked, past and upcoming." />
        <EmptyState icon={AlertTriangle} title="Couldn't load your sessions" description={result.error.message} />
      </div>
    );
  }

  return <MySessionsClient initialSessions={result.data} />;
}

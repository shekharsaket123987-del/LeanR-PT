import { AlertTriangle } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/ui/EmptyState";
import MyConcernsClient from "@/components/client/MyConcernsClient";
import { listMyConcernsAction } from "@/lib/actions/client-concerns.actions";
import { isFailure } from "@/lib/actions/action-result";

export default async function MyConcernsPage() {
  const result = await listMyConcernsAction();

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="My Concerns" description="Raise and track anything that needs our attention -- no WhatsApp or email required." />
      {isFailure(result) ? (
        <EmptyState icon={AlertTriangle} title="Couldn't load your concerns" description={result.error.message} />
      ) : (
        <MyConcernsClient concerns={result.data} />
      )}
    </div>
  );
}

import { AlertTriangle } from "lucide-react";
import EmptyState from "@/components/ui/EmptyState";
import CoachSessionClient from "@/components/coach/CoachSessionClient";
import { getCoachSessionDetailAction } from "@/lib/actions/coach-portal.actions";
import { isFailure } from "@/lib/actions/action-result";

export default async function SessionDetailPage({ params }: { params: { id: string } }) {
  const result = await getCoachSessionDetailAction(params.id);

  if (isFailure(result)) {
    return (
      <div className="mx-auto max-w-3xl">
        <EmptyState icon={AlertTriangle} title="Couldn't load this session" description={result.error.message} />
      </div>
    );
  }

  return <CoachSessionClient session={result.data} />;
}

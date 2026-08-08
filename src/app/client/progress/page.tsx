import { AlertTriangle } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/ui/EmptyState";
import ProgressClient from "@/components/client/ProgressClient";
import { getMyProgressAction } from "@/lib/actions/client-progress.actions";
import { getClientSessionsAction } from "@/lib/actions/client-portal.actions";
import { isFailure } from "@/lib/actions/action-result";

export default async function ProgressPage() {
  const [progressResult, sessionsResult] = await Promise.all([getMyProgressAction(), getClientSessionsAction()]);

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Progress" description="Your journey with LEANR, tracked session by session." />
      {isFailure(progressResult) ? (
        <EmptyState icon={AlertTriangle} title="Couldn't load progress" description={progressResult.error.message} />
      ) : (
        <ProgressClient progress={progressResult.data} history={isFailure(sessionsResult) ? [] : sessionsResult.data} />
      )}
    </div>
  );
}

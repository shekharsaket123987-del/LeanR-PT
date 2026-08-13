import { AlertTriangle } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/ui/EmptyState";
import MySessionsClient from "@/components/client/MySessionsClient";
import { getClientSessionsAction, getSchedulingRulesAction } from "@/lib/actions/client-portal.actions";
import { getMyShadowCoachNoticeAction } from "@/lib/actions/client-notifications.actions";
import { isFailure } from "@/lib/actions/action-result";

export default async function MySessionsPage() {
  const [result, rulesResult, noticeResult] = await Promise.all([
    getClientSessionsAction(),
    getSchedulingRulesAction(),
    getMyShadowCoachNoticeAction(),
  ]);

  if (isFailure(result)) {
    return (
      <div className="mx-auto max-w-4xl">
        <PageHeader title="My Sessions" description="Everything you've booked, past and upcoming." />
        <EmptyState icon={AlertTriangle} title="Couldn't load your sessions" description={result.error.message} />
      </div>
    );
  }

  const rules = isFailure(rulesResult)
    ? { cancellationCutoffHours: 12, rescheduleCutoffHours: 1, reschedulesUsedThisWeek: 0, reschedulesRemaining: 2 }
    : rulesResult.data;
  const shadowNotice = isFailure(noticeResult) ? null : noticeResult.data;

  return <MySessionsClient initialSessions={result.data} rules={rules} initialShadowNotice={shadowNotice} />;
}

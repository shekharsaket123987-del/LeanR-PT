import PageHeader from "@/components/shared/PageHeader";
import NotificationsClient from "@/components/client/NotificationsClient";
import { listMyNotificationsAction } from "@/lib/actions/client-notifications.actions";
import { isFailure } from "@/lib/actions/action-result";

export default async function CoachNotificationsPage() {
  const result = await listMyNotificationsAction();

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Notifications" description="Client assignments, leave decisions, escalations, and schedule changes." />
      {isFailure(result) ? (
        <p className="text-sm text-red-400">{result.error.message}</p>
      ) : (
        <NotificationsClient initialNotifications={result.data} />
      )}
    </div>
  );
}

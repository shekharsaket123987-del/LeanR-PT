import PageHeader from "@/components/shared/PageHeader";
import NotificationsClient from "@/components/client/NotificationsClient";
import { listMyNotificationsAction } from "@/lib/actions/client-notifications.actions";
import { isFailure } from "@/lib/actions/action-result";

export default async function AdminNotificationsPage() {
  const result = await listMyNotificationsAction();

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Notifications" description="System alerts: unresolved shadow coverage, leave requests, escalations, and more." />
      {isFailure(result) ? (
        <p className="text-sm text-red-600">{result.error.message}</p>
      ) : (
        <NotificationsClient initialNotifications={result.data} />
      )}
    </div>
  );
}

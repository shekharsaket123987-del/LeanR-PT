import { AlertTriangle, Scale } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import AdminClientDetailClient from "@/components/admin/AdminClientDetailClient";
import { getAdminClientDetailAction, listAdminCoachOptionsAction } from "@/lib/actions/admin-clients.actions";
import { getClientTimelineAction } from "@/lib/actions/admin-timeline.actions";
import { listEscalationsForClientAction } from "@/lib/actions/admin-escalations.actions";
import { getClientChatsForAdminAction } from "@/lib/actions/chat.actions";
import { isFailure } from "@/lib/actions/action-result";
import { formatDate } from "@/lib/utils";

export default async function AdminClientDetailPage({ params }: { params: { id: string } }) {
  const [clientResult, coachesResult, timelineResult, escalationsResult, chatsResult] = await Promise.all([
    getAdminClientDetailAction(params.id),
    listAdminCoachOptionsAction(),
    getClientTimelineAction(params.id),
    listEscalationsForClientAction(params.id),
    getClientChatsForAdminAction(params.id),
  ]);

  if (isFailure(clientResult)) {
    return (
      <div className="mx-auto max-w-5xl">
        <EmptyState icon={AlertTriangle} title="Couldn't load this client" description={clientResult.error.message} />
      </div>
    );
  }

  const client = clientResult.data;
  const coaches = isFailure(coachesResult) ? [] : coachesResult.data;
  const timelineEvents = isFailure(timelineResult) ? [] : timelineResult.data;
  const escalations = isFailure(escalationsResult) ? [] : escalationsResult.data;
  const conversations = isFailure(chatsResult) ? [] : chatsResult.data;

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title={client.name}
        description={`${client.subscription?.packageName ?? "No active package"} · Client since ${formatDate(client.joinedDate)}`}
        action={
          <div className="flex items-center gap-2">
            <Badge variant={client.status === "active" ? "green" : client.status === "paused" ? "red" : "gray"}>{client.status}</Badge>
            {client.measurementsStale && (
              <Badge variant="red">
                <Scale className="h-3 w-3" /> Measurements Overdue
              </Badge>
            )}
          </div>
        }
      />
      <AdminClientDetailClient
        client={client}
        coaches={coaches}
        timelineEvents={timelineEvents}
        escalations={escalations}
        conversations={conversations}
      />
    </div>
  );
}

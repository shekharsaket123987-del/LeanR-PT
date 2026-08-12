import PortalShell from "@/components/shared/PortalShell";
import CoachPendingTasksGateModal from "@/components/coach/CoachPendingTasksGateModal";
import { getAccessToken } from "@/lib/supabase/server-client";
import { getMyPortalIdentity } from "@/lib/services/profiles.service";
import { getMyUnreadChatCountAsCoachAction } from "@/lib/actions/chat.actions";
import { getCoachPendingTasksAction, getMyUnresolvedEscalationsCountAction } from "@/lib/actions/coach-portal.actions";
import { isFailure } from "@/lib/actions/action-result";

export default async function CoachPortalLayout({ children }: { children: React.ReactNode }) {
  let identity;
  try {
    const token = await getAccessToken();
    identity = token ? await getMyPortalIdentity(token, "coach") : undefined;
  } catch {
    identity = undefined;
  }

  const [unreadResult, pendingResult, escalationsResult] = await Promise.all([
    getMyUnreadChatCountAsCoachAction(),
    getCoachPendingTasksAction(),
    getMyUnresolvedEscalationsCountAction(),
  ]);
  const chatUnreadCount = !isFailure(unreadResult) ? unreadResult.data : 0;
  const pendingTasks = !isFailure(pendingResult) ? pendingResult.data : [];
  const escalationBadgeCount = !isFailure(escalationsResult) ? escalationsResult.data : 0;

  return (
    <PortalShell role="coach" identity={identity} chatUnreadCount={chatUnreadCount} escalationBadgeCount={escalationBadgeCount}>
      {children}
      <CoachPendingTasksGateModal initialPendingTasks={pendingTasks} />
    </PortalShell>
  );
}

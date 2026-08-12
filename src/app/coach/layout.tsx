import PortalShell from "@/components/shared/PortalShell";
import CoachPendingTasksGateModal from "@/components/coach/CoachPendingTasksGateModal";
import { getAccessToken } from "@/lib/supabase/server-client";
import { getMyPortalIdentity } from "@/lib/services/profiles.service";
import { getMyUnreadChatCountAsCoachAction } from "@/lib/actions/chat.actions";
import { getCoachPendingTasksAction } from "@/lib/actions/coach-portal.actions";
import { isFailure } from "@/lib/actions/action-result";

export default async function CoachPortalLayout({ children }: { children: React.ReactNode }) {
  let identity;
  try {
    const token = await getAccessToken();
    identity = token ? await getMyPortalIdentity(token, "coach") : undefined;
  } catch {
    identity = undefined;
  }

  const [unreadResult, pendingResult] = await Promise.all([getMyUnreadChatCountAsCoachAction(), getCoachPendingTasksAction()]);
  const chatUnreadCount = !isFailure(unreadResult) ? unreadResult.data : 0;
  const pendingTasks = !isFailure(pendingResult) ? pendingResult.data : [];

  return (
    <PortalShell role="coach" identity={identity} chatUnreadCount={chatUnreadCount}>
      {children}
      <CoachPendingTasksGateModal initialPendingTasks={pendingTasks} />
    </PortalShell>
  );
}

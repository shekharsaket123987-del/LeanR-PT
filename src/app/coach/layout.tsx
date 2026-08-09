import PortalShell from "@/components/shared/PortalShell";
import { getAccessToken } from "@/lib/supabase/server-client";
import { getMyPortalIdentity } from "@/lib/services/profiles.service";
import { getMyUnreadChatCountAsCoachAction } from "@/lib/actions/chat.actions";
import { isFailure } from "@/lib/actions/action-result";

export default async function CoachPortalLayout({ children }: { children: React.ReactNode }) {
  let identity;
  try {
    const token = await getAccessToken();
    identity = token ? await getMyPortalIdentity(token, "coach") : undefined;
  } catch {
    identity = undefined;
  }

  const unreadResult = await getMyUnreadChatCountAsCoachAction();
  const chatUnreadCount = !isFailure(unreadResult) ? unreadResult.data : 0;

  return (
    <PortalShell role="coach" identity={identity} chatUnreadCount={chatUnreadCount}>
      {children}
    </PortalShell>
  );
}

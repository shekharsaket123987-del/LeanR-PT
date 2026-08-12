import PortalShell from "@/components/shared/PortalShell";
import MeasurementGateModal from "@/components/client/MeasurementGateModal";
import SessionsLowGateModal from "@/components/client/SessionsLowGateModal";
import { getAccessToken } from "@/lib/supabase/server-client";
import { getMyPortalIdentity } from "@/lib/services/profiles.service";
import { getMyMeasurementStatusAction } from "@/lib/actions/client-progress.actions";
import { getMyJourneyStateAction } from "@/lib/actions/client-journey.actions";
import { hasAnyChatAction, getMyUnreadChatCountAsClientAction } from "@/lib/actions/chat.actions";
import { getSessionsLowStatusAction } from "@/lib/actions/renewals.actions";
import { getMyUnresolvedConcernsCountAction } from "@/lib/actions/client-concerns.actions";
import { isFailure } from "@/lib/actions/action-result";

export default async function ClientPortalLayout({ children }: { children: React.ReactNode }) {
  let identity;
  try {
    const token = await getAccessToken();
    identity = token ? await getMyPortalIdentity(token, "client") : undefined;
  } catch {
    identity = undefined;
  }

  // Failure (e.g. not authenticated -- middleware will redirect anyway)
  // must not block rendering, so this defaults to "not stale" rather than
  // throwing: worst case a page briefly renders without the gate, not a
  // portal-wide crash.
  const [statusResult, journeyResult, chatResult, sessionsLowResult, unreadResult, concernsResult] = await Promise.all([
    getMyMeasurementStatusAction(),
    getMyJourneyStateAction(),
    hasAnyChatAction(),
    getSessionsLowStatusAction(),
    getMyUnreadChatCountAsClientAction(),
    getMyUnresolvedConcernsCountAction(),
  ]);
  const measurementsStale = !isFailure(statusResult) && statusResult.data.isStale;
  const hasActivePlan = !isFailure(journeyResult) && journeyResult.data.subscriptionId != null;
  const hasAnyChat = !isFailure(chatResult) && chatResult.data;
  const sessionsLow = !isFailure(sessionsLowResult) ? sessionsLowResult.data : { isLow: false, sessionsRemaining: 0 };
  const chatUnreadCount = !isFailure(unreadResult) ? unreadResult.data : 0;
  const escalationBadgeCount = !isFailure(concernsResult) ? concernsResult.data : 0;

  return (
    <PortalShell
      role="client"
      identity={identity}
      hideBookSessionNav={hasActivePlan}
      showChatNav={hasAnyChat}
      chatUnreadCount={chatUnreadCount}
      escalationBadgeCount={escalationBadgeCount}
    >
      {children}
      <MeasurementGateModal initiallyStale={measurementsStale} />
      {/* Only one gate at a time -- measurements take priority since they
       * already block booking/joining outright regardless of session count. */}
      {!measurementsStale && (
        <SessionsLowGateModal initiallyLow={sessionsLow.isLow} sessionsRemaining={sessionsLow.sessionsRemaining} />
      )}
    </PortalShell>
  );
}

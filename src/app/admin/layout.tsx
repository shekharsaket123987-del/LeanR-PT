import PortalShell from "@/components/shared/PortalShell";
import { getAccessToken } from "@/lib/supabase/server-client";
import { getMyPortalIdentity } from "@/lib/services/profiles.service";
import { getUnresolvedEscalationsCountAction } from "@/lib/actions/admin-escalations.actions";
import { isFailure } from "@/lib/actions/action-result";

export default async function AdminPortalLayout({ children }: { children: React.ReactNode }) {
  let identity;
  try {
    const token = await getAccessToken();
    identity = token ? await getMyPortalIdentity(token, "admin") : undefined;
  } catch {
    identity = undefined;
  }

  const escalationsResult = await getUnresolvedEscalationsCountAction();
  const escalationBadgeCount = !isFailure(escalationsResult) ? escalationsResult.data : 0;

  return (
    <PortalShell role="admin" identity={identity} escalationBadgeCount={escalationBadgeCount}>
      {children}
    </PortalShell>
  );
}

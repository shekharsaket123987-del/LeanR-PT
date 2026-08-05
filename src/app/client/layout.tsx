import PortalShell from "@/components/shared/PortalShell";
import { getAccessToken } from "@/lib/supabase/server-client";
import { getMyPortalIdentity } from "@/lib/services/profiles.service";

export default async function ClientPortalLayout({ children }: { children: React.ReactNode }) {
  let identity;
  try {
    const token = await getAccessToken();
    identity = token ? await getMyPortalIdentity(token, "client") : undefined;
  } catch {
    identity = undefined;
  }

  return (
    <PortalShell role="client" identity={identity}>
      {children}
    </PortalShell>
  );
}

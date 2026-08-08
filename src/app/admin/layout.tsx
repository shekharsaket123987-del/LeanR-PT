import PortalShell from "@/components/shared/PortalShell";
import { getAccessToken } from "@/lib/supabase/server-client";
import { getMyPortalIdentity } from "@/lib/services/profiles.service";

export default async function AdminPortalLayout({ children }: { children: React.ReactNode }) {
  let identity;
  try {
    const token = await getAccessToken();
    identity = token ? await getMyPortalIdentity(token, "admin") : undefined;
  } catch {
    identity = undefined;
  }

  return (
    <PortalShell role="admin" identity={identity}>
      {children}
    </PortalShell>
  );
}

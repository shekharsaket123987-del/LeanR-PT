import PortalShell from "@/components/shared/PortalShell";
import MeasurementGateModal from "@/components/client/MeasurementGateModal";
import { getAccessToken } from "@/lib/supabase/server-client";
import { getMyPortalIdentity } from "@/lib/services/profiles.service";
import { getMyMeasurementStatusAction } from "@/lib/actions/client-progress.actions";
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
  const statusResult = await getMyMeasurementStatusAction();
  const measurementsStale = !isFailure(statusResult) && statusResult.data.isStale;

  return (
    <PortalShell role="client" identity={identity}>
      {children}
      <MeasurementGateModal initiallyStale={measurementsStale} />
    </PortalShell>
  );
}

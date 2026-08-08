import PageHeader from "@/components/shared/PageHeader";
import DemoBookingClient from "@/components/client/DemoBookingClient";
import { getMyMeasurementStatusAction } from "@/lib/actions/client-progress.actions";
import { isFailure } from "@/lib/actions/action-result";

export default async function DemoBookingPage() {
  const statusResult = await getMyMeasurementStatusAction();
  const measurementsStale = !isFailure(statusResult) && statusResult.data.isStale;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Book a Free Demo Session" description="Try a live 1:1 session with a coach before you commit to a plan — completely free." />
      <DemoBookingClient measurementsStale={measurementsStale} />
    </div>
  );
}

import { redirect } from "next/navigation";
import { AlertTriangle, Ban, CalendarClock } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import BookSessionClient from "@/components/client/BookSessionClient";
import DemoFeedbackGateClient from "@/components/client/DemoFeedbackGateClient";
import { getBookingOptionsAction } from "@/lib/actions/client-portal.actions";
import { getMyJourneyStateAction } from "@/lib/actions/client-journey.actions";
import { getMyMeasurementStatusAction } from "@/lib/actions/client-progress.actions";
import { isFailure } from "@/lib/actions/action-result";
import { formatDate, formatTime } from "@/lib/utils";

export default async function BookSessionPage() {
  // Parallel, not sequential -- see the identical comment in
  // src/app/client/subscription/page.tsx for why. getBookingOptionsAction
  // never throws (runAction catches internally), safe to kick off
  // unconditionally even though only the "active" branch below uses it.
  const [journeyResult, result, measurementStatusResult] = await Promise.all([
    getMyJourneyStateAction(),
    getBookingOptionsAction(),
    getMyMeasurementStatusAction(),
  ]);
  const measurementsStale = !isFailure(measurementStatusResult) && measurementStatusResult.data.isStale;

  if (!isFailure(journeyResult)) {
    const { stage, demoSession } = journeyResult.data;

    // Once a plan is active, the recurring schedule (My Schedule) is the
    // client's only ongoing booking mechanism -- this ad-hoc wizard is
    // redundant and would let a client create bookings the recurring-slot
    // change flow doesn't know about. Nav already hides the link (see
    // PortalShell's hideBookSessionNav); this catches direct navigation too.
    if (journeyResult.data.subscriptionId != null) {
      redirect("/client/schedule");
    }

    if (stage === "demo_booked" && demoSession) {
      return (
        <div className="mx-auto max-w-3xl">
          <PageHeader title="Book a Session" description="A few quick steps and you're on the calendar." />
          <Card className="flex flex-col items-center gap-3 p-8 text-center">
            <CalendarClock className="h-8 w-8 text-black/25" />
            <p className="text-sm font-bold">Your Demo Session Is Already Booked</p>
            <p className="max-w-sm text-sm text-black/50">
              {demoSession.coachName} · {formatDate(demoSession.slotStart)} · {formatTime(demoSession.slotStart)}
            </p>
            <p className="max-w-sm text-sm text-black/50">Ongoing session booking unlocks once your demo is done.</p>
          </Card>
        </div>
      );
    }

    if (stage === "demo_completed" && demoSession) {
      return (
        <div className="mx-auto max-w-3xl">
          <PageHeader title="Book a Session" description="A few quick steps and you're on the calendar." />
          <DemoFeedbackGateClient
            bookingId={demoSession.bookingId}
            coachName={demoSession.coachName}
            canRate={demoSession.status === "completed" && demoSession.qualityRating == null}
          />
        </div>
      );
    }

    if (stage === "marketing") {
      return (
        <div className="mx-auto max-w-3xl">
          <PageHeader title="Book a Session" description="A few quick steps and you're on the calendar." />
          <Card className="flex flex-col items-center gap-3 p-8 text-center">
            <Ban className="h-8 w-8 text-black/25" />
            <p className="text-sm font-bold">No Subscription Found</p>
            <p className="max-w-sm text-sm text-black/50">Book a free demo session, or choose a plan to get started.</p>
            <div className="mt-2 flex gap-3">
              <Button href="/client/demo-booking" variant="outline">
                Book Free Demo
              </Button>
              <Button href="/client/plans">Choose Your Plan</Button>
            </div>
          </Card>
        </div>
      );
    }
  }

  if (isFailure(result)) {
    return (
      <div className="mx-auto max-w-3xl">
        <PageHeader title="Book a Session" description="A few quick steps and you're on the calendar." />
        <EmptyState icon={AlertTriangle} title="Can't book right now" description={result.error.message} />
      </div>
    );
  }

  return <BookSessionClient options={result.data} measurementsStale={measurementsStale} />;
}

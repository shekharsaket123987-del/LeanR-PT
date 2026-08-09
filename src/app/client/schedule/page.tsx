import { AlertTriangle, Ban, CalendarClock } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import ScheduleSetupClient from "@/components/client/ScheduleSetupClient";
import ChangeScheduleClient from "@/components/client/ChangeScheduleClient";
import { getScheduleSetupOptionsAction } from "@/lib/actions/schedule.actions";
import { getMyJourneyStateAction } from "@/lib/actions/client-journey.actions";
import { isFailure } from "@/lib/actions/action-result";
import { formatDate, formatTime } from "@/lib/utils";

export default async function SchedulePage() {
  // Parallel, not sequential -- see the identical comment in
  // src/app/client/subscription/page.tsx for why. getScheduleSetupOptionsAction
  // never throws (runAction catches internally), safe to kick off
  // unconditionally even though only the "active" branch below uses it.
  const [journeyResult, result] = await Promise.all([getMyJourneyStateAction(), getScheduleSetupOptionsAction()]);

  if (!isFailure(journeyResult)) {
    const { stage, demoSession } = journeyResult.data;

    if (stage === "demo_booked" && demoSession) {
      return (
        <div className="mx-auto max-w-2xl">
          <PageHeader title="My Schedule" description="Your upcoming demo session." />
          <Card className="flex flex-col items-center gap-3 p-8 text-center">
            <CalendarClock className="h-8 w-8 text-black/25" />
            <p className="text-sm font-bold">Demo Session Scheduled</p>
            <p className="text-sm text-black/50">
              {demoSession.coachName} · {formatDate(demoSession.slotStart)} · {formatTime(demoSession.slotStart)}
            </p>
          </Card>
        </div>
      );
    }

    if (stage === "marketing" || stage === "demo_completed") {
      return (
        <div className="mx-auto max-w-2xl">
          <PageHeader title="My Schedule" description="Your recurring weekly training pattern." />
          <Card className="flex flex-col items-center gap-3 p-8 text-center">
            <Ban className="h-8 w-8 text-black/25" />
            <p className="text-sm font-bold">No Schedule Yet</p>
            <p className="max-w-sm text-sm text-black/50">
              {stage === "demo_completed"
                ? "Choose a plan and pick your recurring weekly slot to get a permanent schedule."
                : "Book a free demo session to see it here, or choose a plan to set a recurring weekly schedule."}
            </p>
            <div className="mt-2 flex gap-3">
              {stage === "marketing" && (
                <Button href="/client/demo-booking" variant="outline">
                  Book Free Demo
                </Button>
              )}
              <Button href="/client/plans">Choose Your Plan</Button>
            </div>
          </Card>
        </div>
      );
    }
  }

  if (isFailure(result)) {
    return (
      <div className="mx-auto max-w-2xl">
        <PageHeader title="Set Your Recurring Schedule" description="Reserve a permanent weekly training pattern with your coach." />
        <EmptyState icon={AlertTriangle} title="Can't set up your schedule right now" description={result.error.message} />
      </div>
    );
  }

  const data = result.data;

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Set Your Recurring Schedule" description="Reserve a permanent weekly training pattern with your coach." />

      {data.existingSchedule ? <ChangeScheduleClient options={data} /> : <ScheduleSetupClient options={data} />}
    </div>
  );
}

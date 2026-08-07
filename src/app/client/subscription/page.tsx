import { AlertTriangle, CalendarClock, Ban } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import MySubscriptionClient from "@/components/client/MySubscriptionClient";
import { getMySubscriptionAction } from "@/lib/actions/client-portal.actions";
import { getMyJourneyStateAction } from "@/lib/actions/client-journey.actions";
import { isFailure } from "@/lib/actions/action-result";
import { formatDate, formatTime } from "@/lib/utils";

export default async function ClientSubscriptionPage() {
  const journeyResult = await getMyJourneyStateAction();

  if (!isFailure(journeyResult)) {
    const { stage, demoSession } = journeyResult.data;

    if (stage === "demo_completed" && demoSession) {
      return (
        <div className="mx-auto max-w-2xl">
          <PageHeader title="Subscription & Payments" description="Your plan, remaining sessions, and payment history." />
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <p className="text-display text-lg font-bold italic">Demo Package</p>
              <Badge variant="gray">Expired</Badge>
            </div>
            <div className="mt-4 space-y-2 text-sm text-black/60">
              <p className="flex items-center gap-2">
                <CalendarClock className="h-4 w-4 text-black/35" /> Session date: {formatDate(demoSession.slotStart)} ·{" "}
                {formatTime(demoSession.slotStart)}
              </p>
              <p>Amount: Free</p>
            </div>
            <p className="mt-4 text-sm text-black/50">Choose a plan to unlock ongoing sessions with a dedicated coach.</p>
            <Button href="/client/plans" className="mt-4">
              Choose Your Plan
            </Button>
          </Card>
        </div>
      );
    }

    if (stage === "marketing" || stage === "demo_booked") {
      return (
        <div className="mx-auto max-w-2xl">
          <PageHeader title="Subscription & Payments" description="Your plan, remaining sessions, and payment history." />
          <Card className="flex flex-col items-center gap-3 p-8 text-center">
            <Ban className="h-8 w-8 text-black/25" />
            <p className="text-sm font-bold">No Subscription Found</p>
            <p className="max-w-sm text-sm text-black/50">
              {stage === "demo_booked"
                ? "Your demo session doesn't require a plan -- choose one anytime to start ongoing training."
                : "You haven't purchased a plan yet."}
            </p>
            <Button href="/client/plans" className="mt-2">
              Choose Your Plan
            </Button>
          </Card>
        </div>
      );
    }
  }

  const result = await getMySubscriptionAction();

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Subscription & Payments" description="Your plan, remaining sessions, and payment history." />
      {isFailure(result) ? (
        <EmptyState icon={AlertTriangle} title="Couldn't load your subscription" description={result.error.message} />
      ) : (
        <MySubscriptionClient subscription={result.data} />
      )}
    </div>
  );
}

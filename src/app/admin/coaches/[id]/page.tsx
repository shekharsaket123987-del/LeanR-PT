import { AlertTriangle } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import AdminCoachDetailClient from "@/components/admin/AdminCoachDetailClient";
import { getAdminCoachDetailAction, getCoachWeekCalendarAction, getCoachAvailabilityForAdminAction } from "@/lib/actions/admin-coach.actions";
import { listAdminCoachOptionsAction } from "@/lib/actions/admin-clients.actions";
import { getCoachPerformanceAction } from "@/lib/actions/admin-coach-performance.actions";
import { isFailure } from "@/lib/actions/action-result";

export default async function AdminCoachDetailPage({ params }: { params: { id: string } }) {
  const [coachResult, coachOptionsResult, performanceResult, calendarResult, availabilityResult] = await Promise.all([
    getAdminCoachDetailAction(params.id),
    listAdminCoachOptionsAction(),
    getCoachPerformanceAction(params.id),
    getCoachWeekCalendarAction(params.id),
    getCoachAvailabilityForAdminAction(params.id),
  ]);

  if (isFailure(coachResult)) {
    return (
      <div className="mx-auto max-w-5xl">
        <EmptyState icon={AlertTriangle} title="Couldn't load this coach" description={coachResult.error.message} />
      </div>
    );
  }

  const coach = coachResult.data;
  const coaches = isFailure(coachOptionsResult) ? [] : coachOptionsResult.data;
  const performance = isFailure(performanceResult) ? null : performanceResult.data;
  const calendar = isFailure(calendarResult) ? [] : calendarResult.data;
  const availability = isFailure(availabilityResult) ? [] : availabilityResult.data;

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title={coach.name}
        description={coach.specialization ?? ""}
        action={<Badge variant={coach.status === "active" ? "green" : coach.status === "on-leave" ? "outline-yellow" : "gray"}>{coach.status}</Badge>}
      />
      <AdminCoachDetailClient coach={coach} coaches={coaches} performance={performance} calendar={calendar} availability={availability} />
    </div>
  );
}

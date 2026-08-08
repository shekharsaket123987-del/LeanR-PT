import Image from "next/image";
import { CalendarCheck2, CalendarClock, TrendingUp, XOctagon, Video, AlertTriangle, RotateCcw, Star, MessageCircleWarning } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import Card from "@/components/ui/Card";
import StatCard from "@/components/ui/StatCard";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import CoachTodayTasksClient from "@/components/coach/CoachTodayTasksClient";
import CoachUpcomingClient from "@/components/coach/CoachUpcomingClient";
import CoachPendingTasksClient from "@/components/coach/CoachPendingTasksClient";
import {
  getCoachCancelledSessionsAction,
  getCoachDashboardAction,
  getCoachPendingTasksAction,
  getCoachRescheduledSessionsAction,
  getCoachTodayTasksAction,
  getCoachUpcoming3DaysAction,
} from "@/lib/actions/coach-portal.actions";
import { isFailure } from "@/lib/actions/action-result";
import { formatDate, formatTime } from "@/lib/utils";

export default async function CoachDashboardPage() {
  const [result, cancelledResult, rescheduledResult, todayTasksResult, upcomingResult, pendingResult] = await Promise.all([
    getCoachDashboardAction(),
    getCoachCancelledSessionsAction(),
    getCoachRescheduledSessionsAction(),
    getCoachTodayTasksAction(),
    getCoachUpcoming3DaysAction(),
    getCoachPendingTasksAction(),
  ]);

  if (isFailure(result)) {
    return (
      <div className="mx-auto max-w-6xl">
        <PageHeader title="Dashboard" description="Here's your day at a glance." />
        <EmptyState icon={AlertTriangle} title="Couldn't load your dashboard" description={result.error.message} />
      </div>
    );
  }

  const data = result.data;
  const cancelled = isFailure(cancelledResult) ? [] : cancelledResult.data.slice(0, 5);
  const rescheduled = isFailure(rescheduledResult) ? [] : rescheduledResult.data.slice(0, 5);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title={`Good to see you, ${data.firstName}`} description="Here's your day at a glance." />

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={CalendarClock} label="Today" value={data.todayCount} />
        <StatCard icon={CalendarCheck2} label="Sessions This Week" value={data.thisWeekCount} />
        <StatCard icon={Video} label="Completed" value={data.completedCount} />
        <StatCard icon={XOctagon} label="Missed" value={data.missedCount} positive={false} />
        <StatCard icon={TrendingUp} label="Utilization" value={`${data.utilization}%`} accent />
        <StatCard icon={Star} label="Avg. Rating" value={data.avgRating > 0 ? data.avgRating.toFixed(1) : "—"} />
        <StatCard icon={MessageCircleWarning} label="Active Escalations" value={data.activeEscalationsCount} positive={data.activeEscalationsCount === 0} />
      </div>

      <div className="mt-8">
        <h2 className="text-display mb-4 text-xl font-bold italic">Today's Tasks</h2>
        {isFailure(todayTasksResult) ? (
          <EmptyState icon={AlertTriangle} title="Couldn't load today's tasks" description={todayTasksResult.error.message} />
        ) : (
          <CoachTodayTasksClient initialTasks={todayTasksResult.data} />
        )}
      </div>

      <div className="mt-8">
        <h2 className="text-display mb-4 text-xl font-bold italic">Pending Tasks</h2>
        {isFailure(pendingResult) ? (
          <EmptyState icon={AlertTriangle} title="Couldn't load pending tasks" description={pendingResult.error.message} />
        ) : (
          <CoachPendingTasksClient initialTasks={pendingResult.data} />
        )}
      </div>

      <div className="mt-8">
        <h2 className="text-display mb-4 text-xl font-bold italic">Upcoming (Next 3 Days)</h2>
        {isFailure(upcomingResult) ? (
          <EmptyState icon={AlertTriangle} title="Couldn't load your upcoming sessions" description={upcomingResult.error.message} />
        ) : (
          <CoachUpcomingClient sessions={upcomingResult.data} />
        )}
      </div>

      <div className="mt-8">
        <h2 className="text-display mb-4 text-xl font-bold italic">Cancelled Sessions</h2>
        {cancelled.length === 0 ? (
          <p className="text-sm text-black/45">No cancelled sessions.</p>
        ) : (
          <div className="space-y-3">
            {cancelled.map((c) => (
              <Card key={c.id} className="p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-bold">{c.clientName}</p>
                  <span className="font-mono text-[11px] text-black/40">{c.clientCode}</span>
                  <Badge variant="red">Cancelled by {c.cancelledByRole === "admin" ? "Admin" : c.cancelledByRole === "coach" ? "Coach" : "Client"}</Badge>
                </div>
                <p className="mt-1.5 text-xs text-black/50">
                  Session: {formatDate(c.sessionDate)} · {formatTime(c.sessionDate)} — cancelled {formatDate(c.cancelledAt)} · {formatTime(c.cancelledAt)}
                </p>
                {c.reason && <p className="mt-1.5 text-xs text-black/60">Reason: {c.reason}</p>}
              </Card>
            ))}
          </div>
        )}
      </div>

      <div className="mt-8">
        <h2 className="text-display mb-4 text-xl font-bold italic">Rescheduled Sessions</h2>
        {rescheduled.length === 0 ? (
          <p className="text-sm text-black/45">No rescheduled sessions.</p>
        ) : (
          <div className="space-y-3">
            {rescheduled.map((r) => (
              <Card key={r.id} className="p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-bold">{r.clientName}</p>
                  <span className="font-mono text-[11px] text-black/40">{r.clientCode}</span>
                  <Badge variant="outline-yellow">
                    <RotateCcw className="h-3 w-3" /> Rescheduled
                  </Badge>
                </div>
                <p className="mt-1.5 text-xs text-black/50">
                  {formatDate(r.originalDate)} · {formatTime(r.originalDate)} → {formatDate(r.newDate)} · {formatTime(r.newDate)}
                </p>
              </Card>
            ))}
          </div>
        )}
      </div>

      <div className="mt-8">
        <h2 className="text-display mb-4 text-xl font-bold italic">Your Clients</h2>
        {data.recentClients.length === 0 ? (
          <p className="text-sm text-black/45">No clients assigned yet.</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.recentClients.map((c) => (
              <Card key={c.id} className="flex items-center gap-3 p-4">
                <div className="relative h-11 w-11 overflow-hidden rounded-full">
                  <Image src={c.photo} alt={c.name} fill className="object-cover" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold">{c.name}</p>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

import {
  Users2,
  CheckCircle2,
  CalendarClock,
  TrendingUp,
  XOctagon,
  Gauge,
  BarChart3,
  Clock,
  AlertTriangle,
  RefreshCw,
  Star,
  History,
} from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import Card from "@/components/ui/Card";
import StatCard from "@/components/ui/StatCard";
import EmptyState from "@/components/ui/EmptyState";
import { getMyActivityAction, getMyPerformanceAction } from "@/lib/actions/coach-portal.actions";
import { isFailure } from "@/lib/actions/action-result";
import { formatDate } from "@/lib/utils";

export default async function CoachPerformancePage() {
  const [perfResult, activityResult] = await Promise.all([getMyPerformanceAction(), getMyActivityAction()]);

  if (isFailure(perfResult)) {
    return (
      <div className="mx-auto max-w-6xl">
        <PageHeader title="Performance" description="Your personal statistics." />
        <EmptyState icon={AlertTriangle} title="Couldn't load your performance" description={perfResult.error.message} />
      </div>
    );
  }

  const p = perfResult.data;
  const activity = isFailure(activityResult) ? [] : activityResult.data;

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="Performance" description="Your personal statistics — read only." />

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Users2} label="Active Clients" value={p.totalActiveClients} />
        <StatCard icon={CheckCircle2} label="Sessions Completed" value={p.totalSessionsCompleted} />
        <StatCard icon={CalendarClock} label="Scheduled Today" value={p.sessionsScheduledToday} />
        <StatCard icon={TrendingUp} label="Attendance Rate" value={`${p.attendancePct}%`} accent />
        <StatCard icon={XOctagon} label="Client No-show %" value={`${p.clientNoShowPct}%`} positive={false} />
        <StatCard icon={XOctagon} label="Coach No-show %" value={`${p.coachNoShowPct}%`} positive={false} />
        <StatCard icon={Gauge} label="Capacity" value={`${p.currentCapacity} / ${p.maxCapacity}`} />
        <StatCard icon={BarChart3} label="Available Capacity" value={p.availableCapacity} />
        <StatCard icon={CalendarClock} label="Weekly Sessions" value={p.totalWeeklySessions} />
        <StatCard icon={CalendarClock} label="Monthly Sessions" value={p.totalMonthlySessions} />
        <StatCard icon={Clock} label="Avg. Session Duration" value={`${p.avgSessionDurationMinutes} min`} />
        <StatCard icon={AlertTriangle} label="Escalations Raised" value={p.escalationsRaised} positive={false} />
        <StatCard icon={RefreshCw} label="Coach Change Requests" value={p.coachChangeRequestsReceived} positive={false} />
        <StatCard icon={Star} label="Average Rating" value={p.averageRating || "—"} />
      </div>

      <div className="mt-10">
        <h2 className="text-display mb-4 text-xl font-bold italic">Activity Timeline</h2>
        {activity.length === 0 ? (
          <EmptyState icon={History} title="No activity yet" description="Your recent sessions, leave requests, and shadow assignments will show up here." />
        ) : (
          <div className="space-y-2">
            {activity.map((a, i) => (
              <Card key={i} className="flex items-center justify-between gap-4 p-4">
                <p className="text-sm font-semibold">{a.title}</p>
                <span className="shrink-0 text-xs text-white/40">{formatDate(a.date)}</span>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

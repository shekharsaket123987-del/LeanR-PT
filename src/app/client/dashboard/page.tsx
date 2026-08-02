import { Flame, CalendarCheck2, TrendingUp, AlertTriangle } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import Card from "@/components/ui/Card";
import ProgressRing from "@/components/ui/ProgressRing";
import StatCard from "@/components/ui/StatCard";
import EmptyState from "@/components/ui/EmptyState";
import NextSessionCard from "@/components/client/NextSessionCard";
import { getClientDashboardAction } from "@/lib/actions/client-portal.actions";
import { isFailure } from "@/lib/actions/action-result";
import { formatDate } from "@/lib/utils";

export default async function ClientDashboardPage() {
  const result = await getClientDashboardAction();

  if (isFailure(result)) {
    return (
      <div className="mx-auto max-w-6xl">
        <PageHeader title="Dashboard" description="Here's where things stand today." />
        <EmptyState icon={AlertTriangle} title="Couldn't load your dashboard" description={result.error.message} />
      </div>
    );
  }

  const data = result.data;
  const packagePercent = data.sessionsTotal > 0 ? Math.round((data.sessionsUsed / data.sessionsTotal) * 100) : 0;

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title={`Welcome back, ${data.firstName}`} description="Here's where things stand today." />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="flex flex-col items-center justify-center gap-4 p-6 text-center lg:col-span-1">
          <ProgressRing value={data.sessionsUsed} max={data.sessionsTotal || 1} label={`${data.sessionsRemaining}`} sublabel="Sessions left" />
          <div>
            <p className="text-sm font-bold">{data.packageName ?? "No active package"}</p>
            <p className="text-xs text-black/45">
              {data.sessionsUsed} of {data.sessionsTotal} sessions used
            </p>
          </div>
        </Card>

        <div className="lg:col-span-2">
          <NextSessionCard session={data.nextSession} />
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-3">
        <StatCard icon={CalendarCheck2} label="Sessions Completed" value={data.completedCount} />
        <StatCard icon={Flame} label="Current Streak" value={`${data.streakWeeks} wks`} />
        <StatCard icon={TrendingUp} label="Package Progress" value={`${packagePercent}%`} />
      </div>

      <div className="mt-8">
        <h2 className="text-display mb-4 text-xl font-bold italic">Recent Sessions</h2>
        <Card className="divide-y divide-black/[0.05]">
          {data.recentCompleted.length === 0 && <p className="p-4 text-sm text-black/45">No completed sessions yet.</p>}
          {data.recentCompleted.map((s) => (
            <div key={s.id} className="flex items-center justify-between gap-4 p-4">
              <div>
                <p className="text-sm font-bold">{formatDate(s.date)}</p>
                <p className="mt-0.5 line-clamp-1 text-xs text-black/45">{s.coachNotes ?? "No notes from your coach yet."}</p>
              </div>
              {s.rating && <span className="shrink-0 text-xs font-bold text-black/50">{"★".repeat(s.rating)}</span>}
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}

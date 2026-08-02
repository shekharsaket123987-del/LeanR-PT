import Image from "next/image";
import { CalendarCheck2, TrendingUp, XOctagon, Video, Clock, AlertTriangle } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import Card from "@/components/ui/Card";
import StatCard from "@/components/ui/StatCard";
import Badge, { AssessmentBadge } from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import { getCoachDashboardAction } from "@/lib/actions/coach-portal.actions";
import { isFailure } from "@/lib/actions/action-result";
import { formatTime } from "@/lib/utils";

export default async function CoachDashboardPage() {
  const result = await getCoachDashboardAction();

  if (isFailure(result)) {
    return (
      <div className="mx-auto max-w-6xl">
        <PageHeader title="Dashboard" description="Here's your day at a glance." />
        <EmptyState icon={AlertTriangle} title="Couldn't load your dashboard" description={result.error.message} />
      </div>
    );
  }

  const data = result.data;

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title={`Good to see you, ${data.firstName}`} description="Here's your day at a glance." />

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={CalendarCheck2} label="Sessions This Week" value={data.thisWeekCount} />
        <StatCard icon={Video} label="Completed" value={data.completedCount} />
        <StatCard icon={XOctagon} label="Missed" value={data.missedCount} positive={false} />
        <StatCard icon={TrendingUp} label="Utilization" value={`${data.utilization}%`} accent />
      </div>

      <div className="mt-8">
        <h2 className="text-display mb-4 text-xl font-bold italic">Today's Sessions</h2>
        {data.todaySessions.length === 0 ? (
          <EmptyState icon={Clock} title="No sessions today" description="Enjoy the breather — check your schedule for what's next." />
        ) : (
          <div className="space-y-3">
            {data.todaySessions.map((s) => (
              <Card key={s.id} className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
                <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl">
                  {s.client && <Image src={s.client.photo} alt={s.client.name} fill className="object-cover" />}
                </div>
                <div className="flex-1">
                  <div className="mb-1.5 flex items-center gap-2">
                    {s.type === "assessment" ? <AssessmentBadge /> : <Badge variant="gray">Regular</Badge>}
                  </div>
                  <p className="text-sm font-bold">{s.client?.name}</p>
                  <p className="text-xs text-black/45">{formatTime(s.date)} · {s.durationMinutes} min</p>
                </div>
                <Button href={`/coach/session/${s.id}`}>
                  <Video className="h-4 w-4" /> Join
                </Button>
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

import Image from "next/image";
import { CalendarCheck2, Users2, TrendingUp, XOctagon, Video, Clock } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import Card from "@/components/ui/Card";
import StatCard from "@/components/ui/StatCard";
import Badge, { AssessmentBadge } from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import { coaches, getClient, sessionsForCoach } from "@/lib/mock-data";
import { formatTime } from "@/lib/utils";

export default function CoachDashboardPage() {
  const coach = coaches[0];
  const mySessions = sessionsForCoach(coach.id);
  const today = new Date().toDateString();
  const todaySessions = mySessions
    .filter((s) => new Date(s.date).toDateString() === today && s.status === "upcoming")
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const completedCount = mySessions.filter((s) => s.status === "completed").length;
  const missedCount = mySessions.filter((s) => s.status === "missed").length;
  const thisWeekCount = mySessions.length;

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title={`Good to see you, ${coach.name.split(" ")[0]}`} description="Here's your day at a glance." />

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={CalendarCheck2} label="Sessions This Week" value={thisWeekCount} />
        <StatCard icon={Video} label="Completed" value={completedCount} change="+3" />
        <StatCard icon={XOctagon} label="Missed" value={missedCount} positive={false} change={missedCount > 0 ? `${missedCount}` : "0"} />
        <StatCard icon={TrendingUp} label="Utilization" value={`${coach.utilization}%`} accent />
      </div>

      <div className="mt-8">
        <h2 className="text-display mb-4 text-xl font-bold italic">Today's Sessions</h2>
        {todaySessions.length === 0 ? (
          <EmptyState icon={Clock} title="No sessions today" description="Enjoy the breather — check your schedule for what's next." />
        ) : (
          <div className="space-y-3">
            {todaySessions.map((s) => {
              const client = getClient(s.clientId);
              return (
                <Card key={s.id} className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
                  <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl">
                    {client && <Image src={client.photo} alt={client.name} fill className="object-cover" />}
                  </div>
                  <div className="flex-1">
                    <div className="mb-1.5 flex items-center gap-2">
                      {s.type === "assessment" ? <AssessmentBadge /> : <Badge variant="gray">Regular</Badge>}
                    </div>
                    <p className="text-sm font-bold">{client?.name}</p>
                    <p className="text-xs text-black/45">{formatTime(s.date)} · {s.durationMinutes} min</p>
                  </div>
                  <Button href={`/coach/session/${s.id}`}>
                    <Video className="h-4 w-4" /> Join
                  </Button>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <div className="mt-8">
        <h2 className="text-display mb-4 text-xl font-bold italic">Your Clients</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {coach && (
            <>
              {mySessions
                .map((s) => s.clientId)
                .filter((v, i, a) => a.indexOf(v) === i)
                .slice(0, 3)
                .map((cid) => {
                  const client = getClient(cid);
                  if (!client) return null;
                  return (
                    <Card key={cid} className="flex items-center gap-3 p-4">
                      <div className="relative h-11 w-11 overflow-hidden rounded-full">
                        <Image src={client.photo} alt={client.name} fill className="object-cover" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold">{client.name}</p>
                        <p className="truncate text-xs text-black/45">{client.sessionsRemaining} sessions left</p>
                      </div>
                    </Card>
                  );
                })}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

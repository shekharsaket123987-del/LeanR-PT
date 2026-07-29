import { Flame, CalendarCheck2, TrendingUp } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import Card from "@/components/ui/Card";
import ProgressRing from "@/components/ui/ProgressRing";
import StatCard from "@/components/ui/StatCard";
import NextSessionCard from "@/components/client/NextSessionCard";
import { clients, sessionsForClient } from "@/lib/mock-data";
import { formatDate } from "@/lib/utils";

export default function ClientDashboardPage() {
  const client = clients[0];
  const mySessions = sessionsForClient(client.id);
  const nextSession = mySessions
    .filter((s) => s.status === "upcoming")
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0];
  const completed = mySessions.filter((s) => s.status === "completed").length;

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title={`Welcome back, ${client.name.split(" ")[0]}`} description="Here's where things stand today." />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="flex flex-col items-center justify-center gap-4 p-6 text-center lg:col-span-1">
          <ProgressRing
            value={client.sessionsUsed}
            max={client.sessionsTotal}
            label={`${client.sessionsRemaining}`}
            sublabel="Sessions left"
          />
          <div>
            <p className="text-sm font-bold">{client.packageName}</p>
            <p className="text-xs text-black/45">
              {client.sessionsUsed} of {client.sessionsTotal} sessions used
            </p>
          </div>
        </Card>

        <div className="lg:col-span-2">
          <NextSessionCard session={nextSession} />
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-3">
        <StatCard icon={CalendarCheck2} label="Sessions Completed" value={completed} />
        <StatCard icon={Flame} label="Current Streak" value={`${client.streak} wks`} change="+2 wks" />
        <StatCard icon={TrendingUp} label="Package Progress" value={`${Math.round((client.sessionsUsed / client.sessionsTotal) * 100)}%`} />
      </div>

      <div className="mt-8">
        <h2 className="text-display mb-4 text-xl font-bold italic">Recent Sessions</h2>
        <Card className="divide-y divide-black/[0.05]">
          {mySessions
            .filter((s) => s.status === "completed")
            .slice(0, 3)
            .map((s) => (
              <div key={s.id} className="flex items-center justify-between gap-4 p-4">
                <div>
                  <p className="text-sm font-bold">{formatDate(s.date)}</p>
                  <p className="mt-0.5 line-clamp-1 text-xs text-black/45">{s.remarks}</p>
                </div>
                {s.rating && (
                  <span className="shrink-0 text-xs font-bold text-black/50">{"★".repeat(s.rating)}</span>
                )}
              </div>
            ))}
        </Card>
      </div>
    </div>
  );
}

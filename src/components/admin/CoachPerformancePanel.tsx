import Card from "@/components/ui/Card";
import { CoachPerformance } from "@/lib/services/coachPerformance.service";

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p className="text-display text-xl font-bold italic">{value}</p>
      <p className="text-[11px] text-black/40">{label}</p>
    </div>
  );
}

export default function CoachPerformancePanel({ performance }: { performance: CoachPerformance }) {
  return (
    <Card className="p-5">
      <p className="mb-4 text-xs font-bold uppercase text-black/40">Performance</p>
      <div className="grid grid-cols-2 gap-4">
        <Stat label="Attendance Rate" value={`${performance.attendancePct}%`} />
        <Stat label="Client No-show" value={`${performance.clientNoShowPct}%`} />
        <Stat label="Coach No-show" value={`${performance.coachNoShowPct}%`} />
        <Stat label="Avg. Session Duration" value={`${performance.avgSessionDurationMinutes} min`} />
        <Stat label="Current Capacity" value={`${performance.currentCapacity} Clients`} />
        <Stat label="Maximum Capacity" value={`${performance.maxCapacity} Clients`} />
        <Stat label="Available Capacity" value={`${performance.availableCapacity} Clients`} />
        <Stat label="Sessions Completed" value={performance.totalSessionsCompleted} />
        <Stat label="Scheduled Today" value={performance.sessionsScheduledToday} />
        <Stat label="This Week" value={performance.totalWeeklySessions} />
        <Stat label="This Month" value={performance.totalMonthlySessions} />
        <Stat label="Escalations Raised" value={performance.escalationsRaised} />
        <Stat label="Coach Change Requests" value={performance.coachChangeRequestsReceived} />
        <Stat label="Avg. Client Rating" value={performance.averageRating.toFixed(1)} />
      </div>
    </Card>
  );
}

import { redirect } from "next/navigation";
import Image from "next/image";
import { Flame, CalendarCheck2, TrendingUp, AlertTriangle, Scale, CalendarClock, Sparkles } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import ProgressRing from "@/components/ui/ProgressRing";
import StatCard from "@/components/ui/StatCard";
import EmptyState from "@/components/ui/EmptyState";
import NextSessionCard from "@/components/client/NextSessionCard";
import { getClientDashboardAction } from "@/lib/actions/client-portal.actions";
import { getMyJourneyStateAction } from "@/lib/actions/client-journey.actions";
import { getMyProgressAction } from "@/lib/actions/client-progress.actions";
import { isFailure } from "@/lib/actions/action-result";
import { formatDate, formatTime } from "@/lib/utils";

/** Arrow always reflects the TRUE direction the number moved (↓ = went
 * down, ↑ = went up) -- lowerIsBetter only controls the color (is this
 * change good news), never the arrow itself, so the arrow never lies about
 * what the number actually did. */
function diffLabel(dayOne: number | null, latest: number | null, lowerIsBetter = true): { text: string; improved: boolean } | null {
  if (dayOne == null || latest == null) return null;
  const delta = latest - dayOne;
  if (Math.abs(delta) < 0.01) return { text: "No change", improved: false };
  const wentDown = delta < 0;
  const improved = lowerIsBetter ? wentDown : !wentDown;
  return { text: `${wentDown ? "↓" : "↑"} ${Math.abs(delta).toFixed(1)} since Day 1`, improved };
}

export default async function ClientDashboardPage() {
  // All three fetched in parallel -- none of getMyJourneyStateAction/
  // getClientDashboardAction/getMyProgressAction depend on each other's
  // output, and none of them throw (runAction catches internally), so
  // there's no correctness reason to wait for the journey check before
  // starting the other two. For the common case (an active client, no
  // redirect) this halves the round trips versus fetching sequentially;
  // for the rarer redirect/demo-stage cases, the other two results are
  // simply unused -- a wasted query, not a bug.
  const [journeyResult, result, progressResult] = await Promise.all([
    getMyJourneyStateAction(),
    getClientDashboardAction(),
    getMyProgressAction(),
  ]);

  if (!isFailure(journeyResult)) {
    const { stage, demoSession } = journeyResult.data;
    if (stage === "marketing") redirect("/client/plans");
    if (stage === "awaiting_activation") redirect("/client/activate");
    if (stage === "onboarding") redirect("/client/onboarding");
    if (stage === "slot_selection") redirect("/client/schedule");

    if (stage === "demo_booked" && demoSession) {
      return (
        <div className="mx-auto max-w-3xl">
          <PageHeader title="Your Demo Session" description="You're all set — here's what's coming up." />
          <Card className="flex flex-col items-center gap-4 p-8 text-center">
            <div className="relative h-16 w-16 overflow-hidden rounded-2xl">
              <Image src={demoSession.coachPhoto} alt={demoSession.coachName} fill className="object-cover" />
            </div>
            <div>
              <p className="text-display text-xl font-bold italic">{demoSession.coachName}</p>
              <p className="mt-1 flex items-center justify-center gap-1.5 text-sm text-black/60">
                <CalendarClock className="h-4 w-4" />
                {formatDate(demoSession.slotStart)} · {formatTime(demoSession.slotStart)}
              </p>
            </div>
            <p className="max-w-sm text-sm text-black/50">
              Your coach was automatically matched based on availability. We&apos;ll send a reminder before your session.
            </p>
          </Card>
        </div>
      );
    }

    if (stage === "demo_completed") {
      return (
        <div className="mx-auto max-w-3xl">
          <PageHeader title="Welcome back" description="Your free demo is complete — ready to go all in?" />
          <Card className="flex flex-col items-center gap-4 p-8 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-yellow/15">
              <Sparkles className="h-7 w-7" />
            </div>
            <div>
              <p className="text-display text-xl font-bold italic">How was your demo with {demoSession?.coachName ?? "your coach"}?</p>
              <p className="mt-1 text-sm text-black/50">Pick a plan to keep training with a dedicated coach every week.</p>
            </div>
            <Button href="/client/plans">Choose Your Plan</Button>
          </Card>
        </div>
      );
    }
  }

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
  const progress = isFailure(progressResult) ? null : progressResult.data;

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title={`Welcome back, ${data.firstName}`} description={`Day ${data.journeyDay} of your journey — here's where things stand today.`} />

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
          <NextSessionCard session={data.nextSession} measurementsStale={progress?.canSubmitThisWeek ?? false} />
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-3">
        <StatCard icon={CalendarCheck2} label="Sessions Completed" value={data.completedCount} />
        <StatCard icon={Flame} label="Current Streak" value={`${data.streakWeeks} wks`} />
        <StatCard icon={TrendingUp} label="Package Progress" value={`${packagePercent}%`} />
      </div>

      {progress && progress.dayOne && progress.latest && (
        <div className="mt-8">
          <h2 className="text-display mb-4 text-xl font-bold italic">Progress Since Day 1</h2>
          <Card className="p-6">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {[
                { label: "Weight", d1: progress.dayOne.weight, latest: progress.latest.weight },
                { label: "Body Fat %", d1: progress.dayOne.bodyFatPct, latest: progress.latest.bodyFatPct },
                { label: "Muscle %", d1: progress.dayOne.musclePct, latest: progress.latest.musclePct, lowerIsBetter: false },
                { label: "Waist", d1: progress.dayOne.waist, latest: progress.latest.waist },
                { label: "Chest", d1: progress.dayOne.chest, latest: progress.latest.chest, lowerIsBetter: false },
                { label: "Hip", d1: progress.dayOne.hip, latest: progress.latest.hip },
                { label: "Arms", d1: progress.dayOne.arms, latest: progress.latest.arms, lowerIsBetter: false },
                { label: "Thigh", d1: progress.dayOne.thigh, latest: progress.latest.thigh, lowerIsBetter: false },
              ].map((m) => {
                const diff = diffLabel(m.d1, m.latest, m.lowerIsBetter ?? true);
                return (
                  <div key={m.label}>
                    <p className="text-[11px] font-bold uppercase text-black/40">{m.label}</p>
                    <p className="mt-1 text-lg font-bold">{m.latest ?? "—"}</p>
                    <p className={`text-xs ${diff?.improved ? "text-emerald-600" : "text-black/45"}`}>{diff?.text ?? "—"}</p>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      )}

      {progress && !progress.canSubmitThisWeek && (
        <Card className="mt-6 flex items-center gap-3 border-brand-yellow bg-brand-yellow/10 p-4">
          <Scale className="h-4 w-4 shrink-0" />
          <p className="text-sm font-semibold">You're all set on this week's measurement update — nice work staying consistent.</p>
        </Card>
      )}
      {progress && progress.canSubmitThisWeek && (
        <Card className="mt-6 flex items-center justify-between gap-3 border-red-500/30 bg-red-500/5 p-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-4 w-4 shrink-0 text-red-600" />
            <div>
              <p className="text-sm font-bold text-red-700">Action required: update your measurements</p>
              <p className="text-xs text-red-600/80">Booking, joining sessions, and demos are on hold until this is done.</p>
            </div>
          </div>
          <a href="/client/progress" className="shrink-0 text-sm font-bold text-red-700 underline">
            Update now
          </a>
        </Card>
      )}

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
              {s.qualityRating && <span className="shrink-0 text-xs font-bold text-black/50">{"★".repeat(s.qualityRating)}</span>}
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}

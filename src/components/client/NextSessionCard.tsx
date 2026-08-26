"use client";
import Image from "next/image";
import { Video, CalendarClock, MapPin, Scale } from "lucide-react";
import Card from "../ui/Card";
import Button from "../ui/Button";
import Badge, { AssessmentBadge } from "../ui/Badge";
import { SessionView } from "@/lib/actions/client-portal.actions";
import { formatDate, formatTime } from "@/lib/utils";
import { useJoinCountdown } from "@/components/shared/JoinCountdown";

export default function NextSessionCard({ session, measurementsStale }: { session: SessionView | null; measurementsStale: boolean }) {
  // Hooks must run unconditionally -- feed useJoinCountdown a placeholder
  // instant far in the future when there's no session, so canJoin/label
  // compute to a harmless "not joinable" state instead of ever being read.
  const { label, canJoin } = useJoinCountdown(session?.date ?? "9999-01-01T00:00:00Z", session?.durationMinutes ?? 0);

  if (!session) {
    return (
      <Card className="flex flex-col items-center justify-center p-10 text-center">
        <CalendarClock className="mb-3 h-9 w-9 text-white/20" />
        <p className="text-display text-lg font-bold italic">No upcoming sessions</p>
        <p className="mt-1 text-sm text-white/45">Set up your recurring schedule to keep your streak going.</p>
        <Button href="/client/schedule" className="mt-5">
          Go to My Schedule
        </Button>
      </Card>
    );
  }

  const coach = session.coach;

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-col gap-6 p-6 sm:flex-row sm:items-center">
        <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl">
          {coach && <Image src={coach.photo} alt={coach.name} fill className="object-cover" />}
        </div>
        <div className="flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            {session.type === "assessment" ? <AssessmentBadge amountPaid={session.amountPaid} /> : <Badge variant="black">Regular Session</Badge>}
            <Badge variant="gray">Next Up</Badge>
          </div>
          <p className="text-display text-2xl font-bold italic">{coach?.name}</p>
          <p className="text-sm text-white/50">{coach?.specialization}</p>
          <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-white/60">
            <span className="flex items-center gap-1.5">
              <CalendarClock className="h-4 w-4" />
              {formatDate(session.date)} · {formatTime(session.date)}
            </span>
            <span className="flex items-center gap-1.5">
              <MapPin className="h-4 w-4" />
              Live Video Session
            </span>
          </div>
        </div>
        <div className="flex flex-col items-stretch gap-2 sm:items-end">
          <Button
            size="lg"
            href={session.zoomJoinUrl ?? "#"}
            target="_blank"
            disabled={!canJoin || !session.zoomJoinUrl || measurementsStale}
            className="min-w-[160px]"
          >
            <Video className="h-4 w-4" />
            {canJoin ? "Join Now" : "Join"}
          </Button>
          {measurementsStale ? (
            <p className="flex items-center gap-1.5 text-center text-xs font-semibold text-red-400 sm:text-right">
              <Scale className="h-3.5 w-3.5 shrink-0" />
              <a href="/client/progress" className="underline">
                Update measurements to join
              </a>
            </p>
          ) : (
            <p className="text-center text-xs text-white/40 sm:text-right">
              {!session.zoomJoinUrl ? "Join link not ready yet" : label}
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}

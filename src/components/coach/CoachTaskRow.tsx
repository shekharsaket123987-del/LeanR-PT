"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { CheckCircle2, ClipboardEdit, Clock, ShieldCheck, Video, XCircle } from "lucide-react";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import JoinCountdown, { useJoinCountdown } from "@/components/shared/JoinCountdown";
import { CoachTodayTaskView, markAttendanceAction, markSessionJoinedAction } from "@/lib/actions/coach-portal.actions";
import { isFailure } from "@/lib/actions/action-result";
import { formatTime } from "@/lib/utils";

/** One session row exposing the coach's post-session workflow (mark
 * attendance, add notes) plus a live join countdown while the session is
 * still ahead -- shared between the Today's Tasks widget (§1.3) and the
 * Pending Tasks widget (§1.6), since both are lists of the same underlying
 * "upcoming booking that still needs something" shape, just filtered to a
 * different date range by their respective actions. */
const ATTENDANCE_BADGE: Record<"present" | "late" | "absent", { variant: "green" | "outline-yellow" | "gray"; label: string }> = {
  present: { variant: "green", label: "Present" },
  late: { variant: "outline-yellow", label: "Late" },
  absent: { variant: "gray", label: "Absent — logged" },
};

export function TaskRow({
  task,
  onMarked,
}: {
  task: CoachTodayTaskView;
  onMarked: (bookingId: string, status: "present" | "absent" | "late") => void;
}) {
  const router = useRouter();
  const { canJoin, isPast } = useJoinCountdown(task.scheduledStart, task.durationMinutes);
  const [joined, setJoined] = useState(task.coachJoinedAt != null);
  const [joining, setJoining] = useState(false);
  const [marking, setMarking] = useState<"present" | "absent" | "late" | null>(null);
  const [error, setError] = useState("");

  // The real attendance gate is enforced server-side (bookings.service.ts::
  // markAttendance) -- this mirrors it just to keep the buttons from being
  // clickable before the call would succeed anyway.
  const canMarkAttendance = isPast && joined;

  async function handleJoin() {
    setJoining(true);
    setError("");
    const result = await markSessionJoinedAction(task.bookingId);
    setJoining(false);
    if (isFailure(result)) {
      setError(result.error.message);
      return;
    }
    setJoined(true);
    // Once the session's own time has passed there's no live meeting left to
    // open -- go straight to the session page to mark attendance instead.
    if (!isPast && task.zoomStartUrl) {
      window.open(task.zoomStartUrl, "_blank", "noopener,noreferrer");
    } else {
      router.push(`/coach/session/${task.bookingId}`);
    }
  }

  async function mark(status: "present" | "absent" | "late") {
    setMarking(status);
    setError("");
    const result = await markAttendanceAction(task.bookingId, status);
    setMarking(null);
    if (isFailure(result)) {
      setError(result.error.message);
      return;
    }
    onMarked(task.bookingId, status);
  }

  return (
    <div
      className={`flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between ${
        task.overdue ? "border-red-300 bg-red-50" : "border-black/[0.06]"
      }`}
    >
      <div className="flex items-center gap-3">
        <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-xl">
          <Image src={task.clientPhoto} alt={task.clientName} fill className="object-cover" />
        </div>
        <div>
          <Link href={`/coach/clients/${task.clientId}`} className="text-sm font-bold hover:underline">
            {task.clientName}
          </Link>
          {task.isShadowSession && (
            <Badge variant="outline-yellow" className="ml-1.5">
              <ShieldCheck className="h-3 w-3" /> Shadow
            </Badge>
          )}
          <p className="text-xs text-black/45">
            {task.clientCode && `${task.clientCode} · `}
            {task.packageName ?? "No active plan"} · {formatTime(task.scheduledStart)}
          </p>
          {task.overdue && <p className="mt-0.5 text-xs font-bold text-red-600">Attendance overdue — mark it now</p>}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {!task.attendanceStatus ? (
          <>
            {!joined && (
              <>
                {!isPast && <JoinCountdown scheduledStart={task.scheduledStart} durationMinutes={task.durationMinutes} />}
                <Button size="sm" loading={joining} disabled={!isPast && !canJoin} onClick={handleJoin}>
                  <Video className="h-3.5 w-3.5" /> Join
                </Button>
              </>
            )}
            <Button
              size="sm"
              variant="outline"
              loading={marking === "present"}
              disabled={!canMarkAttendance}
              onClick={() => mark("present")}
            >
              <CheckCircle2 className="h-3.5 w-3.5" /> Present
            </Button>
            <Button size="sm" variant="outline" loading={marking === "late"} disabled={!canMarkAttendance} onClick={() => mark("late")}>
              <Clock className="h-3.5 w-3.5" /> Late
            </Button>
            <Button
              size="sm"
              variant="destructive-outline"
              loading={marking === "absent"}
              disabled={!canMarkAttendance}
              onClick={() => mark("absent")}
            >
              <XCircle className="h-3.5 w-3.5" /> Absent
            </Button>
            {!canMarkAttendance && (
              <p className="w-full text-xs text-black/40">
                {!isPast ? "Present/Absent unlock once the session ends." : "Join the session first to mark attendance."}
              </p>
            )}
          </>
        ) : (task.attendanceStatus === "present" || task.attendanceStatus === "late") && !task.notesSubmitted ? (
          <>
            <Badge variant={ATTENDANCE_BADGE[task.attendanceStatus].variant}>{ATTENDANCE_BADGE[task.attendanceStatus].label}</Badge>
            <Link href={`/coach/session/${task.bookingId}`}>
              <Button size="sm" variant="outline">
                <ClipboardEdit className="h-3.5 w-3.5" /> Add Notes
              </Button>
            </Link>
          </>
        ) : task.attendanceStatus === "absent" ? (
          <Badge variant="gray">Absent — logged</Badge>
        ) : (
          <Badge variant="green">Notes submitted</Badge>
        )}
      </div>
      {error && <p className="w-full text-xs text-red-600">{error}</p>}
    </div>
  );
}

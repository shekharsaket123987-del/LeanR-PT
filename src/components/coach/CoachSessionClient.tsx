"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Video, CheckCircle2, Target, Dumbbell, HeartPulse, FileClock, UserCheck, UserX, Clock } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { AssessmentBadge } from "@/components/ui/Badge";
import TagEditor from "@/components/ui/TagEditor";
import { CoachSessionDetail, markAttendanceAction, markSessionJoinedAction, submitSessionNotesAction } from "@/lib/actions/coach-portal.actions";
import { isFailure } from "@/lib/actions/action-result";
import { formatDate } from "@/lib/utils";

const PERFORMANCE_OPTIONS: { value: "excellent" | "good" | "average" | "needs_improvement"; label: string }[] = [
  { value: "excellent", label: "Excellent" },
  { value: "good", label: "Good" },
  { value: "average", label: "Average" },
  { value: "needs_improvement", label: "Needs Improvement" },
];

export default function CoachSessionClient({ session }: { session: CoachSessionDetail }) {
  const router = useRouter();

  const [attendance, setAttendance] = useState(session.attendanceStatus);
  const [markingAttendance, setMarkingAttendance] = useState<"present" | "absent" | "late" | null>(null);
  const [absentRemark, setAbsentRemark] = useState("");
  const [attendanceError, setAttendanceError] = useState("");
  const [joined, setJoined] = useState(session.coachJoinedAt != null);
  const [joining, setJoining] = useState(false);
  const sessionEnded = Date.now() >= new Date(session.date).getTime() + session.durationMinutes * 60_000;
  const canMarkAttendance = joined && sessionEnded;

  const [summary, setSummary] = useState(session.notes?.summary ?? "");
  const [exercisesPerformed, setExercisesPerformed] = useState(session.notes?.exercisesPerformed ?? "");
  const [performance, setPerformance] = useState(session.notes?.performance ?? null);
  const [improvements, setImprovements] = useState<string[]>(session.notes?.improvements ?? []);
  const [homework, setHomework] = useState(session.notes?.homework ?? "");
  const [additionalRemarks, setAdditionalRemarks] = useState(session.notes?.additionalRemarks ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [completed, setCompleted] = useState(session.status === "completed");
  const [missed, setMissed] = useState(session.status === "missed");

  async function handleJoin() {
    setJoining(true);
    setAttendanceError("");
    const result = await markSessionJoinedAction(session.id);
    setJoining(false);
    if (isFailure(result)) {
      setAttendanceError(result.error.message);
      return;
    }
    setJoined(true);
    if (session.zoomStartUrl) window.open(session.zoomStartUrl, "_blank", "noopener,noreferrer");
  }

  async function markPresent() {
    setMarkingAttendance("present");
    setAttendanceError("");
    const result = await markAttendanceAction(session.id, "present");
    setMarkingAttendance(null);
    if (isFailure(result)) {
      setAttendanceError(result.error.message);
      return;
    }
    setAttendance("present");
  }

  async function markLate() {
    setMarkingAttendance("late");
    setAttendanceError("");
    const result = await markAttendanceAction(session.id, "late");
    setMarkingAttendance(null);
    if (isFailure(result)) {
      setAttendanceError(result.error.message);
      return;
    }
    setAttendance("late");
  }

  async function markAbsent() {
    setMarkingAttendance("absent");
    setAttendanceError("");
    const result = await markAttendanceAction(session.id, "absent", absentRemark || undefined);
    setMarkingAttendance(null);
    if (isFailure(result)) {
      setAttendanceError(result.error.message);
      return;
    }
    setAttendance("absent");
    setMissed(true);
  }

  async function submitNotes() {
    setSubmitting(true);
    setSubmitError("");
    const result = await submitSessionNotesAction(session.id, {
      summary: summary || undefined,
      exercisesPerformed: exercisesPerformed || undefined,
      performance: performance ?? undefined,
      improvements,
      homework: homework || undefined,
      additionalRemarks: additionalRemarks || undefined,
    });
    setSubmitting(false);
    if (isFailure(result)) {
      setSubmitError(result.error.message);
      return;
    }
    setCompleted(true);
  }

  if (!session.client) {
    return <p className="text-sm text-black/50">No client on this session.</p>;
  }
  const client = session.client;
  const sessionTypeLabel = session.type === "assessment" ? "Demo Session" : "Regular Session";

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title={completed ? "Session Completed" : missed ? "Client Absent" : "In-Session View"}
        description={`${client.name} · ${sessionTypeLabel}`}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {!completed && !missed && (
            <Card className="p-6 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-yellow/15">
                <Video className="h-6 w-6" />
              </div>
              {joined ? (
                <>
                  <p className="mt-3 text-sm font-bold">Session joined</p>
                  <p className="mt-1 text-xs text-black/45">
                    {sessionEnded ? "Mark attendance below." : "Attendance unlocks once the session's scheduled time ends."}
                  </p>
                  {session.zoomStartUrl && !sessionEnded && (
                    <div className="mt-4">
                      <Button variant="outline" href={session.zoomStartUrl} target="_blank">
                        <Video className="h-4 w-4" /> Reopen Zoom
                      </Button>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <p className="mt-3 text-sm font-bold">{session.zoomStartUrl ? "Ready to start this session" : "Start this session"}</p>
                  <p className="mt-1 text-xs text-black/45">
                    {session.zoomStartUrl
                      ? "Opens Zoom in a new tab, on your account, as the meeting host."
                      : "Zoom isn't configured yet -- this marks the session as started so you can log attendance once it ends."}
                  </p>
                  <div className="mt-4">
                    <Button onClick={handleJoin} loading={joining}>
                      <Video className="h-4 w-4" /> Join Zoom Meeting
                    </Button>
                  </div>
                </>
              )}
            </Card>
          )}

          {!completed && !missed && attendance !== "present" && attendance !== "late" && (
            <Card className="mt-6 p-6">
              <p className="mb-1 text-sm font-bold">Attendance</p>
              <p className="mb-4 text-xs text-black/45">
                {canMarkAttendance
                  ? "Mark attendance before you can start session notes. Marking Absent closes this session immediately."
                  : !joined
                    ? "Join the session first -- attendance can't be marked until you have."
                    : "Attendance unlocks once the session's scheduled time has ended."}
              </p>
              <div className="flex flex-wrap gap-3">
                <Button
                  onClick={markPresent}
                  loading={markingAttendance === "present"}
                  disabled={!canMarkAttendance || (markingAttendance !== null && markingAttendance !== "present")}
                >
                  <UserCheck className="h-4 w-4" /> Present
                </Button>
                <Button
                  variant="outline"
                  onClick={markLate}
                  loading={markingAttendance === "late"}
                  disabled={!canMarkAttendance || (markingAttendance !== null && markingAttendance !== "late")}
                >
                  <Clock className="h-4 w-4" /> Late
                </Button>
                <Button
                  variant="destructive-outline"
                  onClick={markAbsent}
                  loading={markingAttendance === "absent"}
                  disabled={!canMarkAttendance || (markingAttendance !== null && markingAttendance !== "absent")}
                >
                  <UserX className="h-4 w-4" /> Absent
                </Button>
              </div>
              <textarea
                value={absentRemark}
                onChange={(e) => setAbsentRemark(e.target.value)}
                rows={2}
                placeholder="Optional remark (only used if marking Absent)"
                className="mt-3 w-full rounded-xl border border-black/15 p-2.5 text-sm"
              />
              {attendanceError && <p className="mt-3 text-xs text-red-600">{attendanceError}</p>}
            </Card>
          )}

          {missed && (
            <Card className="mt-6 p-6">
              <p className="text-sm font-bold text-red-700">Client marked absent</p>
              <p className="mt-1 text-xs text-black/50">This session is closed. No session notes are required for a missed session.</p>
              <Button variant="outline" className="mt-4" onClick={() => router.push("/coach/dashboard")}>
                Back to Dashboard
              </Button>
            </Card>
          )}

          {!missed && (attendance === "present" || attendance === "late" || completed) && (
            <Card className="mt-6 p-6">
              <p className="mb-1 text-sm font-bold">Session Notes</p>
              <p className="mb-4 text-xs text-black/45">Mandatory before the session can be marked completed.</p>

              <div className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase text-black/40">Session Summary</label>
                  <textarea
                    value={summary}
                    onChange={(e) => setSummary(e.target.value)}
                    rows={3}
                    placeholder="e.g. Squat depth improved, still guarding on left knee..."
                    className="w-full rounded-xl border border-black/15 p-3 text-sm"
                    disabled={completed}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase text-black/40">Exercises Performed</label>
                  <textarea
                    value={exercisesPerformed}
                    onChange={(e) => setExercisesPerformed(e.target.value)}
                    rows={2}
                    className="w-full rounded-xl border border-black/15 p-3 text-sm"
                    disabled={completed}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase text-black/40">Client Performance</label>
                  <div className="flex flex-wrap gap-2">
                    {PERFORMANCE_OPTIONS.map((p) => (
                      <button
                        key={p.value}
                        type="button"
                        disabled={completed}
                        onClick={() => setPerformance(p.value)}
                        className={`rounded-xl border px-3.5 py-2 text-xs font-bold disabled:opacity-60 ${
                          performance === p.value ? "border-brand-yellow bg-brand-yellow/15" : "border-black/15"
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>
                {!completed ? (
                  <TagEditor label="Improvements Seen" values={improvements} onChange={setImprovements} />
                ) : (
                  <div>
                    <label className="mb-1.5 block text-xs font-bold uppercase text-black/40">Improvements Seen</label>
                    <div className="flex flex-wrap gap-2">
                      {improvements.length === 0 && <span className="text-sm text-black/40">None recorded.</span>}
                      {improvements.map((i) => (
                        <span key={i} className="rounded-full bg-black/5 px-3 py-1 text-xs font-semibold">
                          {i}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase text-black/40">Homework</label>
                  <textarea
                    value={homework}
                    onChange={(e) => setHomework(e.target.value)}
                    rows={2}
                    placeholder="Exercises till next session (optional)"
                    className="w-full rounded-xl border border-black/15 p-3 text-sm"
                    disabled={completed}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase text-black/40">Additional Remarks</label>
                  <textarea
                    value={additionalRemarks}
                    onChange={(e) => setAdditionalRemarks(e.target.value)}
                    rows={2}
                    placeholder="Optional"
                    className="w-full rounded-xl border border-black/15 p-3 text-sm"
                    disabled={completed}
                  />
                </div>
              </div>

              {submitError && <p className="mt-3 text-xs text-red-600">{submitError}</p>}
              <div className="mt-5 flex justify-end">
                {!completed ? (
                  <Button onClick={submitNotes} loading={submitting} disabled={!summary.trim()}>
                    <CheckCircle2 className="h-4 w-4" /> Mark Completed
                  </Button>
                ) : (
                  <Button variant="outline" onClick={() => router.push("/coach/dashboard")}>
                    Back to Dashboard
                  </Button>
                )}
              </div>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card className="p-5">
            <div className="flex items-center gap-3">
              <div className="relative h-14 w-14 overflow-hidden rounded-xl">
                <Image src={client.photo} alt={client.name} fill className="object-cover" />
              </div>
              <div>
                <p className="text-sm font-bold">{client.name}</p>
              </div>
            </div>
            {session.type === "assessment" && (
              <div className="mt-3">
                <AssessmentBadge amountPaid={session.amountPaid} />
              </div>
            )}

            <div className="mt-5 space-y-4 border-t border-black/[0.06] pt-4">
              <div>
                <p className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase text-black/40">
                  <Target className="h-3.5 w-3.5" /> Goals
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {client.goals.length === 0 && <span className="text-xs text-black/40">Not set</span>}
                  {client.goals.map((g) => (
                    <span key={g} className="rounded-full bg-black/5 px-2.5 py-1 text-[11px] font-semibold">
                      {g}
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase text-black/40">
                  <HeartPulse className="h-3.5 w-3.5" /> Medical Notes
                </p>
                <p className="text-xs text-black/60">{client.medicalNotes || "None on file"}</p>
              </div>
              <div>
                <p className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase text-black/40">
                  <Dumbbell className="h-3.5 w-3.5" /> Equipment
                </p>
                <p className="text-xs text-black/60">{client.equipment.length > 0 ? client.equipment.join(", ") : "None on file"}</p>
              </div>
            </div>
          </Card>

          <Card className="p-5">
            <p className="mb-3 flex items-center gap-1.5 text-xs font-bold uppercase text-black/40">
              <FileClock className="h-3.5 w-3.5" /> Previous Session Remarks
            </p>
            <div className="space-y-3">
              {session.previousNotes.map((n, i) => (
                <div key={i} className="rounded-lg bg-black/[0.03] p-3">
                  <p className="text-[11px] font-bold text-black/50">{formatDate(n.date)}</p>
                  <p className="mt-1 text-xs text-black/60">{n.notes ?? "No notes recorded."}</p>
                </div>
              ))}
              {session.previousNotes.length === 0 && <p className="text-xs text-black/40">No previous sessions yet.</p>}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

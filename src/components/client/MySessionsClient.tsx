"use client";

import { useState } from "react";
import Image from "next/image";
import { CalendarX2, RotateCcw, XCircle, CalendarClock } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge, { AssessmentBadge, SessionStatusBadge } from "@/components/ui/Badge";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import EmptyState from "@/components/ui/EmptyState";
import FeedbackModal from "@/components/client/FeedbackModal";
import RescheduleModal from "@/components/client/RescheduleModal";
import { formatDate, formatTime, hoursUntil } from "@/lib/utils";
import { SchedulingRules, SessionView, cancelSessionAction, rateSessionAction } from "@/lib/actions/client-portal.actions";
import { isFailure } from "@/lib/actions/action-result";

type Tab = "upcoming" | "completed" | "cancelled" | "missed" | "rescheduled";
const tabs: { key: Tab; label: string }[] = [
  { key: "upcoming", label: "Upcoming" },
  { key: "completed", label: "Completed" },
  { key: "cancelled", label: "Cancelled" },
  { key: "missed", label: "Missed" },
  { key: "rescheduled", label: "Rescheduled" },
];

export default function MySessionsClient({ initialSessions, rules: initialRules }: { initialSessions: SessionView[]; rules: SchedulingRules }) {
  const [sessions, setSessions] = useState(initialSessions);
  const [rules, setRules] = useState(initialRules);
  const [tab, setTab] = useState<Tab>("upcoming");
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState("");
  const [feedbackFor, setFeedbackFor] = useState<string | null>(null);
  const [rescheduleId, setRescheduleId] = useState<string | null>(null);

  const filtered = sessions
    .filter((s) => (tab === "rescheduled" ? s.wasRescheduled : s.status === tab))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  async function handleCancel() {
    if (!cancelId) return;
    setCancelling(true);
    setCancelError("");
    const result = await cancelSessionAction(cancelId);
    setCancelling(false);
    if (isFailure(result)) {
      setCancelError(result.error.message);
      return;
    }
    setSessions((prev) => prev.map((s) => (s.id === cancelId ? { ...s, status: "cancelled" } : s)));
    setCancelId(null);
  }

  async function handleRate(rating: number, feedback: string) {
    if (!feedbackFor) return;
    const result = await rateSessionAction(feedbackFor, rating, feedback);
    if (isFailure(result)) throw new Error(result.error.message);
    setSessions((prev) => prev.map((s) => (s.id === feedbackFor ? { ...s, rating, feedback } : s)));
  }

  const feedbackSession = sessions.find((s) => s.id === feedbackFor);

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="My Sessions" description="Everything you've booked, past and upcoming." />

      <div className="mb-6 flex gap-1 overflow-x-auto rounded-xl bg-black/5 p-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 whitespace-nowrap rounded-lg px-4 py-2 text-sm font-bold transition-colors ${
              tab === t.key ? "bg-white shadow-card" : "text-black/50 hover:text-black"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "upcoming" && (
        <p className="mb-4 text-xs font-semibold text-black/45">
          {rules.reschedulesUsedThisWeek} of {rules.reschedulesUsedThisWeek + rules.reschedulesRemaining} reschedules used this week
        </p>
      )}

      {filtered.length === 0 && (
        <EmptyState
          icon={CalendarX2}
          title={`No ${tab} sessions`}
          description={
            tab === "upcoming"
              ? "You don't have any sessions booked yet. Let's fix that."
              : `You don't have any ${tab} sessions on record.`
          }
          action={tab === "upcoming" ? <Button href="/client/book">Book a Session</Button> : undefined}
        />
      )}

      <div className="space-y-3">
        {filtered.map((s) => {
          const hrs = hoursUntil(s.date);
          const canCancel = s.status === "upcoming" && hrs > rules.cancellationCutoffHours;
          const canReschedule = s.status === "upcoming" && hrs > rules.rescheduleCutoffHours;
          const cancellableUntil = new Date(new Date(s.date).getTime() - rules.cancellationCutoffHours * 3600000);
          const reschedulableUntil = new Date(new Date(s.date).getTime() - rules.rescheduleCutoffHours * 3600000);
          return (
            <Card key={s.id} className="p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl">
                  {s.coach && <Image src={s.coach.photo} alt={s.coach.name} fill className="object-cover" />}
                </div>
                <div className="flex-1">
                  <div className="mb-1.5 flex flex-wrap items-center gap-2">
                    {s.type === "assessment" ? <AssessmentBadge /> : <Badge variant="gray">Regular</Badge>}
                    <SessionStatusBadge status={s.status} />
                  </div>
                  <p className="text-sm font-bold">{s.coach?.name}</p>
                  <p className="flex items-center gap-1.5 text-xs text-black/45">
                    <CalendarClock className="h-3.5 w-3.5" />
                    {formatDate(s.date)} · {formatTime(s.date)}
                  </p>
                </div>
                {s.status === "upcoming" && (
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={!canReschedule} onClick={() => setRescheduleId(s.id)}>
                      <RotateCcw className="h-3.5 w-3.5" />
                      Reschedule
                    </Button>
                    <Button variant="destructive-outline" size="sm" disabled={!canCancel} onClick={() => setCancelId(s.id)}>
                      <XCircle className="h-3.5 w-3.5" />
                      Cancel
                    </Button>
                  </div>
                )}
              </div>
              {s.status === "upcoming" && (
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-black/35">
                  <span>
                    {canCancel ? "Cancellable until" : "Cancellation window closed —"} {formatDate(cancellableUntil)} · {formatTime(cancellableUntil)}
                  </span>
                  <span>
                    {canReschedule ? "Reschedulable until" : "Reschedule window closed —"} {formatDate(reschedulableUntil)} · {formatTime(reschedulableUntil)}
                  </span>
                </div>
              )}
              {s.wasRescheduled && s.originalDate && (
                <p className="mt-2 text-[11px] text-black/35">
                  Originally: {formatDate(s.originalDate)} · {formatTime(s.originalDate)}
                </p>
              )}
              {s.status === "completed" && s.coachNotes && (
                <p className="mt-3 rounded-lg bg-black/[0.03] p-3 text-xs text-black/55">
                  <span className="font-bold text-black/70">Coach notes: </span>
                  {s.coachNotes}
                </p>
              )}
              {s.status === "completed" && !s.feedback && (
                <div className="mt-3">
                  <Button variant="outline" size="sm" onClick={() => setFeedbackFor(s.id)}>
                    Rate Session
                  </Button>
                </div>
              )}
            </Card>
          );
        })}
      </div>

      <ConfirmDialog
        open={!!cancelId}
        onClose={() => { setCancelId(null); setCancelError(""); }}
        onConfirm={handleCancel}
        loading={cancelling}
        error={cancelError}
        title="Cancel this session?"
        description="This session will be released back into your coach's calendar. You can always book a new one from the Book a Session page."
        confirmLabel="Cancel Session"
      />

      <FeedbackModal
        open={!!feedbackFor}
        onClose={() => setFeedbackFor(null)}
        coachName={feedbackSession?.coach?.name}
        onSubmit={handleRate}
      />

      <RescheduleModal
        open={!!rescheduleId}
        onClose={() => setRescheduleId(null)}
        bookingId={rescheduleId}
        onRescheduled={(newStart) => {
          setSessions((prev) =>
            prev.map((s) =>
              s.id === rescheduleId ? { ...s, date: newStart, wasRescheduled: true, originalDate: s.originalDate ?? s.date } : s
            )
          );
          setRules((prev) => ({
            ...prev,
            reschedulesUsedThisWeek: prev.reschedulesUsedThisWeek + 1,
            reschedulesRemaining: Math.max(0, prev.reschedulesRemaining - 1),
          }));
          setRescheduleId(null);
        }}
      />
    </div>
  );
}

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
import { clients, getCoach, sessionsForClient } from "@/lib/mock-data";
import { formatDate, formatTime, hoursUntil } from "@/lib/utils";
import { SessionStatus } from "@/lib/types";

const tabs: { key: SessionStatus; label: string }[] = [
  { key: "upcoming", label: "Upcoming" },
  { key: "completed", label: "Completed" },
  { key: "cancelled", label: "Cancelled" },
  { key: "missed", label: "Missed" },
];

export default function MySessionsPage() {
  const [tab, setTab] = useState<SessionStatus>("upcoming");
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [feedbackFor, setFeedbackFor] = useState<string | null>(null);
  const client = clients[0];
  const all = sessionsForClient(client.id);
  const filtered = all.filter((s) => s.status === tab).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

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
          const coach = getCoach(s.coachId);
          const hrs = hoursUntil(s.date);
          const canModify = s.status === "upcoming" && hrs > 12;
          return (
            <Card key={s.id} className="p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl">
                  {coach && <Image src={coach.photo} alt={coach.name} fill className="object-cover" />}
                </div>
                <div className="flex-1">
                  <div className="mb-1.5 flex flex-wrap items-center gap-2">
                    {s.type === "assessment" ? <AssessmentBadge /> : <Badge variant="gray">Regular</Badge>}
                    <SessionStatusBadge status={s.status} />
                  </div>
                  <p className="text-sm font-bold">{coach?.name}</p>
                  <p className="flex items-center gap-1.5 text-xs text-black/45">
                    <CalendarClock className="h-3.5 w-3.5" />
                    {formatDate(s.date)} · {formatTime(s.date)}
                  </p>
                </div>
                {s.status === "upcoming" && (
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={!canModify}>
                      <RotateCcw className="h-3.5 w-3.5" />
                      Reschedule
                    </Button>
                    <Button
                      variant="destructive-outline"
                      size="sm"
                      disabled={!canModify}
                      onClick={() => setCancelId(s.id)}
                    >
                      <XCircle className="h-3.5 w-3.5" />
                      Cancel
                    </Button>
                  </div>
                )}
              </div>
              {s.status === "upcoming" && !canModify && (
                <p className="mt-3 text-[11px] text-black/35">
                  Reschedule / cancel is only available more than 12 hours before the session.
                </p>
              )}
              {s.status === "completed" && s.remarks && (
                <p className="mt-3 rounded-lg bg-black/[0.03] p-3 text-xs text-black/55">
                  <span className="font-bold text-black/70">Coach notes: </span>
                  {s.remarks}
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
        onClose={() => setCancelId(null)}
        onConfirm={() => setCancelId(null)}
        title="Cancel this session?"
        description="This session will be released back into your coach's calendar. You can always book a new one from the Book a Session page."
        confirmLabel="Cancel Session"
      />

      <FeedbackModal
        open={!!feedbackFor}
        onClose={() => setFeedbackFor(null)}
        coachName={feedbackFor ? getCoach(all.find((s) => s.id === feedbackFor)?.coachId ?? "")?.name : undefined}
      />
    </div>
  );
}

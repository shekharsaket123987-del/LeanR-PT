"use client";

import { useState } from "react";
import Image from "next/image";
import { CalendarDays, Video } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge, { AssessmentBadge, SessionStatusBadge } from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";
import { CoachSessionView } from "@/lib/actions/coach-portal.actions";
import { formatDate, formatTime, hoursUntil } from "@/lib/utils";

function startOfWeek(d: Date) {
  const date = new Date(d);
  const day = date.getDay();
  date.setDate(date.getDate() - day);
  date.setHours(0, 0, 0, 0);
  return date;
}

export default function CoachScheduleClient({ sessions }: { sessions: CoachSessionView[] }) {
  const [view, setView] = useState<"day" | "week">("week");
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  const weekStart = startOfWeek(new Date());
  const days = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });

  const todaySessions = sessions
    .filter((s) => new Date(s.date).toDateString() === new Date().toDateString())
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Schedule"
        description="Your upcoming bookings, day by day."
        action={
          <div className="flex gap-1 rounded-xl bg-black/5 p-1">
            <button
              onClick={() => setView("day")}
              className={`rounded-lg px-4 py-2 text-sm font-bold ${view === "day" ? "bg-white shadow-card" : "text-black/50"}`}
            >
              Day
            </button>
            <button
              onClick={() => setView("week")}
              className={`rounded-lg px-4 py-2 text-sm font-bold ${view === "week" ? "bg-white shadow-card" : "text-black/50"}`}
            >
              Week
            </button>
          </div>
        }
      />

      {view === "day" && (
        <div className="space-y-3">
          {todaySessions.length === 0 && (
            <Card className="p-10 text-center text-sm text-black/40">No sessions scheduled for today.</Card>
          )}
          {todaySessions.map((s) => {
            const canJoin = hoursUntil(s.date) <= 1 / 6 && hoursUntil(s.date) > -(s.durationMinutes / 60);
            return (
              <Card key={s.id} className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
                <div className="w-20 shrink-0 text-sm font-bold">{formatTime(s.date)}</div>
                <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl">
                  {s.client && <Image src={s.client.photo} alt={s.client.name} fill className="object-cover" />}
                </div>
                <div className="flex-1">
                  <div className="mb-1 flex items-center gap-2">
                    {s.type === "assessment" ? <AssessmentBadge amountPaid={s.amountPaid} /> : <Badge variant="gray">Regular</Badge>}
                  </div>
                  <p className="text-sm font-bold">{s.client?.name}</p>
                </div>
                <Button href={`/coach/session/${s.id}`} disabled={!canJoin}>
                  <Video className="h-4 w-4" /> Join
                </Button>
              </Card>
            );
          })}
        </div>
      )}

      {view === "week" && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-7">
          {days.map((d) => {
            const daySessions = sessions
              .filter((s) => new Date(s.date).toDateString() === d.toDateString())
              .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
            const isToday = d.toDateString() === new Date().toDateString();
            return (
              <button
                key={d.toISOString()}
                type="button"
                onClick={() => daySessions.length > 0 && setSelectedDay(d)}
                className={`rounded-2xl border p-3 text-left transition-colors ${
                  isToday ? "border-brand-yellow bg-brand-yellow/5" : "border-black/[0.06] bg-white"
                } ${daySessions.length > 0 ? "hover:border-black/25 cursor-pointer" : "cursor-default"}`}
              >
                <p className="mb-2 text-center text-xs font-bold text-black/60">
                  {d.toLocaleDateString("en-US", { weekday: "short" })}
                  <br />
                  <span className="text-base">{d.getDate()}</span>
                </p>
                <div className="flex flex-col items-center gap-1 py-2">
                  {daySessions.length === 0 ? (
                    <p className="text-[10px] text-black/25">—</p>
                  ) : (
                    <>
                      <CalendarDays className="h-4 w-4 text-black/40" />
                      <p className="text-xs font-bold">
                        {daySessions.length} session{daySessions.length === 1 ? "" : "s"}
                      </p>
                    </>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}

      <Modal
        open={!!selectedDay}
        onClose={() => setSelectedDay(null)}
        title={selectedDay ? formatDate(selectedDay, { weekday: "long", month: "short", day: "numeric" }) : ""}
      >
        <div className="space-y-3">
          {selectedDay &&
            sessions
              .filter((s) => new Date(s.date).toDateString() === selectedDay.toDateString())
              .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
              .map((s) => (
                <a
                  key={s.id}
                  href={`/coach/session/${s.id}`}
                  className="flex items-center gap-3 rounded-xl border border-black/10 p-3 hover:border-black/25"
                >
                  <div className="w-16 shrink-0 text-sm font-bold">{formatTime(s.date)}</div>
                  <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full">
                    {s.client && <Image src={s.client.photo} alt={s.client.name} fill className="object-cover" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold">{s.client?.name ?? "Client"}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      {s.type === "assessment" ? <AssessmentBadge amountPaid={s.amountPaid} /> : <Badge variant="gray">Regular</Badge>}
                      <SessionStatusBadge status={s.status} />
                    </div>
                  </div>
                </a>
              ))}
        </div>
      </Modal>
    </div>
  );
}

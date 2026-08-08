"use client";

import { useState } from "react";
import { CalendarCheck2 } from "lucide-react";
import EmptyState from "@/components/ui/EmptyState";
import { TaskRow } from "@/components/coach/CoachTaskRow";
import { CoachTodayTaskView } from "@/lib/actions/coach-portal.actions";

export default function CoachTodayTasksClient({ initialTasks }: { initialTasks: CoachTodayTaskView[] }) {
  const [tasks, setTasks] = useState(initialTasks);

  function handleMarked(bookingId: string, status: "present" | "absent" | "late") {
    setTasks((prev) =>
      status === "absent"
        ? prev.filter((t) => t.bookingId !== bookingId) // booking closes to 'missed', task is done
        : prev.map((t) => (t.bookingId === bookingId ? { ...t, attendanceStatus: status, overdue: false } : t))
    );
  }

  if (tasks.length === 0) {
    return (
      <EmptyState
        icon={CalendarCheck2}
        title="Nothing left for today"
        description="Every session today is either done or hasn't started yet."
      />
    );
  }

  return (
    <div className="space-y-2">
      {tasks.map((t) => (
        <TaskRow key={t.bookingId} task={t} onMarked={handleMarked} />
      ))}
    </div>
  );
}

"use client";

import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import EmptyState from "@/components/ui/EmptyState";
import { TaskRow } from "@/components/coach/CoachTaskRow";
import { CoachTodayTaskView } from "@/lib/actions/coach-portal.actions";

export default function CoachPendingTasksClient({ initialTasks }: { initialTasks: CoachTodayTaskView[] }) {
  const [tasks, setTasks] = useState(initialTasks);

  function handleMarked(bookingId: string, status: "present" | "absent") {
    setTasks((prev) =>
      status === "absent"
        ? prev.filter((t) => t.bookingId !== bookingId) // booking closes to 'missed', task is done
        : prev.map((t) => (t.bookingId === bookingId ? { ...t, attendanceStatus: status, overdue: false } : t))
      // present-but-no-notes-yet stays visible with an "Add Notes" action;
      // it drops off on the next real load once notes are actually saved.
    );
  }

  if (tasks.length === 0) {
    return <EmptyState icon={CheckCircle2} title="All caught up" description="No past sessions are waiting on attendance or notes." />;
  }

  return (
    <div className="space-y-2">
      {tasks.map((t) => (
        <TaskRow key={t.bookingId} task={t} onMarked={handleMarked} />
      ))}
    </div>
  );
}

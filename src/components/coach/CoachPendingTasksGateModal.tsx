"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertOctagon, ChevronRight, X } from "lucide-react";
import Button from "@/components/ui/Button";
import { CoachTodayTaskView } from "@/lib/actions/coach-portal.actions";
import { formatDate, formatTime } from "@/lib/utils";

const MAX_LISTED = 5;

function reasonFor(task: CoachTodayTaskView): string {
  return task.attendanceStatus ? "Session notes not submitted" : "Attendance not marked";
}

/** Every-login nudge for backlog sessions still missing attendance or notes
 * (Pending Tasks widget, coach-portal.actions.ts::getCoachPendingTasksAction)
 * -- same no-persisted-dismissal shape as the client portal's
 * MeasurementGateModal/SessionsLowGateModal (reappears every login while the
 * backlog is non-empty), but red/urgent rather than yellow-branded: these
 * are overdue action items, not a routine reminder, and "Skip for now"
 * deliberately stays available -- this is a nudge, not a hard block, since
 * (unlike the client measurement gate) nothing else in the coach portal is
 * actually gated on clearing this list. */
export default function CoachPendingTasksGateModal({ initialPendingTasks }: { initialPendingTasks: CoachTodayTaskView[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(initialPendingTasks.length > 0);

  if (!open) return null;

  const tasks = initialPendingTasks;
  const listed = tasks.slice(0, MAX_LISTED);
  const extra = tasks.length - listed.length;

  return (
    // Insets carve out the nav chrome (mobile top bar's ~56px, PortalShell.tsx;
    // the lg:w-72 sidebar on desktop) rather than covering the full viewport
    // like the client portal's hard-blocking gates do -- z-index alone can't
    // get this right since the sidebar sits at different stacking layers on
    // mobile vs. desktop. This is a soft nudge (see comment above -- nothing
    // else is gated on clearing it), so it must never trap the coach behind
    // an unreachable hamburger button or an unusable sidebar.
    <div className="fixed left-0 right-0 top-14 bottom-0 z-30 flex items-center justify-center p-4 lg:left-72 lg:top-0">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" />
      <div className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border-2 border-red-200 bg-white p-6 shadow-2xl animate-slide-up">
        <div className="mb-1 flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-100">
            <AlertOctagon className="h-4.5 w-4.5 text-red-600" style={{ height: 18, width: 18 }} />
          </div>
          <h3 className="text-display text-xl font-bold italic text-red-700">
            {tasks.length} session{tasks.length === 1 ? "" : "s"} still need action
          </h3>
        </div>
        <p className="mb-5 text-sm text-black/50">
          These are past sessions that still need attendance marked or notes submitted before they can close out.
        </p>

        <div className="space-y-2">
          {listed.map((t) => (
            <div key={t.bookingId} className="flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-bold">{t.clientName}</p>
                <p className="text-xs text-black/50">
                  {formatDate(t.scheduledStart)} · {formatTime(t.scheduledStart)}
                </p>
                <p className="text-xs font-semibold text-red-600">{reasonFor(t)}</p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setOpen(false);
                  router.push(`/coach/session/${t.bookingId}`);
                }}
              >
                Resolve <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
          {extra > 0 && <p className="text-center text-xs text-black/40">+{extra} more on your Schedule page</p>}
        </div>

        <div className="mt-6 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="flex items-center gap-1.5 text-xs font-semibold text-black/40 hover:text-black/60"
          >
            <X className="h-3.5 w-3.5" />
            Skip for now
          </button>
          <Button
            onClick={() => {
              setOpen(false);
              router.push("/coach/schedule");
            }}
          >
            Review Now
          </Button>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { CalendarDays, Loader2 } from "lucide-react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import { formatDate, formatTime } from "@/lib/utils";
import { RescheduleOptions, getRescheduleOptionsAction, rescheduleSessionAction } from "@/lib/actions/client-portal.actions";
import { isFailure } from "@/lib/actions/action-result";

export default function RescheduleModal({
  open,
  onClose,
  bookingId,
  onRescheduled,
}: {
  open: boolean;
  onClose: () => void;
  bookingId: string | null;
  onRescheduled: (newStart: string) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [options, setOptions] = useState<RescheduleOptions | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<{ start: string; end: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  useEffect(() => {
    if (!open || !bookingId) return;
    setLoading(true);
    setLoadError("");
    setOptions(null);
    setSelectedSlot(null);
    setSubmitError("");
    getRescheduleOptionsAction(bookingId).then((result) => {
      setLoading(false);
      if (isFailure(result)) {
        setLoadError(result.error.message);
        return;
      }
      setOptions(result.data);
    });
  }, [open, bookingId]);

  async function submit() {
    if (!bookingId || !selectedSlot) return;
    setSubmitting(true);
    setSubmitError("");
    const result = await rescheduleSessionAction(bookingId, selectedSlot.start);
    setSubmitting(false);
    if (isFailure(result)) {
      setSubmitError(result.error.message);
      return;
    }
    onRescheduled(selectedSlot.start);
  }

  return (
    <Modal open={open} onClose={onClose} title="Reschedule Session" maxWidth="max-w-xl">
      {loading && (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-black/40" />
        </div>
      )}

      {!loading && loadError && <p className="text-sm text-red-600">{loadError}</p>}

      {!loading && options && (
        <>
          <p className="mb-4 text-xs text-black/45">
            Showing {options.coach.name.split(" ")[0]}&apos;s open slots for the rest of this week ·{" "}
            <span className="font-bold text-black/60">{options.reschedulesRemaining} of 2 reschedules left this week</span>
          </p>
          <p className="mb-4 rounded-lg bg-black/[0.03] p-3 text-xs text-black/50">
            Sessions can be rescheduled up to 2 times per week, and must be moved at least {options.cutoffHours} hour
            {options.cutoffHours === 1 ? "" : "s"} before the original start time.
          </p>

          {options.slots.length === 0 && (
            <EmptyState icon={CalendarDays} title="No open slots left this week" description="Try again next week, or contact support." />
          )}

          <div className="grid max-h-80 grid-cols-1 gap-3 overflow-y-auto sm:grid-cols-2">
            {options.slots.map((slot) => (
              <button
                key={slot.start}
                onClick={() => setSelectedSlot(slot)}
                className={`rounded-xl border-2 p-4 text-left transition-colors ${
                  selectedSlot?.start === slot.start ? "border-brand-yellow bg-brand-yellow/10" : "border-black/10 hover:border-black/25"
                }`}
              >
                <CalendarDays className="mb-2 h-5 w-5 text-black/60" />
                <p className="text-sm font-bold">{formatDate(slot.start)}</p>
                <p className="text-xs text-black/45">
                  {formatTime(slot.start)} · {options.durationMinutes} min
                </p>
              </button>
            ))}
          </div>

          {selectedSlot && (
            <p className="mt-4 text-xs text-black/50">
              This will move your session to {formatDate(selectedSlot.start)} · {formatTime(selectedSlot.start)}, using{" "}
              {options.reschedulesUsedThisWeek + 1} of your 2 reschedules for this week.
            </p>
          )}
          {submitError && <p className="mt-4 text-xs text-red-600">{submitError}</p>}

          <div className="mt-6 flex justify-end gap-3">
            <Button variant="outline" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={!selectedSlot} loading={submitting}>
              Confirm New Time
            </Button>
          </div>
        </>
      )}
    </Modal>
  );
}

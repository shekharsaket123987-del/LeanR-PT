"use client";

import { useEffect, useState } from "react";
import { CalendarDays, Loader2, Users, Zap } from "lucide-react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import { formatDate, formatTime } from "@/lib/utils";
import {
  CoachClosestSlot,
  RescheduleOptions,
  RescheduleTimeCheck,
  checkRescheduleTimeAction,
  getClosestSlotsPerCoachAction,
  getRescheduleOptionsAction,
  rescheduleSessionAction,
  rescheduleSessionToSubstituteAction,
} from "@/lib/actions/client-portal.actions";
import { isFailure } from "@/lib/actions/action-result";

function formatHour(h: number) {
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:00 ${period}`;
}

function todayDateString() {
  return new Date().toISOString().slice(0, 10);
}

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

  const [closestSlots, setClosestSlots] = useState<CoachClosestSlot[] | null>(null);
  const [closestLoading, setClosestLoading] = useState(false);
  const [bookingClosestKey, setBookingClosestKey] = useState<string | null>(null);
  const [closestError, setClosestError] = useState("");

  const [desiredDate, setDesiredDate] = useState("");
  const [desiredTime, setDesiredTime] = useState("");
  const [checkingDesired, setCheckingDesired] = useState(false);
  const [desiredError, setDesiredError] = useState("");
  const [desiredResult, setDesiredResult] = useState<RescheduleTimeCheck | null>(null);
  const [assigningCoachId, setAssigningCoachId] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !bookingId) return;
    setLoading(true);
    setLoadError("");
    setOptions(null);
    setSelectedSlot(null);
    setSubmitError("");
    setDesiredDate("");
    setDesiredTime("");
    setDesiredError("");
    setDesiredResult(null);
    setClosestSlots(null);
    setClosestError("");
    getRescheduleOptionsAction(bookingId).then((result) => {
      setLoading(false);
      if (isFailure(result)) {
        setLoadError(result.error.message);
        return;
      }
      setOptions(result.data);
      setDesiredTime(`${String(result.data.startHour).padStart(2, "0")}:00`);
    });

    setClosestLoading(true);
    getClosestSlotsPerCoachAction(bookingId).then((result) => {
      setClosestLoading(false);
      if (isFailure(result)) {
        setClosestError(result.error.message);
        return;
      }
      setClosestSlots(result.data);
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

  async function checkDesiredTime() {
    if (!bookingId || !desiredDate || !desiredTime) return;
    setCheckingDesired(true);
    setDesiredError("");
    setDesiredResult(null);
    const result = await checkRescheduleTimeAction(bookingId, desiredDate, desiredTime);
    setCheckingDesired(false);
    if (isFailure(result)) {
      setDesiredError(result.error.message);
      return;
    }
    setDesiredResult(result.data);
  }

  async function confirmDesiredTime() {
    if (!bookingId || !desiredResult) return;
    setSubmitting(true);
    setSubmitError("");
    const result = await rescheduleSessionAction(bookingId, desiredResult.desiredStart);
    setSubmitting(false);
    if (isFailure(result)) {
      setSubmitError(result.error.message);
      return;
    }
    onRescheduled(desiredResult.desiredStart);
  }

  async function bookClosestSlot(slot: CoachClosestSlot) {
    if (!bookingId) return;
    setBookingClosestKey(slot.coachId);
    setClosestError("");
    const result = slot.isOwnCoach
      ? await rescheduleSessionAction(bookingId, slot.start)
      : await rescheduleSessionToSubstituteAction(bookingId, slot.start, slot.coachId);
    setBookingClosestKey(null);
    if (isFailure(result)) {
      setClosestError(result.error.message);
      return;
    }
    onRescheduled(slot.start);
  }

  async function assignSubstitute(coachId: string) {
    if (!bookingId || !desiredResult) return;
    setAssigningCoachId(coachId);
    setDesiredError("");
    const result = await rescheduleSessionToSubstituteAction(bookingId, desiredResult.desiredStart, coachId);
    setAssigningCoachId(null);
    if (isFailure(result)) {
      setDesiredError(result.error.message);
      return;
    }
    onRescheduled(desiredResult.desiredStart);
  }

  const hourOptions = options ? Array.from({ length: options.endHour - options.startHour }, (_, i) => options.startHour + i) : [];

  return (
    <Modal open={open} onClose={onClose} title="Reschedule Session" maxWidth="max-w-xl">
      {loading && (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-white/40" />
        </div>
      )}

      {!loading && loadError && <p className="text-sm text-red-400">{loadError}</p>}

      {!loading && options && (
        <>
          {(closestLoading || (closestSlots && closestSlots.length > 0)) && (
            <div className="mb-5 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
              <p className="mb-1 flex items-center gap-1.5 text-sm font-bold">
                <Zap className="h-4 w-4 text-brand-yellow" /> Fastest Available
              </p>
              <p className="mb-3 text-xs text-white/45">
                Each coach&apos;s soonest open slot, so you don&apos;t have to check times one by one.
              </p>
              {closestLoading && (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-4 w-4 animate-spin text-white/40" />
                </div>
              )}
              {!closestLoading && closestSlots && (
                <div className="space-y-2">
                  {closestSlots.map((slot) => (
                    <div
                      key={slot.coachId}
                      className={`flex items-center justify-between rounded-lg border p-3 ${
                        slot.isOwnCoach ? "border-brand-yellow bg-brand-yellow/10" : "border-white/10"
                      }`}
                    >
                      <div>
                        <p className="text-sm font-semibold">
                          {slot.coachName} {slot.isOwnCoach && <span className="text-xs font-bold text-brand-yellow">· Your coach</span>}
                        </p>
                        <p className="text-xs text-white/50">
                          {formatDate(slot.start)} · {formatTime(slot.start)}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant={slot.isOwnCoach ? "primary" : "outline"}
                        loading={bookingClosestKey === slot.coachId}
                        onClick={() => bookClosestSlot(slot)}
                      >
                        Book This
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              {closestError && <p className="mt-2 text-xs text-red-400">{closestError}</p>}
            </div>
          )}

          <p className="mb-4 text-xs text-white/45">
            Or browse {options.coach.name.split(" ")[0]}&apos;s open slots for the next 30 days ·{" "}
            <span className="font-bold text-white/60">{options.reschedulesRemaining} of 2 reschedules left this week</span>
          </p>
          <p className="mb-4 rounded-lg bg-white/[0.03] p-3 text-xs text-white/50">
            Sessions can be rescheduled up to 2 times per week, must be moved at least {options.cutoffHours} hour
            {options.cutoffHours === 1 ? "" : "s"} before the original start time, and can't land on a day you already have another session.
          </p>

          {options.slots.length === 0 && (
            <EmptyState icon={CalendarDays} title="No open slots found" description="Try a specific date & time below, or contact support." />
          )}

          <div className="grid max-h-80 grid-cols-1 gap-3 overflow-y-auto sm:grid-cols-2">
            {options.slots.map((slot) => (
              <button
                key={slot.start}
                onClick={() => setSelectedSlot(slot)}
                className={`rounded-xl border-2 p-4 text-left transition-colors ${
                  selectedSlot?.start === slot.start ? "border-brand-yellow bg-brand-yellow/10" : "border-white/10 hover:border-white/25"
                }`}
              >
                <CalendarDays className="mb-2 h-5 w-5 text-white/60" />
                <p className="text-sm font-bold">{formatDate(slot.start)}</p>
                <p className="text-xs text-white/45">
                  {formatTime(slot.start)} · {options.durationMinutes} min
                </p>
              </button>
            ))}
          </div>

          {selectedSlot && (
            <p className="mt-4 text-xs text-white/50">
              This will move your session to {formatDate(selectedSlot.start)} · {formatTime(selectedSlot.start)}, using{" "}
              {options.reschedulesUsedThisWeek + 1} of your 2 reschedules for this week.
            </p>
          )}
          {submitError && <p className="mt-4 text-xs text-red-400">{submitError}</p>}

          <div className="mt-6 flex justify-end gap-3">
            <Button variant="outline" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={!selectedSlot} loading={submitting}>
              Confirm New Time
            </Button>
          </div>

          <div className="mt-6 border-t border-white/[0.06] pt-5">
            <p className="text-sm font-bold">Prefer a specific date &amp; time?</p>
            <p className="mt-1 text-xs text-white/45">
              If it's not free with {options.coach.name.split(" ")[0]}, we'll check whether another coach can cover just this one session.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <input
                type="date"
                min={todayDateString()}
                value={desiredDate}
                onChange={(e) => {
                  setDesiredDate(e.target.value);
                  setDesiredResult(null);
                }}
                className="rounded-xl border border-white/15 p-2.5 text-sm"
              />
              <select
                value={desiredTime}
                onChange={(e) => {
                  setDesiredTime(e.target.value);
                  setDesiredResult(null);
                }}
                className="rounded-xl border border-white/15 p-2.5 text-sm"
              >
                {hourOptions.map((h) => (
                  <option key={h} value={`${String(h).padStart(2, "0")}:00`}>
                    {formatHour(h)}
                  </option>
                ))}
              </select>
              <Button size="sm" variant="outline" onClick={checkDesiredTime} disabled={!desiredDate || !desiredTime} loading={checkingDesired}>
                Check This Time
              </Button>
            </div>

            {desiredError && <p className="mt-3 text-xs text-red-400">{desiredError}</p>}

            {desiredResult?.available && (
              <div className="mt-4 rounded-xl bg-white/[0.03] p-4">
                <p className="text-sm font-semibold">
                  {formatDate(desiredResult.desiredStart)} · {formatTime(desiredResult.desiredStart)} is free with {options.coach.name}.
                </p>
                <Button size="sm" className="mt-3" onClick={confirmDesiredTime} loading={submitting}>
                  Confirm This Time
                </Button>
              </div>
            )}

            {desiredResult && !desiredResult.available && (
              <div className="mt-4 rounded-xl bg-white/[0.03] p-4">
                <p className="text-sm font-semibold">Not free with {options.coach.name.split(" ")[0]} at that time.</p>
                {desiredResult.candidates.length === 0 ? (
                  <p className="mt-1 text-xs text-white/50">No other coach is free then either — try another time, or contact support.</p>
                ) : (
                  <>
                    <p className="mt-1 text-xs text-white/50">
                      These coaches are free just for this one session — your regular sessions stay with {options.coach.name.split(" ")[0]}.
                    </p>
                    <div className="mt-3 space-y-2">
                      {desiredResult.candidates.map((c) => (
                        <div key={c.coachId} className="flex items-center justify-between rounded-lg border border-white/10 p-3">
                          <span className="flex items-center gap-2 text-sm font-semibold">
                            <Users className="h-4 w-4 text-white/40" />
                            {c.name}
                          </span>
                          <Button size="sm" variant="outline" onClick={() => assignSubstitute(c.coachId)} loading={assigningCoachId === c.coachId}>
                            Assign &amp; Reschedule
                          </Button>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </Modal>
  );
}

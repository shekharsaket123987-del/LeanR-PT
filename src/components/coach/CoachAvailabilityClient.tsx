"use client";

import { useState } from "react";
import { Plus, PlaneTakeoff } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { SessionStatusBadge } from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";
import { requestLeaveAction, saveAvailabilityAction } from "@/lib/actions/coach-portal.actions";
import { AvailabilityWindow } from "@/lib/services/availability.service";
import { isFailure } from "@/lib/actions/action-result";
import { formatDate } from "@/lib/utils";

const DAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** Leave requests require 24 hours' advance notice (server-enforced); a
 * same-day date is never valid, so the picker shouldn't offer it. */
function minLeaveFromISO(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

type LeaveType = "full_day" | "partial";

interface DayRow {
  enabled: boolean;
  start: string;
  end: string;
}

function buildInitialRows(windows: AvailabilityWindow[]): DayRow[] {
  return DAY_LABELS.map((_, day) => {
    const w = windows.find((x) => x.day_of_week === day);
    return w ? { enabled: w.is_active, start: w.start_time.slice(0, 5), end: w.end_time.slice(0, 5) } : { enabled: false, start: "06:00", end: "20:00" };
  });
}

export default function CoachAvailabilityClient({
  initialWindows,
  initialLeave,
}: {
  initialWindows: AvailabilityWindow[];
  initialLeave: {
    id: string;
    starts_on: string;
    ends_on: string;
    reason: string | null;
    status: string;
    leave_type?: LeaveType;
    partial_start_time?: string | null;
    partial_end_time?: string | null;
  }[];
}) {
  const [rows, setRows] = useState<DayRow[]>(buildInitialRows(initialWindows));
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saved, setSaved] = useState(false);

  const [leave, setLeave] = useState(initialLeave);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [leaveType, setLeaveType] = useState<LeaveType>("full_day");
  const [leaveReason, setLeaveReason] = useState("");
  const [leaveFrom, setLeaveFrom] = useState("");
  const [leaveTo, setLeaveTo] = useState("");
  const [partialStart, setPartialStart] = useState("");
  const [partialEnd, setPartialEnd] = useState("");
  const [leaveSubmitting, setLeaveSubmitting] = useState(false);
  const [leaveError, setLeaveError] = useState("");

  function toggleDay(i: number) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, enabled: !r.enabled } : r)));
    setSaved(false);
  }

  function updateTime(i: number, field: "start" | "end", value: string) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, [field]: value } : r)));
    setSaved(false);
  }

  async function save() {
    setSaving(true);
    setSaveError("");
    const windows: AvailabilityWindow[] = rows
      .map((r, day) => ({ day_of_week: day, start_time: r.start, end_time: r.end, is_active: r.enabled }))
      .filter((w) => w.is_active);
    const result = await saveAvailabilityAction(windows);
    setSaving(false);
    if (isFailure(result)) {
      setSaveError(result.error.message);
      return;
    }
    setSaved(true);
  }

  function resetLeaveForm() {
    setLeaveOpen(false);
    setLeaveType("full_day");
    setLeaveReason("");
    setLeaveFrom("");
    setLeaveTo("");
    setPartialStart("");
    setPartialEnd("");
  }

  async function submitLeave() {
    if (!leaveFrom || (leaveType === "full_day" && !leaveTo)) {
      setLeaveError("Pick a date");
      return;
    }
    if (leaveType === "partial" && (!partialStart || !partialEnd)) {
      setLeaveError("Pick the unavailable time window");
      return;
    }
    setLeaveSubmitting(true);
    setLeaveError("");
    const endsOn = leaveType === "partial" ? leaveFrom : leaveTo;
    const result = await requestLeaveAction({
      starts_on: leaveFrom,
      ends_on: endsOn,
      reason: leaveReason || undefined,
      leaveType,
      partialStartTime: leaveType === "partial" ? partialStart : undefined,
      partialEndTime: leaveType === "partial" ? partialEnd : undefined,
    });
    setLeaveSubmitting(false);
    if (isFailure(result)) {
      setLeaveError(result.error.message);
      return;
    }
    setLeave((prev) => [
      {
        id: crypto.randomUUID(),
        starts_on: leaveFrom,
        ends_on: endsOn,
        reason: leaveReason || null,
        status: "pending",
        leave_type: leaveType,
        partial_start_time: leaveType === "partial" ? `${partialStart}:00` : null,
        partial_end_time: leaveType === "partial" ? `${partialEnd}:00` : null,
      },
      ...prev,
    ]);
    resetLeaveForm();
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Availability" description="Set your working hours and manage time off." />

      <Card className="p-6">
        <p className="mb-4 text-sm font-bold">Weekly Working Hours</p>
        <div className="space-y-2">
          {DAY_LABELS.map((label, i) => (
            <div key={label} className="flex flex-wrap items-center gap-4 rounded-xl border border-black/[0.06] px-4 py-3">
              <label className="flex w-32 items-center gap-2.5">
                <input type="checkbox" checked={rows[i].enabled} onChange={() => toggleDay(i)} className="h-4 w-4 accent-brand-yellow" />
                <span className="text-sm font-semibold">{label}</span>
              </label>
              {rows[i].enabled ? (
                <div className="flex items-center gap-2 text-sm">
                  <input
                    type="time"
                    value={rows[i].start}
                    onChange={(e) => updateTime(i, "start", e.target.value)}
                    className="rounded-lg border border-black/15 px-2 py-1 text-sm"
                  />
                  <span className="text-black/40">–</span>
                  <input
                    type="time"
                    value={rows[i].end}
                    onChange={(e) => updateTime(i, "end", e.target.value)}
                    className="rounded-lg border border-black/15 px-2 py-1 text-sm"
                  />
                </div>
              ) : (
                <span className="text-sm text-black/30">Unavailable</span>
              )}
            </div>
          ))}
        </div>
        {saveError && <p className="mt-4 text-sm text-red-600">{saveError}</p>}
        {saved && <p className="mt-4 text-sm text-emerald-600">Saved.</p>}
        <div className="mt-5 flex justify-end">
          <Button onClick={save} loading={saving}>
            Save Working Hours
          </Button>
        </div>
      </Card>

      <Card className="mt-6 p-6">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm font-bold">Leave Requests</p>
          <Button variant="outline" size="sm" onClick={() => setLeaveOpen(true)}>
            <Plus className="h-3.5 w-3.5" /> Request Leave
          </Button>
        </div>
        <div className="space-y-2">
          {leave.map((b) => (
            <div key={b.id} className="flex items-center justify-between rounded-xl bg-black/[0.03] px-4 py-3">
              <div className="flex items-center gap-2.5">
                <PlaneTakeoff className="h-4 w-4 text-black/40" />
                <div>
                  <p className="text-sm font-semibold">{b.reason || "Leave"}</p>
                  <p className="text-xs text-black/40">
                    {b.leave_type === "partial"
                      ? `${formatDate(b.starts_on)} · ${b.partial_start_time?.slice(0, 5)}–${b.partial_end_time?.slice(0, 5)}`
                      : `${formatDate(b.starts_on)} – ${formatDate(b.ends_on)}`}
                  </p>
                </div>
              </div>
              <SessionStatusBadge status={b.status} />
            </div>
          ))}
          {leave.length === 0 && <p className="text-xs text-black/40">No time off scheduled.</p>}
        </div>
      </Card>

      <Modal open={leaveOpen} onClose={resetLeaveForm} title="Request Leave">
        <div className="space-y-4">
          <div className="flex gap-1 rounded-xl bg-black/5 p-1">
            {(["full_day", "partial"] as LeaveType[]).map((t) => (
              <button
                key={t}
                onClick={() => setLeaveType(t)}
                className={`flex-1 rounded-lg px-3 py-2 text-sm font-bold transition-colors ${
                  leaveType === t ? "bg-white shadow-card" : "text-black/50 hover:text-black"
                }`}
              >
                {t === "full_day" ? "Full day" : "Partial day"}
              </button>
            ))}
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase text-black/40">Reason</label>
            <input
              value={leaveReason}
              onChange={(e) => setLeaveReason(e.target.value)}
              className="w-full rounded-xl border border-black/15 p-3 text-sm focus:border-brand-yellow focus:outline-none focus:ring-1 focus:ring-brand-yellow"
              placeholder="e.g. Personal travel"
            />
          </div>

          {leaveType === "full_day" ? (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase text-black/40">From</label>
                <input
                  type="date"
                  value={leaveFrom}
                  min={minLeaveFromISO()}
                  onChange={(e) => setLeaveFrom(e.target.value)}
                  className="w-full rounded-xl border border-black/15 p-3 text-sm focus:border-brand-yellow focus:outline-none focus:ring-1 focus:ring-brand-yellow"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase text-black/40">To</label>
                <input
                  type="date"
                  value={leaveTo}
                  min={leaveFrom || minLeaveFromISO()}
                  onChange={(e) => setLeaveTo(e.target.value)}
                  className="w-full rounded-xl border border-black/15 p-3 text-sm focus:border-brand-yellow focus:outline-none focus:ring-1 focus:ring-brand-yellow"
                />
              </div>
            </div>
          ) : (
            <>
              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase text-black/40">Date</label>
                <input
                  type="date"
                  value={leaveFrom}
                  min={minLeaveFromISO()}
                  onChange={(e) => setLeaveFrom(e.target.value)}
                  className="w-full rounded-xl border border-black/15 p-3 text-sm focus:border-brand-yellow focus:outline-none focus:ring-1 focus:ring-brand-yellow"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase text-black/40">Unavailable from</label>
                  <input
                    type="time"
                    value={partialStart}
                    onChange={(e) => setPartialStart(e.target.value)}
                    className="w-full rounded-xl border border-black/15 p-3 text-sm focus:border-brand-yellow focus:outline-none focus:ring-1 focus:ring-brand-yellow"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase text-black/40">Until</label>
                  <input
                    type="time"
                    value={partialEnd}
                    onChange={(e) => setPartialEnd(e.target.value)}
                    className="w-full rounded-xl border border-black/15 p-3 text-sm focus:border-brand-yellow focus:outline-none focus:ring-1 focus:ring-brand-yellow"
                  />
                </div>
              </div>
              <p className="text-xs text-black/40">Only sessions inside this window are affected — the rest of the day stays bookable.</p>
            </>
          )}

          <p className="text-xs text-black/40">Leave must be requested at least 24 hours before it starts.</p>
          {leaveError && <p className="text-xs text-red-600">{leaveError}</p>}
          <Button className="w-full" onClick={submitLeave} loading={leaveSubmitting}>
            Submit Request
          </Button>
        </div>
      </Modal>
    </div>
  );
}

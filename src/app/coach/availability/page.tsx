"use client";

import { useState } from "react";
import { Plus, Trash2, PauseCircle, PlaneTakeoff } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";

const initialHours = [
  { day: "Monday", enabled: true, start: "06:00", end: "20:00" },
  { day: "Tuesday", enabled: true, start: "06:00", end: "20:00" },
  { day: "Wednesday", enabled: true, start: "06:00", end: "20:00" },
  { day: "Thursday", enabled: true, start: "06:00", end: "20:00" },
  { day: "Friday", enabled: true, start: "06:00", end: "20:00" },
  { day: "Saturday", enabled: true, start: "07:00", end: "14:00" },
  { day: "Sunday", enabled: false, start: "—", end: "—" },
];

export default function AvailabilityPage() {
  const [hours, setHours] = useState(initialHours);
  const [pauseBookings, setPauseBookings] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [blocks, setBlocks] = useState([{ id: 1, label: "Diwali Break", range: "Oct 20 – Oct 22, 2026" }]);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Availability" description="Set your working hours and manage time off." />

      <Card className="p-6">
        <p className="mb-4 text-sm font-bold">Weekly Working Hours</p>
        <div className="space-y-2">
          {hours.map((h, i) => (
            <div key={h.day} className="flex items-center gap-4 rounded-xl border border-black/[0.06] px-4 py-3">
              <label className="flex w-32 items-center gap-2.5">
                <input
                  type="checkbox"
                  checked={h.enabled}
                  onChange={() =>
                    setHours((prev) => prev.map((p, idx) => (idx === i ? { ...p, enabled: !p.enabled } : p)))
                  }
                  className="h-4 w-4 accent-brand-yellow"
                />
                <span className="text-sm font-semibold">{h.day}</span>
              </label>
              {h.enabled ? (
                <span className="text-sm text-black/50">{h.start} – {h.end}</span>
              ) : (
                <span className="text-sm text-black/30">Unavailable</span>
              )}
            </div>
          ))}
        </div>
      </Card>

      <Card className="mt-6 p-6">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm font-bold">Blocked Time Off</p>
          <Button variant="outline" size="sm" onClick={() => setLeaveOpen(true)}>
            <Plus className="h-3.5 w-3.5" /> Request Leave
          </Button>
        </div>
        <div className="space-y-2">
          {blocks.map((b) => (
            <div key={b.id} className="flex items-center justify-between rounded-xl bg-black/[0.03] px-4 py-3">
              <div className="flex items-center gap-2.5">
                <PlaneTakeoff className="h-4 w-4 text-black/40" />
                <div>
                  <p className="text-sm font-semibold">{b.label}</p>
                  <p className="text-xs text-black/40">{b.range}</p>
                </div>
              </div>
              <button onClick={() => setBlocks((prev) => prev.filter((x) => x.id !== b.id))}>
                <Trash2 className="h-4 w-4 text-black/30 hover:text-red-500" />
              </button>
            </div>
          ))}
          {blocks.length === 0 && <p className="text-xs text-black/40">No time off scheduled.</p>}
        </div>
      </Card>

      <Card className="mt-6 flex items-center justify-between p-6">
        <div className="flex items-center gap-3">
          <PauseCircle className="h-5 w-5 text-black/50" />
          <div>
            <p className="text-sm font-bold">Pause New Bookings</p>
            <p className="text-xs text-black/45">Existing sessions stay on your calendar; new bookings are paused.</p>
          </div>
        </div>
        <button
          onClick={() => setPauseBookings((p) => !p)}
          className={`relative h-7 w-12 rounded-full transition-colors ${pauseBookings ? "bg-black" : "bg-black/15"}`}
        >
          <span
            className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-transform ${pauseBookings ? "translate-x-6" : "translate-x-1"}`}
          />
        </button>
      </Card>

      <Modal open={leaveOpen} onClose={() => setLeaveOpen(false)} title="Request Leave">
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase text-black/40">Reason</label>
            <input className="w-full rounded-xl border border-black/15 p-3 text-sm focus:border-brand-yellow focus:outline-none focus:ring-1 focus:ring-brand-yellow" placeholder="e.g. Personal travel" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase text-black/40">From</label>
              <input type="date" className="w-full rounded-xl border border-black/15 p-3 text-sm focus:border-brand-yellow focus:outline-none focus:ring-1 focus:ring-brand-yellow" />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase text-black/40">To</label>
              <input type="date" className="w-full rounded-xl border border-black/15 p-3 text-sm focus:border-brand-yellow focus:outline-none focus:ring-1 focus:ring-brand-yellow" />
            </div>
          </div>
          <Button className="w-full" onClick={() => setLeaveOpen(false)}>
            Submit Request
          </Button>
        </div>
      </Modal>
    </div>
  );
}

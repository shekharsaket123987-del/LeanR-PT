"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Star, Ban, Trash2, RefreshCcw, Users2, CalendarClock } from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { AdminCoachDetailView, reassignCoachClientsAction, disableCoachAction, blockCoachSlotAction } from "@/lib/actions/admin-coach.actions";
import { AdminCoachOption } from "@/lib/actions/admin-coach-change.actions";
import CoachPerformancePanel from "@/components/admin/CoachPerformancePanel";
import { CoachPerformance } from "@/lib/services/coachPerformance.service";
import { isFailure } from "@/lib/actions/action-result";
import { formatDate, formatTime } from "@/lib/utils";

export default function AdminCoachDetailClient({
  coach,
  coaches,
  performance,
}: {
  coach: AdminCoachDetailView;
  coaches: AdminCoachOption[];
  performance: CoachPerformance | null;
}) {
  const router = useRouter();
  const [disableOpen, setDisableOpen] = useState(false);
  const [reassignOpen, setReassignOpen] = useState(false);
  const [blockOpen, setBlockOpen] = useState(false);
  const [reassignTo, setReassignTo] = useState("");
  const [blockDate, setBlockDate] = useState("");
  const [blockReason, setBlockReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function confirmDisable() {
    setBusy(true);
    const result = await disableCoachAction(coach.id);
    setBusy(false);
    setDisableOpen(false);
    if (!isFailure(result)) router.refresh();
  }

  async function confirmReassign() {
    if (!reassignTo) return;
    setBusy(true);
    setError("");
    const result = await reassignCoachClientsAction(coach.id, reassignTo);
    setBusy(false);
    if (isFailure(result)) return setError(result.error.message);
    setReassignOpen(false);
    setReassignTo("");
    router.refresh();
  }

  async function confirmBlock() {
    if (!blockDate) return;
    setBusy(true);
    setError("");
    const result = await blockCoachSlotAction(coach.id, blockDate, blockReason || undefined);
    setBusy(false);
    if (isFailure(result)) return setError(result.error.message);
    setBlockOpen(false);
    setBlockDate("");
    setBlockReason("");
    router.refresh();
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-1">
        <Card className="p-5">
          <div className="flex items-center gap-3">
            <div className="relative h-14 w-14 overflow-hidden rounded-xl">
              <Image src={coach.photo} alt={coach.name} fill className="object-cover" />
            </div>
            <div>
              <p className="text-sm font-bold">{coach.name}</p>
              <p className="flex items-center gap-1 text-xs text-black/45">
                <Star className="h-3 w-3 fill-brand-yellow text-brand-yellow" /> {coach.rating} ({coach.reviewCount})
              </p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 border-t border-black/[0.06] pt-4 text-center">
            <div>
              <p className="text-display text-2xl font-bold italic">{coach.activeClients}</p>
              <p className="text-[11px] text-black/40">Active Clients</p>
            </div>
            <div>
              <p className="text-display text-2xl font-bold italic">{coach.utilizationPct}%</p>
              <p className="text-[11px] text-black/40">Utilization</p>
            </div>
          </div>
        </Card>

        {performance && <CoachPerformancePanel performance={performance} />}

        <Card className="space-y-2 p-5">
          <p className="mb-1 text-xs font-bold uppercase text-black/40">Admin Controls</p>
          <Button variant="outline" size="sm" className="w-full justify-start" onClick={() => setBlockOpen(true)}>
            <CalendarClock className="h-3.5 w-3.5" /> Override / Block Slots
          </Button>
          <Button variant="outline" size="sm" className="w-full justify-start" onClick={() => setReassignOpen(true)}>
            <Users2 className="h-3.5 w-3.5" /> Reassign Clients
          </Button>
          <Button variant="destructive-outline" size="sm" className="w-full justify-start" disabled={coach.status === "inactive"} onClick={() => setDisableOpen(true)}>
            <Ban className="h-3.5 w-3.5" /> Disable Coach
          </Button>
          <Button variant="destructive-outline" size="sm" className="w-full justify-start" disabled={coach.status === "inactive"} onClick={() => setDisableOpen(true)}>
            <Trash2 className="h-3.5 w-3.5" /> Delete Coach
          </Button>
        </Card>
      </div>

      <div className="space-y-6 lg:col-span-2">
        <div>
          <h2 className="text-display mb-4 text-lg font-bold italic">Assigned Clients ({coach.clients.length})</h2>
          <Card className="divide-y divide-black/[0.05]">
            {coach.clients.map((c) => (
              <div key={c.id} className="flex items-center gap-3 p-4">
                <div className="relative h-9 w-9 overflow-hidden rounded-full">
                  <Image src={c.photo} alt={c.name} fill className="object-cover" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">{c.name}</p>
                  <p className="truncate text-xs text-black/40">{c.packageName ?? "No active package"}</p>
                </div>
                {c.sessionsRemaining != null && <Badge variant="gray">{c.sessionsRemaining} left</Badge>}
              </div>
            ))}
            {coach.clients.length === 0 && <p className="p-4 text-sm text-black/40">No clients assigned.</p>}
          </Card>
        </div>

        <div>
          <h2 className="text-display mb-4 text-lg font-bold italic">Upcoming Schedule</h2>
          <Card className="divide-y divide-black/[0.05]">
            {coach.upcomingSessions.map((s) => (
              <div key={s.id} className="flex items-center justify-between p-4 text-sm">
                <span className="font-semibold">
                  {formatDate(s.date)} · {formatTime(s.date)}
                </span>
                <Badge variant="black">Booked</Badge>
              </div>
            ))}
            {coach.upcomingSessions.length === 0 && <p className="p-4 text-sm text-black/40">No upcoming sessions.</p>}
          </Card>
        </div>
      </div>

      <Modal open={blockOpen} onClose={() => setBlockOpen(false)} title="Override / Block Slot">
        <div className="space-y-4">
          <p className="text-xs text-black/45">Marks {coach.name} fully unavailable for the selected date.</p>
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase text-black/40">Date</label>
            <input type="date" value={blockDate} onChange={(e) => setBlockDate(e.target.value)} className="w-full rounded-xl border border-black/15 p-3 text-sm" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase text-black/40">Reason (optional)</label>
            <input value={blockReason} onChange={(e) => setBlockReason(e.target.value)} className="w-full rounded-xl border border-black/15 p-3 text-sm" />
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <Button className="w-full" disabled={!blockDate} loading={busy} onClick={confirmBlock}>
            Block Slot
          </Button>
        </div>
      </Modal>

      <Modal open={reassignOpen} onClose={() => setReassignOpen(false)} title="Reassign Clients">
        <p className="mb-4 text-sm text-black/50">
          Select a new coach for all of {coach.name}&apos;s active clients. Their recurring slots and upcoming bookings move to
          the new coach.
        </p>
        <select value={reassignTo} onChange={(e) => setReassignTo(e.target.value)} className="w-full rounded-xl border border-black/15 p-3 text-sm">
          <option value="">Select a coach...</option>
          {coaches
            .filter((c) => c.id !== coach.id)
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.specialization ? ` — ${c.specialization}` : ""}
              </option>
            ))}
        </select>
        {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
        <Button className="mt-4 w-full" disabled={!reassignTo} loading={busy} onClick={confirmReassign}>
          <RefreshCcw className="h-4 w-4" /> Reassign All Clients
        </Button>
      </Modal>

      <ConfirmDialog
        open={disableOpen}
        onClose={() => setDisableOpen(false)}
        onConfirm={confirmDisable}
        title="Disable this coach?"
        description={`${coach.name} will no longer receive new bookings. Their ${coach.clients.length} assigned clients will need to be reassigned separately.`}
        confirmLabel="Disable Coach"
        loading={busy}
      />
    </div>
  );
}

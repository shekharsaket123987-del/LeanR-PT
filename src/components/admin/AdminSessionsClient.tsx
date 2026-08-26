"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { RotateCcw, XCircle, RefreshCcw } from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge, { SessionStatusBadge, AssessmentBadge } from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";
import { AdminSessionView, rescheduleSessionAction, cancelSessionAction } from "@/lib/actions/admin-sessions.actions";
import { AdminCoachOption } from "@/lib/actions/admin-clients.actions";
import { isFailure } from "@/lib/actions/action-result";
import { formatDate, formatTime } from "@/lib/utils";

export default function AdminSessionsClient({ sessions, coaches }: { sessions: AdminSessionView[]; coaches: AdminCoachOption[] }) {
  const router = useRouter();
  const [coachFilter, setCoachFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [actionSession, setActionSession] = useState<string | null>(null);
  const [newDate, setNewDate] = useState("");
  const [newTime, setNewTime] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const filtered = sessions
    .filter((s) => coachFilter === "all" || s.coachId === coachFilter)
    .filter((s) => statusFilter === "all" || s.status === statusFilter)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const activeSession = sessions.find((s) => s.id === actionSession);

  function closeModal() {
    setActionSession(null);
    setNewDate("");
    setNewTime("");
    setError("");
  }

  async function saveReschedule() {
    if (!activeSession || !newDate || !newTime) return;
    setBusyId(activeSession.id);
    setError("");
    const newStart = new Date(`${newDate}T${newTime}:00`).toISOString();
    const result = await rescheduleSessionAction(activeSession.id, newStart);
    setBusyId(null);
    if (isFailure(result)) return setError(result.error.message);
    closeModal();
    router.refresh();
  }

  async function cancel(sessionId: string) {
    setBusyId(sessionId);
    const result = await cancelSessionAction(sessionId);
    setBusyId(null);
    if (!isFailure(result)) router.refresh();
  }

  return (
    <>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row">
        <select
          value={coachFilter}
          onChange={(e) => setCoachFilter(e.target.value)}
          className="rounded-xl border border-white/10 bg-bg-elevated px-4 py-2.5 text-sm focus:border-brand-yellow focus:outline-none"
        >
          <option value="all">All Coaches</option>
          {coaches.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-xl border border-white/10 bg-bg-elevated px-4 py-2.5 text-sm focus:border-brand-yellow focus:outline-none"
        >
          <option value="all">All Statuses</option>
          <option value="upcoming">Upcoming</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
          <option value="missed">Missed</option>
        </select>
      </div>

      <Card className="overflow-hidden">
        <div className="hidden grid-cols-12 gap-4 border-b border-white/[0.06] px-5 py-3 text-xs font-bold uppercase text-white/40 sm:grid">
          <div className="col-span-3">Client</div>
          <div className="col-span-3">Coach</div>
          <div className="col-span-2">Date &amp; Time</div>
          <div className="col-span-1">Type</div>
          <div className="col-span-1">Status</div>
          <div className="col-span-2 text-right">Actions</div>
        </div>
        <div className="divide-y divide-white/[0.05]">
          {filtered.map((s) => (
            <div key={s.id} className="grid grid-cols-2 items-center gap-3 px-5 py-4 sm:grid-cols-12">
              <Link href={`/admin/sessions/${s.id}`} className="col-span-1 truncate text-sm font-semibold hover:underline sm:col-span-3">
                {s.clientName}
              </Link>
              <Link href={`/admin/sessions/${s.id}`} className="col-span-1 truncate text-sm text-white/60 hover:underline sm:col-span-3">
                {s.coachName}
              </Link>
              <Link href={`/admin/sessions/${s.id}`} className="col-span-1 text-sm text-white/60 sm:col-span-2">
                {formatDate(s.date)} · {formatTime(s.date)}
              </Link>
              <div className="col-span-1">{s.type === "assessment" ? <AssessmentBadge amountPaid={s.amountPaid} /> : <Badge variant="gray">Regular</Badge>}</div>
              <div className="col-span-1">
                <SessionStatusBadge status={s.status} />
              </div>
              <div className="col-span-2 flex justify-end gap-2">
                {s.status === "upcoming" && (
                  <>
                    <Button variant="outline" size="sm" onClick={() => setActionSession(s.id)}>
                      <RotateCcw className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="destructive-outline" size="sm" loading={busyId === s.id} onClick={() => cancel(s.id)}>
                      <XCircle className="h-3.5 w-3.5" />
                    </Button>
                  </>
                )}
              </div>
            </div>
          ))}
          {filtered.length === 0 && <p className="p-6 text-center text-sm text-white/40">No sessions match these filters.</p>}
        </div>
      </Card>

      <Modal open={!!activeSession} onClose={closeModal} title="Reschedule Session">
        {activeSession && (
          <div className="space-y-4">
            <p className="text-sm text-white/50">
              Reschedule {activeSession.clientName}&apos;s session with {activeSession.coachName}.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase text-white/40">New Date</label>
                <input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} className="w-full rounded-xl border border-white/15 p-3 text-sm" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase text-white/40">New Time</label>
                <input type="time" value={newTime} onChange={(e) => setNewTime(e.target.value)} className="w-full rounded-xl border border-white/15 p-3 text-sm" />
              </div>
            </div>
            {error && <p className="text-xs text-red-400">{error}</p>}
            <Button className="w-full" disabled={!newDate || !newTime} loading={busyId === activeSession.id} onClick={saveReschedule}>
              <RefreshCcw className="h-4 w-4" /> Save Changes
            </Button>
          </div>
        )}
      </Modal>
    </>
  );
}

"use client";

import { useState } from "react";
import { RotateCcw, XCircle, RefreshCcw } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { SessionStatusBadge, AssessmentBadge } from "@/components/ui/Badge";
import Badge from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";
import { sessions, coaches, getClient, getCoach } from "@/lib/mock-data";
import { formatDate, formatTime } from "@/lib/utils";
import { SessionStatus } from "@/lib/types";

export default function AdminSessionsPage() {
  const [coachFilter, setCoachFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<SessionStatus | "all">("all");
  const [actionSession, setActionSession] = useState<string | null>(null);

  const filtered = sessions
    .filter((s) => coachFilter === "all" || s.coachId === coachFilter)
    .filter((s) => statusFilter === "all" || s.status === statusFilter)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const activeSession = sessions.find((s) => s.id === actionSession);

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader title="Sessions" description="Master list of every session across the platform." />

      <div className="mb-5 flex flex-col gap-3 sm:flex-row">
        <select
          value={coachFilter}
          onChange={(e) => setCoachFilter(e.target.value)}
          className="rounded-xl border border-black/10 bg-white px-4 py-2.5 text-sm focus:border-brand-yellow focus:outline-none"
        >
          <option value="all">All Coaches</option>
          {coaches.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as SessionStatus | "all")}
          className="rounded-xl border border-black/10 bg-white px-4 py-2.5 text-sm focus:border-brand-yellow focus:outline-none"
        >
          <option value="all">All Statuses</option>
          <option value="upcoming">Upcoming</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
          <option value="missed">Missed</option>
        </select>
      </div>

      <Card className="overflow-hidden">
        <div className="hidden grid-cols-12 gap-4 border-b border-black/[0.06] px-5 py-3 text-xs font-bold uppercase text-black/40 sm:grid">
          <div className="col-span-3">Client</div>
          <div className="col-span-3">Coach</div>
          <div className="col-span-2">Date &amp; Time</div>
          <div className="col-span-1">Type</div>
          <div className="col-span-1">Status</div>
          <div className="col-span-2 text-right">Actions</div>
        </div>
        <div className="divide-y divide-black/[0.05]">
          {filtered.map((s) => {
            const client = getClient(s.clientId);
            const coach = getCoach(s.coachId);
            return (
              <div key={s.id} className="grid grid-cols-2 items-center gap-3 px-5 py-4 sm:grid-cols-12">
                <div className="col-span-1 truncate text-sm font-semibold sm:col-span-3">{client?.name}</div>
                <div className="col-span-1 truncate text-sm text-black/60 sm:col-span-3">{coach?.name}</div>
                <div className="col-span-1 text-sm text-black/60 sm:col-span-2">{formatDate(s.date)} · {formatTime(s.date)}</div>
                <div className="col-span-1">{s.type === "assessment" ? <AssessmentBadge /> : <Badge variant="gray">Regular</Badge>}</div>
                <div className="col-span-1"><SessionStatusBadge status={s.status} /></div>
                <div className="col-span-2 flex justify-end gap-2">
                  {s.status === "upcoming" && (
                    <>
                      <Button variant="outline" size="sm" onClick={() => setActionSession(s.id)}>
                        <RotateCcw className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="destructive-outline" size="sm">
                        <XCircle className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && <p className="p-6 text-center text-sm text-black/40">No sessions match these filters.</p>}
        </div>
      </Card>

      <Modal open={!!activeSession} onClose={() => setActionSession(null)} title="Manually Reschedule Session">
        {activeSession && (
          <div className="space-y-4">
            <p className="text-sm text-black/50">
              Reschedule {getClient(activeSession.clientId)?.name}'s session with {getCoach(activeSession.coachId)?.name}.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase text-black/40">New Date</label>
                <input type="date" className="w-full rounded-xl border border-black/15 p-3 text-sm" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase text-black/40">New Time</label>
                <input type="time" className="w-full rounded-xl border border-black/15 p-3 text-sm" />
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase text-black/40">Or Reassign to Coach</label>
              <select className="w-full rounded-xl border border-black/15 p-3 text-sm">
                {coaches.map((c) => (
                  <option key={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <Button className="w-full" onClick={() => setActionSession(null)}>
              <RefreshCcw className="h-4 w-4" /> Save Changes
            </Button>
          </div>
        )}
      </Modal>
    </div>
  );
}

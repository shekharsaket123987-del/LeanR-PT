"use client";

import { useState } from "react";
import Image from "next/image";
import { Star, Ban, Trash2, RefreshCcw, Users2, CalendarClock } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { coaches, clients, sessionsForCoach } from "@/lib/mock-data";
import { formatDate, formatTime } from "@/lib/utils";

export default function AdminCoachDetailPage({ params }: { params: { id: string } }) {
  const coach = coaches.find((c) => c.id === params.id);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [reassignOpen, setReassignOpen] = useState(false);
  const [blockOpen, setBlockOpen] = useState(false);
  const [disableConfirm, setDisableConfirm] = useState(false);

  if (!coach) return <p className="text-sm text-black/50">Coach not found.</p>;

  const myClients = clients.filter((c) => c.coachId === coach.id);
  const upcoming = sessionsForCoach(coach.id).filter((s) => s.status === "upcoming");

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title={coach.name}
        description={coach.specialization}
        action={<Badge variant={coach.status === "active" ? "green" : coach.status === "on-leave" ? "outline-yellow" : "gray"}>{coach.status}</Badge>}
      />

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
                <p className="text-display text-2xl font-bold italic">{coach.utilization}%</p>
                <p className="text-[11px] text-black/40">Utilization</p>
              </div>
            </div>
          </Card>

          <Card className="space-y-2 p-5">
            <p className="mb-1 text-xs font-bold uppercase text-black/40">Admin Controls</p>
            <Button variant="outline" size="sm" className="w-full justify-start" onClick={() => setBlockOpen(true)}>
              <CalendarClock className="h-3.5 w-3.5" /> Override / Block Slots
            </Button>
            <Button variant="outline" size="sm" className="w-full justify-start" onClick={() => setReassignOpen(true)}>
              <Users2 className="h-3.5 w-3.5" /> Reassign Clients
            </Button>
            <Button variant="destructive-outline" size="sm" className="w-full justify-start" onClick={() => setDisableConfirm(true)}>
              <Ban className="h-3.5 w-3.5" /> Disable Coach
            </Button>
            <Button variant="destructive-outline" size="sm" className="w-full justify-start" onClick={() => setDeleteOpen(true)}>
              <Trash2 className="h-3.5 w-3.5" /> Delete Coach
            </Button>
          </Card>
        </div>

        <div className="space-y-6 lg:col-span-2">
          <div>
            <h2 className="text-display mb-4 text-lg font-bold italic">Assigned Clients ({myClients.length})</h2>
            <Card className="divide-y divide-black/[0.05]">
              {myClients.map((c) => (
                <div key={c.id} className="flex items-center gap-3 p-4">
                  <div className="relative h-9 w-9 overflow-hidden rounded-full">
                    <Image src={c.photo} alt={c.name} fill className="object-cover" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold">{c.name}</p>
                    <p className="truncate text-xs text-black/40">{c.packageName}</p>
                  </div>
                  <Badge variant="gray">{c.sessionsRemaining} left</Badge>
                </div>
              ))}
              {myClients.length === 0 && <p className="p-4 text-sm text-black/40">No clients assigned.</p>}
            </Card>
          </div>

          <div>
            <h2 className="text-display mb-4 text-lg font-bold italic">Upcoming Schedule</h2>
            <Card className="divide-y divide-black/[0.05]">
              {upcoming.map((s) => (
                <div key={s.id} className="flex items-center justify-between p-4 text-sm">
                  <span className="font-semibold">{formatDate(s.date)} · {formatTime(s.date)}</span>
                  <Badge variant="black">Booked</Badge>
                </div>
              ))}
              {upcoming.length === 0 && <p className="p-4 text-sm text-black/40">No upcoming sessions.</p>}
            </Card>
          </div>
        </div>
      </div>

      <Modal open={blockOpen} onClose={() => setBlockOpen(false)} title="Override / Block Slot">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase text-black/40">Date</label>
              <input type="date" className="w-full rounded-xl border border-black/15 p-3 text-sm" />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase text-black/40">Time</label>
              <input type="time" className="w-full rounded-xl border border-black/15 p-3 text-sm" />
            </div>
          </div>
          <Button className="w-full" onClick={() => setBlockOpen(false)}>Block Slot</Button>
        </div>
      </Modal>

      <Modal open={reassignOpen} onClose={() => setReassignOpen(false)} title="Reassign Clients">
        <p className="mb-4 text-sm text-black/50">
          Select a new coach for all of {coach.name}'s clients. Each client will begin a fresh onboarding booking flow.
        </p>
        <select className="w-full rounded-xl border border-black/15 p-3 text-sm">
          {coaches.filter((c) => c.id !== coach.id).map((c) => (
            <option key={c.id}>{c.name} — {c.specialization}</option>
          ))}
        </select>
        <Button className="mt-4 w-full" onClick={() => setReassignOpen(false)}>
          <RefreshCcw className="h-4 w-4" /> Reassign All Clients
        </Button>
      </Modal>

      <ConfirmDialog
        open={disableConfirm}
        onClose={() => setDisableConfirm(false)}
        onConfirm={() => {}}
        title="Disable this coach?"
        description={`${coach.name} will no longer receive new bookings. Their ${myClients.length} assigned clients will need to be reassigned.`}
        confirmLabel="Disable Coach"
      />

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={() => {}}
        title="Delete this coach permanently?"
        description={`This cannot be undone. ${coach.name}'s ${myClients.length} assigned clients need to be reassigned before deletion.`}
        confirmLabel="Delete Coach"
      />
    </div>
  );
}

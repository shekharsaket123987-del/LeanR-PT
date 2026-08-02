"use client";

import { useState } from "react";
import Image from "next/image";
import {
  PlusCircle,
  MinusCircle,
  RefreshCcw,
  PauseCircle,
  Banknote,
  Target,
  HeartPulse,
} from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge, { AssessmentBadge, SessionStatusBadge } from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { getClient, sessionsForClient, coaches, getCoach } from "@/lib/mock-data";
import { formatDate } from "@/lib/utils";

export default function AdminClientDetailPage({ params }: { params: { id: string } }) {
  const client = getClient(params.id);
  const [modal, setModal] = useState<null | "adjust" | "transfer" | "refund">(null);
  const [pauseConfirm, setPauseConfirm] = useState(false);

  if (!client) return <p className="text-sm text-black/50">Client not found.</p>;

  const coach = getCoach(client.coachId);
  const history = sessionsForClient(client.id);

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title={client.name}
        description={`${client.packageName} · Client since ${formatDate(client.joinedDate)}`}
        action={<Badge variant={client.status === "active" ? "green" : client.status === "paused" ? "red" : "gray"}>{client.status}</Badge>}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-1">
          <Card className="p-5">
            <div className="flex items-center gap-3">
              <div className="relative h-14 w-14 overflow-hidden rounded-xl">
                <Image src={client.photo} alt={client.name} fill className="object-cover" />
              </div>
              <div>
                <p className="text-sm font-bold">{client.name}</p>
                <p className="text-xs text-black/45">{client.email}</p>
                <p className="text-xs text-black/45">{client.phone}</p>
              </div>
            </div>
            <div className="mt-4 space-y-3 border-t border-black/[0.06] pt-4">
              <div>
                <p className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase text-black/40">
                  <Target className="h-3.5 w-3.5" /> Goals
                </p>
                <p className="text-xs text-black/60">{client.goals.join(", ")}</p>
              </div>
              <div>
                <p className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase text-black/40">
                  <HeartPulse className="h-3.5 w-3.5" /> Medical Notes
                </p>
                <p className="text-xs text-black/60">{client.medicalNotes}</p>
              </div>
            </div>
          </Card>

          <Card className="p-5">
            <p className="mb-3 text-xs font-bold uppercase text-black/40">Assigned Coach</p>
            {coach && (
              <div className="flex items-center gap-3">
                <div className="relative h-11 w-11 overflow-hidden rounded-full">
                  <Image src={coach.photo} alt={coach.name} fill className="object-cover" />
                </div>
                <div>
                  <p className="text-sm font-bold">{coach.name}</p>
                  <p className="text-xs text-black/45">{coach.specialization}</p>
                </div>
              </div>
            )}
          </Card>

          <Card className="p-5">
            <p className="mb-3 text-xs font-bold uppercase text-black/40">Package</p>
            <p className="text-sm font-bold">{client.packageName}</p>
            <p className="mt-1 text-xs text-black/45">{client.sessionsUsed} used · {client.sessionsRemaining} remaining of {client.sessionsTotal}</p>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-black/5">
              <div className="h-full rounded-full bg-brand-yellow" style={{ width: `${(client.sessionsUsed / client.sessionsTotal) * 100}%` }} />
            </div>
          </Card>

          <Card className="space-y-2 p-5">
            <p className="mb-1 text-xs font-bold uppercase text-black/40">Manual Controls</p>
            <Button variant="outline" size="sm" className="w-full justify-start" onClick={() => setModal("adjust")}>
              <PlusCircle className="h-3.5 w-3.5" /> Adjust Package / Sessions
            </Button>
            <Button variant="outline" size="sm" className="w-full justify-start" onClick={() => setModal("transfer")}>
              <RefreshCcw className="h-3.5 w-3.5" /> Transfer to Another Coach
            </Button>
            <Button variant="outline" size="sm" className="w-full justify-start" onClick={() => setPauseConfirm(true)}>
              <PauseCircle className="h-3.5 w-3.5" /> Pause Subscription
            </Button>
            <Button variant="destructive-outline" size="sm" className="w-full justify-start" onClick={() => setModal("refund")}>
              <Banknote className="h-3.5 w-3.5" /> Issue Refund
            </Button>
          </Card>
        </div>

        <div className="lg:col-span-2">
          <h2 className="text-display mb-4 text-lg font-bold italic">Session History</h2>
          <div className="space-y-3">
            {history.map((s) => (
              <Card key={s.id} className="p-4">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  {s.type === "assessment" ? <AssessmentBadge /> : <Badge variant="gray">Regular</Badge>}
                  <SessionStatusBadge status={s.status} />
                  <span className="text-xs text-black/40">{formatDate(s.date)}</span>
                </div>
                {s.remarks && <p className="text-sm text-black/60">{s.remarks}</p>}
              </Card>
            ))}
          </div>
        </div>
      </div>

      <Modal open={modal === "adjust"} onClose={() => setModal(null)} title="Adjust Package / Sessions">
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase text-black/40">Sessions to Add / Remove</label>
            <div className="flex items-center gap-3">
              <button className="rounded-lg border border-black/15 p-2"><MinusCircle className="h-4 w-4" /></button>
              <input defaultValue={0} className="w-20 rounded-xl border border-black/15 p-2 text-center text-sm" />
              <button className="rounded-lg border border-black/15 p-2"><PlusCircle className="h-4 w-4" /></button>
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase text-black/40">Package Tier</label>
            <select className="w-full rounded-xl border border-black/15 p-3 text-sm focus:border-brand-yellow focus:outline-none focus:ring-1 focus:ring-brand-yellow">
              <option>LeanR Advance</option>
              <option>PT Add-on 12</option>
              <option>PT Add-on 24</option>
              <option>PT Add-on 48</option>
            </select>
          </div>
          <Button className="w-full" onClick={() => setModal(null)}>Save Changes</Button>
        </div>
      </Modal>

      <Modal open={modal === "transfer"} onClose={() => setModal(null)} title="Transfer to Another Coach">
        <div className="space-y-4">
          <p className="text-sm text-black/50">
            {client.name}'s upcoming sessions will be released and a new booking flow with the new coach will begin.
          </p>
          <select className="w-full rounded-xl border border-black/15 p-3 text-sm focus:border-brand-yellow focus:outline-none focus:ring-1 focus:ring-brand-yellow">
            {coaches.filter((c) => c.id !== client.coachId).map((c) => (
              <option key={c.id}>{c.name} — {c.specialization}</option>
            ))}
          </select>
          <Button className="w-full" onClick={() => setModal(null)}>Confirm Transfer</Button>
        </div>
      </Modal>

      <Modal open={modal === "refund"} onClose={() => setModal(null)} title="Issue Refund">
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase text-black/40">Refund Amount (₹)</label>
            <input type="number" placeholder="0" className="w-full rounded-xl border border-black/15 p-3 text-sm focus:border-brand-yellow focus:outline-none focus:ring-1 focus:ring-brand-yellow" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase text-black/40">Reason</label>
            <textarea rows={3} className="w-full rounded-xl border border-black/15 p-3 text-sm focus:border-brand-yellow focus:outline-none focus:ring-1 focus:ring-brand-yellow" />
          </div>
          <Button variant="destructive" className="w-full" onClick={() => setModal(null)}>Issue Refund</Button>
        </div>
      </Modal>

      <ConfirmDialog
        open={pauseConfirm}
        onClose={() => setPauseConfirm(false)}
        onConfirm={() => setPauseConfirm(false)}
        title="Pause this subscription?"
        description={`${client.name}'s package will be paused. They won't be able to book new sessions until reactivated.`}
        confirmLabel="Pause Subscription"
        destructive={false}
      />
    </div>
  );
}

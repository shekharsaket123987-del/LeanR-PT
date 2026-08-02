"use client";

import { useState } from "react";
import Image from "next/image";
import { CheckCircle2, XCircle, ArrowRight, Check } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge, { SessionStatusBadge } from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";
import EmptyState from "@/components/ui/EmptyState";
import { coachChangeRequests, getClient, getCoach, coaches } from "@/lib/mock-data";
import { formatDate } from "@/lib/utils";

export default function CoachChangeRequestsPage() {
  const [requests, setRequests] = useState(coachChangeRequests);
  const [approveId, setApproveId] = useState<string | null>(null);
  const [step, setStep] = useState<"pick" | "done">("pick");
  const [newCoach, setNewCoach] = useState<string>("");

  const pending = requests.filter((r) => r.status === "pending");
  const resolved = requests.filter((r) => r.status !== "pending");
  const activeRequest = requests.find((r) => r.id === approveId);

  function closeModal() {
    setApproveId(null);
    setStep("pick");
    setNewCoach("");
  }

  function finalizeApprove() {
    setRequests((prev) => prev.map((r) => (r.id === approveId ? { ...r, status: "approved" } : r)));
    setStep("done");
  }

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Coach Change Requests" description="Review and resolve client requests to switch coaches." />

      <h2 className="text-display mb-4 text-lg font-bold italic">Pending ({pending.length})</h2>
      {pending.length === 0 && (
        <EmptyState icon={CheckCircle2} title="All caught up" description="No pending coach change requests right now." />
      )}
      <div className="space-y-3">
        {pending.map((r) => {
          const client = getClient(r.clientId);
          const coach = getCoach(r.currentCoachId);
          if (!client || !coach) return null;
          return (
            <Card key={r.id} className="p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <div className="flex items-center gap-3">
                  <div className="relative h-11 w-11 overflow-hidden rounded-full">
                    <Image src={client.photo} alt={client.name} fill className="object-cover" />
                  </div>
                  <div>
                    <p className="text-sm font-bold">{client.name}</p>
                    <p className="text-xs text-black/45">Currently with {coach.name}</p>
                  </div>
                </div>
                <p className="flex-1 rounded-lg bg-black/[0.03] p-3 text-xs text-black/60">&ldquo;{r.reason}&rdquo;</p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm">
                    <XCircle className="h-3.5 w-3.5" /> Reject
                  </Button>
                  <Button size="sm" onClick={() => setApproveId(r.id)}>
                    <CheckCircle2 className="h-3.5 w-3.5" /> Approve
                  </Button>
                </div>
              </div>
              <p className="mt-3 text-[11px] text-black/35">Submitted {formatDate(r.submittedDate)}</p>
            </Card>
          );
        })}
      </div>

      {resolved.length > 0 && (
        <>
          <h2 className="text-display mb-4 mt-8 text-lg font-bold italic">Resolved</h2>
          <div className="space-y-3">
            {resolved.map((r) => {
              const client = getClient(r.clientId);
              if (!client) return null;
              return (
                <Card key={r.id} className="flex items-center justify-between p-4">
                  <p className="text-sm font-semibold">{client.name}</p>
                  <SessionStatusBadge status={r.status} />
                </Card>
              );
            })}
          </div>
        </>
      )}

      <Modal open={!!approveId} onClose={closeModal} title="Approve Coach Change">
        {activeRequest && step === "pick" && (
          <div className="space-y-4">
            <p className="text-sm text-black/50">
              Choose a new coach for {getClient(activeRequest.clientId)?.name}. This will release their old recurring
              slots and start a fresh onboarding booking flow with the new coach.
            </p>
            <select
              value={newCoach}
              onChange={(e) => setNewCoach(e.target.value)}
              className="w-full rounded-xl border border-black/15 p-3 text-sm"
            >
              <option value="">Select a coach...</option>
              {coaches.filter((c) => c.id !== activeRequest.currentCoachId).map((c) => (
                <option key={c.id} value={c.id}>{c.name} — {c.specialization}</option>
              ))}
            </select>
            <Button className="w-full" disabled={!newCoach} onClick={finalizeApprove}>
              Confirm New Coach <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        )}
        {step === "done" && (
          <div className="py-6 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100">
              <Check className="h-7 w-7 text-emerald-600" />
            </div>
            <p className="text-display text-xl font-bold italic">Coach Reassigned</p>
            <p className="mt-1 text-sm text-black/50">
              Old recurring slots released. Client will be guided through a fresh onboarding booking with their new coach.
            </p>
            <Button className="mt-5" onClick={closeModal}>Done</Button>
          </div>
        )}
      </Modal>
    </div>
  );
}

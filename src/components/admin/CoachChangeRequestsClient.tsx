"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { CheckCircle2, XCircle, ArrowRight, Check } from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { SessionStatusBadge } from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";
import EmptyState from "@/components/ui/EmptyState";
import { AdminCoachChangeRequestsData, resolveCoachChangeRequestAction } from "@/lib/actions/admin-coach-change.actions";
import { isFailure } from "@/lib/actions/action-result";
import { formatDate } from "@/lib/utils";

export default function CoachChangeRequestsClient({ data }: { data: AdminCoachChangeRequestsData }) {
  const router = useRouter();
  const [requests, setRequests] = useState(data.requests);
  const [approveId, setApproveId] = useState<string | null>(null);
  const [step, setStep] = useState<"pick" | "done">("pick");
  const [newCoach, setNewCoach] = useState<string>("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const pending = requests.filter((r) => r.status === "pending");
  const resolved = requests.filter((r) => r.status !== "pending");
  const activeRequest = requests.find((r) => r.id === approveId);

  function closeModal() {
    setApproveId(null);
    setStep("pick");
    setNewCoach("");
  }

  async function reject(requestId: string) {
    setBusyId(requestId);
    setError("");
    const result = await resolveCoachChangeRequestAction(requestId, { approve: false });
    setBusyId(null);
    if (isFailure(result)) {
      setError(result.error.message);
      return;
    }
    setRequests((prev) => prev.map((r) => (r.id === requestId ? { ...r, status: "rejected" } : r)));
    router.refresh();
  }

  async function finalizeApprove() {
    if (!approveId) return;
    setBusyId(approveId);
    setError("");
    const result = await resolveCoachChangeRequestAction(approveId, { approve: true, newCoachId: newCoach || undefined });
    setBusyId(null);
    if (isFailure(result)) {
      setError(result.error.message);
      return;
    }
    setRequests((prev) => prev.map((r) => (r.id === approveId ? { ...r, status: "approved" } : r)));
    setStep("done");
    router.refresh();
  }

  return (
    <>
      <h2 className="text-display mb-4 text-lg font-bold italic">Pending ({pending.length})</h2>
      {pending.length === 0 && (
        <EmptyState icon={CheckCircle2} title="All caught up" description="No pending coach change requests right now." />
      )}
      <div className="space-y-3">
        {pending.map((r) => (
          <Card key={r.id} className="p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="flex items-center gap-3">
                <div className="relative h-11 w-11 overflow-hidden rounded-full">
                  <Image src={r.clientPhoto} alt={r.clientName} fill className="object-cover" />
                </div>
                <div>
                  <p className="text-sm font-bold">{r.clientName}</p>
                  <p className="text-xs text-black/45">Currently with {r.currentCoachName}</p>
                </div>
              </div>
              <p className="flex-1 rounded-lg bg-black/[0.03] p-3 text-xs text-black/60">&ldquo;{r.reason}&rdquo;</p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" loading={busyId === r.id} onClick={() => reject(r.id)}>
                  <XCircle className="h-3.5 w-3.5" /> Reject
                </Button>
                <Button size="sm" onClick={() => setApproveId(r.id)}>
                  <CheckCircle2 className="h-3.5 w-3.5" /> Approve
                </Button>
              </div>
            </div>
            <p className="mt-3 text-[11px] text-black/35">Submitted {formatDate(r.submittedDate)}</p>
          </Card>
        ))}
      </div>

      {resolved.length > 0 && (
        <>
          <h2 className="text-display mb-4 mt-8 text-lg font-bold italic">Resolved</h2>
          <div className="space-y-3">
            {resolved.map((r) => (
              <Card key={r.id} className="flex items-center justify-between p-4">
                <p className="text-sm font-semibold">{r.clientName}</p>
                <SessionStatusBadge status={r.status} />
              </Card>
            ))}
          </div>
        </>
      )}

      <Modal open={!!approveId} onClose={closeModal} title="Approve Coach Change">
        {activeRequest && step === "pick" && (
          <div className="space-y-4">
            <p className="text-sm text-black/50">
              Optionally pick a new coach directly for {activeRequest.clientName} now, or leave this blank to let the
              client pick their own day/time and available coach after approval.
            </p>
            <select
              value={newCoach}
              onChange={(e) => setNewCoach(e.target.value)}
              className="w-full rounded-xl border border-black/15 p-3 text-sm"
            >
              <option value="">Let client choose after approval</option>
              {data.coaches
                .filter((c) => c.id !== activeRequest.currentCoachId)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.specialization ? ` — ${c.specialization}` : ""}
                  </option>
                ))}
            </select>
            {error && <p className="text-xs text-red-600">{error}</p>}
            <Button className="w-full" loading={busyId === approveId} onClick={finalizeApprove}>
              {newCoach ? "Confirm New Coach" : "Approve Request"} <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        )}
        {step === "done" && (
          <div className="py-6 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100">
              <Check className="h-7 w-7 text-emerald-600" />
            </div>
            <p className="text-display text-xl font-bold italic">Request Approved</p>
            <p className="mt-1 text-sm text-black/50">
              {newCoach
                ? "Active recurring slots and upcoming bookings have been moved to the new coach."
                : "The client can now pick their preferred day/time and available coach from their portal."}
            </p>
            <Button className="mt-5" onClick={closeModal}>Done</Button>
          </div>
        )}
      </Modal>
    </>
  );
}

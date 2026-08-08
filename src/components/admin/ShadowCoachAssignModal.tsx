"use client";

import { useState } from "react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import { previewShadowAssignmentPlanAction, confirmShadowAssignmentPlanAction } from "@/lib/actions/admin-shadow-coach.actions";
import { isFailure } from "@/lib/actions/action-result";
import { ShadowAssignmentPlan } from "@/lib/services/scheduling.service";
import { formatDate } from "@/lib/utils";

interface Props {
  open: boolean;
  onClose: () => void;
  clientId: string;
  primaryCoachId: string;
  onAssigned: () => void;
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function ShadowCoachAssignModal({ open, onClose, clientId, primaryCoachId, onAssigned }: Props) {
  const [startsOn, setStartsOn] = useState(todayISO());
  const [endsOn, setEndsOn] = useState(todayISO());
  const [reason, setReason] = useState("");
  const [plan, setPlan] = useState<ShadowAssignmentPlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [error, setError] = useState("");

  function reset() {
    setPlan(null);
    setError("");
  }

  async function search() {
    if (endsOn < startsOn) {
      setError("End date must be on or after start date");
      return;
    }
    setLoading(true);
    setError("");
    setPlan(null);
    const result = await previewShadowAssignmentPlanAction(clientId, primaryCoachId, startsOn, endsOn);
    setLoading(false);
    if (isFailure(result)) {
      setError(result.error.message);
      return;
    }
    setPlan(result.data);
  }

  async function confirm() {
    if (!plan || plan.assignments.length === 0) return;
    setAssigning(true);
    setError("");
    const result = await confirmShadowAssignmentPlanAction({
      clientId,
      primaryCoachId,
      plan: plan.assignments,
      reason: reason || undefined,
    });
    setAssigning(false);
    if (isFailure(result)) {
      setError(result.error.message);
      return;
    }
    reset();
    onAssigned();
  }

  return (
    <Modal
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      title="Assign Shadow Coach"
    >
      <div className="space-y-4">
        <p className="text-sm text-black/50">
          Finds the best-matching free coach for each of this client&apos;s sessions in the range — different sessions can
          land on different coaches if that&apos;s what&apos;s actually available.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase text-black/40">From</label>
            <input
              type="date"
              value={startsOn}
              onChange={(e) => {
                setStartsOn(e.target.value);
                reset();
              }}
              className="w-full rounded-xl border border-black/15 p-2.5 text-sm"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase text-black/40">To</label>
            <input
              type="date"
              value={endsOn}
              onChange={(e) => {
                setEndsOn(e.target.value);
                reset();
              }}
              className="w-full rounded-xl border border-black/15 p-2.5 text-sm"
            />
          </div>
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-bold uppercase text-black/40">Reason (optional)</label>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Primary coach unavailable, no leave on file"
            className="w-full rounded-xl border border-black/15 p-2.5 text-sm"
          />
        </div>

        {error && <p className="text-xs text-red-600">{error}</p>}

        {plan === null ? (
          <Button className="w-full" loading={loading} onClick={search}>
            Find Coverage
          </Button>
        ) : (
          <div className="space-y-2">
            {plan.assignments.length === 0 && plan.uncoveredDates.length === 0 && (
              <p className="rounded-lg bg-black/[0.03] p-3 text-sm text-black/50">
                This client has no sessions with their current coach in that range.
              </p>
            )}
            {plan.assignments.map((a, i) => (
              <div key={i} className="rounded-xl border border-black/10 p-3 text-sm">
                <span className="font-semibold">{a.shadowCoachName}</span>
                <span className="text-black/45">
                  {" "}
                  — {formatDate(a.startsOn)}
                  {a.endsOn !== a.startsOn ? ` – ${formatDate(a.endsOn)}` : ""}
                </span>
              </div>
            ))}
            {plan.uncoveredDates.length > 0 && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                No coach free on: {plan.uncoveredDates.map((d) => formatDate(d)).join(", ")}
              </div>
            )}
            {plan.assignments.length > 0 && (
              <Button className="w-full" loading={assigning} onClick={confirm}>
                Confirm Assignment{plan.assignments.length > 1 ? "s" : ""}
              </Button>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}

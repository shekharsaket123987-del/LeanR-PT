"use client";

import { useState } from "react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import { findShadowCoachCandidatesAction, assignShadowCoachAction } from "@/lib/actions/admin-shadow-coach.actions";
import { isFailure } from "@/lib/actions/action-result";
import { ShadowCoachCandidate } from "@/lib/services/scheduling.service";

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
  const [candidates, setCandidates] = useState<ShadowCoachCandidate[] | null>(null);
  const [selected, setSelected] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [error, setError] = useState("");

  function reset() {
    setCandidates(null);
    setSelected("");
    setError("");
  }

  async function search() {
    if (endsOn < startsOn) {
      setError("End date must be on or after start date");
      return;
    }
    setLoading(true);
    setError("");
    setCandidates(null);
    const result = await findShadowCoachCandidatesAction(clientId, primaryCoachId, startsOn, endsOn);
    setLoading(false);
    if (isFailure(result)) {
      setError(result.error.message);
      return;
    }
    setCandidates(result.data);
  }

  async function confirm() {
    if (!selected) return;
    setAssigning(true);
    setError("");
    const result = await assignShadowCoachAction({
      clientId,
      primaryCoachId,
      shadowCoachId: selected,
      startsOn,
      endsOn,
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
          Find a coach to cover this client&apos;s recurring sessions for a date range — e.g. while their primary coach is on
          leave.
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
            placeholder="e.g. Primary coach on approved leave"
            className="w-full rounded-xl border border-black/15 p-2.5 text-sm"
          />
        </div>

        {error && <p className="text-xs text-red-600">{error}</p>}

        {candidates === null ? (
          <Button className="w-full" loading={loading} onClick={search}>
            Find Available Coaches
          </Button>
        ) : candidates.length === 0 ? (
          <p className="rounded-lg bg-black/[0.03] p-3 text-sm text-black/50">
            No coach is free for all of this client&apos;s sessions in that range.
          </p>
        ) : (
          <div className="space-y-2">
            {candidates.map((c) => (
              <label
                key={c.coachId}
                className={`flex cursor-pointer items-center justify-between rounded-xl border p-3 text-sm ${
                  selected === c.coachId ? "border-brand-yellow bg-brand-yellow/10" : "border-black/10"
                }`}
              >
                <span>
                  <span className="font-semibold">{c.name}</span>
                  {c.specialization && <span className="text-black/45"> — {c.specialization}</span>}
                </span>
                <span className="flex items-center gap-2">
                  <span className="text-xs text-black/40">{c.utilizationPct}% utilized</span>
                  <input type="radio" name="shadow-coach" checked={selected === c.coachId} onChange={() => setSelected(c.coachId)} />
                </span>
              </label>
            ))}
            <Button className="w-full" disabled={!selected} loading={assigning} onClick={confirm}>
              Confirm Shadow Coach
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
}

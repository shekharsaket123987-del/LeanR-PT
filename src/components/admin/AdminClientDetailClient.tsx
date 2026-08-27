"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  PlusCircle,
  MinusCircle,
  RefreshCcw,
  PauseCircle,
  Banknote,
  Target,
  HeartPulse,
  UserPlus,
  MessageCircleWarning,
  Scale,
  CheckCircle2,
  Ruler,
  Weight,
} from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge, { AssessmentBadge, SessionStatusBadge } from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import {
  AdminClientDetailView,
  AdminCoachOption,
  adjustClientSessionsAction,
  adjustPauseDaysAction,
  transferClientCoachAction,
  pauseClientSubscriptionAction,
  logRefundRequestAction,
} from "@/lib/actions/admin-clients.actions";
import ShadowCoachAssignModal from "@/components/admin/ShadowCoachAssignModal";
import ClientTimeline from "@/components/admin/ClientTimeline";
import AdminClientChats from "@/components/admin/AdminClientChats";
import MeasurementChart from "@/components/shared/MeasurementChart";
import { AdminEscalationView, logEscalationAction, resolveEscalationAction } from "@/lib/actions/admin-escalations.actions";
import { logMeasurementAction } from "@/lib/actions/admin-progress.actions";
import { TimelineEventRow } from "@/lib/services/timeline.service";
import { AdminConversationView } from "@/lib/services/chat.service";
import { isFailure } from "@/lib/actions/action-result";
import { formatDate } from "@/lib/utils";
import { CLIENT_STATUS_LABELS } from "@/lib/client-status";

const STATUS_VARIANT: Record<string, "green" | "red" | "gray" | "black" | "outline-yellow"> = {
  active: "green",
  paused: "red",
  expired: "gray",
  created: "black",
  demo: "outline-yellow",
  not_paid: "gray",
};

export default function AdminClientDetailClient({
  client,
  coaches,
  timelineEvents,
  escalations,
  conversations,
}: {
  client: AdminClientDetailView;
  coaches: AdminCoachOption[];
  timelineEvents: TimelineEventRow[];
  escalations: AdminEscalationView[];
  conversations: AdminConversationView[];
}) {
  const router = useRouter();
  const [modal, setModal] = useState<null | "adjust" | "transfer" | "refund" | "shadow" | "escalation" | "measurement" | "pauseDays">(null);
  const [pauseConfirm, setPauseConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [sessionDelta, setSessionDelta] = useState(0);
  const [pauseDaysDelta, setPauseDaysDelta] = useState(0);
  const [transferTo, setTransferTo] = useState("");
  const [transferAvailabilityWarning, setTransferAvailabilityWarning] = useState("");
  const [refundAmount, setRefundAmount] = useState("");
  const [refundReason, setRefundReason] = useState("");

  const [escalationReason, setEscalationReason] = useState("");
  const [escalationDescription, setEscalationDescription] = useState("");
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const [measurement, setMeasurement] = useState({
    weight: "",
    bodyFatPct: "",
    musclePct: "",
    waist: "",
    chest: "",
    hip: "",
    arms: "",
    thigh: "",
  });

  function closeModal() {
    setModal(null);
    setError("");
    setSessionDelta(0);
    setPauseDaysDelta(0);
    setTransferTo("");
    setTransferAvailabilityWarning("");
    setRefundAmount("");
    setRefundReason("");
    setEscalationReason("");
    setEscalationDescription("");
  }

  async function saveSessionAdjust() {
    if (!client.subscription) return;
    setBusy(true);
    setError("");
    const newTotal = client.subscription.sessionsTotal + sessionDelta;
    const result = await adjustClientSessionsAction(client.subscription.id, newTotal);
    setBusy(false);
    if (isFailure(result)) return setError(result.error.message);
    closeModal();
    router.refresh();
  }

  async function savePauseDaysAdjust() {
    if (!client.subscription || pauseDaysDelta === 0) return;
    setBusy(true);
    setError("");
    const result = await adjustPauseDaysAction(client.subscription.id, pauseDaysDelta);
    setBusy(false);
    if (isFailure(result)) return setError(result.error.message);
    closeModal();
    router.refresh();
  }

  async function confirmTransfer(force = false) {
    if (!client.coach || !transferTo) return;
    setBusy(true);
    setError("");
    if (!force) setTransferAvailabilityWarning("");
    const result = await transferClientCoachAction(client.id, client.coach.id, transferTo, force);
    setBusy(false);
    if (isFailure(result)) {
      if (!force && result.error.message.includes("hasn't set availability for")) {
        setTransferAvailabilityWarning(result.error.message);
        return;
      }
      return setError(result.error.message);
    }
    closeModal();
    router.refresh();
  }

  async function confirmPause() {
    if (!client.subscription) return setPauseConfirm(false);
    setBusy(true);
    const result = await pauseClientSubscriptionAction(client.subscription.id);
    setBusy(false);
    setPauseConfirm(false);
    if (!isFailure(result)) router.refresh();
  }

  async function submitRefund() {
    setBusy(true);
    setError("");
    const result = await logRefundRequestAction(client.id, Number(refundAmount) || 0, refundReason);
    setBusy(false);
    if (isFailure(result)) return setError(result.error.message);
    closeModal();
    router.refresh();
  }

  async function submitEscalation() {
    setBusy(true);
    setError("");
    const result = await logEscalationAction(client.id, escalationReason, escalationDescription || undefined, client.coach?.id);
    setBusy(false);
    if (isFailure(result)) return setError(result.error.message);
    setEscalationReason("");
    setEscalationDescription("");
    closeModal();
    router.refresh();
  }

  async function resolveEscalation(id: string) {
    setResolvingId(id);
    const result = await resolveEscalationAction(id);
    setResolvingId(null);
    if (!isFailure(result)) router.refresh();
  }

  async function submitMeasurement() {
    setBusy(true);
    setError("");
    const toNum = (v: string) => (v === "" ? undefined : Number(v));
    const result = await logMeasurementAction(client.id, {
      weight: toNum(measurement.weight),
      bodyFatPct: toNum(measurement.bodyFatPct),
      musclePct: toNum(measurement.musclePct),
      waist: toNum(measurement.waist),
      chest: toNum(measurement.chest),
      hip: toNum(measurement.hip),
      arms: toNum(measurement.arms),
      thigh: toNum(measurement.thigh),
    });
    setBusy(false);
    if (isFailure(result)) return setError(result.error.message);
    setMeasurement({ weight: "", bodyFatPct: "", musclePct: "", waist: "", chest: "", hip: "", arms: "", thigh: "" });
    closeModal();
    router.refresh();
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-1">
        <Card className="p-5">
          <div className="flex items-center gap-3">
            <div className="relative h-14 w-14 overflow-hidden rounded-xl">
              <Image src={client.photo} alt={client.name} fill className="object-cover" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-bold">{client.name}</p>
                <Badge variant={STATUS_VARIANT[client.status] ?? "gray"}>{CLIENT_STATUS_LABELS[client.status] ?? client.status}</Badge>
              </div>
              <p className="text-xs text-white/45">{client.email}</p>
              <p className="text-xs text-white/45">{client.phone}</p>
            </div>
          </div>
          <div className="mt-4 space-y-3 border-t border-white/[0.06] pt-4">
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="flex items-center gap-1.5 text-white/60">
                <Ruler className="h-3.5 w-3.5 text-white/35" /> {client.demographics?.heightCm ? `${client.demographics.heightCm} cm` : "—"}
              </div>
              <div className="flex items-center gap-1.5 text-white/60">
                <Weight className="h-3.5 w-3.5 text-white/35" /> {client.demographics?.weightKg ? `${client.demographics.weightKg} kg` : "—"}
              </div>
              <div className="flex items-center gap-1.5 text-white/60">
                <Scale className="h-3.5 w-3.5 text-white/35" /> {client.demographics?.bmi ? `BMI ${client.demographics.bmi}` : "—"}
              </div>
            </div>
            <div>
              <p className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase text-white/40">
                <Target className="h-3.5 w-3.5" /> Goals
              </p>
              <p className="text-xs text-white/60">{client.goals.length > 0 ? client.goals.join(", ") : "—"}</p>
            </div>
            <div>
              <p className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase text-white/40">
                <HeartPulse className="h-3.5 w-3.5" /> Medical Notes
              </p>
              <p className="text-xs text-white/60">{client.medicalNotes ?? "—"}</p>
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <p className="mb-3 text-xs font-bold uppercase text-white/40">Assigned Coach</p>
          {client.coach ? (
            <div className="flex items-center gap-3">
              <div className="relative h-11 w-11 overflow-hidden rounded-full">
                <Image src={client.coach.photo} alt={client.coach.name} fill className="object-cover" />
              </div>
              <div>
                <p className="text-sm font-bold">{client.coach.name}</p>
                <p className="text-xs text-white/45">{client.coach.specialization ?? ""}</p>
              </div>
            </div>
          ) : (
            <p className="text-xs text-white/45">No coach assigned yet.</p>
          )}
        </Card>

        {client.subscription && (
          <Card className="p-5">
            <p className="mb-3 text-xs font-bold uppercase text-white/40">Package</p>
            <p className="text-sm font-bold">{client.subscription.packageName}</p>
            <p className="mt-1 text-xs text-white/45">
              {client.subscription.sessionsUsed} used · {client.subscription.sessionsRemaining} remaining of {client.subscription.sessionsTotal}
            </p>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white/5">
              <div
                className="h-full rounded-full bg-brand-yellow"
                style={{ width: `${Math.min(100, (client.subscription.sessionsUsed / client.subscription.sessionsTotal) * 100)}%` }}
              />
            </div>
            {client.subscription.pauseDaysAllowed > 0 && (
              <p className="mt-3 border-t border-white/[0.06] pt-3 text-xs text-white/50">
                {Math.max(0, client.subscription.pauseDaysAllowed - client.subscription.pauseDaysUsed).toFixed(1)} of{" "}
                {client.subscription.pauseDaysAllowed} pause-days remaining
              </p>
            )}
            <Button variant="outline" size="sm" className="mt-3 w-full" onClick={() => setModal("pauseDays")}>
              <PlusCircle className="h-3.5 w-3.5" /> Grant Pause-Days
            </Button>
          </Card>
        )}

        <Card className="space-y-2 p-5">
          <p className="mb-1 text-xs font-bold uppercase text-white/40">Manual Controls</p>
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start"
            disabled={!client.subscription}
            onClick={() => setModal("adjust")}
          >
            <PlusCircle className="h-3.5 w-3.5" /> Adjust Package / Sessions
          </Button>
          <Button variant="outline" size="sm" className="w-full justify-start" disabled={!client.coach} onClick={() => setModal("transfer")}>
            <RefreshCcw className="h-3.5 w-3.5" /> Transfer to Another Coach
          </Button>
          <Button variant="outline" size="sm" className="w-full justify-start" disabled={!client.coach} onClick={() => setModal("shadow")}>
            <UserPlus className="h-3.5 w-3.5" /> Assign Shadow Coach
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start"
            disabled={!client.subscription}
            onClick={() => setPauseConfirm(true)}
          >
            <PauseCircle className="h-3.5 w-3.5" /> Pause Subscription
          </Button>
          <Button variant="outline" size="sm" className="w-full justify-start" onClick={() => setModal("measurement")}>
            <Scale className="h-3.5 w-3.5" /> Log Measurement
          </Button>
          <Button variant="outline" size="sm" className="w-full justify-start" onClick={() => setModal("escalation")}>
            <MessageCircleWarning className="h-3.5 w-3.5" /> Log Escalation
          </Button>
          <Button variant="destructive-outline" size="sm" className="w-full justify-start" onClick={() => setModal("refund")}>
            <Banknote className="h-3.5 w-3.5" /> Log Refund Request
          </Button>
        </Card>

        {escalations.some((e) => e.status === "open") && (
          <Card className="space-y-2 p-5">
            <p className="mb-1 text-xs font-bold uppercase text-white/40">Open Escalations</p>
            {escalations
              .filter((e) => e.status === "open")
              .map((e) => (
                <div key={e.id} className="rounded-xl border border-red-200 bg-red-400/10 p-3">
                  <p className="text-sm font-semibold text-red-300">{e.reason}</p>
                  {e.description && <p className="mt-0.5 text-xs text-red-400">{e.description}</p>}
                  <p className="mt-1 text-[11px] text-red-400/70">
                    {e.raisedByAdmin ? "Logged by admin" : "Raised by client"} · {formatDate(e.createdAt)}
                  </p>
                  <Button size="sm" variant="outline" className="mt-2 w-full" loading={resolvingId === e.id} onClick={() => resolveEscalation(e.id)}>
                    <CheckCircle2 className="h-3.5 w-3.5" /> Mark Resolved
                  </Button>
                </div>
              ))}
          </Card>
        )}
      </div>

      <div className="lg:col-span-2">
        <h2 className="text-display mb-4 text-lg font-bold italic">Client Journey Timeline</h2>
        <div className="mb-8">
          <ClientTimeline events={timelineEvents} measurementsStale={client.measurementsStale} lastMeasurementAt={client.lastMeasurementAt} />
        </div>

        <h2 className="text-display mb-4 text-lg font-bold italic">Client Chats</h2>
        <div className="mb-8">
          <AdminClientChats conversations={conversations} />
        </div>

        {client.progressHistory.length > 0 && (
          <div className="mb-8">
            <h2 className="text-display mb-4 text-lg font-bold italic">Progress Over Time</h2>
            <Card className="p-5">
              <MeasurementChart logs={client.progressHistory} />
            </Card>
          </div>
        )}

        <h2 className="text-display mb-4 text-lg font-bold italic">Session History</h2>
        {client.history.length === 0 && <p className="text-sm text-white/45">No sessions yet.</p>}
        <div className="space-y-3">
          {client.history.map((s) => (
            <Card key={s.id} className="p-4">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                {s.type === "assessment" ? <AssessmentBadge amountPaid={s.amountPaid} /> : <Badge variant="gray">Regular</Badge>}
                <SessionStatusBadge status={s.status as any} />
                <span className="text-xs text-white/40">{formatDate(s.date)}</span>
              </div>
              {s.remarks && <p className="text-sm text-white/60">{s.remarks}</p>}
            </Card>
          ))}
        </div>
      </div>

      <Modal open={modal === "adjust"} onClose={closeModal} title="Adjust Package / Sessions">
        {client.subscription && (
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase text-white/40">Sessions to Add / Remove</label>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  className="rounded-lg border border-white/15 p-2"
                  onClick={() => setSessionDelta((d) => d - 1)}
                >
                  <MinusCircle className="h-4 w-4" />
                </button>
                <input readOnly value={sessionDelta} className="w-20 rounded-xl border border-white/15 p-2 text-center text-sm" />
                <button
                  type="button"
                  className="rounded-lg border border-white/15 p-2"
                  onClick={() => setSessionDelta((d) => d + 1)}
                >
                  <PlusCircle className="h-4 w-4" />
                </button>
              </div>
              <p className="mt-1.5 text-xs text-white/40">
                New total: {client.subscription.sessionsTotal + sessionDelta}
              </p>
            </div>
            {error && <p className="text-xs text-red-400">{error}</p>}
            <Button className="w-full" loading={busy} disabled={sessionDelta === 0} onClick={saveSessionAdjust}>
              Save Changes
            </Button>
          </div>
        )}
      </Modal>

      <Modal open={modal === "pauseDays"} onClose={closeModal} title="Grant Pause-Days">
        {client.subscription && (
          <div className="space-y-4">
            <p className="text-xs text-white/45">
              Currently {client.subscription.pauseDaysAllowed} pause-days allowed ({client.subscription.pauseDaysUsed.toFixed(1)} used).
            </p>
            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase text-white/40">Days to Add / Remove</label>
              <div className="flex items-center gap-3">
                <button type="button" className="rounded-lg border border-white/15 p-2" onClick={() => setPauseDaysDelta((d) => d - 1)}>
                  <MinusCircle className="h-4 w-4" />
                </button>
                <input readOnly value={pauseDaysDelta} className="w-20 rounded-xl border border-white/15 p-2 text-center text-sm" />
                <button type="button" className="rounded-lg border border-white/15 p-2" onClick={() => setPauseDaysDelta((d) => d + 1)}>
                  <PlusCircle className="h-4 w-4" />
                </button>
              </div>
              <p className="mt-1.5 text-xs text-white/40">
                New total: {Math.max(0, client.subscription.pauseDaysAllowed + pauseDaysDelta)} pause-days
              </p>
            </div>
            {error && <p className="text-xs text-red-400">{error}</p>}
            <Button className="w-full" loading={busy} disabled={pauseDaysDelta === 0} onClick={savePauseDaysAdjust}>
              Save Changes
            </Button>
          </div>
        )}
      </Modal>

      <Modal open={modal === "transfer"} onClose={closeModal} title="Transfer to Another Coach">
        <div className="space-y-4">
          <p className="text-sm text-white/50">
            {client.name}&apos;s active recurring slots and upcoming bookings will move to the new coach.
          </p>
          <select
            value={transferTo}
            onChange={(e) => {
              setTransferTo(e.target.value);
              setTransferAvailabilityWarning("");
            }}
            className="w-full rounded-xl border border-white/15 p-3 text-sm focus:border-brand-yellow focus:outline-none focus:ring-1 focus:ring-brand-yellow"
          >
            <option value="">Select a coach...</option>
            {coaches
              .filter((c) => c.id !== client.coach?.id)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.specialization ? ` — ${c.specialization}` : ""}
                </option>
              ))}
          </select>
          {error && <p className="text-xs text-red-400">{error}</p>}
          {transferAvailabilityWarning ? (
            <div className="space-y-3 rounded-xl border border-amber-400/30 bg-amber-400/10 p-3">
              <p className="text-xs text-amber-400">{transferAvailabilityWarning}</p>
              <Button className="w-full" variant="destructive-outline" loading={busy} onClick={() => confirmTransfer(true)}>
                Transfer Anyway
              </Button>
            </div>
          ) : (
            <Button className="w-full" disabled={!transferTo} loading={busy} onClick={() => confirmTransfer(false)}>
              Confirm Transfer
            </Button>
          )}
        </div>
      </Modal>

      <Modal open={modal === "refund"} onClose={closeModal} title="Log Refund Request">
        <div className="space-y-4">
          <p className="text-xs text-white/45">
            This platform has no payment gateway yet — this logs a refund request to the audit trail for finance to action manually; it does not move money.
          </p>
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase text-white/40">Refund Amount (₹)</label>
            <input
              type="number"
              value={refundAmount}
              onChange={(e) => setRefundAmount(e.target.value)}
              placeholder="0"
              className="w-full rounded-xl border border-white/15 p-3 text-sm focus:border-brand-yellow focus:outline-none focus:ring-1 focus:ring-brand-yellow"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase text-white/40">Reason</label>
            <textarea
              rows={3}
              value={refundReason}
              onChange={(e) => setRefundReason(e.target.value)}
              className="w-full rounded-xl border border-white/15 p-3 text-sm focus:border-brand-yellow focus:outline-none focus:ring-1 focus:ring-brand-yellow"
            />
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
          <Button variant="destructive" className="w-full" loading={busy} disabled={!refundAmount || !refundReason} onClick={submitRefund}>
            Log Refund Request
          </Button>
        </div>
      </Modal>

      <Modal open={modal === "escalation"} onClose={closeModal} title="Log Escalation">
        <div className="space-y-4">
          <p className="text-xs text-white/45">Records a client concern for tracking and resolution -- appears on their timeline immediately.</p>
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase text-white/40">Reason</label>
            <input
              value={escalationReason}
              onChange={(e) => setEscalationReason(e.target.value)}
              placeholder="e.g. Unhappy with coach communication"
              className="w-full rounded-xl border border-white/15 p-3 text-sm"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase text-white/40">Details (optional)</label>
            <textarea
              rows={3}
              value={escalationDescription}
              onChange={(e) => setEscalationDescription(e.target.value)}
              className="w-full rounded-xl border border-white/15 p-3 text-sm"
            />
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
          <Button className="w-full" disabled={!escalationReason} loading={busy} onClick={submitEscalation}>
            Log Escalation
          </Button>
        </div>
      </Modal>

      <Modal open={modal === "measurement"} onClose={closeModal} title="Log Measurement">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {(
              [
                ["weight", "Weight (kg)"],
                ["bodyFatPct", "Body Fat %"],
                ["musclePct", "Muscle %"],
                ["waist", "Waist (in)"],
                ["chest", "Chest (in)"],
                ["hip", "Hip (in)"],
                ["arms", "Arms (in)"],
                ["thigh", "Thigh (in)"],
              ] as const
            ).map(([key, label]) => (
              <div key={key}>
                <label className="mb-1.5 block text-xs font-bold uppercase text-white/40">{label}</label>
                <input
                  type="number"
                  value={measurement[key]}
                  onChange={(e) => setMeasurement((m) => ({ ...m, [key]: e.target.value }))}
                  className="w-full rounded-xl border border-white/15 p-2.5 text-sm"
                />
              </div>
            ))}
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
          <Button className="w-full" loading={busy} onClick={submitMeasurement}>
            Save Measurement
          </Button>
        </div>
      </Modal>

      {client.coach && (
        <ShadowCoachAssignModal
          open={modal === "shadow"}
          onClose={closeModal}
          clientId={client.id}
          primaryCoachId={client.coach.id}
          onAssigned={() => {
            closeModal();
            router.refresh();
          }}
        />
      )}

      <ConfirmDialog
        open={pauseConfirm}
        onClose={() => setPauseConfirm(false)}
        onConfirm={confirmPause}
        title="Pause this subscription?"
        description={`${client.name}'s package will be paused. They won't be able to book new sessions until reactivated.`}
        confirmLabel="Pause Subscription"
        destructive={false}
        loading={busy}
      />
    </div>
  );
}

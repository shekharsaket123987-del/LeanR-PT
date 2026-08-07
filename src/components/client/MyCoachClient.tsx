"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Star, Award, Languages, Users, AlertCircle, CheckCircle2 } from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";
import { MyCoachView } from "@/lib/actions/client-coach.actions";
import {
  MyCoachChangeRequestView,
  CoachChangeOptionView,
  requestCoachChangeAction,
  findCoachChangeOptionsAction,
  completeCoachChangeAction,
} from "@/lib/actions/client-coach-change.actions";
import { isFailure } from "@/lib/actions/action-result";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function StarPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" onClick={() => onChange(n)}>
          <Star className={`h-5 w-5 ${n <= value ? "fill-brand-yellow text-brand-yellow" : "text-black/20"}`} />
        </button>
      ))}
    </div>
  );
}

export default function MyCoachClient({ coach, request }: { coach: MyCoachView | null; request: MyCoachChangeRequestView | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [overallExperience, setOverallExperience] = useState(0);
  const [coachRating, setCoachRating] = useState(0);
  const [additionalComments, setAdditionalComments] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [days, setDays] = useState<number[]>([]);
  const [timeOfDay, setTimeOfDay] = useState("");
  const [option, setOption] = useState<CoachChangeOptionView | null>(null);
  const [searching, setSearching] = useState(false);

  async function submitRequest() {
    setBusy(true);
    setError("");
    const result = await requestCoachChangeAction({ reason, overallExperience: overallExperience || undefined, coachRating: coachRating || undefined, additionalComments: additionalComments || undefined });
    setBusy(false);
    if (isFailure(result)) return setError(result.error.message);
    setOpen(false);
    router.refresh();
  }

  function toggleDay(d: number) {
    setDays((cur) => (cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d]));
  }

  async function searchOptions() {
    if (!request || days.length === 0 || !timeOfDay) return;
    setSearching(true);
    setError("");
    setOption(null);
    const result = await findCoachChangeOptionsAction(request.id, { pattern: "custom", preferredTime: timeOfDay, customDays: days });
    setSearching(false);
    if (isFailure(result)) return setError(result.error.message);
    if (!result.data) {
      setError("No coach is available for that day/time -- try a different combination.");
      return;
    }
    setOption(result.data);
  }

  async function confirmNewCoach() {
    if (!request || !option) return;
    setBusy(true);
    setError("");
    const result = await completeCoachChangeAction(request.id, option.coachId, option.days, option.timeOfDay);
    setBusy(false);
    if (isFailure(result)) return setError(result.error.message);
    router.refresh();
  }

  const needsCompletion = request?.status === "approved" && !request.newCoachId;

  if (!coach) {
    return (
      <Card className="flex flex-col items-center gap-3 p-8 text-center">
        <p className="text-sm font-bold">No Active Coach</p>
        <p className="max-w-sm text-sm text-black/50">
          You&apos;ll be matched with a coach automatically once you book a free demo session or choose a plan.
        </p>
        <Button href="/client/demo-booking" className="mt-2">
          Book Free Demo Session
        </Button>
      </Card>
    );
  }

  if (coach.isDemoCoach) {
    return (
      <Card className="overflow-hidden">
        <div className="relative h-48 w-full">
          <Image src={`https://picsum.photos/seed/${coach.id}-cover/900/300`} alt="" fill className="object-cover" />
          <div className="absolute inset-0 bg-black/30" />
        </div>
        <div className="relative -mt-14 px-6">
          <div className="relative h-28 w-28 overflow-hidden rounded-2xl border-4 border-white shadow-soft">
            <Image src={coach.photo} alt={coach.name} fill className="object-cover" />
          </div>
        </div>
        <div className="p-6 pt-4">
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-display text-2xl font-bold italic">{coach.name}</p>
            <Badge variant="outline-yellow">Demo Coach</Badge>
          </div>
          <p className="mt-1 text-sm font-medium text-black/50">{coach.specialization}</p>
          <p className="mt-4 text-sm text-black/60">
            Assigned automatically for your demo session. Once you choose a plan, you&apos;ll be matched with a dedicated coach for
            ongoing training.
          </p>
        </div>
      </Card>
    );
  }

  return (
    <>
      {request?.status === "pending" && (
        <Card className="mb-6 border-brand-yellow bg-brand-yellow/10 p-4">
          <p className="flex items-center gap-2 text-sm font-bold">
            <AlertCircle className="h-4 w-4" />
            Your coach change request is being reviewed by our team — {coach.name} stays assigned as your coach until this is resolved.
          </p>
        </Card>
      )}
      {request?.status === "rejected" && (
        <Card className="mb-6 border-red-200 bg-red-50 p-4">
          <p className="text-sm font-bold text-red-900">Request Rejected</p>
          <p className="mt-1 text-xs text-red-700">Our team reviewed your request and you'll continue with {coach.name} for now.</p>
        </Card>
      )}
      {request?.status === "approved" && !needsCompletion && (
        <Card className="mb-6 border-emerald-200 bg-emerald-50 p-4">
          <p className="flex items-center gap-2 text-sm font-bold text-emerald-800">
            <CheckCircle2 className="h-4 w-4" /> Your coach change is complete.
          </p>
        </Card>
      )}

      {needsCompletion && (
        <Card className="mb-6 p-5">
          <p className="text-sm font-bold">Your request was approved — pick your new schedule</p>
          <p className="mt-1 text-xs text-black/45">Choose the days and time you'd like, and we'll find an available coach.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {DAYS.map((d, i) => (
              <button
                key={d}
                type="button"
                onClick={() => toggleDay(i)}
                className={`rounded-lg border px-3 py-1.5 text-xs font-bold ${days.includes(i) ? "border-brand-yellow bg-brand-yellow/15" : "border-black/15"}`}
              >
                {d}
              </button>
            ))}
          </div>
          <input type="time" value={timeOfDay} onChange={(e) => setTimeOfDay(e.target.value)} className="mt-3 w-full max-w-[160px] rounded-xl border border-black/15 p-2.5 text-sm" />
          {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
          {option && (
            <div className="mt-3 rounded-xl bg-black/[0.03] p-3 text-sm">
              <span className="font-bold">{option.coachName}</span> is available {option.days.map((d) => DAYS[d]).join("/")} at {option.timeOfDay}.
              <Button size="sm" className="ml-3" loading={busy} onClick={confirmNewCoach}>
                Confirm {option.coachName}
              </Button>
            </div>
          )}
          {!option && (
            <Button size="sm" className="mt-3" loading={searching} disabled={days.length === 0 || !timeOfDay} onClick={searchOptions}>
              Find Available Coach
            </Button>
          )}
        </Card>
      )}

      <Card className="overflow-hidden">
        <div className="relative h-48 w-full">
          <Image src={`https://picsum.photos/seed/${coach.id}-cover/900/300`} alt="" fill className="object-cover" />
          <div className="absolute inset-0 bg-black/30" />
        </div>
        <div className="relative -mt-14 px-6">
          <div className="relative h-28 w-28 overflow-hidden rounded-2xl border-4 border-white shadow-soft">
            <Image src={coach.photo} alt={coach.name} fill className="object-cover" />
          </div>
        </div>
        <div className="p-6 pt-4">
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-display text-2xl font-bold italic">{coach.name}</p>
            <Badge variant="green">
              <Star className="h-3 w-3 fill-current" /> {coach.rating} ({coach.reviewCount})
            </Badge>
          </div>
          <p className="mt-1 text-sm font-medium text-black/50">{coach.specialization}</p>
          {coach.bio && <p className="mt-4 text-sm leading-relaxed text-black/65">{coach.bio}</p>}

          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-xl bg-black/[0.03] p-4">
              <Award className="mb-2 h-4 w-4 text-black/50" />
              <p className="text-xs font-bold uppercase text-black/40">Certifications</p>
              <p className="mt-1 text-xs text-black/60">{coach.certifications.join(", ") || "—"}</p>
            </div>
            <div className="rounded-xl bg-black/[0.03] p-4">
              <Languages className="mb-2 h-4 w-4 text-black/50" />
              <p className="text-xs font-bold uppercase text-black/40">Languages</p>
              <p className="mt-1 text-xs text-black/60">{coach.languages.join(", ") || "—"}</p>
            </div>
            <div className="rounded-xl bg-black/[0.03] p-4">
              <Users className="mb-2 h-4 w-4 text-black/50" />
              <p className="text-xs font-bold uppercase text-black/40">Experience</p>
              <p className="mt-1 text-xs text-black/60">{coach.yearsExperience} years coaching</p>
            </div>
          </div>

          <div className="mt-8 border-t border-black/[0.06] pt-6">
            <p className="text-sm font-bold">Not the right fit?</p>
            <p className="mt-1 text-xs text-black/45">You can request a coach change. Our team reviews every request personally.</p>
            <Button variant="outline" size="sm" className="mt-3" disabled={request?.status === "pending"} onClick={() => setOpen(true)}>
              Request Coach Change
            </Button>
          </div>
        </div>
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title="Request Coach Change">
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase text-black/40">Reason</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="e.g. Scheduling conflict, prefer a different training style..."
              className="w-full rounded-xl border border-black/15 p-3 text-sm"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase text-black/40">Overall Experience</label>
            <StarPicker value={overallExperience} onChange={setOverallExperience} />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase text-black/40">Coach Rating</label>
            <StarPicker value={coachRating} onChange={setCoachRating} />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase text-black/40">Additional Comments</label>
            <textarea value={additionalComments} onChange={(e) => setAdditionalComments(e.target.value)} rows={2} className="w-full rounded-xl border border-black/15 p-3 text-sm" />
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button disabled={!reason.trim()} loading={busy} onClick={submitRequest}>
              Submit Request
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}

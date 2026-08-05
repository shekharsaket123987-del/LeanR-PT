"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { CheckCircle2 } from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import StubPaymentModal from "@/components/client/StubPaymentModal";
import { findDemoSlotsAction, confirmDemoBookingAction } from "@/lib/actions/client-journey.actions";
import { DemoSlotOption } from "@/lib/services/demoBooking.service";
import { isFailure } from "@/lib/actions/action-result";
import { formatDate, formatTime } from "@/lib/utils";
import { DEMO_SESSION_FEE } from "@/lib/constants/pricing";

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function DemoBookingClient() {
  const router = useRouter();
  const [date, setDate] = useState(todayISO());
  const [preferredTime, setPreferredTime] = useState("");
  const [genderPreference, setGenderPreference] = useState<"" | "male" | "female" | "other">("");
  const [slots, setSlots] = useState<DemoSlotOption[] | null>(null);
  const [selected, setSelected] = useState<DemoSlotOption | null>(null);
  const [searching, setSearching] = useState(false);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState("");
  const [confirmed, setConfirmed] = useState(false);

  async function search() {
    setSearching(true);
    setError("");
    setSlots(null);
    const result = await findDemoSlotsAction({ date, preferredTime: preferredTime || undefined, genderPreference: genderPreference || undefined });
    setSearching(false);
    if (isFailure(result)) {
      setError(result.error.message);
      return;
    }
    setSlots(result.data);
  }

  async function onPaymentSuccess() {
    if (!selected) return;
    const result = await confirmDemoBookingAction(selected.coachId, selected.slotStart);
    setPaying(false);
    if (isFailure(result)) {
      setError(result.error.message);
      return;
    }
    setConfirmed(true);
  }

  if (confirmed) {
    return (
      <Card className="p-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100">
          <CheckCircle2 className="h-7 w-7 text-emerald-600" />
        </div>
        <p className="text-display text-xl font-bold italic">Demo Session Booked</p>
        <p className="mt-1 text-sm text-black/50">
          {selected && `${selected.coachName} · ${formatDate(selected.slotStart)} · ${formatTime(selected.slotStart)}`}
        </p>
        <Button className="mt-6" onClick={() => router.push("/client/sessions")}>
          View My Sessions
        </Button>
      </Card>
    );
  }

  return (
    <>
      <Card className="p-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase text-black/40">Preferred Date</label>
            <input type="date" value={date} min={todayISO()} onChange={(e) => setDate(e.target.value)} className="w-full rounded-xl border border-black/15 p-3 text-sm" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase text-black/40">Preferred Time (optional)</label>
            <input type="time" value={preferredTime} onChange={(e) => setPreferredTime(e.target.value)} className="w-full rounded-xl border border-black/15 p-3 text-sm" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase text-black/40">Coach Gender (optional)</label>
            <select value={genderPreference} onChange={(e) => setGenderPreference(e.target.value as any)} className="w-full rounded-xl border border-black/15 p-3 text-sm">
              <option value="">No preference</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>
        {error && <p className="mt-3 text-xs text-red-600">{error}</p>}
        <Button className="mt-5" loading={searching} onClick={search}>
          Search Available Slots
        </Button>
      </Card>

      {slots && (
        <div className="mt-6 space-y-2">
          {slots.length === 0 && <p className="text-sm text-black/45">No demo slots found for that date -- try a different date or time.</p>}
          {slots.map((s) => (
            <Card key={`${s.coachId}-${s.slotStart}`} className="flex items-center justify-between gap-4 p-4">
              <div className="flex items-center gap-3">
                <div className="relative h-10 w-10 overflow-hidden rounded-full">
                  <Image src={s.coachPhoto} alt={s.coachName} fill className="object-cover" />
                </div>
                <div>
                  <p className="text-sm font-bold">{s.coachName}</p>
                  <p className="text-xs text-black/45">
                    {formatDate(s.slotStart)} · {formatTime(s.slotStart)}
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                onClick={() => {
                  setSelected(s);
                  setPaying(true);
                }}
              >
                Select
              </Button>
            </Card>
          ))}
        </div>
      )}

      {selected && (
        <StubPaymentModal
          open={paying}
          onClose={() => setPaying(false)}
          amountRupees={DEMO_SESSION_FEE}
          title="Confirm Demo Session"
          onSuccess={onPaymentSuccess}
        />
      )}
    </>
  );
}

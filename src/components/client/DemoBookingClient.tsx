"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { CheckCircle2 } from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { bookDemoSessionAction, DemoBookingResult } from "@/lib/actions/client-journey.actions";
import { isFailure } from "@/lib/actions/action-result";
import { formatDate, formatTime } from "@/lib/utils";

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/** The client picks a date/time preference only -- never a coach. The
 * system auto-assigns the best available coach (findDemoSlots' existing
 * utilization ranking) and confirms immediately, free, no payment step. */
export default function DemoBookingClient() {
  const router = useRouter();
  const [date, setDate] = useState(todayISO());
  const [preferredTime, setPreferredTime] = useState("");
  const [genderPreference, setGenderPreference] = useState<"" | "male" | "female" | "other">("");
  const [booking, setBooking] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<DemoBookingResult | null>(null);

  async function bookDemo() {
    setBooking(true);
    setError("");
    const res = await bookDemoSessionAction({
      date,
      preferredTime: preferredTime || undefined,
      genderPreference: genderPreference || undefined,
    });
    setBooking(false);
    if (isFailure(res)) {
      setError(res.error.message);
      return;
    }
    setResult(res.data);
  }

  if (result) {
    return (
      <Card className="p-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-400/15">
          <CheckCircle2 className="h-7 w-7 text-emerald-400" />
        </div>
        <p className="text-display text-xl font-bold italic">Demo Session Booked Successfully</p>
        <div className="mt-4 flex items-center justify-center gap-3">
          <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full">
            <Image src={result.coachPhoto} alt={result.coachName} fill className="object-cover" />
          </div>
          <div className="text-left">
            <p className="text-sm font-bold">{result.coachName}</p>
            <p className="text-xs text-white/50">
              {formatDate(result.slotStart)} · {formatTime(result.slotStart)}
            </p>
          </div>
        </div>
        <p className="mt-3 text-xs text-white/45">Your coach was automatically assigned based on availability.</p>
        <Button className="mt-6" onClick={() => router.push("/client/dashboard")}>
          Go to Dashboard
        </Button>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <label className="mb-1.5 block text-xs font-bold uppercase text-white/40">Preferred Date</label>
          <input
            type="date"
            value={date}
            min={todayISO()}
            onChange={(e) => setDate(e.target.value)}
            className="glass-faint w-full rounded-xl p-3 text-sm text-white outline-none focus:border-white/20"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-bold uppercase text-white/40">Preferred Time (optional)</label>
          <input
            type="time"
            value={preferredTime}
            onChange={(e) => setPreferredTime(e.target.value)}
            className="glass-faint w-full rounded-xl p-3 text-sm text-white outline-none focus:border-white/20"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-bold uppercase text-white/40">Coach Gender (optional)</label>
          <select
            value={genderPreference}
            onChange={(e) => setGenderPreference(e.target.value as any)}
            className="glass-faint w-full rounded-xl p-3 text-sm text-white outline-none focus:border-white/20"
          >
            <option value="">No preference</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="other">Other</option>
          </select>
        </div>
      </div>
      <p className="mt-3 text-xs text-white/40">
        We&apos;ll automatically match you with the best available coach for your chosen time -- no need to pick one yourself.
      </p>
      {error && <p className="mt-3 text-xs text-red-400">{error}</p>}
      <Button className="mt-5" loading={booking} onClick={bookDemo}>
        Book Free Demo Session
      </Button>
    </Card>
  );
}

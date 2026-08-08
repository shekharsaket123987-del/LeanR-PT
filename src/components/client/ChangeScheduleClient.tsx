"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { changeScheduleAction } from "@/lib/actions/schedule.actions";
import { isFailure } from "@/lib/actions/action-result";

const DAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
// Monday(1)..Saturday(6) only -- Sunday is always a holiday, never offered.
const PICKABLE_DAYS = [1, 2, 3, 4, 5, 6];

export default function ChangeScheduleClient({ existingSchedule }: { existingSchedule: { dayOfWeek: number; startTime: string }[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [days, setDays] = useState<number[]>([]);
  const [timeOfDay, setTimeOfDay] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [unavailable, setUnavailable] = useState(false);
  const [done, setDone] = useState(false);

  function toggleDay(d: number) {
    setDays((cur) => (cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d]));
  }

  async function submit() {
    setBusy(true);
    setError("");
    setUnavailable(false);
    const result = await changeScheduleAction({ days, timeOfDay });
    setBusy(false);
    if (isFailure(result)) {
      setError(result.error.message);
      return;
    }
    if (!result.data) {
      setUnavailable(true);
      return;
    }
    setDone(true);
    router.refresh();
  }

  if (done) {
    return (
      <Card className="p-6 text-center">
        <p className="text-display text-xl font-bold italic">Schedule Updated</p>
        <p className="mt-1 text-sm text-black/50">Your new recurring sessions have been generated.</p>
      </Card>
    );
  }

  if (!editing) {
    return (
      <Card className="p-6">
        <p className="text-sm font-bold">You already have an active recurring schedule</p>
        <ul className="mt-3 space-y-1 text-sm text-black/60">
          {existingSchedule.map((s, i) => (
            <li key={i}>
              {DAY_LABELS[s.dayOfWeek]} at {s.startTime.slice(0, 5)}
            </li>
          ))}
        </ul>
        <Button variant="outline" size="sm" className="mt-4" onClick={() => setEditing(true)}>
          Change My Schedule
        </Button>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <p className="text-sm font-bold">Pick your new days &amp; time</p>
      <p className="mt-1 text-xs text-black/45">We'll check your current coach's availability first.</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {PICKABLE_DAYS.map((i) => (
          <button
            key={i}
            type="button"
            onClick={() => toggleDay(i)}
            className={`rounded-lg border px-3 py-1.5 text-xs font-bold ${days.includes(i) ? "border-brand-yellow bg-brand-yellow/15" : "border-black/15"}`}
          >
            {DAY_LABELS[i].slice(0, 3)}
          </button>
        ))}
      </div>
      <input type="time" value={timeOfDay} onChange={(e) => setTimeOfDay(e.target.value)} className="mt-3 w-full max-w-[160px] rounded-xl border border-black/15 p-2.5 text-sm" />

      {unavailable && (
        <div className="mt-4 rounded-xl bg-black/[0.03] p-4">
          <p className="text-sm font-semibold">Your current coach is unavailable at the requested time.</p>
          <div className="mt-3 flex flex-wrap gap-3">
            <Button size="sm" variant="outline" onClick={() => setUnavailable(false)}>
              Try Another Time
            </Button>
            <Link href="/client/coach">
              <Button size="sm" variant="outline">
                Submit Coach Change Request
              </Button>
            </Link>
          </div>
        </div>
      )}
      {error && <p className="mt-3 text-xs text-red-600">{error}</p>}

      <div className="mt-4 flex gap-3">
        <Button variant="outline" onClick={() => setEditing(false)}>
          Cancel
        </Button>
        <Button disabled={days.length === 0 || !timeOfDay} loading={busy} onClick={submit}>
          Save New Schedule
        </Button>
      </div>
    </Card>
  );
}

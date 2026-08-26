"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Scale, X } from "lucide-react";
import Button from "@/components/ui/Button";
import { submitMyProgressAction } from "@/lib/actions/client-progress.actions";
import { isFailure } from "@/lib/actions/action-result";

const FIELDS: { key: keyof typeof EMPTY_FORM; label: string }[] = [
  { key: "weight", label: "Weight (kg)" },
  { key: "bodyFatPct", label: "Body Fat %" },
  { key: "musclePct", label: "Muscle %" },
  { key: "waist", label: "Waist (in)" },
  { key: "chest", label: "Chest (in)" },
  { key: "hip", label: "Hip (in)" },
  { key: "arms", label: "Arms (in)" },
  { key: "thigh", label: "Thigh (in)" },
];

const EMPTY_FORM = { weight: "", bodyFatPct: "", musclePct: "", waist: "", chest: "", hip: "", arms: "", thigh: "" };

/** Compulsory measurement-update prompt shown on client portal entry when
 * the last log is 7+ days old (or there's never been one). Unlike ui/Modal,
 * this has no backdrop-click/X dismiss -- only "Skip for now" or a
 * successful save close it, since a click-away-to-dismiss modal reads as
 * optional, and the point here is that it isn't (booking/join stay blocked
 * regardless of skip -- enforced server-side in the relevant actions, this
 * is just the up-front nudge). */
export default function MeasurementGateModal({ initiallyStale }: { initiallyStale: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(initiallyStale);
  const [form, setForm] = useState(EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (!open) return null;

  async function submit() {
    setBusy(true);
    setError("");
    const toNum = (v: string) => (v === "" ? undefined : Number(v));
    const result = await submitMyProgressAction({
      weight: toNum(form.weight),
      bodyFatPct: toNum(form.bodyFatPct),
      musclePct: toNum(form.musclePct),
      waist: toNum(form.waist),
      chest: toNum(form.chest),
      hip: toNum(form.hip),
      arms: toNum(form.arms),
      thigh: toNum(form.thigh),
    });
    setBusy(false);
    if (isFailure(result)) {
      setError(result.error.message);
      return;
    }
    setOpen(false);
    router.refresh();
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" />
      <div className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-bg-elevated p-6 shadow-2xl animate-slide-up">
        <div className="mb-1 flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-yellow/15">
            <Scale className="h-4.5 w-4.5" style={{ height: 18, width: 18 }} />
          </div>
          <h3 className="text-display text-xl font-bold italic">Time for your measurement update</h3>
        </div>
        <p className="mb-5 text-sm text-white/50">
          It&apos;s been a week (or more) since your last update. Log this week&apos;s measurements to keep booking and joining sessions
          without interruption.
        </p>

        <div className="grid grid-cols-2 gap-3">
          {FIELDS.map((f) => (
            <div key={f.key}>
              <label className="mb-1.5 block text-xs font-bold uppercase text-white/40">{f.label}</label>
              <input
                type="number"
                value={form[f.key]}
                onChange={(e) => setForm((cur) => ({ ...cur, [f.key]: e.target.value }))}
                className="w-full rounded-xl border border-white/15 p-2.5 text-sm"
              />
            </div>
          ))}
        </div>

        {error && <p className="mt-3 text-xs text-red-400">{error}</p>}

        <div className="mt-6 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="flex items-center gap-1.5 text-xs font-semibold text-white/40 hover:text-white/60"
          >
            <X className="h-3.5 w-3.5" />
            Skip for now
          </button>
          <Button loading={busy} onClick={submit}>
            Save Update
          </Button>
        </div>
        <p className="mt-3 text-center text-[11px] text-white/35">
          Skipping keeps you signed in, but you won&apos;t be able to book a demo, book a session, or join a session until this is done.
        </p>
      </div>
    </div>
  );
}

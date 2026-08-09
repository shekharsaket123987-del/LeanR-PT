"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TrendingUp } from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import MeasurementChart, { MeasurementPoint } from "@/components/shared/MeasurementChart";
import { submitRenewalCheckinAction } from "@/lib/actions/renewals.actions";
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

/** Renewal's version of the measurement step: unlike first-time onboarding
 * (a blank intake form), this shows the client's full prior progress history
 * first -- nothing is reset -- then asks for one fresh entry as the new
 * plan's baseline. Advancing past "renewal_checkin" happens naturally: once
 * this log exists, checkRenewalStage stops returning this stage on the next
 * page load, so there's no separate "mark stage complete" call. */
export default function RenewalCheckinClient({ priorLogs }: { priorLogs: MeasurementPoint[] }) {
  const router = useRouter();
  const [form, setForm] = useState(EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    setBusy(true);
    setError("");
    const toNum = (v: string) => (v === "" ? undefined : Number(v));
    const result = await submitRenewalCheckinAction({
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
    router.push("/client/dashboard");
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {priorLogs.length > 0 ? (
        <Card className="p-5">
          <p className="mb-3 flex items-center gap-2 text-sm font-bold">
            <TrendingUp className="h-4 w-4" /> Your Progress So Far
          </p>
          <MeasurementChart logs={priorLogs} />
        </Card>
      ) : (
        <EmptyState icon={TrendingUp} title="No prior measurements on file" description="Log today's numbers below to start your new baseline." />
      )}

      <Card className="p-6">
        <p className="mb-1 text-sm font-bold">Log Today's Measurements</p>
        <p className="mb-5 text-xs text-black/45">
          A fresh check-in for your new plan -- your history above stays exactly as it is.
        </p>

        <div className="grid grid-cols-2 gap-3">
          {FIELDS.map((f) => (
            <div key={f.key}>
              <label className="mb-1.5 block text-xs font-bold uppercase text-black/40">{f.label}</label>
              <input
                type="number"
                value={form[f.key]}
                onChange={(e) => setForm((cur) => ({ ...cur, [f.key]: e.target.value }))}
                className="w-full rounded-xl border border-black/15 p-2.5 text-sm"
              />
            </div>
          ))}
        </div>

        {error && <p className="mt-3 text-xs text-red-600">{error}</p>}

        <div className="mt-6 flex justify-end">
          <Button loading={busy} onClick={submit}>
            Continue
          </Button>
        </div>
      </Card>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import Badge, { AssessmentBadge } from "@/components/ui/Badge";
import { MyProgressData, submitMyProgressAction } from "@/lib/actions/client-progress.actions";
import { SessionView } from "@/lib/actions/client-portal.actions";
import { isFailure } from "@/lib/actions/action-result";
import { formatDate } from "@/lib/utils";

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

export default function ProgressClient({ progress, history }: { progress: MyProgressData; history: SessionView[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

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
    setForm(EMPTY_FORM);
    setOpen(false);
    router.refresh();
  }

  const completed = history.filter((s) => s.status === "completed");

  return (
    <>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <Card className="p-5 text-center">
          <p className="text-display text-4xl font-bold italic">{completed.length}</p>
          <p className="mt-1 text-xs font-medium text-black/45">Sessions Completed</p>
        </Card>
        <Card className="flex flex-col items-center justify-center p-5 text-center">
          {progress.canSubmitThisWeek ? (
            <Button onClick={() => setOpen(true)}>Log This Week&apos;s Update</Button>
          ) : (
            <p className="flex items-center gap-2 text-sm font-semibold text-emerald-600">
              <CheckCircle2 className="h-4 w-4" /> Weekly update submitted
            </p>
          )}
        </Card>
      </div>

      {progress.latest && (
        <Card className="mt-6 p-6">
          <p className="mb-1 text-sm font-bold">Latest Measurements</p>
          <p className="mb-4 text-xs text-black/45">As of {formatDate(progress.latest.loggedAt)}</p>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {FIELDS.map((f) => (
              <div key={f.key}>
                <p className="text-[11px] font-bold uppercase text-black/40">{f.label}</p>
                <p className="mt-1 text-lg font-bold">{(progress.latest as any)[f.key] ?? "—"}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="mt-8">
        <h2 className="text-display mb-4 text-xl font-bold italic">Session History &amp; Coach Notes</h2>
        <div className="space-y-3">
          {history.length === 0 && <p className="text-sm text-black/45">No sessions yet.</p>}
          {history.map((s) => (
            <Card key={s.id} className="p-5">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                {s.type === "assessment" && <AssessmentBadge />}
                <Badge variant="gray">{formatDate(s.date)}</Badge>
                {s.rating && <Badge variant="green">{"★".repeat(s.rating)}</Badge>}
              </div>
              {s.coachNotes && <p className="text-sm text-black/65">{s.coachNotes}</p>}
              {s.feedback && <p className="mt-2 text-xs italic text-black/40">Your feedback: &ldquo;{s.feedback}&rdquo;</p>}
            </Card>
          ))}
        </div>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="Log This Week's Update">
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
        <Button className="mt-5 w-full" loading={busy} onClick={submit}>
          Save Update
        </Button>
      </Modal>
    </>
  );
}

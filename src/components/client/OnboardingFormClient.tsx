"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { submitOnboardingAction } from "@/lib/actions/client-journey.actions";
import { FitnessGoal } from "@/lib/services/onboarding.service";
import { isFailure } from "@/lib/actions/action-result";

const GOALS: { value: FitnessGoal; label: string }[] = [
  { value: "fat_loss", label: "Fat Loss" },
  { value: "muscle_gain", label: "Muscle Gain" },
  { value: "strength", label: "Strength" },
  { value: "general_fitness", label: "General Fitness" },
  { value: "rehabilitation", label: "Rehabilitation" },
];

/** Only weight is required here -- the rest are optional so this doesn't
 * read as a wall of mandatory fields, but whichever ones ARE filled in
 * become the Day 1 baseline in progress_logs (see submitOnboarding), so
 * it's worth filling in what the client actually has on hand. */
const MEASUREMENT_FIELDS: { key: keyof typeof EMPTY_MEASUREMENTS; label: string; required?: boolean }[] = [
  { key: "weightKg", label: "Weight (kg)", required: true },
  { key: "bodyFatPct", label: "Body Fat %" },
  { key: "musclePct", label: "Muscle %" },
  { key: "waist", label: "Waist (in)" },
  { key: "chest", label: "Chest (in)" },
  { key: "hip", label: "Hip (in)" },
  { key: "arms", label: "Arms (in)" },
  { key: "thigh", label: "Thigh (in)" },
];
const EMPTY_MEASUREMENTS = { weightKg: "", bodyFatPct: "", musclePct: "", waist: "", chest: "", hip: "", arms: "", thigh: "" };

export default function OnboardingFormClient() {
  const router = useRouter();
  const [form, setForm] = useState({
    age: "",
    gender: "" as "" | "male" | "female" | "other",
    heightCm: "",
    ...EMPTY_MEASUREMENTS,
    fitnessGoal: "" as "" | FitnessGoal,
    medicalConditions: "",
    injuries: "",
    medications: "",
    exerciseRestrictions: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  const canSubmit = form.weightKg.trim() !== "" && form.fitnessGoal !== "";

  async function submit() {
    setBusy(true);
    setError("");
    const num = (v: string) => (v.trim() === "" ? undefined : Number(v));
    const result = await submitOnboardingAction({
      age: num(form.age),
      gender: form.gender || undefined,
      heightCm: num(form.heightCm),
      weightKg: num(form.weightKg),
      bodyFatPct: num(form.bodyFatPct),
      musclePct: num(form.musclePct),
      waist: num(form.waist),
      chest: num(form.chest),
      hip: num(form.hip),
      arms: num(form.arms),
      thigh: num(form.thigh),
      medicalConditions: form.medicalConditions || undefined,
      injuries: form.injuries || undefined,
      medications: form.medications || undefined,
      exerciseRestrictions: form.exerciseRestrictions || undefined,
      fitnessGoal: form.fitnessGoal || undefined,
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
    <div className="space-y-6">
      <Card className="p-6">
        <p className="mb-4 text-xs font-bold uppercase text-white/40">Personal Details</p>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase text-white/40">Age</label>
            <input type="number" value={form.age} onChange={(e) => set("age", e.target.value)} className="w-full rounded-xl border border-white/15 p-2.5 text-sm" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase text-white/40">Gender</label>
            <select value={form.gender} onChange={(e) => set("gender", e.target.value as any)} className="w-full rounded-xl border border-white/15 p-2.5 text-sm">
              <option value="">Select</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase text-white/40">Height (cm)</label>
            <input type="number" value={form.heightCm} onChange={(e) => set("heightCm", e.target.value)} className="w-full rounded-xl border border-white/15 p-2.5 text-sm" />
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <p className="mb-1 text-xs font-bold uppercase text-white/40">Starting Measurements</p>
        <p className="mb-4 text-xs text-white/45">
          This is Day 1 of your transformation journey -- whatever you fill in here becomes your baseline on the progress graph. Weight is
          required; the rest are optional.
        </p>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {MEASUREMENT_FIELDS.map((f) => (
            <div key={f.key}>
              <label className="mb-1.5 block text-xs font-bold uppercase text-white/40">
                {f.label}
                {f.required && <span className="text-brand-yellow"> *</span>}
              </label>
              <input
                type="number"
                value={form[f.key]}
                onChange={(e) => set(f.key, e.target.value)}
                className="w-full rounded-xl border border-white/15 p-2.5 text-sm"
              />
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-6">
        <p className="mb-4 text-xs font-bold uppercase text-white/40">Fitness Goal</p>
        <div className="flex flex-wrap gap-2">
          {GOALS.map((g) => (
            <button
              key={g.value}
              type="button"
              onClick={() => set("fitnessGoal", g.value)}
              className={`rounded-xl border px-4 py-2 text-sm font-semibold ${
                form.fitnessGoal === g.value ? "border-brand-yellow bg-brand-yellow/15" : "border-white/15"
              }`}
            >
              {g.label}
            </button>
          ))}
        </div>
      </Card>

      <Card className="p-6">
        <p className="mb-4 text-xs font-bold uppercase text-white/40">Medical Details (if any)</p>
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase text-white/40">Medical Conditions</label>
            <textarea rows={2} value={form.medicalConditions} onChange={(e) => set("medicalConditions", e.target.value)} className="w-full rounded-xl border border-white/15 p-2.5 text-sm" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase text-white/40">Injuries</label>
            <textarea rows={2} value={form.injuries} onChange={(e) => set("injuries", e.target.value)} className="w-full rounded-xl border border-white/15 p-2.5 text-sm" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase text-white/40">Medications</label>
            <textarea rows={2} value={form.medications} onChange={(e) => set("medications", e.target.value)} className="w-full rounded-xl border border-white/15 p-2.5 text-sm" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase text-white/40">Exercise Restrictions</label>
            <textarea rows={2} value={form.exerciseRestrictions} onChange={(e) => set("exerciseRestrictions", e.target.value)} className="w-full rounded-xl border border-white/15 p-2.5 text-sm" />
          </div>
        </div>
      </Card>

      {error && <p className="text-xs text-red-400">{error}</p>}
      <Button loading={busy} disabled={!canSubmit} onClick={submit}>
        Complete Assessment
      </Button>
    </div>
  );
}

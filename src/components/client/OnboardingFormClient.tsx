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

export default function OnboardingFormClient() {
  const router = useRouter();
  const [form, setForm] = useState({
    age: "",
    gender: "" as "" | "male" | "female" | "other",
    heightCm: "",
    weightKg: "",
    medicalConditions: "",
    injuries: "",
    medications: "",
    exerciseRestrictions: "",
    fitnessGoal: "" as "" | FitnessGoal,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function submit() {
    setBusy(true);
    setError("");
    const result = await submitOnboardingAction({
      age: form.age ? Number(form.age) : undefined,
      gender: form.gender || undefined,
      heightCm: form.heightCm ? Number(form.heightCm) : undefined,
      weightKg: form.weightKg ? Number(form.weightKg) : undefined,
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
        <p className="mb-4 text-xs font-bold uppercase text-black/40">Personal Details</p>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase text-black/40">Age</label>
            <input type="number" value={form.age} onChange={(e) => set("age", e.target.value)} className="w-full rounded-xl border border-black/15 p-2.5 text-sm" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase text-black/40">Gender</label>
            <select value={form.gender} onChange={(e) => set("gender", e.target.value as any)} className="w-full rounded-xl border border-black/15 p-2.5 text-sm">
              <option value="">Select</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase text-black/40">Height (cm)</label>
            <input type="number" value={form.heightCm} onChange={(e) => set("heightCm", e.target.value)} className="w-full rounded-xl border border-black/15 p-2.5 text-sm" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase text-black/40">Weight (kg)</label>
            <input type="number" value={form.weightKg} onChange={(e) => set("weightKg", e.target.value)} className="w-full rounded-xl border border-black/15 p-2.5 text-sm" />
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <p className="mb-4 text-xs font-bold uppercase text-black/40">Medical Details</p>
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase text-black/40">Medical Conditions</label>
            <textarea rows={2} value={form.medicalConditions} onChange={(e) => set("medicalConditions", e.target.value)} className="w-full rounded-xl border border-black/15 p-2.5 text-sm" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase text-black/40">Injuries</label>
            <textarea rows={2} value={form.injuries} onChange={(e) => set("injuries", e.target.value)} className="w-full rounded-xl border border-black/15 p-2.5 text-sm" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase text-black/40">Medications</label>
            <textarea rows={2} value={form.medications} onChange={(e) => set("medications", e.target.value)} className="w-full rounded-xl border border-black/15 p-2.5 text-sm" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase text-black/40">Exercise Restrictions</label>
            <textarea rows={2} value={form.exerciseRestrictions} onChange={(e) => set("exerciseRestrictions", e.target.value)} className="w-full rounded-xl border border-black/15 p-2.5 text-sm" />
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <p className="mb-4 text-xs font-bold uppercase text-black/40">Fitness Goal</p>
        <div className="flex flex-wrap gap-2">
          {GOALS.map((g) => (
            <button
              key={g.value}
              type="button"
              onClick={() => set("fitnessGoal", g.value)}
              className={`rounded-xl border px-4 py-2 text-sm font-semibold ${
                form.fitnessGoal === g.value ? "border-brand-yellow bg-brand-yellow/15" : "border-black/15"
              }`}
            >
              {g.label}
            </button>
          ))}
        </div>
      </Card>

      {error && <p className="text-xs text-red-600">{error}</p>}
      <Button loading={busy} onClick={submit}>
        Complete Assessment
      </Button>
    </div>
  );
}

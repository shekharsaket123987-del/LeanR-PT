"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Check, Shuffle } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { createCoachAction } from "@/lib/actions/admin-coach.actions";
import { isFailure } from "@/lib/actions/action-result";
import { COACH_LANGUAGES, COACH_SKILLS } from "@/lib/constants/coach-tags";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const HOUR_GRID = Array.from({ length: 17 }, (_, i) => i + 5); // 5am-9pm, matches booking_window_* settings

interface SlotRow {
  id: number;
  days: number[];
  startTime: string;
}

function formatHour(h: number) {
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:00 ${period}`;
}

function randomPassword() {
  return Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 6).toUpperCase();
}

export default function NewCoachPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [employeeCode, setEmployeeCode] = useState("");
  const [password, setPassword] = useState(randomPassword());
  const [specialization, setSpecialization] = useState<string>(COACH_SKILLS[0]);
  const [extraSkills, setExtraSkills] = useState<string[]>([]);
  const [languages, setLanguages] = useState<string[]>([]);
  const [slots, setSlots] = useState<SlotRow[]>([{ id: 1, days: [], startTime: "06:00" }]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<{ coachId: string } | null>(null);

  function toggleExtraSkill(skill: string) {
    setExtraSkills((prev) => (prev.includes(skill) ? prev.filter((s) => s !== skill) : [...prev, skill]));
  }
  function toggleLanguage(lang: string) {
    setLanguages((prev) => (prev.includes(lang) ? prev.filter((l) => l !== lang) : [...prev, lang]));
  }
  function addSlotRow() {
    setSlots((prev) => [...prev, { id: Date.now(), days: [], startTime: "06:00" }]);
  }
  function removeSlotRow(id: number) {
    setSlots((prev) => prev.filter((s) => s.id !== id));
  }
  function toggleSlotDay(id: number, day: number) {
    setSlots((prev) => prev.map((s) => (s.id === id ? { ...s, days: s.days.includes(day) ? s.days.filter((d) => d !== day) : [...s.days, day] } : s)));
  }
  function updateSlotTime(id: number, time: string) {
    setSlots((prev) => prev.map((s) => (s.id === id ? { ...s, startTime: time } : s)));
  }

  const validSlots = slots.filter((s) => s.days.length > 0);
  const canSubmit = fullName && email && employeeCode && password && languages.length > 0 && validSlots.length > 0;

  async function submit() {
    setSubmitting(true);
    setError("");
    const result = await createCoachAction({
      fullName,
      email,
      password,
      employeeCode,
      specialization,
      skills: extraSkills,
      languages,
      slots: validSlots.map((s) => ({ days: s.days, startTime: s.startTime })),
    });
    setSubmitting(false);
    if (isFailure(result)) {
      setError(result.error.message);
      return;
    }
    setCreated(result.data);
  }

  if (created) {
    return (
      <div className="mx-auto max-w-xl">
        <Card className="p-6">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100">
            <Check className="h-6 w-6 text-emerald-600" />
          </div>
          <p className="text-display text-xl font-bold italic">Coach created</p>
          <p className="mt-2 text-sm text-black/60">
            {fullName} ({employeeCode}) can now log in at <span className="font-mono">/login/coach</span>.
          </p>
          <div className="mt-4 rounded-xl bg-black/[0.03] p-4 text-sm">
            <p>
              <span className="text-black/50">Email:</span> <span className="font-mono">{email}</span>
            </p>
            <p className="mt-1">
              <span className="text-black/50">Password:</span> <span className="font-mono">{password}</span>
            </p>
          </div>
          <p className="mt-3 text-xs text-black/40">Share this password with the coach securely — it won&apos;t be shown again.</p>
          <div className="mt-6 flex gap-3">
            <Button variant="outline" onClick={() => router.push("/admin/coaches")}>
              Back to Coaches
            </Button>
            <Button onClick={() => window.location.reload()}>Add Another Coach</Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Add Coach" description="Create a coach persona: identity, skills, languages, and weekly slot openings." />

      <Card className="p-6">
        <p className="mb-3 text-sm font-bold">Identity</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase text-black/40">Full Name</label>
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. Rahul Sharma"
              className="w-full rounded-xl border border-black/15 p-3 text-sm focus:border-brand-yellow focus:outline-none focus:ring-1 focus:ring-brand-yellow"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase text-black/40">Employee Code</label>
            <input
              value={employeeCode}
              onChange={(e) => setEmployeeCode(e.target.value)}
              placeholder="e.g. E3196"
              className="w-full rounded-xl border border-black/15 p-3 text-sm focus:border-brand-yellow focus:outline-none focus:ring-1 focus:ring-brand-yellow"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase text-black/40">Login Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="rahul@leanr.dev"
              className="w-full rounded-xl border border-black/15 p-3 text-sm focus:border-brand-yellow focus:outline-none focus:ring-1 focus:ring-brand-yellow"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase text-black/40">Temporary Password</label>
            <div className="flex gap-2">
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-black/15 p-3 font-mono text-sm focus:border-brand-yellow focus:outline-none focus:ring-1 focus:ring-brand-yellow"
              />
              <Button type="button" variant="outline" size="sm" onClick={() => setPassword(randomPassword())}>
                <Shuffle className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </Card>

      <Card className="mt-6 p-6">
        <p className="mb-1 text-sm font-bold">Skills</p>
        <p className="mb-3 text-xs text-black/45">Primary specialization, plus any additional skills.</p>
        <label className="mb-1.5 block text-xs font-bold uppercase text-black/40">Primary Specialization</label>
        <select
          value={specialization}
          onChange={(e) => setSpecialization(e.target.value)}
          className="mb-4 w-full rounded-xl border border-black/15 p-3 text-sm focus:border-brand-yellow focus:outline-none focus:ring-1 focus:ring-brand-yellow"
        >
          {COACH_SKILLS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <label className="mb-1.5 block text-xs font-bold uppercase text-black/40">Additional Skills</label>
        <div className="flex flex-wrap gap-2">
          {COACH_SKILLS.filter((s) => s !== specialization).map((s) => (
            <button
              key={s}
              onClick={() => toggleExtraSkill(s)}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
                extraSkills.includes(s) ? "border-brand-yellow bg-brand-yellow/10" : "border-black/10 hover:border-black/25"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </Card>

      <Card className="mt-6 p-6">
        <p className="mb-3 text-sm font-bold">Languages Spoken</p>
        <div className="flex flex-wrap gap-2">
          {COACH_LANGUAGES.map((l) => (
            <button
              key={l}
              onClick={() => toggleLanguage(l)}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
                languages.includes(l) ? "border-brand-yellow bg-brand-yellow/10" : "border-black/10 hover:border-black/25"
              }`}
            >
              {l}
            </button>
          ))}
        </div>
      </Card>

      <Card className="mt-6 p-6">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-bold">Weekly Slot Openings</p>
          <Button variant="outline" size="sm" onClick={addSlotRow}>
            <Plus className="h-3.5 w-3.5" /> Add Slot
          </Button>
        </div>
        <div className="space-y-3">
          {slots.map((slot) => (
            <div key={slot.id} className="rounded-xl border border-black/[0.06] p-4">
              <div className="mb-3 flex items-center justify-between">
                <select
                  value={slot.startTime}
                  onChange={(e) => updateSlotTime(slot.id, e.target.value)}
                  className="rounded-lg border border-black/15 px-2 py-1.5 text-sm"
                >
                  {HOUR_GRID.map((h) => (
                    <option key={h} value={`${String(h).padStart(2, "0")}:00`}>
                      {formatHour(h)}
                    </option>
                  ))}
                </select>
                {slots.length > 1 && (
                  <button onClick={() => removeSlotRow(slot.id)}>
                    <Trash2 className="h-4 w-4 text-black/30 hover:text-red-500" />
                  </button>
                )}
              </div>
              <div className="grid grid-cols-7 gap-1.5">
                {DAY_LABELS.map((label, day) => (
                  <button
                    key={day}
                    onClick={() => toggleSlotDay(slot.id, day)}
                    className={`rounded-lg border py-2 text-[11px] font-bold ${
                      slot.days.includes(day) ? "border-brand-yellow bg-brand-yellow/10" : "border-black/10 hover:border-black/25"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[11px] text-black/40">
          e.g. one row for 1:00 PM · Monday, another for 2:00 PM · Mon–Sat, another for 3:00 PM · Tue/Wed/Fri.
        </p>
      </Card>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      <div className="mt-6 flex justify-end">
        <Button onClick={submit} loading={submitting} disabled={!canSubmit}>
          Create Coach
        </Button>
      </div>
    </div>
  );
}

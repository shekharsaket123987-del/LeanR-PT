"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Shuffle, AlertTriangle, CheckCircle2, Clock, Users2 } from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import {
  createMigratedClientAction,
  checkSlotAvailabilityAction,
  AdminPackageOption,
  AdminCoachOption,
} from "@/lib/actions/admin-clients.actions";
import type { AdminSlotCheckResult } from "@/lib/services/scheduling.service";
import { isFailure } from "@/lib/actions/action-result";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const HOUR_GRID = Array.from({ length: 17 }, (_, i) => i + 5); // 5am-9pm

function formatHour(h: number) {
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:00 ${period}`;
}

function randomPassword() {
  return Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 6).toUpperCase();
}

function slotSignature(coachId: string, days: number[], timeOfDay: string) {
  return `${coachId}|${[...days].sort().join(",")}|${timeOfDay}`;
}

export default function AddClientForm({ packages, coaches }: { packages: AdminPackageOption[]; coaches: AdminCoachOption[] }) {
  const router = useRouter();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState(randomPassword());

  const [packageId, setPackageId] = useState(packages[0]?.id ?? "");
  const [sessionsRemaining, setSessionsRemaining] = useState(packages[0] ? String(packages[0].sessionsCount) : "");
  const [originalPlanSessions, setOriginalPlanSessions] = useState("");
  const [pauseDaysAllowed, setPauseDaysAllowed] = useState(packages[0] ? String(packages[0].defaultPauseDays) : "0");

  const [coachId, setCoachId] = useState(coaches[0]?.id ?? "");
  const [days, setDays] = useState<number[]>([]);
  const [timeOfDay, setTimeOfDay] = useState("06:00");
  const [checking, setChecking] = useState(false);
  const [checkResult, setCheckResult] = useState<AdminSlotCheckResult | null>(null);
  const [checkedSignature, setCheckedSignature] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<{ clientId: string; clientCode: string } | null>(null);

  function onPackageChange(id: string) {
    setPackageId(id);
    const pkg = packages.find((p) => p.id === id);
    if (pkg) {
      setSessionsRemaining(String(pkg.sessionsCount));
      setPauseDaysAllowed(String(pkg.defaultPauseDays));
    }
  }

  function toggleDay(day: number) {
    setDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]));
    setCheckResult(null);
  }

  function onCoachChange(id: string) {
    setCoachId(id);
    setCheckResult(null);
  }

  function onTimeChange(t: string) {
    setTimeOfDay(t);
    setCheckResult(null);
  }

  async function checkAvailability() {
    if (!coachId || days.length === 0) return;
    setChecking(true);
    setError("");
    const result = await checkSlotAvailabilityAction({ coachId, days, timeOfDay });
    setChecking(false);
    if (isFailure(result)) {
      setError(result.error.message);
      return;
    }
    setCheckResult(result.data);
    setCheckedSignature(slotSignature(coachId, days, timeOfDay));
  }

  const wantsSchedule = days.length > 0;
  const currentSignature = slotSignature(coachId, days, timeOfDay);
  const scheduleConfirmed = !wantsSchedule || (checkedSignature === currentSignature && checkResult?.available);
  const canSubmit =
    fullName.trim() &&
    email.trim() &&
    password.trim() &&
    packageId &&
    Number(sessionsRemaining) > 0 &&
    scheduleConfirmed &&
    !submitting;

  async function submit() {
    setSubmitting(true);
    setError("");
    const result = await createMigratedClientAction({
      fullName,
      email,
      password,
      phone: phone || undefined,
      packageId,
      sessionsRemaining: Number(sessionsRemaining),
      originalPlanSessions: originalPlanSessions ? Number(originalPlanSessions) : undefined,
      pauseDaysAllowed: pauseDaysAllowed ? Number(pauseDaysAllowed) : undefined,
      schedule: wantsSchedule ? { coachId, days, timeOfDay } : undefined,
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
      <Card className="p-6">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-400/10">
          <Check className="h-6 w-6 text-emerald-400" />
        </div>
        <p className="text-display text-xl font-bold italic">Client created</p>
        <p className="mt-2 text-sm text-white/60">
          {fullName} ({created.clientCode}) can now log in at <span className="font-mono">/login/client</span>.
        </p>
        <div className="mt-4 rounded-xl bg-white/[0.03] p-4 text-sm">
          <p>
            <span className="text-white/50">Email:</span> <span className="font-mono">{email}</span>
          </p>
          <p className="mt-1">
            <span className="text-white/50">Password:</span> <span className="font-mono">{password}</span>
          </p>
        </div>
        <p className="mt-3 text-xs text-white/40">Share this password with the client securely -- it won&apos;t be shown again.</p>
        <div className="mt-6 flex gap-3">
          <Button variant="outline" onClick={() => router.push(`/admin/clients/${created.clientId}`)}>
            View Client
          </Button>
          <Button onClick={() => window.location.reload()}>Add Another Client</Button>
        </div>
      </Card>
    );
  }

  return (
    <div>
      <Card className="p-6">
        <p className="mb-3 text-sm font-bold">Identity</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase text-white/40">Full Name</label>
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. Priya Nair"
              className="w-full rounded-xl border border-white/15 p-3 text-sm focus:border-brand-yellow focus:outline-none focus:ring-1 focus:ring-brand-yellow"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase text-white/40">Phone (optional)</label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="98765 43210"
              className="w-full rounded-xl border border-white/15 p-3 text-sm focus:border-brand-yellow focus:outline-none focus:ring-1 focus:ring-brand-yellow"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase text-white/40">Login Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="priya@email.com"
              className="w-full rounded-xl border border-white/15 p-3 text-sm focus:border-brand-yellow focus:outline-none focus:ring-1 focus:ring-brand-yellow"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase text-white/40">Temporary Password</label>
            <div className="flex gap-2">
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-white/15 p-3 font-mono text-sm focus:border-brand-yellow focus:outline-none focus:ring-1 focus:ring-brand-yellow"
              />
              <Button type="button" variant="outline" size="sm" onClick={() => setPassword(randomPassword())}>
                <Shuffle className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </Card>

      <Card className="mt-6 p-6">
        <p className="mb-1 text-sm font-bold">Plan</p>
        <p className="mb-3 text-xs text-white/45">
          Sessions Remaining is what this client actually gets in LEANR -- if they&apos;re mid-plan (e.g. enrolled in a 24-session
          package with only 2 left), enter <span className="font-bold text-white/70">2</span>, not 24. Original Plan Size is optional,
          kept only as a note on their timeline for context.
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="sm:col-span-3">
            <label className="mb-1.5 block text-xs font-bold uppercase text-white/40">Plan Name</label>
            <select
              value={packageId}
              onChange={(e) => onPackageChange(e.target.value)}
              className="w-full rounded-xl border border-white/15 p-3 text-sm focus:border-brand-yellow focus:outline-none focus:ring-1 focus:ring-brand-yellow"
            >
              {packages.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.sessionsCount} sessions)
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase text-white/40">Sessions Remaining</label>
            <input
              type="number"
              min={1}
              value={sessionsRemaining}
              onChange={(e) => setSessionsRemaining(e.target.value)}
              className="w-full rounded-xl border border-white/15 p-3 text-sm focus:border-brand-yellow focus:outline-none focus:ring-1 focus:ring-brand-yellow"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase text-white/40">Original Plan Size (optional)</label>
            <input
              type="number"
              min={1}
              value={originalPlanSessions}
              onChange={(e) => setOriginalPlanSessions(e.target.value)}
              placeholder="e.g. 24"
              className="w-full rounded-xl border border-white/15 p-3 text-sm focus:border-brand-yellow focus:outline-none focus:ring-1 focus:ring-brand-yellow"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase text-white/40">Pause Days Allowed</label>
            <input
              type="number"
              min={0}
              value={pauseDaysAllowed}
              onChange={(e) => setPauseDaysAllowed(e.target.value)}
              className="w-full rounded-xl border border-white/15 p-3 text-sm focus:border-brand-yellow focus:outline-none focus:ring-1 focus:ring-brand-yellow"
            />
          </div>
        </div>
      </Card>

      <Card className="mt-6 p-6">
        <p className="mb-1 text-sm font-bold">Coach &amp; Weekly Schedule</p>
        <p className="mb-3 text-xs text-white/45">
          Optional -- leave no days selected to create the client without a schedule yet. Pick days and a time to assign them
          immediately; availability is checked before you can confirm.
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase text-white/40">Coach</label>
            <select
              value={coachId}
              onChange={(e) => onCoachChange(e.target.value)}
              className="w-full rounded-xl border border-white/15 p-3 text-sm focus:border-brand-yellow focus:outline-none focus:ring-1 focus:ring-brand-yellow"
            >
              {coaches.length === 0 && <option value="">No coaches available</option>}
              {coaches.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.specialization ? ` -- ${c.specialization}` : ""}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase text-white/40">Time</label>
            <select
              value={timeOfDay}
              onChange={(e) => onTimeChange(e.target.value)}
              className="w-full rounded-xl border border-white/15 p-3 text-sm focus:border-brand-yellow focus:outline-none focus:ring-1 focus:ring-brand-yellow"
            >
              {HOUR_GRID.map((h) => (
                <option key={h} value={`${String(h).padStart(2, "0")}:00`}>
                  {formatHour(h)}
                </option>
              ))}
            </select>
          </div>
        </div>
        <label className="mb-1.5 mt-4 block text-xs font-bold uppercase text-white/40">Days</label>
        <div className="grid grid-cols-7 gap-1.5">
          {DAY_LABELS.map((label, day) => (
            <button
              key={day}
              type="button"
              onClick={() => toggleDay(day)}
              className={`rounded-lg border py-2 text-[11px] font-bold ${
                days.includes(day) ? "border-brand-yellow bg-brand-yellow/10" : "border-white/10 hover:border-white/25"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {wantsSchedule && (
          <div className="mt-4">
            <Button type="button" variant="outline" size="sm" loading={checking} disabled={!coachId} onClick={checkAvailability}>
              <Clock className="h-3.5 w-3.5" /> Check Availability
            </Button>

            {checkedSignature === currentSignature && checkResult && (
              <div className="mt-3">
                {checkResult.available ? (
                  <div className="flex items-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-400/5 p-3 text-sm text-emerald-400">
                    <CheckCircle2 className="h-4 w-4 shrink-0" /> This coach is free for every selected day at this time.
                  </div>
                ) : (
                  <div className="space-y-3 rounded-xl border border-red-500/30 bg-red-500/5 p-3">
                    <div className="flex items-center gap-2 text-sm text-red-400">
                      <AlertTriangle className="h-4 w-4 shrink-0" /> That coach isn&apos;t free for all selected days at this time.
                    </div>
                    {checkResult.alternativeTimesForSameCoach.length > 0 && (
                      <div>
                        <p className="mb-1.5 text-[11px] font-bold uppercase text-white/40">Other times with this coach</p>
                        <div className="flex flex-wrap gap-1.5">
                          {checkResult.alternativeTimesForSameCoach.map((t) => (
                            <button
                              key={t}
                              type="button"
                              onClick={() => onTimeChange(t)}
                              className="rounded-full border border-white/15 px-3 py-1 text-xs font-semibold hover:border-brand-yellow"
                            >
                              {formatHour(Number(t.slice(0, 2)))}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    {checkResult.alternativeCoaches.length > 0 && (
                      <div>
                        <p className="mb-1.5 flex items-center gap-1 text-[11px] font-bold uppercase text-white/40">
                          <Users2 className="h-3 w-3" /> Other coaches free at this same day/time
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {checkResult.alternativeCoaches.map((c) => (
                            <button
                              key={c.coachId}
                              type="button"
                              onClick={() => onCoachChange(c.coachId)}
                              className="rounded-full border border-white/15 px-3 py-1 text-xs font-semibold hover:border-brand-yellow"
                            >
                              {c.name}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    {checkResult.alternativeTimesForSameCoach.length === 0 && checkResult.alternativeCoaches.length === 0 && (
                      <p className="text-xs text-white/50">No open alternative found for this day pattern -- try a different day.</p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </Card>

      {error && <p className="mt-4 text-sm text-red-400">{error}</p>}

      <div className="mt-6 flex justify-end">
        <Button onClick={submit} loading={submitting} disabled={!canSubmit}>
          Create Client
        </Button>
      </div>
    </div>
  );
}

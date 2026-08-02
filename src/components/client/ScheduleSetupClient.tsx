"use client";

import { useState } from "react";
import Image from "next/image";
import { CalendarClock, Check, Info } from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { ScheduleMatchResult, ScheduleSetupOptions, confirmScheduleAction, matchScheduleAction, reportScheduleUnmatchedAction } from "@/lib/actions/schedule.actions";
import { isFailure } from "@/lib/actions/action-result";
import { PatternKey } from "@/lib/services/scheduling.service";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const PATTERN_OPTIONS: { key: PatternKey; label: string; hint: string }[] = [
  { key: "mwf", label: "Mon / Wed / Fri", hint: "3 sessions a week" },
  { key: "tts", label: "Tue / Thu / Sat", hint: "3 sessions a week" },
  { key: "sixday", label: "6 Days a Week", hint: "Mon–Sat" },
  { key: "custom", label: "Specific Days", hint: "Pick 2–5 days" },
];

function formatHour(h: number) {
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:00 ${period}`;
}

function daysLabel(days: number[]) {
  return [...days].sort((a, b) => a - b).map((d) => DAY_LABELS[d]).join(" / ");
}

export default function ScheduleSetupClient({ options }: { options: ScheduleSetupOptions }) {
  const grid = Array.from({ length: options.endHour - options.startHour }, (_, i) => options.startHour + i);
  const [pattern, setPattern] = useState<PatternKey>("mwf");
  const [preferredTime, setPreferredTime] = useState(`${String(grid[0]).padStart(2, "0")}:00`);
  const [customDays, setCustomDays] = useState<number[]>([]);
  const [checking, setChecking] = useState(false);
  const [checkError, setCheckError] = useState("");
  const [result, setResult] = useState<ScheduleMatchResult | null | undefined>(undefined); // undefined = not checked yet
  const [confirming, setConfirming] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [reportedToAdmin, setReportedToAdmin] = useState(false);

  function toggleCustomDay(day: number) {
    setCustomDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : prev.length < 5 ? [...prev, day] : prev));
  }

  async function checkAvailability() {
    setChecking(true);
    setCheckError("");
    setResult(undefined);
    const res = await matchScheduleAction({
      pattern,
      preferredTime,
      customDays: pattern === "custom" ? customDays : undefined,
    });
    setChecking(false);
    if (isFailure(res)) {
      setCheckError(res.error.message);
      return;
    }
    setResult(res.data);
  }

  async function confirm() {
    if (!result) return;
    setConfirming(true);
    setCheckError("");
    const res = await confirmScheduleAction({ days: result.days, timeOfDay: result.timeOfDay, coachId: result.newCoach?.id });
    setConfirming(false);
    if (isFailure(res)) {
      setCheckError(res.error.message);
      return;
    }
    setConfirmed(true);
  }

  async function notifyOps() {
    await reportScheduleUnmatchedAction();
    setReportedToAdmin(true);
  }

  if (confirmed && result) {
    return (
      <Card className="mx-auto max-w-xl p-6">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100">
          <Check className="h-6 w-6 text-emerald-600" />
        </div>
        <p className="text-display text-xl font-bold italic">Your recurring schedule is set!</p>
        <p className="mt-2 text-sm text-black/60">
          {daysLabel(result.days)} at {formatHour(Number(result.timeOfDay.split(":")[0]))}, with{" "}
          {result.newCoach?.name ?? options.coach?.name}. Your next few sessions have already been added to your calendar.
        </p>
        <Button href="/client/dashboard" className="mt-6">
          Back to Dashboard
        </Button>
      </Card>
    );
  }

  const customValid = pattern !== "custom" || (customDays.length >= 2 && customDays.length <= 5);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {options.coach && (
        <Card className="flex items-center gap-4 p-5">
          <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl">
            <Image src={options.coach.photo} alt={options.coach.name} fill className="object-cover" />
          </div>
          <div>
            <p className="text-sm font-bold">{options.coach.name}</p>
            <p className="text-xs text-black/45">{options.coach.specialization}</p>
          </div>
        </Card>
      )}

      <Card className="p-6">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-black/40">Time</p>
            <select
              value={preferredTime}
              onChange={(e) => {
                setPreferredTime(e.target.value);
                setResult(undefined);
              }}
              className="w-full rounded-xl border border-black/15 p-3 text-sm focus:border-brand-yellow focus:outline-none focus:ring-1 focus:ring-brand-yellow"
            >
              {grid.map((h) => (
                <option key={h} value={`${String(h).padStart(2, "0")}:00`}>
                  {formatHour(h)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-black/40">Days</p>
            <select
              value={pattern}
              onChange={(e) => {
                setPattern(e.target.value as PatternKey);
                setResult(undefined);
              }}
              className="w-full rounded-xl border border-black/15 p-3 text-sm focus:border-brand-yellow focus:outline-none focus:ring-1 focus:ring-brand-yellow"
            >
              {PATTERN_OPTIONS.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {pattern === "custom" && (
          <div className="mt-4">
            <p className="mb-2 text-xs text-black/50">Pick 2–5 days ({customDays.length} selected)</p>
            <div className="grid grid-cols-7 gap-1.5">
              {DAY_LABELS.map((label, day) => (
                <button
                  key={day}
                  onClick={() => {
                    toggleCustomDay(day);
                    setResult(undefined);
                  }}
                  className={`rounded-lg border py-2 text-[11px] font-bold ${
                    customDays.includes(day) ? "border-brand-yellow bg-brand-yellow/10" : "border-black/10 hover:border-black/25"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="mt-6 flex justify-end">
          <Button onClick={checkAvailability} loading={checking} disabled={!customValid}>
            Check Availability
          </Button>
        </div>

        {checkError && <p className="mt-4 text-sm text-red-600">{checkError}</p>}

        {result === null && !reportedToAdmin && (
          <div className="mt-6 rounded-xl border border-dashed border-black/15 p-4">
            <p className="flex items-center gap-2 text-sm font-bold">
              <Info className="h-4 w-4" /> No match found for that option.
            </p>
            <p className="mt-1 text-xs text-black/50">
              {pattern === "custom"
                ? "We tried your selected days at every available hour and couldn't find a fit."
                : options.coach
                ? "We tried this pattern, alternate times, and nearby day pairings. Try picking specific days instead, or let us notify support to help manually."
                : "No coach is free for that exact day/time. Try a different day or time, or let us notify support to help manually."}
            </p>
            <div className="mt-3 flex gap-2">
              {pattern !== "custom" && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setPattern("custom");
                    setResult(undefined);
                  }}
                >
                  Try Specific Days
                </Button>
              )}
              <Button size="sm" variant="destructive-outline" onClick={notifyOps}>
                Notify Support
              </Button>
            </div>
          </div>
        )}

        {reportedToAdmin && <p className="mt-4 text-sm text-black/60">Our operations team has been notified and will follow up shortly.</p>}

        {result && (
          <div className="mt-6 rounded-xl bg-black/[0.03] p-4">
            <p className="flex items-center gap-2 text-sm font-bold">
              <CalendarClock className="h-4 w-4" />
              {result.exact ? "Available as requested" : "Closest available match"}
            </p>
            <p className="mt-1 text-sm text-black/60">
              {daysLabel(result.days)} at {formatHour(Number(result.timeOfDay.split(":")[0]))}
              {result.newCoach && <> — matched with <span className="font-bold">{result.newCoach.name}</span></>}
            </p>
            <Button className="mt-4" onClick={confirm} loading={confirming}>
              Confirm This Schedule
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}

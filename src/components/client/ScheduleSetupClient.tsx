"use client";

import { useState } from "react";
import Image from "next/image";
import { CalendarClock, Check, Info, ChevronLeft } from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import {
  CoachPreference,
  ScheduleMatchResult,
  ScheduleSetupOptions,
  changeScheduleAction,
  confirmScheduleAction,
  matchScheduleAction,
  reportScheduleUnmatchedAction,
} from "@/lib/actions/schedule.actions";
import { isFailure } from "@/lib/actions/action-result";
import { PatternKey } from "@/lib/services/scheduling.service";
import { DAY_LABELS, PAIR_OPTIONS } from "@/lib/constants/scheduling";

const STANDARD_PATTERNS: { key: "mwf" | "tts" | "sixday"; label: string; hint: string }[] = [
  { key: "mwf", label: "Mon / Wed / Fri", hint: "3 sessions a week" },
  { key: "tts", label: "Tue / Thu / Sat", hint: "3 sessions a week" },
  { key: "sixday", label: "6 Days a Week", hint: "Mon–Sat" },
];

const COACH_PREFERENCE_OPTIONS: { key: CoachPreference; label: string; hint: string }[] = [
  { key: "same", label: "Same Trainer", hint: "Keep your current coach" },
  { key: "new", label: "New Trainer", hint: "Match me with someone else" },
  { key: "no_preference", label: "No Preference", hint: "Whoever's free at this time" },
];

// Monday(1)..Saturday(6) only -- Sunday is always a holiday, never offered.
const CUSTOM_DAYS = [1, 2, 3, 4, 5, 6];

type Mode = "standard" | "pair" | "custom";

function formatHour(h: number) {
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:00 ${period}`;
}

function daysLabel(days: number[]) {
  return [...days].sort((a, b) => a - b).map((d) => DAY_LABELS[d]).join(" / ");
}

function samePair(a: number[], b: number[]) {
  return a.length === b.length && [...a].sort().join(",") === [...b].sort().join(",");
}

export default function ScheduleSetupClient({
  options,
  scheduleMode = "setup",
}: {
  options: ScheduleSetupOptions;
  /** "setup": first-time recurring schedule (no coach preference -- the
   * assigned coach carries over). "change": client already has an active
   * pattern and can additionally choose whether to keep, switch, or not
   * care about their trainer. */
  scheduleMode?: "setup" | "change";
}) {
  const grid = Array.from({ length: options.endHour - options.startHour }, (_, i) => options.startHour + i);
  const [mode, setMode] = useState<Mode>("standard");
  const [standardPattern, setStandardPattern] = useState<"mwf" | "tts" | "sixday">("mwf");
  const [selectedPair, setSelectedPair] = useState<number[] | null>(null);
  const [customDays, setCustomDays] = useState<number[]>([]);
  const [preferredTime, setPreferredTime] = useState(`${String(grid[0]).padStart(2, "0")}:00`);
  const [coachPreference, setCoachPreference] = useState<CoachPreference>("same");
  const [checking, setChecking] = useState(false);
  const [checkError, setCheckError] = useState("");
  const [result, setResult] = useState<ScheduleMatchResult | null | undefined>(undefined); // undefined = not checked yet
  const [confirming, setConfirming] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [reportedToAdmin, setReportedToAdmin] = useState(false);

  function resetResult() {
    setResult(undefined);
    setCheckError("");
  }

  function toggleCustomDay(day: number) {
    setCustomDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : prev.length < 5 ? [...prev, day] : prev));
    resetResult();
  }

  function openMoreOptions() {
    setMode("pair");
    setSelectedPair(null);
    setCustomDays([]);
    resetResult();
  }

  function backToStandard() {
    setMode("standard");
    setSelectedPair(null);
    setCustomDays([]);
    resetResult();
  }

  const pattern: PatternKey = mode === "standard" ? standardPattern : "custom";
  const activeDays = mode === "standard" ? undefined : mode === "pair" ? selectedPair ?? undefined : customDays;

  const customValid =
    mode === "standard" ||
    (mode === "pair" && !!selectedPair) ||
    (mode === "custom" && customDays.length >= 2 && customDays.length <= 5);

  async function checkAvailability() {
    setChecking(true);
    setCheckError("");
    setResult(undefined);
    const res = await matchScheduleAction({
      pattern,
      preferredTime,
      customDays: pattern === "custom" ? activeDays : undefined,
      coachPreference: scheduleMode === "change" ? coachPreference : undefined,
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
    const res =
      scheduleMode === "change"
        ? await changeScheduleAction({ days: result.days, timeOfDay: result.timeOfDay, coachId: result.newCoach?.id })
        : await confirmScheduleAction({ days: result.days, timeOfDay: result.timeOfDay, coachId: result.newCoach?.id });
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
        <p className="text-display text-xl font-bold italic">
          {scheduleMode === "change" ? "Your schedule has been updated!" : "Your recurring schedule is set!"}
        </p>
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
        <div className="mb-6">
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-black/40">Time</p>
          <select
            value={preferredTime}
            onChange={(e) => {
              setPreferredTime(e.target.value);
              resetResult();
            }}
            className="w-full max-w-[220px] rounded-xl border border-black/15 p-3 text-sm focus:border-brand-yellow focus:outline-none focus:ring-1 focus:ring-brand-yellow"
          >
            {grid.map((h) => (
              <option key={h} value={`${String(h).padStart(2, "0")}:00`}>
                {formatHour(h)}
              </option>
            ))}
          </select>
        </div>

        {mode === "standard" && (
          <>
            <p className="mb-3 text-xs font-bold uppercase tracking-wide text-black/40">How Many Days a Week?</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {STANDARD_PATTERNS.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => {
                    setStandardPattern(p.key);
                    resetResult();
                  }}
                  className={`rounded-xl border-2 p-4 text-left transition-colors ${
                    standardPattern === p.key ? "border-brand-yellow bg-brand-yellow/10" : "border-black/10 hover:border-black/25"
                  }`}
                >
                  <p className="text-sm font-bold">{p.label}</p>
                  <p className="mt-0.5 text-xs text-black/45">{p.hint}</p>
                </button>
              ))}
            </div>
            <button type="button" onClick={openMoreOptions} className="mt-4 text-xs font-bold text-black/50 underline hover:text-black">
              Not happy with these slots?
            </button>
          </>
        )}

        {mode !== "standard" && (
          <>
            <button type="button" onClick={backToStandard} className="mb-4 flex items-center gap-1 text-xs font-bold text-black/50 hover:text-black">
              <ChevronLeft className="h-3.5 w-3.5" /> Back to standard patterns
            </button>

            <div className="mb-4 flex gap-2 rounded-xl bg-black/5 p-1">
              <button
                type="button"
                onClick={() => {
                  setMode("pair");
                  setCustomDays([]);
                  resetResult();
                }}
                className={`flex-1 rounded-lg px-3 py-2 text-xs font-bold ${mode === "pair" ? "bg-white shadow-card" : "text-black/50"}`}
              >
                2 Days a Week
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode("custom");
                  setSelectedPair(null);
                  resetResult();
                }}
                className={`flex-1 rounded-lg px-3 py-2 text-xs font-bold ${mode === "custom" ? "bg-white shadow-card" : "text-black/50"}`}
              >
                Choose Your Own Days
              </button>
            </div>

            {mode === "pair" && (
              <div>
                <p className="mb-3 text-xs text-black/50">Pick a fixed 2-day-a-week pairing.</p>
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                  {PAIR_OPTIONS.map((pair) => (
                    <button
                      key={pair.join("-")}
                      type="button"
                      onClick={() => {
                        setSelectedPair(pair);
                        resetResult();
                      }}
                      className={`rounded-xl border-2 py-3 text-xs font-bold ${
                        selectedPair && samePair(selectedPair, pair) ? "border-brand-yellow bg-brand-yellow/10" : "border-black/10 hover:border-black/25"
                      }`}
                    >
                      {daysLabel(pair)}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {mode === "custom" && (
              <div>
                <p className="mb-3 text-xs text-black/50">Pick 2–5 days ({customDays.length} selected). Sunday is always off.</p>
                <div className="grid grid-cols-6 gap-1.5">
                  {CUSTOM_DAYS.map((day) => (
                    <button
                      key={day}
                      type="button"
                      onClick={() => toggleCustomDay(day)}
                      className={`rounded-lg border py-2 text-[11px] font-bold ${
                        customDays.includes(day) ? "border-brand-yellow bg-brand-yellow/10" : "border-black/10 hover:border-black/25"
                      }`}
                    >
                      {DAY_LABELS[day]}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {scheduleMode === "change" && (
          <div className="mt-6">
            <p className="mb-3 text-xs font-bold uppercase tracking-wide text-black/40">Trainer Preference</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {COACH_PREFERENCE_OPTIONS.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => {
                    setCoachPreference(p.key);
                    resetResult();
                  }}
                  className={`rounded-xl border-2 p-4 text-left transition-colors ${
                    coachPreference === p.key ? "border-brand-yellow bg-brand-yellow/10" : "border-black/10 hover:border-black/25"
                  }`}
                >
                  <p className="text-sm font-bold">{p.label}</p>
                  <p className="mt-0.5 text-xs text-black/45">{p.hint}</p>
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
              {mode !== "standard"
                ? "We tried this option at every available hour and couldn't find a fit."
                : options.coach
                ? "We tried this pattern, alternate times, and nearby day pairings. Try a 2-day pairing or your own specific days instead, or let us notify support to help manually."
                : "No coach is free for that exact day/time. Try a different day or time, or let us notify support to help manually."}
            </p>
            <div className="mt-3 flex gap-2">
              {mode === "standard" && (
                <Button size="sm" variant="outline" onClick={openMoreOptions}>
                  Try Other Options
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
              {scheduleMode === "change" ? "Save New Schedule" : "Confirm This Schedule"}
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import {
  Sparkles,
  CalendarDays,
  Check,
  ChevronRight,
  Clock,
  BellRing,
  CalendarPlus,
  Info,
} from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge, { AssessmentBadge } from "@/components/ui/Badge";
import { clients, getCoach } from "@/lib/mock-data";

type Step = "intro" | "schedule" | "confirm" | "done";

const simplePatterns = [
  { id: "mwf", label: "Mon / Wed / Fri", time: "6:30 PM", days: ["Mon", "Wed", "Fri"] },
  { id: "tts", label: "Tue / Thu / Sat", time: "7:00 AM", days: ["Tue", "Thu", "Sat"] },
];

const twoDayCombos = [
  { id: "mt", label: "Mon / Thu", time: "6:00 PM" },
  { id: "wt", label: "Wed / Sat", time: "8:00 AM" },
];

const dailyOption = { id: "daily", label: "Every Weekday", time: "6:30 PM" };

export default function BookSessionPage() {
  const [previewMode, setPreviewMode] = useState<"existing" | "new">("existing");
  const [step, setStep] = useState<Step>("intro");
  const [revealLevel, setRevealLevel] = useState(0); // 0 simple, 1 two-day, 2 daily, 3 custom
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [reminderOptIn, setReminderOptIn] = useState(true);

  const client = clients[0];
  const coach = getCoach(client.coachId);
  const isFirstSession = previewMode === "new";

  function confirmBooking() {
    setStep("confirm");
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Book a Session" description="A few quick steps and you're on the calendar." />

      <div className="mb-6 flex items-center gap-2 rounded-xl border border-dashed border-black/15 bg-white px-4 py-2.5 text-xs text-black/50">
        <Info className="h-3.5 w-3.5 shrink-0" />
        Reviewer preview:
        <button
          onClick={() => { setPreviewMode("existing"); setStep("intro"); }}
          className={`rounded-full px-2.5 py-1 font-bold ${previewMode === "existing" ? "bg-black text-white" : "hover:bg-black/5"}`}
        >
          Returning client
        </button>
        <button
          onClick={() => { setPreviewMode("new"); setStep("intro"); }}
          className={`rounded-full px-2.5 py-1 font-bold ${previewMode === "new" ? "bg-black text-white" : "hover:bg-black/5"}`}
        >
          First-ever session
        </button>
      </div>

      {/* Step indicator */}
      <div className="mb-8 flex items-center gap-2">
        {["intro", "schedule", "confirm"].map((s, i) => (
          <div key={s} className="flex flex-1 items-center gap-2">
            <div
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                step === s || (step === "done" && i <= 2)
                  ? "bg-brand-yellow text-black"
                  : ["schedule", "confirm", "done"].indexOf(step) > i
                  ? "bg-black text-white"
                  : "bg-black/10 text-black/40"
              }`}
            >
              {["schedule", "confirm", "done"].indexOf(step) > i ? <Check className="h-3.5 w-3.5" /> : i + 1}
            </div>
            {i < 2 && <div className="h-0.5 flex-1 bg-black/10" />}
          </div>
        ))}
      </div>

      {step === "intro" && isFirstSession && (
        <Card className="border-2 border-brand-yellow p-6">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-yellow">
              <Sparkles className="h-6 w-6 text-black" />
            </div>
            <div>
              <div className="mb-1"><AssessmentBadge /></div>
              <p className="text-display text-xl font-bold italic">Your Free Assessment Session</p>
              <p className="mt-2 text-sm text-black/60">
                Since this is your first session with LEANR, we'll start with a free physical assessment. Your coach
                will evaluate your mobility, strength baseline, and goals to build your program — this session
                doesn't count against your package.
              </p>
            </div>
          </div>
          <div className="mt-6 flex justify-end">
            <Button onClick={() => setStep("schedule")}>
              Continue <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </Card>
      )}

      {step === "intro" && !isFirstSession && coach && (
        <Card className="p-6">
          <p className="mb-4 text-xs font-bold uppercase tracking-wide text-black/40">Your Coach</p>
          <div className="flex items-center gap-4">
            <div className="relative h-16 w-16 overflow-hidden rounded-2xl">
              <Image src={coach.photo} alt={coach.name} fill className="object-cover" />
            </div>
            <div className="flex-1">
              <p className="text-display text-xl font-bold italic">{coach.name}</p>
              <p className="text-sm text-black/50">{coach.specialization}</p>
            </div>
            <Badge variant="green">★ {coach.rating}</Badge>
          </div>
          <p className="mt-4 rounded-xl bg-black/[0.03] p-3 text-xs text-black/50">
            You're booking with your assigned coach. Coach continuity is core to your plan — need a change?{" "}
            <a href="/client/coach" className="font-bold text-black underline">
              Request a coach change
            </a>
            .
          </p>
          <div className="mt-6 flex justify-end">
            <Button onClick={() => setStep("schedule")}>
              Continue <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </Card>
      )}

      {step === "schedule" && (
        <Card className="p-6">
          <p className="mb-1 text-xs font-bold uppercase tracking-wide text-black/40">Pick a schedule</p>
          <p className="mb-5 text-sm text-black/50">Choose a recurring pattern that fits your week.</p>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {simplePatterns.map((p) => (
              <button
                key={p.id}
                onClick={() => setSelectedSlot(p.id)}
                className={`rounded-xl border-2 p-4 text-left transition-colors ${
                  selectedSlot === p.id ? "border-brand-yellow bg-brand-yellow/10" : "border-black/10 hover:border-black/25"
                }`}
              >
                <CalendarDays className="mb-2 h-5 w-5 text-black/60" />
                <p className="text-sm font-bold">{p.label}</p>
                <p className="text-xs text-black/45">{p.time} · matches open coach slots</p>
              </button>
            ))}
          </div>

          {revealLevel >= 1 && (
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 animate-fade-in">
              {twoDayCombos.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setSelectedSlot(p.id)}
                  className={`rounded-xl border-2 p-4 text-left transition-colors ${
                    selectedSlot === p.id ? "border-brand-yellow bg-brand-yellow/10" : "border-black/10 hover:border-black/25"
                  }`}
                >
                  <CalendarDays className="mb-2 h-5 w-5 text-black/60" />
                  <p className="text-sm font-bold">{p.label}</p>
                  <p className="text-xs text-black/45">{p.time} · matches open coach slots</p>
                </button>
              ))}
            </div>
          )}

          {revealLevel >= 2 && (
            <button
              onClick={() => setSelectedSlot(dailyOption.id)}
              className={`mt-4 w-full rounded-xl border-2 p-4 text-left transition-colors animate-fade-in ${
                selectedSlot === dailyOption.id ? "border-brand-yellow bg-brand-yellow/10" : "border-black/10 hover:border-black/25"
              }`}
            >
              <Clock className="mb-2 h-5 w-5 text-black/60" />
              <p className="text-sm font-bold">{dailyOption.label}</p>
              <p className="text-xs text-black/45">{dailyOption.time} · matches open coach slots</p>
            </button>
          )}

          {revealLevel >= 3 && (
            <div className="mt-4 animate-fade-in rounded-xl border-2 border-dashed border-black/15 p-4">
              <p className="mb-3 text-sm font-bold">Fully custom schedule</p>
              <div className="grid grid-cols-7 gap-1.5">
                {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
                  <button
                    key={d}
                    onClick={() => setSelectedSlot(`custom-${d}`)}
                    className={`rounded-lg border py-2 text-[11px] font-bold ${
                      selectedSlot === `custom-${d}` ? "border-brand-yellow bg-brand-yellow/10" : "border-black/10 hover:border-black/25"
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-[11px] text-black/40">Only showing slots {coach?.name.split(" ")[0] ?? "your coach"} has open.</p>
            </div>
          )}

          {revealLevel < 3 && (
            <button
              onClick={() => setRevealLevel((l) => Math.min(l + 1, 3))}
              className="mt-4 text-sm font-semibold text-black/50 underline hover:text-black"
            >
              Need something else?
            </button>
          )}

          <div className="mt-7 flex justify-between">
            <Button variant="outline" onClick={() => setStep("intro")}>
              Back
            </Button>
            <Button onClick={confirmBooking} disabled={!selectedSlot}>
              Confirm Schedule <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </Card>
      )}

      {step === "confirm" && (
        <Card className="p-6">
          <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100">
            <Check className="h-7 w-7 text-emerald-600" />
          </div>
          <p className="text-display text-2xl font-bold italic">You're all set!</p>
          <p className="mt-1 text-sm text-black/50">
            {isFirstSession ? "Your free assessment session" : "Your session"} has been booked with{" "}
            {coach?.name ?? "your coach"}.
          </p>

          <div className="mt-6 rounded-xl bg-black/[0.03] p-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-black/50">Coach</span>
              <span className="font-bold">{coach?.name}</span>
            </div>
            <div className="mt-2 flex items-center justify-between text-sm">
              <span className="text-black/50">Schedule</span>
              <span className="font-bold">
                {[...simplePatterns, ...twoDayCombos, dailyOption].find((p) => p.id === selectedSlot)?.label ?? "Custom schedule"}
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between text-sm">
              <span className="text-black/50">Session type</span>
              <span className="font-bold">{isFirstSession ? "Assessment (Free)" : "Regular"}</span>
            </div>
          </div>

          <label className="mt-5 flex items-center gap-3 rounded-xl border border-black/10 p-4">
            <input
              type="checkbox"
              checked={reminderOptIn}
              onChange={(e) => setReminderOptIn(e.target.checked)}
              className="h-4 w-4 accent-brand-yellow"
            />
            <BellRing className="h-4 w-4 text-black/50" />
            <span className="text-sm">Add to calendar &amp; send me reminders</span>
          </label>

          <div className="mt-7 flex justify-end gap-3">
            <Button variant="outline" href="/client/dashboard">
              Back to Dashboard
            </Button>
            <Button href="/client/sessions">
              <CalendarPlus className="h-4 w-4" />
              View My Sessions
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import Image from "next/image";
import { Sparkles, CalendarDays, Check, ChevronRight, BellRing, CalendarPlus, AlertCircle } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge, { AssessmentBadge } from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import { formatDate, formatTime } from "@/lib/utils";
import { BookingOptions, confirmBookingAction } from "@/lib/actions/client-portal.actions";
import { isFailure } from "@/lib/actions/action-result";

type Step = "intro" | "schedule" | "confirm";

export default function BookSessionClient({ options }: { options: BookingOptions }) {
  const [step, setStep] = useState<Step>("intro");
  const [selectedSlot, setSelectedSlot] = useState<{ start: string; end: string } | null>(null);
  const [reminderOptIn, setReminderOptIn] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState("");
  const [bookedId, setBookedId] = useState<string | null>(null);

  const { coach, isFirstSession, sessionType, durationMinutes, slots } = options;

  async function confirmBooking() {
    if (!selectedSlot) return;
    setConfirming(true);
    setConfirmError("");
    const result = await confirmBookingAction({
      slotStart: selectedSlot.start,
      durationMinutes,
      sessionType,
    });
    setConfirming(false);
    if (isFailure(result)) {
      setConfirmError(result.error.message);
      return;
    }
    setBookedId(result.data.bookingId);
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Book a Session" description="A few quick steps and you're on the calendar." />

      {/* Step indicator */}
      <div className="mb-8 flex items-center gap-2">
        {["intro", "schedule", "confirm"].map((s, i) => (
          <div key={s} className="flex flex-1 items-center gap-2">
            <div
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                step === s
                  ? "bg-brand-yellow text-black"
                  : ["schedule", "confirm"].indexOf(step) > i
                  ? "bg-black text-white"
                  : "bg-black/10 text-black/40"
              }`}
            >
              {["schedule", "confirm"].indexOf(step) > i || (step === "confirm" && bookedId) ? <Check className="h-3.5 w-3.5" /> : i + 1}
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
                Since this is your first session with LEANR, we&apos;ll start with a free physical assessment. Your
                coach will evaluate your mobility, strength baseline, and goals to build your program — this session
                doesn&apos;t count against your package.
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

      {step === "intro" && !isFirstSession && (
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
            You&apos;re booking with your assigned coach. Coach continuity is core to your plan — need a change?{" "}
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
          <p className="mb-1 text-xs font-bold uppercase tracking-wide text-black/40">Pick a time</p>
          <p className="mb-5 text-sm text-black/50">Showing {coach.name.split(" ")[0]}&apos;s next open slots.</p>

          {slots.length === 0 && (
            <EmptyState icon={CalendarDays} title="No open slots in the next 2 weeks" description="Check back soon, or contact support to find another time." />
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {slots.map((slot) => (
              <button
                key={slot.start}
                onClick={() => setSelectedSlot(slot)}
                className={`rounded-xl border-2 p-4 text-left transition-colors ${
                  selectedSlot?.start === slot.start ? "border-brand-yellow bg-brand-yellow/10" : "border-black/10 hover:border-black/25"
                }`}
              >
                <CalendarDays className="mb-2 h-5 w-5 text-black/60" />
                <p className="text-sm font-bold">{formatDate(slot.start)}</p>
                <p className="text-xs text-black/45">{formatTime(slot.start)} · {durationMinutes} min</p>
              </button>
            ))}
          </div>

          <div className="mt-7 flex justify-between">
            <Button variant="outline" onClick={() => setStep("intro")}>
              Back
            </Button>
            <Button onClick={() => setStep("confirm")} disabled={!selectedSlot}>
              Confirm Schedule <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </Card>
      )}

      {step === "confirm" && !bookedId && selectedSlot && (
        <Card className="p-6">
          <p className="mb-1 text-xs font-bold uppercase tracking-wide text-black/40">Review &amp; confirm</p>
          <div className="mt-4 rounded-xl bg-black/[0.03] p-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-black/50">Coach</span>
              <span className="font-bold">{coach.name}</span>
            </div>
            <div className="mt-2 flex items-center justify-between text-sm">
              <span className="text-black/50">When</span>
              <span className="font-bold">
                {formatDate(selectedSlot.start)} · {formatTime(selectedSlot.start)}
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

          {confirmError && (
            <p className="mt-4 flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-600">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              {confirmError}
            </p>
          )}

          <div className="mt-7 flex justify-between">
            <Button variant="outline" onClick={() => setStep("schedule")} disabled={confirming}>
              Back
            </Button>
            <Button onClick={confirmBooking} loading={confirming}>
              Confirm Booking
            </Button>
          </div>
        </Card>
      )}

      {step === "confirm" && bookedId && selectedSlot && (
        <Card className="p-6">
          <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100">
            <Check className="h-7 w-7 text-emerald-600" />
          </div>
          <p className="text-display text-2xl font-bold italic">You&apos;re all set!</p>
          <p className="mt-1 text-sm text-black/50">
            {isFirstSession ? "Your free assessment session" : "Your session"} has been booked with {coach.name}.
          </p>

          <div className="mt-6 rounded-xl bg-black/[0.03] p-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-black/50">Coach</span>
              <span className="font-bold">{coach.name}</span>
            </div>
            <div className="mt-2 flex items-center justify-between text-sm">
              <span className="text-black/50">When</span>
              <span className="font-bold">
                {formatDate(selectedSlot.start)} · {formatTime(selectedSlot.start)}
              </span>
            </div>
          </div>

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

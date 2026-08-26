"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { rateSessionAction } from "@/lib/actions/client-portal.actions";
import { isFailure } from "@/lib/actions/action-result";

function StarPicker({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex justify-center gap-2">
      {[1, 2, 3, 4, 5].map((i) => (
        <button key={i} type="button" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(0)} onClick={() => onChange(i)}>
          <Star
            className="h-7 w-7 transition-colors"
            fill={(hover || value) >= i ? "#F5D90A" : "none"}
            stroke={(hover || value) >= i ? "#F5D90A" : "#FFFFFF30"}
          />
        </button>
      ))}
    </div>
  );
}

/** Gates "Choose a Plan" behind rating the demo -- shown only once the demo
 * is actually done (stage === "demo_completed"). Rating is skippable (the
 * business still wants the client to reach the plans page either way), it
 * just isn't the default path anymore. Sessions with no rating to give
 * (missed demo, or already rated from a prior visit) skip straight to the
 * plan CTA. */
export default function DemoFeedbackGateClient({
  bookingId,
  coachName,
  canRate,
}: {
  bookingId: string;
  coachName: string;
  canRate: boolean;
}) {
  const [done, setDone] = useState(!canRate);
  const [qualityRating, setQualityRating] = useState(0);
  const [trainerRating, setTrainerRating] = useState(0);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit() {
    setSubmitting(true);
    setError("");
    const result = await rateSessionAction(bookingId, qualityRating, trainerRating, note);
    setSubmitting(false);
    if (isFailure(result)) {
      setError(result.error.message);
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <Card className="flex flex-col items-center gap-3 p-8 text-center">
        <p className="text-sm font-bold">Ready when you are</p>
        <p className="max-w-sm text-sm text-white/50">Choose a plan to start booking ongoing sessions with your coach.</p>
        <Button href="/client/plans" className="mt-2">
          Choose Your Plan
        </Button>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <p className="text-center text-sm font-bold">How was your demo with {coachName}?</p>
      <div className="mx-auto mt-5 max-w-xs">
        <div className="mb-5">
          <p className="mb-2 text-center text-sm font-semibold text-white/70">How was the session overall?</p>
          <StarPicker value={qualityRating} onChange={setQualityRating} />
        </div>
        <div className="mb-5">
          <p className="mb-2 text-center text-sm font-semibold text-white/70">How was {coachName}?</p>
          <StarPicker value={trainerRating} onChange={setTrainerRating} />
        </div>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          placeholder="Anything you'd like to share? (optional)"
          className="w-full rounded-xl border border-white/15 p-3 text-sm focus:border-brand-yellow focus:outline-none focus:ring-1 focus:ring-brand-yellow"
        />
        {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
        <div className="mt-5 flex gap-3">
          <Button variant="outline" className="flex-1" onClick={() => setDone(true)} disabled={submitting}>
            Skip
          </Button>
          <Button className="flex-1" disabled={!qualityRating || !trainerRating} loading={submitting} onClick={handleSubmit}>
            Submit
          </Button>
        </div>
      </div>
    </Card>
  );
}

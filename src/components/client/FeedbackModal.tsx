"use client";
import { useState } from "react";
import { Star } from "lucide-react";
import Modal from "../ui/Modal";
import Button from "../ui/Button";

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

export default function FeedbackModal({
  open,
  onClose,
  coachName,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  coachName?: string;
  onSubmit?: (qualityRating: number, trainerRating: number, note: string) => Promise<void>;
}) {
  const [qualityRating, setQualityRating] = useState(0);
  const [trainerRating, setTrainerRating] = useState(0);
  const [note, setNote] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  function reset() {
    setSubmitted(false);
    setQualityRating(0);
    setTrainerRating(0);
    setNote("");
    setError("");
  }

  async function handleSubmit() {
    if (!onSubmit) {
      setSubmitted(true);
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await onSubmit(qualityRating, trainerRating, note);
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't submit feedback");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onClose={() => { onClose(); reset(); }} title="Rate Your Session" maxWidth="max-w-sm">
      {!submitted ? (
        <>
          <div className="mb-5">
            <p className="mb-2 text-center text-sm font-semibold text-white/70">How was the session overall?</p>
            <StarPicker value={qualityRating} onChange={setQualityRating} />
          </div>
          <div className="mb-5">
            <p className="mb-2 text-center text-sm font-semibold text-white/70">How was {coachName ?? "your coach"}?</p>
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
          <Button className="mt-5 w-full" disabled={!qualityRating || !trainerRating} loading={submitting} onClick={handleSubmit}>
            Submit Feedback
          </Button>
        </>
      ) : (
        <div className="py-6 text-center">
          <p className="text-display text-xl font-bold italic">Thanks for the feedback!</p>
          <p className="mt-1 text-sm text-white/50">It helps us keep every session on track.</p>
        </div>
      )}
    </Modal>
  );
}

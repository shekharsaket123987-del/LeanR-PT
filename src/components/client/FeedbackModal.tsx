"use client";
import { useState } from "react";
import { Star } from "lucide-react";
import Modal from "../ui/Modal";
import Button from "../ui/Button";

export default function FeedbackModal({
  open,
  onClose,
  coachName,
}: {
  open: boolean;
  onClose: () => void;
  coachName?: string;
}) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [feedback, setFeedback] = useState("");
  const [submitted, setSubmitted] = useState(false);

  return (
    <Modal open={open} onClose={() => { onClose(); setSubmitted(false); }} title="Rate Your Session" maxWidth="max-w-sm">
      {!submitted ? (
        <>
          <p className="mb-4 text-sm text-black/50">How was your session with {coachName ?? "your coach"}?</p>
          <div className="mb-5 flex justify-center gap-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <button
                key={i}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(0)}
                onClick={() => setRating(i)}
              >
                <Star
                  className="h-8 w-8 transition-colors"
                  fill={(hover || rating) >= i ? "#F5E400" : "none"}
                  stroke={(hover || rating) >= i ? "#F5E400" : "#00000030"}
                />
              </button>
            ))}
          </div>
          <textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            rows={3}
            placeholder="Anything you'd like to share? (optional)"
            className="w-full rounded-xl border border-black/15 p-3 text-sm focus:border-brand-yellow focus:outline-none focus:ring-1 focus:ring-brand-yellow"
          />
          <Button className="mt-5 w-full" disabled={!rating} onClick={() => setSubmitted(true)}>
            Submit Feedback
          </Button>
        </>
      ) : (
        <div className="py-6 text-center">
          <p className="text-display text-xl font-bold italic">Thanks for the feedback!</p>
          <p className="mt-1 text-sm text-black/50">It helps us keep every session on track.</p>
        </div>
      )}
    </Modal>
  );
}

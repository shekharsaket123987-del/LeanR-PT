"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, X } from "lucide-react";
import Button from "@/components/ui/Button";

/** Daily nudge once the client's active plan is running low on sessions --
 * same no-backdrop-dismiss shape as MeasurementGateModal (Skip for now vs. a
 * primary action), but "Renew Now" routes straight to the plans page instead
 * of embedding a form. No persisted "dismissed" flag, so it reappears every
 * login while still low, same as the measurement gate. */
export default function SessionsLowGateModal({
  initiallyLow,
  sessionsRemaining,
}: {
  initiallyLow: boolean;
  sessionsRemaining: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(initiallyLow);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" />
      <div className="relative w-full max-w-md rounded-2xl bg-bg-elevated p-6 shadow-2xl animate-slide-up">
        <div className="mb-1 flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-yellow/15">
            <AlertTriangle className="h-4.5 w-4.5" style={{ height: 18, width: 18 }} />
          </div>
          <h3 className="text-display text-xl font-bold italic">Running low on sessions</h3>
        </div>
        <p className="mb-6 text-sm text-white/50">
          You have {sessionsRemaining} session{sessionsRemaining === 1 ? "" : "s"} left on your current plan. Renew now to keep
          training with your coach without a gap.
        </p>

        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="flex items-center gap-1.5 text-xs font-semibold text-white/40 hover:text-white/60"
          >
            <X className="h-3.5 w-3.5" />
            Skip for now
          </button>
          <Button onClick={() => router.push("/client/plans")}>Renew Now</Button>
        </div>
      </div>
    </div>
  );
}

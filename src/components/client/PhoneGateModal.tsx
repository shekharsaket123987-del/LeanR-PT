"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Phone } from "lucide-react";
import Button from "@/components/ui/Button";
import { setMyPhoneAction } from "@/lib/actions/client-profile.actions";
import { isFailure } from "@/lib/actions/action-result";

const PHONE_PATTERN = /^\+?[0-9]{10,15}$/;

function normalizePhone(raw: string) {
  return raw.replace(/[\s\-()]/g, "");
}

/** Google sign-in never collects a phone number (GoogleAuthButton.tsx skips
 * straight to OAuth, no form step) -- SignupForm.tsx's manual-signup path
 * now requires one, but that leaves Google-created accounts with
 * profiles.phone still null. This closes that gap on portal entry, same
 * "gate modal" pattern as MeasurementGateModal, except not skippable: a
 * phone number is how session-status emails/texts reach the client at all,
 * not a recurring nudge, so there's no "Skip for now" here. */
export default function PhoneGateModal({ missing }: { missing: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(missing);
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (!open) return null;

  async function submit() {
    setError("");
    const normalized = normalizePhone(phone);
    if (!PHONE_PATTERN.test(normalized)) {
      setError("Enter a valid mobile number (10-15 digits).");
      return;
    }
    setBusy(true);
    const result = await setMyPhoneAction(normalized);
    setBusy(false);
    if (isFailure(result)) {
      setError(result.error.message);
      return;
    }
    setOpen(false);
    router.refresh();
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" />
      <div className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl animate-slide-up">
        <div className="mb-1 flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-yellow/15">
            <Phone className="h-4.5 w-4.5" style={{ height: 18, width: 18 }} />
          </div>
          <h3 className="text-display text-xl font-bold italic">Add your mobile number</h3>
        </div>
        <p className="mb-5 text-sm text-black/50">
          We use this to text you session updates (bookings, reschedules, attendance). Required for every LEANR account.
        </p>

        <input
          type="tel"
          autoFocus
          placeholder="98765 43210"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="w-full rounded-xl border border-black/15 p-3 text-sm"
        />
        {error && <p className="mt-3 text-xs text-red-600">{error}</p>}

        <Button loading={busy} onClick={submit} className="mt-5 w-full">
          Save & Continue
        </Button>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Mail, Lock, User, Phone, ArrowRight, ShieldCheck } from "lucide-react";
import Button from "../ui/Button";
import GoogleAuthButton from "./GoogleAuthButton";
import { supabase } from "@/lib/supabase";

const PHONE_PATTERN = /^\+?[0-9]{10,15}$/;

function normalizePhone(raw: string) {
  return raw.replace(/[\s\-()]/g, "");
}

/** New-client self-service signup. Previously there was no way for a
 * genuinely new visitor to reach the app at all -- every login page said
 * "Welcome back" and required credentials nobody without an account could
 * have; accounts only ever got created manually via the Supabase dashboard.
 * Coach/admin accounts still aren't self-serve here (unchanged, ops-
 * provisioned by design), only clients.
 *
 * Email + phone are mandatory here (not just for paying clients -- this is
 * the same form a demo-only prospect goes through too, since
 * demoBooking.service.ts requires an existing client account). A manually
 * typed email is unverified until proven otherwise, so this now runs
 * Supabase's own signup-OTP flow (signUp -> verifyOtp) instead of trusting
 * the address at face value -- Google sign-in skips this since Google has
 * already verified that address. Requires "Confirm email" turned on in the
 * Supabase dashboard's Auth settings, and the "Confirm signup" email
 * template edited to surface {{ .Token }}; without both, signUp() below
 * returns a session immediately and this component's OTP step never shows.
 */
export default function SignupForm() {
  const router = useRouter();
  const [step, setStep] = useState<"form" | "otp">("form");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [resendCooldown, setResendCooldown] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    const normalizedPhone = normalizePhone(phone);
    if (!PHONE_PATTERN.test(normalizedPhone)) {
      setError("Enter a valid mobile number (10-15 digits).");
      return;
    }

    setLoading(true);
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { role: "client", full_name: fullName, phone: normalizedPhone } },
    });

    if (signUpError) {
      setLoading(false);
      setError(signUpError.message);
      return;
    }

    if (data.session) {
      // "Confirm email" is off in the Supabase project -- signed in
      // immediately, no OTP round-trip possible. See the component doc
      // comment above for what to turn on to enable it.
      router.push("/client/plans");
      return;
    }

    setLoading(false);
    setStep("otp");
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (otp.trim().length < 6) {
      setError("Enter the 6-digit code from your email.");
      return;
    }

    setLoading(true);
    const { error: verifyError } = await supabase.auth.verifyOtp({ email, token: otp.trim(), type: "signup" });
    setLoading(false);

    if (verifyError) {
      setError(verifyError.message);
      return;
    }
    router.push("/client/plans");
  }

  async function handleResend() {
    if (resendCooldown) return;
    setError("");
    const { error: resendError } = await supabase.auth.resend({ type: "signup", email });
    if (resendError) {
      setError(resendError.message);
      return;
    }
    setResendCooldown(true);
    setTimeout(() => setResendCooldown(false), 30_000);
  }

  if (step === "otp") {
    return (
      <div className="w-full max-w-sm rounded-2xl border border-white/15 bg-white/5 p-6 text-center">
        <ShieldCheck className="mx-auto mb-3 h-8 w-8 text-brand-yellow" />
        <p className="text-sm font-bold text-white">Verify your email</p>
        <p className="mt-1.5 text-xs text-white/50">
          We&apos;ve sent a 6-digit code to <span className="text-white/80">{email}</span>. Enter it below to confirm your account.
        </p>
        <form onSubmit={handleVerifyOtp} className="mt-5 text-left">
          <input
            type="text"
            inputMode="numeric"
            autoFocus
            maxLength={6}
            placeholder="000000"
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
            className="w-full rounded-xl border border-white/15 bg-white/5 py-3 text-center text-lg font-bold tracking-[0.4em] text-white placeholder:text-white/25 focus:border-brand-yellow focus:outline-none focus:ring-1 focus:ring-brand-yellow"
          />
          {error && (
            <p className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">{error}</p>
          )}
          <Button type="submit" size="lg" className="mt-4 w-full" loading={loading} disabled={loading}>
            {!loading && (
              <>
                Verify & Continue <ArrowRight className="h-4 w-4" />
              </>
            )}
            {loading && "Verifying..."}
          </Button>
          <button
            type="button"
            onClick={handleResend}
            disabled={resendCooldown}
            className="mt-3 w-full text-center text-xs font-semibold text-brand-yellow hover:underline disabled:cursor-not-allowed disabled:text-white/30 disabled:no-underline"
          >
            {resendCooldown ? "Code resent -- check your inbox" : "Didn't get it? Resend code"}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm">
      <GoogleAuthButton />

      <div className="my-6 flex items-center gap-3">
        <div className="h-px flex-1 bg-white/10" />
        <span className="text-[11px] font-semibold uppercase tracking-wide text-white/30">or</span>
        <div className="h-px flex-1 bg-white/10" />
      </div>

      <form onSubmit={handleSubmit}>
      <div className="mb-5">
        <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-white/50">Full Name</label>
        <div className="relative">
          <User className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
          <input
            type="text"
            required
            placeholder="Your name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full rounded-xl border border-white/15 bg-white/5 py-3 pl-10 pr-4 text-sm text-white placeholder:text-white/25 focus:border-brand-yellow focus:outline-none focus:ring-1 focus:ring-brand-yellow"
          />
        </div>
      </div>
      <div className="mb-5">
        <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-white/50">Email</label>
        <div className="relative">
          <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
          <input
            type="email"
            required
            placeholder="you@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl border border-white/15 bg-white/5 py-3 pl-10 pr-4 text-sm text-white placeholder:text-white/25 focus:border-brand-yellow focus:outline-none focus:ring-1 focus:ring-brand-yellow"
          />
        </div>
      </div>
      <div className="mb-5">
        <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-white/50">Mobile Number</label>
        <div className="relative">
          <Phone className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
          <input
            type="tel"
            required
            placeholder="98765 43210"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full rounded-xl border border-white/15 bg-white/5 py-3 pl-10 pr-4 text-sm text-white placeholder:text-white/25 focus:border-brand-yellow focus:outline-none focus:ring-1 focus:ring-brand-yellow"
          />
        </div>
        <p className="mt-1.5 text-[11px] text-white/35">We&apos;ll text you session updates here -- required for every account.</p>
      </div>
      <div className="mb-6">
        <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-white/50">Password</label>
        <div className="relative">
          <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
          <input
            type="password"
            required
            minLength={8}
            placeholder="At least 8 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl border border-white/15 bg-white/5 py-3 pl-10 pr-4 text-sm text-white placeholder:text-white/25 focus:border-brand-yellow focus:outline-none focus:ring-1 focus:ring-brand-yellow"
          />
        </div>
      </div>
      {error && (
        <p className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">{error}</p>
      )}
      <Button type="submit" size="lg" className="w-full" loading={loading} disabled={loading}>
        {!loading && (
          <>
            Create Account <ArrowRight className="h-4 w-4" />
          </>
        )}
        {loading && "Creating account..."}
      </Button>
      <p className="mt-5 text-center text-xs text-white/40">
        Already have an account?{" "}
        <a href="/login/client" className="font-semibold text-brand-yellow hover:underline">
          Log in
        </a>
      </p>
      </form>
    </div>
  );
}

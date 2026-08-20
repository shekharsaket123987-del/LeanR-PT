"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Mail, Lock, User, Phone, ArrowRight, ShieldCheck, MessageSquareText, Eye, EyeOff } from "lucide-react";
import Button from "../ui/Button";
import GoogleAuthButton from "./GoogleAuthButton";
import { supabase } from "@/lib/supabase";
import { sendPhoneOtpAction, verifyPhoneOtpAction } from "@/lib/actions/phone-otp.actions";
import { setMyPhoneAction } from "@/lib/actions/client-profile.actions";
import { isFailure } from "@/lib/actions/action-result";

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
 * demoBooking.service.ts requires an existing client account), and BOTH are
 * OTP-verified before being trusted -- one manually typed value proven, the
 * other not, defeats the point. Email verification is Supabase's own
 * signup-OTP flow (signUp -> verifyOtp); phone verification is MSG91's OTP
 * API (sms.service.ts), run as its own step right after, so phone is
 * deliberately NOT passed through signUp()'s metadata -- it only ever
 * lands in profiles.phone via setMyPhoneAction, after that number is
 * actually confirmed. Google sign-in skips email verification (Google
 * already verified that address) but still needs phone verification -- see
 * PhoneGateModal.tsx, which runs the same phone-OTP step for that path.
 *
 * Email OTP requires "Confirm email" turned on in the Supabase dashboard's
 * Auth settings, and the "Confirm signup" email template edited to surface
 * {{ .Token }} (remove/downplay the default {{ .ConfirmationURL }} link --
 * clicking it confirms the account via a completely different path than
 * this component's verifyOtp() call, so if both are present a user who
 * clicks the link instead of typing the code never lands back in this OTP
 * screen at all). Without that dashboard change, signUp() returns a
 * session immediately and the email-otp step never shows. Phone OTP
 * requires MSG91_AUTH_KEY in env -- no DLT template needed for this part,
 * see sms.service.ts's sendPhoneOtp/verifyPhoneOtp doc comment. */
export default function SignupForm() {
  const router = useRouter();
  const [step, setStep] = useState<"form" | "email-otp" | "phone-otp">("form");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [emailOtp, setEmailOtp] = useState("");
  const [phoneOtp, setPhoneOtp] = useState("");
  const [resendCooldown, setResendCooldown] = useState(false);
  const [phoneOtpSent, setPhoneOtpSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (!PHONE_PATTERN.test(normalizePhone(phone))) {
      setError("Enter a valid mobile number (10-15 digits).");
      return;
    }

    setLoading(true);
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { role: "client", full_name: fullName } },
    });
    setLoading(false);

    if (signUpError) {
      setError(signUpError.message);
      return;
    }

    // Either "Confirm email" is off (session already exists) or the code
    // was already verified some other way -- either way, email's settled,
    // move straight to phone verification.
    setStep(data.session ? "phone-otp" : "email-otp");
  }

  async function handleVerifyEmailOtp(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (emailOtp.trim().length < 4) {
      setError("Enter the code from your email.");
      return;
    }

    setLoading(true);
    const { error: verifyError } = await supabase.auth.verifyOtp({ email, token: emailOtp.trim(), type: "signup" });
    setLoading(false);

    if (verifyError) {
      setError(verifyError.message);
      return;
    }
    setStep("phone-otp");
  }

  async function handleResendEmailOtp() {
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

  // Fires once, the moment this step becomes active (covers both paths
  // into it: straight from the form, or after email verification).
  useEffect(() => {
    if (step !== "phone-otp" || phoneOtpSent) return;
    setPhoneOtpSent(true);
    sendPhoneOtpAction(normalizePhone(phone)).then((result) => {
      if (isFailure(result)) setError(result.error.message);
    });
  }, [step, phoneOtpSent, phone]);

  async function handleVerifyPhoneOtp(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (phoneOtp.trim().length < 4) {
      setError("Enter the code from the text message.");
      return;
    }

    setLoading(true);
    const verifyResult = await verifyPhoneOtpAction(normalizePhone(phone), phoneOtp.trim());
    if (isFailure(verifyResult)) {
      setLoading(false);
      setError(verifyResult.error.message);
      return;
    }

    const saveResult = await setMyPhoneAction(normalizePhone(phone));
    setLoading(false);
    if (isFailure(saveResult)) {
      setError(saveResult.error.message);
      return;
    }
    router.push("/client/plans");
  }

  async function handleResendPhoneOtp() {
    if (resendCooldown) return;
    setError("");
    const result = await sendPhoneOtpAction(normalizePhone(phone));
    if (isFailure(result)) {
      setError(result.error.message);
      return;
    }
    setResendCooldown(true);
    setTimeout(() => setResendCooldown(false), 30_000);
  }

  if (step === "email-otp") {
    return (
      <div className="w-full max-w-sm rounded-2xl border border-white/15 bg-white/5 p-6 text-center">
        <ShieldCheck className="mx-auto mb-3 h-8 w-8 text-brand-yellow" />
        <p className="text-sm font-bold text-white">Verify your email</p>
        <p className="mt-1.5 text-xs text-white/50">
          We&apos;ve sent a verification code to <span className="text-white/80">{email}</span>. Enter it below to confirm your account.
        </p>
        <form onSubmit={handleVerifyEmailOtp} className="mt-5 text-left">
          <input
            type="text"
            inputMode="numeric"
            autoFocus
            maxLength={10}
            placeholder="Enter code"
            value={emailOtp}
            onChange={(e) => setEmailOtp(e.target.value.replace(/\D/g, ""))}
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
            onClick={handleResendEmailOtp}
            disabled={resendCooldown}
            className="mt-3 w-full text-center text-xs font-semibold text-brand-yellow hover:underline disabled:cursor-not-allowed disabled:text-white/30 disabled:no-underline"
          >
            {resendCooldown ? "Code resent -- check your inbox" : "Didn't get it? Resend code"}
          </button>
        </form>
      </div>
    );
  }

  if (step === "phone-otp") {
    return (
      <div className="w-full max-w-sm rounded-2xl border border-white/15 bg-white/5 p-6 text-center">
        <MessageSquareText className="mx-auto mb-3 h-8 w-8 text-brand-yellow" />
        <p className="text-sm font-bold text-white">Verify your mobile number</p>
        <p className="mt-1.5 text-xs text-white/50">
          We&apos;ve texted a code to <span className="text-white/80">{phone}</span>. Enter it below to finish setting up your account.
        </p>
        <form onSubmit={handleVerifyPhoneOtp} className="mt-5 text-left">
          <input
            type="text"
            inputMode="numeric"
            autoFocus
            maxLength={6}
            placeholder="000000"
            value={phoneOtp}
            onChange={(e) => setPhoneOtp(e.target.value.replace(/\D/g, ""))}
            className="w-full rounded-xl border border-white/15 bg-white/5 py-3 text-center text-lg font-bold tracking-[0.4em] text-white placeholder:text-white/25 focus:border-brand-yellow focus:outline-none focus:ring-1 focus:ring-brand-yellow"
          />
          {error && (
            <p className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">{error}</p>
          )}
          <Button type="submit" size="lg" className="mt-4 w-full" loading={loading} disabled={loading}>
            {!loading && (
              <>
                Verify & Finish <ArrowRight className="h-4 w-4" />
              </>
            )}
            {loading && "Verifying..."}
          </Button>
          <button
            type="button"
            onClick={handleResendPhoneOtp}
            disabled={resendCooldown}
            className="mt-3 w-full text-center text-xs font-semibold text-brand-yellow hover:underline disabled:cursor-not-allowed disabled:text-white/30 disabled:no-underline"
          >
            {resendCooldown ? "Code resent -- check your phone" : "Didn't get it? Resend code"}
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
        <p className="mt-1.5 text-[11px] text-white/35">We&apos;ll text you a code to verify this, then session updates -- required for every account.</p>
      </div>
      <div className="mb-6">
        <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-white/50">Password</label>
        <div className="relative">
          <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
          <input
            type={showPassword ? "text" : "password"}
            required
            minLength={8}
            placeholder="At least 8 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl border border-white/15 bg-white/5 py-3 pl-10 pr-10 text-sm text-white placeholder:text-white/25 focus:border-brand-yellow focus:outline-none focus:ring-1 focus:ring-brand-yellow"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60"
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
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

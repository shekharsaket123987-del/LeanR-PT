"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Mail, Lock, User, ArrowRight, MailCheck } from "lucide-react";
import Button from "../ui/Button";
import { supabase } from "@/lib/supabase";

/** New-client self-service signup. Previously there was no way for a
 * genuinely new visitor to reach the app at all -- every login page said
 * "Welcome back" and required credentials nobody without an account could
 * have; accounts only ever got created manually via the Supabase dashboard.
 * Coach/admin accounts still aren't self-serve here (unchanged, ops-
 * provisioned by design), only clients. */
export default function SignupForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [checkEmail, setCheckEmail] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setLoading(true);
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { role: "client", full_name: fullName } },
    });

    if (signUpError) {
      setLoading(false);
      setError(signUpError.message);
      return;
    }

    if (data.session) {
      // Email confirmation is off for this project -- signed in immediately.
      router.push("/client/plans");
      return;
    }

    // Email confirmation is required before a session exists.
    setLoading(false);
    setCheckEmail(true);
  }

  if (checkEmail) {
    return (
      <div className="w-full max-w-sm rounded-2xl border border-white/15 bg-white/5 p-6 text-center">
        <MailCheck className="mx-auto mb-3 h-8 w-8 text-brand-yellow" />
        <p className="text-sm font-bold text-white">Check your inbox</p>
        <p className="mt-1.5 text-xs text-white/50">
          We&apos;ve sent a confirmation link to <span className="text-white/80">{email}</span>. Confirm your email, then log in to
          get started.
        </p>
        <Button href="/login/client" size="lg" className="mt-5 w-full">
          Go to Login <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-sm">
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
  );
}

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Mail, Lock, ArrowRight, Loader2 } from "lucide-react";
import Button from "../ui/Button";
import GoogleAuthButton from "./GoogleAuthButton";
import { supabase } from "@/lib/supabase";

const OAUTH_ERROR_MESSAGES: Record<string, string> = {
  oauth_failed: "Google sign-in failed. Please try again.",
};

export default function LoginForm({
  role,
  redirectTo,
  accent = "yellow",
}: {
  role: string;
  redirectTo: string;
  accent?: "yellow";
}) {
  const router = useRouter();
  // Read via window.location rather than useSearchParams() -- that hook
  // forces this whole form behind a Suspense boundary on these statically
  // generated pages, so with an empty fallback nothing (not even the
  // manual-login fields) would exist in the initial HTML until hydration.
  const [oauthError, setOauthError] = useState<string | null>(null);
  useEffect(() => {
    setOauthError(new URLSearchParams(window.location.search).get("error"));
  }, []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });

    if (authError) {
      setLoading(false);
      setError(authError.message);
      return;
    }

    router.push(redirectTo);
  }

  return (
    <div className="w-full max-w-sm">
      {oauthError && OAUTH_ERROR_MESSAGES[oauthError] && (
        <p className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
          {OAUTH_ERROR_MESSAGES[oauthError]}
        </p>
      )}

      <GoogleAuthButton />

      <div className="my-6 flex items-center gap-3">
        <div className="h-px flex-1 bg-white/10" />
        <span className="text-[11px] font-semibold uppercase tracking-wide text-white/30">or</span>
        <div className="h-px flex-1 bg-white/10" />
      </div>

      <form onSubmit={handleSubmit}>
      <div className="mb-5">
        <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-white/50">
          Email or Phone
        </label>
        <div className="relative">
          <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
          <input
            type="text"
            required
            placeholder={`your.${role}@email.com`}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl border border-white/15 bg-white/5 py-3 pl-10 pr-4 text-sm text-white placeholder:text-white/25 focus:border-brand-yellow focus:outline-none focus:ring-1 focus:ring-brand-yellow"
          />
        </div>
      </div>
      <div className="mb-2">
        <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-white/50">Password</label>
        <div className="relative">
          <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
          <input
            type="password"
            required
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl border border-white/15 bg-white/5 py-3 pl-10 pr-4 text-sm text-white placeholder:text-white/25 focus:border-brand-yellow focus:outline-none focus:ring-1 focus:ring-brand-yellow"
          />
        </div>
      </div>
      <div className="mb-6 flex justify-end">
        <button type="button" className="text-xs font-semibold text-white/40 hover:text-brand-yellow">
          Forgot password?
        </button>
      </div>
      {error && (
        <p className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
          {error}
        </p>
      )}
      <Button type="submit" size="lg" className="w-full" loading={loading} disabled={loading}>
        {!loading && (
          <>
            Log In <ArrowRight className="h-4 w-4" />
          </>
        )}
        {loading && "Signing in..."}
      </Button>
      {role === "client" && (
        <p className="mt-5 text-center text-xs text-white/40">
          New here?{" "}
          <a href="/signup" className="font-semibold text-brand-yellow hover:underline">
            Create an account
          </a>
        </p>
      )}
      </form>
    </div>
  );
}

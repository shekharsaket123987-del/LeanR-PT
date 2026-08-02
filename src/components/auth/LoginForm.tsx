"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Mail, Lock, ArrowRight, Loader2 } from "lucide-react";
import Button from "../ui/Button";
import { supabase } from "@/lib/supabase";

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
    <form onSubmit={handleSubmit} className="w-full max-w-sm">
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
      <p className="mt-5 text-center text-xs text-white/30">
        This is a design prototype — any email &amp; password will log you in.
      </p>
    </form>
  );
}

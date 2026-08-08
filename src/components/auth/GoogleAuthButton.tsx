"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

/** Shared by every login/signup form -- identical everywhere, since which
 * portal a Google sign-in lands in is decided server-side in /auth/callback
 * purely from the account's actual role, not which page the button was on.
 * Same OAuth call transparently signs in an existing account or creates a
 * new one (client role, via the handle_new_user trigger) -- Supabase
 * doesn't distinguish "signup" from "login" for OAuth. */
export default function GoogleAuthButton() {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-white/15 bg-white/5 py-3 text-sm font-semibold text-white transition hover:border-white/30 hover:bg-white/10 disabled:opacity-50"
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <svg className="h-4 w-4" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.63h6.46c-.28 1.5-1.13 2.77-2.4 3.62v3h3.88c2.27-2.09 3.58-5.17 3.58-8.8z" />
          <path fill="#34A853" d="M12 24c3.24 0 5.95-1.07 7.94-2.9l-3.88-3c-1.08.72-2.45 1.15-4.06 1.15-3.12 0-5.77-2.11-6.71-4.94H1.28v3.1C3.26 21.3 7.3 24 12 24z" />
          <path fill="#FBBC05" d="M5.29 14.31c-.24-.72-.38-1.49-.38-2.28s.14-1.56.38-2.28V6.65H1.28A11.98 11.98 0 000 12.03c0 1.94.46 3.77 1.28 5.38l4.01-3.1z" />
          <path fill="#EA4335" d="M12 4.77c1.76 0 3.34.6 4.58 1.79l3.44-3.44C17.94 1.19 15.24 0 12 0 7.3 0 3.26 2.7 1.28 6.65l4.01 3.1c.94-2.83 3.59-4.98 6.71-4.98z" />
        </svg>
      )}
      {loading ? "Redirecting..." : "Continue with Google"}
    </button>
  );
}

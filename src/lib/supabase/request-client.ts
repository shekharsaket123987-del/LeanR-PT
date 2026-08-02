import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * Request-scoped client for Server Actions. Pass the caller's access token
 * (read client-side via `supabase.auth.getSession()`) so RLS policies see
 * the correct `auth.uid()` for this call, without any cookie/middleware setup.
 */
export function getRequestClient(accessToken: string) {
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}

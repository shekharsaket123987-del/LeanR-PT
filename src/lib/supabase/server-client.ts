import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/** Cookie-aware client for Server Components/Actions. Session refresh on
 * write is handled by middleware.ts; setAll here is a no-op fallback for
 * contexts (Server Component render) where cookies can't be mutated. */
async function getServerSupabase() {
  const cookieStore = await cookies();
  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called during a Server Component render — can't set cookies here;
          // middleware.ts already refreshes the session on every request.
        }
      },
    },
  });
}

/** Access token for the signed-in user, to pass into `lib/services/*`
 * functions (which take an explicit accessToken rather than reading cookies
 * themselves, keeping the service layer transport-agnostic). Null if there's
 * no session — shouldn't happen inside a portal route, since middleware.ts
 * guards all of them, but callers should still handle it. */
export async function getAccessToken(): Promise<string | null> {
  const supabase = await getServerSupabase();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

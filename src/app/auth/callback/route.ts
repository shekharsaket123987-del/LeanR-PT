import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const DASHBOARD_BY_ROLE: Record<string, string> = {
  admin: "/admin/dashboard",
  coach: "/coach/dashboard",
  client: "/client/dashboard",
};

/**
 * Google OAuth lands here with a `code` to exchange for a session. The
 * destination portal is decided purely by the account's role in `profiles`
 * -- not by which of the three login pages the user clicked through --
 * so the same "Continue with Google" button works from any of them and
 * always lands the person in their real portal.
 *
 * Client role is self-serve (handle_new_user trigger defaults new Google
 * sign-ins to "client"), but coach/admin accounts are ops-provisioned only
 * -- see SignupForm.tsx. That's still enforced here implicitly: a brand-new
 * Google account has no pre-existing coach/admin profile to route into, so
 * it can only ever land as a client. Nobody can self-grant coach/admin by
 * choosing a different login page.
 */
export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(new URL("/login/client?error=oauth_failed", requestUrl.origin));
  }

  const pendingCookies: { name: string; value: string; options: CookieOptions }[] = [];
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        pendingCookies.push(...cookiesToSet);
      },
    },
  });

  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
  if (exchangeError) {
    return NextResponse.redirect(new URL("/login/client?error=oauth_failed", requestUrl.origin));
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await supabase.from("profiles").select("role").eq("id", user.id).single()
    : { data: null };

  const destination = profile ? (DASHBOARD_BY_ROLE[profile.role] ?? "/login/client?error=oauth_failed") : "/login/client?error=oauth_failed";

  const response = NextResponse.redirect(new URL(destination, requestUrl.origin));
  pendingCookies.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
  return response;
}

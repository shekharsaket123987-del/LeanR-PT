import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * OAuth redirect target (Google, etc.). Exchanges the auth code for a
 * session, then routes by the signed-in user's actual profiles.role rather
 * than trusting which portal's login page the button was clicked from --
 * middleware.ts would bounce a mismatch anyway, so this just saves the
 * extra redirect hop.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const fallback = searchParams.get("redirect") || "/login/client";

  if (!code) {
    return NextResponse.redirect(`${origin}${fallback}?error=oauth_failed`);
  }

  let response = NextResponse.redirect(`${origin}${fallback}`);

  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.redirect(`${origin}${fallback}`);
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.user) {
    return NextResponse.redirect(`${origin}${fallback}?error=oauth_failed`);
  }

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", data.user.id).single();

  const destination = profile ? `/${profile.role}/dashboard` : fallback;
  response = NextResponse.redirect(`${origin}${destination}`, { headers: response.headers });
  return response;
}

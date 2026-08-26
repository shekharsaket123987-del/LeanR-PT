import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PORTAL_ROLES = ["client", "coach", "admin"] as const;
type PortalRole = (typeof PORTAL_ROLES)[number];

function requiredRoleFor(pathname: string): PortalRole | null {
  const segment = pathname.split("/")[1];
  return (PORTAL_ROLES as readonly string[]).includes(segment) ? (segment as PortalRole) : null;
}

/**
 * Gates every /client, /coach, /admin route: no session -> that portal's
 * login page; session but wrong/missing profile role -> same. This is the
 * server-side enforcement SYSTEM_ARCHITECTURE.md §7 describes but that,
 * until now, didn't actually exist — portal layouts rendered unconditionally.
 *
 * Uses getClaims() instead of getUser() + a separate `profiles` query --
 * this project signs JWTs asymmetrically (ES256), so getClaims() verifies
 * the session locally via WebCrypto against a cached JWKS instead of
 * calling the Auth server, and the custom_access_token_hook migration
 * (0054) embeds `role` directly in the token as `user_role`, so the role
 * check needs zero additional Supabase round trips instead of one.
 *
 * Falls back to the old query-based check when `user_role` isn't present
 * on the token -- covers sessions issued before the Custom Access Token
 * hook was enabled in the Supabase dashboard (see migration 0054's doc
 * comment) or before this deploy, so this is safe to ship regardless of
 * hook-enablement timing; those sessions catch up automatically on their
 * next token refresh/re-login.
 */
export async function middleware(request: NextRequest) {
  const requiredRole = requiredRoleFor(request.nextUrl.pathname);
  if (!requiredRole) return NextResponse.next();

  let response = NextResponse.next({ request });

  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData) {
    return NextResponse.redirect(new URL(`/login/${requiredRole}`, request.url));
  }

  const claims = claimsData.claims as { sub: string; user_role?: string | null };
  let role = claims.user_role;

  if (role === undefined) {
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", claims.sub).single();
    role = profile?.role ?? null;
  }

  if (role !== requiredRole) {
    return NextResponse.redirect(new URL(`/login/${requiredRole}`, request.url));
  }

  return response;
}

export const config = {
  matcher: ["/client/:path*", "/coach/:path*", "/admin/:path*"],
};

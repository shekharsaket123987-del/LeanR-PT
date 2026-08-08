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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL(`/login/${requiredRole}`, request.url));
  }

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();

  if (!profile || profile.role !== requiredRole) {
    return NextResponse.redirect(new URL(`/login/${requiredRole}`, request.url));
  }

  return response;
}

export const config = {
  matcher: ["/client/:path*", "/coach/:path*", "/admin/:path*"],
};

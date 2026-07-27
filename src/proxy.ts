import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifySessionCookie, isAdminEmail } from "@/lib/auth-cookie";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Exclude public paths (homepage, login, vendor links, ics feeds, static assets)
  const isPublicPath =
    pathname === "/" ||
    pathname === "/login" ||
    pathname.startsWith("/vendor") ||
    pathname.startsWith("/api/ics") ||
    pathname.startsWith("/api/vendor") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/_next") ||
    pathname.includes(".") ||
    pathname.startsWith("/assets");

  // 2. Fetch and verify Google OAuth session cookie (support both cookie keys)
  const sessionToken =
    request.cookies.get("portal_user_session")?.value ||
    request.cookies.get("portal_session")?.value;
  const session = sessionToken ? await verifySessionCookie(sessionToken) : null;

  // 3. Handle admin routes protection (requires admin password cookie or admin role)
  if (pathname.startsWith("/admin")) {
    const hasAdminAccess = request.cookies.get("admin_access")?.value === "true";
    const hasOAuthAdminAccess = session ? (session.role === "admin" || isAdminEmail(session.email)) : false;
    const isAuthorized = hasAdminAccess || hasOAuthAdminAccess;

    if (!isAuthorized && pathname !== "/admin/login") {
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }

    if (isAuthorized && pathname === "/admin/login") {
      return NextResponse.redirect(new URL("/admin", request.url));
    }

    return NextResponse.next();
  }

  // 4. Public paths proceed cleanly
  if (isPublicPath) {
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api/auth (OAuth routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - icon.png (shortcut icon)
     */
    "/((?!api/auth|_next/static|_next/image|favicon.ico|icon.png).*)",
  ],
};

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

  const hasAdminAccessCookie = request.cookies.get("admin_access")?.value === "true";
  const hasOAuthAdminAccess = session ? (session.role === "admin" || isAdminEmail(session.email)) : false;
  const isAuthorizedAdmin = hasAdminAccessCookie || hasOAuthAdminAccess;

  // 3. Handle admin routes protection
  if (pathname.startsWith("/admin")) {
    // If user is already an authorized admin and navigates to /admin/login, redirect straight to /admin
    if (isAuthorizedAdmin && pathname === "/admin/login") {
      return NextResponse.redirect(new URL("/admin", request.url));
    }

    // If user is accessing /admin or /admin/* without admin authorization, redirect to /admin/login
    if (!isAuthorizedAdmin && pathname !== "/admin/login") {
      return NextResponse.redirect(new URL("/admin/login", request.url));
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
    "/((?!api/auth|_next/static|_next/image|favicon.ico|icon.png).*)",
  ],
};

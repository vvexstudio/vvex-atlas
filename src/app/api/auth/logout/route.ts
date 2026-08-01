import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET(request: Request) {
  const cookieStore = await cookies();
  
  const clearOpts = {
    path: "/",
    maxAge: 0,
    expires: new Date(0),
  };

  cookieStore.set("portal_user_session", "", clearOpts);
  cookieStore.set("portal_session", "", clearOpts);
  cookieStore.set("admin_access", "", clearOpts);

  cookieStore.delete("portal_user_session");
  cookieStore.delete("portal_session");
  cookieStore.delete("admin_access");
  
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host") || "";
  const isLocal = host.includes("localhost") || host.includes("127.0.0.1") || host.includes("0.0.0.0") || host.startsWith("192.168.");
  const proto = isLocal ? "http" : "https";
  const origin = `${proto}://${host}`;

  const response = NextResponse.redirect(new URL("/login?logout=success", origin));
  response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Expires", "0");
  return response;
}

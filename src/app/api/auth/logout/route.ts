import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET(request: Request) {
  const cookieStore = await cookies();
  cookieStore.delete("portal_user_session");
  
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host") || "";
  const isLocal = host.includes("localhost") || host.includes("127.0.0.1") || host.includes("0.0.0.0") || host.startsWith("192.168.");
  const proto = isLocal ? "http" : "https";
  const origin = `${proto}://${host}`;

  return NextResponse.redirect(new URL("/login", origin));
}

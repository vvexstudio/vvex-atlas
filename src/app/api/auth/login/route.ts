import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const callbackUrl = searchParams.get("callbackUrl") || "/";

  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    console.error("GOOGLE_CLIENT_ID env variable is not set.");
    return NextResponse.json({ error: "OAuth Client ID not configured" }, { status: 500 });
  }

  // Detect origin dynamically from request headers
  const host = request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") || "http";
  const origin = `${proto}://${host}`;
  const redirectUri = `${origin}/api/auth/callback`;

  const oauthUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  oauthUrl.searchParams.set("client_id", clientId);
  oauthUrl.searchParams.set("redirect_uri", redirectUri);
  oauthUrl.searchParams.set("response_type", "code");
  oauthUrl.searchParams.set("scope", "openid email profile");
  oauthUrl.searchParams.set("state", callbackUrl);
  oauthUrl.searchParams.set("prompt", "select_account");

  return NextResponse.redirect(oauthUrl.toString());
}

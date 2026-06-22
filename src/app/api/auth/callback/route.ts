import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { isEmailApproved, createSessionCookie } from "@/lib/auth";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state") || "/"; // callbackUrl

  if (!code) {
    console.error("OAuth callback: Missing authorization code");
    return NextResponse.redirect(new URL("/login?error=no-code", request.url));
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error("OAuth callback: Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET");
    return NextResponse.redirect(new URL("/login?error=config-missing", request.url));
  }

  // Detect origin dynamically from request headers
  const host = request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") || "http";
  const origin = `${proto}://${host}`;
  const redirectUri = `${origin}/api/auth/callback`;

  try {
    // 1. Exchange code for access_token
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenRes.ok) {
      const errorText = await tokenRes.text();
      console.error(`OAuth token exchange failed (status ${tokenRes.status}):`, errorText);
      return NextResponse.redirect(new URL("/login?error=token-exchange-failed", request.url));
    }

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;

    if (!accessToken) {
      console.error("OAuth token exchange did not return an access token");
      return NextResponse.redirect(new URL("/login?error=no-access-token", request.url));
    }

    // 2. Fetch user information
    const userRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!userRes.ok) {
      const errorText = await userRes.text();
      console.error(`OAuth fetch userinfo failed (status ${userRes.status}):`, errorText);
      return NextResponse.redirect(new URL("/login?error=userinfo-failed", request.url));
    }

    const userData = await userRes.json();
    const email = userData.email;
    const name = userData.name || "";
    const picture = userData.picture || "";

    if (!email) {
      console.error("Google user profile did not contain an email address");
      return NextResponse.redirect(new URL("/login?error=no-email", request.url));
    }

    // 3. Verify user email against Approved Emails tab
    const approved = await isEmailApproved(email);

    if (!approved) {
      console.warn(`Access denied: ${email} is not in the approved list`);
      return NextResponse.redirect(
        new URL(`/login?error=unauthorized&email=${encodeURIComponent(email)}`, request.url)
      );
    }

    // 4. Create and sign session cookie
    const sessionCookieVal = await createSessionCookie({
      email,
      name,
      picture,
    });

    // Set cookie using next/headers cookies API
    const cookieStore = await cookies();
    cookieStore.set("portal_user_session", sessionCookieVal, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 7, // 7 days
      sameSite: "lax",
    });

    console.log(`Access granted: ${email} successfully logged in`);
    return NextResponse.redirect(new URL(state, request.url));
  } catch (err) {
    console.error("OAuth callback exception:", err);
    return NextResponse.redirect(new URL("/login?error=callback-exception", request.url));
  }
}

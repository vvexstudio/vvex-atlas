import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { isEmailApproved, createSessionCookie, isAdminEmail, getUserRoleFromPersonnel } from "@/lib/auth";
import { adminDb } from "@/lib/firebase-admin";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state") || "/"; // callbackUrl

  // Detect origin dynamically from request headers (support x-forwarded-host for proxies)
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host") || "";
  const isLocal = host.includes("localhost") || host.includes("127.0.0.1") || host.includes("0.0.0.0") || host.startsWith("192.168.");
  const proto = isLocal ? "http" : "https";
  const origin = `${proto}://${host}`;
  const redirectUri = `${origin}/api/auth/callback`;

  if (!code) {
    console.error("OAuth callback: Missing authorization code");
    return NextResponse.redirect(new URL("/login?error=no-code", origin));
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error("OAuth callback: Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET");
    return NextResponse.redirect(new URL("/login?error=config-missing", origin));
  }

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
      return NextResponse.redirect(new URL("/login?error=token-exchange-failed", origin));
    }

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;

    if (!accessToken) {
      console.error("OAuth token exchange did not return an access token");
      return NextResponse.redirect(new URL("/login?error=no-access-token", origin));
    }

    // 2. Fetch user information
    const userRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!userRes.ok) {
      const errorText = await userRes.text();
      console.error(`OAuth fetch userinfo failed (status ${userRes.status}):`, errorText);
      return NextResponse.redirect(new URL("/login?error=userinfo-failed", origin));
    }

    const userData = await userRes.json();
    const email = userData.email;
    const name = userData.name || "";
    const picture = userData.picture || "";

    if (!email) {
      console.error("Google user profile did not contain an email address");
      return NextResponse.redirect(new URL("/login?error=no-email", origin));
    }

    // Check if Google verified the email address to prevent unverified domain attacks
    if (userData.email_verified !== true) {
      console.error(`Access denied: Google account email ${email} is not verified`);
      return NextResponse.redirect(new URL("/login?error=email-unverified", origin));
    }

    const sanitizedEmail = email.trim().toLowerCase();

    // 3. Verify user email against Approved Emails / Personnel tab or ADMIN_EMAILS
    const approved = isAdminEmail(sanitizedEmail) || await isEmailApproved(sanitizedEmail);

    if (!approved) {
      console.warn(`Email ${sanitizedEmail} is not in crew list. Redirecting gracefully to Public View.`);
      const sessionValue = await createSessionCookie({
        email: sanitizedEmail,
        name: name || sanitizedEmail,
        role: "public",
        picture,
      });
      const cookieStore = await cookies();
      const cookieOpts = {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax" as const,
        path: "/",
        maxAge: 60 * 60 * 24 * 7,
      };
      cookieStore.set("portal_session", sessionValue, cookieOpts);
      cookieStore.set("portal_user_session", sessionValue, cookieOpts);
      return NextResponse.redirect(new URL("/?role=public&notice=guest-public", origin));
    }

    // 4. Resolve the user's role: ADMIN_EMAILS -> Firebase RTD -> Personnel Sheet -> "crew"
    let role = "crew";

    if (isAdminEmail(sanitizedEmail)) {
      role = "admin";
    } else {
      if (adminDb) {
        try {
          const escapedEmail = sanitizedEmail.replace(/\./g, ",");
          const userSnapshot = await adminDb.ref(`auth-directory/${escapedEmail}`).once("value");
          if (userSnapshot.exists() && userSnapshot.val().role) {
            role = userSnapshot.val().role;
          } else {
            const sheetRole = await getUserRoleFromPersonnel(sanitizedEmail);
            if (sheetRole) role = sheetRole;
          }
        } catch (dbErr) {
          console.error("Failed to query user role during OAuth callback:", dbErr);
          const sheetRole = await getUserRoleFromPersonnel(sanitizedEmail);
          if (sheetRole) role = sheetRole;
        }
      } else {
        const sheetRole = await getUserRoleFromPersonnel(sanitizedEmail);
        if (sheetRole) role = sheetRole;
      }
    }

    // 5. Create and sign session cookie
    const sessionCookieVal = await createSessionCookie({
      email,
      name,
      picture,
      role,
    });

    // Set cookie using next/headers cookies API (support both cookie names)
    const cookieStore = await cookies();
    const cookieOpts = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 7, // 7 days
      sameSite: "lax" as const,
    };
    cookieStore.set("portal_user_session", sessionCookieVal, cookieOpts);
    cookieStore.set("portal_session", sessionCookieVal, cookieOpts);

    console.log(`Access granted: ${email} successfully logged in`);
    return NextResponse.redirect(new URL(state, origin));
  } catch (err) {
    console.error("OAuth callback exception:", err);
    return NextResponse.redirect(new URL("/login?error=callback-exception", origin));
  }
}

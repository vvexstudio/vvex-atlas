import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySessionCookie } from "@/lib/auth";
import { adminAuth, adminDb } from "@/lib/firebase-admin";

/**
 * Escapes email address to be compatible with Firebase Realtime Database keys.
 * Replaces '.' with ','
 */
function escapeEmail(email: string): string {
  return email.trim().toLowerCase().replace(/\./g, ",");
}

export async function GET() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get("portal_user_session")?.value;

  if (!sessionToken) {
    return NextResponse.json({ error: "Unauthorized: No session token" }, { status: 401 });
  }

  // 1. Verify Next.js session
  let session;
  try {
    session = await verifySessionCookie(sessionToken);
  } catch (err) {
    console.error("Session verification failed:", err);
    return NextResponse.json({ error: "Unauthorized: Invalid session" }, { status: 401 });
  }

  if (!session || !session.email) {
    return NextResponse.json({ error: "Unauthorized: Empty session payload" }, { status: 401 });
  }

  const email = session.email;

  // 2. Fallback check: if Firebase SDK is not configured
  if (!adminAuth || !adminDb) {
    console.warn("Firebase Admin SDK is not initialized. Returning mock token for development.");
    // In local development, if Firebase isn't fully configured yet, we can return a mock status
    return NextResponse.json({ 
      error: "Firebase Admin configuration missing",
      isDevFallback: true,
      mockToken: "mock-development-token"
    }, { status: 503 });
  }

  try {
    // 3. Query the user's role and departments from Firebase RTD /auth-directory
    const escapedEmail = escapeEmail(email);
    const userSnapshot = await adminDb.ref(`auth-directory/${escapedEmail}`).once("value");
    
    let role = "guest";
    let departments: string[] = [];

    if (userSnapshot.exists()) {
      const userData = userSnapshot.val();
      
      // Enforce active offboarding gate (C2)
      if (userData.active === false || userData.active === "FALSE") {
        console.warn(`User ${email} is inactive. Denying token generation.`);
        return NextResponse.json({ error: "Forbidden: Account is inactive" }, { status: 403 });
      }

      role = userData.role || "guest";
      
      // Parse departments if defined
      if (typeof userData.departments === "string") {
        departments = userData.departments.split(",").map((d: string) => d.trim()).filter(Boolean);
      } else if (Array.isArray(userData.departments)) {
        departments = userData.departments.filter(Boolean);
      }
    } else {
      console.warn(`User ${email} not found in Firebase /auth-directory. Defaulting to 'guest'.`);
    }

    // 4. Create Firebase Custom Token with custom claims
    const customToken = await adminAuth.createCustomToken(email, {
      role,
      departments,
    });

    return NextResponse.json({ 
      token: customToken,
      role,
      departments
    });
  } catch (error) {
    console.error("Failed to generate Firebase Custom Token:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

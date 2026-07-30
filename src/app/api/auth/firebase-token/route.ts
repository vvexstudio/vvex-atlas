import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySessionCookie, isAdminEmail, getUserRoleFromPersonnel } from "@/lib/auth";
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
  const sessionToken =
    cookieStore.get("portal_user_session")?.value ||
    cookieStore.get("portal_session")?.value;

  if (!sessionToken) {
    return NextResponse.json({ role: "public", token: null, isPublic: true });
  }

  // 1. Verify Next.js session
  let session;
  try {
    session = await verifySessionCookie(sessionToken);
  } catch (err) {
    console.warn("Session verification failed, defaulting to public role:", err);
    return NextResponse.json({ role: "public", token: null, isPublic: true });
  }

  if (!session || !session.email) {
    return NextResponse.json({ role: "public", token: null, isPublic: true });
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
    
    let role = session.role || "public";
    let departments: string[] = [];

    if (userSnapshot.exists()) {
      const userData = userSnapshot.val();
      
      // Enforce active offboarding gate (C2)
      if (userData.active === false || userData.active === "FALSE") {
        console.warn(`User ${email} is inactive. Denying token generation.`);
        return NextResponse.json({ error: "Forbidden: Account is inactive" }, { status: 403 });
      }

      role = userData.role || role || "crew";
      
      // Parse departments if defined
      if (typeof userData.departments === "string") {
        departments = userData.departments.split(",").map((d: string) => d.trim()).filter(Boolean);
      } else if (Array.isArray(userData.departments)) {
        departments = userData.departments.filter(Boolean);
      }
    } else {
      console.warn(`User ${email} not found in Firebase /auth-directory. Resolving fallback role.`);
      const sheetRole = await getUserRoleFromPersonnel(email);
      if (sheetRole) role = sheetRole;
    }

    if (isAdminEmail(email)) {
      role = "admin";
    }

    // 4. Create Firebase Custom Token with custom claims
    const customToken = await adminAuth.createCustomToken(email, {
      role,
      departments,
      escapedEmail,
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

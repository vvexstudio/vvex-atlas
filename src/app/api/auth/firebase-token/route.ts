import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySessionCookie } from "@/lib/auth";
import { adminDb, adminApp } from "@/lib/firebase-admin";
import { getAuth } from "firebase-admin/auth";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get("portal_user_session")?.value;
    const userSession = sessionToken ? await verifySessionCookie(sessionToken) : null;

    if (!userSession?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const escapedEmail = userSession.email.trim().toLowerCase().replace(/\./g, ",");
    let role = "guest";
    let departments = {};

    if (adminDb) {
      const snapshot = await adminDb.ref(`auth-directory/${escapedEmail}`).once("value");
      if (snapshot.exists()) {
        const userData = snapshot.val();
        role = userData.role || "guest";
        departments = userData.departments || {};
      }
    }

    let token = "";
    if (adminApp) {
      const adminAuth = getAuth(adminApp);
      const uid = `google-oauth2|${escapedEmail}`;
      token = await adminAuth.createCustomToken(uid, {
        role,
        departments,
      });
    } else {
      console.warn("Firebase Admin SDK not initialized; cannot mint custom token.");
    }

    return NextResponse.json({ token, role, departments });
  } catch (err) {
    console.error("Failed to generate Firebase Custom Token:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

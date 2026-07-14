import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getApprovedEmails, verifySessionCookie, isAdminEmail } from "@/lib/auth";
import { clearSpreadsheetValues, updateSpreadsheetValues } from "@/lib/google-sheets-api";

const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_SPREADSHEET_ID || "19Xs3TScHhS369n_A8VvUGxszoxncx1p32T8iwNHSKTU";
const TAB_NAME = "Approved Emails";

/**
 * Checks if current requester is authorized as an admin (password cookie or OAuth admin email).
 */
async function isAdminAuthorized(): Promise<boolean> {
  const cookieStore = await cookies();
  
  // 1. Password login check (legacy/fallback)
  if (cookieStore.get("admin_access")?.value === "true") {
    return true;
  }
  
  // 2. Google OAuth session check
  const sessionToken = cookieStore.get("portal_user_session")?.value;
  if (sessionToken) {
    const session = await verifySessionCookie(sessionToken);
    if (session && isAdminEmail(session.email)) {
      return true;
    }
  }
  
  return false;
}

// GET all approved emails
export async function GET() {
  if (!(await isAdminAuthorized())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const emails = await getApprovedEmails();
  return NextResponse.json({ emails });
}

// POST to add a new approved email (DEPRECATED)
export async function POST() {
  return NextResponse.json({ 
    error: "Approved Emails management is deprecated. Please manage users directly inside the Personnel tab of the Google Sheet." 
  }, { status: 410 });
}

// DELETE to remove an email from the approved list (DEPRECATED)
export async function DELETE() {
  return NextResponse.json({ 
    error: "Approved Emails management is deprecated. Please manage users directly inside the Personnel tab of the Google Sheet." 
  }, { status: 410 });
}

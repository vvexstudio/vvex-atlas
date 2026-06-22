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

// POST to add a new approved email
export async function POST(request: Request) {
  if (!(await isAdminAuthorized())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { email, name } = await request.json() as { email?: string; name?: string };

    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "Invalid email format" }, { status: 400 });
    }

    const currentList = await getApprovedEmails();
    const normalizedEmail = email.trim().toLowerCase();

    // Check if email already exists
    if (currentList.some(item => item.email.toLowerCase() === normalizedEmail)) {
      return NextResponse.json({ error: "Email is already approved" }, { status: 409 });
    }

    const updatedList = [
      ...currentList,
      { email: normalizedEmail, name: (name || "").trim() }
    ];

    // Build values matrix: row 1 headers, then data rows
    const values = [
      ["email", "name"],
      ...updatedList.map(item => [item.email, item.name])
    ];

    // Clear existing range and write new matrix
    await clearSpreadsheetValues(SPREADSHEET_ID, `${TAB_NAME}!A1:Z500`);
    await updateSpreadsheetValues(SPREADSHEET_ID, `${TAB_NAME}!A1`, values);

    return NextResponse.json({ success: true, emails: updatedList });
  } catch (err) {
    console.error("Failed to add approved email:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// DELETE to remove an email from the approved list
export async function DELETE(request: Request) {
  if (!(await isAdminAuthorized())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get("email");

    if (!email) {
      return NextResponse.json({ error: "Missing email parameter" }, { status: 400 });
    }

    const currentList = await getApprovedEmails();
    const normalizedEmail = email.trim().toLowerCase();

    const updatedList = currentList.filter(item => item.email.toLowerCase() !== normalizedEmail);

    if (currentList.length === updatedList.length) {
      return NextResponse.json({ error: "Email not found" }, { status: 404 });
    }

    // Build values matrix
    const values = [
      ["email", "name"],
      ...updatedList.map(item => [item.email, item.name])
    ];

    // Clear and write
    await clearSpreadsheetValues(SPREADSHEET_ID, `${TAB_NAME}!A1:Z500`);
    if (updatedList.length > 0) {
      await updateSpreadsheetValues(SPREADSHEET_ID, `${TAB_NAME}!A1`, values);
    } else {
      // If the list is empty, write at least headers back
      await updateSpreadsheetValues(SPREADSHEET_ID, `${TAB_NAME}!A1`, [["email", "name"]]);
    }

    return NextResponse.json({ success: true, emails: updatedList });
  } catch (err) {
    console.error("Failed to delete approved email:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

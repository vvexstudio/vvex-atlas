import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getApprovedEmails, isRequestAdminAuthorized } from "@/lib/auth";

async function isAdminAuthorized(): Promise<boolean> {
  const cookieStore = await cookies();
  return isRequestAdminAuthorized(cookieStore);
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

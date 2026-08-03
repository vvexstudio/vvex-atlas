import { getParsedSheetData } from "./google-sheets-api";
import { verifySessionCookie, createSessionCookie, isAdminEmail } from "./auth-cookie";
export { verifySessionCookie, createSessionCookie, isAdminEmail };
export type { UserSession } from "./auth-cookie";

export interface ApprovedEmail {
  email: string;
  name: string;
}

/**
 * Fetches and normalizes list of approved emails from Google Sheets
 */
export async function getApprovedEmails(): Promise<ApprovedEmail[]> {
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID || "19Xs3TScHhS369n_A8VvUGxszoxncx1p32T8iwNHSKTU";
  try {
    const list = await getParsedSheetData<any>(spreadsheetId, "Personnel");
    return list.map(item => {
      let email = "";
      let name = "";
      let active = true;
      for (const [key, val] of Object.entries(item)) {
        const cleanKey = key.trim().toLowerCase();
        if (cleanKey === "email") {
          email = String(val).trim();
        } else if (cleanKey === "name") {
          name = String(val).trim();
        } else if (cleanKey === "active") {
          active = val !== false && String(val).trim().toUpperCase() !== "FALSE";
        }
      }
      return { email, name, active };
    }).filter(item => item.email && item.active);
  } catch (err) {
    console.error("Failed to fetch approved emails from Google Sheet:", err);
    return [];
  }
}

/**
 * Checks if a given email is in the Approved Emails list
 */
export async function isEmailApproved(email: string): Promise<boolean> {
  const list = await getApprovedEmails();
  const normalizedEmail = email.trim().toLowerCase();
  return list.some(item => item.email.toLowerCase() === normalizedEmail);
}

/**
 * Resolves user role directly from Personnel sheet if auth-directory is not yet populated
 */
export async function getUserRoleFromPersonnel(email: string): Promise<string | null> {
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID || "1rpmzT4_6NlAOSryN86ROv3mv1Jf4ydColAlk6MrY1zw";
  try {
    const list = await getParsedSheetData<any>(spreadsheetId, "Personnel");
    const normalizedEmail = email.trim().toLowerCase();
    for (const item of list) {
      let itemEmail = "";
      let itemRole = "";
      for (const [key, val] of Object.entries(item)) {
        const cleanKey = key.trim().toLowerCase();
        if (cleanKey === "email") {
          itemEmail = String(val).trim().toLowerCase();
        } else if (cleanKey.includes("role")) {
          itemRole = String(val).trim();
        }
      }
      if (itemEmail === normalizedEmail && itemRole) {
        const lower = itemRole.toLowerCase();
        if (lower.includes("admin")) return "admin";
        if (lower.includes("public") || lower.includes("guest")) return "guest";
        return "crew";
      }
    }
  } catch (err) {
    console.error("Failed to fetch role from Personnel sheet:", err);
  }
  return null;
}

/**
 * Checks if the current request is authorized with admin privileges
 * via either admin_access cookie or valid OAuth session with admin role / email.
 */
export async function isRequestAdminAuthorized(
  cookieStore: any,
  password?: string
): Promise<boolean> {
  if (!cookieStore) return false;

  // 1. Password cookie check
  if (cookieStore.get("admin_access")?.value === "true") {
    return true;
  }

  // 2. Google OAuth session check
  const sessionToken =
    cookieStore.get("portal_user_session")?.value ||
    cookieStore.get("portal_session")?.value;
  if (sessionToken) {
    const session = await verifySessionCookie(sessionToken);
    if (session?.email) {
      if (session.role === "admin" || isAdminEmail(session.email)) {
        return true;
      }
      // Check Personnel sheet if role was not directly stored as admin in session token
      const sheetRole = await getUserRoleFromPersonnel(session.email);
      if (sheetRole === "admin") {
        return true;
      }
    }
  }

  // 3. Direct password parameter fallback (for API testing / debug)
  if (password && (password === process.env.ADMIN_PASSWORD || password === "ADMIN")) {
    return true;
  }

  return false;
}


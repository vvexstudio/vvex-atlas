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
      for (const [key, val] of Object.entries(item)) {
        const cleanKey = key.trim().toLowerCase();
        if (cleanKey === "email") {
          email = String(val).trim();
        } else if (cleanKey === "name") {
          name = String(val).trim();
        }
      }
      return { email, name };
    }).filter(item => item.email);
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

import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getDatabase } from "firebase-admin/database";

function cleanEnvString(val?: string): string | undefined {
  if (!val) return undefined;
  let formatted = val.trim();
  if (
    (formatted.startsWith('"') && formatted.endsWith('"')) ||
    (formatted.startsWith("'") && formatted.endsWith("'"))
  ) {
    formatted = formatted.substring(1, formatted.length - 1).trim();
  }
  return formatted;
}

const projectId = cleanEnvString(process.env.FIREBASE_PROJECT_ID);
const clientEmail = cleanEnvString(process.env.FIREBASE_CLIENT_EMAIL);
const rawDbUrl = cleanEnvString(process.env.FIREBASE_DATABASE_URL);

function formatPrivateKey(key?: string): string | undefined {
  if (!key) return undefined;
  let formatted = key.trim();
  if ((formatted.startsWith('"') && formatted.endsWith('"')) || (formatted.startsWith("'") && formatted.endsWith("'"))) {
    formatted = formatted.substring(1, formatted.length - 1);
  }
  return formatted.replace(/\\n/g, "\n").replace(/\r/g, "");
}

const privateKey = formatPrivateKey(process.env.FIREBASE_PRIVATE_KEY);

let appInitialized = false;

if (getApps().length === 0) {
  if (projectId && clientEmail && privateKey) {
    try {
      initializeApp({
        credential: cert({
          projectId,
          clientEmail,
          privateKey,
        }),
        databaseURL: rawDbUrl || `https://${projectId}-default-rtdb.firebaseio.com`,
      });
      appInitialized = true;
      console.log("Firebase Admin SDK successfully initialized.");
    } catch (error: any) {
      console.warn(
        "Firebase Admin SDK initialization skipped (invalid or placeholder credentials):",
        error?.message || error
      );
    }
  } else {
    console.warn(
      "Firebase Admin credentials missing. Realtime features requiring admin privileges will be disabled."
    );
  }
} else {
  appInitialized = true;
}

export const adminAuth = appInitialized ? getAuth() : null;
export const adminDb = appInitialized ? getDatabase() : null;

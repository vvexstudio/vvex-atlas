/* eslint-disable @typescript-eslint/no-require-imports */
import type { Auth } from "firebase-admin/auth";
import type { Database } from "firebase-admin/database";

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

let adminAuthInstance: Auth | null = null;
let adminDbInstance: Database | null = null;

if (projectId && clientEmail && privateKey) {
  try {
    const { initializeApp, getApps, cert } = require("firebase-admin/app");
    const { getAuth } = require("firebase-admin/auth");
    const { getDatabase } = require("firebase-admin/database");

    if (getApps().length === 0) {
      initializeApp({
        credential: cert({
          projectId,
          clientEmail,
          privateKey,
        }),
        databaseURL: rawDbUrl || `https://${projectId}-default-rtdb.firebaseio.com`,
      });
      console.log("Firebase Admin SDK successfully initialized.");
    }
    const currentApps = getApps();
    if (currentApps.length > 0) {
      adminAuthInstance = getAuth();
      adminDbInstance = getDatabase();
    }
  } catch (error: any) {
    console.warn(
      "Firebase Admin SDK initialization skipped (invalid or placeholder credentials):",
      error?.message || error
    );
  }
}

export const adminAuth = adminAuthInstance;
export const adminDb = adminDbInstance;

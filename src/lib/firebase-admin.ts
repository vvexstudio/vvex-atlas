import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getDatabase } from "firebase-admin/database";

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
let privateKey = process.env.FIREBASE_PRIVATE_KEY;

if (privateKey) {
  // Normalize newline formatting for private key strings in env files
  privateKey = privateKey.replace(/\\n/g, "\n");
}

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
        databaseURL: process.env.FIREBASE_DATABASE_URL || `https://${projectId}-default-rtdb.firebaseio.com`,
      });
      appInitialized = true;
      console.log("Firebase Admin SDK successfully initialized.");
    } catch (error) {
      console.error("Failed to initialize Firebase Admin SDK:", error);
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

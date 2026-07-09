import { App, initializeApp, getApps, getApp, cert } from "firebase-admin/app";
import { Database, getDatabase } from "firebase-admin/database";

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY;
const databaseURL = process.env.FIREBASE_DATABASE_URL;

let adminApp: App | null = null;
let adminDb: Database | null = null;

if (projectId && clientEmail && privateKey && databaseURL) {
  try {
    if (getApps().length === 0) {
      const formattedPrivateKey = privateKey.replace(/\\n/g, "\n");
      adminApp = initializeApp({
        credential: cert({
          projectId,
          clientEmail,
          privateKey: formattedPrivateKey,
        }),
        databaseURL,
      });
    } else {
      adminApp = getApp();
    }
    adminDb = getDatabase(adminApp);
  } catch (error) {
    console.error("Failed to initialize Firebase Admin SDK:", error);
  }
} else {
  console.log("Firebase Admin SDK credentials missing. Admin database is unavailable.");
}

export { adminApp, adminDb };

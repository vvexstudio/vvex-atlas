import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getDatabase } from "firebase/database";

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

const firebaseConfig = {
  apiKey: cleanEnvString(process.env.NEXT_PUBLIC_FIREBASE_API_KEY),
  authDomain: cleanEnvString(process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN),
  databaseURL: cleanEnvString(process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL),
  projectId: cleanEnvString(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID),
  storageBucket: cleanEnvString(process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET),
  messagingSenderId: cleanEnvString(process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID),
  appId: cleanEnvString(process.env.NEXT_PUBLIC_FIREBASE_APP_ID),
};

const isConfigured = !!(
  firebaseConfig.apiKey &&
  firebaseConfig.databaseURL &&
  firebaseConfig.projectId
);

let app = null;

if (getApps().length === 0 && isConfigured) {
  try {
    app = initializeApp(firebaseConfig);
    console.log("Firebase Client SDK successfully initialized.");
  } catch (error) {
    console.error("Failed to initialize Firebase Client SDK:", error);
  }
} else if (getApps().length > 0) {
  app = getApps()[0];
}

export const clientAuth = app ? getAuth(app) : null;
export const clientDb = app ? getDatabase(app) : null;

import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
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

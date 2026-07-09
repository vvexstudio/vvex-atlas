import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { getAuth, Auth } from "firebase/auth";
import { getDatabase, Database } from "firebase/database";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

let clientApp: FirebaseApp | null = null;
let clientAuth: Auth | null = null;
let clientDb: Database | null = null;

if (firebaseConfig.apiKey && firebaseConfig.databaseURL && firebaseConfig.projectId) {
  try {
    clientApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    clientAuth = getAuth(clientApp);
    clientDb = getDatabase(clientApp);
  } catch (error) {
    console.error("Failed to initialize Firebase Client SDK:", error);
  }
} else {
  if (typeof window !== "undefined") {
    console.log("Firebase Client SDK config missing. Running in static mode.");
  }
}

export { clientApp, clientAuth, clientDb };

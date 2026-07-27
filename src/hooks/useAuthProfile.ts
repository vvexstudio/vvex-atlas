import { useState, useEffect } from "react";
import { signInWithCustomToken } from "firebase/auth";
import { clientAuth } from "@/lib/firebase-client";

export interface UserSession {
  email: string;
  name?: string;
  picture?: string;
  role?: string;
}

export const useAuthProfile = (initialSession?: UserSession) => {
  const [userSession] = useState<UserSession | undefined>(initialSession);
  const [role, setRole] = useState<string>(initialSession?.role || "public");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const auth = clientAuth;
    if (!auth) {
      console.log("Firebase Auth is unconfigured.");
      setIsLoading(false);
      return;
    }

    async function authenticate() {
      try {
        const tokenRes = await fetch("/api/auth/firebase-token");
        if (!tokenRes.ok) {
          console.log(`Public or guest mode (Status ${tokenRes.status}). Using public role.`);
          setRole(initialSession?.role || "public");
          setIsLoading(false);
          return;
        }
        
        const data = await tokenRes.json();
        if (data.token && auth) {
          await signInWithCustomToken(auth, data.token);
          console.log(`Signed in to Firebase with custom claims. Role: ${data.role}`);
          setRole(data.role || "public");
        } else {
          setRole(data.role || initialSession?.role || "public");
        }
      } catch (err) {
        console.warn("Firebase token fetch warning, defaulting to public role:", err);
        setRole(initialSession?.role || "public");
      } finally {
        setIsLoading(false);
      }
    }

    authenticate();
  }, []);

  return { userSession, role, isLoading };
};

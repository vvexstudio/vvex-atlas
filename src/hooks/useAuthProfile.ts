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
  const [role, setRole] = useState<string | null>(initialSession?.role || null);
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
          throw new Error(`Token fetch failed: status ${tokenRes.status}`);
        }
        
        const { token, role: userRole } = await tokenRes.json();
        if (!token) {
          throw new Error("No custom token returned from endpoint");
        }

        await signInWithCustomToken(auth!, token);
        console.log(`Signed in to Firebase with custom claims. Role: ${userRole}`);
        setRole(userRole);
      } catch (err) {
        console.error("Firebase custom token auth failed:", err);
      } finally {
        setIsLoading(false);
      }
    }

    authenticate();
  }, []);

  return { userSession, role, isLoading };
};

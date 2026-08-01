import { useState, useEffect } from "react";
import { signInWithCustomToken, signOut } from "firebase/auth";
import { clientAuth } from "@/lib/firebase-client";

export interface UserSession {
  email: string;
  name?: string;
  picture?: string;
  role?: string;
  departments?: string[];
}

export const useAuthProfile = (initialSession?: UserSession) => {
  const [userSession, setUserSession] = useState<UserSession | undefined>(initialSession);
  const [role, setRole] = useState<string>(initialSession?.role || "public");
  const [departments, setDepartments] = useState<string[]>(initialSession?.departments || []);
  const [isLoading, setIsLoading] = useState(true);

  // Synchronize state dynamically whenever initialSession updates
  useEffect(() => {
    setUserSession(initialSession);
    if (initialSession?.role) setRole(initialSession.role);
    if (initialSession?.departments) setDepartments(initialSession.departments);
  }, [initialSession]);

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
          if (auth?.currentUser) {
            await signOut(auth);
          }
          setRole(initialSession?.role || "public");
          setDepartments(initialSession?.departments || []);
          setIsLoading(false);
          return;
        }
        
        const data = await tokenRes.json();
        if (data.role) setRole(data.role);
        if (Array.isArray(data.departments)) setDepartments(data.departments);

        if (data.token && auth) {
          // If current signed-in Firebase user does not match session email, sign out first
          if (auth.currentUser && auth.currentUser.email !== initialSession?.email) {
            await signOut(auth);
          }
          await signInWithCustomToken(auth, data.token);
          console.log(`Signed in to Firebase with custom claims. Role: ${data.role}`);
        }
      } catch (err) {
        console.warn("Firebase token fetch warning, defaulting to public role:", err);
        setRole(initialSession?.role || "public");
        setDepartments(initialSession?.departments || []);
      } finally {
        setIsLoading(false);
      }
    }

    authenticate();
  }, [initialSession]);

  return { userSession, role, departments, isLoading };
};

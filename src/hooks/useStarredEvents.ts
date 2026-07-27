import { useState, useEffect, useCallback } from "react";
import { ref, onValue, set } from "firebase/database";
import { clientDb, clientAuth } from "@/lib/firebase-client";
import { onAuthStateChanged } from "firebase/auth";

const LOCAL_STORAGE_KEY = "portal_starred_events";

/**
 * Escapes email address to be compatible with Firebase Realtime Database keys.
 * Replaces '.' with ','
 */
function escapeEmail(email: string): string {
  return email.trim().toLowerCase().replace(/\./g, ",");
}

export const useStarredEvents = (userEmail?: string) => {
  const [starredIds, setStarredIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeEmail, setActiveEmail] = useState<string | undefined>(userEmail);

  // Escaped email for database path
  const escapedEmail = activeEmail ? escapeEmail(activeEmail) : undefined;

  // Listen to Firebase Auth state change to sync active user session
  useEffect(() => {
    const auth = clientAuth;
    if (!auth) {
      setTimeout(() => {
        setIsLoading(false);
      }, 0);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user && user.email) {
        setActiveEmail(user.email);
      } else {
        setActiveEmail(userEmail);
      }
    });

    return () => unsubscribe();
  }, [userEmail]);

  // Real-time synchronization from database or localStorage fallback
  useEffect(() => {
    const isAuthed = Boolean(clientDb && escapedEmail && clientAuth?.currentUser);

    // Case 1: Offline / unauthenticated public guest / unconfigured Firebase -> LocalStorage
    if (!isAuthed) {
      setTimeout(() => {
        try {
          const localData = localStorage.getItem(LOCAL_STORAGE_KEY);
          setStarredIds(localData ? JSON.parse(localData) : []);
        } catch (err) {
          console.warn("Failed to parse starred events from localStorage:", err);
          setStarredIds([]);
        }
        setIsLoading(false);
      }, 0);
      return;
    }

    // Case 2: Authenticated Sync from RTDB
    setTimeout(() => {
      setIsLoading(true);
    }, 0);
    const starredRef = ref(clientDb!, `user-data/${escapedEmail}/starred`);
    
    const unsubscribe = onValue(
      starredRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const val = snapshot.val();
          if (Array.isArray(val)) {
            setStarredIds(val.filter(Boolean));
          } else if (typeof val === "object" && val !== null) {
            setStarredIds(Object.keys(val).filter((k) => val[k] === true));
          } else {
            setStarredIds([]);
          }
        } else {
          setStarredIds([]);
        }
        setIsLoading(false);
      },
      (error) => {
        console.warn("Firebase RTDB read skipped for starred events, using localStorage fallback:", error.message);
        try {
          const localData = localStorage.getItem(LOCAL_STORAGE_KEY);
          setStarredIds(localData ? JSON.parse(localData) : []);
        } catch (e) {
          setStarredIds([]);
        }
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [escapedEmail]);

  // Star toggling function
  const toggleStar = useCallback(
    async (eventId: string) => {
      if (!eventId) return;

      const isCurrentlyStarred = starredIds.includes(eventId);
      const newStarredIds = isCurrentlyStarred
        ? starredIds.filter((id) => id !== eventId)
        : [...starredIds, eventId];

      // Optimistic local state update
      setStarredIds(newStarredIds);

      // Save to appropriate storage
      if (clientDb && escapedEmail) {
        try {
          const itemRef = ref(clientDb, `user-data/${escapedEmail}/starred/${eventId}`);
          await set(itemRef, isCurrentlyStarred ? null : true);
        } catch (err) {
          console.error("Failed to write starred status to Firebase RTDB:", err);
          // If RTDB write fails, save to localStorage as backup
          localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(newStarredIds));
        }
      } else {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(newStarredIds));
      }
    },
    [starredIds, escapedEmail]
  );

  const isStarred = useCallback(
    (eventId: string) => {
      return starredIds.includes(eventId);
    },
    [starredIds]
  );

  return { starredIds, toggleStar, isStarred, isLoading };
};

import { Venue, FestivalEvent, Department } from "@/types/festival";

export interface OfflineSnapshot {
  venues: Venue[];
  events: FestivalEvent[];
  personnel: unknown[];
  departments: Department[];
  role: string;
  timestamp: string; // ISO string
}

const STORAGE_KEY = "portal_offline_snapshot";

/**
 * Saves a data snapshot for offline use, scoped by role.
 */
export function saveOfflineSnapshot(
  venues: Venue[],
  events: FestivalEvent[],
  personnel: unknown[],
  departments: Department[],
  role: string = "public"
) {
  if (typeof window === "undefined") return;
  try {
    const snap: OfflineSnapshot = {
      venues,
      events,
      personnel,
      departments,
      role: role.toLowerCase(),
      timestamp: new Date().toISOString(),
    };
    localStorage.setItem(`${STORAGE_KEY}_${role.toLowerCase()}`, JSON.stringify(snap));
  } catch (err) {
    console.error("Failed to save offline snapshot to localStorage:", err);
  }
}

/**
 * Loads a cached data snapshot for a specific role if available.
 */
export function loadOfflineSnapshot(role: string = "public"): OfflineSnapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY}_${role.toLowerCase()}`);
    if (!raw) return null;
    return JSON.parse(raw) as OfflineSnapshot;
  } catch (err) {
    console.error("Failed to parse offline snapshot from localStorage:", err);
    return null;
  }
}

/**
 * Clears cached offline snapshots from localStorage.
 */
export function clearOfflineSnapshots() {
  if (typeof window === "undefined") return;
  try {
    const roles = ["public", "crew", "admin"];
    roles.forEach((role) => {
      localStorage.removeItem(`${STORAGE_KEY}_${role}`);
    });
  } catch (err) {
    console.error("Failed to clear offline snapshots from localStorage:", err);
  }
}

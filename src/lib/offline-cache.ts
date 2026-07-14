import { Venue, FestivalEvent, Department } from "@/types/festival";

export interface OfflineSnapshot {
  venues: Venue[];
  events: FestivalEvent[];
  personnel: unknown[];
  departments: Department[];
  timestamp: string; // ISO string
}

const STORAGE_KEY = "portal_offline_snapshot";

/**
 * Saves a data snapshot for offline use.
 */
export function saveOfflineSnapshot(
  venues: Venue[],
  events: FestivalEvent[],
  personnel: unknown[],
  departments: Department[]
) {
  if (typeof window === "undefined") return;
  try {
    const snap: OfflineSnapshot = {
      venues,
      events,
      personnel,
      departments,
      timestamp: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snap));
  } catch (err) {
    console.error("Failed to save offline snapshot to localStorage:", err);
  }
}

/**
 * Loads a cached data snapshot if available.
 */
export function loadOfflineSnapshot(): OfflineSnapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as OfflineSnapshot;
  } catch (err) {
    console.error("Failed to parse offline snapshot from localStorage:", err);
    return null;
  }
}

import type { FestivalEvent } from "@/types/festival";

/**
 * Filters events based on active user role.
 * - 'admin', 'crew', 'lead': See all events.
 * - 'public', 'guest', or unauthenticated: ONLY see events explicitly tagged for public / FOH.
 */
export function filterEventsByRole(events: FestivalEvent[], role: string = "public"): FestivalEvent[] {
  const normalizedRole = (role || "").toLowerCase();

  // Only filter when explicitly in "public" view
  if (normalizedRole !== "public") {
    return events;
  }

  return events.filter((e) => {
    const dept = (e.department || "").toLowerCase();
    const cat = (e.scheduleCategory || "").toLowerCase();
    const action = (e.action || "").toLowerCase();

    const isInternal =
      dept.includes("admin") ||
      dept.includes("all departments") ||
      dept.includes("boh") ||
      cat.includes("boh") ||
      cat.includes("internal");

    return !isInternal;
  });
}

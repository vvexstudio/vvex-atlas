import type { FestivalEvent } from "@/types/festival";

/**
 * Filters events based on active user role.
 * - 'admin', 'crew', 'lead': See all events.
 * - 'public', 'guest', or unauthenticated: ONLY see events explicitly tagged for public / FOH.
 */
export function filterEventsByRole(events: FestivalEvent[], role: string = "public"): FestivalEvent[] {
  if (role === "admin" || role === "crew" || role === "lead" || role === "guest") {
    return events;
  }
  return events.filter((e) => {
    const dept = (e.department || "").toLowerCase();
    const cat = (e.scheduleCategory || "").toLowerCase();
    const isExplicitlyPublic = dept.includes("public") || dept.includes("foh") || cat.includes("public");
    const isInternal = dept.includes("admin") || dept.includes("all departments") || cat.includes("boh");
    return isExplicitlyPublic && !isInternal;
  });
}
